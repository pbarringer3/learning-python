/**
 * The tracer is Python and the host is TypeScript, so the constants they agree
 * on are declared twice. These tests pin the two copies together — a mismatch
 * would show up as the worker silently ignoring a Stop, not as a type error.
 *
 * The tracer's runtime behaviour is exercised end to end in `tests/python.test.ts`,
 * which is the only place a real Pyodide interpreter exists.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CMD_STOP, TRACE_PAUSE, TRACE_RUN, TRACE_STOP } from './protocol';
import { USER_FILENAME } from './config';

const source = readFileSync(join(process.cwd(), 'src/lib/python/tracer.py'), 'utf-8');

/** Read a module-level `NAME = <int>` assignment out of the tracer source. */
function pythonInt(name: string): number {
  const match = source.match(new RegExp(`^${name} = (-?\\d+)$`, 'm'));
  if (!match) throw new Error(`tracer.py does not define ${name}`);
  return Number(match[1]);
}

/** Read a module-level `NAME = "..."` assignment out of the tracer source. */
function pythonString(name: string): string {
  const match = source.match(new RegExp(`^${name} = "([^"]*)"$`, 'm'));
  if (!match) throw new Error(`tracer.py does not define ${name}`);
  return match[1];
}

describe('tracer.py constants', () => {
  it('agrees with protocol.ts on the trace decisions', () => {
    expect(pythonInt('TRACE_RUN')).toBe(TRACE_RUN);
    expect(pythonInt('TRACE_PAUSE')).toBe(TRACE_PAUSE);
    expect(pythonInt('TRACE_STOP')).toBe(TRACE_STOP);
  });

  it('agrees with protocol.ts on the stop command', () => {
    expect(pythonInt('CMD_STOP')).toBe(CMD_STOP);
  });

  it('agrees with config.ts on the sentinel filename', () => {
    expect(pythonString('USER_FILENAME')).toBe(USER_FILENAME);
  });
});

describe('tracer.py structure', () => {
  it('exposes the entry points the worker calls', () => {
    expect(source).toMatch(/^def install\(\):$/m);
    expect(source).toMatch(/^def run_user_code\(source, recursion_limit, tracing\):$/m);
  });

  it('imports the host module the worker registers', () => {
    expect(source).toContain('import _visualizer_host as host');
  });

  it('checks the filename per frame rather than disabling tracing globally', () => {
    // Returning None from the tracer only disables events for *that* frame, so
    // a user callback invoked from library code still gets traced.
    expect(source).toMatch(/if frame\.f_code\.co_filename != USER_FILENAME:\s*\n\s*return None/);
  });

  it('passes the line and event to the host, which owns the breakpoint set', () => {
    // The breakpoint bitmap lives in shared memory on the JavaScript side,
    // because a breakpoint toggled while the worker is blocked in
    // `Atomics.wait` has no other way to reach it (§12.3). The tracer therefore
    // hands over what the host needs to decide, rather than deciding itself.
    expect(source).toContain('host.before_snapshot(frame.f_lineno, event)');
  });

  it('builds the post-mortem snapshots the final banner shows', () => {
    // Both have to work with no tracer installed, so Play keeps its fast path:
    // one from the globals `exec` left behind, one from the traceback's frames.
    expect(source).toMatch(/^def _final_snapshot\(user_globals\):$/m);
    expect(source).toMatch(/^def _error_snapshot\(exc\):$/m);
    expect(source).toContain('exc.__traceback__');
  });

  it('stops tracing before serializing a failure, so the walk is not itself traced', () => {
    // The last such handler is `run_user_code`'s; earlier ones guard `repr()`.
    const failure = source.slice(source.lastIndexOf('    except BaseException as exc:'));
    expect(failure.indexOf('sys.settrace(None)')).toBeLessThan(failure.indexOf('_error_snapshot'));
  });

  it('memoizes heap entries before walking their contents, so cycles terminate', () => {
    const value = source.slice(source.indexOf('    def value(self, value):'));
    const memoize = value.indexOf('self.entries[key] = entry');
    const queue = value.indexOf('self._pending.append');
    expect(memoize).toBeGreaterThan(-1);
    expect(queue).toBeGreaterThan(memoize);
  });
});
