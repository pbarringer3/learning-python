# Lesson Authoring Guide

This guide explains how to create lessons for the Learning Python curriculum. Lessons use MDsveX (Markdown + Svelte components) and embed interactive environments for hands-on learning.

## Table of Contents

1. [Overview](#overview)
2. [Karel Lessons](#karel-lessons)
3. [Future: Non-Karel Lessons](#future-non-karel-lessons)
4. [Karel Basic Usage](#karel-basic-usage)
5. [Simple Examples](#simple-examples)
6. [Exercises with Feature Restrictions](#exercises-with-feature-restrictions)
7. [Single Test Exercises](#single-test-exercises)
8. [Multi-Test Exercises](#multi-test-exercises)
9. [Configuration Reference](#configuration-reference)

## Overview

The Learning Python curriculum is organized into chapters. Each chapter contains lessons written as MDsveX files with embedded interactive components.

- **Chapter 1 (Karel)** uses the `KarelEnvironment` component.
- **Later chapters** will introduce other interactive modules (e.g., a Call Stack Visualizer for tracing Python execution) alongside standard lesson content.
- **Karel exercises** may also appear in later chapters as practice for new concepts like loops or functions with parameters.

All interactive modules follow the same embedding pattern: import a Svelte component, configure it, and embed it in your MDsveX lesson file.

---

## Karel Lessons

The sections below cover authoring Karel-specific lessons. As new interactive modules are added, this guide will expand with module-specific sections following the same patterns.

### Karel Basic Usage

To embed a Karel environment in a lesson, import `KarelEnvironment` and provide a `KarelConfig` object:

```svelte
<script lang="ts">
  import KarelEnvironment from '$lib/components/KarelEnvironment.svelte';
  import type { KarelConfig } from '$lib/karel/types';

  const config: KarelConfig = {
    initialWorld: {
      dimensions: { width: 10, height: 10 },
      karel: {
        position: { x: 1, y: 1 },
        direction: { type: 'east' },
        beepers: 0
      },
      walls: [],
      beepers: []
    },
    initialCode: '# Your starting code here\n'
  };
</script>

<KarelEnvironment {config} />
```

## Simple Examples

Simple examples have no restrictions and no tests. Students can freely experiment:

```svelte
const simpleExample: KarelConfig = {
  initialWorld: {
    dimensions: { width: 5, height: 5 },
    karel: {
      position: { x: 1, y: 1 },
      direction: { type: 'east' },
      beepers: 0
    },
    walls: [],
    beepers: [{ x: 5, y: 1, count: 1 }]
  },
  initialCode: `# Pick up the beeper at (5,1)
move()
move()
move()
move()
pick_beeper()
`
};
```

## Exercises with Feature Restrictions

Restrict which Karel commands students can use by specifying `allowedFeatures.karelCommands`:

```svelte
const restrictedExercise: KarelConfig = {
  initialWorld: { /* ... */ },
  initialCode: `# Use only move(), turn_left(), and put_beeper()
`,
  allowedFeatures: {
    karelCommands: ['move', 'turn_left', 'put_beeper']
  }
};
```

### Available Karel Commands

- `move` - Move forward one cell
- `turn_left` - Turn 90° left
- `pick_beeper` - Pick up a beeper from current position
- `put_beeper` - Place a beeper at current position
- `front_is_clear` - Check if front is clear
- `front_is_blocked` - Check if front is blocked
- `beepers_present` - Check if beepers at current position
- `no_beepers_present` - Check if no beepers at current position
- `left_is_clear` - Check if left is clear
- `left_is_blocked` - Check if left is blocked
- `right_is_clear` - Check if right is clear
- `right_is_blocked` - Check if right is blocked
- `beepers_in_bag` - Check if Karel has beepers
- `no_beepers_in_bag` - Check if Karel has no beepers
- `facing_north` - Check if facing north
- `not_facing_north` - Check if not facing north
- `facing_south` - Check if facing south
- `not_facing_south` - Check if not facing south
- `facing_east` - Check if facing east
- `not_facing_east` - Check if not facing east
- `facing_west` - Check if facing west
- `not_facing_west` - Check if not facing west

## Single Test Exercises

Add automated testing with a validation function:

```svelte
const singleTestExercise: KarelConfig = {
  initialWorld: {
    dimensions: { width: 5, height: 5 },
    karel: {
      position: { x: 1, y: 1 },
      direction: { type: 'east' },
      beepers: 1
    },
    walls: [],
    beepers: []
  },
  initialCode: `# Place a beeper at (3,3)
`,
  allowedFeatures: {
    karelCommands: ['move', 'turn_left', 'put_beeper']
  },
  tests: {
    worlds: {
      'Main Test': {
        // Copy of initialWorld or a variation
        dimensions: { width: 5, height: 5 },
        karel: {
          position: { x: 1, y: 1 },
          direction: { type: 'east' },
          beepers: 1
        },
        walls: [],
        beepers: []
      }
    },
    validate: (world) => {
      const beeperAt33 = world.beepers.find((b) => b.x === 3 && b.y === 3);
      if (beeperAt33 && beeperAt33.count > 0) {
        return { passed: true, message: 'Perfect! Beeper placed at (3,3)' };
      }
      return { passed: false, message: 'Beeper not found at position (3,3)' };
    }
  }
};
```

## Multi-Test Exercises

Test student code against multiple scenarios with `loadableTests`:

```svelte
const multiTestExercise: KarelConfig = {
  initialWorld: {
    dimensions: { width: 6, height: 3 },
    karel: {
      position: { x: 1, y: 1 },
      direction: { type: 'east' },
      beepers: 20
    },
    walls: [],
    beepers: []
  },
  initialCode: `def fill_row():
    # Fill current row with beepers
    pass

fill_row()
`,
  allowedFeatures: {
    karelCommands: ['move', 'turn_left', 'put_beeper', 'front_is_clear', 'front_is_blocked']
  },
  tests: {
    worlds: {
      'Test 1: 6x3 Grid': {
        dimensions: { width: 6, height: 3 },
        karel: {
          position: { x: 1, y: 1 },
          direction: { type: 'east' },
          beepers: 20
        },
        walls: [],
        beepers: []
      },
      'Test 2: 4x3 Grid': {
        dimensions: { width: 4, height: 3 },
        karel: {
          position: { x: 1, y: 1 },
          direction: { type: 'east' },
          beepers: 15
        },
        walls: [],
        beepers: []
      },
      'Test 3: 8x2 Grid': {
        dimensions: { width: 8, height: 2 },
        karel: {
          position: { x: 1, y: 1 },
          direction: { type: 'east' },
          beepers: 20
        },
        walls: [],
        beepers: []
      }
    },
    validate: (world) => {
      const row1Count = world.beepers.filter((b) => b.y === 1).length;
      if (row1Count >= world.dimensions.width) {
        return { passed: true, message: 'All positions in first row have beepers!' };
      }
      return {
        passed: false,
        message: `Only ${row1Count} out of ${world.dimensions.width} positions filled`
      };
    },
    loadableTests: ['Test 1: 6x3 Grid', 'Test 2: 4x3 Grid', 'Test 3: 8x2 Grid']
  }
};
```

## Configuration Reference

### KarelConfig Interface

```typescript
interface KarelConfig {
  // Initial world state when environment loads
  initialWorld: KarelWorld;

  // Initial code to display in the editor
  initialCode: string;

  // Optional: Feature restrictions for this environment
  allowedFeatures?: {
    // List of allowed Karel commands (undefined = all allowed)
    karelCommands?: string[];

    // Reserved for future use
    pythonFeatures?: string[];
  };

  // Optional: Test configuration for this environment
  tests?: {
    // Map of test name to test world
    worlds: { [testName: string]: KarelWorld };

    // Validation function that checks if final world state is correct
    validate: (world: KarelWorld) => { passed: boolean; message: string };

    // Names of tests that can be loaded and viewed in the UI
    loadableTests?: string[];
  };

  // Whether to show the world editor UI (default: false)
  // Currently only used in playground
  showWorldEditor?: boolean;
}
```

### KarelWorld Interface

```typescript
interface KarelWorld {
  dimensions: {
    width: number; // 1 to 30
    height: number; // 1 to 30
  };
  karel: {
    position: {
      x: number; // 1-indexed
      y: number; // 1-indexed
    };
    direction: {
      type: 'north' | 'east' | 'south' | 'west';
    };
    beepers: number; // -1 for infinite
  };
  walls: Wall[];
  beepers: BeeperLocation[];
}

interface Wall {
  type: 'horizontal' | 'vertical';
  x: number;
  y: number;
  // horizontal wall: below cell (x,y)
  // vertical wall: to right of cell (x,y)
}

interface BeeperLocation {
  x: number;
  y: number;
  count: number;
}
```

## Future: Non-Karel Lessons

As the curriculum expands beyond Karel, new interactive modules will be developed:

- **Call Stack Visualizer** (planned) — An interactive component for visualizing the call stack and tracing through Python code execution. Will be used in chapters covering functions, recursion, and program flow.
- **Additional modules** — As needed for topics like data structures, algorithms, etc.

Each new module will:

1. Live in `src/lib/<module-name>/` for logic and types
2. Have reusable Svelte components in `src/lib/components/`
3. Be embeddable in MDsveX lessons following the same `import → configure → embed` pattern as Karel
4. Have a corresponding design document (`<MODULE>_DESIGN.md`)

Lesson files for non-Karel chapters will follow the same MDsveX format, mixing prose explanations with embedded interactive components.

---

## Tips for Lesson Authors

1. **Start Simple**: Begin with simple examples before adding restrictions or tests
2. **Clear Instructions**: Write clear comments in `initialCode` explaining the task
3. **Test Validation**: Test your validation function with correct and incorrect solutions
4. **Multiple Tests**: Use multiple test worlds to ensure solutions work generally, not just for one case
5. **Appropriate Restrictions**: Only restrict features that haven't been taught yet
6. **Helpful Messages**: Write clear, helpful messages in validation returns
7. **Loadable Tests**: Make tests loadable so students can see the different scenarios

## Example Lessons

See [src/routes/karel/lesson-examples/+page.svelte](src/routes/karel/lesson-examples/+page.svelte) for complete working examples of all three types of lessons.

## Need Help?

- Check [KAREL_DESIGN.md](KAREL_DESIGN.md) for Karel module design details
- Check [KAREL_REFACTOR.md](KAREL_REFACTOR.md) for Karel refactoring documentation
- Check [PROGRESS.md](PROGRESS.md) for implementation status
- Check [AGENTS.md](AGENTS.md) for overall project guidance
