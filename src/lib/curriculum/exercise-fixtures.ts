/**
 * Verified solutions and exact expected output for the authored exercises.
 *
 * Every entry has been executed: `expected` is captured stdout, not a
 * transcription of the lesson. Three things depend on that being true.
 *
 * 1. It is the **specification** for the deferred per-exercise `tests` feature
 *    (`PythonInterpreterDesign.md` §13). An exercise passes when a student's
 *    program, fed `answers`, prints `expected`.
 * 2. It is a **regression test** on the lessons: `exercise-fixtures.test.ts`
 *    checks that each transcript still appears verbatim in its lesson prose, so
 *    editing a lesson's sample run without editing the fixture fails the build.
 * 3. It gives the future test harness a **known-passing program** per exercise
 *    to validate itself against.
 *
 * Two properties of this environment are baked into `expected`, and any harness
 * that compares output has to reproduce them (`tracer.py` `_input`):
 *
 * - `input()` writes its prompt to stdout **with no trailing newline**, so a
 *   prompt shares its line with whatever the program prints next. That is why
 *   the lessons teach a bare `print()` after every `input()`, and why prompt
 *   lines here end in a space that a lesson transcript cannot show.
 * - What the student types is **never echoed** into the output, unlike a real
 *   terminal.
 */

import type { PythonTests } from '$lib/python/exercise-tests';

/** A verified solution to one exercise, with the exact output it produces. */
export interface ExerciseFixture {
  /** The exercise's `persistenceKey`, e.g. `"2/1/exercise-1"`. */
  key: string;
  /** Human-readable name, matching the lesson's exercise heading. */
  title: string;
  /** A program that solves the exercise. Not the only correct one. */
  solution: string;
  /** Answers fed to `input()` in order. Empty when the exercise asks nothing. */
  answers: string[];
  /**
   * Exact stdout, one string per line, final newline implied. Prompt lines keep
   * the trailing space the prompt really emits.
   */
  expected: string[];
  /**
   * Whether this transcript is printed in the lesson as a sample run. A `false`
   * entry is an extra case the prose only describes in words — a second test
   * case for the same exercise, not a second exercise.
   */
  inLesson: boolean;
  /**
   * What the results panel calls this case. Defaults to `DEFAULT_CASE_NAME`,
   * which is what a lesson calls the run it prints; set it on the extra cases,
   * so a student can tell which one failed.
   */
  caseName?: string;
}

/** What a case is called when it is the run the lesson prints. */
export const DEFAULT_CASE_NAME = 'The sample run';

