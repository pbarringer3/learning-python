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
      hasExercises: true,
      exerciseCount: 2
    },
    {
      id: 'functions',
      title: 'Defining Functions',
      description:
        'Learn to define your own functions to teach Karel new tricks like turning right.',
      number: 2,
      hasExercises: true,
      exerciseCount: 3
    },
    {
      id: 'decomposition',
      title: 'Decomposition',
      description: 'Break complex problems into smaller, reusable pieces using top-down design.',
      number: 3,
      hasExercises: true,
      exerciseCount: 3
    },
    {
      id: 'while-loops',
      title: 'While Loops',
      description:
        'Use while loops and sensor functions to write programs that adapt to different worlds.',
      number: 4,
      hasExercises: true,
      exerciseCount: 4
    },
    {
      id: 'for-loops',
      title: 'For Loops',
      description:
        'Use for loops with range() to count out a job the world gives you no way to sense.',
      number: 5,
      hasExercises: true,
      exerciseCount: 4
    },
    {
      id: 'conditionals',
      title: 'If/Else Statements',
      description: 'Branch with if, else and elif, and combine conditions with and, or, and not.',
      number: 6,
      hasExercises: true,
      exerciseCount: 4
    },
    {
      id: 'putting-it-together',
      title: 'Putting It All Together',
      description: "Combine everything you've learned to solve complex Karel challenges.",
      number: 7,
      hasExercises: true,
      exerciseCount: 6
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
      description: 'Count out a fixed number of repetitions',
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
 * Chapter 2: Hello, Python!
 */
const helloPython: Chapter = {
  id: 'hello-python',
  title: 'Hello, Python!',
  number: 2,
  tagline: 'Write real Python — no robot required',
  description:
    "Karel is off duty. You'll write Python that talks directly to you: printing text, asking questions and doing arithmetic. Everything you learned commanding Karel — loops, indentation, calling functions — comes with you; what's new is that your program finally has a memory instead of a floor full of beepers.",
  accentColor: 'indigo',
  lessons: [
    {
      id: 'from-karel-to-python',
      title: 'From Karel to Python',
      description:
        "What carries over from Karel, what changes, and where your program's state lives now that the grid is gone.",
      number: 1,
      hasExercises: true,
      exerciseCount: 2
    },
    {
      id: 'first-program',
      title: 'Your First Python Program',
      description:
        'print(), string literals, and getting output to look exactly the way you want it.',
      number: 2,
      hasExercises: true,
      exerciseCount: 3
    },
    {
      id: 'getting-input',
      title: 'Getting Input',
      description:
        'input() stops the program and waits for you. Keep what it hands back in a name and the program can use it.',
      number: 3,
      hasExercises: true,
      exerciseCount: 3
    },
    {
      id: 'expressions-and-math',
      title: 'Expressions & Math',
      description:
        'Arithmetic, operator precedence, whole-number division and remainders, and turning typed text into numbers with int().',
      number: 4,
      hasExercises: true,
      exerciseCount: 4
    },
    {
      id: 'mission-control',
      title: 'Putting It Together',
      description:
        'Build Mission Control: a complete interactive program that takes input, does the maths and runs a launch sequence.',
      number: 5,
      hasExercises: true,
      exerciseCount: 3
    }
  ],
  topics: [
    {
      name: 'Output',
      description: 'Show text with print()',
      lessonId: 'first-program',
      icon: '🖨️'
    },
    {
      name: 'Input',
      description: 'Ask a question and wait for an answer',
      lessonId: 'getting-input',
      icon: '💬'
    },
    {
      name: 'Names & Values',
      description: 'Keep a value in memory instead of on the floor',
      lessonId: 'getting-input',
      icon: '🏷️'
    },
    {
      name: 'Arithmetic',
      description: 'Operators, precedence, division and remainders',
      lessonId: 'expressions-and-math',
      icon: '➗'
    },
    {
      name: 'Mission Control',
      description: 'A complete interactive program of your own',
      lessonId: 'mission-control',
      icon: '🚀'
    }
  ]
};

/**
 * All chapters in curriculum order.
 * Add new chapters here as they're developed.
 */
export const chapters: Chapter[] = [karel, helloPython];

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
