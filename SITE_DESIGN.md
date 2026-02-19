# Site Design Document

## Overview

Learning Python is a web-based interactive curriculum that teaches Python from the ground up. The site needs to feel **clean and modern** with **playful, bold touches** — especially on the landing page. The overall experience should be approachable for beginners while maintaining a polished, professional feel.

---

## Visual Design

### Tone

- **Primary feel:** Clean, modern, spacious
- **Accent feel:** Playful and bold — bright accent colors, subtle animations, personality in details
- **Landing page** leans more playful; lesson pages lean more clean/focused
- Room for fun easter eggs over time

### Color Scheme

- **Light backgrounds** (white / light gray) with **colorful accent pops**
- Build on existing palette: teal (Karel beepers), blue (grid elements, links)
- Primary accent: bold blue or teal for CTAs, navigation highlights, progress indicators
- Secondary accents: warm colors (orange, yellow, green) for progress states, achievements, variety across chapters
- Neutral text: dark gray/near-black for readability

### Typography

- Clean sans-serif for body text (system font stack or a web font like Inter)
- Monospace for code (already using CodeMirror defaults)
- Bold, large headings on landing page for visual impact
- Readable, well-spaced body text in lessons

---

## Site Structure

### Pages

```
/                       → Landing page (hero + site overview)
/<chapter>              → Chapter landing page (topic showcase + lesson nav)
/<chapter>/<lesson>     → Lesson pages
/karel/playground       → Karel playground (existing, fully functional)
/karel/lesson-examples  → Karel lesson examples (existing)
```

### Layout

- **Global layout** (`+layout.svelte`): Minimal — handles nav drawer toggle, global styles
- **Landing page**: Full-width, no persistent nav — standalone experience
- **Chapter landing pages**: Full-width, playful — mirrors landing page energy with chapter-specific personality
- **Lesson pages**: Content area with optional nav drawer

---

## Landing Page

### Hero Section (above the fold)

- **Live Karel animation** as the centerpiece — Karel autonomously navigating a world, picking up beepers, with code visibly "typing itself" alongside
- Bold headline and tagline
- Primary CTA button (e.g., "Start Learning" → first lesson or chapter overview)
- Secondary CTA (e.g., "Try the Playground" → Karel playground)
- Clean, light background with colorful animated elements

#### Karel Animation Details

- A small Karel world (perhaps 5×5 or 6×4) running a pre-written program on loop
- Code panel beside or below the world showing the corresponding Python code, with the current line highlighted as Karel moves
- Animation auto-plays on page load, loops smoothly
- Should be lightweight — not the full KarelEnvironment component, but a simplified read-only display version optimized for the landing page
- Consider a subtle fade/reset transition between loops

### Site Overview Section (scroll down)

- **What you'll learn** — Brief description of the curriculum arc (Karel → Python fundamentals → data structures & algorithms)
- **How it works** — Explain the interactive, browser-based approach (no installs, code runs in browser, visual feedback)
- **Who it's for** — Beginners with no prior experience; influenced by Stanford CS106A and Art of Problem Solving
- Clean card or section layout with icons or small illustrations
- Keep it concise — 3-4 content blocks max

### Chapter Preview Section (optional, future)

- Visual chapter list showing what's available and what's coming
- Each chapter as a card with an icon, title, and brief description
- Completed chapters show progress indicators
- Grayed-out or "coming soon" treatment for future chapters

---

## Chapter Landing Pages

Each chapter gets its own landing page at `/<chapter>` (e.g., `/karel`). These pages mirror the top-level landing page in spirit — **fun, visual, and engaging** — but are focused on a single chapter's content. They should feel like a "mini landing page" with even more personality and playfulness than the site-level landing page.

### Purpose

- Give students an exciting preview of what the chapter covers
- Provide clear navigation to individual lessons
- Show progress through the chapter at a glance
- Set a tone/theme for the chapter (each chapter can have its own visual flavor)

### Structure

```
[Top bar with nav drawer toggle + site title]

Chapter Hero
═══════════════════════════════════════════════
  Chapter number + title (large, bold)
  Animated/illustrated element unique to this chapter
  Brief tagline describing the chapter's theme
  "Start" or "Continue" CTA button

Topics Covered
═══════════════════════════════════════════════
  Visual grid/cards showing key concepts taught:
  e.g., for Karel: "Functions", "While Loops",
  "Decomposition", "For Loops"
  Each topic card has an icon, short description,
  and a visual indicator if the related lesson is complete

Lesson List
═══════════════════════════════════════════════
  Ordered list of all lessons in the chapter
  Each with: number, title, brief description,
  progress icon, and link to the lesson
  Current/next lesson highlighted
  Completed lessons show a check/green indicator

[Previous Chapter]            [Next Chapter]
```

