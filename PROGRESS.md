# Implementation Progress

This document tracks the overall implementation status of the Learning Python curriculum — what's built, what's in flight, and what's next. For the full curriculum plan (all chapters, lesson topics, design principles), see **[CURRICULUM_DESIGN.md](CURRICULUM_DESIGN.md)** — this doc does not duplicate that planning content, only implementation status.

---

## Project Status Overview

| Chapter | Title                                                                                                                                                    | Status                                                             |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1       | Karel the Robot                                                                                                                                          | ✅ Complete — built + reviewed (see `CHAPTER_1_PROGRESS.md`)       |
| 2       | Hello, Python!                                                                                                                                           | ✅ Authored — 5 lessons, 15 exercises; completion tracking pending |
| 3+      | Variables & Types, Functions, Strings, Lists, Dictionaries, Graphics, Classes, Building a Game, Files & Exceptions, Recursion, Searching & Sorting, etc. | 📋 Planned — see `CURRICULUM_DESIGN.md`                            |

**Cross-cutting infrastructure status:**

- ✅ Curriculum data model (`Chapter`/`Lesson` types, progress store, lesson routing) — chapter-agnostic, ready to extend for Chapter 2+
- ✅ Site shell (`LessonShell`, `NavDrawer`, `TopBar`) — reusable across chapters
- ✅ `KarelEnvironment` — interactive environment for Chapter 1 (and any later Karel practice in later chapters)
- ✅ **`PythonEnvironment` + Call Stack Visualizer** — built as one piece, not two. The stepping engine (Pyodide in a Web Worker, paused via `SharedArrayBuffer` + `Atomics`) is what gives blocking `input()` and streaming `print()` output their behaviour, so the environment and the visualizer share it. Sandbox lives at `/python/playground`. See **[PythonInterpreterDesign.md](PythonInterpreterDesign.md)** — §10 maps every concern to a file.
- ✅ **Python environment refactor (§12)** — controls, panel layout, and breakpoints, all eleven checklist items done. Panels are editor / output / controls with a fixed-height console and a 10–20 line editor; the control row is a combined ▶ Play / ■ Stop plus Step, To breakpoint, a show/hide-visualizer eye, and Reset code (Clear, Auto and the speed slider are gone). Breakpoints are set by clicking a line number, persist with the code, and reach the worker through a shared-memory bitmap so one added mid-pause still fires. The final snapshot now stays on screen with a per-ending banner, synthesised from the surviving globals or from the traceback so plain Play keeps its no-tracer fast path. `PythonConfig.showVisualizer` is now the _initial_ state only — the student's own choice persists per exercise.
- ❌ `GraphicsEnvironment` — needed for Chapters 8–10. Not started (library TBD).

**Deferred on purpose** (`PythonConfig` is shaped so both are additive, not a rewrite):

- `allowedFeatures` — an opt-in AST allowlist so a lesson can forbid syntax it hasn't taught yet, generalizing Karel's `validate_karel_code`. Python runs **unrestricted** today.
- `tests` — per-exercise validation (captured stdout, etc.). Both are waiting on real Chapter 2 lessons to design against rather than being guessed at.

---

## What's Next

Chapter 2 is authored — five lessons, fifteen exercises, live at `/2/1` through `/2/5`. What it does **not** have is completion tracking: `PythonEnvironment` never calls `progressStore.markExerciseCompleted`, because `PythonConfig` has no `tests` field. Chapter 2 lessons therefore persist code, breakpoints and visualizer state, but never turn ✅. That is the top of the list.

1. **Per-exercise `tests` for `PythonEnvironment`** — the deferral recorded below, now designed against real exercises instead of guesses. Every Chapter 2 exercise was written to a **precise stdout contract** (the "sample run" transcript in each lesson is the spec), so the shape wanted is captured stdout compared against expected output, with queued answers standing in for `input()`. Note two wrinkles the transcripts already encode: `input()` writes its prompt to stdout with no trailing newline (`tracer.py` `_input`), and the typed answer is never echoed — which is why every lesson tells students to follow an `input()` with a bare `print()`. Once this exists, wire `markExerciseCompleted` the way `KarelEnvironment.svelte` does (search `allPassed`), and `exerciseCount` in the curriculum index starts meaning something for Chapter 2.
2. **Revisit `allowedFeatures`** — less urgent than `tests`. Chapter 2 holds back `if`/`while`/comparisons on purpose and says so in the lesson text; an AST allowlist would enforce what the prose currently only asks for.
3. **Deferred follow-on from §12.3:** compile the source in the idle worker on every edit (debounced) to get the exact executable-line set, so breakpoints that can never fire are drawn hollow — and, the real prize, **inline syntax errors** as a side effect. Worth doing as its own feature rather than as part of the refactor.
4. **Chapter 3: Variables & Types** — seven lessons per `CURRICULUM_DESIGN.md`. This is the chapter Chapter 2 keeps promising: it delivers comparison operators and booleans, which is what brings `if`, `else` and `while` back. Chapter 2's closing sections make specific promises about what Chapter 3 covers; keep them.

Follow the conventions from Chapter 1 throughout: 2-space indentation in student-facing code, `persistenceKey`-based persistence (`"<chapter>/<lesson>/<exercise>"`), TDD per `AGENTS.md`.

`GraphicsEnvironment` remains follow-on work for Chapters 8–10.

---

## Chapter 2: Hello, Python! — ✅ Authored (completion tracking pending)

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
- **Every exercise states an exact expected transcript** rather than being auto-graded. This is what makes the missing `tests` feature tolerable, and it is also the spec for building it.
- **The blank `print()` after every `input()`** is taught as a habit in 2.3 with the real reason given (no echo in this environment, unlike a terminal). Exercise transcripts assume it.
- **`str()` earns a subsection in 2.4** because two exercises need `"Day " + str(n) + ":"` — a number pressed against punctuation is the one job a comma cannot do. Flagged in-lesson as something f-strings fix in Chapter 5.

All sixteen reference solutions (fifteen exercises plus one extra edge case) were executed against the stated transcripts and match.

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
