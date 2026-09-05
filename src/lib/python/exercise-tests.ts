/**
 * Per-exercise tests for the Python environment.
 *
 * Karel validates the *world* after a program ends. A Python exercise has no
 * world — what it has is what it printed — so a Python test compares **captured
 * stdout** against expected output, with a queue of answers standing in for the
 * person at the keyboard. `PythonInterpreterDesign.md` §13 is the full spec.
 *
 * Three rules decide whether output matches, and all three are invisible on
 * screen, so they are stated to the student in the results panel:
 *
 * 1. **Spaces at the end of a line do not count.** `input()` writes its prompt
 *    with no trailing newline (`tracer.py` `_input`), so `"Width: "` really
 *    does emit that final space — and no lesson transcript can show it. Making
 *    it matter would fail a correct program over a character nobody can see.
 * 2. **Blank lines do count.** They are the visible half of the same coin: the
 *    bare `print()` the lessons teach after every `input()` is what puts the
 *    prompt on a line of its own, and several exercises end on a deliberate
 *    blank line.
 * 3. **Prompt wording counts**, word for word, because the lessons already say
 *    so — 2/3 Exercise 1: "Match the prompts and the two output lines exactly"
 *    — and every exercise prints its prompts in its sample run.
 *
 * The harness is kept separate from `PythonRunner` and talks to it through
 * `TestHost`, so every branch that a real interpreter would take minutes to
 * reach is assertable under Vitest.
 */

/** One run of the student's program with a known answer queue and output. */
export interface PythonTestCase {
  /** Shown in the results panel. */
  name: string;
  /** Queued for `input()`, in order. */
  answers?: string[];
  /** Exact stdout, one string per line, final newline implied. */
  expected: string[];
}

/** The `tests` field of a `PythonConfig`. */
export interface PythonTests {
  cases: PythonTestCase[];
}

/** How long one case may run before it is assumed to be stuck. */
export const TEST_CASE_TIMEOUT_MS = 5000;

/** Why a case failed. Drives which detail the panel shows. */
export type TestFailureKind = 'output' | 'input-exhausted' | 'input-unused' | 'error' | 'timeout';

/** The one line worth showing a student, rather than two whole transcripts. */
export interface OutputDifference {
  /** 1-based line number of the first line that differs. */
  line: number;
  /** `null` when the program stopped printing before this line. */
  expected: string | null;
  /** `null` when the program printed a line that was not expected. */
  actual: string | null;
}

export interface PythonTestResult {
  name: string;
  passed: boolean;
  message: string;
  /** The answers this case fed to `input()`, so a failure can show them. */
  answers: string[];
  kind?: TestFailureKind;
  difference?: OutputDifference;
  /** Both transcripts, kept on a failure for the panel. */
  expected?: string[];
  actual?: string[];
}

/**
 * What the harness needs from `PythonRunner`, and nothing more.
 *
 * `waitUntilReady` exists because a case that had to be killed takes the worker
 * back through `loading`, and `run()` is a no-op while Pyodide is booting.
 */
export interface TestHost {
  waitUntilReady(): Promise<void>;
  run(code: string): void;
  sendInput(text: string): void;
  stop(): void;
}

/**
 * Split captured stdout into comparable lines.
 *
 * The final newline terminates the last line rather than starting a new one, so
 * exactly one is dropped — which is what lets a program that deliberately ends
 * on `print()` keep its trailing blank line.
 */
export function outputLines(stdout: string): string[] {
  const text = stdout.replace(/\r\n/g, '\n');
  if (text === '') return [];
  const body = text.endsWith('\n') ? text.slice(0, -1) : text;
  return body.split('\n').map((line) => line.replace(/[ \t]+$/, ''));
}

/** The same normalisation, for the expected side, which is authored by hand. */
function trimEnd(line: string): string {
  return line.replace(/[ \t]+$/, '');
}

/** The first line on which two transcripts disagree, or `null` if they do not. */
export function firstDifference(expected: string[], actual: string[]): OutputDifference | null {
  const length = Math.max(expected.length, actual.length);
  for (let i = 0; i < length; i++) {
    const want = i < expected.length ? trimEnd(expected[i]) : null;
    const got = i < actual.length ? trimEnd(actual[i]) : null;
    if (want !== got) return { line: i + 1, expected: want, actual: got };
  }
  return null;
}

/**
 * One case in flight.
 *
 * The harness drops its reference the moment the case is decided, so that late
 * events cannot land in the next case — but `runCase` keeps hold of the object,
 * which is how the transcript survives to be judged.
 */
interface ActiveCase {
  output: string;
  queue: string[];
  used: number;
  settle(ending: Ending): void;
}

/** How a case ended, from the harness's point of view. */
type Ending =
  | { kind: 'finished' }
  | { kind: 'error'; message: string }
  | { kind: 'input-exhausted'; asked: number }
  | { kind: 'timeout' };

