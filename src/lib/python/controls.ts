/**
 * Which execution controls are available, as a function of the runner's state.
 *
 * Kept out of the component so the whole table can be asserted without a
 * browser. The rules — and the reasoning behind the non-obvious ones — are
 * `PythonInterpreterDesign.md` §12.2.
 */
import type { RunnerStatus } from './runner';

/** What the combined Play/Stop button currently is. */
export interface PrimaryControl {
  mode: 'play' | 'stop';
  enabled: boolean;
}

/** Nothing is in flight: the program has not started, or has ended. */
function isIdle(status: RunnerStatus): boolean {
  return status === 'ready' || status === 'finished' || status === 'error';
}

/**
 * Play and Stop are one button.
 *
 * `awaiting-input` shows Stop even though nothing is executing: the program
 * cannot advance without a value, so a student who has decided not to answer
 * would otherwise only escape through Reset code, which destroys their work.
 *
 * `paused` deliberately shows Play, not Stop. Abandoning from a pause is still
 * possible — press Play, and if it turns out to be an infinite loop the button
 * becomes Stop.
 */
export function primaryControl(status: RunnerStatus): PrimaryControl {
  if (status === 'running' || status === 'awaiting-input') {
    return { mode: 'stop', enabled: true };
  }
  return { mode: 'play', enabled: isIdle(status) || status === 'paused' };
}

/** Step advances one trace event, from a standing start or from a pause. */
export function canStep(status: RunnerStatus): boolean {
  return isIdle(status) || status === 'paused';
}

/**
 * "To breakpoint" is Step's twin, minus the case that would make it a second
 * Play: with no breakpoints set it would simply run the program to the end, so
 * it is disabled instead, and its tooltip says how to set one.
 */
export function canRunToBreakpoint(status: RunnerStatus, hasBreakpoints: boolean): boolean {
  return hasBreakpoints && canStep(status);
}

/**
 * Reset code is the only control that destroys work, and a pause is *not* idle
 * for it: resetting mid-debug would discard the program the paused frames
 * belong to.
 */
export function canResetCode(status: RunnerStatus): boolean {
  return isIdle(status);
}
