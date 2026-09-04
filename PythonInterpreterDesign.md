# Python Interpreter / Debug Visualizer — Design Doc

## 1. Overview

Runs user-written Python in-browser via Pyodide, executes it step by step, and
renders a side panel showing the live call stack and variable state — modeled on
pythontutor.com.

**This is not a standalone site.** It ships as part of the Learning Python
curriculum (this repo), as the `PythonEnvironment` component that Chapter 2
onward is built on, plus an open sandbox at `/python/playground`. `PROGRESS.md`
had listed the Python environment and the Call Stack Visualizer as two separate
pieces of work; they are one, because the worker engine described here is what
gives `input()` and streaming `stdout` their behaviour whether or not the
visualizer panel is shown.

This doc captures the architecture decisions and the reasoning behind them.
**Status: implemented.** See §10 for what lives where.

---

## 2. Core Architecture: Live Stepping via Worker + SharedArrayBuffer

**Decision:** Run Pyodide inside a Web Worker. Use a `SharedArrayBuffer` and
`Atomics.wait`/`Atomics.notify` to make the Python trace function block on each
line until the UI says "continue."

**Why this over the alternative (record-then-replay):**

The naive approach — pause execution and wait for a UI click — doesn't work on
the main thread. Pyodide's interpreter stack sits on the JS call stack, and you
can't suspend that stack and return control to the browser's event loop without
losing it. Python Tutor's actual solution is to run the whole program to
completion up front, snapshot every line, and let the frontend scrub through a
static array. That's the standard workaround for this limitation.

We don't need it. The initial design assumed backward scrubbing (which forces
the record-then-replay model, since a "step" is just moving an index into a
precomputed array), but **you explicitly said you don't care about stepping
backward.** That single constraint removes the reason to avoid live execution,
and live execution is strictly better once it's on the table:

- **`input()` just works.** No queue, no replay-on-prompt trick, no reseeding
  `random`/`time` to keep replays deterministic. The worker genuinely pauses;
  the user types; execution continues.
- **Stepping is free.** The trace function is already blocking on every line;
  "step" is just one `Atomics.notify`.
- **Infinite loops are killable.** `worker.terminate()` from the main thread.
  No artificial step cap needed as a safety mechanism.
- **No memory blowup.** Only the current snapshot is ever held. A
  record-then-replay design has to cap total steps (Python Tutor caps ~1000)
  partly because it's storing a full array of full snapshots. Live stepping
  can run indefinitely — a 100,000-line program costs the same memory as a
  10-line one.

**Trade-off accepted:** no backward scrubbing. If that's ever wanted later, it
would require layering a bounded history buffer on top of live snapshots
(cheap for the last N steps) rather than a redesign.

### Protocol sketch

Two shared regions: a small control buffer (command word + status) and a data
buffer (string payload for input responses). Everything else (stack/heap
snapshots) travels over ordinary `postMessage`, since JSON-serializable data is
structured-clonable and doesn't need to be shared memory — only the _blocking
handshake_ needs `Atomics`.

```
main thread                          worker (Pyodide)
-----------                          ----------------
                                     tracer fires on line event
                                     serialize frame stack -> JSON
                    <-- postMessage({type:"snapshot", data})
render side panel
user clicks Next
Atomics.store(ctl,0,1)
Atomics.notify(ctl,0)  -->
                                     Atomics.wait returns, tracer returns
                                     execution continues

                    <-- postMessage({type:"need-input", prompt})
show input field
write UTF-8 into shared buffer
store length, notify  -->
                                     stdin handler decodes and returns
```

A single command-word convention (step / continue / input-response / cancel)
lets all of these go through the same wait loop.

### No degraded fallback mode

**Decision:** if `crossOriginIsolated` is `false` (private browsing, blocked
service workers, some locked-down corporate browsers), show a clear error
message rather than falling back to a main-thread bounded-chunk-replay mode.

This was a deliberate scope cut. Building a second execution path (with its
own replay semantics, its own determinism requirements for `random`/`time`,
its own step-budget UX) roughly doubles the surface area of the project for a
minority of users. Worth revisiting only if usage data shows this is a
frequent, not edge-case, failure mode.

---

## 3. Tracer & Serialization

### Tracing

`sys.settrace`, compiling user code under a sentinel filename so frames can be
identified:

