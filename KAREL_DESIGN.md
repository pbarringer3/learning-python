# Karel the Robot - Design Document

## Project Overview

Karel the Robot is an interactive, browser-based module for teaching Python programming fundamentals. Students write Python code to control a robot (Karel) in a grid-based world, learning programming concepts through visual, engaging exercises.

### Goals

- Provide a static, client-side implementation (no backend required)
- Support progressive learning (gradually introduce Python features)
- Offer visual feedback through animated Karel world
- Enable step-by-step debugging and code execution control
- Support both guided lessons and open-ended playground experimentation

---

## 1. Execution Strategy

### Python Runtime: Pyodide

- **Technology**: Pyodide (Python compiled to WebAssembly)
- **Loading Strategy**: Background load after initial page load
  - Show loading indicator/spinner if user navigates to Karel lesson before Pyodide is ready
  - Browser HTTP caching handles subsequent visits automatically
  - Future enhancement: Service worker for aggressive caching

### Karel-Python Interface

- **Approach**: Inject Karel functions directly into Python global namespace
- **Example**: User writes `move()` directly, without import statements
- **Implementation**: JavaScript callbacks bound to Python globals update Svelte component state

### Language Feature Restrictions

- **Implementation**: Python AST (Abstract Syntax Tree) parsing before execution
- Two-pass validation algorithm for accurate function detection
- Educational error messages with line numbers
- Validator preserved during namespace resets
- Current implementation enforces single restriction level for playground

---

## 2. Karel Commands & World Features

### Classic Stanford Karel Command Set

**Movement & Actions:**

- `move()` - Move forward one cell
- `turn_left()` - Rotate 90° counter-clockwise
- `pick_beeper()` - Pick up a beeper from current cell
- `put_beeper()` - Place a beeper in current cell

**Note:** `turn_right()` is intentionally omitted initially - students implement it as a learning exercise using `turn_left()`.

**Conditionals (Sensors):**

| Test                | Opposite               | What it checks                          |
| ------------------- | ---------------------- | --------------------------------------- |
| `front_is_clear()`  | `front_is_blocked()`   | Is there a wall in front of Karel?      |
| `beepers_present()` | `no_beepers_present()` | Are there beepers on this corner?       |
| `left_is_clear()`   | `left_is_blocked()`    | Is there a wall to Karel's left?        |
| `right_is_clear()`  | `right_is_blocked()`   | Is there a wall to Karel's right?       |
| `beepers_in_bag()`  | `no_beepers_in_bag()`  | Does Karel have any beepers in its bag? |
| `facing_north()`    | `not_facing_north()`   | Is Karel facing north?                  |
| `facing_south()`    | `not_facing_south()`   | Is Karel facing south?                  |
| `facing_east()`     | `not_facing_east()`    | Is Karel facing east?                   |
| `facing_west()`     | `not_facing_west()`    | Is Karel facing west?                   |

### World Features

- Grid-based world with solid border walls
- Grid intersections marked with blue plus signs at cell centers
- Row and column numbers displayed along left side and bottom
- Beepers are teal diamond shapes that can be picked up and placed
- Karel has a beeper bag (can be limited or unlimited per lesson)
- Karel rendered as classic Stanford Karel robot with transparent window
- World boundaries act as solid walls

---

## 3. Python Language Feature Restrictions

### Playground Environment

The Karel playground enforces strict language restrictions to maintain educational focus. Code is validated using Python AST (Abstract Syntax Tree) parsing before execution, providing immediate, educational feedback.

### Allowed Features

**✅ Karel Functions:**

- All Karel commands: `move()`, `turn_left()`, `pick_beeper()`, `put_beeper()`
- All sensor functions: `front_is_clear()`, `beepers_present()`, etc.

**✅ User-Defined Functions:**

- Function definitions with **no parameters**: `def turn_right():`
- Function calls to user-defined functions

**✅ Control Flow:**

- `while` loops with conditions
- `for` loops with `range()`
- `if`, `elif`, `else` statements
- Boolean operators: `and`, `or`, `not`

**✅ Loop Variables:**

- Only context: loop iteration variables (e.g., `i` in `for i in range(5):`)

**✅ Comments:**

- Single-line comments with `#`

### Disallowed Features

All other Python features are blocked with educational error messages:

