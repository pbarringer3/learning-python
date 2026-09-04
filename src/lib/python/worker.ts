/**
 * Pyodide worker.
 *
 * Everything here runs off the main thread, which is what makes genuine
 * pausing possible: `Atomics.wait` blocks this worker's only thread until the
 * UI stores a command in the shared control word. On the main thread that
 * would be illegal (and would deadlock the page anyway), which is why the
 * record-then-replay design that Python Tutor uses is not needed here.
 *
 * While this worker is blocked, `postMessage` *into* it is useless — the
 * message would sit unread in an event queue that is never pumped. That is the
 * entire reason commands travel through a `SharedArrayBuffer` instead.
 */

import type { PyodideInterface } from 'pyodide';
import tracerSource from './tracer.py?raw';
import {
  CMD_CONTINUE,
  CMD_NONE,
  CMD_STOP,
  CMD_TO_BREAKPOINT,
  CTL_COMMAND,
  TRACE_PAUSE,
  TRACE_RUN,
  TRACE_STOP,
  controlView,
  hasBreakpoint,
  readInput,
  waitForCommand,
  type HostMessage,
  type PythonError,
  type RunMode,
  type SharedChannel,
  type WorkerMessage
} from './protocol';

/**
 * Minimal worker-scope shape. The project's TS config uses the DOM lib, which
 * types the global `self` as a Window, and pulling in the webworker lib
 * globally would conflict with it — declaring just what this file uses is
 * cheaper than fighting that.
 */
interface WorkerScope {
  postMessage(message: WorkerMessage): void;
  onmessage: ((event: MessageEvent<HostMessage>) => void) | null;
}

const ctx = self as unknown as WorkerScope;

/** The subset of the tracer module the worker calls into. */
interface TracerModule {
  install(): void;
  run_user_code(source: string, recursionLimit: number, tracing: boolean): string;
}

/** What `run_user_code` reports back, as JSON. */
type RunResult =
  | { status: 'done'; snapshot?: unknown }
  | { status: 'stopped' }
  | { status: 'error'; error: PythonError; snapshot?: unknown };

let channel: SharedChannel | null = null;
let control: Int32Array | null = null;
let tracer: TracerModule | null = null;

/**
 * What the tracer stops for.
 *
 *  - `each`     — every trace event (Step).
 *  - `breakpoints` — only a `line` event on a marked line (To breakpoint).
 *  - `none`     — nothing (Play, whether from idle or resumed from a pause).
 *
 * Set by the `run` message and then by whichever command releases each pause,
 * so a student can switch between the three mid-program without restarting.
 */
type PauseMode = 'each' | 'breakpoints' | 'none';

let pauseMode: PauseMode = 'each';

/** The pause mode a command asks for once it releases the worker. */
function pauseModeFor(command: number): PauseMode {
  if (command === CMD_CONTINUE) return 'none';
  if (command === CMD_TO_BREAKPOINT) return 'breakpoints';
  // CMD_STEP, and anything unrecognised: stop at the next event. A spurious
  // pause is recoverable; silently running on is not.
  return 'each';
}

function post(message: WorkerMessage): void {
  ctx.postMessage(message);
}

/**
 * The API exposed to `tracer.py` as the `_visualizer_host` module.
 *
 * Every method here is called synchronously from Python, and two of them block
 * this thread. Keep them free of anything async.
 */