```python
code = compile(src, "<user_code>", "exec")

def tracer(frame, event, arg):
    if frame.f_code.co_filename != "<user_code>":
        return None          # disables line events inside this frame's callees
    record_snapshot(frame, event, arg)
    return tracer

sys.settrace(tracer)
exec(code, user_globals)
```

The filename check must happen **per frame**, not as a one-time global
disable — otherwise a user callback passed into library code (e.g.
`sorted(key=user_fn)`) never gets traced, since the C-level call into it
creates a genuinely new frame that needs to be evaluated on its own merits.

**Future optimization, not v1:** Python 3.12+'s `sys.monitoring` (PEP 669) is
substantially cheaper than `settrace`. Worth migrating to once the tracer's
correctness is solid, not before.

### Heap-based serialization (the part that makes this pedagogically useful)

The reason a tool like this is worth building is that it can show _aliasing_ —
two variable names pointing at the same list. That requires modeling the heap,
not just recursively dumping values:

- Maintain a per-snapshot map keyed by `id(obj)`.
- Primitives (`int`, `float`, `bool`, `None`, short `str`) get inlined directly
  into frame data.
- Everything else becomes a heap entry; the frame holds a reference
  (`{"ref": 140234}`) instead of the value.
- Memoize **before** recursing into an object's children, so cycles
  (`a.append(a)`) resolve for free instead of infinite-looping the serializer.

**Serialize eagerly, not by reference.** Even without backward scrubbing, the
serializer must walk the object into plain data at the moment of capture — it
can't hold a live reference to, say, a list, because a `postMessage` handoff
requires structured-clonable data anyway, and the object may be mutated by the
next line before the main thread has finished rendering the current snapshot.

