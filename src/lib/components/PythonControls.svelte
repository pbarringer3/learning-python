<script lang="ts">
  /**
   * Execution controls. Which buttons make sense is entirely a function of the
   * runner's status, so the enabling rules live here rather than being
   * scattered through the environment.
   */
  import type { RunnerStatus } from '$lib/python/runner';

  interface Props {
    status: RunnerStatus;
    /** True while auto-stepping on a timer. */
    autoPlaying?: boolean;
    /** Milliseconds between automatic steps. */
    autoSpeed?: number;
    onRun?: () => void;
    onStep?: () => void;
    onContinue?: () => void;
    onAutoToggle?: () => void;
    onStop?: () => void;
    onReset?: () => void;
    onResetCode?: () => void;
    onSpeedChange?: (speed: number) => void;
    class?: string;
  }

  let {
    status,
    autoPlaying = false,
    autoSpeed = 400,
    onRun,
    onStep,
    onContinue,
    onAutoToggle,
    onStop,
    onReset,
    onResetCode,
    onSpeedChange,
    class: className = ''
  }: Props = $props();

  let idle = $derived(status === 'ready' || status === 'finished' || status === 'error');
  let paused = $derived(status === 'paused');
  let busy = $derived(status === 'running' || status === 'awaiting-input');
  let loading = $derived(status === 'loading');
  let failed = $derived(status === 'failed');

  // Starting fresh and continuing are the same button in two states: the
  // program is either not running yet, or paused partway through.
  let canStart = $derived(idle && !failed);
</script>

<div class="python-controls {className}">
  <div class="buttons">
    <button
      class="control-btn run"
      onclick={onRun}
      disabled={!canStart || loading}
      title="Run the whole program without stopping"
    >
      ▶ Run
    </button>

    <button
      class="control-btn step"
      onclick={onStep}
      disabled={!(canStart || paused) || loading}
      title="Execute one line, then pause"
    >
      ⇥ Step
    </button>

    <button
      class="control-btn auto"
      onclick={onAutoToggle}
      disabled={!(canStart || paused) || loading}
      title="Step automatically on a timer"
    >
      {autoPlaying ? '⏸ Pause' : '⏩ Auto'}
    </button>

    <button
      class="control-btn continue"
      onclick={onContinue}
      disabled={!paused}
      title="Stop pausing and run to the end"
    >
      ⏭ Continue
    </button>

    <button
      class="control-btn stop"
      onclick={onStop}
      disabled={!(busy || paused)}
      title="Abandon the running program"
    >
      ■ Stop
    </button>

    <button class="control-btn reset" onclick={onReset} disabled={busy || paused || loading}>
      ↺ Clear
    </button>

    {#if onResetCode}
      <button
        class="control-btn reset-code"
        onclick={onResetCode}
        disabled={busy || paused}
        title="Restore the original starting code"
      >
        Reset code
      </button>
    {/if}
  </div>

  <div class="speed-control">
    <label for="python-speed">Auto speed</label>
    <input
      id="python-speed"
      type="range"
      min="60"
      max="1200"
      step="20"
      value={1260 - autoSpeed}
      oninput={(event) => onSpeedChange?.(1260 - Number(event.currentTarget.value))}
      class="speed-slider"
    />
    <div class="speed-labels"><span>Slow</span><span>Fast</span></div>
  </div>
</div>

<style>
  .python-controls {
    padding: 1rem;
    background: #f5f5f5;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
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

  .control-btn.run {
    color: #22c55e;
  }

  .control-btn.step,
  .control-btn.continue {
    color: #3b82f6;
  }

  .control-btn.auto {
    color: #f59e0b;
  }

  .control-btn.stop {
    color: #ef4444;
  }

  .control-btn.reset,
  .control-btn.reset-code {
    color: #6b7280;
  }

  .speed-control {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    align-items: center;
  }

  .speed-control label {
    font-size: 12px;
    color: #6b7280;
  }

  .speed-slider {
    width: 180px;
  }

  .speed-labels {
    display: flex;
    justify-content: space-between;
    width: 180px;
    font-size: 10px;
    color: #9ca3af;
  }
</style>
