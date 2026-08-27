# Curriculum Design Document

## Vision

Learning Python is a complete, interactive Python curriculum for absolute beginners — no prior
experience required. Students start by commanding a robot and finish Part 1 by building their own
game. Part 2 takes them deeper into CS fundamentals: recursion, data structures, and algorithmic
thinking.

The curriculum is inspired by Stanford CS106A and Art of Problem Solving. It is designed to be
extended with advanced modules over time, but the two-part core stands on its own as a complete
introduction to Python and computer science.

---

## Design Principles

### 1. Make Execution Visible and Concrete

Students should always be able to _see_ their program running — not just receive text output, but
observe the actual state of the world at each step. In Karel lessons, this is the animated grid.
In Python lessons, this is the Call Stack Visualizer showing variable state step by step. Every
interactive environment gives students a window into what the computer is actually doing.

### 2. Scaffold onto Prior Knowledge

Each chapter explicitly connects new concepts to what students already know. Students should never
feel like they're starting over — they should feel like they're leveling up. For example, when
variables are formally introduced, we connect them to Karel's beeper bag: _"Karel's beeper bag is
like a variable — it holds a value that can change."_

### 3. Phenomenon Before Mechanism

Concepts are introduced informally before they are explained formally. Students encounter the
phenomenon first, then learn the mechanism later when they have the tools to understand it. This
creates satisfying "aha" moments.

_Examples:_

- Variables are used naturally in Chapter 2 (`name = input(...)`) before being formally defined
  in Chapter 3.
- `+` is used on both strings and numbers in Chapter 2 before operator overloading is formally
  explained in the Classes chapter.
- `print()`, `input()`, and `range()` are called with arguments in Chapters 2–4 before parameters
  are formally defined in Chapter 4.

### 4. Teach Transferable Skills

Avoid custom abstractions except for established pedagogical tools. Karel is the exception — it is
a well-known tool used by Stanford and others, not a proprietary invention. For everything else
(graphics, data, etc.), use real, widely-used libraries so students can take their skills outside
this curriculum.

### 5. Every Chapter Ends with a Capstone Project

Each chapter's final lesson is a project that uses everything students learned in that chapter.
Projects grow in ambition across the curriculum, giving students an increasing sense of what they
are capable of building.

### 6. Fine-Grained Chapters for Frequent Wins

Chapters are focused on a single concept or theme. Shorter chapters with fewer lessons mean
students complete chapters more often, which builds momentum and confidence.

---

## Interactive Environments

### Karel Environment (Chapter 1)

The existing `KarelEnvironment` component. Students write Python to control a robot in a grid
world. Execution is animated step by step with highlighted lines and descriptive messages.

### Python Environment (Chapters 2–7, Part 2)

A `PythonEnvironment` component (analogous to `KarelEnvironment`) for general Python exercises.
Includes a code editor, output panel, and a **Call Stack Visualizer** that shows variable state
at each step — making execution concrete for non-Karel programs. Configured per-exercise as a
guided challenge with test cases. Also available as an open sandbox at `/python/playground`.

### Graphics Environment (Chapters 8–10)

A `GraphicsEnvironment` component that wraps a real, widely-used Python graphics library
(TBD — must be compatible with Pyodide and browser execution). Students draw shapes, animate
objects, and build interactive programs. The library choice should be something students can
continue using outside this curriculum.

---

## Curriculum Structure

The curriculum is divided into two parts:

- **Part 1: Introduction to Python** (Chapters 1–10) — From Karel to building a simple game.
- **Part 2: CS Fundamentals** (Chapters 12+) — Recursion, data structures, algorithms.

Chapter 11 ("Files & Exceptions") serves as a bridge between the two parts.

---

## Part 1: Introduction to Python

---

### Chapter 1: Karel the Robot ✅

_Students learn programming fundamentals by commanding a robot in a grid world._

**Lessons:**

1. Meet Karel
2. Defining Functions
3. Decomposition
4. While Loops
5. For Loops
6. If/Else Statements
7. Putting It All Together _(capstone)_

