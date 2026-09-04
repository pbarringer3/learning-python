# Implementation Progress

This document tracks the overall implementation status of the Learning Python curriculum — what's built, what's in flight, and what's next. For the full curriculum plan (all chapters, lesson topics, design principles), see **[CURRICULUM_DESIGN.md](CURRICULUM_DESIGN.md)** — this doc does not duplicate that planning content, only implementation status.

---

## Project Status Overview

| Chapter | Title                                                                                                                                                    | Status                                                       |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1       | Karel the Robot                                                                                                                                          | ✅ Complete — built + reviewed (see `CHAPTER_1_PROGRESS.md`) |
| 2       | Hello, Python!                                                                                                                                           | 🚧 Not started — **next up**                                 |
| 3+      | Variables & Types, Functions, Strings, Lists, Dictionaries, Graphics, Classes, Building a Game, Files & Exceptions, Recursion, Searching & Sorting, etc. | 📋 Planned — see `CURRICULUM_DESIGN.md`                      |

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

The environment refactor is done, so the Python environment is feature-complete for authoring against. Chapter 2 is the priority.

1. **Chapter 2 lessons** — author the 5 lessons (`From Karel to Python`, `Your First Python Program`, `Getting Input`, `Expressions & Math`, capstone) as `.svx` files under `src/routes/2/`, plus the `Chapter` entry in `src/lib/curriculum/index.ts`. Embed `PythonEnvironment` with a `PythonConfig`; use `showVisualizer: false` where the visualizer would be noise on first arrival and `true` where watching state change is the lesson, and set `editorLines` where an exercise wants a taller or shorter editor than the 20-line default.
2. **Revisit the deferred `allowedFeatures` / `tests` design** once a few lessons exist — by then the shape of "check this exercise" will be evident from real exercises instead of guessed at.
3. **Deferred follow-on from §12.3:** compile the source in the idle worker on every edit (debounced) to get the exact executable-line set, so breakpoints that can never fire are drawn hollow — and, the real prize, **inline syntax errors** as a side effect. Worth doing as its own feature rather than as part of the refactor.

Follow the conventions from Chapter 1 throughout: 2-space indentation in student-facing code, `persistenceKey`-based persistence (`"<chapter>/<lesson>/<exercise>"`), TDD per `AGENTS.md`.

`GraphicsEnvironment` remains follow-on work for Chapters 8–10.

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
