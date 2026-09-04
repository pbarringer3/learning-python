# Agent Instructions

This document provides high-level guidance for AI assistants working on this project.

## Project Overview

**Learning Python** is a web-based interactive Python curriculum built with SvelteKit. The site teaches Python from the ground up — starting with Karel the Robot and progressing through all the fundamentals up to data structures and algorithms.

All Python code runs client-side in the browser via Pyodide (Python compiled to WebAssembly). There is no backend.

### Curriculum Structure

- **Chapter 1: Karel the Robot** — Students learn programming basics (functions, control flow) by writing Python to control a robot in a grid world. This is fully implemented.
- **Later chapters** — Will cover standard Python topics: variables, strings, data types, functions with parameters, lists, dictionaries, loops, classes, recursion, data structures and algorithms, etc.
- **Karel mixed in later** — Karel exercises appear in later chapters as practice for new concepts (e.g., using Karel to practice loops or functions with parameters).

### Interactive Modules

The site includes specialized interactive modules for teaching:

- **Karel Environment** — Grid-based robot world with code editor, execution controls, and animated step-through. Fully implemented.
- **Python Environment + Call Stack Visualizer** — Code editor, output console, blocking `input()`, and a side panel showing the call stack and heap objects (with arrows for aliasing) as the program runs, one line at a time. Fully implemented; open sandbox at `/python/playground`.
- More modules may be added as the curriculum expands.

## Technology Stack

- **Framework**: SvelteKit (TypeScript)
- **Styling**: Tailwind CSS
- **Python Runtime**: Pyodide (browser-based Python)
- **Build Tool**: Vite
- **Testing**: Vitest (unit) and Playwright (e2e)

## Commands

```bash
npm run dev            # Start dev server (Vite, port 5173)
npm run build          # Production build (adapter-static -> build/, for GitHub Pages)
npm run preview        # Preview production build
npm run check          # svelte-kit sync + svelte-check (TypeScript/Svelte type checking)
npm run lint           # prettier --check + eslint
npm run format         # prettier --write
npm test               # Full suite: vitest run + playwright test
npm run test:unit      # Vitest only (unit tests, src/**/*.test.ts)
npm run test:e2e       # Playwright only (e2e tests, tests/*.test.ts)
```

Running a single test:

```bash
npx vitest run src/lib/karel/types.test.ts   # single Vitest file
npx vitest run -t "test name"                # by test name
npx playwright test tests/karel.test.ts      # single Playwright file
npx playwright test --project=chromium       # one browser only (chromium or webkit)
```

Playwright's webServer config auto-starts `npm run dev` if it isn't already running (see `playwright.config.ts`).

## Architecture

### Routing and the curriculum data model

- `src/lib/curriculum/index.ts` is the single source of truth for chapters/lessons (`chapters` array). `src/lib/curriculum/types.ts` defines the `Chapter`/`Lesson` shapes and helpers (`progressKey`, `lessonPath`, `getChapterStatus`, etc.).
- Lesson content lives at `src/routes/<chapterNumber>/<lessonNumber>/+page.svx` (MDsveX: markdown + embedded Svelte components), e.g. `src/routes/1/1/+page.svx` for Chapter 1, Lesson 1.
- `src/routes/[chapter]/[lesson]/+page.svelte` is a dynamic fallback that renders a placeholder for any lesson number listed in the curriculum data that doesn't yet have a dedicated `.svx` file. `handleUnseenRoutes: 'warn'` in `svelte.config.js` allows this route to exist without prerenderable instances.
- Every `.svx` lesson wraps its content in `<LessonShell chapterNumber={N} lessonNumber={N}>`, which resolves lesson metadata from the curriculum data and renders prev/next navigation.
- `npm run build` uses `adapter-static`, deployed to GitHub Pages under the `/learning-python` base path (see `paths.base` in `svelte.config.js`, only applied when `NODE_ENV=production`).

### Karel engine

