import { expect, test, type Locator, type Page } from '@playwright/test';

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

/**
 * Open the playground with `code` already in the editor.
 *
 * Seeding `localStorage` rather than typing into CodeMirror keeps the tests
 * deterministic — auto-indent and bracket closing would otherwise mangle
 * multi-line Python as it was typed.
 */
async function openPlayground(page: Page, code: string): Promise<void> {
  await page.addInitScript(
    ([key, source]) => {
      try {
        localStorage.setItem(key, source);
      } catch {
        // about:blank and similar documents have no usable storage.
      }
    },
    [CODE_KEY, code] as const
  );
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
    await expect(button(page, 'Run')).toBeEnabled();
  });
});

test.describe('running a program', () => {
  test('prints output', async ({ page }) => {
    await openPlayground(page, 'print("hello from Python")\nprint(2 + 3)\n');
    await button(page, 'Run').click();
    await expect(page.locator('.output-log')).toContainText('hello from Python');
    await expect(page.locator('.output-log')).toContainText('5');
  });

  test('reports an uncaught exception with its line', async ({ page }) => {
    await openPlayground(page, 'x = 1\nprint(undefined_name)\n');
    await button(page, 'Run').click();
    const error = page.locator('.output-log .error');
    await expect(error).toContainText('NameError');
    await expect(error).toContainText('line 2');
  });

  test('reports a syntax error before running anything', async ({ page }) => {
    await openPlayground(page, 'print("fine")\nif True\n  pass\n');
    await button(page, 'Run').click();
    await expect(page.locator('.output-log .error')).toContainText('SyntaxError');
    // Nothing ran, so the first line never printed.
    await expect(page.locator('.output-log')).not.toContainText('fine');
  });

  test('turns runaway recursion into a normal error rather than killing Python', async ({
    page
  }) => {
    await openPlayground(page, 'def f(n):\n  return f(n + 1)\n\nf(0)\n');
    await button(page, 'Run').click();
    await expect(page.locator('.output-log .error')).toContainText('RecursionError');
    // The runtime survived, so another program can still be run.
    await expect(button(page, 'Run')).toBeEnabled();
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

  test('Continue runs to the end without further pauses', async ({ page }) => {
    await openPlayground(page, 'for i in range(3):\n  print(i)\n');
    await button(page, 'Step').click();
    await expect(button(page, 'Continue')).toBeEnabled({ timeout: 20_000 });
    await button(page, 'Continue').click();
    await expect(page.locator('.output-log')).toContainText('2');
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
    await expect(button(page, 'Continue')).toBeEnabled({ timeout: 20_000 });
    await button(page, 'Continue').click();
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
    await button(page, 'Run').click();

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
    // Run mode installs no tracer, so there is no cooperative stop point here —
    // this exercises the terminate-and-reboot fallback.
    await openPlayground(page, 'i = 0\nwhile True:\n  i = i + 1\n');
    await button(page, 'Run').click();
    await expect(button(page, 'Stop')).toBeEnabled();
    await button(page, 'Stop').click();
    await expect(page.locator('.output-log')).toContainText('Restarting Python', {
      timeout: 20_000
    });
  });

  test('unwinds a stepping program cooperatively', async ({ page }) => {
    await openPlayground(page, 'i = 0\nwhile True:\n  i = i + 1\n');
    await button(page, 'Step').click();
    await expect(button(page, 'Continue')).toBeEnabled({ timeout: 20_000 });
    await button(page, 'Continue').click();
    await button(page, 'Stop').click();
    // The runtime is still warm — no restart message, and Run works again.
    await expect(button(page, 'Run')).toBeEnabled({ timeout: 20_000 });
    await expect(page.locator('.output-log')).not.toContainText('Restarting Python');
  });
});
