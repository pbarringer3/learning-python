/**
 * Curriculum Data Structures
 *
 * Defines the shape of chapters, lessons, and progress tracking used
 * throughout the site for navigation, progress display, and routing.
 */

/** Status of a lesson for a given student */
export type LessonStatus = 'not-started' | 'in-progress' | 'completed';

/** A single lesson within a chapter */
export interface Lesson {
  /** URL-friendly identifier, e.g. "meet-karel" */
  id: string;
  /** Display title, e.g. "Meet Karel" */
  title: string;
  /** Short description (1-2 sentences) */
  description: string;
  /** Lesson number within its chapter (1-indexed) */
  number: number;
  /** Whether the lesson has graded exercises (affects completion criteria) */
  hasExercises: boolean;
}

/** Key topic/concept taught in a chapter, shown as topic cards */
export interface ChapterTopic {
  /** Topic name, e.g. "While Loops" */
  name: string;
  /** Short description */
  description: string;
  /** Lesson ID where this topic is primarily taught */
  lessonId: string;
  /** Emoji or icon identifier */
  icon: string;
}

/** A chapter in the curriculum */
export interface Chapter {
  /** URL-friendly identifier, e.g. "karel" */
  id: string;
  /** Display title, e.g. "Karel the Robot" */
  title: string;
  /** Chapter number (1-indexed) */
  number: number;
  /** Short tagline for the chapter */
  tagline: string;
  /** Longer description for the chapter landing page */
  description: string;
  /** Accent color class (Tailwind), e.g. "teal" */
  accentColor: string;
  /** Ordered list of lessons */
  lessons: Lesson[];
  /** Key topics covered (shown as cards on chapter landing page) */
  topics: ChapterTopic[];
}

/** Progress for a single lesson, stored in localStorage */
export interface LessonProgress {
  lessonId: string;
  status: LessonStatus;
  completedAt?: string; // ISO timestamp
  exerciseResults?: {
    [exerciseId: string]: {
      completed: boolean;
      completedAt?: string;
    };
  };
}

/** Top-level progress data stored in localStorage */
export interface SiteProgress {
  version: number; // schema version for future migrations
  lessons: { [lessonId: string]: LessonProgress };
  lastVisited?: string; // full lesson path, e.g. "karel/meet-karel"
}

/**
 * Returns the progress storage key for a lesson: "<chapterNumber>/<lessonNumber>"
 */
export function progressKey(chapterNumber: number, lessonNumber: number): string {
  return `${chapterNumber}/${lessonNumber}`;
}

/**
 * Derives the chapter-level status from its lessons' progress.
 */
export function getChapterStatus(chapter: Chapter, progress: SiteProgress): LessonStatus {
  const lessonStatuses = chapter.lessons.map((lesson) => {
    const key = progressKey(chapter.number, lesson.number);
    return progress.lessons[key]?.status ?? 'not-started';
  });

  if (lessonStatuses.every((s) => s === 'completed')) return 'completed';
  if (lessonStatuses.some((s) => s !== 'not-started')) return 'in-progress';
  return 'not-started';
}

/**
 * Returns the route path for a lesson: /<chapterNumber>/<lessonNumber>
 */
export function lessonPath(chapterNumber: number, lessonNumber: number): string {
  return `/${chapterNumber}/${lessonNumber}`;
}

/**
 * Returns the route path for a chapter landing page: /<chapterNumber>
 */
export function chapterPath(chapterNumber: number): string {
  return `/${chapterNumber}`;
}
