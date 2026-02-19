/**
 * Unit tests for Karel type utilities
 */
import { describe, it, expect } from 'vitest';
import {
  createDefaultWorld,
  cloneWorld,
  createDefaultExecutionState,
  type KarelWorld,
  type KarelConfig
} from './types';

describe('createDefaultWorld', () => {
  it('returns a 10x10 world', () => {
    const world = createDefaultWorld();
    expect(world.dimensions.width).toBe(10);
    expect(world.dimensions.height).toBe(10);
  });

  it('places Karel at (1,1) facing east', () => {
    const world = createDefaultWorld();
    expect(world.karel.position).toEqual({ x: 1, y: 1 });
    expect(world.karel.direction.type).toBe('east');
  });

  it('starts Karel with 0 beepers', () => {
    const world = createDefaultWorld();
    expect(world.karel.beepers).toBe(0);
  });

  it('starts with no walls', () => {
    const world = createDefaultWorld();
    expect(world.walls).toEqual([]);
  });

  it('starts with no beepers on the ground', () => {
    const world = createDefaultWorld();
    expect(world.beepers).toEqual([]);
  });

  it('returns distinct objects each call', () => {
    const a = createDefaultWorld();
    const b = createDefaultWorld();
    expect(a).not.toBe(b);
    expect(a.karel).not.toBe(b.karel);
  });
});

describe('cloneWorld', () => {
  const sampleWorld: KarelWorld = {
    dimensions: { width: 5, height: 8 },
    karel: {
      position: { x: 3, y: 4 },
      direction: { type: 'north' },
      beepers: 7
    },
    walls: [
      { type: 'horizontal', x: 2, y: 3 },
      { type: 'vertical', x: 4, y: 1 }
    ],
    beepers: [
      { x: 1, y: 1, count: 3 },
      { x: 5, y: 5, count: 1 }
    ]
  };

  it('produces an equal world', () => {
    const clone = cloneWorld(sampleWorld);
    expect(clone).toEqual(sampleWorld);
  });

  it('produces a distinct top-level object', () => {
    const clone = cloneWorld(sampleWorld);
    expect(clone).not.toBe(sampleWorld);
  });

  it('deep-copies dimensions', () => {
    const clone = cloneWorld(sampleWorld);
    clone.dimensions.width = 99;
    expect(sampleWorld.dimensions.width).toBe(5);
  });

  it('deep-copies karel position', () => {
    const clone = cloneWorld(sampleWorld);
    clone.karel.position.x = 99;
    expect(sampleWorld.karel.position.x).toBe(3);
  });

  it('deep-copies karel direction', () => {
    const clone = cloneWorld(sampleWorld);
    clone.karel.direction.type = 'west';
    expect(sampleWorld.karel.direction.type).toBe('north');
  });

  it('deep-copies walls array', () => {
    const clone = cloneWorld(sampleWorld);
    clone.walls[0].x = 99;
    expect(sampleWorld.walls[0].x).toBe(2);
  });

  it('deep-copies beepers array', () => {
    const clone = cloneWorld(sampleWorld);
    clone.beepers[0].count = 99;
    expect(sampleWorld.beepers[0].count).toBe(3);
  });

  it('handles world with no walls and no beepers', () => {
    const empty: KarelWorld = {
      dimensions: { width: 1, height: 1 },
      karel: { position: { x: 1, y: 1 }, direction: { type: 'south' }, beepers: -1 },
      walls: [],
      beepers: []
    };
    const clone = cloneWorld(empty);
    expect(clone).toEqual(empty);
    expect(clone.walls).not.toBe(empty.walls);
    expect(clone.beepers).not.toBe(empty.beepers);
  });

  it('preserves infinite beepers (-1)', () => {
    const world: KarelWorld = {
      dimensions: { width: 3, height: 3 },
      karel: { position: { x: 1, y: 1 }, direction: { type: 'east' }, beepers: -1 },
      walls: [],
      beepers: []
    };
    const clone = cloneWorld(world);
    expect(clone.karel.beepers).toBe(-1);
  });

  it('adding walls to clone does not affect original', () => {
    const clone = cloneWorld(sampleWorld);
    clone.walls.push({ type: 'horizontal', x: 1, y: 1 });
    expect(sampleWorld.walls.length).toBe(2);
  });

  it('adding beepers to clone does not affect original', () => {
    const clone = cloneWorld(sampleWorld);
    clone.beepers.push({ x: 2, y: 2, count: 5 });
    expect(sampleWorld.beepers.length).toBe(2);
  });
});

describe('createDefaultExecutionState', () => {
  it('starts as idle', () => {
    const state = createDefaultExecutionState();
    expect(state.status).toBe('idle');
  });

  it('has no current line', () => {
    const state = createDefaultExecutionState();
    expect(state.currentLine).toBeNull();
  });

  it('has no error line', () => {
    const state = createDefaultExecutionState();
    expect(state.errorLine).toBeNull();
  });

  it('has stepCount of 0', () => {
    const state = createDefaultExecutionState();
    expect(state.stepCount).toBe(0);
  });

  it('has no error', () => {
    const state = createDefaultExecutionState();
    expect(state.error).toBeNull();
  });

  it('has default animation speed of 300ms', () => {
    const state = createDefaultExecutionState();
    expect(state.animationSpeed).toBe(300);
  });

  it('returns distinct objects each call', () => {
    const a = createDefaultExecutionState();
    const b = createDefaultExecutionState();
    expect(a).not.toBe(b);
  });
});

describe('KarelConfig interface usage', () => {
  it('allows minimal config (just world and code)', () => {
    const config: KarelConfig = {
      initialWorld: createDefaultWorld(),
      initialCode: 'move()'
    };
    expect(config.initialWorld).toBeDefined();
    expect(config.initialCode).toBe('move()');
    expect(config.allowedFeatures).toBeUndefined();
    expect(config.tests).toBeUndefined();
    expect(config.showWorldEditor).toBeUndefined();
  });

  it('allows full config with all optional fields', () => {
    const world = createDefaultWorld();
    const config: KarelConfig = {
      initialWorld: world,
      initialCode: 'move()',
      allowedFeatures: {
        karelCommands: ['move', 'turn_left'],
        pythonFeatures: ['functions', 'while']
      },
      tests: {
        worlds: { 'Test 1': cloneWorld(world) },
        validate: (w) => ({ passed: true, message: 'ok' }),
        loadableTests: ['Test 1']
      },
      showWorldEditor: true
    };
    expect(config.allowedFeatures!.karelCommands).toEqual(['move', 'turn_left']);
    expect(config.tests!.loadableTests).toEqual(['Test 1']);
    expect(config.showWorldEditor).toBe(true);
  });

  it('validate function receives world and returns result', () => {
    const world = createDefaultWorld();
    world.beepers.push({ x: 3, y: 3, count: 1 });
    const validate = (w: KarelWorld) => {
      const has = w.beepers.some((b) => b.x === 3 && b.y === 3);
      return { passed: has, message: has ? 'pass' : 'fail' };
    };
    expect(validate(world)).toEqual({ passed: true, message: 'pass' });

    const emptyWorld = createDefaultWorld();
    expect(validate(emptyWorld)).toEqual({ passed: false, message: 'fail' });
  });
});
