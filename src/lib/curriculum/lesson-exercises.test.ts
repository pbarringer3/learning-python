/**
 * Tests that each lesson's declared `exerciseCount` matches the number of
 * exercises actually authored in its `.svx` file.
 *
 * A lesson auto-completes once the student finishes `exerciseCount` exercises,
 * so a count that is too low silently marks the lesson done early and a count
 * that is too high makes it impossible to finish. Exercises are identified by
 * their `persistenceKey` — the property that opts an environment into code
 * persistence and completion tracking — so counting keys counts exercises.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { chapters } from './index';

const routesDir = join(__dirname, '../../routes');

/** Path to a lesson's markdown source: src/routes/<chapter>/<lesson>/+page.svx */
function lessonFilePath(chapterNumber: number, lessonNumber: number): string {
  return join(routesDir, String(chapterNumber), String(lessonNumber), '+page.svx');
}

/** Extract every persistenceKey string literal from a lesson file, in order. */
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

describe('lesson exerciseCount matches authored exercises', () => {
  for (const chapter of chapters) {
    describe(`Chapter ${chapter.number}: ${chapter.title}`, () => {
      for (const lesson of chapter.lessons) {
        const filePath = lessonFilePath(chapter.number, lesson.number);
        const relPath = `src/routes/${chapter.number}/${lesson.number}/+page.svx`;

        describe(`${chapter.number}.${lesson.number} ${lesson.title}`, () => {
          it('has a lesson file', () => {
            expect(existsSync(filePath), `missing lesson file: ${relPath}`).toBe(true);
          });

          it(`declares exerciseCount ${lesson.exerciseCount}, matching its persistenceKeys`, () => {
            const keys = extractPersistenceKeys(readFileSync(filePath, 'utf-8'));
            expect(
              keys.length,
              `${relPath} has ${keys.length} exercise(s) but the curriculum index declares ` +
                `exerciseCount: ${lesson.exerciseCount}. Update whichever is wrong ` +
                `(src/lib/curriculum/index.ts or the lesson file).`
            ).toBe(lesson.exerciseCount);
          });

          it('has no duplicate persistenceKeys', () => {
            const keys = extractPersistenceKeys(readFileSync(filePath, 'utf-8'));
            const duplicates = keys.filter((key, i) => keys.indexOf(key) !== i);
            expect(
              [...new Set(duplicates)],
              `${relPath} reuses persistenceKey(s) — duplicate keys share saved code and ` +
                `completion state between exercises.`
            ).toEqual([]);
          });

          it('namespaces persistenceKeys under its own chapter/lesson', () => {
            const keys = extractPersistenceKeys(readFileSync(filePath, 'utf-8'));
            const prefix = `${chapter.number}/${lesson.number}/`;
            const misfiled = keys.filter((key) => !key.startsWith(prefix));
            expect(
              misfiled,
              `${relPath} has persistenceKey(s) not prefixed with "${prefix}" — keys are ` +
                `global, so a mismatched prefix collides with another lesson's exercises.`
            ).toEqual([]);
          });

          if (!lesson.hasExercises) {
            it('declares exerciseCount 0 when hasExercises is false', () => {
              expect(lesson.exerciseCount).toBe(0);
            });
          }
        });
      }
    });
  }
});
