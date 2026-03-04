# Top-Down Step Execution — Design Document

## Problem

The current step-through execution uses a **record-and-replay** architecture that only records steps when Karel action commands fire (`move()`, `turn_left()`, `pick_beeper()`, `put_beeper()`). This means:

- `def` statements are silently skipped — the highlight jumps straight to the first action
- Function call sites are not shown — the highlight jumps directly into the function body
- Students miss the top-down flow that Python actually follows

### Example: Current Behavior

Given this code (the `diminishedDuplicationExample` from Lesson 1.2):

```python
# Defining turn_around()
def turn_around():          # line 2
  turn_left()               # line 3
  turn_left()               # line 4

# Walk to the end of the row...
def walk_to_end():          # line 7
  move()                    # line 8
  move()                    # line 9
  move()                    # line 10
  move()                    # line 11

walk_to_end()               # line 13
turn_around()               # line 14
walk_to_end()               # line 15

# Now Karel is back at (1,1) — pick up the beeper!
pick_beeper()               # line 18
```

**Current step sequence** (only Karel actions):

| Step | Highlighted Line                  | Output           |
| ---- | --------------------------------- | ---------------- |
| 1    | 8 (`move()` inside `walk_to_end`) | Paused at step 1 |
| 2    | 9 (`move()`)                      | Paused at step 2 |
| ...  | ...                               | ...              |

The student never sees that Python reads `def turn_around()` on line 2 and stores the function, then reads `def walk_to_end()` on line 7 and stores it, then encounters `walk_to_end()` on line 13 and enters the function. The most important conceptual moment — that `def` creates a function without running it, and the call on line 13 is what triggers execution — is invisible.

### Desired Behavior

**New step sequence** (top-down with context):

| Step | Highlighted Line         | Output Message                                           |
| ---- | ------------------------ | -------------------------------------------------------- |
| 1    | 2 (`def turn_around():`) | Define the `turn_around` function (stored for later use) |
| 2    | 7 (`def walk_to_end():`) | Define the `walk_to_end` function (stored for later use) |
| 3    | 13 (`walk_to_end()`)     | Call `walk_to_end()`                                     |
| 4    | 8 (`move()`)             | `move()` — Karel moves forward                           |
| 5    | 9 (`move()`)             | `move()` — Karel moves forward                           |
| 6    | 10 (`move()`)            | `move()` — Karel moves forward                           |
| 7    | 11 (`move()`)            | `move()` — Karel moves forward                           |
| 8    | 13 (`walk_to_end()`)     | Return from `walk_to_end()`                              |
| 9    | 14 (`turn_around()`)     | Call `turn_around()`                                     |
| 10   | 3 (`turn_left()`)        | `turn_left()` — Karel turns left                         |
| 11   | 4 (`turn_left()`)        | `turn_left()` — Karel turns left                         |
| 12   | 14 (`turn_around()`)     | Return from `turn_around()`                              |
| 13   | 15 (`walk_to_end()`)     | Call `walk_to_end()`                                     |
| 14   | 8 (`move()`)             | `move()` — Karel moves forward                           |
| 15   | 9 (`move()`)             | `move()` — Karel moves forward                           |
| 16   | 10 (`move()`)            | `move()` — Karel moves forward                           |
| 17   | 11 (`move()`)            | `move()` — Karel moves forward                           |
| 18   | 15 (`walk_to_end()`)     | Return from `walk_to_end()`                              |
| 19   | 18 (`pick_beeper()`)     | `pick_beeper()` — Karel picks up a beeper                |

Students can now see the full execution flow: definitions are acknowledged first, then execution proceeds into function calls, clearly showing the relationship between defining and calling.

---

## Design Goals

