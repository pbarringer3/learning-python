/**
 * Configuration for an embedded Python environment.
 *
 * `PythonConfig` is the Python-side counterpart to `KarelConfig`, and just as
 * deliberately small. `tests` is the stdout-comparison validation described in
 * `PythonInterpreterDesign.md` §13; one deferred piece remains —
 *
 *   - `allowedFeatures`, an opt-in AST allowlist so a lesson can forbid syntax
 *     it has not taught yet (Karel's `validate_karel_code` is the precedent),
 *
 * — and it can be added as another optional field rather than as a redesign.
 * See `PROGRESS.md` for why it is not built yet.
 */
import type { PythonTests } from './exercise-tests';

/** Pyodide release used by both the Karel runtime and the visualizer worker. */
export const PYODIDE_VERSION = '0.29.3';

/** CDN root Pyodide loads itself and its wasm/stdlib assets from. */
export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

/**
 * Filename the user's code is compiled under. The tracer identifies the user's
 * own frames by comparing `co_filename` against this, so it must match the
 * `USER_FILENAME` in `tracer.py`.
 */
export const USER_FILENAME = '<user_code>';

/**
 * Python recursion limit, set low on purpose.
 *
 * The WASM stack is far smaller than a native one, and overflowing it kills the
 * whole Pyodide runtime rather than raising. A conservative limit turns runaway
 * recursion into an ordinary `RecursionError` the UI can display next to the
 * offending line.
 */
export const DEFAULT_RECURSION_LIMIT = 220;

/** Milliseconds to wait for a cooperative stop before terminating the worker. */
export const STOP_GRACE_MS = 400;

/** Configuration for one embedded Python environment. */
export interface PythonConfig {
  /** Code the editor starts with. */
  initialCode: string;
  /**
   * `localStorage` key for the student's in-progress code. Convention matches
   * Karel's: `"<chapter>/<lesson>/<exercise>"`. Omit to disable persistence.
   */
  persistenceKey?: string;
  /** Show the call stack visualizer panel. Defaults to true. */
  showVisualizer?: boolean;
  /** Number of editor rows to size the editor to. */
  editorLines?: number;
  /** Recursion limit override; see `DEFAULT_RECURSION_LIMIT`. */
  recursionLimit?: number;
  /**
   * Per-exercise validation: run the student's code once per case and compare
   * captured stdout. Omit for the playground and for worked examples, which
   * must not grow a "Run tests" button with nothing behind it.
   */
  tests?: PythonTests;
}
