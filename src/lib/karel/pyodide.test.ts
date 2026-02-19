/**
 * Unit tests for Pyodide integration utilities
 *
 * These tests validate the TypeScript-side logic of pyodide.ts.
 * The actual Pyodide runtime is not available in unit tests,
 * so we mock PyodideInterface where needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { injectKarelCommands, type KarelCallbacks, type ValidationResult } from './pyodide';

// Mock PyodideInterface
function createMockPyodide() {
  const globals = new Map<string, unknown>();
  return {
    globals: {
      set: vi.fn((key: string, value: unknown) => globals.set(key, value)),
      get: vi.fn((key: string) => globals.get(key))
    },
    runPython: vi.fn(),
    runPythonAsync: vi.fn(),
    _globals: globals
  };
}

function createMockCallbacks(): KarelCallbacks {
  return {
    move: vi.fn(),
    turn_left: vi.fn(),
    pick_beeper: vi.fn(),
    put_beeper: vi.fn(),
    front_is_clear: vi.fn(() => true),
    front_is_blocked: vi.fn(() => false),
    beepers_present: vi.fn(() => false),
    no_beepers_present: vi.fn(() => true),
    left_is_clear: vi.fn(() => true),
    left_is_blocked: vi.fn(() => false),
    right_is_clear: vi.fn(() => true),
    right_is_blocked: vi.fn(() => false),
    beepers_in_bag: vi.fn(() => true),
    no_beepers_in_bag: vi.fn(() => false),
    facing_north: vi.fn(() => false),
    not_facing_north: vi.fn(() => true),
    facing_south: vi.fn(() => false),
    not_facing_south: vi.fn(() => true),
    facing_east: vi.fn(() => true),
    not_facing_east: vi.fn(() => false),
    facing_west: vi.fn(() => false),
    not_facing_west: vi.fn(() => true)
  };
}

describe('injectKarelCommands', () => {
  let mockPyodide: ReturnType<typeof createMockPyodide>;
  let callbacks: KarelCallbacks;

  beforeEach(() => {
    mockPyodide = createMockPyodide();
    callbacks = createMockCallbacks();
  });

  it('injects all movement/action commands', () => {
    injectKarelCommands(mockPyodide as any, callbacks);

    expect(mockPyodide.globals.set).toHaveBeenCalledWith('move', callbacks.move);
    expect(mockPyodide.globals.set).toHaveBeenCalledWith('turn_left', callbacks.turn_left);
    expect(mockPyodide.globals.set).toHaveBeenCalledWith('pick_beeper', callbacks.pick_beeper);
    expect(mockPyodide.globals.set).toHaveBeenCalledWith('put_beeper', callbacks.put_beeper);
  });

  it('injects front sensor commands', () => {
    injectKarelCommands(mockPyodide as any, callbacks);

    expect(mockPyodide.globals.set).toHaveBeenCalledWith(
      'front_is_clear',
      callbacks.front_is_clear
    );
    expect(mockPyodide.globals.set).toHaveBeenCalledWith(
      'front_is_blocked',
      callbacks.front_is_blocked
    );
  });

  it('injects beeper sensor commands', () => {
    injectKarelCommands(mockPyodide as any, callbacks);

    expect(mockPyodide.globals.set).toHaveBeenCalledWith(
      'beepers_present',
      callbacks.beepers_present
    );
    expect(mockPyodide.globals.set).toHaveBeenCalledWith(
      'no_beepers_present',
      callbacks.no_beepers_present
    );
  });

  it('injects left/right sensor commands', () => {
    injectKarelCommands(mockPyodide as any, callbacks);

    expect(mockPyodide.globals.set).toHaveBeenCalledWith('left_is_clear', callbacks.left_is_clear);
    expect(mockPyodide.globals.set).toHaveBeenCalledWith(
      'left_is_blocked',
      callbacks.left_is_blocked
    );
    expect(mockPyodide.globals.set).toHaveBeenCalledWith(
      'right_is_clear',
      callbacks.right_is_clear
    );
    expect(mockPyodide.globals.set).toHaveBeenCalledWith(
      'right_is_blocked',
      callbacks.right_is_blocked
    );
  });

  it('injects beeper bag sensor commands', () => {
    injectKarelCommands(mockPyodide as any, callbacks);

    expect(mockPyodide.globals.set).toHaveBeenCalledWith(
      'beepers_in_bag',
      callbacks.beepers_in_bag
    );
    expect(mockPyodide.globals.set).toHaveBeenCalledWith(
      'no_beepers_in_bag',
      callbacks.no_beepers_in_bag
    );
  });

  it('injects all direction sensor commands', () => {
    injectKarelCommands(mockPyodide as any, callbacks);

    const directionSensors = [
      'facing_north',
      'not_facing_north',
      'facing_south',
      'not_facing_south',
      'facing_east',
      'not_facing_east',
      'facing_west',
      'not_facing_west'
    ];
    for (const sensor of directionSensors) {
      expect(mockPyodide.globals.set).toHaveBeenCalledWith(sensor, (callbacks as any)[sensor]);
    }
  });

  it('injects exactly 22 commands total', () => {
    injectKarelCommands(mockPyodide as any, callbacks);

    // 4 actions + 2 front + 2 beepers + 4 left/right + 2 bag + 8 direction = 22
    expect(mockPyodide.globals.set).toHaveBeenCalledTimes(22);
  });

  it('stores callable functions in globals', () => {
    injectKarelCommands(mockPyodide as any, callbacks);

    const storedMove = mockPyodide._globals.get('move');
    expect(typeof storedMove).toBe('function');

    const storedFrontIsClear = mockPyodide._globals.get('front_is_clear');
    expect(typeof storedFrontIsClear).toBe('function');
  });

  it('stored callbacks are the same function references', () => {
    injectKarelCommands(mockPyodide as any, callbacks);

    expect(mockPyodide._globals.get('move')).toBe(callbacks.move);
    expect(mockPyodide._globals.get('turn_left')).toBe(callbacks.turn_left);
    expect(mockPyodide._globals.get('front_is_clear')).toBe(callbacks.front_is_clear);
  });
});

describe('ValidationResult interface', () => {
  it('represents a valid result', () => {
    const result: ValidationResult = { valid: true };
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.line).toBeUndefined();
  });

  it('represents an error with message and line', () => {
    const result: ValidationResult = {
      valid: false,
      error: 'Variable assignments are not allowed.',
      line: 5
    };
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Variable assignments');
    expect(result.line).toBe(5);
  });

  it('represents a syntax error', () => {
    const result: ValidationResult = {
      valid: false,
      error: 'Syntax error: unexpected EOF while parsing',
      line: 1
    };
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Syntax error');
  });
});

describe('KarelCallbacks interface', () => {
  it('has all required action callbacks', () => {
    const callbacks = createMockCallbacks();
    expect(typeof callbacks.move).toBe('function');
    expect(typeof callbacks.turn_left).toBe('function');
    expect(typeof callbacks.pick_beeper).toBe('function');
    expect(typeof callbacks.put_beeper).toBe('function');
  });

  it('has all required sensor callbacks returning booleans', () => {
    const callbacks = createMockCallbacks();

    const booleanSensors: (keyof KarelCallbacks)[] = [
      'front_is_clear',
      'front_is_blocked',
      'beepers_present',
      'no_beepers_present',
      'left_is_clear',
      'left_is_blocked',
      'right_is_clear',
      'right_is_blocked',
      'beepers_in_bag',
      'no_beepers_in_bag',
      'facing_north',
      'not_facing_north',
      'facing_south',
      'not_facing_south',
      'facing_east',
      'not_facing_east',
      'facing_west',
      'not_facing_west'
    ];

    for (const sensor of booleanSensors) {
      const result = (callbacks[sensor] as () => boolean)();
      expect(typeof result).toBe('boolean');
    }
  });

  it('sensor pairs are complementary', () => {
    const callbacks = createMockCallbacks();

    // front_is_clear and front_is_blocked are set as complements in mock
    expect(callbacks.front_is_clear()).toBe(!callbacks.front_is_blocked());
    expect(callbacks.beepers_present()).toBe(!callbacks.no_beepers_present());
    expect(callbacks.left_is_clear()).toBe(!callbacks.left_is_blocked());
    expect(callbacks.right_is_clear()).toBe(!callbacks.right_is_blocked());
    expect(callbacks.beepers_in_bag()).toBe(!callbacks.no_beepers_in_bag());
    expect(callbacks.facing_north()).toBe(!callbacks.not_facing_north());
    expect(callbacks.facing_south()).toBe(!callbacks.not_facing_south());
    expect(callbacks.facing_east()).toBe(!callbacks.not_facing_east());
    expect(callbacks.facing_west()).toBe(!callbacks.not_facing_west());
  });
});