### Chapter Hero

- Each chapter has a unique animated or illustrated element that represents its theme:
  - **Karel:** Karel robot moving in a mini world (similar to landing page but smaller/different program)
  - **Variables & Types:** Animated variables storing and transforming values
  - **Functions:** Visual showing function calls and returns
  - **Data Structures:** Animated lists, stacks, trees, etc.
- The hero should be **more playful than the site landing page** — brighter colors, more animation, more personality
- Chapter number displayed prominently ("Chapter 1", "Chapter 2", etc.)
- CTA adapts to progress: "Start Chapter" (not started), "Continue" (in progress), "Review" (completed)

### Topic Cards

- Visual grid of 3-6 cards highlighting the key concepts in the chapter
- Each card: icon/illustration + concept name + one-line description
- Cards link to the relevant lesson where that topic is taught
- Cards reflect completion state (muted if not started, colored if in progress, green accent if lesson completed)
- Serve as a quick "table of contents" with more visual appeal than a plain list

### Lesson List

- More detailed than the topic cards — the full ordered lesson sequence
- Each lesson entry: lesson number, title, 1-2 sentence description, progress icon, estimated time (optional)
- Visual distinction for the "next up" lesson (subtle highlight or arrow)
- Completed lessons: checkmark + slightly muted text (de-emphasized but still accessible)
- Clicking a lesson navigates to `/<chapter>/<lesson>`

### Chapter-Specific Personality

- Each chapter can define its own accent color or color pair (while staying within the site palette)
- Unique icons or illustrations per chapter
- Fun details: hover effects on topic cards, subtle animations, thematic touches
- The goal is for each chapter to feel like a "mini-event" — students should be excited to start a new chapter

---

## Navigation

### Slide-Out Drawer

- **Trigger:** Hamburger icon or nav button in the top-left corner (persistent across lesson pages)
- **Behavior:** Slides in from the left, overlays content with a semi-transparent backdrop
- **Not visible on landing page** by default (landing page is a standalone experience)
- **Visible on lesson/playground pages** via a persistent top bar or floating button

### Drawer Contents

```
[User Progress Summary]        ← e.g., "Chapter 1: 4/8 complete"

Chapter 1: Karel the Robot     ← clickable → /karel
  ├─ ● Lesson 1: Meet Karel     ← completed (filled icon)
  ├─ ● Lesson 2: Functions      ← completed
  ├─ ◐ Lesson 3: While Loops    ← in progress (half icon)
  ├─ ○ Lesson 4: For Loops      ← not started (empty icon)
  └─ ...

Chapter 2: Variables & Types    ← clickable → /variables
  ├─ ○ Lesson 1: ...
  └─ ...

[Karel Playground]             ← quick link, always accessible
```

### Progress Icons

- **Not started:** Empty circle (○) — gray/muted
- **In progress:** Half-filled circle (◐) — accent color
- **Completed:** Filled circle or checkmark (●/✓) — green or teal
- Icons should be small, clean, and scannable
- Chapter-level icon shows aggregate progress (e.g., filled proportionally)

### Drawer Behavior

- Closes on backdrop click, Escape key, or explicit close button
- Remembers scroll position within the drawer
- Current lesson highlighted in the drawer
- Smooth slide animation (200-300ms)

---

## Lesson Pages

### Layout

- **Scrolling page with inline embedded interactive environments**
- Lesson content (prose, explanations, diagrams) flows top-to-bottom as a readable document
- Interactive environments (Karel world, future Call Stack Visualizer, etc.) are embedded inline at the appropriate points in the lesson flow
- Students read, then interact, then continue reading — a natural tutorial rhythm

### Structure of a Typical Lesson

```
[Top bar with nav drawer toggle + lesson title + prev/next arrows]

Lesson Title
═══════════════════════════════════════════════

Prose explanation introducing the concept...

┌─────────────────────────────────────────────┐
│  Interactive Example                        │
│  (KarelEnvironment or other module)         │
│  Students can run/edit code here            │
└─────────────────────────────────────────────┘

More prose explanation building on what they just saw...

┌─────────────────────────────────────────────┐
│  Exercise                                   │
│  (KarelEnvironment with tests/validation)   │
│  Students write code to solve a task        │
└─────────────────────────────────────────────┘

Summary / key takeaways

[Previous Lesson]                [Next Lesson]
```

### Lesson Top Bar

- Sticky/fixed at the top of lesson pages
- Nav drawer toggle (hamburger) on the left
- Lesson title centered
- Previous/Next lesson arrows on the right
- Subtle, minimal — should not distract from content

---

## Progress Tracking

### Storage

- **localStorage only** — no accounts, no backend
- Progress stays on the student's device/browser
- Simple, private, zero-friction