- `src/lib/karel/types.ts` defines the world model (`KarelWorld`, `Position`, `Direction`, `Wall`, `BeeperLocation`) and the `KarelConfig` shape used to embed a Karel environment in a lesson (initial world, initial code, `allowedFeatures` restrictions, `tests`, `persistenceKey`).
- `src/lib/karel/pyodide.ts` bridges Python (via Pyodide) and the Karel UI:
  - Karel commands (`move`, `turn_left`, `pick_beeper`, `put_beeper`, and sensor functions like `front_is_clear`) are injected into the Pyodide global namespace as JS callbacks (`injectKarelCommands`), so the app owns all world-state mutation — Python only calls into it.
  - **`loadPyodide()` loads Pyodide from a CDN `<script>` tag, not from the `pyodide` npm package.** The npm `pyodide` dependency is used only for its TypeScript types (`PyodideInterface`). The version is pinned once, in `PYODIDE_VERSION` / `PYODIDE_INDEX_URL` (`src/lib/python/config.ts`), and shared by Karel and the Python worker so a student who visits both downloads one runtime. The CDN version is authoritative for runtime behavior; keep the npm dependency in step with it.
  - The script tag sets `crossOrigin = 'anonymous'`. This is required, not cosmetic: once the isolation service worker is active the whole site runs under `COEP: require-corp`, which blocks an opaque cross-origin script.
  - `installCodeValidator` installs a Python AST-based validator (`validate_karel_code`) that allowlists syntax per exercise (e.g. no imports, no variable assignment except loop vars, no parameters) — this is what enforces `allowedFeatures` on student code before it's allowed to run.
- `KarelEnvironment.svelte` is the top-level reusable component (used in both lessons and `/karel/playground`) that owns execution state, wires the code editor/world/controls/output subcomponents together, and persists student code to `localStorage` (keyed by `KarelConfig.persistenceKey`, convention `"<chapter>/<lesson>/<exercise>"`).
- Exercises validate success via `KarelTests` (`src/lib/karel/types.ts`): a `validate(world)` function checks final world state, with optional `validateCode` (source-level checks) and `functionTests` (call one named student function in isolation against a specific world).

### Python engine and call stack visualizer

- `src/lib/python/` holds the engine. `PythonInterpreterDesign.md` §10 maps every concern to its file; read that before changing any of it.
- **Execution runs in a Web Worker** (`worker.ts`), not on the main thread, because pausing is the whole point. The worker blocks in `Atomics.wait` on a `SharedArrayBuffer` until the UI issues a command. `postMessage` _into_ the worker is useless while it is blocked — that is why commands go through shared memory and only snapshots come back over `postMessage`.
- `tracer.py` is real Python, imported into the worker with `?raw` and written to Pyodide's virtual filesystem as a module, so its names never reach the namespace the student's code runs in. It uses `sys.settrace` with a **per-frame** `co_filename` check, and serializes state into an `id()`-keyed heap so aliasing is visible.
- Constants are declared in both languages (`protocol.ts` and `tracer.py`). `tracer.test.ts` pins the two copies together — a mismatch would show up as a silently ignored Stop, not a type error.
- **`SharedArrayBuffer` requires a cross-origin isolated document.** In dev/preview the headers come from the `crossOriginIsolation` plugin in `vite.config.ts` (middleware, because SvelteKit's dev handler ignores Vite's `server.headers`). In production they come from `static/coi-serviceworker.js`, registered **lazily from Python routes only** (`coi.ts`) so Karel and landing-page visitors never see the one-time bootstrap reload. There is no degraded fallback: a browser that can't isolate gets a clear message.
- **Never hand `TextEncoder`/`TextDecoder` a view over a `SharedArrayBuffer`** — browsers reject it, Node does not, so it passes unit tests and fails in the browser. `protocol.ts` copies through a private scratch buffer; `protocol.test.ts` guards it.
- `PythonEnvironment.svelte` is the embeddable component (the Python counterpart to `KarelEnvironment`), configured by a `PythonConfig`. Python is **unrestricted** by default; the opt-in `allowedFeatures` allowlist and per-exercise `tests` are deliberately deferred — see `PROGRESS.md`.

### Shared components

- `CodeEditor.svelte` (formerly `KarelCodeEditor.svelte`) is the CodeMirror editor shared by both environments. Indentation is fixed at two spaces to match the curriculum's student-facing code convention.

### Progress tracking

