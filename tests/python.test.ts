import { expect, test, type Locator, type Page } from '@playwright/test';
import { exerciseFixtures } from '../src/lib/curriculum/exercise-fixtures';

/**
 * End-to-end tests for the Python environment and call stack visualizer.
 *
 * These are the only tests that exercise a real interpreter: the tracer is
 * Python, the handshake needs `SharedArrayBuffer` and a real worker, and none
 * of that exists under Vitest. They are correspondingly slow — each page load
 * boots Pyodide from the CDN.
 */

// Booting Pyodide dominates every test here.
test.setTimeout(180_000);

const CODE_KEY = 'learning-python-code:playground/python';
const BREAKPOINT_KEY = 'learning-python-breakpoints:playground/python';
const VISUALIZER_KEY = 'learning-python-visualizer:playground/python';

interface SeedOptions {
  breakpoints?: number[];
  visualizer?: boolean;
}

/**
 * Open the playground with `code` already in the editor.
 *
 * Seeding `localStorage` rather than typing into CodeMirror keeps the tests
 * deterministic — auto-indent and bracket closing would otherwise mangle
 * multi-line Python as it was typed.
 */
async function openPlayground(page: Page, code: string, options: SeedOptions = {}): Promise<void> {
  const seed = {
    [CODE_KEY]: code,
    ...(options.breakpoints ? { [BREAKPOINT_KEY]: JSON.stringify(options.breakpoints) } : {}),
    ...(options.visualizer === undefined ? {} : { [VISUALIZER_KEY]: String(options.visualizer) })
  };
  await page.addInitScript((entries: Record<string, string>) => {
    try {
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    } catch {
      // about:blank and similar documents have no usable storage.
    }
  }, seed);
  await page.goto('/python/playground');
  await expect(page.locator('.notice-title', { hasText: 'Loading Python' })).toHaveCount(0, {
    timeout: 150_000
  });
}

const button = (page: Page, name: string): Locator =>
  page.locator('.python-controls button', { hasText: name });

/** Anchored exact-text matcher. Path labels are full of regex metacharacters. */
const exactly = (text: string): RegExp =>
  new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

/**
 * The frame row for exactly this variable.
 *
 * Anchored on the name cell rather than matched by substring: a loose
 * `hasText` also matches the placeholder row ("no varia*b*les yet").
 */
const bindingRow = (page: Page, name: string): Locator =>
  page.locator('.frame .row .name').filter({ hasText: exactly(name) });

/**
 * The clickable gutter element for a line.
 *
 * `:visible` excludes CodeMirror's sizing spacer, which carries the same class
 * and the same text as the widest real line number.
 */
const gutterLine = (page: Page, line: number): Locator =>
  page
    .locator('.cm-lineNumbers .cm-gutterElement:visible')
    .filter({ hasText: exactly(String(line)) });

/** Click Step until `target` appears, so tests don't hard-code event counts. */
async function stepUntil(page: Page, target: Locator, limit = 20): Promise<void> {
  for (let attempt = 0; attempt < limit; attempt++) {
    if (await target.isVisible().catch(() => false)) return;
    await button(page, 'Step').click();
    await expect(page.locator('.frame')).not.toHaveCount(0, { timeout: 20_000 });
  }
  await expect(target).toBeVisible();
}

test.describe('cross-origin isolation', () => {
  test('the page is isolated, so SharedArrayBuffer is available', async ({ page }) => {
    await page.goto('/python/playground');
    // The dev/preview server sends COOP/COEP directly; in production the
    // service worker in static/ supplies the same two headers.
    expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
    expect(await page.evaluate(() => typeof SharedArrayBuffer !== 'undefined')).toBe(true);
  });

  test('Pyodide loads from the CDN under COEP require-corp', async ({ page }) => {
    // The design doc flagged this as needing empirical confirmation rather than
    // assumption: jsDelivr must send CORS headers that satisfy require-corp.
    await openPlayground(page, 'print("ready")');
    await expect(button(page, 'Play')).toBeEnabled();
  });
});

