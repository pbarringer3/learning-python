# Implementation Progress

This document tracks the overall implementation status of the Learning Python curriculum — what's built, what's in flight, and what's next. For the full curriculum plan (all chapters, lesson topics, design principles), see **[CURRICULUM_DESIGN.md](CURRICULUM_DESIGN.md)** — this doc does not duplicate that planning content, only implementation status.

---

## Project Status Overview

| Chapter | Title                                                                                                                                 | Status                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1       | Karel the Robot                                                                                                                       | ✅ Complete — built + reviewed (see `CHAPTER_1_PROGRESS.md`) |
| 2       | Hello, Python!                                                                                                                        | ✅ Complete — 5 lessons, 15 exercises, all auto-graded       |
| 3       | Variables & Types                                                                                                                     | ✅ Complete — 8 lessons, 24 exercises, all auto-graded       |
| 4+      | Functions, Strings, Lists, Dictionaries, Graphics, Classes, Building a Game, Files & Exceptions, Recursion, Searching & Sorting, etc. | 📋 Planned — see `CURRICULUM_DESIGN.md`                      |

**Cross-cutting infrastructure status:**

- ✅ Curriculum data model (`Chapter`/`Lesson` types, progress store, lesson routing) — chapter-agnostic, ready to extend for Chapter 2+
- ✅ Site shell (`LessonShell`, `NavDrawer`, `TopBar`) — reusable across chapters
- ✅ `KarelEnvironment` — interactive environment for Chapter 1 (and any later Karel practice in later chapters)
- ✅ **`PythonEnvironment` + Call Stack Visualizer** — built as one piece, not two. The stepping engine (Pyodide in a Web Worker, paused via `SharedArrayBuffer` + `Atomics`) is what gives blocking `input()` and streaming `print()` output their behaviour, so the environment and the visualizer share it. Sandbox lives at `/python/playground`. See **[PythonInterpreterDesign.md](PythonInterpreterDesign.md)** — §10 maps every concern to a file.
- ✅ **Python environment refactor (§12)** — controls, panel layout, and breakpoints, all eleven checklist items done. Panels are editor / output / controls with a fixed-height console and a 10–20 line editor; the control row is a combined ▶ Play / ■ Stop plus Step, To breakpoint, a show/hide-visualizer eye, and Reset code (Clear, Auto and the speed slider are gone). Breakpoints are set by clicking a line number, persist with the code, and reach the worker through a shared-memory bitmap so one added mid-pause still fires. The final snapshot now stays on screen with a per-ending banner, synthesised from the surviving globals or from the traceback so plain Play keeps its no-tracer fast path. `PythonConfig.showVisualizer` is now the _initial_ state only — the student's own choice persists per exercise.
- ✅ **Per-exercise `tests` for `PythonEnvironment`** — "Run tests" runs the student's program once per case with queued `input()` answers and compares captured stdout, then marks the exercise complete. All fifteen Chapter 2 exercises are wired to `exercise-fixtures.ts` through `testsFor(key)`, so a lesson's sample run _is_ its test. See **[PythonInterpreterDesign.md](PythonInterpreterDesign.md) §13** — §13.8 maps every concern to a file.
- ❌ `GraphicsEnvironment` — needed for Chapters 8–10. Not started (library TBD).

**Deferred on purpose** (`PythonConfig` is shaped so it is additive, not a rewrite):

- `allowedFeatures` — an opt-in AST allowlist so a lesson can forbid syntax it hasn't taught yet, generalizing Karel's `validate_karel_code`. Python runs **unrestricted** today.

---

## What's Next

Chapters 2 and 3 are both done. Chapter 3 runs to eight lessons and twenty-four exercises at `/3/1` through `/3/8`, every one auto-graded, and it closes the control-flow debt Chapter 2 kept promising: `if`, `elif`, `else`, `while` and — new to the curriculum — `break`. The next chapter is the next job.

1. **Chapter 4: Functions & Parameters** — see `CURRICULUM_DESIGN.md`. Chapter 3's closing section promises students that Chapter 4 gives functions parameters and return values, and that the built-ins they have been calling all along are ordinary functions they could write themselves. Keep both promises. Author each exercise's fixture in `exercise-fixtures.ts` alongside its lesson prose and wire it with `tests: testsFor('<key>')` — `exercise-fixtures.test.ts` fails if an exercise is authored without one, or wired without one. Author each exercise's fixture in `exercise-fixtures.ts` alongside its lesson prose and wire it with `tests: testsFor('<key>')` — `exercise-fixtures.test.ts` fails if an exercise is authored without one, or wired without one.
2. **Revisit `allowedFeatures`** — the last deferred piece. Chapter 2 holds back `if`/`while`/comparisons on purpose and says so in the lesson text; an AST allowlist would enforce what the prose currently only asks for. Chapter 3 hands those tools back, so the case for it weakens as the curriculum advances — decide before Chapter 3 lands whether it is worth building at all.
3. **Deferred follow-on from §12.3:** compile the source in the idle worker on every edit (debounced) to get the exact executable-line set, so breakpoints that can never fire are drawn hollow — and, the real prize, **inline syntax errors** as a side effect. Worth doing as its own feature rather than as part of the refactor.

