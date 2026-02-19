# Learning Python

An interactive, web-based Python curriculum that teaches Python from the ground up — from Karel the Robot through data structures and algorithms.

All Python code runs directly in the browser via [Pyodide](https://pyodide.org/) (Python compiled to WebAssembly). No backend, no installation required.

## About

I'm a Software Engineer who comes from a background in education with over a decade of experience teaching Math and Computer Science. My educational philosophy and methods have been highly influenced by the Stanford CS106A course along with my time teaching for Art of Problem Solving. I hope you enjoy this site. It's been a labor of love.

## Curriculum

- **Chapter 1: Karel the Robot** — Learn programming fundamentals (functions, control flow, decomposition) by writing Python to control a robot in a grid world. _(Fully implemented)_
- **More chapters coming** — Variables, strings, data types, functions with parameters, lists, dictionaries, loops, classes, recursion, data structures and algorithms, and more.
- Karel exercises are mixed into later chapters as practice for new concepts.

## Interactive Modules

- **Karel Environment** — Grid-based robot world with code editor, execution controls, and animated step-through.
- **Call Stack Visualizer** _(planned)_ — Visualize the call stack and trace through Python code execution.

## Getting Started

```bash
npm install          # Install dependencies
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm test             # Run tests
```

## Technology

- **SvelteKit** (TypeScript) with Tailwind CSS
- **Pyodide** for client-side Python execution
- **Playwright** for testing