/**
 * Runs a student's program once per case and reports what came back.
 *
 * The component forwards the runner's callbacks to the `handle*` methods; the
 * harness answers by calling back into the host. Only one case is in flight at
 * a time — the worker holds one program.
 */
export class PythonTestHarness {
  private readonly host: TestHost;
  private readonly timeoutMs: number;

  /** Non-null exactly while a case is running. */
  private active: ActiveCase | null = null;

  constructor(host: TestHost, options: { timeoutMs?: number } = {}) {
    this.host = host;
    this.timeoutMs = options.timeoutMs ?? TEST_CASE_TIMEOUT_MS;
  }

  /** Run every case against `code`, in order. Never rejects. */
  async run(code: string, cases: PythonTestCase[]): Promise<PythonTestResult[]> {
    const results: PythonTestResult[] = [];
    for (const testCase of cases) {
      results.push(await this.runCase(code, testCase));
    }
    return results;
  }

  private async runCase(code: string, testCase: PythonTestCase): Promise<PythonTestResult> {
    const answers = testCase.answers ?? [];
    await this.host.waitUntilReady();

    let active!: ActiveCase;
    const ending = await new Promise<Ending>((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        // Resolve first, then stop: the stop comes back as a `finished` event
        // that must not be mistaken for this case ending normally.
        settle({ kind: 'timeout' });
        this.host.stop();
      }, this.timeoutMs);

      const settle = (result: Ending): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.active = null;
        resolve(result);
      };

      active = { output: '', queue: [...answers], used: 0, settle };
      this.active = active;
      this.host.run(code);
    });

    return judge(testCase, answers, active, ending, this.timeoutMs);
  }

  // ── Event sinks, called by the component ───────────────────────────────────

  handleOutput(text: string): void {
    // Output can arrive after a case is decided — a forced worker restart
    // announces itself on stderr — and must not join the next case.
    if (!this.active) return;
    this.active.output += text;
  }

  handleInputRequest(): void {
    const active = this.active;
    if (!active) return;
    if (active.queue.length === 0) {
      active.settle({ kind: 'input-exhausted', asked: active.used + 1 });
      // Never leave the program blocked in `input()`.
      this.host.stop();
      return;
    }
    active.used++;
    // No echo: a real terminal shows what was typed, stdout does not.
    this.host.sendInput(active.queue.shift() as string);
  }

  handleError(message: string): void {
    this.active?.settle({ kind: 'error', message });
  }

  handleFinish(): void {
    this.active?.settle({ kind: 'finished' });
  }
}

/** Everything known about one finished case, turned into a result. */
function judge(
  testCase: PythonTestCase,
  answers: string[],
  active: ActiveCase,
  ending: Ending,
  timeoutMs: number
): PythonTestResult {
  const base = { name: testCase.name, answers };

  if (ending.kind === 'timeout') {
    const seconds = Math.round(timeoutMs / 100) / 10;
    return {
      ...base,
      passed: false,
      kind: 'timeout',
      message:
        `Your program was still running after ${seconds} seconds, so it was stopped. ` +
        `Look for a loop that never ends.`
    };
  }

  if (ending.kind === 'input-exhausted') {
    return {
      ...base,
      passed: false,
      kind: 'input-exhausted',
      message:
        `Your program asked for more input than this exercise expects: ` +
        `it asked ${ending.asked} times, and this run answers ${answers.length}.`
    };
  }

  if (ending.kind === 'error') {
    return {
      ...base,
      passed: false,
      kind: 'error',
      message: `Your program stopped with an error: ${ending.message}`
    };
  }

  const { output, used } = active;

  // Checked before the output: too few questions asked explains a short
  // transcript far better than a diff of it does.
  if (used < answers.length) {
    return {
      ...base,
      passed: false,
      kind: 'input-unused',
      message:
        `Your program did not ask for all the input this exercise supplies: ` +
        `it asked ${used} time${used === 1 ? '' : 's'}, and ${answers.length} answers were ready.`
    };
  }

  const actual = outputLines(output);
  const difference = firstDifference(testCase.expected, actual);
  if (!difference) {
    return { ...base, passed: true, message: 'The output matches.' };
  }

  return {
    ...base,
    passed: false,
    kind: 'output',
    message: describeDifference(difference),
    difference,
    expected: testCase.expected,
    actual
  };
}

/** The one-line explanation that goes with a `difference`. */
function describeDifference(difference: OutputDifference): string {
  if (difference.actual === null) {
    return `Your output stopped early — line ${difference.line} is missing.`;
  }
  if (difference.expected === null) {
    return `Your output has an extra line ${difference.line}.`;
  }
  return `Line ${difference.line} of your output does not match.`;
}
