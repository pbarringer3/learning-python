<script lang="ts">
  /**
   * Embeddable Python environment: editor, output console, execution controls,
   * and the call stack visualizer.
   *
   * This is the Python counterpart to `KarelEnvironment` — the shared piece of
   * infrastructure Chapter 2 onward is built on, and the host for the
   * visualizer described in `PythonInterpreterDesign.md`.
   *
   * Everything runs in a worker, so the page stays responsive while a program
   * is paused mid-execution and `input()` can genuinely block rather than being
   * faked with a queue.
   *
   * Panel order is editor / output / controls, with the console fixed in
   * height, so nothing under the pointer moves while a program is being
   * stepped. See §12.1.
   */
  import { onDestroy, onMount } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import PythonControls from '$lib/components/PythonControls.svelte';
  import PythonOutput from '$lib/components/PythonOutput.svelte';
  import CallStackVisualizer from '$lib/components/CallStackVisualizer.svelte';
  import PythonTestResults from '$lib/components/PythonTestResults.svelte';
  import { progressStore } from '$lib/curriculum/progress';
  import { getLessonByNumber } from '$lib/curriculum/index';
  import {
    PythonTestHarness,
    type PythonTestResult,
    type TestHost
  } from '$lib/python/exercise-tests';
  import {
    ensureCrossOriginIsolated,
    isolationMessage,
    type IsolationState
  } from '$lib/python/coi';
  import {
    PythonRunner,
    type FinishReason,
    type OutputChunk,
    type RunMode,
    type RunnerStatus
  } from '$lib/python/runner';
  import {
    BREAKPOINT_PREFIX,
    clampBreakpoints,
    parseBreakpoints,
    serializeBreakpoints
  } from '$lib/python/breakpoints';
  import type { PythonError } from '$lib/python/protocol';
  import type { Snapshot } from '$lib/python/snapshot';
  import type { PythonConfig } from '$lib/python/config';

  interface Props {
    config: PythonConfig;
    class?: string;
  }

  let { config, class: className = '' }: Props = $props();

  // --- Persistence (same key convention as KarelEnvironment) ---
  const CODE_PREFIX = 'learning-python-code:';
  /** Whether the student has the visualizer open, per exercise. */
  const VISUALIZER_PREFIX = 'learning-python-visualizer:';

  function readStored(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStored(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // localStorage may be full or unavailable — silently degrade
    }
  }

  /** Editor rows, per §12.1: a floor as well as a ceiling. */
  const MIN_EDITOR_LINES = 10;
  const DEFAULT_MAX_EDITOR_LINES = 20;

  let code = $state('');
  let breakpoints = $state<number[]>([]);
  let status = $state<RunnerStatus>('loading');
  let chunks = $state<OutputChunk[]>([]);
  let snapshot = $state<Snapshot | null>(null);
  let error = $state<PythonError | null>(null);
  let inputPrompt = $state<string | null>(null);
  let isolation = $state<IsolationState | null>(null);
  let loadError = $state<string | null>(null);
  /** How the last run ended, for the visualizer's banner. */
  let finish = $state<FinishReason | null>(null);
  /**
   * The student's own choice, once they have made one. `null` means they have
   * not, so `config.showVisualizer` still decides — it is the pedagogical
   * default for a first arrival, not a setting re-imposed on every visit (§12.4).
   */
  let visualizerOverride = $state<boolean | null>(null);
  /** `null` until the tests have been run once in this session. */
  let testResults = $state<PythonTestResult[] | null>(null);
  let runningTests = $state(false);
  /** Survives a reload: the tick is read back from the progress store. */
  let exerciseCompleted = $state(false);

  // Live, so the banner appears the moment the last case passes and disappears
  // on Reset code — the same subscription `KarelEnvironment` uses.
  progressStore.subscribe((progress) => {
    const parts = exerciseParts();
    if (!parts) return;
    exerciseCompleted =
      progress.lessons[parts.lessonKey]?.exerciseResults?.[parts.exerciseId]?.completed ?? false;
  });

  let runner: PythonRunner | null = null;
  /**
   * Non-null exactly while the tests are running. Its presence is what diverts
   * the runner's callbacks away from the console: a test run must not leave the
   * student staring at the output of case three as though they had run their
   * own program (§13.4).
   */
  let harness: PythonTestHarness | null = null;

  let maxEditorLines = $derived(config.editorLines ?? DEFAULT_MAX_EDITOR_LINES);
  let visualizerVisible = $derived(visualizerOverride ?? config.showVisualizer !== false);
  let busy = $derived(
    status === 'running' || status === 'paused' || status === 'awaiting-input' || runningTests
  );
  let hasTests = $derived((config.tests?.cases.length ?? 0) > 0);
  // A finished program has no line executing; the snapshot reports line 0.
  let highlightedLine = $derived(
    (snapshot?.line || null) ?? (status === 'error' ? (error?.line ?? null) : null)
  );

  /**
   * What the visualizer says above a snapshot that is no longer live.
   *
   * The same final view appears however the program got there — stepping to the
   * end, Play, or To breakpoint with nothing ahead — so the banner is what
   * distinguishes them. See §12.5.
   */
  let banner = $derived.by(() => {
    if (status === 'error') return 'Program stopped with an error';
    if (status !== 'finished') return null;
    return finish === 'stopped' ? 'Stopped' : 'Program complete';
  });

  // Initialize code and breakpoints: saved work wins over the starter code.
  $effect(() => {
    const key = config.persistenceKey;
    if (!key) {
      code = config.initialCode;
      return;
    }
    // Held in a local and never read back off `code`: reading state this effect
    // has just written would make it depend on itself, and every keystroke
    // would re-run it and revert the editor to what was last saved.
    const source = readStored(CODE_PREFIX + key) ?? config.initialCode;
    code = source;
    breakpoints = clampBreakpoints(
      parseBreakpoints(readStored(BREAKPOINT_PREFIX + key)),
      source.split('\n').length
    );
    // A visualizer the student closed stays closed across reloads.
    const stored = readStored(VISUALIZER_PREFIX + key);
    if (stored !== null) visualizerOverride = stored === 'true';
  });

  /**
   * Appending is hot — a `print` in a loop produces one chunk per call — so
   * consecutive writes on the same stream are merged instead of each becoming
   * its own DOM node.
   */
  function appendOutput(chunk: OutputChunk): void {
    const last = chunks[chunks.length - 1];
    if (last && last.stream === chunk.stream && last.text.length < 4096) {
      chunks = [...chunks.slice(0, -1), { stream: last.stream, text: last.text + chunk.text }];
    } else {
      chunks = [...chunks, chunk];
    }
  }

  onMount(() => {
    let cancelled = false;

    (async () => {
      // Registering the header-injecting service worker may reload the page; if
      // it does, this promise never settles and nothing below runs.
      const state = await ensureCrossOriginIsolated();
      if (cancelled) return;
      isolation = state;
      if (state.status !== 'isolated') return;

      runner = new PythonRunner(
        {
          onStatus: (next) => {
            status = next;
          },
          onOutput: (chunk) => {
            if (harness) harness.handleOutput(chunk.text);
            else appendOutput(chunk);
          },
          onSnapshot: (next) => {
            snapshot = next;
          },
          onInputRequest: (prompt) => {
            // The harness answers from its queue; only a student-run program
            // opens the input box.
            if (harness) harness.handleInputRequest();
            else inputPrompt = prompt;
          },
          onError: (next) => {
            if (harness) harness.handleError(describeError(next));
            else error = next;
          },
          onLoadError: (message) => {
            loadError = message;
          },
          onFinish: (reason) => {
            if (harness) harness.handleFinish();
            else finish = reason;
          }
        },
        config.recursionLimit
      );
      runner.setBreakpoints(breakpoints);
      runner.start();
    })();

    return () => {
      cancelled = true;
    };
  });

  onDestroy(() => {
    runner?.dispose();
  });

  // Breakpoints reach the worker through shared memory, so this is safe — and
  // necessary — while the program is paused mid-run.
  //
  // `lines` is read into a local first: `runner?.setBreakpoints(breakpoints)`
  // short-circuits before evaluating its argument while the runner is still
  // booting, so the effect would register no dependency and never run again.
  $effect(() => {
    const lines = breakpoints;
    runner?.setBreakpoints(lines);
  });

  function persist(): void {
    const key = config.persistenceKey;
    if (!key) return;
    writeStored(CODE_PREFIX + key, code);
    writeStored(BREAKPOINT_PREFIX + key, serializeBreakpoints(breakpoints));
  }

  /**
   * Everything a run replaces. Called only when a run starts — that is what
   * makes a Clear button unnecessary, and keeps the console showing exactly one
   * program's output (§12.1).
   */
  function clearRunState(): void {
    chunks = [];
    snapshot = null;
    error = null;
    inputPrompt = null;
    finish = null;
  }

  function start(mode: RunMode): void {
    persist();
    clearRunState();
    runner?.run(code, mode);
  }

  /** Play: run, or resume, ignoring breakpoints entirely. */
  function handlePlay(): void {
    if (status === 'paused') runner?.resume();
    else start('run');
  }

  function handleStep(): void {
    if (status === 'paused') runner?.step();
    else start('step');
  }

  function handleToBreakpoint(): void {
    if (status === 'paused') runner?.resumeToBreakpoint();
    else start('breakpoint');
  }

  function handleStop(): void {
    runner?.stop();
  }

  function handleToggleVisualizer(): void {
    const next = !visualizerVisible;
    visualizerOverride = next;
    if (config.persistenceKey) {
      writeStored(VISUALIZER_PREFIX + config.persistenceKey, String(next));
    }
  }

  function handleResetCode(): void {
    code = config.initialCode;
    // The tests were passed by a program that no longer exists.
    testResults = null;
    const parts = exerciseParts();
    if (parts) progressStore.clearExerciseCompleted(parts.lessonKey, parts.exerciseId);
    // The program those marks referred to is gone (§12.3).
    breakpoints = [];
    persist();
    // The console is left alone — it is cleared by starting a run, not by this.
    // The snapshot and error are not: both are pinned to line numbers in code
    // that no longer exists.
    snapshot = null;
    error = null;
    finish = null;
  }

  /** What a failing case says the program stopped with. */
  function describeError(failure: PythonError): string {
    const where = failure.line === null ? '' : ` (line ${failure.line})`;
    return `${failure.type}: ${failure.message}${where}`;
  }

  /** `"2/4/exercise-1"` split the way `progressStore` wants it. */
  function exerciseParts(): { lessonKey: string; exerciseId: string } | null {
    const key = config.persistenceKey;
    if (!key) return null;
    const lastSlash = key.lastIndexOf('/');
    if (lastSlash < 1) return null;
    return {
      lessonKey: key.substring(0, lastSlash),
      exerciseId: key.substring(lastSlash + 1)
    };
  }

  /** Block until the worker can accept a program again. */
  function waitUntilReady(): Promise<void> {
    return new Promise((resolve) => {
      const poll = (): void => {
        const current = runner?.currentStatus;
        // `failed` resolves too: `run()` is a no-op there, and the case times
        // out with a message, which beats waiting for a boot that never comes.
        if (!current || current !== 'loading') resolve();
        else setTimeout(poll, 50);
      };
      poll();
    });
  }

  /**
   * Run every case against the student's code, then mark the exercise complete
   * if they all passed — the Python counterpart to `KarelEnvironment`'s
   * `allPassed` (§13.6).
   */
  async function handleRunTests(): Promise<void> {
    const tests = config.tests;
    if (!tests || !runner || runningTests) return;

    persist();
    // The console is cleared rather than filled: a test run is not the
    // student's own run, and the results panel is where its output belongs.
    clearRunState();
    runningTests = true;
    testResults = null;

    const host: TestHost = {
      waitUntilReady,
      run: (source) => runner?.run(source, 'run'),
      sendInput: (text) => runner?.sendInput(text),
      stop: () => runner?.stop()
    };

    harness = new PythonTestHarness(host);
    try {
      testResults = await harness.run(code, tests.cases);
    } finally {
      harness = null;
      runningTests = false;
    }

    const parts = exerciseParts();
    const allPassed = testResults.length > 0 && testResults.every((result) => result.passed);
    if (allPassed && parts) {
      const [chapter, lesson] = parts.lessonKey.split('/');
      const found = getLessonByNumber(Number(chapter), Number(lesson));
      progressStore.markExerciseCompleted(
        parts.lessonKey,
        parts.exerciseId,
        found?.lesson.exerciseCount
      );
    }
  }

  function handleInput(value: string): void {
    inputPrompt = null;
    appendOutput({ stream: 'stdout', text: value + '\n' });
    runner?.sendInput(value);
  }
