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
  CMD_PAUSE,
  CMD_STOP,
  CTL_COMMAND,
  TRACE_PAUSE,
  TRACE_RUN,
  TRACE_STOP,
  controlView,
  readInput,
  waitForCommand,
  type HostMessage,
  type PythonError,
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
  | { status: 'done' }
  | { status: 'stopped' }
  | { status: 'error'; error: PythonError };

let channel: SharedChannel | null = null;
let control: Int32Array | null = null;
let tracer: TracerModule | null = null;

/**
 * Whether the tracer should stop at every event. Cleared when the user presses
 * Continue, set again when they press Pause.
 */
let pauseAtEachEvent = true;

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
  /** Called at every trace event, before the (expensive) snapshot is built. */
  before_snapshot(): number {
    if (!control) return TRACE_RUN;
    const command = Atomics.load(control, CTL_COMMAND);
    if (command === CMD_STOP) return TRACE_STOP;
    if (command === CMD_PAUSE) {
      pauseAtEachEvent = true;
      return TRACE_PAUSE;
    }
    return pauseAtEachEvent ? TRACE_PAUSE : TRACE_RUN;
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
    pauseAtEachEvent = command !== CMD_CONTINUE;
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
function run(code: string, mode: 'run' | 'step', recursionLimit: number): void {
  if (!tracer) {
    post({ type: 'load-error', message: 'Python runtime is not ready yet.' });
    return;
  }

  // A command left over from the previous run must not leak into this one.
  if (control) Atomics.store(control, CTL_COMMAND, CMD_NONE);
  pauseAtEachEvent = mode === 'step';

  let result: RunResult;
  try {
    result = JSON.parse(tracer.run_user_code(code, recursionLimit, mode === 'step')) as RunResult;
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

  if (result.status === 'error') post({ type: 'error', error: result.error });
  else if (result.status === 'stopped') post({ type: 'stopped' });
  else post({ type: 'done' });
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
