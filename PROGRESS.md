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
- ✅ **`PythonEnvironment` + Call Stack Visualizer** — built as one piece, not two. The stepping engine (Pyodide in a Web Worker, paused via `SharedArrayBuffer` + `Atomics`) is what gives blocking `input()` and streaming `print()` output their behaviour, so the environment and the visualizer share it. Set `showVisualizer: false` on a `PythonConfig` for lessons that only want editor + output. Sandbox lives at `/python/playground`. See **[PythonInterpreterDesign.md](PythonInterpreterDesign.md)** — §10 maps every concern to a file.
- ❌ `GraphicsEnvironment` — needed for Chapters 8–10. Not started (library TBD).

**Deferred on purpose** (`PythonConfig` is shaped so both are additive, not a rewrite):

- `allowedFeatures` — an opt-in AST allowlist so a lesson can forbid syntax it hasn't taught yet, generalizing Karel's `validate_karel_code`. Python runs **unrestricted** today.
- `tests` — per-exercise validation (captured stdout, etc.). Both are waiting on real Chapter 2 lessons to design against rather than being guessed at.

---

## What's Next

The Python environment and sandbox are done, so **Chapter 2 ("Hello, Python!") is now unblocked** and is the immediate priority:

1. **Chapter 2 lessons** — author the 5 lessons (`From Karel to Python`, `Your First Python Program`, `Getting Input`, `Expressions & Math`, capstone) as `.svx` files under `src/routes/2/`, plus the `Chapter` entry in `src/lib/curriculum/index.ts`. Embed `PythonEnvironment` with a `PythonConfig`; use `showVisualizer: false` where the visualizer would be noise and `true` where watching state change is the lesson.
2. **Revisit the deferred `allowedFeatures` / `tests` design** once a few lessons exist — by then the shape of "check this exercise" will be evident from real exercises instead of guessed at.
3. Follow the conventions from Chapter 1: 2-space indentation in student-facing code, `persistenceKey`-based code persistence (`"<chapter>/<lesson>/<exercise>"`), TDD per `AGENTS.md`.

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