test.describe('running a program', () => {
  test('prints output', async ({ page }) => {
    await openPlayground(page, 'print("hello from Python")\nprint(2 + 3)\n');
    await button(page, 'Play').click();
    await expect(page.locator('.output-log')).toContainText('hello from Python');
    await expect(page.locator('.output-log')).toContainText('5');
  });

  test('reports an uncaught exception with its line', async ({ page }) => {
    await openPlayground(page, 'x = 1\nprint(undefined_name)\n');
    await button(page, 'Play').click();
    const error = page.locator('.output-log .error');
    await expect(error).toContainText('NameError');
    await expect(error).toContainText('line 2');
  });

  test('reports a syntax error before running anything', async ({ page }) => {
    await openPlayground(page, 'print("fine")\nif True\n  pass\n');
    await button(page, 'Play').click();
    await expect(page.locator('.output-log .error')).toContainText('SyntaxError');
    // Nothing ran, so the first line never printed.
    await expect(page.locator('.output-log')).not.toContainText('fine');
  });

  test('turns runaway recursion into a normal error rather than killing Python', async ({
    page
  }) => {
    await openPlayground(page, 'def f(n):\n  return f(n + 1)\n\nf(0)\n');
    await button(page, 'Play').click();
    await expect(page.locator('.output-log .error')).toContainText('RecursionError');
    // The runtime survived, so another program can still be run.
    await expect(button(page, 'Play')).toBeEnabled();
  });

  test('clears the console at the start of each run, so one run is on screen', async ({ page }) => {
    // There is no Clear button: starting a run *is* the reset (§12.1). Without
    // it the transcript would silently accumulate across attempts.
    await openPlayground(page, 'print("only once")\n');
    await button(page, 'Play').click();
    await expect(page.locator('.output-log')).toContainText('only once');
    await button(page, 'Play').click();
    await expect(page.locator('.output-log')).toContainText('only once');

    const text = (await page.locator('.output-log').textContent()) ?? '';
    expect(text.split('only once').length - 1).toBe(1);
  });
});

test.describe('stepping', () => {
  test('pauses on each line and shows the global frame', async ({ page }) => {
    await openPlayground(page, 'total = 0\ntotal = total + 5\nprint(total)\n');
    await stepUntil(page, bindingRow(page, 'total'));

    await expect(page.locator('.frame-title').first()).toContainText('Global frame');
    await expect(page.locator('.frame.active')).toHaveCount(1);
  });

  test('highlights the line that is about to run', async ({ page }) => {
    await openPlayground(page, 'a = 1\nb = 2\nc = 3\n');
    await button(page, 'Step').click();
    await expect(page.locator('.cm-highlighted-line')).toBeVisible({ timeout: 20_000 });
  });

  test('shows a called function as a second frame', async ({ page }) => {
    await openPlayground(page, 'def greet(name):\n  return "hi " + name\n\ngreet("ada")\n');
    const inner = page.locator('.frame-title', { hasText: 'greet' });
    await stepUntil(page, inner);
    await expect(page.locator('.frame')).toHaveCount(2);
    // The innermost frame is the call. Its parameter is bound before the body
    // runs, which is what makes pausing on the `call` event worth doing.
    await expect(page.locator('.frame.active')).toContainText('name');
    await expect(page.locator('.frame.active')).toContainText("'ada'");
  });

  test('Play from a pause runs to the end without further pauses', async ({ page }) => {
    await openPlayground(page, 'for i in range(3):\n  print(i)\n');
    await button(page, 'Step').click();
    await expect(page.locator('.frame')).not.toHaveCount(0, { timeout: 20_000 });
    await button(page, 'Play').click();
    await expect(page.locator('.output-log')).toContainText('2');
  });
});

test.describe('the control row', () => {
  // The state machine itself is asserted exhaustively in controls.test.ts;
  // these check that the component is wired to it. See §12.2.
  test('Play becomes Stop while a program is running, and back again', async ({ page }) => {
    await openPlayground(page, 'i = 0\nwhile True:\n  i = i + 1\n');
    await expect(button(page, 'Play')).toBeVisible();
    await button(page, 'Play').click();

    await expect(button(page, 'Stop')).toBeVisible();
    await expect(button(page, 'Play')).toHaveCount(0);

    await button(page, 'Stop').click();
    await expect(button(page, 'Play')).toBeVisible({ timeout: 20_000 });
  });

  test('shows Stop, not Play, while the program waits on input()', async ({ page }) => {
    // Deliberate exception: nothing is executing, but without Stop the only
    // escape from an unanswered prompt would be Reset code, which destroys work.
    await openPlayground(page, 'name = input("Name? ")\nprint(name)\n');
    await button(page, 'Play').click();
    await expect(page.locator('#python-input')).toBeVisible({ timeout: 30_000 });
    await expect(button(page, 'Stop')).toBeEnabled();
    await expect(button(page, 'Play')).toHaveCount(0);
  });

  test('shows Play, not Stop, while paused', async ({ page }) => {
    await openPlayground(page, 'a = 1\nb = 2\nc = 3\n');
    await button(page, 'Step').click();
    await expect(page.locator('.frame')).not.toHaveCount(0, { timeout: 20_000 });
    await expect(button(page, 'Play')).toBeEnabled();
    await expect(button(page, 'Stop')).toHaveCount(0);
  });

  test('disables Reset code while paused, but not when idle', async ({ page }) => {
    await openPlayground(page, 'a = 1\nb = 2\n');
    await expect(button(page, 'Reset code')).toBeEnabled();
    await button(page, 'Step').click();
    await expect(page.locator('.frame')).not.toHaveCount(0, { timeout: 20_000 });
    await expect(button(page, 'Reset code')).toBeDisabled();
  });
});