- ❌ Variable assignments (except loop variables)
- ❌ Function parameters: `def move_n(n):` — must be `def move_n():`
- ❌ `print()` and other built-in functions (except `range()`)
- ❌ `import` statements
- ❌ Classes
- ❌ Lists, dictionaries, sets
- ❌ List/dict comprehensions
- ❌ Indexing and subscripting
- ❌ Lambda functions
- ❌ Exception handling (`try`/`except`)
- ❌ Context managers (`with`)
- ❌ Async/await
- ❌ Generators (`yield`)
- ❌ `global`/`nonlocal` keywords
- ❌ `del` statements

### Validation & Error Messages

**Implementation:**

- Python AST parser analyzes code structure before execution
- Violations trigger immediate, user-friendly error messages
- Error messages include line numbers for easy debugging

**Example Error Messages:**

- "Variable assignments are not allowed. Use loops and Karel functions instead."
- "Function parameters are not allowed. Define 'turn_right()' with no parameters."
- "Function 'print()' is not allowed. Use only Karel functions, your own functions, or range()."

### Future: Progressive Feature Levels

_Note: Current implementation enforces one restriction level for all playground use. Future enhancement will support per-lesson feature control:_

#### Level 1: Basics

- Function calls: `move()`, `turn_left()`
- Function definitions: `def turn_right():`
- Sequential execution only

#### Level 2: Control Flow

- `while` loops with conditions
- `if/else` statements
- Boolean operators: `and`, `or`, `not`

#### Level 3: Advanced

- `for` loops with `range()`
- Variables and arithmetic
- Nested control structures

---

## 4. Lesson Structure & Data Format

### Organizational Hierarchy

```
Chapter
  └─ Lesson (MDsveX file)
      └─ Embedded Karel Environments (Examples & Exercises)
```

- **Chapters** group related concepts
- **Lessons** are MDsveX files containing explanations and embedded Karel environments
- **Karel Environments** can be simple examples or exercises with tests
- Users can access any lesson (no forced linear progression)

### Karel Environment Configuration

Each embedded Karel environment is configured via a `KarelConfig` object:

```typescript
interface KarelConfig {
  // Initial setup (required)
  initialWorld: KarelWorld;
  initialCode: string;

  // Feature restrictions (optional - defaults to all features allowed)
  allowedFeatures?: {
    // Restrict which Karel commands can be used
    karelCommands?: string[]; // e.g., ['move', 'turn_left', 'pick_beeper', 'put_beeper']

    // Restrict which Python features can be used
    pythonFeatures?: string[]; // e.g., ['functions', 'while', 'if', 'for', 'range']
  };

  // Test suite (optional - for exercises with "Run Tests" button)
  // For a single test, just provide one test world
  tests?: {
    // Map of test name to test world
    worlds: { [testName: string]: KarelWorld };

    // Validation function to check if solution is correct
    validate: (world: KarelWorld) => {
      passed: boolean;
      message: string;
    };

    // List of test names that can be loaded into editor via dropdown
    loadableTests?: string[];
  };

  // UI configuration (typically defaults are fine)
  showWorldEditor?: boolean; // Default: false (true only for playground)
}
```

### Environment Types

**1. Simple Interactive Example:**

- No tests
- Students experiment freely

```typescript
{
  initialWorld: { /* ... */ },
  initialCode: '# Try moving Karel!\nmove()\nturn_left()'
}
```

**2. Exercise with Single Test:**

- One test world (shown in editor)
- "Run Tests" button appears
- Validation checks the result

```typescript
{
  initialWorld: { /* ... */ },
  initialCode: '# Move to position (5, 5)\n',
  tests: {
    worlds: {
      'Main': { /* the displayed world */ }
    },
    validate: (world) => ({
      passed: world.karel.position.x === 5 && world.karel.position.y === 5,
      message: world.karel.position.x === 5 && world.karel.position.y === 5
        ? 'Perfect! Karel is at (5, 5)!'
        : 'Karel needs to reach position (5, 5)'
    })
  }
}
```

**3. Exercise with Multiple Tests:**

- Multiple test worlds
- "Run Tests" button appears
- Optional test world dropdown to preview different scenarios
- Validation checks each result