1. **Pedagogical clarity** — Students see every meaningful moment in Python's top-down execution, including `def` statements and function calls.
2. **Descriptive output** — Each step produces a human-readable message explaining what is happening, replacing the generic "Paused at step N".
3. **Backward compatible** — The change applies to all execution modes (play, step, animated). No changes to lesson content or configs required.
4. **Extensible** — The design should accommodate future additions (e.g., `for`/`while` loop iterations, `if`/`else` branch explanations, variable assignments) without major rework.
5. **No performance regression** — The full program is still executed once up front; the enhanced trace just records more steps.

---

## Technical Approach

### Overview

The core idea is to **record additional steps** during the existing record-and-replay execution for significant non-action events: `def` statements and user-defined function calls. These "informational steps" include a descriptive message and carry an unchanged world snapshot (since no Karel action occurs).

### Step 1: Extend the `RecordedStep` Type

Currently in `KarelEnvironment.svelte`:

```typescript
type RecordedStep = {
  line: number;
  world: KarelWorldType;
};
```

**New definition:**

```typescript
type StepType = 'action' | 'define' | 'call' | 'return';

type RecordedStep = {
  line: number;
  world: KarelWorldType;
  type: StepType;
  message: string;
};
```

Where:

- `'action'` — A Karel command executed (world changes). E.g., `move()` — Karel moves forward.
- `'define'` — A `def` statement encountered (world unchanged). E.g., Define the `turn_around` function (stored for later use).
- `'call'` — A user-defined function is about to execute (world unchanged). E.g., Call `walk_to_end()`.
- `'return'` — Execution returns from a user-defined function back to the call site (world unchanged). E.g., Return from `walk_to_end()`.

### Step 2: Enhance the Python Trace Callback

The current trace function only handles `'line'` events:

```python
def _tt(frame, event, arg):
    if event == 'line' and frame.f_code.co_filename == '<user>':
        __js_trace_cb__(frame.f_lineno)
    return _tt
```

**Enhanced trace function:**

```python
def _tt(frame, event, arg):
    if frame.f_code.co_filename == '<user>':
        if event == 'line':
            __js_line_cb__(frame.f_lineno)
        elif event == 'call' and frame.f_back and frame.f_back.f_code.co_filename == '<user>':
            __js_call_cb__(frame.f_code.co_name, frame.f_back.f_lineno)
        elif event == 'return' and frame.f_back and frame.f_back.f_code.co_filename == '<user>':
            __js_return_cb__(frame.f_code.co_name, frame.f_back.f_lineno)
    return _tt
```

Three JS callbacks instead of one:

- `__js_line_cb__(lineNo)` — fires when Python is about to execute a line in user code (same as today, just renamed for clarity)
- `__js_call_cb__(funcName, callingLine)` — fires when Python calls a user-defined function, providing the function name and the line in the caller where the call happened
- `__js_return_cb__(funcName, callingLine)` — fires when Python returns from a user-defined function, providing the function name and the call site line to re-highlight

### Step 3: Detect `def` Statements via AST Pre-Analysis

Before execution, parse the user code with Python's `ast` module to build a set of line numbers that contain `def` statements:

```python
import ast
_tree = ast.parse(code)
_def_lines = {}
for node in ast.walk(_tree):
    if isinstance(node, ast.FunctionDef):
        _def_lines[node.lineno] = node.name
```

This gives us a mapping like `{2: 'turn_around', 7: 'walk_to_end'}`.

Then in the `__js_line_cb__`, when `lineNo` is in `_def_lines`, the JS side records a `'define'` step.

### Step 4: Recording Logic Changes

In `recordExecution()`, update the JS-side callbacks:

```typescript
// Set of def-statement lines, populated by AST pre-analysis
let defLines: Map<number, string>; // line -> function name

// Called on every 'line' event in user code
const lineCallback = (lineNo: number) => {
  lastTracedLine = lineNo;

  // If this line is a def statement, record a 'define' step
  if (defLines.has(lineNo)) {
    const funcName = defLines.get(lineNo)!;
    steps.push({
      line: lineNo,
      world: cloneWorld(currentWorld),
      type: 'define',
      message: `Define the \`${funcName}\` function (stored for later use)`
    });
  }
};

