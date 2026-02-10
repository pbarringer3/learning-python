<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EditorView, basicSetup } from 'codemirror';
  import { python } from '@codemirror/lang-python';
  import { EditorState, type Extension, StateEffect, StateField } from '@codemirror/state';
  import { Decoration, type DecorationSet } from '@codemirror/view';
  import { indentUnit } from '@codemirror/language';
  import { keymap } from '@codemirror/view';
  import { indentWithTab } from '@codemirror/commands';

  interface Props {
    value: string;
    onchange?: (value: string) => void;
    highlightedLine?: number | null;
    isError?: boolean;
    readonly?: boolean;
    class?: string;
  }

  let {
    value = $bindable(''),
    onchange,
    highlightedLine = null,
    isError = false,
    readonly = false,
    class: className = ''
  }: Props = $props();

  let editorContainer: HTMLDivElement;
  let editorView: EditorView | null = null;

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
            const line = tr.state.doc.line(Math.min(effect.value, tr.state.doc.lines));
            const className = isErrorHighlight ? 'cm-error-line' : 'cm-highlighted-line';
            decorations = Decoration.set([Decoration.line({ class: className }).range(line.from)]);
          }
        }
      }
      return decorations;
    },
    provide: (f) => EditorView.decorations.from(f)
  });

  onMount(() => {
    const extensions: Extension[] = [
      basicSetup,
      python(),
      indentUnit.of('  '), // Use 2 spaces for indentation (Python standard)
      keymap.of([indentWithTab]), // Tab key inserts spaces instead of tab character
      EditorView.theme({
        '.cm-tab': {
          display: 'inline-block',
          textDecoration: 'none'
        }
      }),
      highlightedLineField,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newValue = update.state.doc.toString();
          value = newValue;
          if (onchange) {
            onchange(newValue);
          }
        }
      }),
      EditorView.editable.of(!readonly)
    ];

    const startState = EditorState.create({
      doc: value,
      extensions
    });

    editorView = new EditorView({
      state: startState,
      parent: editorContainer
    });
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
    if (editorView && readonly !== undefined) {
      // For now, readonly state changes require recreating the editor
      // This is a simplified approach
    }
  });
</script>

<div class="code-editor-wrapper {className}">
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
</style>