test.describe('breakpoints', () => {
  const STRAIGHT_LINE = 'a = 1\nb = 2\nc = 3\nd = 4\ne = 5\n';

  test('is disabled until a breakpoint exists', async ({ page }) => {
    await openPlayground(page, STRAIGHT_LINE);
    await expect(button(page, 'To breakpoint')).toBeDisabled();
    await expect(button(page, 'To breakpoint')).toHaveAttribute('title', /click a line number/i);

    await gutterLine(page, 3).click();
    await expect(button(page, 'To breakpoint')).toBeEnabled();
  });

  test('marks the line number, and clicking again clears it', async ({ page }) => {
    await openPlayground(page, STRAIGHT_LINE);
    await gutterLine(page, 3).click();
    await expect(page.locator('.cm-gutterElement.cm-breakpoint')).toHaveCount(1);
    await gutterLine(page, 3).click();
    await expect(page.locator('.cm-gutterElement.cm-breakpoint')).toHaveCount(0);
  });

  test('refuses blank and comment lines', async ({ page }) => {
    // A heuristic, not a parse — but it does keep the two cases that obviously
    // execute nothing from ever being marked (§12.3).
    await openPlayground(page, 'a = 1\n\n# just a note\nb = 2\n');
    await gutterLine(page, 2).click();
    await gutterLine(page, 3).click();
    await expect(page.locator('.cm-gutterElement.cm-breakpoint')).toHaveCount(0);

    await gutterLine(page, 4).click();
    await expect(page.locator('.cm-gutterElement.cm-breakpoint')).toHaveCount(1);
  });

  test('runs straight to the marked line and pauses before it', async ({ page }) => {
    await openPlayground(page, STRAIGHT_LINE, { breakpoints: [4] });
    await button(page, 'To breakpoint').click();

    // Paused *before* line 4 runs: c is bound, d is not.
    await expect(bindingRow(page, 'c')).toBeVisible({ timeout: 20_000 });
    await expect(bindingRow(page, 'd')).toHaveCount(0);
  });

  test('honours a breakpoint added while the program is paused', async ({ page }) => {
    // The case that forces breakpoints through shared memory: a paused worker
    // is blocked inside `Atomics.wait`, so a postMessage would sit unread until
    // the run ended and the breakpoint would silently do nothing (§12.3).
    await openPlayground(page, STRAIGHT_LINE);
    await button(page, 'Step').click();
    await expect(page.locator('.frame')).not.toHaveCount(0, { timeout: 20_000 });

    await gutterLine(page, 4).click();
    await button(page, 'To breakpoint').click();

    await expect(bindingRow(page, 'c')).toBeVisible({ timeout: 20_000 });
    await expect(bindingRow(page, 'd')).toHaveCount(0);
  });

  test('Play ignores breakpoints entirely', async ({ page }) => {
    await openPlayground(page, 'a = 1\nprint("start")\nb = 2\nprint("end")\n', {
      breakpoints: [3]
    });
    await button(page, 'Play').click();
    await expect(page.locator('.output-log')).toContainText('end');
    await expect(page.locator('.banner')).toHaveText('Program complete');
  });

  test('falls through to the end when no breakpoint lies ahead', async ({ page }) => {
    await openPlayground(page, 'a = 1\nprint("done")\n', { breakpoints: [1] });
    await button(page, 'To breakpoint').click();
    await expect(bindingRow(page, 'a')).toHaveCount(0, { timeout: 20_000 });

    // Resuming from the pause with nothing further marked runs to completion.
    await button(page, 'To breakpoint').click();
    await expect(page.locator('.output-log')).toContainText('done');
    await expect(page.locator('.banner')).toHaveText('Program complete');
  });

  test('survives a reload, alongside the code', async ({ page }) => {
    await openPlayground(page, STRAIGHT_LINE, { breakpoints: [2, 4] });
    await expect(page.locator('.cm-gutterElement.cm-breakpoint')).toHaveCount(2);

    await page.reload();
    await expect(page.locator('.notice-title', { hasText: 'Loading Python' })).toHaveCount(0, {
      timeout: 150_000
    });
    await expect(page.locator('.cm-gutterElement.cm-breakpoint')).toHaveCount(2);
  });

  test('is cleared by Reset code, since the program it marked is gone', async ({ page }) => {
    await openPlayground(page, STRAIGHT_LINE, { breakpoints: [2] });
    await expect(page.locator('.cm-gutterElement.cm-breakpoint')).toHaveCount(1);

    await button(page, 'Reset code').click();
    await expect(page.locator('.cm-gutterElement.cm-breakpoint')).toHaveCount(0);
    await expect(button(page, 'To breakpoint')).toBeDisabled();
  });

  test('rides along with its statement when a line is inserted above', async ({ page }) => {
    // Why the editor holds the set as document positions rather than as line
    // numbers: a mark belongs to a statement, not to a row (§12.3).
    await openPlayground(page, 'a = 1\nb = 2\nc = 3\n', { breakpoints: [3] });
    await expect(page.locator('.cm-gutterElement.cm-breakpoint')).toHaveText('3');

    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+Home');
    await page.keyboard.press('Enter');

    await expect(page.locator('.cm-gutterElement.cm-breakpoint')).toHaveText('4');
  });
});