```typescript
{
  initialWorld: { /* ... displayed by default */ },
  initialCode: '# Pick up all beepers\n',
  tests: {
    worlds: {
      'Empty world': { /* no beepers */ },
      'One beeper': { /* 1 beeper at (3,3) */ },
      'Many beepers': { /* 5 beepers scattered */ }
    },
    loadableTests: ['Empty world', 'One beeper'], // Students can preview these
    validate: (world) => ({
      passed: world.beepers.length === 0 && world.karel.beepers > 0,
      message: world.beepers.length === 0
        ? '✓ All beepers collected!'
        : 'Some beepers remain on the ground'
    })
  }
}
```

### Instructional Content (MDsveX)

- Lesson descriptions, explanations, and instructions in `.svx` files (Markdown + Svelte)
- Embed `KarelEnvironment` components directly in markdown
- Supports code blocks with syntax highlighting
- Can include multiple Karel environments per lesson (examples + exercises)

---

## 5. UI/UX Design

### Responsive Layout

**Small Screens (Mobile/Tablet):**

```
┌──────────────────────────────────┐
│  Instructions (Markdown)         │
├──────────────────────────────────┤
│  Karel World (SVG)               │
│  [Controls: Play/Pause/Step/etc] │
├──────────────────────────────────┤
│  Code Editor (CodeMirror)        │
├──────────────────────────────────┤
│  Output (Errors/Messages)        │
└──────────────────────────────────┘
```

**Large Screens (Desktop):**

```
┌─────────────────────────────────────────┐
│  Instructions (Markdown)                │
├────────────────────┬────────────────────┤
│  Code Editor       │  Karel World (SVG) │
│                    │  [Controls]        │
├────────────────────┤                    │
│  Output            │                    │
└────────────────────┴────────────────────┘
```

### Resizable Panels

- Code/output and Karel world sections should be resizable on large screens
- Maintain responsive behavior on resize

### Visual Design

- Match classic Stanford Karel aesthetic (see reference images)
- Grid with corner markers (+)
- Colored beepers
- Karel robot with transparent body gap to show underlying beepers
- Clean geometric shapes and lines

---

## 6. Karel World Rendering

### Technology: SVG

**Rationale:**

- Grid interactivity needed for world editor (clickable walls, beepers)
- Easy export/import (world state is pure data, SVG just renders it)
- Natural transparency/layering support
- Scales perfectly with responsive design
- Excellent performance for Karel's use case

### Performance Considerations

- **Technical limit**: SVG handles 50x50+ grids easily
- **UX limit**: 30x30 maximum for visual clarity and pedagogical value
  - Cells remain visible on mobile devices
  - Appropriate complexity for learners
  - Reasonable screen real estate usage

### SVG Structure

```
<svg>
  <!-- Grid background -->
  <g class="grid">...</g>

  <!-- Walls -->
  <g class="walls">...</g>

  <!-- Corner markers -->
  <g class="markers">...</g>

  <!-- Beepers (below Karel) -->
  <g class="beepers">...</g>

  <!-- Karel -->
  <g class="karel" transform="...">...</g>
</svg>
```

---

## 7. Code Editor

### Technology: CodeMirror 6

**Rationale:**

- Lightweight (~200KB) compared to Monaco Editor (~2-3MB)
- Modern architecture with good mobile support
- Desired features as listed below
- Extensible for future enhancements

### Features

- Python syntax highlighting
- Line highlighting during step-through execution
- Line numbers
- Basic editing features (bracket matching, indentation)

---

## 8. Execution & Animation Controls

### Control Buttons

1. **Play** - Execute entire program with animation
2. **Pause** - Pause during execution (can resume)
3. **Step** - Execute one Python statement at a time
4. **Reset** - Return Karel world to initial state
5. **Speed Slider** - Control animation speed

### Speed Control

Available speeds (via slider):

- Instant (0ms - no animation)
- Very Fast (50ms per Karel command)
- Fast (150ms)
- Normal (300ms)
- Slow (600ms)
- Very Slow (1000ms+)

### Step-Through Execution

- **Architecture**: Record-and-replay using Python's `sys.settrace`
  - **Phase 1 (Record)**: Execute entire program with tracing enabled, recording line numbers and world snapshots
  - **Phase 2 (Replay)**: Yield recorded steps one-by-one for visualization