Follow the conventions from Chapter 1 throughout: 2-space indentation in student-facing code, `persistenceKey`-based persistence (`"<chapter>/<lesson>/<exercise>"`), TDD per `AGENTS.md`.

`GraphicsEnvironment` remains follow-on work for Chapters 8–10.

---

## Chapter 3: Variables & Types — ✅ Complete

Lessons live under `src/routes/3/`, with the `variablesAndTypes` `Chapter` entry in `src/lib/curriculum/index.ts`.

| Lesson | Title                | Exercises | Teaches                                                                                                                                                                           | Status      |
| ------ | -------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 3.1    | Variables            | 3         | A name is a label on a value, not a box; the right side runs first; `NameError`; naming rules and `snake_case`; two names, one value                                              | ✅ Authored |
| 3.2    | Integers & Floats    | 3         | `int` vs `float`; `type()`; why `/` always gives a float; float imprecision and counting in whole numbers; unlimited ints                                                         | ✅ Authored |
| 3.3    | Strings              | 3         | `str` as a sequence; `len()`; index positions from nought; negative indexes; `IndexError`; immutability; `+` and `*` explained                                                    | ✅ Authored |
| 3.4    | Booleans & Decisions | 3         | `bool` as a type; the six comparison operators; `=` vs `==`; string/float/text-vs-number comparison traps; `not` earning its keep; conditions stored in names; `if`/`elif`/`else` | ✅ Authored |
| 3.5    | Loops That Ask       | 3         | `while` with real conditions; zero-trip loops; the loop-and-a-half; `while True:` + `break`; the 1.4 infinite-loop warning revisited; `continue` in passing; validation loops     | ✅ Authored |
| 3.6    | Type Conversion      | 3         | Conversion builds a new value; `int()` chopping vs `round()`; `ValueError` and what an `if` can and cannot guard; `str()` never fails; truthiness and `if name:`                  | ✅ Authored |
| 3.7    | Constants & Style    | 3         | Magic numbers; `UPPER_CASE` constants Python does not enforce; PEP 8 basics; comments that say why                                                                                | ✅ Authored |
| 3.8    | Putting It Together  | 3         | Capstone — crew register, ration calculator, voyage log; sentinel-before-conversion; tracking best-so-far; guarding the empty case                                                | ✅ Authored |

**Control flow comes back in Chapter 3, across two lessons — 3.4 and 3.5 — and the chapter runs to eight.**

Chapter 2 promises, in 2.1, 2.4 and twice in 2.5, that Chapter 3 brings `if`, `else` and `while` back. The original seven-lesson plan had no lesson for them: it gave the comparison and logical operators a home (3.4 Booleans) but never spent them, and Chapter 4 is Functions. Inserting a chapter was rejected as too expensive — Chapter 2's prose names Chapters 4, 5 and 9 by number — so Chapter 3 grew instead.