test.describe('editing', () => {
  test('keeps what the student types instead of reverting to the saved code', async ({ page }) => {
    // The restore effect runs whenever its inputs change, and it holds the
    // last-saved text; nothing it does may reach back into the editor while
    // someone is typing into it.
    await openPlayground(page, 'a = 1\n');
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('b = 2');

    await expect(page.locator('.cm-content')).toContainText('b = 2');
    // Long enough for a restore to have fought back if one were going to.
    await page.waitForTimeout(500);
    await expect(page.locator('.cm-content')).toContainText('b = 2');
  });
});

test.describe('the final snapshot', () => {
  test('keeps the ending state on screen after a plain Play', async ({ page }) => {
    // Play installs no tracer, so this state is synthesised from the globals
    // `exec` left behind rather than captured at a trace event (§12.5).
    await openPlayground(page, 'x = 41\nx = x + 1\nprint(x)\n');
    await button(page, 'Play').click();

    await expect(page.locator('.banner')).toHaveText('Program complete');
    await expect(bindingRow(page, 'x')).toBeVisible();
    await expect(page.locator('.frame')).toContainText('42');
    // Nothing is executing any more, so no line is highlighted.
    await expect(page.locator('.cm-highlighted-line')).toHaveCount(0);
  });

  test('shows the frames at the point of failure, with an error banner', async ({ page }) => {
    // Serialised from `exc.__traceback__` after the fact, so Play and Step show
    // the same view of a failure.
    await openPlayground(page, 'x = 7\nboom\n');
    await button(page, 'Play').click();

    await expect(page.locator('.banner')).toHaveText('Program stopped with an error');
    await expect(page.locator('.banner')).toHaveClass(/error/);
    await expect(bindingRow(page, 'x')).toBeVisible();
    await expect(page.locator('.frame')).toContainText('7');
  });

  test('says so, and keeps the last view, when the user pressed Stop', async ({ page }) => {
    await openPlayground(page, 'a = 1\nwhile True:\n  a = a + 1\n');
    await button(page, 'Step').click();
    await expect(page.locator('.frame')).not.toHaveCount(0, { timeout: 20_000 });
    await button(page, 'Play').click();
    await button(page, 'Stop').click();

    await expect(page.locator('.banner')).toHaveText('Stopped', { timeout: 20_000 });
    await expect(page.locator('.frame')).not.toHaveCount(0);
  });

  test('is replaced, not accumulated, by the next run', async ({ page }) => {
    await openPlayground(page, 'x = 1\n');
    await button(page, 'Play').click();
    await expect(page.locator('.banner')).toHaveText('Program complete');

    await button(page, 'Step').click();
    await expect(page.locator('.banner')).toHaveCount(0, { timeout: 20_000 });
  });
});

test.describe('showing and hiding the visualizer', () => {
  test('hides the panel and remembers the choice across a reload', async ({ page }) => {
    await openPlayground(page, 'a = [1, 2]\nprint(a)\n');
    await expect(page.locator('.visualizer')).toBeVisible();

    await page.locator('.python-controls button[aria-label="Hide call stack"]').click();
    await expect(page.locator('.visualizer')).toHaveCount(0);

    await page.reload();
    await expect(page.locator('.notice-title', { hasText: 'Loading Python' })).toHaveCount(0, {
      timeout: 150_000
    });
    // A deliberate choice is not quietly undone on the next visit (§12.4).
    await expect(page.locator('.visualizer')).toHaveCount(0);

    await page.locator('.python-controls button[aria-label="Show call stack"]').click();
    await expect(page.locator('.visualizer')).toBeVisible();
  });

  test('caps the editor column at a reading width instead of stretching it', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await openPlayground(page, 'a = 1\n', { visualizer: false });

    const widths = await page.evaluate(() => {
      const pane = document.querySelector<HTMLElement>('.pane');
      const layout = document.querySelector<HTMLElement>('.layout');
      if (!pane || !layout) throw new Error('layout not rendered');
      return {
        pane: pane.getBoundingClientRect().width,
        layout: layout.getBoundingClientRect().width
      };
    });
    // Very long lines of Python are hard to scan; the spare space stays blank.
    expect(widths.pane).toBeLessThan(widths.layout);
    expect(widths.pane).toBeLessThanOrEqual(56 * 16 + 1);
  });
});

