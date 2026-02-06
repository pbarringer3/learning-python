<script lang="ts">
	import { onMount } from 'svelte';
	import KarelWorld from '$lib/components/KarelWorld.svelte';
	import KarelCodeEditor from '$lib/components/KarelCodeEditor.svelte';
	import KarelControls from '$lib/components/KarelControls.svelte';
	import KarelOutput from '$lib/components/KarelOutput.svelte';
	import WorldEditor from '$lib/components/WorldEditor.svelte';
	import {
		createDefaultWorld,
		createDefaultExecutionState,
		cloneWorld,
		type KarelWorld as KarelWorldType,
		type ExecutionState,
		type DirectionType
	} from '$lib/karel/types';
	import {
		loadPyodide,
		injectKarelCommands,
		type KarelCallbacks
	} from '$lib/karel/pyodide';
	import type { PyodideInterface } from 'pyodide';

	// State
	let initialWorld = $state(createDefaultWorld());
	let currentWorld = $state(createDefaultWorld());
	let executionState = $state(createDefaultExecutionState());
	let code = $state(`# Welcome to Karel the Robot Playground!
# Write your code here

def turn_right():
    turn_left()
    turn_left()
    turn_left()

# Try moving Karel around
move()
turn_left()
move()
`);

	let pyodide: PyodideInterface | null = $state(null);
	let pyodideLoading = $state(true);
	let pyodideError: string | null = $state(null);

	// Command step limit
	const MAX_STEPS = 10000;

	// Load Pyodide on mount
	onMount(async () => {
		try {
			pyodide = await loadPyodide();
			pyodideLoading = false;
		} catch (err) {
			pyodideError = err instanceof Error ? err.message : 'Failed to load Pyodide';
			pyodideLoading = false;
		}
	});

	// Karel command implementations
	function move() {
		if (executionState.stepCount >= MAX_STEPS) {
			throw new Error('Step limit exceeded (10,000 steps)');
		}

		const pos = currentWorld.karel.position;
		const dir = currentWorld.karel.direction.type;

		let newX = pos.x;
		let newY = pos.y;

		switch (dir) {
			case 'north':
				newY += 1;
				break;
			case 'east':
				newX += 1;
				break;
			case 'south':
				newY -= 1;
				break;
			case 'west':
				newX -= 1;
				break;
		}

		// Check boundaries
		if (newX < 1 || newX > currentWorld.dimensions.width) {
			throw new Error('Cannot move into wall (boundary)');
		}
		if (newY < 1 || newY > currentWorld.dimensions.height) {
			throw new Error('Cannot move into wall (boundary)');
		}

		// Check walls
		const hasWall = checkWallInDirection(pos.x, pos.y, dir);
		if (hasWall) {
			throw new Error('Cannot move into wall');
		}

		currentWorld.karel.position = { x: newX, y: newY };
		executionState.stepCount++;
	}

	function turn_left() {
		if (executionState.stepCount >= MAX_STEPS) {
			throw new Error('Step limit exceeded (10,000 steps)');
		}

		const directions: DirectionType[] = ['north', 'west', 'south', 'east'];
		const currentIndex = directions.indexOf(currentWorld.karel.direction.type);
		const newDirection = directions[(currentIndex + 1) % 4];
		currentWorld.karel.direction = { type: newDirection };
		executionState.stepCount++;
	}

	function pick_beeper() {
		if (executionState.stepCount >= MAX_STEPS) {
			throw new Error('Step limit exceeded (10,000 steps)');
		}

		const pos = currentWorld.karel.position;
		const beeperIndex = currentWorld.beepers.findIndex((b) => b.x === pos.x && b.y === pos.y);

		if (beeperIndex === -1 || currentWorld.beepers[beeperIndex].count === 0) {
			throw new Error('No beeper to pick up');
		}

		currentWorld.beepers[beeperIndex].count--;
		if (currentWorld.beepers[beeperIndex].count === 0) {
			currentWorld.beepers.splice(beeperIndex, 1);
		}

		if (currentWorld.karel.beepers !== -1) {
			currentWorld.karel.beepers++;
		}
		executionState.stepCount++;
	}

	function put_beeper() {
		if (executionState.stepCount >= MAX_STEPS) {
			throw new Error('Step limit exceeded (10,000 steps)');
		}

		if (currentWorld.karel.beepers === 0) {
			throw new Error('No beepers in bag');
		}

		const pos = currentWorld.karel.position;
		const beeperIndex = currentWorld.beepers.findIndex((b) => b.x === pos.x && b.y === pos.y);

		if (beeperIndex === -1) {
			currentWorld.beepers.push({ x: pos.x, y: pos.y, count: 1 });
		} else {
			currentWorld.beepers[beeperIndex].count++;
		}

		if (currentWorld.karel.beepers !== -1) {
			currentWorld.karel.beepers--;
		}
		executionState.stepCount++;
	}

	// Helper function to check for walls
	function checkWallInDirection(x: number, y: number, dir: DirectionType): boolean {
		for (const wall of currentWorld.walls) {
			if (dir === 'north' && wall.type === 'horizontal' && wall.x === x && wall.y === y) {
				return true;
			}
			if (dir === 'south' && wall.type === 'horizontal' && wall.x === x && wall.y === y - 1) {
				return true;
			}
			if (dir === 'east' && wall.type === 'vertical' && wall.x === x && wall.y === y) {
				return true;
			}
			if (dir === 'west' && wall.type === 'vertical' && wall.x === x - 1 && wall.y === y) {
				return true;
			}
		}
		return false;
	}

	// Sensor functions
	function front_is_clear(): boolean {
		const pos = currentWorld.karel.position;
		const dir = currentWorld.karel.direction.type;

		let newX = pos.x;
		let newY = pos.y;

		switch (dir) {
			case 'north':
				newY += 1;
				break;
			case 'east':
				newX += 1;
				break;
			case 'south':
				newY -= 1;
				break;
			case 'west':
				newX -= 1;
				break;
		}

		if (newX < 1 || newX > currentWorld.dimensions.width) return false;
		if (newY < 1 || newY > currentWorld.dimensions.height) return false;

		return !checkWallInDirection(pos.x, pos.y, dir);
	}

	function front_is_blocked(): boolean {
		return !front_is_clear();
	}

	function beepers_present(): boolean {
		const pos = currentWorld.karel.position;
		return currentWorld.beepers.some((b) => b.x === pos.x && b.y === pos.y && b.count > 0);
	}

	function no_beepers_present(): boolean {
		return !beepers_present();
	}

	function left_is_clear(): boolean {
		const originalDir = currentWorld.karel.direction.type;
		turn_left();
		const result = front_is_clear();
		// Turn back
		turn_left();
		turn_left();
		turn_left();
		return result;
	}

	function left_is_blocked(): boolean {
		return !left_is_clear();
	}

	function right_is_clear(): boolean {
		const originalDir = currentWorld.karel.direction.type;
		// Turn right
		turn_left();
		turn_left();
		turn_left();
		const result = front_is_clear();
		// Turn back
		turn_left();
		return result;
	}

	function right_is_blocked(): boolean {
		return !right_is_clear();
	}

	function beepers_in_bag(): boolean {
		return currentWorld.karel.beepers !== 0;
	}

	function no_beepers_in_bag(): boolean {
		return currentWorld.karel.beepers === 0;
	}

	function facing_north(): boolean {
		return currentWorld.karel.direction.type === 'north';
	}

	function not_facing_north(): boolean {
		return currentWorld.karel.direction.type !== 'north';
	}

	function facing_south(): boolean {
		return currentWorld.karel.direction.type === 'south';
	}

	function not_facing_south(): boolean {
		return currentWorld.karel.direction.type !== 'south';
	}

	function facing_east(): boolean {
		return currentWorld.karel.direction.type === 'east';
	}

	function not_facing_east(): boolean {
		return currentWorld.karel.direction.type !== 'east';
	}

	function facing_west(): boolean {
		return currentWorld.karel.direction.type === 'west';
	}

	function not_facing_west(): boolean {
		return currentWorld.karel.direction.type !== 'west';
	}

	// Control handlers
	async function handlePlay() {
		if (!pyodide) {
			executionState.error = 'Pyodide not loaded yet';
			executionState.status = 'error';
			return;
		}

		executionState.status = 'running';
		executionState.error = null;
		executionState.stepCount = 0;
		currentWorld = cloneWorld(initialWorld);

		try {
			// Inject Karel commands
			const callbacks: KarelCallbacks = {
				move,
				turn_left,
				pick_beeper,
				put_beeper,
				front_is_clear,
				front_is_blocked,
				beepers_present,
				no_beepers_present,
				left_is_clear,
				left_is_blocked,
				right_is_clear,
				right_is_blocked,
				beepers_in_bag,
				no_beepers_in_bag,
				facing_north,
				not_facing_north,
				facing_south,
				not_facing_south,
				facing_east,
				not_facing_east,
				facing_west,
				not_facing_west
			};

			injectKarelCommands(pyodide, callbacks);

			// Execute code
			await pyodide.runPythonAsync(code);

			executionState.status = 'success';
		} catch (err) {
			executionState.status = 'error';
			executionState.error = err instanceof Error ? err.message : 'Unknown error';
		}
	}

	function handlePause() {
		executionState.status = 'paused';
	}

	function handleStep() {
		// TODO: Implement step-through execution
		console.log('Step not yet implemented');
	}

	function handleReset() {
		currentWorld = cloneWorld(initialWorld);
		executionState = createDefaultExecutionState();
	}

	function handleSpeedChange(newSpeed: number) {
		executionState.animationSpeed = newSpeed;
	}

	function handleWorldUpdate(newWorld: KarelWorldType) {
		initialWorld = cloneWorld(newWorld);
		currentWorld = cloneWorld(newWorld);
	}
