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

- Control Python environment via restricted globals dictionary
- Block disallowed features per lesson (e.g., no `import`, `open()`, etc.)
- Built-in Python errors shown to users (custom educational messages as future enhancement)

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

- Grid-based world with walls between cells
- Beepers (colored objects) that can be picked up and placed
- Karel has a beeper bag (can be limited or unlimited per lesson)
- Karel's body has transparent gap to show underlying beeper
- World boundaries act as walls

---

## 3. Python Language Feature Progression

Features introduced gradually across lessons:

### Level 1: Basics

- Function calls: `move()`, `turn_left()`
- Function definitions: `def turn_right():`
- Sequential execution only

### Level 2: Control Flow

- `while` loops with conditions
- `if/else` statements
- Boolean operators: `and`, `or`, `not`

### Level 3: Advanced

- `for` loops with `range()`
- Function parameters: `def move_n_times(n):`
- Variables and arithmetic
- Nested control structures

### Feature Control

- Each lesson explicitly declares allowed Python features
- Students can use any allowed feature plus basic function definition
- Disallowed features generate Python syntax/runtime errors (custom educational messages as future enhancement)

---

## 4. Lesson Structure & Data Format

### Organizational Hierarchy

```
Chapter
  └─ Lesson
      └─ Exercise(s)
```

- **Chapters** group related concepts
- **Lessons** contain one or more exercises
- **Exercises** are individual Karel problems
- Users can access any lesson/exercise (no forced linear progression)

### Data Storage

**Structured Data (TypeScript):**

```typescript
interface Exercise {
	id: string;
	title: string;

	// World definition
	world: {
		dimensions: { width: number; height: number }; // Max 30x30
		karel: {
			position: { x: number; y: number };
			direction: 'north' | 'east' | 'south' | 'west';
			beepers: number; // -1 for infinite
		};
		walls: Wall[]; // Wall segment definitions
		beepers: { x: number; y: number; count: number }[];
	};

	// Lesson configuration
	allowedFeatures: string[]; // e.g., ['functions', 'while', 'if']
	starterCode?: string;

	// Validation
	validate: (world: KarelWorld) => { passed: boolean; message: string };
}

interface Lesson {
	id: string;
	title: string;
	exercises: Exercise[];
	markdownPath: string; // Path to .svx file with instructions
}

interface Chapter {
	id: string;
	title: string;
	lessons: Lesson[];
}
```

**Instructional Content (MDsveX):**

- Lesson descriptions, explanations, and instructions in `.svx` files (Markdown + Svelte)
- Can embed interactive Svelte components within markdown
- Supports code blocks with syntax highlighting
- Can include inline Karel world demonstrations

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

- **Granularity**: One Python statement per step
  - Steps through each line of user-written code, including inside user-defined functions
  - Example: When stepping through code that calls `turn_right()` (a user-defined function), the debugger steps into the function and executes each `turn_left()` line individually
  - Built-in Karel commands (`move()`, `turn_left()`, etc.) execute as atomic operations
- **Visual feedback**: Current line highlighted in code editor when paused or stepping. Highlighting turned off during normal play mode.

### Execution Flow

- Users can pause and resume at any time
- Code cannot be edited while program is running
- Reset button available during execution to stop and return to initial state

---

## 9. Error Handling & Safety

### Infinite Loop Protection

- **Step limit**: 10,000 Karel commands maximum per execution
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

- Dedicated route (e.g., `/karel/playground`)
- Combines world editor + code editor + Karel world display
- Target users: Both instructors (lesson authoring) and students (experimentation)

### World Editor Features

1. **Grid Configuration**
   - Adjust dimensions (up to 30x30)
   - Visual grid display

2. **Interactive Editing**
   - Click to place/remove walls between cells
   - Click to add/remove beepers (with count selector)
   - Click to set Karel's starting position
   - Direction selector for Karel

3. **Export**
   - Generate JSON matching TypeScript data structure
   - Copy to clipboard button
   - Download as .json file button

4. **Import**
   - Upload .json file
   - Load world state into editor

### Scope

- World editor handles visual world state only
- Validation functions written manually in TypeScript code
- Not a full lesson authoring UI (just world creation/testing)

---

## 13. Component Architecture

### Core Components

**Pure Display Components:**

```typescript
// KarelWorld.svelte
// - Receives world state as props
// - Renders SVG visualization
// - No internal state management
// - Pure display of position, direction, beepers, walls

// KarelControls.svelte
// - Play/Pause/Step/Reset buttons
// - Speed slider
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
// - Pure display component
```

**Container Components:**

```typescript
// KarelLesson.svelte
// - Orchestrates all Karel components for a lesson
// - Manages execution state and animation
// - Handles Pyodide integration
// - Coordinates between code editor, world, and controls
// - Implements animation queue and timing

// KarelPlayground.svelte
// - Similar to KarelLesson but includes WorldEditor
// - Manages world editing state
// - Handles world export/import

// WorldEditor.svelte
// - UI for editing world state
// - Grid manipulation tools
// - Export/import functionality
```

### Data Flow

```
User Action (Controls)
  ↓
Container Component (Lesson/Playground)
  ↓
Execute via Pyodide → Update State
  ↓
Props down to Display Components
  ↓
SVG/UI Updates
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

### Phase 1: Core Infrastructure (Playground)

1. Set up mdsvex
2. Create SVG-based KarelWorld component
3. Integrate Pyodide
4. Build WorldEditor
5. Implement basic playground page

### Phase 2: Execution & Controls

1. Implement Karel command callbacks
2. Build animation system
3. Create control panel (play/pause/step/reset)
4. Add speed control
5. Step-through debugging with line highlighting

### Phase 3: Lessons & Content

1. Define lesson data structures
2. Create lesson container components
3. Build chapter/lesson navigation
4. Implement progress tracking
5. Create initial lesson content

### Phase 4: Polish & Enhancement

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
- **Date**: February 6, 2026
- **Status**: Initial design complete
