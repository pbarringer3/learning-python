import { describe, it, expect } from 'vitest';
import {
  CMD_CONTINUE,
  CMD_INPUT,
  CMD_NONE,
  CMD_STOP,
  CMD_TO_BREAKPOINT,
  CONTROL_SLOTS,
  CTL_COMMAND,
  CTL_INPUT_LEN,
  INPUT_BUFFER_BYTES,
  MAX_BREAKPOINT_LINE,
  createSharedChannel,
  controlView,
  hasBreakpoint,
  readInput,
  writeBreakpoints,
  writeInput
} from './protocol';

describe('createSharedChannel', () => {
  it('allocates a control buffer with room for every slot', () => {
    const channel = createSharedChannel();
    expect(channel.control.byteLength).toBe(CONTROL_SLOTS * 4);
  });

  it('allocates a data buffer of the documented size', () => {
    const channel = createSharedChannel();
    expect(channel.data.byteLength).toBe(INPUT_BUFFER_BYTES);
  });

  it('starts with no pending command', () => {
    const channel = createSharedChannel();
    expect(controlView(channel).at(CTL_COMMAND)).toBe(CMD_NONE);
  });

  it('gives distinct commands distinct values', () => {
    const commands = [CMD_NONE, CMD_CONTINUE, CMD_INPUT, CMD_STOP, CMD_TO_BREAKPOINT];
    expect(new Set(commands).size).toBe(commands.length);
  });

  it('starts with no breakpoints set', () => {
    const channel = createSharedChannel();
    for (const line of [1, 2, 40, MAX_BREAKPOINT_LINE]) {
      expect(hasBreakpoint(channel, line)).toBe(false);
    }
  });
});

/**
 * Breakpoints travel through shared memory rather than `postMessage` for the
 * same reason commands do: they can be toggled while the program is *paused*,
 * and a paused worker is blocked inside `Atomics.wait` with an event queue
 * nobody is pumping. See PythonInterpreterDesign.md §12.3.
 */
describe('writeBreakpoints / hasBreakpoint', () => {
  it('records exactly the lines it was given', () => {
    const channel = createSharedChannel();
    writeBreakpoints(channel, [2, 5]);
    expect(hasBreakpoint(channel, 2)).toBe(true);
    expect(hasBreakpoint(channel, 5)).toBe(true);
    expect(hasBreakpoint(channel, 1)).toBe(false);
    expect(hasBreakpoint(channel, 3)).toBe(false);
    expect(hasBreakpoint(channel, 6)).toBe(false);
  });

  it('handles lines on either side of a 32-bit word boundary', () => {
    const channel = createSharedChannel();
    writeBreakpoints(channel, [32, 33, 64, 65]);
    for (const line of [32, 33, 64, 65]) expect(hasBreakpoint(channel, line)).toBe(true);
    for (const line of [31, 34, 63, 66]) expect(hasBreakpoint(channel, line)).toBe(false);
  });

  // A rewrite is the whole set, not an addition — otherwise clearing a
  // breakpoint mid-pause would leave the worker still stopping there.
  it('clears lines that are no longer in the set', () => {
    const channel = createSharedChannel();
    writeBreakpoints(channel, [3, 9, 40]);
    writeBreakpoints(channel, [9]);
    expect(hasBreakpoint(channel, 9)).toBe(true);
    expect(hasBreakpoint(channel, 3)).toBe(false);
    expect(hasBreakpoint(channel, 40)).toBe(false);
  });

  it('empties the region when given no lines', () => {
    const channel = createSharedChannel();
    writeBreakpoints(channel, [1, 2, 3]);
    writeBreakpoints(channel, []);
    for (const line of [1, 2, 3]) expect(hasBreakpoint(channel, line)).toBe(false);
  });

  it('holds the last line of the supported range', () => {
    const channel = createSharedChannel();
    writeBreakpoints(channel, [MAX_BREAKPOINT_LINE]);
    expect(hasBreakpoint(channel, MAX_BREAKPOINT_LINE)).toBe(true);
  });

  // The region is fixed-size, so a line past it (or a nonsense one) has to be
  // dropped rather than corrupt a neighbouring word.
  it('ignores lines outside the supported range', () => {
    const channel = createSharedChannel();
    expect(() => writeBreakpoints(channel, [0, -5, MAX_BREAKPOINT_LINE + 1])).not.toThrow();
    expect(hasBreakpoint(channel, 0)).toBe(false);
    expect(hasBreakpoint(channel, MAX_BREAKPOINT_LINE + 1)).toBe(false);
  });
});