</script>

<svelte:head>
	<title>Karel Playground</title>
</svelte:head>

<div class="playground-container">
	<header class="playground-header">
		<h1>Karel the Robot - Playground</h1>
		<p>Experiment with Karel in an interactive environment!</p>
	</header>

	{#if pyodideLoading}
		<div class="loading-message">
			<p>Loading Python environment...</p>
		</div>
	{:else if pyodideError}
		<div class="error-message">
			<p>Error loading Python: {pyodideError}</p>
		</div>
	{:else}
		<div class="playground-content">
			<div class="editor-panel">
				<div class="code-section">
					<h2>Code Editor</h2>
					<KarelCodeEditor
						bind:value={code}
						readonly={executionState.status === 'running'}
						class="editor"
					/>
				</div>

				<div class="output-section">
					<h2>Output</h2>
					<KarelOutput
						status={executionState.status}
						error={executionState.error}
						stepCount={executionState.stepCount}
					/>
				</div>
			</div>

			<div class="world-panel">
				<div class="world-display">
					<h2>Karel World</h2>
					<KarelWorld world={currentWorld} />
				</div>

				<div class="controls-section">
					<KarelControls
						status={executionState.status}
						bind:speed={executionState.animationSpeed}
						onplay={handlePlay}
						onpause={handlePause}
						onstep={handleStep}
						onreset={handleReset}
						onspeedchange={handleSpeedChange}
					/>
				</div>

				<div class="editor-section">
					<h2>World Editor</h2>
					<WorldEditor bind:world={initialWorld} onupdate={handleWorldUpdate} />
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.playground-container {
		max-width: 1600px;
		margin: 0 auto;
		padding: 2rem;
	}

	.playground-header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.playground-header h1 {
		font-size: 2.5rem;
		margin: 0 0 0.5rem 0;
		color: #1e293b;
	}

	.playground-header p {
		font-size: 1.125rem;
		color: #64748b;
		margin: 0;
	}

	.loading-message,
	.error-message {
		text-align: center;
		padding: 3rem;
		font-size: 1.25rem;
	}

	.error-message {
		color: #dc2626;
	}

	.playground-content {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
	}

	.editor-panel,
	.world-panel {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	h2 {
		font-size: 1.25rem;
		margin: 0 0 0.75rem 0;
		color: #334155;
	}

	.code-section :global(.editor) {
		height: 400px;
	}

	@media (max-width: 1024px) {
		.playground-content {
			grid-template-columns: 1fr;
		}
	}
</style>
