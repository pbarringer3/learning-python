import { describe, it, expect } from 'vitest';
import {
  activeFrame,
  globalFrame,
  heapObjectRefs,
  isRef,
  orderedHeap,
  parseSnapshot,
  valueRefs,
  type HeapObject,
  type Snapshot
} from './snapshot';

const prim = (type: string, repr: string) => ({ kind: 'prim' as const, type, repr });
const ref = (id: number) => ({ kind: 'ref' as const, id });

function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    event: 'line',
    line: 1,
    frames: [{ id: 1, name: '<module>', isGlobal: true, line: 1, locals: [] }],
    heap: {},
    ...overrides
  };
}

describe('isRef / valueRefs', () => {
  it('distinguishes references from inlined primitives', () => {
    expect(isRef(ref(7))).toBe(true);
    expect(isRef(prim('int', '3'))).toBe(false);
  });

  it('collects the id from a reference and nothing from a primitive', () => {
    expect(valueRefs(ref(7))).toEqual([7]);
    expect(valueRefs(prim('str', "'hi'"))).toEqual([]);
  });
});

describe('heapObjectRefs', () => {
  it('collects references from sequence items', () => {
    const obj: HeapObject = {
      id: 1,
      kind: 'list',
      type: 'list',
      length: 3,
      items: [prim('int', '1'), ref(2), ref(3)]
    };
    expect(heapObjectRefs(obj)).toEqual([2, 3]);
  });

  it('collects references from both halves of a dict entry', () => {
    const obj: HeapObject = {
      id: 1,
      kind: 'dict',
      type: 'dict',
      length: 1,
      entries: [{ key: ref(2), value: ref(3) }]
    };
    expect(heapObjectRefs(obj)).toEqual([2, 3]);
  });

  it('collects references from instance attributes', () => {
    const obj: HeapObject = {
      id: 1,
      kind: 'instance',
      type: 'Dog',
      attrs: [
        { name: 'name', value: prim('str', "'Rex'") },
        { name: 'toys', value: ref(5) }
      ]
    };
    expect(heapObjectRefs(obj)).toEqual([5]);
  });

  it('collects references from closure cells', () => {
    const obj: HeapObject = {
      id: 1,
      kind: 'function',
      type: 'function',
      name: 'counter',
      signature: '()',
      closure: [{ name: 'total', value: ref(9) }]
    };
    expect(heapObjectRefs(obj)).toEqual([9]);
  });

  it('returns nothing for an opaque object', () => {
    const obj: HeapObject = { id: 1, kind: 'other', type: 'module', repr: '<module math>' };
    expect(heapObjectRefs(obj)).toEqual([]);
  });
});

describe('orderedHeap', () => {
  it('is empty when nothing is on the heap', () => {
    expect(orderedHeap(makeSnapshot())).toEqual([]);
  });

  it('orders objects by first reference from the frames', () => {
    const snapshot = makeSnapshot({
      frames: [
        {
          id: 1,
          name: '<module>',
          isGlobal: true,
          line: 1,
          locals: [
            { name: 'b', value: ref(20) },
            { name: 'a', value: ref(10) }
          ]
        }
      ],
      heap: {
        '10': { id: 10, kind: 'list', type: 'list', length: 0, items: [] },
        '20': { id: 20, kind: 'list', type: 'list', length: 0, items: [] }
      }
    });
    expect(orderedHeap(snapshot).map((o) => o.id)).toEqual([20, 10]);
  });

  it('follows references out of heap objects, breadth first', () => {
    const snapshot = makeSnapshot({
      frames: [
        {
          id: 1,
          name: '<module>',
          isGlobal: true,
          line: 1,
          locals: [{ name: 'outer', value: ref(10) }]
        }
      ],
      heap: {
        '10': { id: 10, kind: 'list', type: 'list', length: 1, items: [ref(30)] },
        '30': { id: 30, kind: 'list', type: 'list', length: 0, items: [] }
      }
    });
    expect(orderedHeap(snapshot).map((o) => o.id)).toEqual([10, 30]);
  });

  it('lists a shared object once, even when two names point at it', () => {
    const snapshot = makeSnapshot({
      frames: [
        {
          id: 1,
          name: '<module>',
          isGlobal: true,
          line: 1,
          locals: [
            { name: 'a', value: ref(10) },
            { name: 'b', value: ref(10) }
          ]
        }
      ],
      heap: { '10': { id: 10, kind: 'list', type: 'list', length: 0, items: [] } }
    });
    expect(orderedHeap(snapshot).map((o) => o.id)).toEqual([10]);
  });

  it('terminates on a self-referential object', () => {
    const snapshot = makeSnapshot({
      frames: [
        {
          id: 1,
          name: '<module>',
          isGlobal: true,
          line: 1,
          locals: [{ name: 'a', value: ref(10) }]
        }
      ],
      heap: { '10': { id: 10, kind: 'list', type: 'list', length: 1, items: [ref(10)] } }
    });
    expect(orderedHeap(snapshot).map((o) => o.id)).toEqual([10]);
  });

  it('skips references with no matching heap entry', () => {
    const snapshot = makeSnapshot({
      frames: [
        {
          id: 1,
          name: '<module>',
          isGlobal: true,
          line: 1,
          locals: [{ name: 'a', value: ref(99) }]
        }
      ],
      heap: {}
    });
    expect(orderedHeap(snapshot)).toEqual([]);
  });

  it('includes objects reachable only from an inner frame', () => {
    const snapshot = makeSnapshot({
      frames: [
        { id: 1, name: '<module>', isGlobal: true, line: 1, locals: [] },
        { id: 2, name: 'f', isGlobal: false, line: 4, locals: [{ name: 'x', value: ref(10) }] }
      ],
      heap: { '10': { id: 10, kind: 'list', type: 'list', length: 0, items: [] } }
    });
    expect(orderedHeap(snapshot).map((o) => o.id)).toEqual([10]);
  });

  it('follows a reference held only in a return value', () => {
    const snapshot = makeSnapshot({
      event: 'return',
      frames: [
        { id: 1, name: '<module>', isGlobal: true, line: 1, locals: [] },
        { id: 2, name: 'f', isGlobal: false, line: 4, locals: [], returnValue: ref(10) }
      ],
      heap: { '10': { id: 10, kind: 'list', type: 'list', length: 0, items: [] } }
    });
    expect(orderedHeap(snapshot).map((o) => o.id)).toEqual([10]);
  });
});

describe('activeFrame / globalFrame', () => {
  it('treats the innermost frame as active', () => {
    const snapshot = makeSnapshot({
      frames: [
        { id: 1, name: '<module>', isGlobal: true, line: 1, locals: [] },
        { id: 2, name: 'f', isGlobal: false, line: 4, locals: [] }
      ]
    });
    expect(activeFrame(snapshot)?.name).toBe('f');
    expect(globalFrame(snapshot)?.name).toBe('<module>');
  });

  it('returns undefined when there are no frames', () => {
    const snapshot = makeSnapshot({ frames: [] });
    expect(activeFrame(snapshot)).toBeUndefined();
    expect(globalFrame(snapshot)).toBeUndefined();
  });
});

describe('parseSnapshot', () => {
  it('parses the JSON the tracer emits', () => {
    const json = JSON.stringify(makeSnapshot({ line: 12 }));
    expect(parseSnapshot(json).line).toBe(12);
  });

  it('throws on malformed JSON rather than returning a partial snapshot', () => {
    expect(() => parseSnapshot('{ not json')).toThrow();
  });
});
