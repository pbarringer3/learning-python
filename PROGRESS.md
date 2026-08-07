# Implementation Progress

This document tracks the overall implementation status of the Learning Python curriculum — what's built, what's in flight, and what's next. For the full curriculum plan (all chapters, lesson topics, design principles), see **[CURRICULUM_DESIGN.md](CURRICULUM_DESIGN.md)** — this doc does not duplicate that planning content, only implementation status.

---

## Project Status Overview

| Chapter | Title                                                                                                                                                    | Status                                    |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1       | Karel the Robot                                                                                                                                          | ✅ Complete (see `CHAPTER_1_PROGRESS.md`) |
| 2       | Hello, Python!                                                                                                                                           | 🚧 Not started — **next up**              |
| 3+      | Variables & Types, Functions, Strings, Lists, Dictionaries, Graphics, Classes, Building a Game, Files & Exceptions, Recursion, Searching & Sorting, etc. | 📋 Planned — see `CURRICULUM_DESIGN.md`   |

**Cross-cutting infrastructure status:**

- ✅ Curriculum data model (`Chapter`/`Lesson` types, progress store, lesson routing) — chapter-agnostic, ready to extend for Chapter 2+
- ✅ Site shell (`LessonShell`, `NavDrawer`, `TopBar`) — reusable across chapters
- ✅ `KarelEnvironment` — interactive environment for Chapter 1 (and any later Karel practice in later chapters)
- ❌ **`PythonEnvironment`** — general-purpose Python code editor + output/`input()` sandbox needed for Chapter 2 onward. **Does not exist yet — this is the next major piece of infrastructure to build.**
- ❌ **Call Stack Visualizer** — planned per `CURRICULUM_DESIGN.md` for showing variable/frame state step-by-step in non-Karel Python lessons. Not started.
- ❌ `GraphicsEnvironment` — needed for Chapters 8–10. Not started (library TBD).

---

## What's Next

The immediate priority is standing up the **Python Environment and sandbox**, since Chapter 2 ("Hello, Python!") and every subsequent Part 1/Part 2 chapter depend on it:

1. **General-purpose Pyodide execution utility** — extend/generalize `src/lib/karel/pyodide.ts` (or create a parallel `src/lib/python/pyodide.ts`) to run arbitrary Python: support `print()` output capture and `input()` (likely via a queued/mocked stdin fed from a UI prompt). **Default behavior should allow full standard Python syntax** (unrestricted by default, unlike Karel's playground) — but generalize the AST-based validator pattern from `validateKarelCode` into an opt-in, per-exercise allow/deny-list mechanism (e.g. an `allowedFeatures` option on a `PythonConfig`, mirroring `KarelConfig.allowedFeatures.karelCommands`) so individual lessons can restrict students to only the syntax taught so far when needed (e.g. disallow `for` loops before loops are formally introduced). _(Note: this default-open-but-restrictable design is not yet decided — confirm with the user before building.)_
2. **`PythonEnvironment` Svelte component** — analogous to `KarelEnvironment`: code editor (reuse `KarelCodeEditor` or generalize it into a shared `CodeEditor`), output console, Run button, and (for exercises) a test/validation mechanism — likely checking captured stdout and/or return values rather than Karel world state.
3. **Sandbox route** — `/python/playground`, an open-ended scratchpad mirroring `/karel/playground`, per `CURRICULUM_DESIGN.md`'s "Python Environment" spec.
4. **Chapter 2 lessons** — once the environment exists, author the 5 lessons (`From Karel to Python`, `Your First Python Program`, `Getting Input`, `Expressions & Math`, capstone) as `.svx` files under `src/routes/2/`, plus add the `Chapter` entry to `src/lib/curriculum/index.ts`.
5. Follow the same conventions established in Chapter 1: 2-space indentation in student-facing code, `persistenceKey`-based code/progress persistence, TDD (write tests first per `AGENTS.md`).

The Call Stack Visualizer and Graphics Environment are follow-on work after Chapter 2 is solid — not blocking, but worth keeping in mind when designing `PythonEnvironment` so it can be extended (e.g., a hook point for frame/variable inspection) rather than needing a rewrite later.

---

## Chapter 1: Karel the Robot — ✅ Complete

Fully implemented (Phase 4 complete: progress tracking, code persistence, exercise completion). The detailed implementation record — component architecture, Pyodide integration, step-through execution design, error handling, world editing, file structure, dependencies, code patterns, and troubleshooting notes — has been moved to **[CHAPTER_1_PROGRESS.md] (CHAPTER_1_PROGRESS.md)** to keep this document lean. Read that file if revisiting/extending Chapter 1, reusing Karel exercises in later chapters, or looking for implementation patterns to reuse when building `PythonEnvironment`.

---

## Future Work Reference

For the full roadmap beyond Chapter 1 (all remaining chapters, lesson topics, capstones, and design principles), see **[CURRICULUM_DESIGN.md](CURRICULUM_DESIGN.md)** — that document is the single source of truth for curriculum planning. This document (`PROGRESS.md`) should be updated as each chapter/module reaches completion; see the **What's Next** section near the top for the immediate priority (the Python Environment and sandbox).

---

**End of Progress Report**