- **Granularity**: One Karel action command per step
  - Each `move()`, `turn_left()`, `pick_beeper()`, `put_beeper()` is one step
  - Control flow statements (if/while/for) highlight but don't pause execution
  - Only lines Python actually executes are shown (no dead code highlighting)
  - Works correctly with functions, loops, conditionals, and any nesting
- **Visual feedback**:
  - Current line highlighted in code editor during step-through
  - World state updates with each step to show Karel's actions
  - Play mode: Animation delay between steps
  - Step mode: Instant execution for responsive debugging

### Execution Flow

- Users can pause and resume at any time
- Code cannot be edited while program is running
- Reset button available during execution to stop and return to initial state

---

## 9. Error Handling & Safety

### Infinite Loop Protection

- **Step limit**: 2,500 Karel commands maximum per execution
- Configurable as a constant for easy adjustment
- Prevents browser freezing from runaway code
- Error message displayed when limit exceeded

### Error Categories

**1. Python Syntax Errors**

- Caught before execution begins
- Displayed in output panel

**2. Karel Runtime Errors (Strict Mode)**

- Moving into a wall
- Picking beeper when none present
- Putting beeper with empty bag
- **Behavior**: Show error message in output panel + visual feedback on Karel world
- **No graceful failures**: All errors stop execution immediately

**3. Disallowed Language Features**

- Using Python features not allowed in current lesson
- Built-in Python error messages shown (custom educational messages as future enhancement)

**4. Step Limit Exceeded**

- Execution stops with timeout message
- Helps students identify infinite loops

### Visual Error Feedback

- Error messages in output panel below code
- Karel world color change or visual indicator when error occurs
- Execution stops immediately on error

---

## 10. State Management

### Architecture: Component-Based State

- **Karel world state**: Per-component (not global)
  - Each lesson/exercise instance maintains its own state
  - Enables multiple browser tabs/windows with different lessons
- **Global state**: Svelte stores for user preferences and progress

### State Categories

**Component State (per Karel instance):**

- Current world state (Karel position, direction, beepers, walls)
- Execution state (running, paused, stopped, current line, step count)
- Animation queue
- Code editor content (transient)

**Global State (Svelte stores):**

- User preferences (animation speed, etc.)
- Lesson/exercise completion status
- Saved code per exercise (persisted to localStorage)
- Progress metadata (completion dates)

### State Persistence (localStorage/IndexedDB)

```typescript
{
  progress: {
    exercises: {
      [exerciseId]: {
        completed: boolean;
        completedDate: string; // ISO timestamp
        code: string; // Most recent code
        codeUpdatedDate: string;
      }
    };
    lessons: {
      [lessonId]: {
        completed: boolean; // All exercises completed
        completedDate: string;
      }
    };
  };
  preferences: {
    animationSpeed: number;
    // other user preferences
  };
}
```

---

## 11. Pyodide Integration

### Initialization

- Load Pyodide in background after main page loads
- Show loading spinner/indicator if user navigates to Karel lesson before ready
- Cache handled automatically by browser (HTTP caching)
- Future enhancement: Service worker for offline support

### Karel Function Injection

Karel commands exposed as Python functions via JavaScript callbacks:

```javascript
// Example implementation approach
pyodide.globals.set('move', () => {
  // Update Svelte component state
  karelState.move();
});

pyodide.globals.set('turn_left', () => {
  karelState.turnLeft();
});

// etc. for all Karel commands
```

### Restricted Execution Environment

- Provide limited globals dictionary to Python
- Only expose allowed built-ins per lesson
- Block dangerous operations (`import`, `open()`, etc.)
- Karel commands automatically available (no import needed)

---

## 12. World Editor & Playground

### Playground Page

The playground is a special page that uses `KarelEnvironment` with world editing capabilities enabled:

- Dedicated route (`/karel/playground`)
- Uses `KarelEnvironment` component with `showWorldEditor=true`
- **Mode Toggle**: Slider button to switch between Play and Edit modes
  - **Play Mode** (default): Standard Karel environment with execution controls
  - **Edit Mode**: World editor UI for modifying the world state
  - **Auto-reset**: Switching to Edit mode automatically resets execution state
