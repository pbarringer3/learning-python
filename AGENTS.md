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
- **Call Stack Visualizer** (planned) — Will allow students to visualize the call stack and trace through regular Python code execution.
- More modules may be added as the curriculum expands.

## Technology Stack

- **Framework**: SvelteKit (TypeScript)
- **Styling**: Tailwind CSS
- **Python Runtime**: Pyodide (browser-based Python)
- **Build Tool**: Vite
- **Testing**: Playwright

## Development Guidelines

### Code Style

- Follow TypeScript best practices
- Use Svelte's reactive declarations (`$:`) appropriately
- Keep components focused and modular
- Format code with `npm run format` before committing

### File Organization

- Routes: `src/routes/` (SvelteKit file-based routing)
- Components: `src/lib/components/`
- Karel logic: `src/lib/karel/`
- Build output: `build/` (not tracked in git)

### Testing

- Write Playwright tests in `tests/`
- Run tests with `npm test`

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
- `LESSON_AUTHORING_GUIDE.md` — How to author lessons (Karel and beyond)
- `PROGRESS.md` — Implementation progress tracking

## Getting Started

```bash
npm install          # Install dependencies
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm test             # Run tests
```

## Questions or Clarifications

If project requirements are unclear:

1. Check existing documentation (`README.md`, `KAREL_DESIGN.md`, `PROGRESS.md`)
2. Examine similar existing implementations in the codebase
3. Ask the user for clarification when necessary
4. All questions should be asked one at a time.
