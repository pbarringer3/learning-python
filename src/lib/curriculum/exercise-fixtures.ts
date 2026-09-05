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
  },
  {
    key: '3/1/exercise-1',
    title: 'The Beeper Bag',
    solution: `beepers = int(input("Beepers in the bag: "))
print()

print("Karel starts with", beepers)
beepers = beepers - 1
print("Put one down. The bag holds", beepers)
beepers = beepers - 1
print("Put one down. The bag holds", beepers)
beepers = beepers + 3
print("Picked up three. The bag holds", beepers)
print("Karel ends the day with", beepers, "beepers")
`,
    answers: ['5'],
    expected: [
      'Beepers in the bag: ',
      'Karel starts with 5',
      'Put one down. The bag holds 4',
      'Put one down. The bag holds 3',
      'Picked up three. The bag holds 6',
      'Karel ends the day with 6 beepers'
    ],
    inLesson: true
  },
  {
    key: '3/1/exercise-2',
    title: 'The Swap',
    solution: `left = input("Left crate: ")
print()

right = input("Right crate: ")
print()

print("Before: left holds", left, "and right holds", right)

spare = left
left = right
right = spare

print("After: left holds", left, "and right holds", right)
`,
    answers: ['bolts', 'rations'],
    expected: [
      'Left crate: ',
      'Right crate: ',
      'Before: left holds bolts and right holds rations',
      'After: left holds rations and right holds bolts'
    ],
    inLesson: true
  },
  {
    key: '3/1/exercise-3',
    title: 'The Cargo Hold',
    solution: `capacity = int(input("Hold capacity in kilograms: "))
print()

crate = int(input("Crate weight in kilograms: "))
print()

space = capacity
for i in range(4):
  space = space - crate
  print("Loaded crate " + str(i + 1) + ", space left:", space, "kg")

print("Four crates aboard.")
print("Used", capacity - space, "of", capacity, "kg")
`,
    answers: ['500', '90'],
    expected: [
      'Hold capacity in kilograms: ',
      'Crate weight in kilograms: ',
      'Loaded crate 1, space left: 410 kg',
      'Loaded crate 2, space left: 320 kg',
      'Loaded crate 3, space left: 230 kg',
      'Loaded crate 4, space left: 140 kg',
      'Four crates aboard.',
      'Used 360 of 500 kg'
    ],
    inLesson: true
  },
  {
    key: '3/2/exercise-1',
    title: 'The Divider',
    solution: `top = int(input("Top number: "))
print()

bottom = int(input("Bottom number: "))
print()

print("Divided:", top / bottom, type(top / bottom))
print("Whole times it fits:", top // bottom, type(top // bottom))
print("Left over:", top % bottom, type(top % bottom))
`,
    answers: ['17', '5'],
    expected: [
      'Top number: ',
      'Bottom number: ',
      "Divided: 3.4 <class 'float'>",
      "Whole times it fits: 3 <class 'int'>",
      "Left over: 2 <class 'int'>"
    ],
    inLesson: true
  },
  {
    key: '3/2/exercise-1',
    title: 'The Divider, a division that comes out exactly',
    solution: `top = int(input("Top number: "))
print()

bottom = int(input("Bottom number: "))
print()

print("Divided:", top / bottom, type(top / bottom))
print("Whole times it fits:", top // bottom, type(top // bottom))
print("Left over:", top % bottom, type(top % bottom))
`,
    answers: ['20', '5'],
    expected: [
      'Top number: ',
      'Bottom number: ',
      "Divided: 4.0 <class 'float'>",
      "Whole times it fits: 4 <class 'int'>",
      "Left over: 0 <class 'int'>"
    ],
    inLesson: false,
    caseName: 'A division that comes out exactly'
  },
  {
    key: '3/2/exercise-2',
    title: 'The Tenth Problem',
    solution: `total = 0.0
for i in range(10):
  total = total + 0.1
  print("Tenths added: " + str(i + 1) + ", total:", total)

print("Counting in whole tenths instead:")

tenths = 0
for i in range(10):
  tenths = tenths + 1

print("Tenths counted:", tenths)
print("Which is", tenths / 10, "of a unit")
`,
    answers: [],
    expected: [
      'Tenths added: 1, total: 0.1',
      'Tenths added: 2, total: 0.2',
      'Tenths added: 3, total: 0.30000000000000004',
      'Tenths added: 4, total: 0.4',
      'Tenths added: 5, total: 0.5',
      'Tenths added: 6, total: 0.6',
      'Tenths added: 7, total: 0.7',
      'Tenths added: 8, total: 0.7999999999999999',
      'Tenths added: 9, total: 0.8999999999999999',
      'Tenths added: 10, total: 0.9999999999999999',
      'Counting in whole tenths instead:',
      'Tenths counted: 10',
      'Which is 1.0 of a unit'
    ],
    inLesson: true
  },
  {
    key: '3/2/exercise-3',
    title: 'The Ticket Machine',
    solution: `price = int(input("Ticket price in pence: "))
print()

tickets = int(input("How many tickets? "))
print()

total = price * tickets
pounds = total // 100
pence = total % 100

print("Total in pence:", total)
print("That is", pounds, "pounds and", pence, "pence")
print("As a decimal:", total / 100)
`,
    answers: ['1250', '3'],
    expected: [
      'Ticket price in pence: ',
      'How many tickets? ',
      'Total in pence: 3750',
      'That is 37 pounds and 50 pence',
      'As a decimal: 37.5'
    ],
    inLesson: true
  },
  {
    key: '3/3/exercise-1',
    title: 'Measuring Up',
    solution: `word = input("Give me a word: ")
print()

print("The word:", word)
print("Letters:", len(word))
print("First letter:", word[0])
print("Last letter:", word[len(word) - 1])
print("Also the last letter:", word[-1])
`,
    answers: ['beeper'],
    expected: [
      'Give me a word: ',
      'The word: beeper',
      'Letters: 6',
      'First letter: b',
      'Last letter: r',
      'Also the last letter: r'
    ],
    inLesson: true
  },
  {
    key: '3/3/exercise-2',
    title: 'The Acronym',
    solution: `first = input("First word: ")
print()

second = input("Second word: ")
print()

third = input("Third word: ")
print()

acronym = first[0] + second[0] + third[0]

print("Words:", first, second, third)
print("Acronym:", acronym)
print("Kept", len(acronym), "letters out of", len(first) + len(second) + len(third))
`,
    answers: ['portable', 'network', 'graphics'],
    expected: [
      'First word: ',
      'Second word: ',
      'Third word: ',
      'Words: portable network graphics',
      'Acronym: png',
      'Kept 3 letters out of 23'
    ],
    inLesson: true
  },
  {
    key: '3/3/exercise-3',
    title: 'Vertical',
    solution: `word = input("Word to spell out: ")
print()

for i in range(len(word)):
  print(str(i) + ": " + word[i])

print("Letters:", len(word))
`,
    answers: ['Karel'],
    expected: ['Word to spell out: ', '0: K', '1: a', '2: r', '3: e', '4: l', 'Letters: 5'],
    inLesson: true
  },
  {
    key: '3/3/exercise-3',
    title: 'Vertical, a single-letter word',
    solution: `word = input("Word to spell out: ")
print()

for i in range(len(word)):
  print(str(i) + ": " + word[i])

print("Letters:", len(word))
`,
    answers: ['x'],
    expected: ['Word to spell out: ', '0: x', 'Letters: 1'],
    inLesson: false,
    caseName: 'A single-letter word'
  },
  {
    key: '3/4/exercise-1',
    title: 'True or False',
    solution: `first = int(input("First number: "))
print()

second = int(input("Second number: "))
print()

print("Equal:", first == second)
print("Different:", first != second)
print("First is smaller:", first < second)
print("First is bigger:", first > second)
print("First is smaller or equal:", first <= second)
print("First is bigger or equal:", first >= second)
`,
    answers: ['7', '10'],
    expected: [
      'First number: ',
      'Second number: ',
      'Equal: False',
      'Different: True',
      'First is smaller: True',
      'First is bigger: False',
      'First is smaller or equal: True',
      'First is bigger or equal: False'
    ],
    inLesson: true
  },
  {
    key: '3/4/exercise-1',
    title: 'True or False, two numbers that are equal',
    solution: `first = int(input("First number: "))
print()

second = int(input("Second number: "))
print()

print("Equal:", first == second)
print("Different:", first != second)
print("First is smaller:", first < second)
print("First is bigger:", first > second)
print("First is smaller or equal:", first <= second)
print("First is bigger or equal:", first >= second)
`,
    answers: ['5', '5'],
    expected: [
      'First number: ',
      'Second number: ',
      'Equal: True',
      'Different: False',
      'First is smaller: False',
      'First is bigger: False',
      'First is smaller or equal: True',
      'First is bigger or equal: True'
    ],
    inLesson: false,
    caseName: 'Two numbers that are equal'
  },
  {
    key: '3/4/exercise-2',
    title: 'The Gatekeeper',
    solution: `fuel = int(input("Fuel level as a percentage: "))
print()

if fuel >= 80:
  print("Status: GO")
elif fuel >= 40:
  print("Status: CAUTION")
elif fuel > 0:
  print("Status: ABORT")
else:
  print("Status: EMPTY")

print("Reported at", fuel, "percent")
`,
    answers: ['55'],
    expected: ['Fuel level as a percentage: ', 'Status: CAUTION', 'Reported at 55 percent'],
    inLesson: true
  },
  {
    key: '3/4/exercise-2',
    title: 'The Gatekeeper, a full tank',
    solution: `fuel = int(input("Fuel level as a percentage: "))
print()

if fuel >= 80:
  print("Status: GO")
elif fuel >= 40:
  print("Status: CAUTION")
elif fuel > 0:
  print("Status: ABORT")
else:
  print("Status: EMPTY")

print("Reported at", fuel, "percent")
`,
    answers: ['95'],
    expected: ['Fuel level as a percentage: ', 'Status: GO', 'Reported at 95 percent'],
    inLesson: false,
    caseName: 'A full tank'
  },
  {
    key: '3/4/exercise-2',
    title: 'The Gatekeeper, an empty tank',
    solution: `fuel = int(input("Fuel level as a percentage: "))
print()

if fuel >= 80:
  print("Status: GO")
elif fuel >= 40:
  print("Status: CAUTION")
elif fuel > 0:
  print("Status: ABORT")
else:
  print("Status: EMPTY")

print("Reported at", fuel, "percent")
`,
    answers: ['0'],
    expected: ['Fuel level as a percentage: ', 'Status: EMPTY', 'Reported at 0 percent'],
    inLesson: false,
    caseName: 'An empty tank'
  },
  {
    key: '3/4/exercise-3',
    title: 'The Access Check',
    solution: `name = input("Name: ")
print()

code = input("Access code: ")
print()

known = name == "Ada"
correct = code == "beeper"

print("Name recognised:", known)
print("Code correct:", correct)

if known and correct:
  print("Access granted")
else:
  print("Access denied")

if not known:
  print("No record of that name")
`,
    answers: ['Ada', 'beeper'],
    expected: [
      'Name: ',
      'Access code: ',
      'Name recognised: True',
      'Code correct: True',
      'Access granted'
    ],
    inLesson: true
  },
  {
    key: '3/4/exercise-3',
    title: 'The Access Check, an unknown name',
    solution: `name = input("Name: ")
print()

code = input("Access code: ")
print()

known = name == "Ada"
correct = code == "beeper"

print("Name recognised:", known)
print("Code correct:", correct)

if known and correct:
  print("Access granted")
else:
  print("Access denied")

if not known:
  print("No record of that name")
`,
    answers: ['Bob', 'beeper'],
    expected: [
      'Name: ',
      'Access code: ',
      'Name recognised: False',
      'Code correct: True',
      'Access denied',
      'No record of that name'
    ],
    inLesson: false,
    caseName: 'An unknown name'
  },
  {
    key: '3/4/exercise-3',
    title: 'The Access Check, the wrong code',
    solution: `name = input("Name: ")
print()

code = input("Access code: ")
print()

known = name == "Ada"
correct = code == "beeper"

print("Name recognised:", known)
print("Code correct:", correct)

if known and correct:
  print("Access granted")
else:
  print("Access denied")

if not known:
  print("No record of that name")
`,
    answers: ['Ada', 'password'],
    expected: [
      'Name: ',
      'Access code: ',
      'Name recognised: True',
      'Code correct: False',
      'Access denied'
    ],
    inLesson: false,
    caseName: 'The wrong code'
  },
  {
    key: '3/5/exercise-1',
    title: 'Doubling to Target',
    solution: `start = int(input("Starting number: "))
print()

target = int(input("Target to beat: "))
print()

value = start
steps = 0

while value <= target:
  value = value * 2
  steps = steps + 1
  print("Step " + str(steps) + ":", value)

print("Beat", target, "after", steps, "steps")
`,
    answers: ['3', '100'],
    expected: [
      'Starting number: ',
      'Target to beat: ',
      'Step 1: 6',
      'Step 2: 12',
      'Step 3: 24',
      'Step 4: 48',
      'Step 5: 96',
      'Step 6: 192',
      'Beat 100 after 6 steps'
    ],
    inLesson: true
  },
  {
    key: '3/5/exercise-1',
    title: 'Doubling to Target, a start that already beats the target',
    solution: `start = int(input("Starting number: "))
print()

target = int(input("Target to beat: "))
print()

value = start
steps = 0

while value <= target:
  value = value * 2
  steps = steps + 1
  print("Step " + str(steps) + ":", value)

print("Beat", target, "after", steps, "steps")
`,
    answers: ['200', '100'],
    expected: ['Starting number: ', 'Target to beat: ', 'Beat 100 after 0 steps'],
    inLesson: false,
    caseName: 'A start that already beats the target'
  },
  {
    key: '3/5/exercise-2',
    title: 'The Sentinel',
    solution: `count = 0

while True:
  name = input("Crew member (or 'done'): ")
  print()

  if name == "done":
    break

  count = count + 1
  print("Logged " + str(count) + ":", name)

print("Crew aboard:", count)
`,
    answers: ['Ada', 'Grace', 'done'],
    expected: [
      "Crew member (or 'done'): ",
      'Logged 1: Ada',
      "Crew member (or 'done'): ",
      'Logged 2: Grace',
      "Crew member (or 'done'): ",
      'Crew aboard: 2'
    ],
    inLesson: true
  },
  {
    key: '3/5/exercise-2',
    title: 'The Sentinel, nobody aboard',
    solution: `count = 0

while True:
  name = input("Crew member (or 'done'): ")
  print()

  if name == "done":
    break

  count = count + 1
  print("Logged " + str(count) + ":", name)

print("Crew aboard:", count)
`,
    answers: ['done'],
    expected: ["Crew member (or 'done'): ", 'Crew aboard: 0'],
    inLesson: false,
    caseName: 'Nobody aboard'
  },
  {
    key: '3/5/exercise-3',
    title: 'The Validator',
    solution: `while True:
  fuel = int(input("Fuel percentage (0 to 100): "))
  print()

  if fuel < 0:
    print("Below zero is not a fuel level. Try again.")
  elif fuel > 100:
    print("Above 100 is not a fuel level. Try again.")
  else:
    break

print("Accepted:", fuel, "percent")
`,
    answers: ['150', '-5', '72'],
    expected: [
      'Fuel percentage (0 to 100): ',
      'Above 100 is not a fuel level. Try again.',
      'Fuel percentage (0 to 100): ',
      'Below zero is not a fuel level. Try again.',
      'Fuel percentage (0 to 100): ',
      'Accepted: 72 percent'
    ],
    inLesson: true
  },
  {
    key: '3/5/exercise-3',
    title: 'The Validator, a valid answer first time',
    solution: `while True:
  fuel = int(input("Fuel percentage (0 to 100): "))
  print()

  if fuel < 0:
    print("Below zero is not a fuel level. Try again.")
  elif fuel > 100:
    print("Above 100 is not a fuel level. Try again.")
  else:
    break

print("Accepted:", fuel, "percent")
`,
    answers: ['50'],
    expected: ['Fuel percentage (0 to 100): ', 'Accepted: 50 percent'],
    inLesson: false,
    caseName: 'A valid answer first time'
  },
  {
    key: '3/6/exercise-1',
    title: 'The Converter',
    solution: `text = input("Type a whole number: ")
print()

number = int(text)
half = number / 2
label = str(number)

print("As text:", text, type(text))
print("As a number:", number, type(number))
print("Halved:", half, type(half))
print("Back to text:", label, type(label))
print("The original text is still", text)
`,
    answers: ['42'],
    expected: [
      'Type a whole number: ',
      "As text: 42 <class 'str'>",
      "As a number: 42 <class 'int'>",
      "Halved: 21.0 <class 'float'>",
      "Back to text: 42 <class 'str'>",
      'The original text is still 42'
    ],
    inLesson: true
  },
  {
    key: '3/6/exercise-2',
    title: 'What Counts as True',
    solution: `print("Empty text:", bool(""))
print("Some text:", bool("hello"))
print("The word False:", bool("False"))
print("Zero:", bool(0))
print("One:", bool(1))
print("Minus one:", bool(-1))
print("Zero point zero:", bool(0.0))

name = input("Your name (or just press Enter): ")
print()

if name:
  print("Hello,", name)
else:
  print("You did not type anything")
`,
    answers: [''],
    expected: [
      'Empty text: False',
      'Some text: True',
      'The word False: True',
      'Zero: False',
      'One: True',
      'Minus one: True',
      'Zero point zero: False',
      'Your name (or just press Enter): ',
      'You did not type anything'
    ],
    inLesson: true
  },
  {
    key: '3/6/exercise-2',
    title: 'What Counts as True, a name that was actually typed',
    solution: `print("Empty text:", bool(""))
print("Some text:", bool("hello"))
print("The word False:", bool("False"))
print("Zero:", bool(0))
print("One:", bool(1))
print("Minus one:", bool(-1))
print("Zero point zero:", bool(0.0))

name = input("Your name (or just press Enter): ")
print()

if name:
  print("Hello,", name)
else:
  print("You did not type anything")
`,
    answers: ['Ada'],
    expected: [
      'Empty text: False',
      'Some text: True',
      'The word False: True',
      'Zero: False',
      'One: True',
      'Minus one: True',
      'Zero point zero: False',
      'Your name (or just press Enter): ',
      'Hello, Ada'
    ],
    inLesson: false,
    caseName: 'A name that was actually typed'
  },
  {
    key: '3/6/exercise-3',
    title: 'The Number Check',
    solution: `text = input("Type something: ")
print()

if text == "":
  print("You typed nothing at all")
else:
  all_digits = True

  for i in range(len(text)):
    if text[i] < "0" or text[i] > "9":
      all_digits = False

  print("Characters:", len(text))
  print("All digits:", all_digits)

  if all_digits:
    number = int(text)
    print("Twice that is", number * 2)
  else:
    print("Not converting that one")
`,
    answers: ['1234'],
    expected: ['Type something: ', 'Characters: 4', 'All digits: True', 'Twice that is 2468'],
    inLesson: true
  },
  {
    key: '3/6/exercise-3',
    title: 'The Number Check, something that is not a number',
    solution: `text = input("Type something: ")
print()

if text == "":
  print("You typed nothing at all")
else:
  all_digits = True

  for i in range(len(text)):
    if text[i] < "0" or text[i] > "9":
      all_digits = False

  print("Characters:", len(text))
  print("All digits:", all_digits)

  if all_digits:
    number = int(text)
    print("Twice that is", number * 2)
  else:
    print("Not converting that one")
`,
    answers: ['12a4'],
    expected: ['Type something: ', 'Characters: 4', 'All digits: False', 'Not converting that one'],
    inLesson: false,
    caseName: 'Something that is not a number'
  },
  {
    key: '3/6/exercise-3',
    title: 'The Number Check, nothing typed at all',
    solution: `text = input("Type something: ")
print()

if text == "":
  print("You typed nothing at all")
else:
  all_digits = True

  for i in range(len(text)):
    if text[i] < "0" or text[i] > "9":
      all_digits = False

  print("Characters:", len(text))
  print("All digits:", all_digits)

  if all_digits:
    number = int(text)
    print("Twice that is", number * 2)
  else:
    print("Not converting that one")
`,
    answers: [''],
    expected: ['Type something: ', 'You typed nothing at all'],
    inLesson: false,
    caseName: 'Nothing typed at all'
  },
  {
    key: '3/7/exercise-1',
    title: 'The Receipt',
    solution: `VAT_PERCENT = 20

price = int(input("Price per item in pence: "))
print()

quantity = int(input("How many? "))
print()

subtotal = price * quantity
vat = subtotal * VAT_PERCENT // 100
total = subtotal + vat

print("Subtotal:", subtotal, "pence")
print("VAT at", VAT_PERCENT, "percent:", vat, "pence")
print("Total:", total, "pence")
print("That is", total // 100, "pounds and", total % 100, "pence")
`,
    answers: ['450', '3'],
    expected: [
      'Price per item in pence: ',
      'How many? ',
      'Subtotal: 1350 pence',
      'VAT at 20 percent: 270 pence',
      'Total: 1620 pence',
      'That is 16 pounds and 20 pence'
    ],
    inLesson: true
  },
  {
    key: '3/7/exercise-2',
    title: 'The Seating Plan',
    solution: `SEATS_PER_ROW = 6

passengers = int(input("Passengers to seat: "))
print()

full_rows = passengers // SEATS_PER_ROW
spare = passengers % SEATS_PER_ROW

print("Seats per row:", SEATS_PER_ROW)
print("Full rows:", full_rows)
print("Passengers left over:", spare)

if spare > 0:
  print("Rows needed:", full_rows + 1)
else:
  print("Rows needed:", full_rows)
`,
    answers: ['20'],
    expected: [
      'Passengers to seat: ',
      'Seats per row: 6',
      'Full rows: 3',
      'Passengers left over: 2',
      'Rows needed: 4'
    ],
    inLesson: true
  },
  {
    key: '3/7/exercise-2',
    title: 'The Seating Plan, an exact fit',
    solution: `SEATS_PER_ROW = 6

passengers = int(input("Passengers to seat: "))
print()

full_rows = passengers // SEATS_PER_ROW
spare = passengers % SEATS_PER_ROW

print("Seats per row:", SEATS_PER_ROW)
print("Full rows:", full_rows)
print("Passengers left over:", spare)

if spare > 0:
  print("Rows needed:", full_rows + 1)
else:
  print("Rows needed:", full_rows)
`,
    answers: ['18'],
    expected: [
      'Passengers to seat: ',
      'Seats per row: 6',
      'Full rows: 3',
      'Passengers left over: 0',
      'Rows needed: 3'
    ],
    inLesson: false,
    caseName: 'An exact fit'
  },
  {
    key: '3/7/exercise-3',
    title: 'The Temperature Guard',
    solution: `MIN_SAFE = 15
MAX_SAFE = 25

readings = 0
alerts = 0

while True:
  answer = input("Temperature (or 'done'): ")
  print()

  if answer == "done":
    break

  temperature = int(answer)
  readings = readings + 1

  if temperature < MIN_SAFE:
    print(temperature, "is too cold")
    alerts = alerts + 1
  elif temperature > MAX_SAFE:
    print(temperature, "is too hot")
    alerts = alerts + 1
  else:
    print(temperature, "is fine")

print("Readings:", readings)
print("Alerts:", alerts)
print("Safe range was", MIN_SAFE, "to", MAX_SAFE)
`,
    answers: ['20', '30', '10', 'done'],
    expected: [
      "Temperature (or 'done'): ",
      '20 is fine',
      "Temperature (or 'done'): ",
      '30 is too hot',
      "Temperature (or 'done'): ",
      '10 is too cold',
      "Temperature (or 'done'): ",
      'Readings: 3',
      'Alerts: 2',
      'Safe range was 15 to 25'
    ],
    inLesson: true
  },
  {
    key: '3/7/exercise-3',
    title: 'The Temperature Guard, no readings at all',
    solution: `MIN_SAFE = 15
MAX_SAFE = 25

readings = 0
alerts = 0

while True:
  answer = input("Temperature (or 'done'): ")
  print()

  if answer == "done":
    break

  temperature = int(answer)
  readings = readings + 1

  if temperature < MIN_SAFE:
    print(temperature, "is too cold")
    alerts = alerts + 1
  elif temperature > MAX_SAFE:
    print(temperature, "is too hot")
    alerts = alerts + 1
  else:
    print(temperature, "is fine")

print("Readings:", readings)
print("Alerts:", alerts)
print("Safe range was", MIN_SAFE, "to", MAX_SAFE)
`,
    answers: ['done'],
    expected: ["Temperature (or 'done'): ", 'Readings: 0', 'Alerts: 0', 'Safe range was 15 to 25'],
    inLesson: false,
    caseName: 'No readings at all'
  },
  {
    key: '3/8/exercise-1',
    title: 'The Crew Register',
    solution: `crew = 0
initials = ""

while True:
  name = input("Crew member (or 'done'): ")
  print()

  if name == "done":
    break

  if name == "":
    print("A name cannot be empty. Try again.")
  else:
    crew = crew + 1
    initials = initials + name[0]
    print("Registered " + str(crew) + ":", name)

print("Crew registered:", crew)
print("Initials:", initials)
`,
    answers: ['Ada', '', 'Grace', 'done'],
    expected: [
      "Crew member (or 'done'): ",
      'Registered 1: Ada',
      "Crew member (or 'done'): ",
      'A name cannot be empty. Try again.',
      "Crew member (or 'done'): ",
      'Registered 2: Grace',
      "Crew member (or 'done'): ",
      'Crew registered: 2',
      'Initials: AG'
    ],
    inLesson: true
  },
  {
    key: '3/8/exercise-2',
    title: 'The Ration Calculator',
    solution: `MEALS_PER_DAY = 3
RATIONS_PER_CRATE = 24

crew = int(input("Crew size: "))
print()

days = int(input("Days at sea: "))
print()

meals = crew * days * MEALS_PER_DAY
crates = meals // RATIONS_PER_CRATE
spare = meals % RATIONS_PER_CRATE

if spare > 0:
  crates = crates + 1

print("Meals needed:", meals)
print("Rations per crate:", RATIONS_PER_CRATE)
print("Crates to load:", crates)

if spare > 0:
  print("The last crate will have", RATIONS_PER_CRATE - spare, "rations spare")
else:
  print("Every crate is full")
`,
    answers: ['5', '10'],
    expected: [
      'Crew size: ',
      'Days at sea: ',
      'Meals needed: 150',
      'Rations per crate: 24',
      'Crates to load: 7',
      'The last crate will have 18 rations spare'
    ],
    inLesson: true
  },
  {
    key: '3/8/exercise-2',
    title: 'The Ration Calculator, a load with no waste',
    solution: `MEALS_PER_DAY = 3
RATIONS_PER_CRATE = 24

crew = int(input("Crew size: "))
print()

days = int(input("Days at sea: "))
print()

meals = crew * days * MEALS_PER_DAY
crates = meals // RATIONS_PER_CRATE
spare = meals % RATIONS_PER_CRATE

if spare > 0:
  crates = crates + 1

print("Meals needed:", meals)
print("Rations per crate:", RATIONS_PER_CRATE)
print("Crates to load:", crates)

if spare > 0:
  print("The last crate will have", RATIONS_PER_CRATE - spare, "rations spare")
else:
  print("Every crate is full")
`,
    answers: ['4', '2'],
    expected: [
      'Crew size: ',
      'Days at sea: ',
      'Meals needed: 24',
      'Rations per crate: 24',
      'Crates to load: 1',
      'Every crate is full'
    ],
    inLesson: false,
    caseName: 'A load with no waste'
  },
  {
    key: '3/8/exercise-3',
    title: 'The Voyage Log',
    solution: `GOOD_DAY = 100

total = 0
best = 0
best_day = 0
day = 0

while True:
  answer = input("Distance for the next day (or 'done'): ")
  print()

  if answer == "done":
    break

  distance = int(answer)
  day = day + 1
  total = total + distance

  if distance > best:
    best = distance
    best_day = day

  if distance >= GOOD_DAY:
    print("Day " + str(day) + ":", distance, "km - a good day")
  else:
    print("Day " + str(day) + ":", distance, "km")

print("Days sailed:", day)

if day == 0:
  print("Nothing to report")
else:
  print("Total distance:", total, "km")
  print("Best day was day", best_day, "with", best, "km")
  print("Average:", round(total / day, 1), "km per day")
`,
    answers: ['120', '80', '150', 'done'],
    expected: [
      "Distance for the next day (or 'done'): ",
      'Day 1: 120 km - a good day',
      "Distance for the next day (or 'done'): ",
      'Day 2: 80 km',
      "Distance for the next day (or 'done'): ",
      'Day 3: 150 km - a good day',
      "Distance for the next day (or 'done'): ",
      'Days sailed: 3',
      'Total distance: 350 km',
      'Best day was day 3 with 150 km',
      'Average: 116.7 km per day'
    ],
    inLesson: true
  },
  {
    key: '3/8/exercise-3',
    title: 'The Voyage Log, a voyage that never left',
    solution: `GOOD_DAY = 100

total = 0
best = 0
best_day = 0
day = 0

while True:
  answer = input("Distance for the next day (or 'done'): ")
  print()

  if answer == "done":
    break

  distance = int(answer)
  day = day + 1
  total = total + distance

  if distance > best:
    best = distance
    best_day = day

  if distance >= GOOD_DAY:
    print("Day " + str(day) + ":", distance, "km - a good day")
  else:
    print("Day " + str(day) + ":", distance, "km")

print("Days sailed:", day)

if day == 0:
  print("Nothing to report")
else:
  print("Total distance:", total, "km")
  print("Best day was day", best_day, "with", best, "km")
  print("Average:", round(total / day, 1), "km per day")
`,
    answers: ['done'],
    expected: ["Distance for the next day (or 'done'): ", 'Days sailed: 0', 'Nothing to report'],
    inLesson: false,
    caseName: 'A voyage that never left'
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