### Data Model

```typescript
interface LessonProgress {
  lessonId: string; // e.g., "karel/lesson-1"
  status: 'not-started' | 'in-progress' | 'completed';
  completedAt?: string; // ISO timestamp
  exerciseResults?: {
    // per-exercise completion
    [exerciseId: string]: {
      completed: boolean;
      completedAt?: string;
    };
  };
}

interface SiteProgress {
  version: number; // schema version for future migrations
  lessons: { [lessonId: string]: LessonProgress };
  lastVisited?: string; // lessonId of last visited lesson
}
```

### Completion Criteria

- A lesson is **in-progress** when the student first visits it
- A lesson is **completed** when all exercises within it are passed (validation succeeds)
- Lessons with no exercises are completed on visit (pure reading content)
- Chapter progress is derived from lesson progress

### Persistence

- Save on every meaningful state change (exercise completed, lesson visited)
- Load on app initialization
- Svelte store for reactive UI updates
- `localStorage` key: `learning-python-progress`

---

## Responsive Design

- **Desktop (1024px+):** Full experience — spacious layouts, side-by-side where appropriate
- **Tablet (768-1023px):** Slightly compressed, interactive environments may stack
- **Mobile (< 768px):** Single-column layout, interactive environments full-width. Karel world and code editor stack vertically. Functional but not the primary target.
- Nav drawer works well at all sizes (slide-out pattern is mobile-native)

---

## Future Considerations

- **Dark mode** — Not in initial scope, but design with it in mind (use Tailwind's color system, avoid hard-coded colors)
- **Easter eggs** — Plan for fun hidden interactions (e.g., Konami code, clicking Karel a bunch of times, secret messages in console)
- **Achievements/badges** — Could layer on top of the progress system later
- **Keyboard shortcuts** — Global shortcuts for navigation (e.g., `n` for next lesson, `p` for previous)
- **Print/export** — Lesson content could be printable for offline reference
- **Accessibility** — Ensure WCAG 2.1 AA compliance (focus management, screen reader support, sufficient contrast)

---

## Implementation Todo

### Phase 1: Foundation

- [ ] Create global layout with top bar (nav drawer toggle, site title)
- [ ] Build slide-out nav drawer component (empty shell, hardcoded structure)
- [ ] Set up progress store (Svelte store + localStorage)
- [ ] Define chapter/lesson data structure and routing convention

### Phase 2: Landing Page

- [ ] Design and build landing page hero section (static version first)
- [ ] Build landing page "overview" section (what you'll learn, how it works)
- [ ] Create simplified read-only Karel animation component for the hero
- [ ] Wire hero animation to auto-play on page load

### Phase 3: Chapter Landing Pages

- [ ] Create chapter landing page layout component (hero, topic cards, lesson list)
- [ ] Build chapter hero with animated/illustrated element (Karel chapter first)
- [ ] Build topic cards grid component
- [ ] Build lesson list component with progress indicators
- [ ] Wire chapter pages to chapter/lesson data and progress store
- [ ] Add prev/next chapter navigation
- [ ] Create Karel chapter landing page as proof of concept (`/karel`)

### Phase 4: Lesson Infrastructure

- [ ] Create lesson page layout component (top bar, prev/next, content area)
- [ ] Wire nav drawer to chapter/lesson data (show real structure)
- [ ] Implement progress tracking (mark lessons visited, exercises completed)
- [ ] Add progress icons to nav drawer
- [ ] Build first real Karel lesson as proof of concept

### Phase 5: Polish

- [ ] Responsive design pass (tablet, mobile)
- [ ] Animation and transition polish (drawer, page transitions)
- [ ] Accessibility audit (focus management, keyboard nav, screen reader)
- [ ] Performance audit (lazy loading, Pyodide loading strategy)

---

## Key Design Decisions

| Decision         | Choice                            | Rationale                                                               |
| ---------------- | --------------------------------- | ----------------------------------------------------------------------- |
| Visual tone      | Clean/modern + playful accents    | Approachable for beginners, professional enough to be taken seriously   |
| Color scheme     | Light backgrounds + color pops    | Readability, feels open and inviting                                    |
| Navigation       | Slide-out drawer                  | Maximizes content space, mobile-friendly, familiar pattern              |
| Chapter pages    | Mini-landing pages, extra playful | Excitement for each new chapter, visual topic preview, clear lesson nav |
| Lesson layout    | Scrolling with inline embeds      | Natural reading flow, no context switching between tabs                 |
| Progress storage | localStorage                      | Zero friction, no accounts needed, privacy-friendly                     |
| Landing hero     | Live Karel animation              | Immediately shows what makes the site unique, engaging first impression |
