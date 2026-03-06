/**
 * Karel the Robot - Type Definitions
 * Based on KAREL_DESIGN.md Section 15
 */

export interface Position {
  x: number; // 1-indexed
  y: number; // 1-indexed
}

export type DirectionType = 'north' | 'east' | 'south' | 'west';

export interface Direction {
  type: DirectionType;
}

export type WallType = 'horizontal' | 'vertical';

export interface Wall {
  type: WallType;
  x: number;
  y: number;
  // horizontal wall: below cell (x,y)
  // vertical wall: to right of cell (x,y)
}

export interface BeeperLocation {
  x: number;
  y: number;
  count: number;
}

export interface KarelWorld {
  dimensions: {
    width: number; // 1 to 30
    height: number; // 1 to 30
  };
  karel: {
    position: Position;
    direction: Direction;
    beepers: number; // -1 for infinite
  };
  walls: Wall[];
  beepers: BeeperLocation[];
}

export type ExecutionStatus = 'idle' | 'running' | 'paused' | 'error' | 'success';

export interface ExecutionState {
  status: ExecutionStatus;
  currentLine: number | null; // For step highlighting
  errorLine: number | null; // For error highlighting
  stepCount: number;
  error: string | null;
  animationSpeed: number; // milliseconds per command
  stepMessage: string | null; // Descriptive message for current step
}

/**
 * Creates a default/empty Karel world
 */
export function createDefaultWorld(): KarelWorld {
  return {
    dimensions: {
      width: 10,
      height: 10
    },
    karel: {
      position: { x: 1, y: 1 },
      direction: { type: 'east' },
      beepers: 0
    },
    walls: [],
    beepers: []
  };
}

/**
 * Creates a deep copy of a Karel world
 */
export function cloneWorld(world: KarelWorld): KarelWorld {
  return {
    dimensions: { ...world.dimensions },
    karel: {
      position: { ...world.karel.position },
      direction: { ...world.karel.direction },
      beepers: world.karel.beepers
    },
    walls: world.walls.map((w) => ({ ...w })),
    beepers: world.beepers.map((b) => ({ ...b }))
  };
}

/**
 * Default execution state
 */
export function createDefaultExecutionState(): ExecutionState {
  return {
    status: 'idle',
    currentLine: null,
    errorLine: null,
    stepCount: 0,
    error: null,
    animationSpeed: 300, // Normal speed
    stepMessage: null
  };
}

/**
 * Test result for a single test case
 */
export interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
}

/**
 * A test that runs a single named function in isolation against a specific world state.
 * The student's code is loaded (to register function definitions) but only the
 * named function is called. The resulting world state is then validated.
 */
export interface FunctionTest {
  /** Display name for the test result (e.g., "move_to_paper() test") */
  name: string;
  /** The function to call after loading student definitions */
  functionName: string;
  /** The world state to start from before calling the function */
  world: KarelWorld;
  /** Validation function that checks the world after the function runs */
  validate: (world: KarelWorld) => { passed: boolean; message: string };
}

/**
 * Configuration for Karel environment tests
 */
export interface KarelTests {
  /** Map of test name to test world */
  worlds: { [testName: string]: KarelWorld };
  /** Validation function that checks if final world state is correct */
  validate: (world: KarelWorld) => { passed: boolean; message: string };
  /** Optional validation function that checks the source code itself (e.g. required function names) */
  validateCode?: {
    /** Display name for the test result */
    name: string;
    /** Validation function that checks the source code */
    validate: (code: string) => { passed: boolean; message: string };
  };
  /** Optional tests that run individual named functions in isolation against specific world states */
  functionTests?: FunctionTest[];
  /** Names of tests that can be loaded and viewed in the UI */
  loadableTests?: string[];
}

/**
 * Configuration for allowed features in Karel environment
 */
export interface AllowedFeatures {
  /** List of allowed Karel commands (if undefined, all are allowed) */
  karelCommands?: string[];
  /** List of allowed Python features (if undefined, all playground features are allowed) */
  pythonFeatures?: string[];
}

/**
 * Configuration for a Karel environment instance
 * This allows embedding Karel in lessons with specific restrictions and tests
 */
export interface KarelConfig {
  /** Initial world state when environment loads */
  initialWorld: KarelWorld;
  /** Initial code to display in the editor */
  initialCode: string;
  /** Feature restrictions for this environment (optional) */
  allowedFeatures?: AllowedFeatures;
  /** Test configuration for this environment (optional) */
  tests?: KarelTests;
  /** Whether to show the world editor UI (default: false) */
  showWorldEditor?: boolean;
  /**
   * Unique key for persisting user code in localStorage.
   * If provided, the editor will save code on change (debounced) and
   * restore it when the component mounts.
   * Convention: "<chapter>/<lesson>/<exercise>" e.g. "1/1/exercise-1"
   */
  persistenceKey?: string;
}
