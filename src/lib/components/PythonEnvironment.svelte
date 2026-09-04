<script lang="ts">
  /**
   * Embeddable Python environment: editor, execution controls, output console,
   * and the call stack visualizer.
   *
   * This is the Python counterpart to `KarelEnvironment` — the shared piece of
   * infrastructure Chapter 2 onward is built on, and the host for the
   * visualizer described in `PythonInterpreterDesign.md`.
   *
   * Everything runs in a worker, so the page stays responsive while a program
   * is paused mid-execution and `input()` can genuinely block rather than being
   * faked with a queue.
   */
  import { onDestroy, onMount } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import PythonControls from '$lib/components/PythonControls.svelte';
  import PythonOutput from '$lib/components/PythonOutput.svelte';
  import CallStackVisualizer from '$lib/components/CallStackVisualizer.svelte';
  import {
    ensureCrossOriginIsolated,
    isolationMessage,
    type IsolationState
  } from '$lib/python/coi';
  import { PythonRunner, type OutputChunk, type RunnerStatus } from '$lib/python/runner';
  import type { PythonError } from '$lib/python/protocol';
  import type { Snapshot } from '$lib/python/snapshot';
  import type { PythonConfig } from '$lib/python/config';

  interface Props {
    config: PythonConfig;
    class?: string;
  }

  let { config, class: className = '' }: Props = $props();

  // --- Code persistence (same key convention as KarelEnvironment) ---
  const CODE_PREFIX = 'learning-python-code:';

  function loadSavedCode(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(CODE_PREFIX + key);
    } catch {
      return null;
    }
  }

  function saveCode(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CODE_PREFIX + key, value);
    } catch {
      // localStorage may be full or unavailable — silently degrade
    }
  }

  let code = $state('');
  let status = $state<RunnerStatus>('loading');
  let chunks = $state<OutputChunk[]>([]);
  let snapshot = $state<Snapshot | null>(null);
  let error = $state<PythonError | null>(null);
  let inputPrompt = $state<string | null>(null);
  let isolation = $state<IsolationState | null>(null);
  let loadError = $state<string | null>(null);
  let autoPlaying = $state(false);
  let autoSpeed = $state(400);

  let runner: PythonRunner | null = null;
  let autoTimer: ReturnType<typeof setTimeout> | null = null;

  let showVisualizer = $derived(config.showVisualizer !== false);
  let busy = $derived(status === 'running' || status === 'paused' || status === 'awaiting-input');
  let highlightedLine = $derived(snapshot?.line ?? error?.line ?? null);

  // Initialize code: saved work wins over the starter code.
  $effect(() => {
    if (config.persistenceKey) {
      code = loadSavedCode(config.persistenceKey) ?? config.initialCode;
    } else {
      code = config.initialCode;
    }
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
            // Auto-stepping only makes sense while there is more to step to.
            if (next === 'finished' || next === 'error' || next === 'failed') autoPlaying = false;
          },
          onOutput: appendOutput,
          onSnapshot: (next) => {
            snapshot = next;
          },
          onInputRequest: (prompt) => {
            // A prompt means the program needs a person, so stop stepping on a
            // timer and let them answer.
            autoPlaying = false;
            inputPrompt = prompt;
          },
          onError: (next) => {
            error = next;
          },
          onLoadError: (message) => {
            loadError = message;
          }
        },
        config.recursionLimit
      );
      runner.start();
    })();

    return () => {
      cancelled = true;
    };
  });

  onDestroy(() => {
    if (autoTimer !== null) clearTimeout(autoTimer);
    runner?.dispose();
  });

  // Auto-stepping: one timer per pause, rescheduled by the next pause.
  $effect(() => {
    if (autoTimer !== null) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    if (!autoPlaying || status !== 'paused') return;
    const delay = autoSpeed;
    autoTimer = setTimeout(() => runner?.step(), delay);
    return () => {
      if (autoTimer !== null) clearTimeout(autoTimer);
      autoTimer = null;
    };
  });

  function clearRunState(): void {
    chunks = [];
    snapshot = null;
    error = null;
    inputPrompt = null;
  }

  function persist(): void {
    if (config.persistenceKey) saveCode(config.persistenceKey, code);
  }

  function start(mode: 'run' | 'step'): void {
    persist();
    clearRunState();
    runner?.run(code, mode);
  }

  function handleRun(): void {
    autoPlaying = false;
    start('run');
  }

  function handleStep(): void {
    if (status === 'paused') runner?.step();
    else start('step');
  }

  function handleContinue(): void {
    autoPlaying = false;
    runner?.resume();
  }

  function handleAutoToggle(): void {
    if (autoPlaying) {
      autoPlaying = false;
      return;
    }
    autoPlaying = true;
    if (status !== 'paused') start('step');
  }

  function handleStop(): void {
    autoPlaying = false;
    runner?.stop();
  }

  function handleClear(): void {
    clearRunState();
  }

  function handleResetCode(): void {
    code = config.initialCode;
    persist();
    clearRunState();
  }

  function handleInput(value: string): void {
    inputPrompt = null;
    appendOutput({ stream: 'stdout', text: value + '\n' });
    runner?.sendInput(value);
  }
</script>

<div class="python-environment {className}">
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

    <div class="layout" class:with-visualizer={showVisualizer}>
      <div class="pane">
        <CodeEditor
          bind:value={code}
          {highlightedLine}
          isError={status === 'error'}
          readonly={busy}
          class="editor"
        />

        <PythonControls
          {status}
          {autoPlaying}
          {autoSpeed}
          onRun={handleRun}
          onStep={handleStep}
          onContinue={handleContinue}
          onAutoToggle={handleAutoToggle}
          onStop={handleStop}
          onReset={handleClear}
          onResetCode={handleResetCode}
          onSpeedChange={(speed) => (autoSpeed = speed)}
        />

        <PythonOutput {chunks} {error} {inputPrompt} onSubmitInput={handleInput} />
      </div>

      {#if showVisualizer}
        <div class="pane visualizer-pane">
          <CallStackVisualizer {snapshot} />
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

  .python-environment :global(.editor) {
    min-height: 16rem;
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