- **No Additional Restrictions**: All Karel commands and allowed Python features enabled (base Karel restrictions still apply)
- **No Validation/Testing**: Pure sandbox for experimentation
- **State Persistence**: World changes persist when switching modes
- **World Export/Import**: Save and load world configurations as JSON
- Target users: Both instructors (lesson authoring) and students (experimentation)

### World Editor Features

1. **Grid Configuration**

   - Adjust dimensions (up to 30x30)
   - Visual grid display

2. **Interactive Editing**

   - **✅ Move Karel Mode** (COMPLETE): Click cells to move Karel to new position
   - **✅ Add/Remove Walls Mode** (COMPLETE): Click wall segments between cells to toggle walls
   - Click to add/remove beepers with count selector (TODO)
   - Direction selector for Karel (working via dropdown)
   - **Interactive Karel World**: Right-side world display is clickable in edit mode
   - **Mode-based overlays**: Shows cell hotspots or wall hotspots based on active mode
   - **Visual feedback**: Blue hover highlights with crosshair cursor for walls
   - **Streamlined UI**: Clean interface without instruction text (intuitive button labels)

3. **Technical Implementation**

   - KarelWorld component supports `interactive` prop with separate `onCellClick` and `onWallClick` callbacks
   - Wall hotspots: 8px wide clickable areas with 1px visual wall thickness
   - WorldEditor exposes `handleCellClick` and `handleWallClick` functions via bindable props
   - Playground conditionally passes callbacks based on active edit mode
   - Full keyboard accessibility (Enter/Space keys) for both cells and walls
   - Visual hover feedback: blue fill for cells, blue stroke with crosshair cursor for walls
   - Elements automatically blur after click to remove hover state and show results clearly
   - State synchronization ensures changes persist between Play/Edit modes
   - **Separate beeper controls**: Independent "Add Beepers" and "Remove Beepers" buttons
   - **Incremental beeper management**: Always add/remove exactly 1 beeper at a time
   - **Smart beeper removal**: Prevents removing beepers when none are present
   - **Reset functionality**: Uses `createDefaultWorld()` from types.ts to restore initial state

4. **Export**

   - Generate JSON matching TypeScript data structure
   - Copy to clipboard button
   - Download as .json file button

5. **Import**
   - Upload .json file
   - Load world state into editor

### Scope

- World editor handles visual world state only
- Validation functions written manually in TypeScript code
- Not a full lesson authoring UI (just world creation/testing)

### Relationship to Lessons

- Playground is standalone - not embedded in lessons
- Students use playground for open-ended experimentation
- Instructors use playground to create and test worlds for lessons
- Export worlds from playground → copy into lesson config objects

---

## 13. Component Architecture

### Overview

The Karel environment is designed as a **reusable component system** to support multiple use cases:

1. **Playground**: Open-ended experimentation with world editing
2. **Simple Examples**: Interactive code demonstrations in lessons without tests
3. **Exercises with Tests**: Exercises with "Run Tests" button (single or multiple test worlds)

All use cases share the same core `KarelEnvironment` component, configured via props.

### Reusable Karel Environment

The core Karel execution environment is implemented as a reusable Svelte component (`KarelEnvironment.svelte`) that can be embedded in both the playground and lesson pages. This component accepts configuration via props and handles all execution, animation, and validation logic.

#### KarelEnvironment Component

**Props:** Accepts a `KarelConfig` object (see Section 4 for full interface definition)

**Responsibilities:**

- Manages Karel world state (current and initial)
- Handles code execution via Pyodide integration
- Implements animation system with record-and-replay
- Validates code against allowed features
- Provides execution controls (play/pause/step/reset)
- Handles test execution when tests provided

**Features:**

1. **Standard Execution**: Run code with animation controls
2. **Testing** (when tests provided): "Run Tests" button that:
   - Executes code against one or more test worlds
   - Shows "✓ All tests passed!" if all pass
   - Shows individual test results if any fail (e.g., "Test 1: ✗ Failed - Karel ended at wrong position")
   - Provides dropdown to load any test world from `loadableTests` into the Karel display

### Pure Display Components

