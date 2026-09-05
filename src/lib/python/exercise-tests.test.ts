/**
 * The exercise test harness, driven by a fake host.
 *
 * The harness is deliberately separable from `PythonRunner`: it consumes
 * output/input/finish events and issues run/sendInput/stop, and nothing more.
 * That keeps every branch — a dry answer queue, leftover answers, a program
 * that raises, one that never ends — assertable here rather than only in a
 * browser with a real interpreter. See `PythonInterpreterDesign.md` §13.
 */
import { describe, it, expect } from 'vitest';
import {
  PythonTestHarness,
  firstDifference,
  outputLines,
  type PythonTestCase,
  type TestHost
} from './exercise-tests';

// ── A host that plays a scripted worker ──────────────────────────────────────

type Script = (harness: PythonTestHarness) => void;

/**
 * Stands in for `PythonRunner`. Each `run()` plays the next script one turn
 * behind the caller — a real worker never answers synchronously either.
 */
class FakeHost implements TestHost {
  runs: string[] = [];
  inputs: string[] = [];
  stops = 0;
  readyWaits = 0;
  harness!: PythonTestHarness;

  constructor(private scripts: Script[]) {}

  async waitUntilReady(): Promise<void> {
    this.readyWaits++;
  }

  run(code: string): void {
    this.runs.push(code);
    const script = this.scripts[this.runs.length - 1];
    queueMicrotask(() => script?.(this.harness));
  }

  sendInput(text: string): void {
    this.inputs.push(text);
  }

  stop(): void {
    this.stops++;
    // A cooperative stop comes back as an ordinary finish.
    queueMicrotask(() => this.harness.handleFinish());
  }
}

function harnessWith(scripts: Script[], timeoutMs = 50): [PythonTestHarness, FakeHost] {
  const host = new FakeHost(scripts);
  const harness = new PythonTestHarness(host, { timeoutMs });
  host.harness = harness;
  return [harness, host];
}

/** A script that prints `text` verbatim and ends. */
const prints =
  (text: string): Script =>
  (h) => {
    h.handleOutput(text);
    h.handleFinish();
  };

const testCase = (over: Partial<PythonTestCase> = {}): PythonTestCase => ({
  name: 'Sample run',
  expected: ['hello'],
  ...over
});

// ── Pure output handling ─────────────────────────────────────────────────────

describe('outputLines', () => {
  it('drops the newline that terminates the last line', () => {
    expect(outputLines('a\nb\n')).toEqual(['a', 'b']);
  });

  it('keeps a deliberate trailing blank line', () => {
    // `print("b")` then `print()` — the blank line is part of the contract.
    expect(outputLines('a\nb\n\n')).toEqual(['a', 'b', '']);
  });

  it('ignores spaces at the end of a line, so a prompt need not be exact', () => {
    expect(outputLines('Width: \n')).toEqual(['Width:']);
    expect(outputLines('Width:\n')).toEqual(['Width:']);
  });

  it('normalises CRLF', () => {
    expect(outputLines('a\r\nb\r\n')).toEqual(['a', 'b']);
  });

  it('treats no output as no lines', () => {
    expect(outputLines('')).toEqual([]);
  });

  it('keeps a last line that was never terminated', () => {
    expect(outputLines('Width: ')).toEqual(['Width:']);
  });
});

describe('firstDifference', () => {
  it('finds nothing when the output matches', () => {
    expect(firstDifference(['a', 'b'], ['a', 'b'])).toBeNull();
  });

  it('ignores trailing spaces on the expected side too', () => {
    expect(firstDifference(['Width: '], ['Width:'])).toBeNull();
  });

  it('reports the first line that differs, 1-based', () => {
    expect(firstDifference(['a', 'b', 'c'], ['a', 'x', 'c'])).toEqual({
      line: 2,
      expected: 'b',
      actual: 'x'
    });
  });

  it('reports a missing line when the program stopped early', () => {
    expect(firstDifference(['a', 'b'], ['a'])).toEqual({ line: 2, expected: 'b', actual: null });
  });

  it('reports an extra line when the program printed too much', () => {
    expect(firstDifference(['a'], ['a', 'b'])).toEqual({ line: 2, expected: null, actual: 'b' });
  });
});

// ── The harness ──────────────────────────────────────────────────────────────

