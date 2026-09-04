/**
 * Main-thread controller for the Pyodide worker.
 *
 * Owns the worker's lifecycle and the shared control channel, and turns the
 * worker's message stream into a small state machine the UI can bind to.
 *
 * Stopping is cooperative first: the tracer notices `CMD_STOP` at its next
 * event and unwinds, which keeps the (expensive) Pyodide runtime warm. That
 * only works if the program is executing traced Python, so a loop wedged
 * inside a C-level call — `sum(itertools.count())` — never yields. After a
 * short grace period the worker is terminated outright and rebooted, which is
 * the guarantee that no program can be unkillable.
 */

import {
  CMD_CONTINUE,
  CMD_INPUT,
  CMD_NONE,
  CMD_PAUSE,
  CMD_STEP,
  CMD_STOP,
  CTL_COMMAND,
  controlView,
  createSharedChannel,
  sendCommand,
  writeInput,
  type PythonError,
  type SharedChannel,
  type WorkerMessage
} from './protocol';
import { parseSnapshot, type Snapshot } from './snapshot';
import { DEFAULT_RECURSION_LIMIT, PYODIDE_INDEX_URL, STOP_GRACE_MS } from './config';

export type RunnerStatus =
  /** Booting Pyodide — the first load pulls ~10MB from the CDN. */
  | 'loading'
  /** Idle, ready to run. */
  | 'ready'
  /** Executing, not paused. */
  | 'running'
  /** Stopped at a trace event with a snapshot to show. */
  | 'paused'
  /** Blocked inside `input()`, waiting for the user to answer. */
  | 'awaiting-input'
  /** The program ran to completion, or was stopped. */
  | 'finished'
  /** The program raised. */
  | 'error'
  /** Pyodide itself failed to load; nothing can run. */
  | 'failed';

export interface OutputChunk {
  stream: 'stdout' | 'stderr';
  text: string;
}

export interface PythonRunnerCallbacks {
  onStatus(status: RunnerStatus): void;
  onOutput(chunk: OutputChunk): void;
  onSnapshot(snapshot: Snapshot): void;
  onInputRequest(prompt: string): void;
  onError(error: PythonError): void;
  onLoadError(message: string): void;
}

/** How execution was started, which decides whether snapshots are produced. */
export type RunMode = 'run' | 'step';

export class PythonRunner {
  private worker: Worker | null = null;
  private channel: SharedChannel;
  private callbacks: PythonRunnerCallbacks;
  private status: RunnerStatus = 'loading';
  private readyPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private recursionLimit: number;
  private disposed = false;

  constructor(callbacks: PythonRunnerCallbacks, recursionLimit = DEFAULT_RECURSION_LIMIT) {
    this.callbacks = callbacks;
    this.recursionLimit = recursionLimit;
    // Allocating here rather than per-run keeps one channel for the lifetime of
    // the runner, so a restarted worker rejoins the same handshake.
    this.channel = createSharedChannel();
  }

  /** Boot the worker. Safe to call repeatedly; later calls reuse the promise. */
  start(): Promise<void> {
    if (!this.readyPromise) this.readyPromise = this.spawn();
    return this.readyPromise;
  }

  private spawn(): Promise<void> {
    this.setStatus('loading');
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => this.handle(event.data);
    worker.postMessage({
      type: 'init',
      channel: this.channel,
      indexUrl: PYODIDE_INDEX_URL
    });
    this.worker = worker;

    return new Promise<void>((resolve) => {
      this.resolveReady = resolve;
    });
  }

  private setStatus(status: RunnerStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.callbacks.onStatus(status);
  }

  /** True while the worker is blocked waiting for a command from us. */
  private get isBlocked(): boolean {
    return this.status === 'paused' || this.status === 'awaiting-input';
  }

  private handle(message: WorkerMessage): void {
    if (this.disposed) return;

    switch (message.type) {
      case 'ready':
        this.setStatus('ready');
        this.resolveReady?.();
        this.resolveReady = null;
        break;

      case 'load-error':
        this.setStatus('failed');
        this.callbacks.onLoadError(message.message);
        this.resolveReady?.();
        this.resolveReady = null;
        break;

      case 'stdout':
        this.callbacks.onOutput({ stream: 'stdout', text: message.text });
        break;

      case 'stderr':
        this.callbacks.onOutput({ stream: 'stderr', text: message.text });
        break;

      case 'snapshot':
        this.callbacks.onSnapshot(parseSnapshot(message.json));
        this.setStatus('paused');
        break;

      case 'input':
        this.callbacks.onInputRequest(message.prompt);
        this.setStatus('awaiting-input');
        break;

      case 'error':
        this.clearStopTimer();
        this.callbacks.onError(message.error);
        this.setStatus('error');
        break;

      case 'done':
      case 'stopped':
        this.clearStopTimer();
        this.setStatus('finished');
        break;
    }
  }

  /** Execute `code`. `step` pauses at the first trace event; `run` doesn't pause. */
  run(code: string, mode: RunMode): void {
    if (!this.worker || this.status === 'loading' || this.status === 'failed') return;
    // Clear any command left from a previous run before the worker starts
    // consulting the control word again.
    Atomics.store(controlView(this.channel), CTL_COMMAND, CMD_NONE);
    this.setStatus('running');
    this.worker.postMessage({
      type: 'run',
      code,
      mode,
      recursionLimit: this.recursionLimit
    });
  }

  /** Advance one trace event. */
  step(): void {
    if (this.status !== 'paused') return;
    this.setStatus('running');
    sendCommand(this.channel, CMD_STEP);
  }

  /** Run to completion without pausing again. */
  resume(): void {
    if (this.status !== 'paused') return;
    this.setStatus('running');
    sendCommand(this.channel, CMD_CONTINUE);
  }

  /** Pause at the next trace event. Only meaningful while running. */
  pause(): void {
    if (this.status !== 'running') return;
    sendCommand(this.channel, CMD_PAUSE);
  }

  /** Answer the `input()` prompt currently blocking the program. */
  sendInput(text: string): void {
    if (this.status !== 'awaiting-input') return;
    // The engine hands `input()` a line, so the trailing newline the user typed
    // in the box is not part of the value Python sees.
    writeInput(this.channel, text.replace(/\r?\n$/, ''));
    this.setStatus('running');
    sendCommand(this.channel, CMD_INPUT);
  }

  /**
   * Abandon the running program. Cooperative if the program is executing traced
   * Python; otherwise the worker is terminated and rebooted.
   */
  stop(): void {
    if (this.status === 'ready' || this.status === 'loading' || this.status === 'failed') return;
    sendCommand(this.channel, CMD_STOP);
    this.clearStopTimer();
    this.stopTimer = setTimeout(() => this.forceRestart(), STOP_GRACE_MS);
  }

  private clearStopTimer(): void {
    if (this.stopTimer !== null) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
  }

  /** Hard kill for a program that never reaches another trace event. */
  private forceRestart(): void {
    this.clearStopTimer();
    if (this.disposed) return;
    this.worker?.terminate();
    this.worker = null;
    Atomics.store(controlView(this.channel), CTL_COMMAND, CMD_NONE);
    this.callbacks.onOutput({
      stream: 'stderr',
      text: '\nStopped. Restarting Python…\n'
    });
    this.readyPromise = this.spawn();
  }

  /** Whether a Stop request would currently be cooperative rather than a kill. */
  get canStopCooperatively(): boolean {
    return this.isBlocked;
  }

  dispose(): void {
    this.disposed = true;
    this.clearStopTimer();
    this.worker?.terminate();
    this.worker = null;
  }
}