**Notes:** Fully implemented. See `KAREL_DESIGN.md` for detailed design decisions.

---

### Chapter 2: Hello, Python!

_Bridge from Karel to Python. Students write their first real Python programs using `print()` and
`input()`. Variables appear naturally here before being formally defined in Chapter 3._

**Lessons:**

1. **From Karel to Python** — What changes, what stays the same. The Python interpreter. Running
   a script. Karel spoke robot; now we speak Python directly.
2. **Your First Python Program** — `print()`, string literals, running code in the browser.
3. **Getting Input** — `input()`, storing results in variables (informal introduction — _"we'll
   dig into variables more in Chapter 3"_), simple interactive programs.
4. **Expressions & Math** — Arithmetic operators, operator precedence, `int()` / `float()`
   conversions. Informal note that `+` works on strings too (phenomenon; mechanism explained
   later in Classes chapter).
5. **Putting It Together** _(capstone)_ — A small interactive project: a mad-lib generator, a
   simple calculator, or similar. Students build a complete program that takes input and produces
   engaging output.

---

### Chapter 3: Variables & Types

_Formally defines what variables are, how types work, and how Python stores data. Connects back
to Karel's beeper bag as a motivating analogy._

**Lessons:**

1. **Variables** — Assignment, naming conventions, the mental model of "a label on a value".
   Explicit connection: _"Karel's beeper bag is like a variable."_
2. **Integers & Floats** — Numeric types, integer division (`//`), modulo (`%`), `type()`.
3. **Strings** — String literals, `+` concatenation, `len()`, basic string operations.
4. **Booleans** — `True`/`False`, comparison operators, logical operators (`and`, `or`, `not`).
   Connects to Karel's sensor functions which returned booleans.
5. **Type Conversion** — `int()`, `float()`, `str()`, `bool()`, common gotchas.
6. **Constants & Style** — Naming conventions (`UPPER_CASE`), PEP 8 basics, writing readable
   code. Comments (brief — already familiar from Karel).
7. **Putting It Together** _(capstone)_ — A program that takes several inputs, performs
   meaningful computation, and presents results clearly.

---

### Chapter 4: Functions & Parameters

_Formally defines parameters and return values. Students already know how to define zero-parameter
functions from Karel, and have been calling functions with arguments since Chapter 2._

**Lessons:**

1. **Parameters & Arguments** — Opens by pointing out that students have already been using
   parameters: `print("hello")`, `input("Name: ")`, `range(5)`. Now we look under the hood.
   Connecting to Karel functions which had no parameters.
2. **Return Values** — `return`, using function output, contrast between `return` and `print()`.
3. **Scope** — Local vs. global variables, why this matters, common beginner mistakes.
4. **Default Parameters & Keyword Arguments** — `def greet(name, greeting="Hello"):`.
5. **Docstrings & Good Design** — Documenting functions, single responsibility principle,
   choosing good names.
6. **Putting It Together** _(capstone)_ — A multi-function program with clear decomposition.
   Students design the function structure before writing code.

---

### Chapter 5: Strings

_A deep dive into strings as a data type. String iteration is introduced here as the first
example of iterating over a collection — setting up the formal iterables lesson in Chapter 7._

**Lessons:**

1. **String Indexing & Slicing** — Zero-based indexing, negative indices, slices.
2. **String Methods** — `upper()`, `lower()`, `strip()`, `split()`, `replace()`, `find()`, etc.
3. **f-Strings & Formatting** — f-strings, format specifiers, building readable output.
4. **Iterating Over Strings** — `for char in string:`, `enumerate()`. First encounter with
   iterating over a collection (phenomenon; formal iterables lesson comes in Chapter 7).
5. **String Manipulation Patterns** — Building new strings, counting characters, common
   algorithms on strings.
6. **Putting It Together** _(capstone)_ — A text processing program: word counter, cipher,
   formatter, or similar.

---

### Chapter 6: Lists

_Introduces the most fundamental Python data structure. List iteration is the second example of
collection iteration, building toward the iterables lesson._

**Lessons:**

1. **Creating & Indexing Lists** — List literals, indexing, negative indexing, `len()`.
2. **Mutating Lists** — `append()`, `insert()`, `remove()`, `pop()`, assignment by index.
3. **Slicing Lists** — Same syntax as string slicing — explicit connection.
4. **Iterating Over Lists** — `for item in list:`, `enumerate()`. Second encounter with
   collection iteration.
5. **List Methods & Patterns** — `sort()`, `reverse()`, `in` operator, common patterns
   (accumulator, filter, search).
6. **Nested Lists** — 2D lists, iterating over rows and columns. Motivating example: a grid
   (connects back to Karel's world).
7. **Putting It Together** _(capstone)_ — A program that manages a collection of data: a
   grade tracker, a simple card game, a to-do list, etc.

---

### Chapter 7: Dictionaries

_Introduces key-value data. The formal iterables lesson lives here, unifying strings, lists,
and dictionaries as examples of the same concept._

**Lessons:**

1. **Creating & Using Dictionaries** — Key-value pairs, creating dicts, looking up values,
   `KeyError`.
2. **Mutating Dictionaries** — Adding, updating, and removing entries. `get()` with defaults.
3. **Iterating Over Dictionaries** — `.keys()`, `.values()`, `.items()`. Third encounter with
   collection iteration.
4. **Iterables** _(formal unification)_ — _"You've iterated over strings, lists, and
   dictionaries. Here's what they all have in common."_ The iterable protocol. `in` operator.
   `enumerate()`. A brief look at generators as a preview.
5. **Dictionary Patterns** — Frequency counting, grouping, lookup tables.
6. **Putting It Together** _(capstone)_ — A richer data program: word frequency analyzer,
   contact book, inventory system, etc.

---

### Chapter 8: Graphics & Animation

_Introduces a real graphics library (TBD — must be Pyodide-compatible and widely used outside
this curriculum). Students draw shapes, use color, and animate objects._

**Library Choice (TBD):** Must satisfy:

- Compatible with Pyodide (browser execution)
- Widely used outside this curriculum (transferable skill)
- Beginner-friendly API
- Supports animation loop pattern

**Lessons:**

1. **Drawing Shapes** — The coordinate system, basic shapes, color, fill vs. stroke.
2. **Using Variables with Graphics** — Position, size, and color as variables. State is visible.
3. **Animation Loop** — The draw loop concept, moving objects, frame rate.
4. **Handling Input** — Mouse and keyboard events, interactive sketches.
5. **Using Functions with Graphics** — Decomposing a drawing into functions. Connects Chapter 4.
6. **Putting It Together** _(capstone)_ — An animated, interactive sketch or simple toy.

---

### Chapter 9: Classes & Objects

_Introduces OOP using graphics objects as motivation. Students already have concrete experience
with objects (graphical shapes) before defining their own classes. Operator overloading is
formally explained here._

**Lessons:**

1. **What is an Object?** — Connect to graphics objects from Chapter 8. State + behavior.
   _"You've been using objects. Now let's make our own."_
2. **Defining Classes** — `class`, `__init__`, instance variables, `self`.
3. **Methods** — Defining and calling methods, the role of `self`.
4. **Encapsulation** — Why we hide state, getters/setters, designing good interfaces.
5. **Operator Overloading** — `__add__`, `__str__`, `__eq__`. Formal explanation of why `+`
   works on strings: _"Remember when `+` worked on strings? Here's why."_
6. **Inheritance** — Subclasses, `super()`, the is-a relationship.
7. **Putting It Together** _(capstone)_ — A class hierarchy for a mini domain (e.g., a shape
   hierarchy, a simple RPG character system).

---

### Chapter 10: Building a Game _(Part 1 Capstone)_

_The milestone capstone for Part 1. Students apply everything — variables, functions, lists,
dictionaries, graphics, and classes — to build a complete, playable game. This is the payoff
for the entire first half of the curriculum._

**Lessons:**

1. **Game Design Fundamentals** — Game loop, state, entities, events. Planning before coding.
2. **Building the Game Loop** — Update + draw cycle, managing game state with classes.
3. **Player & Entities** — Defining game objects as classes, collision detection basics.
4. **Scoring & Levels** — Using dictionaries and lists to track game state.
5. **Polish & Finishing** — Sound (if feasible), game over screen, restarting.
6. **Ship It** _(capstone)_ — Students complete and "publish" their game. The final lesson is
   a showcase moment.

**Note:** A suggested game with starter scaffolding will be provided, but students are
encouraged to put their own spin on it.

---

## Bridge: Files & Exceptions

### Chapter 11: Files & Exceptions

_Bridge between Part 1 and Part 2. Practical Python skills students will need throughout Part 2
and beyond. Pairs file I/O with exception handling naturally since file operations fail in
interesting ways._

**Lessons:**

1. **Reading Files** — `open()`, `read()`, `readlines()`, context managers (`with`).
2. **Writing Files** — Writing and appending, creating files, common patterns.
3. **Working with CSV & JSON** — Reading structured data into lists and dictionaries.
4. **Exceptions** — `try`/`except`, common exception types, `finally`, raising exceptions.
5. **Putting It Together** _(capstone)_ — A program that reads data from a file, processes it,
   and writes results back.

---

## Part 2: CS Fundamentals

_Part 2 is for students who want to go deeper into computer science. Each chapter is still
fine-grained and ends with a capstone, but the material is more conceptually challenging._

**Planned chapters (lesson-level detail TBD):**

### Chapter 12: Recursion

_Recursive thinking, base cases, recursive vs. iterative solutions. The Call Stack Visualizer
is central here — students literally watch the call stack grow and shrink._

### Chapter 13: Searching & Sorting

_Linear search, binary search, bubble sort, merge sort. Analysis of why algorithm choice
matters._

### Chapter 14: Big-O & Complexity

_Analyzing algorithms, O(n), O(log n), O(n²). Connecting back to the sorting algorithms._

### Chapter 15: Stacks & Queues

_Concepts + Python implementations using lists. Real-world use cases._

### Chapter 16: Trees

_Binary trees, tree traversal (recursive), binary search trees._

### Chapter 17: Graphs

_Graph representation, BFS, DFS. Real-world applications._

---

## Future Extensions

The following are planned as optional modules beyond the core curriculum:

- **Web scraping** — `requests`, `BeautifulSoup`
- **Data & visualization** — `pandas`, `matplotlib`
- **APIs** — consuming REST APIs, working with JSON
- **More game development** — advanced graphics, physics
- **Competitive programming** — problem-solving patterns, contest prep

---

## Summary Table

| #   | Chapter                             | Part   | Status      |
| --- | ----------------------------------- | ------ | ----------- |
| 1   | Karel the Robot                     | Part 1 | ✅ Complete |
| 2   | Hello, Python!                      | Part 1 | 🔲 Planned  |
| 3   | Variables & Types                   | Part 1 | 🔲 Planned  |
| 4   | Functions & Parameters              | Part 1 | 🔲 Planned  |
| 5   | Strings                             | Part 1 | 🔲 Planned  |
| 6   | Lists                               | Part 1 | 🔲 Planned  |
| 7   | Dictionaries                        | Part 1 | 🔲 Planned  |
| 8   | Graphics & Animation                | Part 1 | 🔲 Planned  |
| 9   | Classes & Objects                   | Part 1 | 🔲 Planned  |
| 10  | Building a Game _(Part 1 Capstone)_ | Part 1 | 🔲 Planned  |
| 11  | Files & Exceptions _(Bridge)_       | Bridge | 🔲 Planned  |
| 12  | Recursion                           | Part 2 | 🔲 Planned  |
| 13  | Searching & Sorting                 | Part 2 | 🔲 Planned  |
| 14  | Big-O & Complexity                  | Part 2 | 🔲 Planned  |
| 15  | Stacks & Queues                     | Part 2 | 🔲 Planned  |
| 16  | Trees                               | Part 2 | 🔲 Planned  |
| 17  | Graphs                              | Part 2 | 🔲 Planned  |