// Called on every 'call' event for user-defined functions
const callCallback = (funcName: string, callingLine: number) => {
  steps.push({
    line: callingLine,
    world: cloneWorld(currentWorld),
    type: 'call',
    message: `Call \`${funcName}()\``
  });
};

// Called on every 'return' event for user-defined functions
const returnCallback = (funcName: string, callingLine: number) => {
  steps.push({
    line: callingLine,
    world: cloneWorld(currentWorld),
    type: 'return',
    message: `Return from \`${funcName}()\``
  });
};

// Karel action recording (unchanged pattern, but now includes message)
const recordingCallbacks: KarelCallbacks = {
  move: () => {
    move();
    steps.push({
      line: lastTracedLine,
      world: cloneWorld(currentWorld),
      type: 'action',
      message: '`move()` — Karel moves forward'
    });
  }
  // ... similar for turn_left, pick_beeper, put_beeper
};
```

### Step 5: Update the Output Panel

Replace the generic "Paused at step N" display with the step's `message`. The `KarelOutput` component receives the current step's message and renders it.

**Changes to `ExecutionState`:**

```typescript
export interface ExecutionState {
  status: ExecutionStatus;
  currentLine: number | null;
  errorLine: number | null;
  stepCount: number;
  error: string | null;
  animationSpeed: number;
  stepMessage: string | null; // NEW — descriptive text for the current step
}
```

**Changes to `KarelOutput.svelte`:**

When `status === 'paused'` and `stepMessage` is present, display the message instead of (or alongside) the step count. The message contains inline code formatting (backticks) that should be rendered.

### Step 6: Replay Logic (Minimal Changes)

The `createStepExecutor` generator loop is nearly unchanged — it already iterates over all `RecordedStep` entries. The only addition is setting `executionState.stepMessage` from `step.message`:

```typescript
for (const step of recording.steps) {
  executionState.currentLine = step.line;
  executionState.stepMessage = step.message;
  yield step.line;
  currentWorld = cloneWorld(step.world);
  executionState.stepCount++;
}
```

---

## Edge Cases & Details

### Built-In Karel Commands vs. User-Defined Functions

Built-in Karel commands (`move`, `turn_left`, `pick_beeper`, `put_beeper`) should **not** generate a separate `'call'` step — they already produce an `'action'` step. The `'call'` event filter can exclude these by checking whether the called function's filename is `'<user>'` (Karel builtins are JS callbacks, so they won't have `co_filename == '<user>'`).

### `def` Inside Other `def` (Nested Functions)

If a student defines a function inside another function (unlikely in early lessons but possible), the inner `def` would produce a `'define'` step when execution reaches it — which is correct behavior. The AST pre-analysis naturally captures nested `def` nodes.

### Comments and Blank Lines

Python's `sys.settrace` does not fire `'line'` events for comments or blank lines. This means comments are naturally skipped, which is the desired behavior — they don't represent executable code.

### Top-Level Karel Commands

A bare `move()` at the top level generates exactly one `'action'` step (no preceding `'call'` step), since it's not a user-defined function. This is correct — the action step's message (`move() — Karel moves forward`) is self-explanatory.

### Instant Execution Mode (Speed = 0)

Instant execution currently bypasses recording entirely. Two options:

1. **Keep instant mode as-is** — no stepping, no messages (simplest)
2. **Use recording for instant mode too** — apply all steps immediately without animation

**Recommendation:** Keep instant mode as-is. It's meant to be fast and doesn't show line highlighting anyway.

### Animated Playback (Speed > 0)

Animated playback uses the same generator as stepping. The new informational steps will naturally appear during animation, with the highlight pausing briefly on `def` lines and function call lines. This adds a nice "reading along" feel to animations.

**Consideration:** Should `'define'` and `'call'` steps animate at a different (faster) speed than action steps? This is a tuning decision. For now, use the same speed. If it feels sluggish, we can add differentiated timing later.

### Multiple Function Calls on One Line

If a line contains multiple function calls (e.g., `turn_left(); turn_left()`), each call would produce its own `'call'` event. However, for Karel lessons this situation is unlikely since students don't use semicolons. The design handles it correctly regardless.

---

## Future Extensibility

This architecture naturally extends to other statement types. Potential future additions:

| Statement                 | Step Type          | Example Message                                  |
| ------------------------- | ------------------ | ------------------------------------------------ |
| `for i in range(4):`      | `'loop'`           | Start a `for` loop (4 iterations)                |
| Loop iteration            | `'loop-iteration'` | Loop iteration 2 of 4                            |
| `while front_is_clear():` | `'loop'`           | Check `front_is_clear()` — True, enter loop      |
| `if beepers_present():`   | `'branch'`         | Check `beepers_present()` — True, enter if block |
| `else:`                   | `'branch'`         | Condition was False, enter else block            |
| `return`                  | `'return'`         | Return from `build_tower()`                      |
| Variable assignment       | `'assign'`         | Store the value `5` in variable `x`              |

Each of these would follow the same pattern: detect via AST or trace events, record a step with a descriptive message, and display it in the output panel. The `StepType` union expands to include new variants.

This design also lays groundwork for the planned **Call Stack Visualizer** module, which would consume the same step data to render a visual call stack.

---

## Implementation Plan

### Phase 1: Core Infrastructure

1. **Extend `RecordedStep` type** — Add `type` and `message` fields
2. **AST pre-analysis** — Run `ast.parse` on user code to identify `def` statement lines before execution
3. **Enhanced trace callback** — Handle `'call'` events in addition to `'line'` events; record `'define'` steps for `def` lines
4. **Update recording callbacks** — Add descriptive messages to Karel action steps

### Phase 2: Output Panel

5. **Add `stepMessage` to `ExecutionState`** — Thread the message through from generator to state
6. **Update `KarelOutput.svelte`** — Display step messages (with inline code formatting) instead of generic "Paused at step N"

### Phase 3: Replay Integration

7. **Update `createStepExecutor`** — Set `stepMessage` from each recorded step
8. **Update `continueExecution`** — Ensure animated playback works with new step types

### Phase 4: Testing & Polish

9. **Update existing Playwright tests** — Step counts will increase due to new informational steps
10. **Add unit tests** — Verify that `def` lines and function call lines produce steps with correct messages
11. **Visual QA** — Walk through every existing lesson to confirm the new stepping feels right
12. **Tune animation timing** — Decide whether informational steps should animate at a different speed

### Files to Modify

| File                                         | Changes                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/lib/components/KarelEnvironment.svelte` | `RecordedStep` type, `recordExecution()`, `createStepExecutor()`, trace callback setup |
| `src/lib/components/KarelOutput.svelte`      | Display `stepMessage` instead of generic text                                          |
| `src/lib/karel/types.ts`                     | Add `stepMessage` to `ExecutionState` (if type is defined here)                        |
| `tests/karel.test.ts`                        | Update step count expectations, add new stepping tests                                 |

---

## Open Questions

1. **Should `'define'` steps show during animated playback at a faster speed?** **Decision: No — keep the same speed for all step types for consistency.**

2. **Should we show a "Return from X" step when leaving a user-defined function?** **Decision: Yes — show a return step that re-highlights the call site line (option 1).** Python's `sys.settrace` fires a `'return'` event with access to `frame.f_back.f_lineno`, giving us the caller's line. This creates a natural bookend: highlight call site → dive into body → return to call site → move on.

3. **Should the output panel accumulate a log of messages, or only show the current step's message?** **Decision: Show only the current step's message, replacing it each time.** Keeps the UI clean and focused. A scrolling log could be revisited later if needed.