**Why it is two lessons and not one.** The control flow itself is a **reintroduction, not new teaching**: 1.4 taught `while` and the sensors, 1.6 taught `if`, `else`, `elif` and `and`/`or`/`not`, including combining conditions to recognise situations. Students have written all of that. What is genuinely new is narrow — that `True` and `False` are **values** of a type you can hold and print (Karel's sensors returned them; you never kept one), and the six comparison operators that make booleans out of ordinary data. On its own that folds into one lesson. Adding `break` is what tips it over, so the two halves split cleanly:

- **3.4 Booleans & Decisions** — `True`/`False` as values, the six comparison operators, `==` vs `=`, `and`/`or`/`not`, `if`/`elif`/`else`.
- **3.5 Loops That Ask** — `while` with real conditions, `while True:` with `break`, the loop-and-a-half, input validation.

**`break` lives in 3.5, and this is where it enters the curriculum at all** — Chapter 1 never mentions it and nothing anywhere promises it, so there is no debt to pay, only a placement. It goes here because its canonical motivation is the loop-and-a-half (a sentinel loop that must ask before it can test, so without `break` the `input()` line has to be written twice), and that construction needs exactly `while`, `True`, `if` and `==` — all of them Chapter 3 material and none of them available earlier. It also pays off 3.4's headline idea: `while True:` only stops reading as a magic incantation once you know `True` is an ordinary value.

> **3.5 must revisit Lesson 1.4's infinite-loop warning explicitly.** 1.4 teaches infinite loops as a bug and closes with "does the loop body make progress toward the condition becoming false?" — a test `while True:` fails by design. Say so out loud: the loop is correct precisely because something inside it can escape. Leaving that unsaid contradicts Chapter 1 without acknowledging it.

**`continue` gets one short paragraph in 3.5 and no exercise.** Students meet it in other people's code and should know the name, but every use of it can be written as an `if`, so it does not earn practice time the way `break` does.

Numbering after the split: 3.6 Type Conversion, 3.7 Constants & Style, 3.8 Putting It Together. Cross-references already written into 3.1 and 3.2 point at 3.3 (strings) and 3.4 (`==`), both of which are unmoved by the split.

**Decisions already made:**

- **The label model, not the box model.** 3.1 teaches a variable as a label stuck on a value, because that is the model that still works in Chapter 6 when a value can be mutated from underneath a name. The lesson says so explicitly and points at the visualizer's arrows as the thing that will make it visible.
- **Chapter 2's `int()`/`str()` habits carry over unchanged.** 3.1's exercises still wrap `input()` in `int()` and still put a blank `print()` after every prompt, so the transcripts stay consistent with Chapter 2's.
- **3.2 spends its budget on types, not arithmetic.** Chapter 2.4 already taught `+ - * / // % **`, precedence, `int()`, `float()`, `str()` and `round()`. 3.2 therefore re-covers none of it as arithmetic; it re-covers `/` and `//` as a question about **which type comes back**, and pays off the `.0` that 2.4 explicitly deferred to this chapter.
- **Float imprecision is taught with the real transcript, not a summary.** 3.2's Exercise 2 makes students copy `0.30000000000000004` and `0.7999999999999999` out of a ten-step running total, because the non-monotonic pattern (wrong at step 3, right at step 4, wrong at step 8) is the thing that makes "each value is just the nearest float" believable.

---

## Chapter 2: Hello, Python! — ✅ Complete

Five lessons under `src/routes/2/`, plus the `helloPython` `Chapter` entry in `src/lib/curriculum/index.ts`.

| Lesson | Title                     | Exercises | Teaches                                                                                                           |
| ------ | ------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------- |
| 2.1    | From Karel to Python      | 2         | What carries over; state lives in memory now; the loop variable `i` finally explained; the environment's controls |
| 2.2    | Your First Python Program | 3         | String literals, quote choice, commas vs `+`, `"=" * 24`, blank `print()`                                         |
| 2.3    | Getting Input             | 3         | `input()` blocks and hands text back; `=` keeps it; **everything `input()` returns is text**                      |
| 2.4    | Expressions & Math        | 4         | Seven operators, `/` vs `//` vs `%`, precedence, `int()`/`float()`/`str()`, the accumulator, arithmetic on `i`    |
| 2.5    | Putting It Together       | 3         | Mission Control — crew manifest, fuel check, launch sequence; plus finding a bug with breakpoints                 |

**Pedagogical decisions worth not re-litigating:**

- **`for i in range(n)` is in scope; `if` and `while` are not.** The `for` loop carries over from Lesson 1.5 unchanged, and arithmetic on `i` is what makes the exercises non-trivial. Branching needs comparison operators, which belong to Chapter 3.4 — so Chapter 2 is deliberately straight-line. Lesson 2.1 tells students this explicitly, with the schedule for when each tool returns, and 2.5 repeats it.
- **Every exercise states an exact expected transcript**, and that transcript is now literally the test: `exercise-fixtures.ts` holds it once, the lesson prints it, and `testsFor(key)` hands it to the environment. Comparison ignores trailing spaces but not blank lines, and prompt wording counts — see `PythonInterpreterDesign.md` §13.2.
- **The blank `print()` after every `input()`** is taught as a habit in 2.3 with the real reason given (no echo in this environment, unlike a terminal). Exercise transcripts assume it.
- **`str()` earns a subsection in 2.4** because two exercises need `"Day " + str(n) + ":"` — a number pressed against punctuation is the one job a comma cannot do. Flagged in-lesson as something f-strings fix in Chapter 5.

All sixteen reference solutions (fifteen exercises plus one extra edge case) were executed against the stated transcripts and match — and stay matching: `tests/python.test.ts` runs every one of them in a real browser and requires it to pass its own exercise's tests.

---

## Chapter 1: Karel the Robot — ✅ Complete

Fully implemented (Phase 4 complete: progress tracking, code persistence, exercise completion) and
**curriculum/quality reviewed across all 7 lessons (26 exercises) as of 2026-08-29** — pedagogy,
prose, examples, and exercise wording. The chapter is closed; reopen only for bug fixes or if later
chapters reuse Karel exercises. The detailed implementation record — component architecture, Pyodide integration, step-through execution design, error handling, world editing, file structure, dependencies, code patterns, and troubleshooting notes — has been moved to **[CHAPTER_1_PROGRESS.md] (CHAPTER_1_PROGRESS.md)** to keep this document lean. Read that file if revisiting/extending Chapter 1, reusing Karel exercises in later chapters, or looking for implementation patterns to reuse when building `PythonEnvironment`.

---

## Future Work Reference

For the full roadmap beyond Chapter 1 (all remaining chapters, lesson topics, capstones, and design principles), see **[CURRICULUM_DESIGN.md](CURRICULUM_DESIGN.md)** — that document is the single source of truth for curriculum planning. This document (`PROGRESS.md`) should be updated as each chapter/module reaches completion; see the **What's Next** section near the top for the immediate priority (Chapter 2 lessons).

---

**End of Progress Report**
