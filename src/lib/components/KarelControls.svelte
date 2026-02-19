<script lang="ts">
  import type { ExecutionStatus } from '$lib/karel/types';

  interface Props {
    status: ExecutionStatus;
    animationSpeed?: number;
    onPlay?: () => void;
    onPause?: () => void;
    onStep?: () => void;
    onReset?: () => void;
    onSpeedChange?: (speed: number) => void;
    showTests?: boolean;
    onRunTests?: () => void;
    testWorlds?: string[];
    onLoadTestWorld?: (testName: string) => void;
    runningTests?: boolean;
    class?: string;
  }

  let {
    status,
    animationSpeed = $bindable(300),
    onPlay,
    onPause,
    onStep,
    onReset,
    onSpeedChange,
    showTests = false,
    onRunTests,
    testWorlds,
    onLoadTestWorld,
    runningTests = false,
    class: className = ''
  }: Props = $props();

  // Speed presets in milliseconds
  const speedOptions = [
    { label: 'Instant', value: 0 },
    { label: 'Very Fast', value: 50 },
    { label: 'Fast', value: 150 },
    { label: 'Normal', value: 300 },
    { label: 'Slow', value: 600 },
    { label: 'Very Slow', value: 1000 }
  ];

  const isRunning = $derived(status === 'running');
  const isPaused = $derived(status === 'paused');
  const isIdle = $derived(status === 'idle' || status === 'success' || status === 'error');

  function handleSpeedChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const index = parseInt(target.value);
    const newSpeed = speedOptions[index].value;
    animationSpeed = newSpeed;
    onSpeedChange?.(newSpeed);
  }

  function getSpeedLabel(): string {
    const option = speedOptions.find((opt) => opt.value === animationSpeed);
    return option ? option.label : 'Custom';
  }

  // Get the index of the current speed in speedOptions
  function getCurrentSpeedIndex(): number {
    const index = speedOptions.findIndex((opt) => opt.value === animationSpeed);
    return index !== -1 ? index : 3; // Default to Normal if not found
  }
</script>

<div class="karel-controls {className}">
  <div class="controls-buttons">
    {#if isRunning}
      <button onclick={onPause} class="control-btn pause" title="Pause execution">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" />
          <rect x="14" y="4" width="4" height="16" />
        </svg>
        <span>Pause</span>
      </button>
    {:else}
      <button onclick={onPlay} class="control-btn play" disabled={isRunning} title="Run program">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
        <span>Play</span>
      </button>
    {/if}

    <button
      onclick={onStep}
      class="control-btn step"
      disabled={isRunning}
      title="Execute one statement"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l8-7z" />
        <rect x="16" y="5" width="2" height="14" />
      </svg>
      <span>Step</span>
    </button>

    <button onclick={onReset} class="control-btn reset" title="Reset to initial state">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"
        />
      </svg>
      <span>Reset</span>
    </button>

    {#if showTests && onRunTests}
      <button
        onclick={onRunTests}
        class="control-btn run-tests"
        disabled={isRunning || runningTests}
        title="Run all tests"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
        <span>{runningTests ? 'Running Tests...' : 'Run Tests'}</span>
      </button>
    {/if}
  </div>

  {#if testWorlds && testWorlds.length > 0 && onLoadTestWorld}
    <div class="test-worlds">
      <label for="test-world-select">Load Test World:</label>
      <select
        id="test-world-select"
        onchange={(e) => onLoadTestWorld?.(e.currentTarget.value)}
        class="test-world-select"
      >
        <option value="">Select a test...</option>
        {#each testWorlds as testName}
          <option value={testName}>{testName}</option>
        {/each}
      </select>
    </div>
  {/if}

  <div class="speed-control">
    <label for="speed-slider">
      Speed: <strong>{getSpeedLabel()}</strong>
    </label>
    <input
      id="speed-slider"
      type="range"
      min="0"
      max={speedOptions.length - 1}
      step="1"
      value={getCurrentSpeedIndex()}
      oninput={handleSpeedChange}
      class="speed-slider"
    />
    <div class="speed-labels">
      <span>Instant</span>
      <span>Very Slow</span>
    </div>
  </div>
</div>

<style>
  .karel-controls {
    padding: 1rem;
    background: #f5f5f5;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .controls-buttons {
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

  .control-btn.play {
    color: #22c55e;
  }

  .control-btn.pause {
    color: #f59e0b;
  }

  .control-btn.step {
    color: #3b82f6;
  }

  .control-btn.reset {
    color: #ef4444;
  }

  .control-btn.run-tests {
    color: #8b5cf6;
  }

  .test-worlds {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .test-worlds label {
    font-size: 14px;
    color: #666;
  }

  .test-world-select {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: white;
    font-size: 14px;
    cursor: pointer;
  }

  .speed-control {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .speed-control label {
    font-size: 14px;
    color: #666;
  }

  .speed-slider {
    width: 100%;
  }

  .speed-labels {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #999;
  }
</style>
