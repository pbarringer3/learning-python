/**
 * Tests that `exercise-fixtures.ts` still describes the lessons as authored.
 *
 * The fixtures are the specification for the deferred per-exercise `tests`
 * feature (`PythonInterpreterDesign.md` §13), so they are only worth having if
 * they cannot quietly drift from the lessons they came from. These tests pin
 * the two ways that could happen: a lesson's sample run being edited without
 * the fixture, and a new Python exercise being authored without a contract.
 *
 * What is deliberately *not* tested here: that `solution` actually produces
 * `expected`. Running Python needs Pyodide in a browser, and the whole point of
 * the §13 feature is to do that in the app. `expected` was captured from a real
 * run rather than transcribed, so it starts out true; this file keeps it honest.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { chapters } from './index';
import { DEFAULT_CASE_NAME, exerciseFixtures, fixturesFor, testsFor } from './exercise-fixtures';

const routesDir = join(__dirname, '../../routes');

/** `"2/1/exercise-1"` -> `src/routes/2/1/+page.svx` */
function lessonFileFor(key: string): string {
  const [chapter, lesson] = key.split('/');
  return join(routesDir, chapter, lesson, '+page.svx');
}

/** A lesson transcript cannot show trailing spaces, but a prompt really emits one. */
function asTranscript(expected: string[]): string {
  return expected.map((line) => line.replace(/\s+$/, '')).join('\n');
}

/** Minimum non-zero leading-space count, matching the 2-space house style. */
function minIndent(code: string): number {
  let min = Infinity;
  for (const line of code.split('\n')) {
    if (line.trim() === '') continue;
    const leading = line.match(/^( +)/);
    if (leading) min = Math.min(min, leading[1].length);
  }
  return min;
}

function extractPersistenceKeys(content: string): string[] {
  const keys: string[] = [];
  const regex = /persistenceKey:\s*'([^']*)'/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    keys.push(match[1]);
  }
  return keys;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('exercise fixtures', () => {
  for (const fixture of exerciseFixtures) {
    describe(`${fixture.key} — ${fixture.title}`, () => {
      it('points at a lesson that exists', () => {
        expect(existsSync(lessonFileFor(fixture.key))).toBe(true);
      });

      it('matches an exercise authored in that lesson', () => {
        const keys = extractPersistenceKeys(readFileSync(lessonFileFor(fixture.key), 'utf-8'));
        expect(keys, `no exercise in the lesson uses persistenceKey "${fixture.key}"`).toContain(
          fixture.key
        );
      });

      // Not an exact count: one `input()` inside a loop consumes an answer per
      // trip, so the number of calls is not the number of times it appears.
      it('queues answers if and only if the solution asks for input', () => {
        const asks = fixture.solution.includes('input(');
        expect(
          fixture.answers.length > 0,
          asks
            ? 'the solution calls input() but no answers are queued — it would block forever'
            : 'answers are queued for a solution that never calls input()'
        ).toBe(asks);
      });

      it('uses the 2-space indentation the lessons teach', () => {
        const indent = minIndent(fixture.solution);
        expect(indent === Infinity || indent === 2).toBe(true);
      });

      it('produces at least one line of output', () => {
        expect(fixture.expected.length).toBeGreaterThan(0);
      });

      if (fixture.inLesson) {
        it("appears verbatim as the lesson's sample run", () => {
          const lesson = readFileSync(lessonFileFor(fixture.key), 'utf-8');
          expect(
            lesson.includes(asTranscript(fixture.expected)),
            `the transcript in exercise-fixtures.ts is no longer printed in ` +
              `src/routes/${fixture.key.split('/').slice(0, 2).join('/')}/+page.svx. ` +
              `Either the lesson's sample run changed, or the fixture did — make them agree.`
          ).toBe(true);
        });
      }
    });
  }

  it('gives every case in an exercise a distinct name', () => {
    const seen = new Map<string, Set<string>>();
    for (const fixture of exerciseFixtures) {
      const names = seen.get(fixture.key) ?? new Set<string>();
      const name = fixture.caseName ?? DEFAULT_CASE_NAME;
      expect(names.has(name), `two cases of ${fixture.key} are both called "${name}"`).toBe(false);
      names.add(name);
      seen.set(fixture.key, names);
    }
  });

  it('is wired into every exercise it covers, so the button is really there', () => {
    const unwired: string[] = [];

    for (const fixture of exerciseFixtures) {
      const lesson = readFileSync(lessonFileFor(fixture.key), 'utf-8');
      if (!lesson.includes(`testsFor('${fixture.key}')`)) unwired.push(fixture.key);
    }

    expect(
      unwired,
      `these exercises have fixtures but no \`tests: testsFor(...)\` in their ` +
        `PythonConfig, so "Run tests" never appears and they can never turn ✅.`
    ).toEqual([]);
  });

  it('covers every exercise in every Python lesson', () => {
    const uncovered: string[] = [];

    for (const chapter of chapters) {
      for (const lesson of chapter.lessons) {
        const path = join(routesDir, String(chapter.number), String(lesson.number), '+page.svx');
        if (!existsSync(path)) continue;

        const content = readFileSync(path, 'utf-8');
        // Karel exercises are validated by KarelTests and need no fixture.
        if (!content.includes('PythonEnvironment')) continue;

        for (const key of extractPersistenceKeys(content)) {
          if (fixturesFor(key).length === 0) uncovered.push(key);
        }
      }
    }

    expect(
      uncovered,
      `these Python exercises have no verified solution or expected output in ` +
        `exercise-fixtures.ts. Every authored exercise needs one — it is the contract ` +
        `the "Run tests" feature will check against.`
    ).toEqual([]);
  });
});

// ── The bridge into PythonConfig ─────────────────────────────────────────────

describe('testsFor', () => {
  it('builds one case per fixture, in fixture order', () => {
    // 2/5/exercise-2 is the only exercise with a case the lesson does not print.
    const tests = testsFor('2/5/exercise-2');
    expect(tests?.cases).toHaveLength(2);
    expect(tests?.cases[0].name).toBe(DEFAULT_CASE_NAME);
    expect(tests?.cases[1].name).not.toBe(DEFAULT_CASE_NAME);
  });

  it('carries the answers and the expected output through unchanged', () => {
    const fixture = fixturesFor('2/4/exercise-1')[0];
    const tests = testsFor('2/4/exercise-1');

    expect(tests?.cases[0].answers).toEqual(fixture.answers);
    expect(tests?.cases[0].expected).toEqual(fixture.expected);
  });

  it('has a case for every authored exercise', () => {
    for (const fixture of exerciseFixtures) {
      expect(testsFor(fixture.key)?.cases.length, fixture.key).toBeGreaterThan(0);
    }
  });

  // The playground and the worked examples inside lessons have no fixtures, and
  // must not grow a "Run tests" button with nothing behind it.
  it('is undefined for anything that is not an authored exercise', () => {
    expect(testsFor('playground/python')).toBeUndefined();
  });
});