test.describe('editor sizing', () => {
  // Ten lines of floor and twenty of ceiling, so the editor stops resizing on
  // nearly every keystroke — and stops resizing the visualizer beside it (§12.1).
  const scrollerHeight = (page: Page) =>
    page.locator('.cm-scroller').evaluate((el) => el.getBoundingClientRect().height);

  test('holds a floor of ten lines for a short program', async ({ page }) => {
    await openPlayground(page, 'a = 1\nb = 2\n');
    expect(await scrollerHeight(page)).toBeGreaterThanOrEqual(200);
  });

  test('caps at twenty lines and scrolls past that', async ({ page }) => {
    const long = Array.from({ length: 40 }, (_, i) => `x${i} = ${i}`).join('\n') + '\n';
    await openPlayground(page, long);

    const height = await scrollerHeight(page);
    expect(height).toBeLessThanOrEqual(420);

    const scrolls = await page
      .locator('.cm-scroller')
      .evaluate((el) => el.scrollHeight > el.clientHeight + 1);
    expect(scrolls).toBe(true);
  });
});

test.describe('the heap and aliasing', () => {
  test('draws two names pointing at one list', async ({ page }) => {
    await openPlayground(page, 'a = [1, 2]\nb = a\nb.append(3)\nprint(a)\n');

    await stepUntil(page, bindingRow(page, 'b'));

    // One object, two references to it — the whole point of the heap model.
    await expect(page.locator('.heap-object')).toHaveCount(1);
    await expect(page.locator('.frame .ref')).toHaveCount(2);
    // And a connector drawn for each reference.
    await expect(page.locator('.arrows path')).toHaveCount(2);
  });

  test('shows a mutation through one name affecting the other', async ({ page }) => {
    await openPlayground(page, 'a = [1, 2]\nb = a\nb.append(3)\nprint(a)\n');
    await button(page, 'Step').click();
    await expect(page.locator('.frame')).not.toHaveCount(0, { timeout: 20_000 });
    await button(page, 'Play').click();
    await expect(page.locator('.output-log')).toContainText('[1, 2, 3]');
  });

  test('renders an object instance with its attributes', async ({ page }) => {
    await openPlayground(
      page,
      'class Dog:\n  def __init__(self, name):\n    self.name = name\n\nd = Dog("rex")\nprint(d.name)\n'
    );
    // The class object is on the heap too, titled "class Dog"; the instance's
    // box is titled with the type name alone. Match on the toggle rather than
    // the whole title row, which also carries the cap note.
    const instance = page
      .locator('.heap-object')
      .filter({ has: page.locator('.heap-toggle').filter({ hasText: exactly('Dog') }) });
    // The instance box appears empty first and gains `name` when `__init__`
    // assigns it, so wait for the attribute rather than for the box.
    await stepUntil(page, instance.locator('.row .name').filter({ hasText: /^name$/ }), 30);
    await expect(instance).toContainText("'rex'");
  });
});