export const exerciseFixtures: ExerciseFixture[] = [
  {
    key: '2/1/exercise-1',
    title: 'Roll Call',
    solution: `print("Crew check")
for i in range(5):
  print("Crew member", i)
print("All aboard")
`,
    answers: [],
    expected: [
      'Crew check',
      'Crew member 0',
      'Crew member 1',
      'Crew member 2',
      'Crew member 3',
      'Crew member 4',
      'All aboard'
    ],
    inLesson: true
  },
  {
    key: '2/1/exercise-2',
    title: 'Knock Knock Rounds',
    solution: `for i in range(3):
  print("Round", i)
  for j in range(3):
    print("knock")
  print()
`,
    answers: [],
    expected: [
      'Round 0',
      'knock',
      'knock',
      'knock',
      '',
      'Round 1',
      'knock',
      'knock',
      'knock',
      '',
      'Round 2',
      'knock',
      'knock',
      'knock',
      ''
    ],
    inLesson: true
  },
  {
    key: '2/2/exercise-1',
    title: 'The Sign',
    solution: `print("KAREL'S DINER")
print("Open 24 hours")
print('The sign says "Beepers Welcome"')
`,
    answers: [],
    expected: ["KAREL'S DINER", 'Open 24 hours', 'The sign says "Beepers Welcome"'],
    inLesson: true
  },
  {
    key: '2/2/exercise-2',
    title: 'Two Ways',
    solution: `print("Karel", "says", "hello")
print("Karel" + " says " + "hello")
print("Karel" + "says" + "hello")
`,
    answers: [],
    expected: ['Karel says hello', 'Karel says hello', 'Karelsayshello'],
    inLesson: true
  },
  {
    key: '2/2/exercise-3',
    title: 'The Staircase',
    solution: `print("Ascending")
for i in range(5):
  print(" " * i + "step")
print("Arrived")
`,
    answers: [],
    expected: ['Ascending', 'step', ' step', '  step', '   step', '    step', 'Arrived'],
    inLesson: true
  },
  {
    key: '2/3/exercise-1',
    title: 'Say My Name',
    solution: `name = input("What is your name? ")
print()
food = input("What is your favourite food? ")
print()
print("Nice to meet you, " + name + "!")
print(name, "likes", food + ".")
`,
    answers: ['Ada', 'cheese'],
    expected: [
      'What is your name? ',
      'What is your favourite food? ',
      'Nice to meet you, Ada!',
      'Ada likes cheese.'
    ],
    inLesson: true
  },
  {
    key: '2/3/exercise-2',
    title: 'The Mad Lib',
    solution: `noun = input("Give me a plural noun: ")
print()
verb = input("Give me a verb: ")
print()
place = input("Give me a place: ")
print()
adjective = input("Give me an adjective: ")
print()
print("The " + noun + " of " + place + " have one talent: they " + verb + ".")
print("Every " + adjective + " morning, they " + verb + " again.")
print(place + " has never been the same.")
`,
    answers: ['beepers', 'juggle', 'Cleveland', 'damp'],
    expected: [
      'Give me a plural noun: ',
      'Give me a verb: ',
      'Give me a place: ',
      'Give me an adjective: ',
      'The beepers of Cleveland have one talent: they juggle.',
      'Every damp morning, they juggle again.',
      'Cleveland has never been the same.'
    ],
    inLesson: true
  },
  {
    key: '2/3/exercise-3',
    title: 'Live Roll Call',
    solution: `for i in range(3):
  name = input("Crew member name: ")
  print()
  print("Logged crew member", i, "as", name)

print("All three aboard.")
`,
    answers: ['Ada', 'Grace', 'Alan'],
    expected: [
      'Crew member name: ',
      'Logged crew member 0 as Ada',
      'Crew member name: ',
      'Logged crew member 1 as Grace',
      'Crew member name: ',
      'Logged crew member 2 as Alan',
      'All three aboard.'
    ],
    inLesson: true
  },
  {
    key: '2/4/exercise-1',
    title: 'Rectangle Facts',
    solution: `width = int(input("Width: "))
print()
height = int(input("Height: "))
print()
print("Area:", width * height)
print("Perimeter:", 2 * (width + height))
`,
    answers: ['7', '3'],
    expected: ['Width: ', 'Height: ', 'Area: 21', 'Perimeter: 20'],
    inLesson: true
  },
  {
    key: '2/4/exercise-2',
    title: 'The Mission Clock',
    solution: `total = int(input("Total seconds: "))
print()
hours = total // 3600
rest = total % 3600
minutes = rest // 60
seconds = rest % 60
print(total, "seconds is", hours, "h", minutes, "m", seconds, "s")
`,
    answers: ['3725'],
    expected: ['Total seconds: ', '3725 seconds is 1 h 2 m 5 s'],
    inLesson: true
  },
  {
    key: '2/4/exercise-3',
    title: 'The Odd Ones',
    solution: `count = int(input("How many odd numbers? "))
print()
total = 0
for i in range(count):
  odd = i * 2 + 1
  print(odd)
  total = total + odd
print("Their total is", total)
`,
    answers: ['5'],
    expected: ['How many odd numbers? ', '1', '3', '5', '7', '9', 'Their total is 25'],
    inLesson: true
  },
  {
    key: '2/4/exercise-4',
    title: 'The Doubling Pond',
    solution: `pads = int(input("Starting pads: "))
print()
days = int(input("Days to simulate: "))
print()
start = pads
print("Day 0:", pads)
for i in range(days):
  pads = pads * 2
  print("Day " + str(i + 1) + ":", pads)
print("Growth:", pads - start, "more pads than we started with")
`,
    answers: ['3', '4'],
    expected: [
      'Starting pads: ',
      'Days to simulate: ',
      'Day 0: 3',
      'Day 1: 6',
      'Day 2: 12',
      'Day 3: 24',
      'Day 4: 48',
      'Growth: 45 more pads than we started with'
    ],
    inLesson: true
  },
  {
    key: '2/5/exercise-1',
    title: 'The Crew Manifest',
    solution: `mission = input("Mission name: ")
print()
commander = input("Commander: ")
print()
crew = int(input("Crew size: "))
print()
rule = "=" * 40
print(rule)
print("MISSION:", mission)
print(rule)
print("Commander:", commander)
print("Crew aboard:", crew)
print("Total souls:", crew + 1)
print(rule)
`,
    answers: ['Artemis', 'Ada Lovelace', '4'],
    expected: [
      'Mission name: ',
      'Commander: ',
      'Crew size: ',
      '========================================',
      'MISSION: Artemis',
      '========================================',
      'Commander: Ada Lovelace',
      'Crew aboard: 4',
      'Total souls: 5',
      '========================================'
    ],
    inLesson: true
  },
  {
    key: '2/5/exercise-2',
    title: 'The Fuel Check',
    solution: `fuel = int(input("Fuel on board (litres): "))
print()
rate = int(input("Burn rate (litres per second): "))
print()
seconds = fuel // rate
unburnt = fuel % rate
minutes = seconds // 60
rest = seconds % 60
print("Burn time:", seconds, "seconds")
print("That is", minutes, "m", rest, "s")
print("Unburnt fuel:", unburnt, "litres")
`,
    answers: ['5000', '12'],
    expected: [
      'Fuel on board (litres): ',
      'Burn rate (litres per second): ',
      'Burn time: 416 seconds',
      'That is 6 m 56 s',
      'Unburnt fuel: 8 litres'
    ],
    inLesson: true
  },
  {
    key: '2/5/exercise-2',
    title: 'The Fuel Check, burn rate that divides exactly',
    caseName: 'A burn rate that divides exactly',
    solution: `fuel = int(input("Fuel on board (litres): "))
print()
rate = int(input("Burn rate (litres per second): "))
print()
seconds = fuel // rate
unburnt = fuel % rate
minutes = seconds // 60
rest = seconds % 60
print("Burn time:", seconds, "seconds")
print("That is", minutes, "m", rest, "s")
print("Unburnt fuel:", unburnt, "litres")
`,
    answers: ['5000', '10'],
    expected: [
      'Fuel on board (litres): ',
      'Burn rate (litres per second): ',
      'Burn time: 500 seconds',
      'That is 8 m 20 s',
      'Unburnt fuel: 0 litres'
    ],
    inLesson: false
  },
  {
    key: '2/5/exercise-3',
    title: 'The Launch',
    solution: `start = int(input("Countdown from: "))
print()
climb = int(input("Metres climbed in the first second: "))
print()
for i in range(start):
  print(start - i)
print("LIFTOFF")
altitude = 0
for i in range(5):
  altitude = altitude + climb
  print("Second " + str(i + 1) + ":", altitude, "m")
  climb = climb * 2
print("Final altitude:", altitude, "m")
print("Average climb:", altitude / 5, "m per second")
`,
    answers: ['3', '10'],
    expected: [
      'Countdown from: ',
      'Metres climbed in the first second: ',
      '3',
      '2',
      '1',
      'LIFTOFF',
      'Second 1: 10 m',
      'Second 2: 30 m',
      'Second 3: 70 m',
      'Second 4: 150 m',
      'Second 5: 310 m',
      'Final altitude: 310 m',
      'Average climb: 62.0 m per second'
    ],
    inLesson: true
  }
];

/** Every fixture for one exercise, including extra cases not shown in the lesson. */
export function fixturesFor(key: string): ExerciseFixture[] {
  return exerciseFixtures.filter((fixture) => fixture.key === key);
}

/**
 * The `tests` for one exercise, ready to drop into its `PythonConfig`.
 *
 * This is the join that keeps the lessons honest: the transcript a lesson
 * prints, the contract its prose states, and the output the "Run tests" button
 * checks are all the same array of strings. `exercise-fixtures.test.ts` fails
 * if the lesson and the fixture ever stop agreeing.
 *
 * `undefined` for anything that is not an authored exercise — the playground
 * and the worked examples inside lessons — so they show no button.
 */
export function testsFor(key: string): PythonTests | undefined {
  const fixtures = fixturesFor(key);
  if (fixtures.length === 0) return undefined;
  return {
    cases: fixtures.map((fixture) => ({
      name: fixture.caseName ?? DEFAULT_CASE_NAME,
      answers: fixture.answers,
      expected: fixture.expected
    }))
  };
}
