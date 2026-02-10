<script lang="ts">
  import { onMount, tick } from 'svelte';
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
  import { loadPyodide, injectKarelCommands, type KarelCallbacks } from '$lib/karel/pyodide';
  import type { PyodideInterface } from 'pyodide';

  // State
  let mode = $state<'play' | 'edit'>('play');
  let initialWorld = $state(createDefaultWorld());
  let currentWorld = $state(createDefaultWorld());
  let executionState = $state(createDefaultExecutionState());
  let code = $state(`# Welcome to Karel the Robot Playground!
# Write your code here
# Try moving Karel around
turn_left()
turn_left()
if front_is_clear():
  move()
else:
  turn_left()
  turn_left()
`);

  let pyodide: PyodideInterface | null = $state(null);
  let pyodideLoading = $state(true);
  let pyodideError: string | null = $state(null);

  // Mode toggle slider
  let playButton: HTMLButtonElement;
  let editButton: HTMLButtonElement;
  let toggleContainer: HTMLDivElement;
  let mounted = $state(false);
  let sliderStyle = $derived.by(() => {
    void mounted; // re-evaluate after mount
    const btn = mode === 'play' ? playButton : editButton;
    if (!btn || !toggleContainer) return '';
    const containerRect = toggleContainer.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const left = btnRect.left - containerRect.left;
    const width = btnRect.width;
    return `left: ${left}px; width: ${width}px;`;
  });

  // Command step limit
  const MAX_STEPS = 2500;

  // Execution recording types
  type RecordedStep = {
    line: number;
    world: KarelWorldType; // snapshot of world AFTER this step executed
  };

  // Step-through execution state
  let currentLineIndex = $state(0);
  let executionGenerator: AsyncGenerator<number, void, unknown> | null = null;

  // Load Pyodide on mount
  onMount(async () => {
    try {
      pyodide = await loadPyodide();
      pyodideLoading = false;
      await tick();
      mounted = true;
    } catch (err) {
      pyodideError = err instanceof Error ? err.message : 'Failed to load Pyodide';
      pyodideLoading = false;
      await tick();
      mounted = true;
    }
  });

  // Extract clean error message from Python/Pyodide exceptions
  function extractErrorMessage(err: unknown): string {
    if (!(err instanceof Error)) {
      return String(err);
    }

    const fullMessage = err.message;
    const lines = fullMessage.split('\n');

    // Get the last non-empty line
    const lastLine = lines.filter((l) => l.trim()).pop() || fullMessage;

    // Check if it matches pattern like "pyodide.ffi.JsException: Error: message"
    // or "ExceptionType: message"
    const match = lastLine.match(/(?:[\w.]+:\s*)?(?:Error:\s*)?(.+)/);
    if (match && match[1]) {
      return match[1].trim();
    }

    return lastLine;
  }

  // Karel command implementations
  function move() {
    if (executionState.stepCount >= MAX_STEPS) {
      throw new Error('Step limit exceeded (2,500 steps)');
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
      throw new Error('Step limit exceeded (2,500 steps)');
    }

    const directions: DirectionType[] = ['north', 'west', 'south', 'east'];
    const currentIndex = directions.indexOf(currentWorld.karel.direction.type);
    const newDirection = directions[(currentIndex + 1) % 4];
    currentWorld.karel.direction = { type: newDirection };
    executionState.stepCount++;
  }

  function pick_beeper() {
    if (executionState.stepCount >= MAX_STEPS) {
      throw new Error('Step limit exceeded (2,500 steps)');
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
      throw new Error('Step limit exceeded (2,500 steps)');
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

  // Prepare Karel callbacks
  function getKarelCallbacks(): KarelCallbacks {
    return {
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
  }

  // Record the full program execution: run with sys.settrace to capture every
  // line + Karel action, then return the recording for replay.
  async function recordExecution(
    code: string
  ): Promise<{ steps: RecordedStep[]; error?: string; errorLine?: number }> {
    if (!pyodide) throw new Error('Pyodide not loaded');

    const steps: RecordedStep[] = [];
    let lastTracedLine = 0;

    // Karel callbacks that record world snapshots after each action
    const recordingCallbacks: KarelCallbacks = {
      move: () => {
        move();
        steps.push({ line: lastTracedLine, world: cloneWorld(currentWorld) });
      },
      turn_left: () => {
        turn_left();
        steps.push({ line: lastTracedLine, world: cloneWorld(currentWorld) });
      },
      pick_beeper: () => {
        pick_beeper();
        steps.push({ line: lastTracedLine, world: cloneWorld(currentWorld) });
      },
      put_beeper: () => {
        put_beeper();
        steps.push({ line: lastTracedLine, world: cloneWorld(currentWorld) });
      },
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

    injectKarelCommands(pyodide, recordingCallbacks);

    // Line trace callback — updates lastTracedLine so Karel callbacks know where we are
    const traceCallback = (lineNo: number) => {
      lastTracedLine = lineNo;
    };
    pyodide.globals.set('__js_trace_cb__', traceCallback);

    const escapedCode = code.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');

    try {
      await pyodide.runPythonAsync(`
import sys as _ts
def _tt(frame, event, arg):
    if event == 'line' and frame.f_code.co_filename == '<user>':
        __js_trace_cb__(frame.f_lineno)
    return _tt
_code = compile('${escapedCode}', '<user>', 'exec')
_ts.settrace(_tt)
try:
    exec(_code)
finally:
    _ts.settrace(None)
    del _tt, _code
`);
      return { steps };
    } catch (err) {
      return {
        steps,
        error: extractErrorMessage(err),
        errorLine: lastTracedLine > 0 ? lastTracedLine : undefined
      };
    } finally {
      // Clean up
      pyodide.runPython(`
try:
    del __js_trace_cb__
except:
    pass
`);
    }
  }

  // Create step-through execution generator using record-and-replay
  async function* createStepExecutor(code: string): AsyncGenerator<number, void, unknown> {
    if (!pyodide) return;

    // Reset world to initial state for the recording run
    currentWorld = cloneWorld(initialWorld);
    executionState.stepCount = 0;

    // Phase 1: Record the entire execution
    const recording = await recordExecution(code);

    // Phase 2: Reset world back to initial for animated replay
    currentWorld = cloneWorld(initialWorld);
    executionState.stepCount = 0;

    // Phase 3: Replay each recorded step
    for (const step of recording.steps) {
      executionState.currentLine = step.line;
      yield step.line;

      // Apply the world snapshot
      currentWorld = cloneWorld(step.world);
      executionState.stepCount++;
    }

    // If the recording ended with an error, throw it now
    if (recording.error) {
      if (recording.errorLine) {
        executionState.currentLine = recording.errorLine;
        executionState.errorLine = recording.errorLine;
      }
      throw new Error(recording.error);
    }

    executionState.currentLine = null;
  }

  // Control handlers
  async function handlePlay() {
    if (!pyodide) {
      executionState.error = 'Pyodide not loaded yet';
      executionState.status = 'error';
      return;
    }

    // If already paused mid-execution, resume from where we left off
    if (executionState.status === 'paused' && executionGenerator) {
      executionState.status = 'running';
      await continueExecution();
      return;
    }

    // Start fresh execution
    executionState.status = 'running';
    executionState.error = null;
    executionState.stepCount = 0;
    executionState.currentLine = null;
    currentWorld = cloneWorld(initialWorld);
    currentLineIndex = 0;

    // If speed is instant (0), run everything at once without animation
    if (executionState.animationSpeed === 0) {
      try {
        // Inject Karel commands
        injectKarelCommands(pyodide, getKarelCallbacks());

        // Execute code all at once
        await pyodide.runPythonAsync(code);

        executionState.status = 'success';
      } catch (err) {
        executionState.status = 'error';
        executionState.error = extractErrorMessage(err);
      }
      return;
    }

    // Create new execution generator for animated execution
    executionGenerator = createStepExecutor(code);

    // Run through all steps with animation
    await continueExecution();
  }

  // Continue executing steps until done or paused
  async function continueExecution() {
    if (!executionGenerator) return;

    try {
      while (executionState.status === 'running') {
        const result = await executionGenerator.next();

        if (result.done) {
          executionState.status = 'success';
          executionState.currentLine = null;
          executionState.errorLine = null;
          executionGenerator = null;
          break;
        } else {
          currentLineIndex = result.value;

          // Delay between steps for animated playback
          if (executionState.animationSpeed > 0) {
            await new Promise((resolve) => requestAnimationFrame(resolve));
            await new Promise((resolve) => setTimeout(resolve, executionState.animationSpeed));
          }
        }
      }
    } catch (err) {
      executionState.status = 'error';
      executionState.error = extractErrorMessage(err);
      executionState.currentLine = executionState.errorLine;
      executionGenerator = null;
    }
  }

  function handlePause() {
    executionState.status = 'paused';
  }

  async function handleStep() {
    if (!pyodide) {
      executionState.error = 'Pyodide not loaded yet';
      executionState.status = 'error';
      return;
    }

    // If we're idle or have an error, start fresh
    if (executionState.status === 'idle' || executionState.status === 'error') {
      executionState.status = 'paused';
      executionState.error = null;
      executionState.stepCount = 0;
      executionState.currentLine = null;
      currentWorld = cloneWorld(initialWorld);
      currentLineIndex = 0;

      // Create new execution generator
      executionGenerator = createStepExecutor(code);
    }

    // Execute one step
    if (executionGenerator) {
      try {
        const result = await executionGenerator.next();

        if (result.done) {
          executionState.status = 'success';
          executionState.currentLine = null;
          executionState.errorLine = null;
          executionGenerator = null;
        } else {
          executionState.status = 'paused';
          currentLineIndex = result.value;
        }
      } catch (err) {
        executionState.status = 'error';
        executionState.error = extractErrorMessage(err);
        // Keep the error line highlighted (it was set in the catch block)
        executionState.currentLine = executionState.errorLine;
        executionGenerator = null;
      }
    }
  }

  function handleReset() {
    currentWorld = cloneWorld(initialWorld);
    const newState = createDefaultExecutionState();
    newState.animationSpeed = executionState.animationSpeed; // Preserve speed setting
    executionState = newState;
    executionGenerator = null;
    currentLineIndex = 0;

    // Clear Python namespace
    if (pyodide) {
      try {
        pyodide.runPython(`
# Clear user-defined functions and variables
import sys
user_vars = [k for k in list(globals().keys()) if not k.startswith('_') and k not in sys.modules and k not in dir(__builtins__)]
for var in user_vars:
    # Don't delete Karel commands
    if var not in ['move', 'turn_left', 'pick_beeper', 'put_beeper', 
                   'front_is_clear', 'front_is_blocked', 
                   'beepers_present', 'no_beepers_present',
                   'left_is_clear', 'left_is_blocked',
                   'right_is_clear', 'right_is_blocked',
                   'beepers_in_bag', 'no_beepers_in_bag',
                   'facing_north', 'not_facing_north',
                   'facing_south', 'not_facing_south',
                   'facing_east', 'not_facing_east',
                   'facing_west', 'not_facing_west']:
        try:
            del globals()[var]
        except:
            pass
`);
      } catch (err) {
        console.error('Error clearing Python namespace:', err);
      }
    }
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
    <!-- Mode Toggle -->
    <div class="mode-toggle-container">
      <div class="mode-toggle" bind:this={toggleContainer}>
        <button
          class="mode-button"
          class:active={mode === 'play'}
          bind:this={playButton}
          onclick={() => (mode = 'play')}
        >
          Play
        </button>
        <button
          class="mode-button"
          class:active={mode === 'edit'}
          bind:this={editButton}
          onclick={() => (mode = 'edit')}
        >
          Setup
        </button>
        <div class="slider" style={sliderStyle}></div>
      </div>
    </div>

    {#if mode === 'play'}
      <div class="playground-content">
        <div class="editor-panel">
          <div class="code-section">
            <h2>Code Editor</h2>
            <KarelCodeEditor
              bind:value={code}
              readonly={executionState.status === 'running'}
              highlightedLine={executionState.currentLine}
              isError={executionState.status === 'error'}
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
            />
          </div>
        </div>
      </div>
    {:else}
      <div class="playground-content">
        <div class="editor-panel">
          <div class="editor-section">
            <h2>World Editor</h2>
            <WorldEditor bind:world={initialWorld} onupdate={handleWorldUpdate} />
          </div>
        </div>

        <div class="world-panel">
          <div class="world-display">
            <h2>Karel World</h2>
            <KarelWorld world={initialWorld} />
          </div>
        </div>
      </div>
    {/if}
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
    margin: 0;
    color: #1e293b;
  }

  .mode-toggle-container {
    display: flex;
    justify-content: center;
    margin-bottom: 2rem;
  }

  .mode-toggle {
    position: relative;
    display: inline-flex;
    background: #e2e8f0;
    border-radius: 9999px;
    padding: 4px;
  }

  .mode-button {
    position: relative;
    z-index: 1;
    padding: 0.5rem 1.5rem;
    border: none;
    background: transparent;
    color: #64748b;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    border-radius: 9999px;
    transition: color 0.3s ease;
  }

  .mode-button.active {
    color: white;
  }

  .slider {
    position: absolute;
    top: 4px;
    height: calc(100% - 8px);
    background: #3b82f6;
    border-radius: 9999px;
    transition:
      left 0.3s ease,
      width 0.3s ease;
    z-index: 0;
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

  .world-display {
    display: flex;
    flex-direction: column;
  }

  .world-display :global(.karel-world) {
    max-height: 400px;
    width: 100%;
  }

  @media (max-width: 1024px) {
    .playground-content {
      grid-template-columns: 1fr;
    }

    .world-display :global(.karel-world) {
      max-height: none;
    }
  }
</style>
