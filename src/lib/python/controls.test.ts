/**
 * The control row is a state machine over `RunnerStatus`, and getting it wrong
 * is how a student ends up with a Step button that silently does nothing. The
 * rules live here as pure functions so every state can be asserted without
 * booting an interpreter.
 *
 * The table these encode is PythonInterpreterDesign.md §12.2.
 */
import { describe, it, expect } from 'vitest';
import { canResetCode, canRunTests, canRunToBreakpoint, canStep, primaryControl } from './controls';
import type { RunnerStatus } from './runner';

const ALL: RunnerStatus[] = [
  'loading',
  'ready',
  'running',
  'paused',
  'awaiting-input',
  'finished',
  'error',
  'failed'
];

describe('primaryControl', () => {
  it('offers Play when there is nothing in flight', () => {
    for (const status of ['ready', 'finished', 'error'] as RunnerStatus[]) {
      expect(primaryControl(status)).toEqual({ mode: 'play', enabled: true });
    }
  });

  it('offers Stop while the program is running', () => {
    expect(primaryControl('running')).toEqual({ mode: 'stop', enabled: true });
  });

  // Nothing is executing, but the program cannot advance without a value.
  // Without Stop here the only escape is Reset code, which throws away the
  // student's work — see §12.2.
  it('offers Stop while the program waits on input()', () => {
    expect(primaryControl('awaiting-input')).toEqual({ mode: 'stop', enabled: true });
  });

  // Deliberate: Play from a pause resumes. Abandoning is still possible —
  // press Play, and an infinite loop turns the button into Stop.
  it('offers Play, not Stop, while paused', () => {
    expect(primaryControl('paused')).toEqual({ mode: 'play', enabled: true });
  });

  it('is disabled while Python is loading or has failed to load', () => {
    expect(primaryControl('loading')).toEqual({ mode: 'play', enabled: false });
    expect(primaryControl('failed')).toEqual({ mode: 'play', enabled: false });
  });

  it('has an answer for every status', () => {
    for (const status of ALL) {
      expect(['play', 'stop']).toContain(primaryControl(status).mode);
    }
  });
});

describe('canStep', () => {
  it('is enabled when idle or paused', () => {
    for (const status of ['ready', 'finished', 'error', 'paused'] as RunnerStatus[]) {
      expect(canStep(status)).toBe(true);
    }
  });

  it('is disabled while running, awaiting input, loading, or failed', () => {
    for (const status of ['running', 'awaiting-input', 'loading', 'failed'] as RunnerStatus[]) {
      expect(canStep(status)).toBe(false);
    }
  });
});

describe('canRunToBreakpoint', () => {
  it('matches Step whenever breakpoints exist', () => {
    for (const status of ALL) {
      expect(canRunToBreakpoint(status, true)).toBe(canStep(status));
    }
  });

  // Running to a breakpoint that does not exist just runs the program, which
  // makes the button a second, differently-labelled Play. Disabling it instead
  // is what teaches that a breakpoint has to be set first.
  it('is disabled everywhere when no breakpoints are set', () => {
    for (const status of ALL) {
      expect(canRunToBreakpoint(status, false)).toBe(false);
    }
  });
});

describe('canResetCode', () => {
  it('is enabled only when idle', () => {
    for (const status of ['ready', 'finished', 'error'] as RunnerStatus[]) {
      expect(canResetCode(status)).toBe(true);
    }
  });

  // Unlike Step, a pause is *not* idle here: resetting mid-debug would throw
  // away the program the paused frames belong to.
  it('is disabled while paused, running, awaiting input, loading, or failed', () => {
    for (const status of [
      'paused',
      'running',
      'awaiting-input',
      'loading',
      'failed'
    ] as RunnerStatus[]) {
      expect(canResetCode(status)).toBe(false);
    }
  });
});

describe('canRunTests', () => {
  it('is enabled only when idle, and only with tests to run', () => {
    for (const status of ['ready', 'finished', 'error'] as RunnerStatus[]) {
      expect(canRunTests(status, true)).toBe(true);
    }
  });

  // A pause is not idle here: running the tests would abandon the debugging
  // session the student is in the middle of, and running them mid-run is
  // meaningless — see §13.5.
  it('is disabled while paused, running, awaiting input, loading, or failed', () => {
    for (const status of [
      'paused',
      'running',
      'awaiting-input',
      'loading',
      'failed'
    ] as RunnerStatus[]) {
      expect(canRunTests(status, true)).toBe(false);
    }
  });

  // The playground and the worked examples in lessons have no tests, and must
  // not grow a button that does nothing.
  it('is disabled everywhere when the exercise has no tests', () => {
    for (const status of ALL) {
      expect(canRunTests(status, false)).toBe(false);
    }
  });
});
