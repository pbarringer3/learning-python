/**
 * Unit tests for the progress store
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { createProgressStore } from './progress';
import { getChapterStatus } from './types';
import type { SiteProgress } from './types';
import type { Chapter } from './types';

const STORAGE_KEY = 'learning-python-progress';

// Helper: get the saved progress from localStorage
function getSavedProgress(): SiteProgress | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

describe('progress store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ------------------------------------------------------------------
  // hydrate
  // ------------------------------------------------------------------
  describe('hydrate', () => {
    it('loads empty progress when localStorage is empty', () => {
      const store = createProgressStore();
      store.hydrate();
      const progress = get(store);
      expect(progress.version).toBe(1);
      expect(progress.lessons).toEqual({});
    });

    it('loads existing progress from localStorage', () => {
      const saved: SiteProgress = {
        version: 1,
        lessons: {
          '1/1': { lessonId: '1/1', status: 'completed', completedAt: '2025-01-01' }
        }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

      const store = createProgressStore();
      store.hydrate();
      const progress = get(store);

      expect(progress.lessons['1/1'].status).toBe('completed');
    });

    it('resets progress if version does not match', () => {
      const saved = { version: 999, lessons: { '1/1': { lessonId: '1/1', status: 'completed' } } };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

      const store = createProgressStore();
      store.hydrate();
      const progress = get(store);

      expect(progress.version).toBe(1);
      expect(progress.lessons).toEqual({});
    });

    it('only hydrates once', () => {
      const store = createProgressStore();
      store.hydrate();
      // Set some data after first hydrate
      store.markVisited('1/1');
      // Calling hydrate again should not overwrite
      store.hydrate();
      const progress = get(store);
      expect(progress.lessons['1/1']).toBeDefined();
    });
  });

  // ------------------------------------------------------------------
  // markVisited
  // ------------------------------------------------------------------
  describe('markVisited', () => {
    it('does nothing before hydrate is called', () => {
      const store = createProgressStore();
      store.markVisited('1/1');
      const progress = get(store);
      expect(progress.lessons).toEqual({});
    });

    it('marks a new lesson as in-progress', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markVisited('1/1');

      const progress = get(store);
      expect(progress.lessons['1/1'].status).toBe('in-progress');
      expect(progress.lastVisited).toBe('1/1');
    });

    it('does not overwrite a completed lesson', () => {
      const saved: SiteProgress = {
        version: 1,
        lessons: {
          '1/1': { lessonId: '1/1', status: 'completed', completedAt: '2025-01-01' }
        }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

      const store = createProgressStore();
      store.hydrate();
      store.markVisited('1/1');

      const progress = get(store);
      expect(progress.lessons['1/1'].status).toBe('completed');
    });

    it('preserves exerciseResults when marking as visited', () => {
      const saved: SiteProgress = {
        version: 1,
        lessons: {
          '1/1': {
            lessonId: '1/1',
            status: 'not-started',
            exerciseResults: {
              'exercise-1': { completed: true, completedAt: '2025-01-01' }
            }
          }
        }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

      const store = createProgressStore();
      store.hydrate();
      store.markVisited('1/1');

      const progress = get(store);
      expect(progress.lessons['1/1'].status).toBe('in-progress');
      expect(progress.lessons['1/1'].exerciseResults?.['exercise-1']?.completed).toBe(true);
    });

    it('updates lastVisited', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markVisited('1/1');
      store.markVisited('1/2');

      const progress = get(store);
      expect(progress.lastVisited).toBe('1/2');
    });

    it('persists to localStorage', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markVisited('1/1');

      const saved = getSavedProgress();
      expect(saved?.lessons['1/1']?.status).toBe('in-progress');
    });
  });

  // ------------------------------------------------------------------
  // markCompleted
  // ------------------------------------------------------------------
  describe('markCompleted', () => {
    it('marks a lesson as completed', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markCompleted('1/1');

      const progress = get(store);
      expect(progress.lessons['1/1'].status).toBe('completed');
      expect(progress.lessons['1/1'].completedAt).toBeDefined();
    });

    it('preserves exerciseResults when marking as completed', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markExerciseCompleted('1/1', 'exercise-1');
      store.markCompleted('1/1');

      const progress = get(store);
      expect(progress.lessons['1/1'].status).toBe('completed');
      expect(progress.lessons['1/1'].exerciseResults?.['exercise-1']?.completed).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // markExerciseCompleted
  // ------------------------------------------------------------------
  describe('markExerciseCompleted', () => {
    it('records exercise completion', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markExerciseCompleted('1/1', 'exercise-1');

      const progress = get(store);
      expect(progress.lessons['1/1'].exerciseResults?.['exercise-1']?.completed).toBe(true);
      expect(progress.lessons['1/1'].exerciseResults?.['exercise-1']?.completedAt).toBeDefined();
    });

    it('creates lesson entry if it does not exist', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markExerciseCompleted('1/3', 'exercise-1');

      const progress = get(store);
      expect(progress.lessons['1/3']).toBeDefined();
      expect(progress.lessons['1/3'].status).toBe('in-progress');
    });

    it('does not auto-complete lesson when exerciseCount is not provided', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markExerciseCompleted('1/1', 'exercise-1');
      store.markExerciseCompleted('1/1', 'exercise-2');

      const progress = get(store);
      expect(progress.lessons['1/1'].status).toBe('in-progress');
    });

    it('does not auto-complete lesson if not all exercises are done', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markExerciseCompleted('1/1', 'exercise-1', 3);

      const progress = get(store);
      expect(progress.lessons['1/1'].status).toBe('in-progress');
    });

    it('auto-completes lesson when all exercises are done', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markExerciseCompleted('1/1', 'exercise-1', 2);
      store.markExerciseCompleted('1/1', 'exercise-2', 2);

      const progress = get(store);
      expect(progress.lessons['1/1'].status).toBe('completed');
      expect(progress.lessons['1/1'].completedAt).toBeDefined();
    });

    it('auto-completes lesson even if exercises are recorded out of order', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markExerciseCompleted('1/2', 'exercise-3', 3);
      store.markExerciseCompleted('1/2', 'exercise-1', 3);
      store.markExerciseCompleted('1/2', 'exercise-2', 3);

      const progress = get(store);
      expect(progress.lessons['1/2'].status).toBe('completed');
    });

    it('persists exercise completion to localStorage', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markExerciseCompleted('1/1', 'exercise-1', 2);

      const saved = getSavedProgress();
      expect(saved?.lessons['1/1']?.exerciseResults?.['exercise-1']?.completed).toBe(true);
    });

    it('persists auto-completed lesson to localStorage', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markExerciseCompleted('1/1', 'exercise-1', 2);
      store.markExerciseCompleted('1/1', 'exercise-2', 2);

      const saved = getSavedProgress();
      expect(saved?.lessons['1/1']?.status).toBe('completed');
    });
  });

  // ------------------------------------------------------------------
  // clearExerciseCompleted
  // ------------------------------------------------------------------
  describe('clearExerciseCompleted', () => {
    it('removes the exercise result', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markExerciseCompleted('1/1', 'exercise-1');
      store.clearExerciseCompleted('1/1', 'exercise-1');

      const progress = get(store);
      expect(progress.lessons['1/1'].exerciseResults?.['exercise-1']).toBeUndefined();
    });

    it('does not crash when clearing a non-existent exercise', () => {
      const store = createProgressStore();
      store.hydrate();
      expect(() => store.clearExerciseCompleted('1/1', 'exercise-99')).not.toThrow();
    });

    it('leaves other exercises intact', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markExerciseCompleted('1/1', 'exercise-1');
      store.markExerciseCompleted('1/1', 'exercise-2');
      store.clearExerciseCompleted('1/1', 'exercise-1');

      const progress = get(store);
      expect(progress.lessons['1/1'].exerciseResults?.['exercise-1']).toBeUndefined();
      expect(progress.lessons['1/1'].exerciseResults?.['exercise-2']?.completed).toBe(true);
    });

    it('persists the cleared state to localStorage', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markExerciseCompleted('1/1', 'exercise-1');
      store.clearExerciseCompleted('1/1', 'exercise-1');

      const saved = getSavedProgress();
      expect(saved?.lessons['1/1']?.exerciseResults?.['exercise-1']).toBeUndefined();
    });

    it('reverts lesson from completed to in-progress', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markExerciseCompleted('1/1', 'exercise-1', 2);
      store.markExerciseCompleted('1/1', 'exercise-2', 2);

      // Lesson should be auto-completed
      let progress = get(store);
      expect(progress.lessons['1/1'].status).toBe('completed');

      // Clearing one exercise should revert lesson to in-progress
      store.clearExerciseCompleted('1/1', 'exercise-1');
      progress = get(store);
      expect(progress.lessons['1/1'].status).toBe('in-progress');
      expect(progress.lessons['1/1'].completedAt).toBeUndefined();
    });
  });

  // ------------------------------------------------------------------
  // getStatus
  // ------------------------------------------------------------------
  describe('getStatus', () => {
    it('returns not-started for unknown lessons', () => {
      const store = createProgressStore();
      store.hydrate();
      const progress = get(store);
      expect(store.getStatus(progress, '99/99')).toBe('not-started');
    });

    it('returns the correct status for tracked lessons', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markVisited('1/1');
      store.markCompleted('1/2');

      const progress = get(store);
      expect(store.getStatus(progress, '1/1')).toBe('in-progress');
      expect(store.getStatus(progress, '1/2')).toBe('completed');
    });
  });

  // ------------------------------------------------------------------
  // reset
  // ------------------------------------------------------------------
  describe('reset', () => {
    it('clears all progress', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markVisited('1/1');
      store.markExerciseCompleted('1/1', 'exercise-1');
      store.reset();

      const progress = get(store);
      expect(progress.lessons).toEqual({});
    });

    it('persists the reset to localStorage', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markVisited('1/1');
      store.reset();

      const saved = getSavedProgress();
      expect(saved?.lessons).toEqual({});
    });
  });

  // ------------------------------------------------------------------
  // Round-trip persistence
  // ------------------------------------------------------------------
  describe('round-trip persistence', () => {
    it('exercise completion survives a full hydrate cycle', () => {
      // Simulate first session: complete an exercise
      const store1 = createProgressStore();
      store1.hydrate();
      store1.markVisited('1/1');
      store1.markExerciseCompleted('1/1', 'exercise-1', 2);

      // Simulate second session: create a new store and hydrate from localStorage
      const store2 = createProgressStore();
      store2.hydrate();

      const progress = get(store2);
      expect(progress.lessons['1/1'].status).toBe('in-progress');
      expect(progress.lessons['1/1'].exerciseResults?.['exercise-1']?.completed).toBe(true);
    });

    it('markVisited in a new session does not wipe exerciseResults', () => {
      // First session: complete an exercise
      const store1 = createProgressStore();
      store1.hydrate();
      store1.markExerciseCompleted('1/1', 'exercise-1', 2);

      // Second session: hydrate then visit the same lesson
      const store2 = createProgressStore();
      store2.hydrate();
      store2.markVisited('1/1');

      const progress = get(store2);
      expect(progress.lessons['1/1'].exerciseResults?.['exercise-1']?.completed).toBe(true);
    });

    it('full lesson completion survives a hydrate cycle', () => {
      // First session: complete all exercises
      const store1 = createProgressStore();
      store1.hydrate();
      store1.markExerciseCompleted('1/1', 'exercise-1', 2);
      store1.markExerciseCompleted('1/1', 'exercise-2', 2);

      // Second session
      const store2 = createProgressStore();
      store2.hydrate();

      const progress = get(store2);
      expect(progress.lessons['1/1'].status).toBe('completed');
      expect(progress.lessons['1/1'].exerciseResults?.['exercise-1']?.completed).toBe(true);
      expect(progress.lessons['1/1'].exerciseResults?.['exercise-2']?.completed).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // Chapter completion (derived from lesson progress)
  // ------------------------------------------------------------------
  describe('chapter completion', () => {
    // A minimal 2-lesson chapter for testing
    const testChapter: Chapter = {
      id: 'test',
      title: 'Test Chapter',
      number: 1,
      tagline: 'test',
      description: 'test',
      accentColor: 'teal',
      lessons: [
        {
          id: 'lesson-1',
          title: 'Lesson 1',
          description: '',
          number: 1,
          hasExercises: true,
          exerciseCount: 2
        },
        {
          id: 'lesson-2',
          title: 'Lesson 2',
          description: '',
          number: 2,
          hasExercises: true,
          exerciseCount: 1
        }
      ],
      topics: []
    };

    it('chapter is not-started when no lessons visited', () => {
      const store = createProgressStore();
      store.hydrate();
      const progress = get(store);
      expect(getChapterStatus(testChapter, progress)).toBe('not-started');
    });

    it('chapter is in-progress when some lessons visited', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markVisited('1/1');
      const progress = get(store);
      expect(getChapterStatus(testChapter, progress)).toBe('in-progress');
    });

    it('chapter is in-progress when some but not all lessons completed', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markCompleted('1/1');
      store.markVisited('1/2');
      const progress = get(store);
      expect(getChapterStatus(testChapter, progress)).toBe('in-progress');
    });

    it('chapter is completed when all lessons are completed', () => {
      const store = createProgressStore();
      store.hydrate();
      store.markCompleted('1/1');
      store.markCompleted('1/2');
      const progress = get(store);
      expect(getChapterStatus(testChapter, progress)).toBe('completed');
    });

    it('chapter is completed via exercise auto-completion of all lessons', () => {
      const store = createProgressStore();
      store.hydrate();
      // Complete all exercises in lesson 1 (exerciseCount: 2)
      store.markExerciseCompleted('1/1', 'exercise-1', 2);
      store.markExerciseCompleted('1/1', 'exercise-2', 2);
      // Complete all exercises in lesson 2 (exerciseCount: 1)
      store.markExerciseCompleted('1/2', 'exercise-1', 1);

      const progress = get(store);
      expect(getChapterStatus(testChapter, progress)).toBe('completed');
    });

    it('chapter reverts to in-progress when an exercise is reset', () => {
      const store = createProgressStore();
      store.hydrate();
      // Complete all exercises in both lessons
      store.markExerciseCompleted('1/1', 'exercise-1', 2);
      store.markExerciseCompleted('1/1', 'exercise-2', 2);
      store.markExerciseCompleted('1/2', 'exercise-1', 1);

      // Chapter should be completed
      let progress = get(store);
      expect(getChapterStatus(testChapter, progress)).toBe('completed');

      // Reset one exercise — lesson 1 reverts to in-progress
      store.clearExerciseCompleted('1/1', 'exercise-1');

      // Chapter should revert to in-progress
      progress = get(store);
      expect(getChapterStatus(testChapter, progress)).toBe('in-progress');
    });

    it('chapter stays in-progress after reset even across hydrate cycles', () => {
      const store1 = createProgressStore();
      store1.hydrate();
      // Complete all
      store1.markExerciseCompleted('1/1', 'exercise-1', 2);
      store1.markExerciseCompleted('1/1', 'exercise-2', 2);
      store1.markExerciseCompleted('1/2', 'exercise-1', 1);
      // Reset one
      store1.clearExerciseCompleted('1/1', 'exercise-1');

      // New session
      const store2 = createProgressStore();
      store2.hydrate();
      const progress = get(store2);

      // Lesson 1 should be in-progress, lesson 2 completed
      expect(progress.lessons['1/1'].status).toBe('in-progress');
      expect(progress.lessons['1/2'].status).toBe('completed');
      // Chapter should be in-progress
      expect(getChapterStatus(testChapter, progress)).toBe('in-progress');
    });
  });
});
