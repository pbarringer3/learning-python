import { describe, it, expect } from 'vitest';
import {
  canSetBreakpoint,
  clampBreakpoints,
  parseBreakpoints,
  serializeBreakpoints,
  toggleBreakpoint
} from './breakpoints';

describe('canSetBreakpoint', () => {
  it('accepts an ordinary statement', () => {
    expect(canSetBreakpoint('x = 1')).toBe(true);
  });

  it('accepts an indented statement', () => {
    expect(canSetBreakpoint('    print(x)')).toBe(true);
  });

  it('rejects a blank line', () => {
    expect(canSetBreakpoint('')).toBe(false);
    expect(canSetBreakpoint('   \t ')).toBe(false);
  });

  it('rejects a comment line', () => {
    expect(canSetBreakpoint('# set up the list')).toBe(false);
    expect(canSetBreakpoint('    # indented comment')).toBe(false);
  });

  it('accepts a statement with a trailing comment', () => {
    expect(canSetBreakpoint('x = 1  # start at one')).toBe(true);
  });

  // The rule is deliberately a JavaScript heuristic rather than a real parse:
  // it also accepts lines that produce no trace event and so can never fire.
  // See PythonInterpreterDesign.md §12.3.
  it('accepts an `else:` line, which will never actually fire', () => {
    expect(canSetBreakpoint('else:')).toBe(true);
  });
});

describe('toggleBreakpoint', () => {
  it('adds a line that was not set', () => {
    expect(toggleBreakpoint([], 3)).toEqual([3]);
  });

  it('removes a line that was set', () => {
    expect(toggleBreakpoint([1, 3, 5], 3)).toEqual([1, 5]);
  });

  it('keeps the list sorted', () => {
    expect(toggleBreakpoint([5, 1], 3)).toEqual([1, 3, 5]);
  });

  it('never duplicates a line', () => {
    expect(toggleBreakpoint([3, 3], 7)).toEqual([3, 7]);
  });

  it('leaves the input untouched', () => {
    const lines = [1, 2];
    toggleBreakpoint(lines, 3);
    expect(lines).toEqual([1, 2]);
  });
});

describe('clampBreakpoints', () => {
  it('drops lines past the end of the document', () => {
    expect(clampBreakpoints([1, 4, 9], 5)).toEqual([1, 4]);
  });

  it('drops non-positive and non-integer lines', () => {
    expect(clampBreakpoints([0, -2, 1.5, 2], 10)).toEqual([2]);
  });

  it('sorts and de-duplicates', () => {
    expect(clampBreakpoints([3, 1, 3], 10)).toEqual([1, 3]);
  });
});

describe('serializeBreakpoints / parseBreakpoints', () => {
  it('round-trips a set of lines', () => {
    expect(parseBreakpoints(serializeBreakpoints([2, 7]))).toEqual([2, 7]);
  });

  it('reads back an empty set', () => {
    expect(parseBreakpoints(serializeBreakpoints([]))).toEqual([]);
  });

  // Persisted state is user-editable and survives across versions, so anything
  // unparseable has to degrade to "no breakpoints" rather than throw.
  it('returns nothing for malformed or absent storage', () => {
    expect(parseBreakpoints(null)).toEqual([]);
    expect(parseBreakpoints('not json')).toEqual([]);
    expect(parseBreakpoints('{"lines":[1]}')).toEqual([]);
    expect(parseBreakpoints('[1, "two", null, 3]')).toEqual([1, 3]);
  });
});