test.describe('reference labels', () => {
  // A dict nested inside a dict inside a list, plus one list under two names.
  const LABELLED =
    'shared = [1, 2]\na = {"foo": {"bar": [9]}}\nrows = [0, 1, 2, a]\nalso = shared\nprint("done")\n';

  /** The heap box carrying a referrer chip with exactly this label. */
  const boxFor = (page: Page, label: string): Locator =>
    page
      .locator('.heap-object')
      .filter({ has: page.locator('.referrer').filter({ hasText: exactly(label) }) });

  test('names every referrer, in real Python syntax', async ({ page }) => {
    await openPlayground(page, LABELLED);
    await stepUntil(page, bindingRow(page, 'also'), 30);

    // Aliasing, stated in words rather than inferred from two converging lines.
    await expect(boxFor(page, 'shared')).toHaveCount(1);
    await expect(boxFor(page, 'shared')).toContainText('also');

    // A dict key is a subscript, never attribute access — the distinction
    // beginners conflate, put in front of them every time they read a label.
    await expect(boxFor(page, "a['foo']['bar']")).toHaveCount(1);

    // Reached from a name and from inside a list.
    await expect(boxFor(page, 'rows[3]')).toContainText('a');
  });

  test('draws arrows only for frame-level references', async ({ page }) => {
    await openPlayground(page, LABELLED);
    await stepUntil(page, bindingRow(page, 'also'), 30);

    // Four frame variables hold objects; the three nested references stay
    // dormant, which is what keeps a large heap from becoming spaghetti.
    await expect(page.locator('.ref-button')).toHaveCount(7);
    await expect(page.locator('.arrows path')).toHaveCount(4);
  });

  test('reveals a nested reference on hover and pins it on click', async ({ page }) => {
    await openPlayground(page, LABELLED);
    await stepUntil(page, bindingRow(page, 'also'), 30);

    const nested = page.locator('.heap-object .cells .ref-button').first();
    await nested.hover();
    await expect(page.locator('.arrows path')).toHaveCount(5);

    // Clicking pins it, so it survives the pointer leaving.
    await nested.click();
    await page.mouse.move(2, 2);
    await expect(page.locator('.arrows path')).toHaveCount(5);

    // Clicking again puts it back.
    await nested.click();
    await page.mouse.move(2, 2);
    await expect(page.locator('.arrows path')).toHaveCount(4);
  });

  test('a default arrow can be hidden', async ({ page }) => {
    await openPlayground(page, LABELLED);
    await stepUntil(page, bindingRow(page, 'also'), 30);

    // Defaults are a starting state, not a floor.
    const frameRef = page.locator('.frame .ref-button').first();
    await frameRef.click();
    await page.mouse.move(2, 2);
    await expect(page.locator('.arrows path')).toHaveCount(3);
  });

  test('caps the referrer list and expands on demand', async ({ page }) => {
    await openPlayground(
      page,
      'shared = [1]\na = shared\nb = shared\nc = shared\nd = shared\nnest = [shared]\ntail = 1\nprint("done")\n'
    );
    await stepUntil(page, bindingRow(page, 'nest'), 30);

    const box = page.locator('.heap-object').first();
    // Six referrers: the first two, then a count of the rest.
    await expect(box.locator('.referrer')).toHaveCount(2);
    await expect(box.locator('.more')).toHaveText('+4 more');

    await box.locator('.more').click();
    await expect(box.locator('.referrer')).toHaveCount(6);
    await expect(box.locator('.more')).toHaveText('show less');
  });

  test('keeps a pinned arrow across a step but collapses an expansion', async ({ page }) => {
    await openPlayground(
      page,
      'shared = [1]\na = shared\nb = shared\nc = shared\nd = shared\nnest = [shared]\ntail = 1\nprint("done")\n'
    );
    await stepUntil(page, bindingRow(page, 'nest'), 30);

    const box = page.locator('.heap-object').first();
    await box.locator('.more').click();
    await expect(box.locator('.referrer')).toHaveCount(6);

    // Six frame variables hold objects, so six default arrows; pinning the
    // nested reference makes seven. Explicit counts rather than a captured
    // one, so the assertion cannot race the frame that draws the pin.
    await expect(page.locator('.arrows path')).toHaveCount(6);
    await page.locator('.heap-object .cells .ref-button').first().click();
    await page.mouse.move(2, 2);
    await expect(page.locator('.arrows path')).toHaveCount(7);

    await button(page, 'Step').click();
    // Wait for a genuinely new snapshot. Stepping off the end of the program
    // leaves the same snapshot on screen, and nothing should reset then.
    await expect(bindingRow(page, 'tail')).toBeVisible({ timeout: 20_000 });

    // Pins are keyed by path, so the location survives the step; expansion is
    // view state tied to the displayed snapshot, so it does not.
    await expect(page.locator('.arrows path')).toHaveCount(7);
    await expect(box.locator('.more')).toHaveText('+4 more');
  });
});

test.describe('visualizer layout', () => {
  test('shows no scrollbars for a program whose state fits', async ({ page }) => {
    // Regression: the arrows overlay was sized from `content.scrollHeight`,
    // but an absolutely positioned child contributes to its container's
    // scrollable overflow — so the overlay inflated the measurement it was
    // derived from and the panel grew both scrollbars over empty space.
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPlayground(page, 'a = [1, 2]\nb = a\nprint(b)\n');
    await stepUntil(page, bindingRow(page, 'b'));

    const overflow = await page.locator('.scroller').evaluate((el) => ({
      x: el.scrollWidth > el.clientWidth,
      y: el.scrollHeight > el.clientHeight
    }));
    expect(overflow).toEqual({ x: false, y: false });
  });

  test('is as tall as the editor column beside it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPlayground(page, 'a = [1, 2]\nb = a\nprint(b)\n');
    await stepUntil(page, bindingRow(page, 'b'));

    const heights = await page.evaluate(() => {
      const panes = document.querySelectorAll<HTMLElement>('.pane');
      const visualizer = document.querySelector<HTMLElement>('.visualizer');
      if (!visualizer) throw new Error('visualizer not rendered');
      return {
        editorColumn: panes[0].getBoundingClientRect().height,
        visualizer: visualizer.getBoundingClientRect().height
      };
    });
    expect(heights.visualizer).toBeGreaterThan(heights.editorColumn - 8);
  });

  test('scrolls inside its own panel instead of stretching the page', async ({ page }) => {
    // A large heap must not drive the row's height, or the whole page grows
    // downward instead of the panel scrolling.
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPlayground(
      page,
      'rows = []\nfor i in range(40):\n  rows.append([i, i * i, str(i)])\n\nprint(len(rows))\n'
    );
    await stepUntil(page, bindingRow(page, 'rows'), 40);
    // Step on until the heap is genuinely taller than the panel.
    for (let attempt = 0; attempt < 60; attempt++) {
      const overflowing = await page
        .locator('.scroller')
        .evaluate((el) => el.scrollHeight > el.clientHeight);
      if (overflowing) break;
      await button(page, 'Step').click();
    }

    const layout = await page.evaluate(() => {
      const panes = document.querySelectorAll<HTMLElement>('.pane');
      const scroller = document.querySelector<HTMLElement>('.scroller');
      const visualizer = document.querySelector<HTMLElement>('.visualizer');
      if (!scroller || !visualizer) throw new Error('visualizer not rendered');
      return {
        editorColumn: panes[0].getBoundingClientRect().height,
        visualizer: visualizer.getBoundingClientRect().height,
        scrollsY: scroller.scrollHeight > scroller.clientHeight
      };
    });
    expect(layout.scrollsY).toBe(true);
    // Still matched to the editor column rather than having stretched past it.
    expect(layout.visualizer).toBeLessThan(layout.editorColumn + 8);
  });
});

