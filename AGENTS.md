# Agent Instructions

This document provides high-level guidance for AI assistants working on this Karel learning environment project.

## Project Overview

This is a web-based Karel programming environment built with SvelteKit, allowing users to learn Python through Karel the Robot. The application runs Python code in the browser using Pyodide.

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

- Maintain educational focus (teaching programming concepts)
- Keep UI intuitive for beginners
- Ensure Python execution is sandboxed and safe
- Refer to `KAREL_DESIGN.md` for detailed design decisions

## Common Tasks

### Adding New Karel Commands

1. Update Karel command definitions in `src/lib/karel/types.ts`
2. Implement command logic in the Karel engine
3. Update documentation and examples

### Modifying the World Grid

1. Changes likely in `KarelWorld.svelte` for rendering
2. Update world state management logic
3. Consider backward compatibility with existing worlds

### UI Changes

1. Use Tailwind utility classes
2. Maintain responsive design
3. Test across different screen sizes

## Important Notes

- **Python Execution**: All Python code runs client-side via Pyodide
- **State Management**: Svelte stores for reactive state
- **Documentation**: Keep `README.md` updated with user-facing changes
- **Progress Tracking**: Update `PROGRESS.md` when completing major features

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