</script>

<div class="python-environment {className}">
  {#if exerciseCompleted}
    <div class="completed-banner">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
      <span>Exercise completed</span>
    </div>
  {/if}

  {#if isolation && isolation.status === 'unsupported'}
    {@const message = isolationMessage(isolation.reason)}
    <div class="notice error">
      <div class="notice-title">{message.title}</div>
      <p class="notice-detail">{message.detail}</p>
    </div>
  {:else if loadError}
    <div class="notice error">
      <div class="notice-title">Python failed to load</div>
      <p class="notice-detail">{loadError}</p>
    </div>
  {:else}
    {#if status === 'loading'}
      <div class="notice">
        <div class="notice-title">Loading Python…</div>
        <p class="notice-detail">
          The first load downloads the Python runtime; later visits are much faster.
        </p>
      </div>
    {/if}

    <div class="layout" class:with-visualizer={visualizerVisible}>
      <div class="pane">
        <CodeEditor
          bind:value={code}
          {highlightedLine}
          isError={status === 'error'}
          readonly={busy}
          minLines={MIN_EDITOR_LINES}
          maxLines={maxEditorLines}
          breakpointsEnabled={true}
          {breakpoints}
          onBreakpointsChange={(lines) => (breakpoints = lines)}
          class="editor"
        />

        <PythonOutput {chunks} {error} {inputPrompt} onSubmitInput={handleInput} />

        <PythonTestResults results={testResults} running={runningTests} />

        <PythonControls
          {status}
          hasBreakpoints={breakpoints.length > 0}
          {visualizerVisible}
          onPlay={handlePlay}
          onStop={handleStop}
          onStep={handleStep}
          onToBreakpoint={handleToBreakpoint}
          {hasTests}
          {runningTests}
          onRunTests={handleRunTests}
          onToggleVisualizer={handleToggleVisualizer}
          onResetCode={handleResetCode}
        />
      </div>

      {#if visualizerVisible}
        <div class="pane visualizer-pane">
          <CallStackVisualizer
            {snapshot}
            {banner}
            bannerTone={status === 'error' ? 'error' : 'neutral'}
          />
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .python-environment {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .completed-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background-color: #ecfdf5;
    border: 1px solid #6ee7b7;
    border-radius: 0.5rem;
    color: #065f46;
    font-weight: 600;
    font-size: 14px;
  }

  .layout {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .pane {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-width: 0;
    flex: 1;
  }

  /*
   * With the visualizer hidden the column has the whole page to spread across,
   * but very long lines of Python are hard to scan — so it stops at a
   * comfortable reading width and the rest stays whitespace (§12.4).
   */
  .layout:not(.with-visualizer) > .pane {
    max-width: 56rem;
  }

  @media (min-width: 1024px) {
    .layout.with-visualizer {
      flex-direction: row;
      align-items: stretch;
    }

    /*
     * Take the visualizer out of flow so the row's height is set by the editor
     * column alone, then stretch it back to fill that height.
     *
     * A flex item's own content counts toward the line's cross size even with
     * `min-height: 0`, so without this a program with a large heap stretches
     * the entire page downward instead of scrolling inside its own panel — and
     * a small one leaves the panel stranded at half the height of the code it
     * is explaining.
     */
    .layout.with-visualizer > .visualizer-pane {
      position: relative;
    }

    .layout.with-visualizer > .visualizer-pane > :global(.visualizer) {
      position: absolute;
      inset: 0;
    }
  }

  /* Stacked layout: nothing establishes a height for the panel to fill, so cap
     it directly rather than letting the heap run off the bottom of the page. */
  @media (max-width: 1023px) {
    .python-environment :global(.visualizer) {
      max-height: 70vh;
    }
  }

  .notice {
    padding: 0.75rem 1rem;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
    background: #eff6ff;
  }

  .notice.error {
    border-color: #fecaca;
    background: #fef2f2;
  }

  .notice-title {
    font-weight: 600;
    color: #1e3a8a;
  }

  .notice.error .notice-title {
    color: #991b1b;
  }

  .notice-detail {
    margin: 0.25rem 0 0;
    font-size: 14px;
    color: #374151;
  }
</style>
