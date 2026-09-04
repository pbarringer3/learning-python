<script lang="ts">
  /**
   * Shared Python code editor, used by both the Karel and Python environments.
   *
   * Indentation is fixed at two spaces to match the convention every piece of
   * student-facing code in the curriculum follows.
   *
   * Two features are opt-in, because Karel wants neither: line-count sizing
   * (`minLines`/`maxLines`) and the breakpoint gutter. See
   * `PythonInterpreterDesign.md` §12.1 and §12.3.
   */
  import { onMount, onDestroy } from 'svelte';
  import { minimalSetup } from 'codemirror';
  import { python } from '@codemirror/lang-python';
  import {
    Compartment,
    EditorState,
    type Extension,
    RangeSet,
    StateEffect,
    StateField
  } from '@codemirror/state';
  import {
    Decoration,
    type DecorationSet,
    EditorView,
    GutterMarker,
    gutterLineClass,
    lineNumbers,
    highlightActiveLine
  } from '@codemirror/view';
  import { indentUnit, bracketMatching, indentOnInput } from '@codemirror/language';
  import { keymap } from '@codemirror/view';
  import { indentWithTab } from '@codemirror/commands';
  import { closeBrackets } from '@codemirror/autocomplete';
  import { highlightSelectionMatches } from '@codemirror/search';
  import { canSetBreakpoint } from '$lib/python/breakpoints';

  interface Props {
    value: string;
    onchange?: (value: string) => void;
    highlightedLine?: number | null;
    isError?: boolean;
    readonly?: boolean;
    /** Rows the editor never shrinks below. Omit for a content-sized height. */
    minLines?: number | null;
    /** Rows the editor never grows past, scrolling instead. */
    maxLines?: number | null;
    /** Let clicks in the line-number gutter toggle breakpoints. */
    breakpointsEnabled?: boolean;
    /** 1-based lines currently marked. */
    breakpoints?: number[];
    /** Fired when the marked lines change, including after an edit moves them. */
    onBreakpointsChange?: (lines: number[]) => void;
    class?: string;
  }

  let {
    value = $bindable(''),
    onchange,
    highlightedLine = null,
    isError = false,
    readonly = false,
    minLines = null,
    maxLines = null,
    breakpointsEnabled = false,
    breakpoints = [],
    onBreakpointsChange,
    class: className = ''
  }: Props = $props();

  let editorContainer: HTMLDivElement;
  let editorView: EditorView | null = null;

  /**
   * Line box, in pixels. Pinned rather than inherited so `minLines`/`maxLines`
   * are exact multiples of a line rather than an estimate that drifts with the
   * browser's default `line-height: normal`.
   */
  const LINE_HEIGHT = 20;
  /** `.cm-content`'s own 4px top and bottom padding. */
  const CONTENT_PADDING = 8;

  // Editability changes while a program runs, so it has to be reconfigurable
  // rather than baked into the initial state.
  const editableCompartment = new Compartment();

  // Effect for updating highlighted line
  const setHighlightedLineEffect = StateEffect.define<number | null>();

  // Store whether this is an error highlight
  let isErrorHighlight = $state(false);

  // State field for line highlighting
  const highlightedLineField = StateField.define<DecorationSet>({
    create() {
      return Decoration.none;
    },
    update(decorations, tr) {
      decorations = decorations.map(tr.changes);

      for (let effect of tr.effects) {
        if (effect.is(setHighlightedLineEffect)) {
          if (effect.value === null) {
            decorations = Decoration.none;
          } else {
            // Clamp both ends: an out-of-range line makes `doc.line` throw,
            // and a throw inside the update cycle takes the editor down.
            const lineNumber = Math.min(Math.max(effect.value, 1), tr.state.doc.lines);
            const line = tr.state.doc.line(lineNumber);
            const className = isErrorHighlight ? 'cm-error-line' : 'cm-highlighted-line';
            decorations = Decoration.set([Decoration.line({ class: className }).range(line.from)]);
          }
        }
      }
      return decorations;
    },
    provide: (f) => EditorView.decorations.from(f)
  });

  // --- Breakpoints ---------------------------------------------------------

  /**
   * Marks the gutter element for its line. It carries no DOM of its own: the
   * line number itself becomes the marker, which is what makes "click a line
   * number" the obvious gesture.
   */
  class BreakpointMarker extends GutterMarker {
    elementClass = 'cm-breakpoint';
  }

  const breakpointMarker = new BreakpointMarker();

  /** Replace the whole set, in document line numbers. */
  const setBreakpointsEffect = StateEffect.define<number[]>();
  /** Toggle one line, judged against the rule in `breakpoints.ts`. */
  const toggleBreakpointEffect = StateEffect.define<number>();

  function markersForLines(state: EditorState, lines: number[]): RangeSet<GutterMarker> {
    const positions = lines
      .filter((line) => line >= 1 && line <= state.doc.lines)
      .map((line) => state.doc.line(line).from)
      .sort((a, b) => a - b);
    return RangeSet.of(
      positions.map((from) => breakpointMarker.range(from)),
      true
    );
  }

  /** The set as sorted, de-duplicated line numbers. */
  function linesOf(set: RangeSet<GutterMarker>, state: EditorState): number[] {
    const lines = new Set<number>();
    const cursor = set.iter();
    while (cursor.value !== null) {
      lines.add(state.doc.lineAt(cursor.from).number);
      cursor.next();
    }
    return [...lines].sort((a, b) => a - b);
  }

  /** Add a mark to `lineNumber`, or clear every mark already on that line. */
  function toggleAt(
    set: RangeSet<GutterMarker>,
    state: EditorState,
    lineNumber: number
  ): RangeSet<GutterMarker> {
    if (lineNumber < 1 || lineNumber > state.doc.lines) return set;
    const line = state.doc.line(lineNumber);
    // An edit can slide two marks onto one line, so removal is by range rather
    // than by a single position.
    let occupied = false;
    set.between(line.from, line.to, () => {
      occupied = true;
      return false;
    });
    const lines = linesOf(set, state).filter((n) => n !== lineNumber);
    if (!occupied && canSetBreakpoint(line.text)) lines.push(lineNumber);
    return markersForLines(state, lines);
  }

  /**
   * The authoritative breakpoint set, held as document positions so a mark
   * rides along with its statement when lines are inserted above it — which a
   * bare list of line numbers could not do (`PythonInterpreterDesign.md` §12.3).
   */
  const breakpointField = StateField.define<RangeSet<GutterMarker>>({
    create() {
      return RangeSet.empty;
    },
    update(set, tr) {
      set = set.map(tr.changes);
      for (const effect of tr.effects) {
        if (effect.is(setBreakpointsEffect)) {
          set = markersForLines(tr.state, effect.value);
        } else if (effect.is(toggleBreakpointEffect)) {
          set = toggleAt(set, tr.state, effect.value);
        }
      }
      return set;
    }
  });

  /** Last set reported upward, so an echo does not loop back in as a change. */
  let reported = '[]';

  function reportBreakpoints(state: EditorState): void {
    const lines = linesOf(state.field(breakpointField), state);
    const encoded = JSON.stringify(lines);
    if (encoded === reported) return;
    reported = encoded;
    onBreakpointsChange?.(lines);
  }

  onMount(() => {
    // Applied per instance rather than as global CSS: Karel shares this
    // component and keeps its own content-sized editor.
    const theme: Record<string, Record<string, string>> = {
      '.cm-content, .cm-gutters': {
        fontSize: '13px',
        lineHeight: `${LINE_HEIGHT}px`
      },
      '.cm-tab': {
        display: 'inline-block',
        textDecoration: 'none'
      }
    };
    if (minLines || maxLines) {
      const scroller: Record<string, string> = {};
      if (minLines) scroller.minHeight = `${minLines * LINE_HEIGHT + CONTENT_PADDING}px`;
      if (maxLines) scroller.maxHeight = `${maxLines * LINE_HEIGHT + CONTENT_PADDING}px`;
      theme['.cm-scroller'] = scroller;
    }

    const gutter = breakpointsEnabled
      ? lineNumbers({
          domEventHandlers: {
            mousedown(view, line) {
              // The gutter stays live while the program is paused: someone
              // debugging a stopped program is exactly who needs to add one.
              view.dispatch({
                effects: toggleBreakpointEffect.of(view.state.doc.lineAt(line.from).number)
              });
              return true;
            }
          }
        })
      : lineNumbers();

    const extensions: Extension[] = [
      minimalSetup,
      gutter,
      highlightActiveLine(),
      bracketMatching(),
      closeBrackets(),
      indentOnInput(),
      highlightSelectionMatches(),
      python(),
      indentUnit.of('  '), // Use 2 spaces for indentation (Python standard)
      keymap.of([indentWithTab]), // Tab key inserts spaces instead of tab character
      EditorView.theme(theme),
      highlightedLineField,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newValue = update.state.doc.toString();
          value = newValue;
          if (onchange) {
            onchange(newValue);
          }
        }
        // Also on a plain edit: the marks may have moved with their lines.
        if (breakpointsEnabled) reportBreakpoints(update.state);
      }),
      editableCompartment.of(EditorView.editable.of(!readonly))
    ];

    if (breakpointsEnabled) {
      extensions.push(breakpointField, gutterLineClass.from(breakpointField));
    }

    editorView = new EditorView({
      state: EditorState.create({ doc: value, extensions }),
      parent: editorContainer
    });

    if (breakpointsEnabled && breakpoints.length > 0) {
      reported = JSON.stringify(breakpoints);
      editorView.dispatch({ effects: setBreakpointsEffect.of(breakpoints) });
    }
  });

  onDestroy(() => {
    if (editorView) {
      editorView.destroy();
    }
  });

  // Update editor when value changes externally
  $effect(() => {
    if (editorView && value !== editorView.state.doc.toString()) {
      editorView.dispatch({
        changes: {
          from: 0,
          to: editorView.state.doc.length,
          insert: value
        }
      });
    }
  });

  // Accept a set pushed in from outside — restored from storage, or cleared by
  // Reset code. Guarded against the echo of what this editor just reported.
  $effect(() => {
    const incoming = JSON.stringify(breakpoints);
    if (!editorView || !breakpointsEnabled || incoming === reported) return;
    reported = incoming;
    editorView.dispatch({ effects: setBreakpointsEffect.of(breakpoints) });
  });

  // Update highlighted line
  $effect(() => {
    if (editorView) {
      isErrorHighlight = isError;
      editorView.dispatch({
        effects: setHighlightedLineEffect.of(highlightedLine)
      });
    }
  });

  // Update readonly state
  $effect(() => {
    editorView?.dispatch({
      effects: editableCompartment.reconfigure(EditorView.editable.of(!readonly))
    });
  });
</script>

<div class="code-editor-wrapper {className}" class:breakpoints={breakpointsEnabled}>
  <div bind:this={editorContainer} class="code-editor"></div>
</div>

<style>
  .code-editor-wrapper {
    border: 1px solid #ccc;
    border-radius: 4px;
    overflow: hidden;
  }

  .code-editor {
    height: 100%;
  }

  :global(.cm-editor) {
    height: 100%;
  }

  :global(.cm-scroller) {
    overflow: auto;
  }

  :global(.cm-highlighted-line) {
    background-color: #ffeb3b80 !important;
  }

  :global(.cm-error-line) {
    background-color: #ff000040 !important;
  }

  /* The line number is the breakpoint control, so it has to look clickable. */
  .code-editor-wrapper.breakpoints :global(.cm-lineNumbers .cm-gutterElement) {
    cursor: pointer;
  }

  .code-editor-wrapper.breakpoints :global(.cm-lineNumbers .cm-gutterElement:hover) {
    background-color: #fee2e2;
  }

  .code-editor-wrapper.breakpoints :global(.cm-gutterElement.cm-breakpoint) {
    background-color: #ef4444;
    color: white;
    font-weight: 600;
  }
</style>
