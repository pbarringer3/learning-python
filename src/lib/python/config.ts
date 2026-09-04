/**
 * Configuration for an embedded Python environment.
 *
 * `PythonConfig` is the Python-side counterpart to `KarelConfig`. It is
 * deliberately small: v1 runs unrestricted Python with no exercise tests. The
 * shape is designed so that the two deferred pieces —
 *
 *   - `allowedFeatures`, an opt-in AST allowlist so a lesson can forbid syntax
 *     it has not taught yet (Karel's `validate_karel_code` is the precedent),
 *   - `tests`, per-exercise validation of captured stdout / final state,
 *
 * can be added as new optional fields rather than as a redesign. See
 * `PROGRESS.md` for why they are not built yet.
 */

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
}