**Type policy** (decide explicitly, don't leave it implicit):

- Structural: `list`, `tuple`, `dict`, `set`, `str`, numerics.
- Class instances: `__dict__` plus `__slots__`.
- Classes themselves, functions (including closure cells — worth showing,
  it's a genuinely nice feature for teaching closures), bound methods,
  generators.
- Everything else: `repr()`, capped.

**Caps are mandatory, not optional:** cap string length and container length
per object. A `range(10**6)` materialized into a list, or one enormous string,
will otherwise produce a snapshot that's slow to serialize, slow to transfer,
and unreadable in the UI regardless.

**`id()` reuse:** CPython recycles addresses after garbage collection. Because
we no longer keep a history of snapshots (no scrubbing), stale ids from a
_previous_ step are not a correctness bug — each snapshot is self-contained.
It only matters if a future feature wants continuity/animation of the _same_
object persisting visually across steps; if that's wanted later, the fix is
appending every live-serialized object to a keep-alive list for the trace's
duration.

### stdout

Redirect `sys.stdout` and stream output to the main thread as it's produced,
rather than buffering it into snapshots. The earlier design's "record buffer
length per snapshot" trick existed specifically to support truncating output
correctly when scrubbing backward — with scrubbing removed, that complexity is
gone. Output is just an append-only stream.

### Exceptions

The `'exception'` trace event fires **before** the stack unwinds. That is the
only correct place to capture frame state at the point of failure — not from
an `except` block on the outside, by which point the frames are already gone.

### Recursion and the WASM stack

The WASM stack is smaller than a native one, and deep Python recursion can
hard-crash the Pyodide runtime instead of raising a catchable
`RecursionError`. Set `sys.setrecursionlimit()` conservatively (low hundreds)
so recursion depth becomes a normal Python exception the UI can display,
rather than a dead worker.

---

## 4. Hosting: GitHub Pages, `coi-serviceworker`, No Custom Domain

**Decision:** stay on plain `github.io`, no Cloudflare proxy, no custom
domain, for now. Explicitly acknowledged as revisitable — if this becomes a
real limitation later, moving to a Cloudflare-fronted custom domain is a DNS
and header change, not a rehosting.

### Why headers are needed at all

`SharedArrayBuffer` requires `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` on the response. GitHub Pages
gives no way to set custom response headers.

### How `coi-serviceworker` solves it

A service worker intercepts every `fetch` for the site's own pages and
re-serves the response with the two headers attached. Since a service worker
sits between the page and the network, it can synthesize headers the origin
never sent.

**The first-load reload, and why it's unavoidable on GitHub Pages:** the very
first document load happens before any service worker is registered, so that
load is not isolated. The script detects this (`crossOriginIsolated` is
`false`), registers the worker, waits for it to activate, and reloads the
page — the reload goes through the now-active worker and comes back
correctly isolated. This is a one-time cost per browser (the worker persists
across visits after that), and it's the accepted trade-off for staying on
`github.io` without a custom domain.

**Accepted, known trade-offs of this approach:**

- A hard reload (Ctrl+Shift+R) bypasses service workers, so the reload flash
  can reappear during development. Not a bug.
- Some browsing contexts (notably Firefox private browsing, historically)
  disable service workers entirely — this is exactly the case that now
  surfaces as the plain error message from §2, rather than a fallback mode.
- The script must be served from the site's root path (`/reponame/` on a
  GitHub Pages project site) so its scope covers the whole app; serving it
  from a subdirectory would leave pages outside that path uncontrolled.

**Why we didn't take the Cloudflare route now:** it would eliminate the
reload entirely (a proxy can attach headers to the very first response, since
there's no "worker hasn't installed yet" bootstrap problem), but it requires
owning a domain (~$10–15/year, traffic-independent — Cloudflare's Free plan
Transform Rules, which is what would carry the two headers, cost nothing and
aren't metered by bandwidth) and a small one-time DNS/proxy setup. Given the
GitHub-only preference, this was deferred rather than ruled out.

---

## 5. Pyodide Distribution: CDN First

**Decision:** load Pyodide from jsDelivr, with `crossorigin` on the script
tag. Self-hosting in the repo is the documented fallback if this doesn't pan
out, not the default.

**Reasoning:** `COEP: require-corp` allows cross-origin resources fetched in
CORS mode that pass the CORS check. jsDelivr sends
`Access-Control-Allow-Origin: *`, and Pyodide fetches its own `.wasm` and
`.zip` via `fetch()`, so this is very likely to just work — but it should be
verified early (a ten-minute test: confirm `crossOriginIsolated` and a
successful Pyodide boot from the CDN) rather than assumed.

**If the CDN path fails** (COEP mismatch, CDN blocked on some institutional
network, wanting zero external dependencies): self-host only the **core
runtime** (`pyodide.asm.wasm`, `python_stdlib.zip`, `pyodide.asm.js` — not the
full package distribution, which bundles every wheel and is hundreds of MB).
Core is roughly 10MB per cold load. Reference math, kept here in case this
becomes relevant later:

| Constraint                                       | Value                                                  |
| ------------------------------------------------ | ------------------------------------------------------ |
| GitHub Pages soft bandwidth limit                | ~100GB/month (documented as fair-use, not hard-cutoff) |
| Core Pyodide per cold load                       | ~10MB                                                  |
| Implied cold loads before hitting the soft limit | ~10,000/month (~330/day)                               |

The real problem with self-hosting on GitHub Pages isn't bandwidth math, it's
that **GitHub Pages serves everything with a short (~10 min) `max-age`** that
can't be configured, so repeat visitors re-download the runtime often. If
self-hosting is ever needed, pair it with a small cache-first service
worker for the Pyodide assets specifically — easy to add since a service
worker (`coi-serviceworker`) is already running for header injection; this
would extend that same worker rather than requiring a second one. Treated as
a nice-to-have, not required for v1, since CDN-first sidesteps the problem
entirely if jsDelivr's own caching holds up.

---

## 6. Client-Side Storage

`localStorage` / `sessionStorage` are fine to use normally here (e.g. to
persist the user's in-progress code or editor preferences between visits).
This is a plain browser context, not restricted the way Claude.ai's Artifact
sandbox is — that restriction doesn't apply to your own deployed site.
`IndexedDB` would be the better choice only if the project later needs to
cache something large client-side.

---

## 7. Frontend Rendering

Two-column layout: call stack on the left, heap objects on the right, with
aliasing shown as arrows. Recommended approach: SVG paths computed from
actual DOM element rects (`getBoundingClientRect`) after render, rather than a
general-purpose graph-layout library — the layout is fundamentally two fixed
columns with connectors, not an arbitrary graph.

**Prior art worth reading before building this from scratch:** Python
Tutor's tracer (`pg_logger.py`) and its documented JSON trace format. Even
though our tracer differs (live/blocking vs. batch), adopting a compatible
snapshot shape means the frontend renderer design can draw directly on
Python Tutor's approach, which has years of pedagogical refinement behind it.

### Two layout traps in the measure-then-draw approach

Both of these produced visible bugs; the fixes are pinned by tests in the
`visualizer layout` group of `tests/python.test.ts`.

**Never size the overlay from the box it is drawn over.** An absolutely
positioned child contributes to its container's _scrollable_ overflow, so
setting the SVG's height from `content.scrollHeight` is circular — the overlay
inflates the very measurement it is derived from, and the panel sprouts
scrollbars over empty space. The overlay is now a layer pinned with
`position: absolute; inset: 0; overflow: hidden`, which cannot exceed its
container by construction, and the SVG fills it at 100%. Path geometry is still
measured from real element rects; only the overlay's _size_ stopped being.

**The visualizer must not drive the row's height.** It should fill the height
the editor column establishes — so short programs show no scrollbar at all, and
the two panels line up — and scroll internally past that. A flex item's own
content counts toward the flex line's cross size even with `min-height: 0`, so
the panel is taken out of flow in the two-column layout
(`.visualizer-pane { position: relative }` with the panel at `inset: 0`).
Without that, the choice is between a panel stranded at half the height of the
code it explains and a large heap stretching the whole page downward.

---

## 8. Summary of Key Decisions

| Area                       | Decision                                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Stepping model             | Live, forward-only, via Worker + `SharedArrayBuffer`                                                                 |
| Backward scrubbing         | Not supported                                                                                                        |
| `input()`                  | Blocks the worker via `Atomics.wait`; no replay/queue needed                                                         |
| Infinite loops             | Killed via `worker.terminate()`; no step cap required                                                                |
| Isolation failure fallback | None — show a clear error message                                                                                    |
| Tracer                     | `sys.settrace`, per-frame filename check, migrate to `sys.monitoring` later                                          |
| Object model               | `id()`-keyed heap map, eager serialization, capped sizes                                                             |
| Hosting                    | GitHub Pages, `github.io`, no custom domain                                                                          |
| COOP/COEP                  | `coi-serviceworker`; first-load reload accepted                                                                      |
| Pyodide delivery           | jsDelivr CDN first; self-host core-only as fallback                                                                  |
| Client storage             | `localStorage`/`IndexedDB` available and fine to use                                                                 |
| Reference display          | Python-syntax path labels on every object; arrows only for frame-level references, the rest on hover or pin (see 11) |

---

## 9. Open Items

### Resolved during implementation

- **jsDelivr + `crossorigin` under `COEP: require-corp`** — confirmed working.
  Pyodide boots from the CDN in a cross-origin isolated document in both
  Chromium and WebKit, and this is pinned by an e2e test rather than left to
  trust (`tests/python.test.ts`, "Pyodide loads from the CDN under COEP
  require-corp").
- **Error copy for the non-isolated case** — drafted in `isolationMessage()`
  (`src/lib/python/coi.ts`), one message per cause: no service worker (private
  browsing), insecure context, missing `SharedArrayBuffer`, and a bootstrap that
  ran but did not take.
- **Where the service worker gets registered** — lazily, from Python routes
  only, rather than globally in the root layout. A visitor who only reads a
  Karel lesson or the landing page never pays the one-time reload. Scope is
  still site-wide, since it follows the script's path, not the registering page.
- **Karel and the Pyodide version** — once the service worker is active it
  controls the whole site, so Karel runs under COEP too and its CDN script now
  loads in CORS mode. Karel's runtime was bumped from 0.24.1 to 0.29.3 at the
  same time, so both environments share one cached runtime instead of pulling
  two.

### Still open

- If self-hosting Pyodide is ever needed, decide then whether to extend
  `coi-serviceworker` with asset caching or leave it uncached.
- Revisit the GitHub-only hosting decision if the first-load reload or the
  no-fallback error case proves to be a frequent pain point in practice — the
  Cloudflare + custom domain path remains a low-effort refactor if so.
- Migrate the tracer to `sys.monitoring` (PEP 669). Deliberately deferred until
  the `settrace` implementation has proven correct in use.

---

## 10. Implementation Map

| Concern                                                 | File                                                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Shared-memory protocol, message types, command words    | `src/lib/python/protocol.ts`                                                             |
| Snapshot format and heap-ordering helpers               | `src/lib/python/snapshot.ts`                                                             |
| Reference paths, labels, inbound edges                  | `src/lib/python/paths.ts`                                                                |
| Tracer, heap serializer, stdout/stdin, error formatting | `src/lib/python/tracer.py`                                                               |
| Pyodide host: blocking handshake, `input()`, run loop   | `src/lib/python/worker.ts`                                                               |
| Main-thread controller and state machine                | `src/lib/python/runner.ts`                                                               |
| Cross-origin isolation bootstrap and failure copy       | `src/lib/python/coi.ts`                                                                  |
| Version pins, caps, `PythonConfig`                      | `src/lib/python/config.ts`                                                               |
| Header-injecting service worker                         | `static/coi-serviceworker.js`                                                            |
| Editor / controls / console / visualizer                | `src/lib/components/{CodeEditor,PythonControls,PythonOutput,CallStackVisualizer}.svelte` |
| Embeddable environment                                  | `src/lib/components/PythonEnvironment.svelte`                                            |
| Sandbox route                                           | `src/routes/python/playground/+page.svelte`                                              |
| End-to-end tests (the only real interpreter)            | `tests/python.test.ts`                                                                   |

### Deviations from this document, and why

- **Long strings stay inline, truncated**, rather than becoming heap entries.
  §3 lists `str` as structural, but strings are immutable, so a heap box for one
  teaches nothing about aliasing and costs a column of space. The `truncated`
  flag on the value records that the `repr` was cut.
- **Generators render as an opaque box** with their name and state
  (suspended / running / exhausted) instead of an expanded frame. §3 lists them
  as worth showing; showing a generator's suspended frame properly is a larger
  UI problem than it looks, and this keeps them legible in the meantime.
- **The module's own `call` event is skipped.** It fires before line 1 with
  `f_lineno` 0 and nothing bound, so the first Step lands on line 1 instead of a
  blank frame. A _function's_ `call` event is kept — its parameters are already
  bound, which is exactly the moment worth pausing on.
- **The heap walk is a work queue, not recursion.** §3 says to memoize before
  recursing; memoizing before _queueing_ gets the same cycle handling, and also
  keeps a deeply nested structure from exhausting the interpreter stack while
  the user's own recursion is already partway down it.
- **Stopping is cooperative first, `terminate()` second.** §2 specifies
  `worker.terminate()`. Unwinding via the tracer keeps the (expensive) runtime
  warm, which matters when a student stops a loop and immediately runs again;
  terminate-and-reboot remains the fallback after a short grace period, so a
  loop wedged in a C-level call is still killable.
- **No opt-in AST restriction or exercise tests yet** (`allowedFeatures`,
  `tests` on `PythonConfig`). Deferred deliberately until Chapter 2 lessons
  exist to design them against; `PythonConfig` is shaped so both are additive.

---

## 11. Reference Labels and Arrow Interaction

### The problem

Drawing an arrow for every reference does not scale. A program holding forty
lists inside one list produces forty curves fanning out of a single box into a
tall column, and no individual arrow can be traced. Worse, the two arrows that
carry the lesson — `a` and `b` pointing at one list — look exactly like the
forty that carry nothing.

The root cause is that an arrow is doing two jobs at once: answering _"what does
`b` point to?"_ (forward) and _"who points at this list?"_ (backward). Labels
answer the backward question far better than a line does, and once the backward
question is answered in text, most arrows stop being necessary at all.

### Decision: every object keeps its own box

Objects are **not** inlined into their parents. A list inside a list is visibly
a separate object on the heap, because that is the thing the curriculum is
teaching. The spaghetti is solved by labelling and by drawing fewer arrows, not
by collapsing the object graph.

### Path labels

Every heap object's header names the places that reference it:

```
list  ← a[3]['foo']['bar']
list  ← a, b
```

**Labels are real Python.** `['foo']` for a dict key, `.foo` only for genuine
attribute access on an instance, `[0]` for a sequence index. A label is an
expression the student could paste into their own code and have work. This
matters twice over: it is correct, and it repeatedly puts the dict-key vs.
attribute distinction — which beginners routinely conflate — in front of them.

**Multiple referrers are the point, not an edge case.** A shared object has one
label entry per inbound reference, which is what makes aliasing legible in text:
`← a, b` states it outright.

**Cap:** show up to three. Beyond three, show the first two and a `+N more`
control carrying the real count (four referrers renders `← a, b, +2 more`).
`+N more` is clickable to expand, and expanded lists offer a control to
re-collapse. **Expansion collapses whenever the displayed snapshot changes** —
it is transient view state, not a preference. Note the precise trigger: a step
that ends the program leaves the same snapshot on screen, and nothing resets
then, because there is no new state to re-read.

**Long paths truncate** to a trailing fragment with the full path in the
element's `title` (`list ← …['foo']['bar']`). Untruncated deep paths are how
horizontal scrollbars come back in a narrow column.

### Positions Python cannot name

Some reference positions have no expression that addresses them:

| Position                                            | Rendering              |
| --------------------------------------------------- | ---------------------- |
| Member of a set                                     | `(in s)`               |
| A tuple used as a dict key                          | `(key in d)`           |
| Variable captured by a closure                      | `(captured by repeat)` |
| Object held only by a returning frame's return slot | `(return value)`       |

These render as **parenthesised prose, styled differently from code** (not
monospace), so it is visually obvious they describe a location rather than name
one. Prose does not compose — `(in s)[0]` reads like broken syntax — so the path
search **prefers a fully addressable path when one exists**, even if it is
longer, and falls back to prose only when every route to the object crosses an
unnameable edge.

### Disambiguating frames

Two frames of the same recursive function both bind `n`, and five frames sharing
one list would otherwise render `← path, path, +3 more`, which is useless.

Qualification is therefore **lazy**: a root name is prefixed with its frame only
when the same name appears in more than one frame, counted per function name so
the qualifier means something to a reader (`countdown#2:path` is the second
`countdown` call). The common case stays clean.

### Which arrows are drawn

- **By default: only references held directly by a frame variable.** Nested
  references — a list inside a list — draw nothing until asked for. On the two
  motivating cases this gives one arrow for the forty-list program and two for
  `a = [1, 2]; b = a`, so aliasing between top-level names stays visible with no
  spaghetti.
- Sharing between two _nested_ positions draws no default arrow, but the target's
  label still reads `← rows[0], rows[5]`, so the fact is stated even when it is
  not drawn.

### Hover and click

| Gesture               | Effect                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| Hover a reference     | Draw that arrow; highlight the target box                                                               |
| Hover a heap object   | Draw every arrow into it; highlight the source references                                               |
| Hover either          | Highlight the matching entry inside the target's label, so the label and the arrow are visibly one fact |
| Click                 | Toggle that arrow's visibility, pinning it on or hiding it                                              |
| Click a default arrow | Hides it; defaults are a starting state, not a floor                                                    |

Hit targets are the whole binding row or cell, not the 9px dot, and hover
behaviour is also bound to keyboard focus so the relationships are reachable
without a mouse.

### Toggle persistence across steps

Pins and hides are **keyed by fully-qualified path**, never by `id()`.

This falls out of a constraint already recorded in §3: `id()` is only meaningful
within a single snapshot, because CPython recycles addresses. A pin keyed by
address would silently reattach to an unrelated object after a collection. A pin
keyed by `countdown#2:path` refers to a _location_, which is exactly what the
student pointed at.

Each new snapshot re-resolves every toggle and **silently drops the ones that no
longer resolve** — when a frame pops, its pins go with it, because the thing
that was pinned is gone. No dangling state, no stale-address failure mode.

### Accessibility

Leading with labels rather than lines is what makes the panel legible to a
screen reader at all: the entire reference structure is text in the document.
The arrows-only design conveyed nothing without sight. Hover behaviour is
duplicated on focus for the same reason.

### Implementation status

**Complete.** Every item below is built and covered by tests.

Path computation lives in `src/lib/python/paths.ts` — pure, snapshot-in,
labels-out, so it is unit-testable without a browser. Two-phase BFS from frame
roots: an addressable-only pass first, then a pass allowing unnameable edges for
whatever the first pass could not reach. That yields one canonical shortest path
per object; each object's _label_ is then built by enumerating inbound edges and
rendering `canonicalPath(source) + segment`, which is finite even for cyclic
structures and gives exactly one entry per reference.

- [x] `paths.ts`: segments, two-phase BFS, canonical paths, inbound edges
- [x] `paths.ts`: label rendering, lazy frame qualification, truncation
- [x] Unit tests for the above (`paths.test.ts`, 26 cases)
- [x] Visualizer: render labels on heap boxes, with the 3-cap and `+N more`
- [x] Visualizer: arrow visibility model (defaults / hover / pin / hide)
- [x] Visualizer: label-entry highlighting, focus parity, hit targets
- [x] Toggle persistence by qualified path; expansion collapses on snapshot change
- [x] End-to-end tests (`reference labels` group in `tests/python.test.ts`)
