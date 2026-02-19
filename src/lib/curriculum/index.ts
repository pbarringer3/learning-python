/**
 * Curriculum Content
 *
 * All chapter and lesson definitions live here.
 * This is the single source of truth for the curriculum structure.
 */

import type { Chapter } from './types';

/**
 * Chapter 1: Karel the Robot
 */
const karel: Chapter = {
  id: 'karel',
  title: 'Karel the Robot',
  number: 1,
  tagline: 'Learn programming fundamentals by commanding a robot',
  description:
    "Meet Karel — a simple robot that lives in a grid world. You'll learn to write Python functions, use control flow, and decompose problems by giving Karel instructions to navigate, pick up beepers, and solve puzzles.",
  accentColor: 'teal',
  lessons: [
    {
      id: 'meet-karel',
      title: 'Meet Karel',
      description:
        'Get introduced to Karel and learn basic commands: move, turn_left, pick_beeper, and put_beeper.',
      number: 1,
      hasExercises: true
    },
    {
      id: 'functions',
      title: 'Defining Functions',
      description:
        'Learn to define your own functions to teach Karel new tricks like turning right.',
      number: 2,
      hasExercises: true
    },
    {
      id: 'decomposition',
      title: 'Decomposition',
      description: 'Break complex problems into smaller, reusable pieces using top-down design.',
      number: 3,
      hasExercises: true
    },
    {
      id: 'while-loops',
      title: 'While Loops',
      description:
        'Use while loops and sensor functions to write programs that adapt to different worlds.',
      number: 4,
      hasExercises: true
    },
    {
      id: 'for-loops',
      title: 'For Loops',
      description: 'Use for loops with range() to repeat actions a specific number of times.',
      number: 5,
      hasExercises: true
    },
    {
      id: 'conditionals',
      title: 'If/Else Statements',
      description: 'Make Karel decide what to do based on its surroundings using conditionals.',
      number: 6,
      hasExercises: true
    },
    {
      id: 'putting-it-together',
      title: 'Putting It All Together',
      description: "Combine everything you've learned to solve complex Karel challenges.",
      number: 7,
      hasExercises: true
    }
  ],
  topics: [
    {
      name: 'Basic Commands',
      description: 'Move, turn, and interact with beepers',
      lessonId: 'meet-karel',
      icon: '🤖'
    },
    {
      name: 'Functions',
      description: 'Define reusable blocks of code',
      lessonId: 'functions',
      icon: '🧩'
    },
    {
      name: 'Decomposition',
      description: 'Break problems into smaller parts',
      lessonId: 'decomposition',
      icon: '🔨'
    },
    {
      name: 'While Loops',
      description: 'Repeat until a condition changes',
      lessonId: 'while-loops',
      icon: '🔄'
    },
    {
      name: 'For Loops',
      description: 'Repeat a fixed number of times',
      lessonId: 'for-loops',
      icon: '🔢'
    },
    {
      name: 'Conditionals',
      description: 'Make decisions with if/else',
      lessonId: 'conditionals',
      icon: '🔀'
    }
  ]
};

/**
 * All chapters in curriculum order.
 * Add new chapters here as they're developed.
 */
export const chapters: Chapter[] = [karel];

/**
 * Look up a chapter by its string ID (e.g. "karel").
 */
export function getChapter(id: string): Chapter | undefined {
  return chapters.find((c) => c.id === id);
}

/**
 * Look up a chapter by its number (e.g. 1).
 */
export function getChapterByNumber(num: number): Chapter | undefined {
  return chapters.find((c) => c.number === num);
}

/**
 * Look up a lesson by chapter number and lesson number.
 */
export function getLessonByNumber(
  chapterNum: number,
  lessonNum: number
): { chapter: Chapter; lesson: Lesson } | undefined {
  const chapter = getChapterByNumber(chapterNum);
  if (!chapter) return undefined;
  const lesson = chapter.lessons.find((l) => l.number === lessonNum);
  if (!lesson) return undefined;
  return { chapter, lesson };
}

type Lesson = Chapter['lessons'][number];

/**
 * Get the next lesson in sequence (across chapters).
 * Returns undefined if at the last lesson.
 */
export function getNextLesson(
  chapterNum: number,
  lessonNum: number
): { chapterNum: number; lesson: Lesson } | undefined {
  const chapterIdx = chapters.findIndex((c) => c.number === chapterNum);
  if (chapterIdx === -1) return undefined;

  const chapter = chapters[chapterIdx];
  const lessonIdx = chapter.lessons.findIndex((l) => l.number === lessonNum);
  if (lessonIdx === -1) return undefined;

  // Next lesson in same chapter
  if (lessonIdx < chapter.lessons.length - 1) {
    return { chapterNum, lesson: chapter.lessons[lessonIdx + 1] };
  }

  // First lesson of next chapter
  if (chapterIdx < chapters.length - 1) {
    const nextChapter = chapters[chapterIdx + 1];
    return { chapterNum: nextChapter.number, lesson: nextChapter.lessons[0] };
  }

  return undefined;
}

/**
 * Get the previous lesson in sequence (across chapters).
 * Returns undefined if at the first lesson.
 */
export function getPreviousLesson(
  chapterNum: number,
  lessonNum: number
): { chapterNum: number; lesson: Lesson } | undefined {
  const chapterIdx = chapters.findIndex((c) => c.number === chapterNum);
  if (chapterIdx === -1) return undefined;

  const chapter = chapters[chapterIdx];
  const lessonIdx = chapter.lessons.findIndex((l) => l.number === lessonNum);
  if (lessonIdx === -1) return undefined;

  // Previous lesson in same chapter
  if (lessonIdx > 0) {
    return { chapterNum, lesson: chapter.lessons[lessonIdx - 1] };
  }

  // Last lesson of previous chapter
  if (chapterIdx > 0) {
    const prevChapter = chapters[chapterIdx - 1];
    return {
      chapterNum: prevChapter.number,
      lesson: prevChapter.lessons[prevChapter.lessons.length - 1]
    };
  }

  return undefined;
}
