/**
 * Breakpoint bookkeeping: which lines may carry one, and how a set of them is
 * toggled, clamped, and persisted.
 *
 * Everything here is line-number arithmetic on plain arrays. The editor holds
 * the authoritative copy as CodeMirror document positions so a breakpoint rides
 * along with its statement when lines are inserted above it (see
 * `CodeEditor.svelte`); these functions are what that copy is converted to and
 * from at the edges — storage, the worker, and the control row.
 */

/** `localStorage` key prefix, alongside `learning-python-code:`. */
export const BREAKPOINT_PREFIX = 'learning-python-breakpoints:';

/**
 * Whether a line is allowed to carry a breakpoint.
 *
 * This is a heuristic, judged in JavaScript rather than by compiling the
 * source: it also accepts `else:` and continuation lines, which produce no
 * trace event and so can never fire. That is accepted knowingly as the cheap
 * option — those constructs are rare in the code these chapters ask for, and
 * the exact executable-line set is a deferred follow-on (see
 * `PythonInterpreterDesign.md` §12.3).
 */
export function canSetBreakpoint(lineText: string): boolean {
  const trimmed = lineText.trim();
  return trimmed.length > 0 && !trimmed.startsWith('#');
}

/** Sort, de-duplicate, and drop anything that is not a real line number. */
export function clampBreakpoints(lines: number[], lineCount: number): number[] {
  const kept = new Set<number>();
  for (const line of lines) {
    if (!Number.isInteger(line) || line < 1 || line > lineCount) continue;
    kept.add(line);
  }
  return [...kept].sort((a, b) => a - b);
}

/** Add `line` if absent, remove it if present. Returns a new array. */
export function toggleBreakpoint(lines: number[], line: number): number[] {
  const next = new Set(lines);
  if (next.has(line)) next.delete(line);
  else next.add(line);
  return [...next].sort((a, b) => a - b);
}

/** Encode for `localStorage`. */
export function serializeBreakpoints(lines: number[]): string {
  return JSON.stringify(lines);
}

/**
 * Decode what `serializeBreakpoints` wrote.
 *
 * Stored state is user-editable and outlives any one version of this code, so
 * anything unparseable degrades to "no breakpoints" rather than throwing and
 * taking the whole editor down with it.
 */
export function parseBreakpoints(raw: string | null): number[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((line): line is number => Number.isInteger(line) && (line as number) >= 1);
}
