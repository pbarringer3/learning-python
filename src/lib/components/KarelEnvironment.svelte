<script lang="ts">
  /**
   * KarelEnvironment - Reusable Karel component for lessons and playground
   * Handles execution, animation, and Karel command implementations
   */
  import { onMount, tick } from 'svelte';
  import KarelWorld from '$lib/components/KarelWorld.svelte';
  import KarelCodeEditor from '$lib/components/KarelCodeEditor.svelte';
  import KarelControls from '$lib/components/KarelControls.svelte';
  import KarelOutput from '$lib/components/KarelOutput.svelte';
  import {
    createDefaultExecutionState,
    cloneWorld,
    type KarelWorld as KarelWorldType,
    type KarelConfig,
    type ExecutionState,
    type DirectionType,
    type TestResult
  } from '$lib/karel/types';
  import {
    loadPyodide,
    injectKarelCommands,
    installCodeValidator,
    validateKarelCode,
    type KarelCallbacks
  } from '$lib/karel/pyodide';
  import type { PyodideInterface } from 'pyodide';

  // Props
  interface Props {
    config: KarelConfig;
  }
  let { config }: Props = $props();

  // State - capture initial values from config
  // We intentionally use the initial value of config.initialWorld here
  // This is mutable so it can be updated when a test world is loaded
  let initialWorldSnapshot = cloneWorld(config.initialWorld);
  let currentWorld = $state(cloneWorld(initialWorldSnapshot));
  let executionState = $state(createDefaultExecutionState());
  let code = $state('');

  // Initialize code when component mounts or config changes
  $effect(() => {
    code = config.initialCode;
  });

  let pyodide: PyodideInterface | null = $state(null);
  let pyodideLoading = $state(true);
  let pyodideError: string | null = $state(null);

  // Test results
  let testResults: TestResult[] | null = $state(null);
  let runningTests = $state(false);

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
      // Install the code validator
      installCodeValidator(pyodide);
      pyodideLoading = false;
    } catch (err) {
      pyodideError = err instanceof Error ? err.message : 'Failed to load Pyodide';
      pyodideLoading = false;
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

    // Validate code first (with allowed commands if specified)
    const allowedCommands = config.allowedFeatures?.karelCommands;
    const validation = await validateKarelCode(pyodide, code, allowedCommands);
    if (!validation.valid) {
      return {
        steps: [],
        error: validation.error,
        errorLine: validation.line
      };
    }

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
    currentWorld = cloneWorld(initialWorldSnapshot);
    executionState.stepCount = 0;

    // Phase 1: Record the entire execution
    const recording = await recordExecution(code);

    // Phase 2: Reset world back to initial for animated replay
    currentWorld = cloneWorld(initialWorldSnapshot);
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
    currentWorld = cloneWorld(initialWorldSnapshot);
    currentLineIndex = 0;

    // If speed is instant (0), run everything at once without animation
    if (executionState.animationSpeed === 0) {
      try {
        // Validate code first (with allowed commands if specified)
        const allowedCommands = config.allowedFeatures?.karelCommands;
        const validation = await validateKarelCode(pyodide, code, allowedCommands);
        if (!validation.valid) {
          executionState.status = 'error';
          executionState.error = validation.error || 'Invalid code';
          if (validation.line) {
            executionState.errorLine = validation.line;
          }
          return;
        }

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
      currentWorld = cloneWorld(initialWorldSnapshot);
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
    currentWorld = cloneWorld(initialWorldSnapshot);
    const newState = createDefaultExecutionState();
    newState.animationSpeed = executionState.animationSpeed; // Preserve speed setting
    executionState = newState;
    executionGenerator = null;
    currentLineIndex = 0;
    testResults = null; // Clear test results on reset

    // Clear Python namespace
    if (pyodide) {
      try {
        pyodide.runPython(`
# Clear user-defined functions and variables
import sys
user_vars = [k for k in list(globals().keys()) if not k.startswith('_') and k not in sys.modules and k not in dir(__builtins__)]
for var in user_vars:
    # Don't delete Karel commands or the validator
    if var not in ['move', 'turn_left', 'pick_beeper', 'put_beeper', 
                   'front_is_clear', 'front_is_blocked', 
                   'beepers_present', 'no_beepers_present',
                   'left_is_clear', 'left_is_blocked',
                   'right_is_clear', 'right_is_blocked',
                   'beepers_in_bag', 'no_beepers_in_bag',
                   'facing_north', 'not_facing_north',
                   'facing_south', 'not_facing_south',
                   'facing_east', 'not_facing_east',
                   'facing_west', 'not_facing_west',
                   'validate_karel_code', 'ast', 'sys']:
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

  // Run tests against all test worlds
  async function handleRunTests() {
    if (!config.tests || !pyodide) return;

    runningTests = true;
    testResults = [];

    for (const [testName, testWorld] of Object.entries(config.tests.worlds)) {
      // Reset to test world
      currentWorld = cloneWorld(testWorld);
      executionState = createDefaultExecutionState();
      executionState.animationSpeed = 0; // Run tests instantly

      try {
        // Validate code
        const allowedCommands = config.allowedFeatures?.karelCommands;
        const validation = await validateKarelCode(pyodide, code, allowedCommands);

        if (!validation.valid) {
          testResults.push({
            testName,
            passed: false,
            message: validation.error || 'Code validation failed'
          });
          continue;
        }

        // Inject Karel commands
        injectKarelCommands(pyodide, getKarelCallbacks());

        // Execute code
        await pyodide.runPythonAsync(code);

        // Validate final world state
        const result = config.tests.validate(currentWorld);
        testResults.push({
          testName,
          ...result
        });
      } catch (err) {
        testResults.push({
          testName,
          passed: false,
          message: extractErrorMessage(err)
        });
      }
    }

    // Reset to initial world after tests
    currentWorld = cloneWorld(initialWorldSnapshot);
    executionState = createDefaultExecutionState();
    runningTests = false;
  }

  // Load a specific test world into the display
  function handleLoadTestWorld(testName: string) {
    if (!config.tests || !config.tests.worlds[testName]) return;
    initialWorldSnapshot = cloneWorld(config.tests.worlds[testName]);
    currentWorld = cloneWorld(initialWorldSnapshot);
    executionState = createDefaultExecutionState();
  }
</script>

<div class="karel-environment">
  <div class="flex flex-col gap-4 lg:flex-row">
    <!-- Left side: Code editor and controls -->
    <div class="flex flex-1 flex-col gap-4">
      <KarelCodeEditor
        bind:value={code}
        highlightedLine={executionState.currentLine}
        isError={executionState.status === 'error'}
        readonly={executionState.status === 'running'}
      />

      <KarelControls
        status={executionState.status}
        animationSpeed={executionState.animationSpeed}
        onPlay={handlePlay}
        onPause={handlePause}
        onStep={handleStep}
        onReset={handleReset}
        onSpeedChange={(speed) => {
          executionState.animationSpeed = speed;
        }}
        showTests={!!config.tests}
        onRunTests={config.tests ? handleRunTests : undefined}
        testWorlds={config.tests?.loadableTests}
        onLoadTestWorld={config.tests?.loadableTests ? handleLoadTestWorld : undefined}
        {runningTests}
      />

      <KarelOutput
        status={executionState.status}
        error={executionState.error}
        stepCount={executionState.stepCount}
        {pyodideLoading}
        {pyodideError}
        {testResults}
      />
    </div>

    <!-- Right side: World visualization -->
    <div class="flex-1">
      <KarelWorld world={currentWorld} />
    </div>
  </div>
</div>

<style>
  .karel-environment {
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    padding: 1rem;
  }
</style>