test.describe('input()', () => {
  test('blocks the program until the user answers, then resumes', async ({ page }) => {
    await openPlayground(page, 'name = input("Name? ")\nprint("hello " + name)\n');
    await button(page, 'Play').click();

    const field = page.locator('#python-input');
    await expect(field).toBeVisible({ timeout: 30_000 });
    // Nothing after the prompt has run yet.
    await expect(page.locator('.output-log')).not.toContainText('hello');

    await field.fill('ada');
    await field.press('Enter');
    await expect(page.locator('.output-log')).toContainText('hello ada');
  });
});

test.describe('stopping', () => {
  test('kills a loop that never reaches another trace event', async ({ page }) => {
    // Play installs no tracer, so there is no cooperative stop point here —
    // this exercises the terminate-and-reboot fallback.
    await openPlayground(page, 'i = 0\nwhile True:\n  i = i + 1\n');
    await button(page, 'Play').click();
    await expect(button(page, 'Stop')).toBeEnabled();
    await button(page, 'Stop').click();
    await expect(page.locator('.output-log')).toContainText('Restarting Python', {
      timeout: 20_000
    });
  });

  test('unwinds a stepping program cooperatively', async ({ page }) => {
    await openPlayground(page, 'i = 0\nwhile True:\n  i = i + 1\n');
    await button(page, 'Step').click();
    await expect(page.locator('.frame')).not.toHaveCount(0, { timeout: 20_000 });
    await button(page, 'Play').click();
    await button(page, 'Stop').click();
    // The runtime is still warm — no restart message, and Play works again.
    await expect(button(page, 'Play')).toBeEnabled({ timeout: 20_000 });
    await expect(page.locator('.output-log')).not.toContainText('Restarting Python');
  });
});

