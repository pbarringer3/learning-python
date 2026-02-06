<script lang="ts">
	import type { ExecutionStatus } from '$lib/karel/types';

	interface Props {
		status: ExecutionStatus;
		speed: number;
		onplay?: () => void;
		onpause?: () => void;
		onstep?: () => void;
		onreset?: () => void;
		onspeedchange?: (speed: number) => void;
		class?: string;
	}

	let {
		status,
		speed = $bindable(300),
		onplay,
		onpause,
		onstep,
		onreset,
		onspeedchange,
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
		const newSpeed = parseInt(target.value);
		speed = newSpeed;
		if (onspeedchange) {
			onspeedchange(newSpeed);
		}
	}

	function getSpeedLabel(): string {
		const option = speedOptions.find((opt) => opt.value === speed);
		return option ? option.label : 'Custom';
	}
</script>

<div class="karel-controls {className}">
	<div class="controls-buttons">
		{#if isRunning}
			<button
				onclick={onpause}
				class="control-btn pause"
				title="Pause execution"
			>
				<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
					<rect x="6" y="4" width="4" height="16" />
					<rect x="14" y="4" width="4" height="16" />
				</svg>
				<span>Pause</span>
			</button>
		{:else}
			<button
				onclick={onplay}
				class="control-btn play"
				disabled={isRunning}
				title="Run program"
			>
				<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
					<path d="M8 5v14l11-7z" />
				</svg>
				<span>Play</span>
			</button>
		{/if}

		<button
			onclick={onstep}
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

		<button
			onclick={onreset}
			class="control-btn reset"
			title="Reset to initial state"
		>
			<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
				<path
					d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"
				/>
			</svg>
			<span>Reset</span>
		</button>
	</div>

	<div class="speed-control">
		<label for="speed-slider">
			Speed: <strong>{getSpeedLabel()}</strong>
		</label>
		<input
			id="speed-slider"
			type="range"
			min="0"
			max="1000"
			step="50"
			value={speed}
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