```typescript
// KarelWorld.svelte
// - Receives world state as props
// - Renders SVG visualization
// - No internal state management
// - Pure display of position, direction, beepers, walls
// - Supports interactive prop for world editor (playground only)

// KarelControls.svelte
// - Play/Pause/Step/Reset buttons
// - Speed slider
// - Optional "Run Tests" button (when tests provided)
// - Dispatches events to parent
// - No execution logic

// KarelCodeEditor.svelte
// - CodeMirror 6 wrapper
// - Receives content as prop
// - Dispatches code change events
// - Handles line highlighting from parent

// KarelOutput.svelte
// - Displays error messages
// - Displays success/validation feedback
// - Shows test results (pass/fail details)
// - Pure display component

// WorldEditor.svelte (playground only)
// - UI for editing world state
// - Grid manipulation tools
// - Export/import functionality
```

### Container Components

```typescript
// KarelEnvironment.svelte (NEW - core reusable component)
// - Accepts KarelConfig as prop
// - Orchestrates all Karel components
// - Manages execution state and animation
// - Handles Pyodide integration
// - Implements validation and testing logic
// - Coordinates between code editor, world, and controls
// - Implements animation queue and timing

// Playground Page (+page.svelte in /karel/playground)
// - Uses KarelEnvironment with showWorldEditor=true
// - Manages world editing state and mode switching
// - Provides default world and code
// - Handles world export/import
// - Enables all features (no restrictions)

// Lesson Pages (future)
// - Embed multiple KarelEnvironment instances
// - Each instance gets unique KarelConfig
// - Markdown content with embedded Karel environments
// - Some exercises have tests, others are just examples
```

### Data Flow

**Standard Execution:**

```
User Action (Controls)
  ↓
KarelEnvironment Component
  ↓
Execute via Pyodide → Update State
  ↓
Props down to Display Components
  ↓
SVG/UI Updates
```

**Testing Flow:**

```
User clicks "Run Tests"
  ↓
KarelEnvironment loops through test worlds:
  - Reset to test world
  - Execute user code
  - Call validate(finalWorld)
  - Record result
  ↓
All tests pass → "✓ All tests passed!"
Some fail → Show details for each failure
  ↓
Display results in KarelOutput
```

### Usage Example

**In a lesson markdown file:**

```svelte
<script>
  import KarelEnvironment from '$lib/components/KarelEnvironment.svelte';

  const exercise1Config = {
    initialWorld: {
      dimensions: { width: 8, height: 8 },
      karel: { position: { x: 1, y: 1 }, direction: { type: 'east' }, beepers: 0 },
      walls: [],
      beepers: [{ x: 4, y: 1, count: 1 }]
    },
    initialCode: '# Move Karel to the beeper\n',
    tests: {
      worlds: {
        Main: {
          /* same as initialWorld */
        }
      },
      validate: (world) => {
        if (world.karel.position.x === 4 && world.karel.position.y === 1) {
          return { passed: true, message: 'Perfect! Karel reached the beeper!' };
        }
        return { passed: false, message: 'Karel needs to reach position (4, 1)' };
      }
    }
  };

  const exercise2Config = {
    initialWorld: {
      /* ... */
    },
    initialCode: '# Pick up all beepers\n',
    allowedFeatures: {
      karelCommands: ['move', 'turn_left', 'pick_beeper'],
      pythonFeatures: ['functions', 'while', 'if']
    },
    tests: {
      worlds: {
        'Test 1: Empty world': {
          /* world with no beepers */
        },
        'Test 2: One beeper': {
          /* world with 1 beeper */
        },
        'Test 3: Multiple beepers': {
          /* world with 5 beepers */
        }
      },
      loadableTests: ['Test 1: Empty world', 'Test 2: One beeper'],
      validate: (world) => ({
        passed: world.beepers.length === 0,
        message:
          world.beepers.length === 0
            ? 'Great job! All beepers collected!'
            : 'Some beepers remain on the ground'
      })
    }
  };
</script>

# Lesson: Moving Karel Learn how to move Karel around the world! ## Exercise 1: Reach the Beeper
Write code to move Karel to position (4, 1) where the beeper is located.

<KarelEnvironment config={exercise1Config} />

## Exercise 2: Collect All Beepers This exercise tests your code against multiple worlds!

<KarelEnvironment config={exercise2Config} />
```

---

## 14. Technology Stack

### Core Framework

- **SvelteKit** - Application framework (already in place)
- **TypeScript** - Type safety (already in place)