test.describe('exercise tests', () => {
  /** Open a lesson with each named exercise's editor already seeded. */
  async function openLesson(page: Page, path: string, seed: Record<string, string>): Promise<void> {
    await page.addInitScript((entries: Record<string, string>) => {
      try {
        for (const [key, code] of Object.entries(entries)) {
          localStorage.setItem(`learning-python-code:${key}`, code);
        }
      } catch {
        // about:blank and similar documents have no usable storage.
      }
    }, seed);
    await page.goto(path);
    await expect(page.locator('.notice-title', { hasText: 'Loading Python' })).toHaveCount(0, {
      timeout: 150_000
    });
  }

  /**
   * The nth *exercise* on a lesson page, counting from zero.
   *
   * A lesson also embeds worked examples, and they come first — so rather than
   * counting every environment, this picks out the ones that have a Run tests
   * button, which is exactly the exercises, in document order.
   */
  const exerciseEnv = (page: Page, index: number): Locator =>
    page
      .locator('.python-environment')
      .filter({ has: page.locator('.python-controls button', { hasText: 'Run tests' }) })
      .nth(index);

  const runTests = (env: Locator): Locator =>
    env.locator('.python-controls button', { hasText: 'Run tests' });

  const SOLUTION_2_1_1 = `print("Crew check")
for i in range(5):
  print("Crew member", i)
print("All aboard")
`;

  const SOLUTION_2_5_2 = `fuel = int(input("Fuel on board (litres): "))
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
`;

  test('a correct solution passes and marks the exercise complete', async ({ page }) => {
    await openLesson(page, '/2/1', { '2/1/exercise-1': SOLUTION_2_1_1 });
    const env = exerciseEnv(page, 0);

    await expect(env.locator('.completed-banner')).toHaveCount(0);
    await runTests(env).click();

    await expect(env.locator('.python-test-results .header.passed')).toBeVisible({
      timeout: 60_000
    });
    // The tick is the point of the whole feature: `markExerciseCompleted`.
    await expect(env.locator('.completed-banner')).toBeVisible();
  });

  test('the tick survives a reload, because it is in the progress store', async ({ page }) => {
    await openLesson(page, '/2/1', { '2/1/exercise-1': SOLUTION_2_1_1 });
    await runTests(exerciseEnv(page, 0)).click();
    await expect(exerciseEnv(page, 0).locator('.completed-banner')).toBeVisible({
      timeout: 60_000
    });

    await page.reload();
    await expect(page.locator('.notice-title', { hasText: 'Loading Python' })).toHaveCount(0, {
      timeout: 150_000
    });
    await expect(exerciseEnv(page, 0).locator('.completed-banner')).toBeVisible();
  });

  test('a wrong answer fails, naming the first line that differs', async ({ page }) => {
    // "All abroad" for "All aboard": correct everywhere but the last line.
    await openLesson(page, '/2/1', {
      '2/1/exercise-1': SOLUTION_2_1_1.replace('All aboard', 'All abroad')
    });
    const env = exerciseEnv(page, 0);
    await runTests(env).click();

    const results = env.locator('.python-test-results');
    await expect(results.locator('.header.failed')).toBeVisible({ timeout: 60_000 });
    await expect(results.locator('.message')).toContainText('Line 7');
    await expect(results.locator('.diff .expected')).toHaveText('All aboard');
    await expect(results.locator('.diff .actual')).toHaveText('All abroad');
    await expect(env.locator('.completed-banner')).toHaveCount(0);
  });

  test('answers input() from the queue, and runs every case', async ({ page }) => {
    // 2/5/exercise-2 is the only exercise with a second case the lesson does
    // not print, so it also proves both cases run rather than just the first.
    await openLesson(page, '/2/5', { '2/5/exercise-2': SOLUTION_2_5_2 });
    const env = exerciseEnv(page, 1);
    await runTests(env).click();

    const results = env.locator('.python-test-results');
    await expect(results.locator('.header.passed')).toBeVisible({ timeout: 90_000 });
    await expect(results.locator('.case')).toHaveCount(2);
    // Answering from the queue means the student is never asked.
    await expect(env.locator('.input-row')).toHaveCount(0);
  });

  test('leaves the console alone, so test output is not mistaken for a run', async ({ page }) => {
    await openLesson(page, '/2/1', { '2/1/exercise-1': SOLUTION_2_1_1 });
    const env = exerciseEnv(page, 0);
    await runTests(env).click();
    await expect(env.locator('.python-test-results .header.passed')).toBeVisible({
      timeout: 60_000
    });

    await expect(env.locator('.output-log')).not.toContainText('All aboard');
  });

  test('Reset code takes the tick away again', async ({ page }) => {
    await openLesson(page, '/2/1', { '2/1/exercise-1': SOLUTION_2_1_1 });
    const env = exerciseEnv(page, 0);
    await runTests(env).click();
    await expect(env.locator('.completed-banner')).toBeVisible({ timeout: 60_000 });

    await env.locator('.python-controls button', { hasText: 'Reset code' }).click();
    await expect(env.locator('.completed-banner')).toHaveCount(0);
    await expect(env.locator('.python-test-results')).toHaveCount(0);
  });

  test('the playground has no Run tests button, having no tests', async ({ page }) => {
    await openPlayground(page, 'print("hello")');
    await expect(page.locator('.python-controls button', { hasText: 'Run tests' })).toHaveCount(0);
  });

  /**
   * Every fixture, executed.
   *
   * `exercise-fixtures.ts` claims a verified solution and the exact stdout it
   * produces for each authored exercise, and `exercise-fixtures.test.ts` can
   * only check that claim against the lesson prose — running Python needs a
   * browser. This is where the claim is actually tested, and it cuts both ways:
   * a fixture whose expected output is wrong makes the exercise unpassable, and
   * a harness that compares wrongly shows up here first.
   */
  test.describe('every authored exercise is solvable by its fixture', () => {
    const byLesson = new Map<string, { key: string; solution: string }[]>();
    for (const fixture of exerciseFixtures) {
      const lesson = fixture.key.split('/').slice(0, 2).join('/');
      const exercises = byLesson.get(lesson) ?? [];
      // One exercise can have several fixtures; they share a solution.
      if (!exercises.some((entry) => entry.key === fixture.key)) {
        exercises.push({ key: fixture.key, solution: fixture.solution });
      }
      byLesson.set(lesson, exercises);
    }

    for (const [lesson, exercises] of byLesson) {
      test(`lesson ${lesson}`, async ({ page }) => {
        const seed = Object.fromEntries(exercises.map((entry) => [entry.key, entry.solution]));
        await openLesson(page, `/${lesson}`, seed);

        for (const [index, exercise] of exercises.entries()) {
          const env = exerciseEnv(page, index);
          await runTests(env).click();
          await expect(
            env.locator('.python-test-results .header.passed'),
            `${exercise.key}: its verified solution does not pass its own tests`
          ).toBeVisible({ timeout: 90_000 });
        }
      });
    }
  });
});