const host = {
  /**
   * Called at every trace event, before the (expensive) snapshot is built.
   *
   * The breakpoint set is consulted here rather than in Python because it lives
   * in shared memory: a breakpoint added while this worker is blocked inside
   * `Atomics.wait` has no other way to reach it (`PythonInterpreterDesign.md`
   * §12.3). Only `line` events are matched — a breakpoint means "pause before
   * this line runs", and the `call` and `return` events at the same line would
   * otherwise stop three times over.
   */
  before_snapshot(line: number, event: string): number {
    if (!control) return TRACE_RUN;
    if (Atomics.load(control, CTL_COMMAND) === CMD_STOP) return TRACE_STOP;
    if (pauseMode === 'each') return TRACE_PAUSE;
    if (pauseMode !== 'breakpoints' || event !== 'line') return TRACE_RUN;
    if (channel && hasBreakpoint(channel, line)) return TRACE_PAUSE;
    return TRACE_RUN;
  },

  /** Publish a snapshot, then block until the UI issues the next command. */
  pause(json: string): number {
    if (!control) return CMD_CONTINUE;
    // Clear the slot *before* announcing the snapshot. The UI can only issue a
    // command in response to that message, so there is no window in which a
    // command could be stored and then overwritten by this reset.
    Atomics.store(control, CTL_COMMAND, CMD_NONE);
    post({ type: 'snapshot', json });
    const command = waitForCommand(control);
    pauseMode = pauseModeFor(command);
    return command;
  },

  write_stdout(text: string): void {
    post({ type: 'stdout', text });
  },

  write_stderr(text: string): void {
    post({ type: 'stderr', text });
  },

  /**
   * Block until the user answers an `input()` prompt. Returns `null` if they
   * pressed Stop instead, which the tracer turns into an abort.
   */
  request_input(prompt: string): string | null {
    if (!control || !channel) return null;
    Atomics.store(control, CTL_COMMAND, CMD_NONE);
    post({ type: 'input', prompt });
    const command = waitForCommand(control);
    if (command === CMD_STOP) return null;
    return readInput(channel);
  }
};

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Load Pyodide and install the tracer module into it. */
async function boot(indexUrl: string): Promise<void> {
  // Held in a variable so Vite leaves the CDN URL alone instead of trying to
  // resolve it at build time.
  const moduleUrl = `${indexUrl}pyodide.mjs`;
  const pyodideModule = (await import(/* @vite-ignore */ moduleUrl)) as {
    loadPyodide(config: { indexURL: string }): Promise<PyodideInterface>;
  };

  const pyodide = await pyodideModule.loadPyodide({ indexURL: indexUrl });

  pyodide.registerJsModule('_visualizer_host', host);

  // Written to the virtual filesystem and imported as a real module, so the
  // tracer's own names never end up in the namespace the user's code sees.
  pyodide.FS.mkdirTree('/lib/visualizer');
  pyodide.FS.writeFile('/lib/visualizer/_tracer.py', new TextEncoder().encode(tracerSource));
  pyodide.runPython(`import sys; sys.path.insert(0, "/lib/visualizer")`);

  tracer = pyodide.pyimport('_tracer') as unknown as TracerModule;
  tracer.install();
}

/** Execute the user's source and report how it ended. */
function run(code: string, mode: RunMode, recursionLimit: number): void {
  if (!tracer) {
    post({ type: 'load-error', message: 'Python runtime is not ready yet.' });
    return;
  }

  // A command left over from the previous run must not leak into this one.
  if (control) Atomics.store(control, CTL_COMMAND, CMD_NONE);
  pauseMode = mode === 'step' ? 'each' : mode === 'breakpoint' ? 'breakpoints' : 'none';

  // Play from idle installs no tracer at all, which is the fast path. Both
  // pausing modes need one; a Play issued later, from a pause, runs with the
  // tracer already installed and simply stops pausing.
  const tracing = mode !== 'run';

  let result: RunResult;
  try {
    result = JSON.parse(tracer.run_user_code(code, recursionLimit, tracing)) as RunResult;
  } catch (error) {
    // Only reachable if the tracer itself fails; user exceptions are caught in
    // Python and come back as a normal `error` status.
    post({
      type: 'error',
      error: {
        type: 'InternalError',
        message: describeError(error),
        line: null,
        traceback: describeError(error)
      }
    });
    return;
  }

  // The post-mortem snapshot rides along with the ending rather than as a
  // separate `snapshot` message, which would put the runner into `paused`.
  const snapshot =
    result.status !== 'stopped' && result.snapshot ? JSON.stringify(result.snapshot) : undefined;

  if (result.status === 'error') post({ type: 'error', error: result.error, snapshot });
  else if (result.status === 'stopped') post({ type: 'stopped' });
  else post({ type: 'done', snapshot });
}

ctx.onmessage = async (event: MessageEvent<HostMessage>) => {
  const message = event.data;

  if (message.type === 'init') {
    channel = message.channel;
    control = controlView(channel);
    try {
      await boot(message.indexUrl);
      post({ type: 'ready' });
    } catch (error) {
      post({ type: 'load-error', message: describeError(error) });
    }
    return;
  }

  if (message.type === 'run') {
    run(message.code, message.mode, message.recursionLimit);
  }
};
