/**
 * Progress Store
 *
 * Svelte writable store backed by localStorage.
 * Tracks which lessons are not-started / in-progress / completed.
 */

import { writable } from 'svelte/store';
import type { SiteProgress, LessonStatus } from './types';

const STORAGE_KEY = 'learning-python-progress';
const CURRENT_VERSION = 1;

function createDefaultProgress(): SiteProgress {
  return {
    version: CURRENT_VERSION,
    lessons: {}
  };
}

function loadProgress(): SiteProgress {
  if (typeof window === 'undefined') return createDefaultProgress();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProgress();

    const parsed = JSON.parse(raw) as SiteProgress;

    // Future: handle schema migrations here
    if (parsed.version !== CURRENT_VERSION) {
      return createDefaultProgress();
    }

    return parsed;
  } catch {
    return createDefaultProgress();
  }
}

function saveProgress(progress: SiteProgress): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // localStorage may be full or unavailable — silently degrade
  }
}

function createProgressStore() {
  const { subscribe, update, set } = writable<SiteProgress>(createDefaultProgress());

  // Hydrate from localStorage once the store is created client-side
  let hydrated = false;

  return {
    subscribe,

    /**
     * Must be called once on the client to load from localStorage.
     * Typically called in onMount of the root layout.
     */
    hydrate() {
      if (hydrated) return;
      hydrated = true;
      const data = loadProgress();
      set(data);
    },

    /**
     * Mark a lesson as visited (in-progress) if not already started.
     */
    markVisited(lessonKey: string) {
      update((progress) => {
        const existing = progress.lessons[lessonKey];
        if (!existing || existing.status === 'not-started') {
          progress.lessons[lessonKey] = {
            lessonId: lessonKey,
            status: 'in-progress'
          };
          progress.lastVisited = lessonKey;
          saveProgress(progress);
        } else {
          progress.lastVisited = lessonKey;
          saveProgress(progress);
        }
        return progress;
      });
    },

    /**
     * Mark a lesson as completed.
     */
    markCompleted(lessonKey: string) {
      update((progress) => {
        progress.lessons[lessonKey] = {
          lessonId: lessonKey,
          status: 'completed',
          completedAt: new Date().toISOString()
        };
        saveProgress(progress);
        return progress;
      });
    },

    /**
     * Mark a specific exercise within a lesson as completed.
     */
    markExerciseCompleted(lessonKey: string, exerciseId: string) {
      update((progress) => {
        if (!progress.lessons[lessonKey]) {
          progress.lessons[lessonKey] = {
            lessonId: lessonKey,
            status: 'in-progress'
          };
        }
        const lesson = progress.lessons[lessonKey];
        if (!lesson.exerciseResults) {
          lesson.exerciseResults = {};
        }
        lesson.exerciseResults[exerciseId] = {
          completed: true,
          completedAt: new Date().toISOString()
        };
        saveProgress(progress);
        return progress;
      });
    },

    /**
     * Get the status for a specific lesson.
     */
    getStatus(progress: SiteProgress, lessonKey: string): LessonStatus {
      return progress.lessons[lessonKey]?.status ?? 'not-started';
    },

    /**
     * Reset all progress (for testing/debug).
     */
    reset() {
      const fresh = createDefaultProgress();
      set(fresh);
      saveProgress(fresh);
    }
  };
}

export const progressStore = createProgressStore();