- `src/lib/curriculum/progress.ts` is a Svelte store backed by `localStorage` (key `learning-python-progress`, schema `version` field for future migrations). Must call `progressStore.hydrate()` client-side (done in the root layout's `onMount`) before any writes take effect.
- Lesson/exercise completion keys use `progressKey(chapterNumber, lessonNumber)` → `"<chapter>/<lesson>"`, matching the route and persistence-key convention above.

## Development Guidelines

### Code Style

- Follow TypeScript best practices
- Use Svelte's reactive declarations (`$:`) appropriately
- Keep components focused and modular
- Format code with `npm run format` before committing
- All student-facing Python code (in `initialCode` and markdown code blocks) must use **2-space indentation** — enforced by `lesson-style.test.ts`

### File Organization

- Routes: `src/routes/` (SvelteKit file-based routing)
- Components: `src/lib/components/`
- Karel logic: `src/lib/karel/`
- Build output: `build/` (not tracked in git)

### Testing

- Write unit tests (Vitest) alongside the code as `*.test.ts` in `src/lib/`; write e2e tests (Playwright) in `tests/`
- Run tests with `npm test` (see Commands above for running individual test files)
- Any time you are asked to add or change functionality you should use a red/green TDD approach.
- **Anything touching Pyodide, workers, or shared memory needs an e2e test.** Vitest runs in Node, where there is no interpreter, no real worker, and where shared-memory APIs are more permissive than a browser's — several real bugs in the Python engine passed unit tests and only failed in Chromium. `tests/python.test.ts` seeds the editor through `localStorage` rather than typing into CodeMirror, since auto-indent would otherwise mangle multi-line Python.

### Design Principles

- Maintain educational focus — this is a full Python curriculum, not just a Karel tool
- Keep UI intuitive for beginners
- Ensure Python execution is sandboxed and safe
- Design components to be reusable across different lesson types
- Refer to `KAREL_DESIGN.md` for Karel-specific design decisions

## Common Tasks

### Karel-Specific Tasks

#### Adding New Karel Commands

1. Update Karel command definitions in `src/lib/karel/types.ts`
2. Implement command logic in the Karel engine
3. Update documentation and examples

#### Modifying the World Grid

1. Changes likely in `KarelWorld.svelte` for rendering
2. Update world state management logic
3. Consider backward compatibility with existing worlds

### General Tasks

#### Adding New Lesson Content

1. Lessons use MDsveX (Markdown + Svelte components)
2. Interactive environments are embedded as Svelte components within lesson content
3. Karel lessons use `KarelEnvironment` component; future lessons will have their own interactive components
4. See `LESSON_AUTHORING_GUIDE.md` for details

#### Adding New Interactive Modules

1. Create module logic in `src/lib/<module-name>/`
2. Create reusable Svelte components in `src/lib/components/`
3. Follow the same patterns as the Karel module (configurable, embeddable, testable)
4. Add a design document (`<MODULE>_DESIGN.md`) for non-trivial modules

#### UI Changes

1. Use Tailwind utility classes
2. Maintain responsive design
3. Test across different screen sizes

## Important Notes

- **Python Execution**: All Python code runs client-side via Pyodide
- **State Management**: Svelte stores for reactive state
- **Documentation**: Keep `README.md` updated with user-facing changes
- **Progress Tracking**: Update `PROGRESS.md` when completing major features
- **Scope**: Karel is Chapter 1 — the project scope is a full Python curriculum

## Key Documentation

- `README.md` — Project overview and user-facing information
- `SITE_DESIGN.md` — Overall site design (layout, navigation, landing page, progress tracking)
- `KAREL_DESIGN.md` — Design decisions for the Karel module
- `PythonInterpreterDesign.md` — Design decisions for the Python engine and call stack visualizer
- `LESSON_AUTHORING_GUIDE.md` — How to author lessons (Karel and beyond)
- `PROGRESS.md` — Implementation progress tracking

## Version Control

- **Never run `git commit`, `git add`, (or any command that creates a commit) unless explicitly asked to.** The user handles all commits themselves. Showing diffs is fine if helpful, but leave the actual commits and staging to the user.

## Starting a Session

If the user opens a session asking something like **"what's next"**, **"what should we work on"**, or similar, read `PROGRESS.md` (especially the "Project Status Overview" and "What's Next" sections) and summarize the current project status and recommended next steps based on it. Don't just repeat the doc verbatim — briefly confirm it's still accurate against the codebase if quick to check, then present the next steps clearly.

## Questions or Clarifications

If project requirements are unclear:

1. Check existing documentation (`README.md`, `KAREL_DESIGN.md`, `PROGRESS.md`)
2. Examine similar existing implementations in the codebase
3. Ask the user for clarification when necessary
4. All questions should be asked one at a time.
5. Never use the 'ask-user' tool. Always ask questions in plain text. The tool is terrible from a user-experience perspective.