describe('PythonTestHarness', () => {
  it('passes a case whose output matches', async () => {
    const [harness] = harnessWith([prints('hello\n')]);
    const results = await harness.run('print("hello")', [testCase()]);

    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(true);
    expect(results[0].name).toBe('Sample run');
  });

  it('runs the student code, not the fixture solution', async () => {
    const [harness, host] = harnessWith([prints('hello\n')]);
    await harness.run('print("hello")', [testCase()]);

    expect(host.runs).toEqual(['print("hello")']);
  });

  it('waits for the runner to be idle before each case', async () => {
    const [harness, host] = harnessWith([prints('hello\n'), prints('hello\n')]);
    await harness.run('code', [testCase(), testCase({ name: 'Second' })]);

    expect(host.readyWaits).toBe(2);
    expect(host.runs).toHaveLength(2);
  });

  it('runs cases sequentially and reports each by name', async () => {
    const [harness] = harnessWith([prints('one\n'), prints('two\n')]);
    const results = await harness.run('code', [
      testCase({ name: 'First', expected: ['one'] }),
      testCase({ name: 'Second', expected: ['two'] })
    ]);

    expect(results.map((r) => [r.name, r.passed])).toEqual([
      ['First', true],
      ['Second', true]
    ]);
  });

  it('feeds the queued answers to input(), in order', async () => {
    const script: Script = (h) => {
      h.handleOutput('Width: ');
      h.handleInputRequest();
      h.handleOutput('\nHeight: ');
      h.handleInputRequest();
      h.handleOutput('\nArea: 21\n');
      h.handleFinish();
    };
    const [harness, host] = harnessWith([script]);
    const results = await harness.run('code', [
      testCase({ answers: ['7', '3'], expected: ['Width:', 'Height:', 'Area: 21'] })
    ]);

    expect(host.inputs).toEqual(['7', '3']);
    expect(results[0].passed).toBe(true);
  });

  it('never echoes the answer, the way a terminal would', async () => {
    // The interactive console prints what the student typed; stdout does not.
    const script: Script = (h) => {
      h.handleOutput('Name: ');
      h.handleInputRequest();
      h.handleOutput('\nHi Ada\n');
      h.handleFinish();
    };
    const [harness] = harnessWith([script]);
    const results = await harness.run('code', [
      testCase({ answers: ['Ada'], expected: ['Name:', 'Hi Ada'] })
    ]);

    expect(results[0].passed).toBe(true);
  });

  it('reports the first differing line rather than the whole transcript', async () => {
    const [harness] = harnessWith([prints('a\nx\nc\n')]);
    const results = await harness.run('code', [testCase({ expected: ['a', 'b', 'c'] })]);

    expect(results[0].passed).toBe(false);
    expect(results[0].kind).toBe('output');
    expect(results[0].difference).toEqual({ line: 2, expected: 'b', actual: 'x' });
  });

  it('keeps both transcripts on a failure, for the panel to show', async () => {
    const [harness] = harnessWith([prints('a\nx\n')]);
    const results = await harness.run('code', [testCase({ expected: ['a', 'b'] })]);

    expect(results[0].expected).toEqual(['a', 'b']);
    expect(results[0].actual).toEqual(['a', 'x']);
  });

  it('fails, and stops the program, when the answer queue runs dry', async () => {
    const script: Script = (h) => {
      h.handleOutput('One: ');
      h.handleInputRequest();
      h.handleOutput('\nTwo: ');
      h.handleInputRequest();
    };
    const [harness, host] = harnessWith([script]);
    const results = await harness.run('code', [testCase({ answers: ['7'], expected: ['One:'] })]);

    expect(results[0].passed).toBe(false);
    expect(results[0].kind).toBe('input-exhausted');
    expect(results[0].message).toMatch(/more input/i);
    // The program must not be left blocked in input().
    expect(host.stops).toBe(1);
  });

  it('fails when the program asks for less input than the case supplies', async () => {
    const script: Script = (h) => {
      h.handleOutput('One: ');
      h.handleInputRequest();
      h.handleOutput('\ndone\n');
      h.handleFinish();
    };
    const [harness] = harnessWith([script]);
    const results = await harness.run('code', [
      testCase({ answers: ['7', '3'], expected: ['One:', 'done'] })
    ]);

    expect(results[0].passed).toBe(false);
    expect(results[0].kind).toBe('input-unused');
  });

  it('reports a program that raised, with its message', async () => {
    const script: Script = (h) => {
      h.handleOutput('a\n');
      h.handleError("NameError: name 'wdith' is not defined");
    };
    const [harness] = harnessWith([script]);
    const results = await harness.run('code', [testCase({ expected: ['a'] })]);

    expect(results[0].passed).toBe(false);
    expect(results[0].kind).toBe('error');
    expect(results[0].message).toContain('wdith');
  });

  it('stops a program that never ends, and says so', async () => {
    const [harness, host] = harnessWith([() => {}], 20);
    const results = await harness.run('while True: pass', [testCase()]);

    expect(results[0].passed).toBe(false);
    expect(results[0].kind).toBe('timeout');
    expect(host.stops).toBe(1);
  });

  it('carries on to the next case after one fails', async () => {
    const [harness] = harnessWith([prints('wrong\n'), prints('two\n')]);
    const results = await harness.run('code', [
      testCase({ name: 'First', expected: ['one'] }),
      testCase({ name: 'Second', expected: ['two'] })
    ]);

    expect(results.map((r) => r.passed)).toEqual([false, true]);
  });

  it('ignores output arriving after a case has been decided', async () => {
    // A forced worker restart writes "Stopped. Restarting Python…" long after
    // the case that provoked it was resolved.
    const [harness, host] = harnessWith([
      (h) => {
        h.handleFinish();
        h.handleOutput('\nStopped. Restarting Python…\n');
      },
      prints('two\n')
    ]);
    const results = await harness.run('code', [
      testCase({ name: 'First', expected: [] }),
      testCase({ name: 'Second', expected: ['two'] })
    ]);

    expect(results.map((r) => r.passed)).toEqual([true, true]);
    expect(host.runs).toHaveLength(2);
  });

  it('records the answers a case used, so a failure can show them', async () => {
    const script: Script = (h) => {
      h.handleInputRequest();
      h.handleOutput('nope\n');
      h.handleFinish();
    };
    const [harness] = harnessWith([script]);
    const results = await harness.run('code', [testCase({ answers: ['5'], expected: ['5'] })]);

    expect(results[0].answers).toEqual(['5']);
  });
});