### New Dependencies

**Python Execution:**

- `pyodide` - Python WebAssembly runtime

**Code Editor:**

- `codemirror` - Code editor
- `@codemirror/lang-python` - Python language support
- `@codemirror/theme-*` - Editor themes

**Markdown:**

- `mdsvex` - Markdown + Svelte integration
- Syntax highlighting plugin for code blocks

**Utilities:**

- Standard Svelte stores for state management
- localStorage API (built-in)
- IndexedDB (for future scaling if needed)

### Development Tools

- Existing SvelteKit tooling (Vite, etc.)
- TypeScript compiler

---

## 15. Data Structures

### Karel World State

```typescript
interface Position {
  x: number; // 1-indexed
  y: number; // 1-indexed
}

interface Direction {
  type: 'north' | 'east' | 'south' | 'west';
}

interface Wall {
  type: 'horizontal' | 'vertical';
  x: number;
  y: number;
  // horizontal wall: below cell (x,y)
  // vertical wall: to right of cell (x,y)
}

interface BeeperLocation {
  x: number;
  y: number;
  count: number;
}

interface KarelWorld {
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
```

### Execution State

```typescript
type ExecutionStatus = 'idle' | 'running' | 'paused' | 'error' | 'success';

interface ExecutionState {
  status: ExecutionStatus;
  currentLine: number | null; // For step highlighting
  stepCount: number;
  error: string | null;
  animationSpeed: number; // milliseconds per command
}
```

---

## 16. Future Enhancements

### Phase 2 Features

- Custom educational error messages for disallowed features
- Service worker for offline support and aggressive Pyodide caching
- Share state via URL encoding (encode world + code in URL parameters)

### Advanced Features

- Achievement system

---

## 17. Implementation Phases

### Phase 1: Core Infrastructure (Playground) ✅ COMPLETE

1. ✅ Set up mdsvex
2. ✅ Create SVG-based KarelWorld component
3. ✅ Integrate Pyodide
4. ✅ Build WorldEditor
5. ✅ Implement basic playground page

### Phase 2: Execution & Controls ✅ COMPLETE

1. ✅ Implement Karel command callbacks
2. ✅ Build animation system with record-and-replay architecture
3. ✅ Create control panel (play/pause/step/reset)
4. ✅ Add speed control
5. ✅ Step-through debugging with line highlighting
6. ✅ Full control flow support (if/else, while, for loops)

### Phase 3: Reusable Component Architecture (NEXT)

1. ⏳ Extract core logic into `KarelEnvironment` component
   - Move execution state management from playground to component
   - Accept `KarelConfig` prop for configuration
   - Support optional testing
2. ⏳ Refactor playground to use `KarelEnvironment`
   - Playground wraps KarelEnvironment with world editor
   - Maintains all existing functionality
3. ⏳ Implement feature restriction system
   - Configurable Karel command restrictions
   - Configurable Python feature restrictions
   - Update validator to accept allowed features
4. ⏳ Add testing support
   - "Run Tests" button when tests provided
   - Test execution against one or more test worlds
   - Test world dropdown for loadable tests
   - Test result display (all pass vs. individual failures)
   - Single test acts as simple validation

### Phase 4: Lessons & Content

1. Create example lessons using `KarelEnvironment`
2. Build chapter/lesson navigation
3. Implement progress tracking
4. Create initial lesson content

### Phase 5: Polish & Enhancement

1. Error handling improvements
2. Responsive design refinement
3. Accessibility improvements
4. Performance optimization
5. User testing and iteration

---

## 18. Open Questions & Decisions Needed

### Design Decisions Finalized

- ✅ Execution strategy (Pyodide)
- ✅ Rendering approach (SVG)
- ✅ Code editor (CodeMirror 6)
- ✅ Content format (mdsvex)
- ✅ Component architecture (pure display pattern)
- ✅ State management (component + stores)
- ✅ World size limits (30x30)
- ✅ Error handling approach (strict)
- ✅ Animation controls

### Future Considerations

- Accessibility features (screen reader support for Karel world)
- Internationalization/localization
- Analytics/telemetry (if desired)
- Content management workflow
- Testing strategy (unit, integration, e2e)

---

## Document Version

- **Version**: 1.0
- **Status**: Initial design complete