describe('writeInput / readInput', () => {
  it('round-trips plain text', () => {
    const channel = createSharedChannel();
    writeInput(channel, 'hello world');
    expect(readInput(channel)).toBe('hello world');
  });

  it('round-trips multi-byte characters', () => {
    const channel = createSharedChannel();
    writeInput(channel, 'héllo — 世界 🐍');
    expect(readInput(channel)).toBe('héllo — 世界 🐍');
  });

  it('round-trips the empty string', () => {
    const channel = createSharedChannel();
    writeInput(channel, '');
    expect(readInput(channel)).toBe('');
    expect(controlView(channel).at(CTL_INPUT_LEN)).toBe(0);
  });

  it('records the byte length, not the character length', () => {
    const channel = createSharedChannel();
    writeInput(channel, '世界');
    expect(controlView(channel).at(CTL_INPUT_LEN)).toBe(6);
  });

  it('overwrites a previous, longer value without leaving a tail behind', () => {
    const channel = createSharedChannel();
    writeInput(channel, 'a much longer first value');
    writeInput(channel, 'short');
    expect(readInput(channel)).toBe('short');
  });

  it('reports truncation when the text exceeds the buffer', () => {
    const channel = createSharedChannel();
    const oversized = 'x'.repeat(INPUT_BUFFER_BYTES + 10);
    const result = writeInput(channel, oversized);
    expect(result.truncated).toBe(true);
    expect(readInput(channel).length).toBe(INPUT_BUFFER_BYTES);
  });

  it('never splits a multi-byte character when truncating', () => {
    const channel = createSharedChannel();
    // '☃' is 3 UTF-8 bytes, so this cannot divide evenly into the buffer.
    const oversized = '☃'.repeat(INPUT_BUFFER_BYTES);
    const result = writeInput(channel, oversized);
    expect(result.truncated).toBe(true);
    // Decoding must not produce a replacement character from a split sequence.
    expect(readInput(channel)).not.toContain('�');
  });

  it('reports no truncation for text that fits', () => {
    const channel = createSharedChannel();
    expect(writeInput(channel, 'fits').truncated).toBe(false);
  });

  // Browsers refuse to let TextEncoder/TextDecoder touch shared memory —
  // "The provided Uint8Array value must not be shared" — because neither
  // argument is declared [AllowShared]. Node allows it, so without these checks
  // the regression is invisible until the code runs in a real browser.
  it('never asks TextEncoder to write directly into shared memory', () => {
    const original = TextEncoder.prototype.encodeInto;
    const destinations: Uint8Array[] = [];
    TextEncoder.prototype.encodeInto = function (source, destination) {
      destinations.push(destination);
      return original.call(this, source, destination);
    };

    try {
      writeInput(createSharedChannel(), 'hello');
      expect(destinations.length).toBeGreaterThan(0);
      for (const destination of destinations) {
        expect(destination.buffer).not.toBeInstanceOf(SharedArrayBuffer);
      }
    } finally {
      TextEncoder.prototype.encodeInto = original;
    }
  });

  it('never asks TextDecoder to read directly from shared memory', () => {
    const original = TextDecoder.prototype.decode;
    const sources: unknown[] = [];
    TextDecoder.prototype.decode = function (input?: AllowSharedBufferSource, options?) {
      sources.push(input);
      return original.call(this, input as ArrayBufferView, options);
    };

    try {
      const channel = createSharedChannel();
      writeInput(channel, 'hello');
      expect(readInput(channel)).toBe('hello');
      expect(sources.length).toBeGreaterThan(0);
      for (const source of sources) {
        expect((source as ArrayBufferView).buffer).not.toBeInstanceOf(SharedArrayBuffer);
      }
    } finally {
      TextDecoder.prototype.decode = original;
    }
  });
});
