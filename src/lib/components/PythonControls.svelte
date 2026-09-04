<script lang="ts">
  /**
   * Execution controls: two rows, execution above and everything else below.
   *
   * ```
   * ▶ Play / ■ Stop     ⇥ Step     ⏭ To breakpoint
   * 👁                              ↺ Reset code
   * ```
   *
   * Reset code sits last and apart because it is the only button that destroys
   * work. Which buttons are live is a pure function of the runner's status, so
   * those rules live in `controls.ts` where every state can be asserted without
   * a browser. See `PythonInterpreterDesign.md` §12.2.
   */
  import { canResetCode, canRunToBreakpoint, canStep, primaryControl } from '$lib/python/controls';
  import type { RunnerStatus } from '$lib/python/runner';

  interface Props {
    status: RunnerStatus;
    /** Disables "To breakpoint" when false, with a tooltip saying why. */
    hasBreakpoints?: boolean;
    /** Drives the eye icon and its label. */
    visualizerVisible?: boolean;
    onPlay?: () => void;
    onStop?: () => void;
    onStep?: () => void;
    onToBreakpoint?: () => void;
    onToggleVisualizer?: () => void;
    onResetCode?: () => void;
    class?: string;
  }

  let {
    status,
    hasBreakpoints = false,
    visualizerVisible = true,
    onPlay,
    onStop,
    onStep,
    onToBreakpoint,
    onToggleVisualizer,
    onResetCode,
    class: className = ''
  }: Props = $props();

  let primary = $derived(primaryControl(status));
  let stepEnabled = $derived(canStep(status));
  let breakpointEnabled = $derived(canRunToBreakpoint(status, hasBreakpoints));
  let resetEnabled = $derived(canResetCode(status));

  let visualizerLabel = $derived(visualizerVisible ? 'Hide call stack' : 'Show call stack');
</script>

<div class="python-controls {className}">
  <div class="row">
    {#if primary.mode === 'stop'}
      <button
        class="control-btn stop"
        onclick={onStop}
        disabled={!primary.enabled}
        title="Abandon the running program"
      >
        ■ Stop
      </button>
    {:else}
      <button
        class="control-btn play"
        onclick={onPlay}
        disabled={!primary.enabled}
        title="Run the program, ignoring breakpoints"
      >
        ▶ Play
      </button>
    {/if}

    <button
      class="control-btn step"
      onclick={onStep}
      disabled={!stepEnabled}
      title="Execute one line, then pause"
    >
      ⇥ Step
    </button>

    <button
      class="control-btn to-breakpoint"
      onclick={onToBreakpoint}
      disabled={!breakpointEnabled}
      title={hasBreakpoints
        ? 'Run on until the next breakpoint'
        : 'Click a line number to set a breakpoint'}
    >
      ⏭ To breakpoint
    </button>
  </div>

  <div class="row secondary">
    <!--
      An inline SVG rather than an emoji: this button has no text label to fall
      back on, and emoji render inconsistently across platforms.
    -->
    <button
      class="control-btn icon"
      onclick={onToggleVisualizer}
      aria-label={visualizerLabel}
      aria-pressed={visualizerVisible}
      title={visualizerLabel}
    >
      {#if visualizerVisible}
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M1.5 12S5 5.5 12 5.5 22.5 12 22.5 12 19 18.5 12 18.5 1.5 12 1.5 12Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
          />
          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7" />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M1.5 12S5 5.5 12 5.5 22.5 12 22.5 12 19 18.5 12 18.5 1.5 12 1.5 12Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
          />
          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7" />
          <path d="M3.5 3.5 20.5 20.5" stroke="currentColor" stroke-width="1.7" />
        </svg>
      {/if}
    </button>

    {#if onResetCode}
      <button
        class="control-btn reset-code"
        onclick={onResetCode}
        disabled={!resetEnabled}
        title="Restore the original starting code"
      >
        ↺ Reset code
      </button>
    {/if}
  </div>
</div>

<style>
  .python-controls {
    padding: 0.75rem 1rem;
    background: #f5f5f5;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .row {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
  }

  /* Reset code is pushed to the far end, away from the buttons clicked most. */
  .row.secondary .reset-code {
    margin-left: auto;
  }

  .control-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }

  .control-btn:hover:not(:disabled) {
    background: #e5e5e5;
    transform: translateY(-1px);
  }

  .control-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .control-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .control-btn.icon {
    padding: 0.4rem 0.6rem;
    color: #4b5563;
  }

  .control-btn.play {
    color: #22c55e;
  }

  .control-btn.step,
  .control-btn.to-breakpoint {
    color: #3b82f6;
  }

  .control-btn.stop {
    color: #ef4444;
  }

  .control-btn.reset-code {
    color: #6b7280;
  }
</style>
