/**
 * Wire protocol shared between the main thread and the Pyodide worker.
 *
 * Two channels carry traffic in opposite directions:
 *
 *  - Worker to main thread: ordinary `postMessage`. Snapshots are plain
 *    JSON-serialisable data, so structured cloning is all they need.
 *  - Main thread to worker: a `SharedArrayBuffer` plus `Atomics`. This is the
 *    only part that *must* be shared memory, because the worker is blocked
 *    inside `Atomics.wait` when a command arrives — a `postMessage` would sit
 *    unread in its event queue forever.
 *
 * See `PythonInterpreterDesign.md` §2 for the reasoning behind this split.
 */

/** Index of the command word the worker blocks on. */
export const CTL_COMMAND = 0;
/** Index holding the byte length of the payload in the data buffer. */
export const CTL_INPUT_LEN = 1;
/** Number of Int32 slots in the control buffer. */
export const CONTROL_SLOTS = 2;

/** No command pending — the value the worker waits on. */
export const CMD_NONE = 0;
/** Advance one trace event, then pause again. */
export const CMD_STEP = 1;
/** Run to completion without pausing. */
export const CMD_CONTINUE = 2;
/** An `input()` response is waiting in the data buffer. */
export const CMD_INPUT = 3;
/** Unwind and abandon execution at the next trace event. */
export const CMD_STOP = 4;
/** Leave "continue" mode and pause at the next trace event. */
export const CMD_PAUSE = 5;

/** Size of the buffer carrying `input()` responses to the worker. */
export const INPUT_BUFFER_BYTES = 64 * 1024;

/** What the tracer should do at the current event. */
export const TRACE_RUN = 0;
export const TRACE_PAUSE = 1;
export const TRACE_STOP = 2;

/** The pair of shared buffers making up the main-thread-to-worker channel. */
export interface SharedChannel {
  control: SharedArrayBuffer;
  data: SharedArrayBuffer;
}

/** Result of writing an `input()` response into the data buffer. */
export interface WriteInputResult {
  /** Bytes actually written. */
  byteLength: number;
  /** True when the text did not fit and was cut short at a character boundary. */
  truncated: boolean;
}

/** Allocate the shared buffers. Requires a cross-origin isolated context. */
export function createSharedChannel(): SharedChannel {
  return {
    control: new SharedArrayBuffer(CONTROL_SLOTS * 4),
    data: new SharedArrayBuffer(INPUT_BUFFER_BYTES)
  };
}

/** Int32 view over the control buffer, for `Atomics` operations. */
export function controlView(channel: SharedChannel): Int32Array {
  return new Int32Array(channel.control);
}

/** Uint8 view over the data buffer. */
export function dataView(channel: SharedChannel): Uint8Array {
  return new Uint8Array(channel.data);
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Encode an `input()` response into the data buffer and record its length.
 *
 * `TextEncoder.encodeInto` stops on a character boundary rather than emitting a
 * partial UTF-8 sequence, so an oversized value is truncated safely instead of
 * decoding to a replacement character on the far side.
 *
 * It will not write *into* shared memory, though — its destination is declared
 * without `[AllowShared]`, so handing it a view over a `SharedArrayBuffer`
 * throws in the browser (Node is more permissive, which is why this needs a
 * test of its own). Encoding into a private scratch buffer and copying across
 * keeps the character-boundary behaviour without touching shared memory.
 */
export function writeInput(channel: SharedChannel, text: string): WriteInputResult {
  const scratch = new Uint8Array(INPUT_BUFFER_BYTES);
  const { read, written } = encoder.encodeInto(text, scratch);
  dataView(channel).set(scratch.subarray(0, written));
  Atomics.store(controlView(channel), CTL_INPUT_LEN, written);
  return { byteLength: written, truncated: read < text.length };
}

/**
 * Decode the `input()` response currently held in the data buffer.
 *
 * Like `encodeInto`, `TextDecoder.decode` refuses a view over shared memory, so
 * the bytes are copied into a private array first. `new Uint8Array(view)` copies
 * rather than aliasing.
 */
export function readInput(channel: SharedChannel): string {
  const length = Atomics.load(controlView(channel), CTL_INPUT_LEN);
  return decoder.decode(new Uint8Array(dataView(channel).subarray(0, length)));
}

/** Store a command and wake the worker if it is blocked on the control word. */
export function sendCommand(channel: SharedChannel, command: number): void {
  const control = controlView(channel);
  Atomics.store(control, CTL_COMMAND, command);
  Atomics.notify(control, CTL_COMMAND);
}

/**
 * Block until a command other than `CMD_NONE` is stored. Worker-side only —
 * `Atomics.wait` throws on the main thread.
 */
export function waitForCommand(control: Int32Array): number {
  for (;;) {
    const command = Atomics.load(control, CTL_COMMAND);
    if (command !== CMD_NONE) return command;
    Atomics.wait(control, CTL_COMMAND, CMD_NONE);
  }
}

/** A message sent from the worker to the main thread. */
export type WorkerMessage =
  | { type: 'ready' }
  | { type: 'load-error'; message: string }
  | { type: 'stdout'; text: string }
  | { type: 'stderr'; text: string }
  | { type: 'snapshot'; json: string }
  | { type: 'input'; prompt: string }
  | { type: 'done' }
  | { type: 'stopped' }
  | { type: 'error'; error: PythonError };

/** A message sent from the main thread to the worker. */
export type HostMessage =
  | { type: 'init'; channel: SharedChannel; indexUrl: string }
  | { type: 'run'; code: string; mode: 'run' | 'step'; recursionLimit: number };

/** An uncaught exception raised by user code. */
export interface PythonError {
  /** Exception class name, e.g. `ZeroDivisionError`. */
  type: string;
  /** `str(exc)` — the message without the class name. */
  message: string;
  /** 1-based line in the user's source, when the failure is attributable to one. */
  line: number | null;
  /** Formatted traceback, trimmed to the user's own frames. */
  traceback: string;
}
