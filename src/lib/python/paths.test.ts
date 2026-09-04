import { describe, it, expect } from 'vitest';
import { referenceEdges, edgesByTarget, truncateLabel } from './paths';
import type { Binding, Frame, HeapObject, Snapshot, Value } from './snapshot';

const prim = (repr: string, type = 'int'): Value => ({ kind: 'prim', type, repr });
const ref = (id: number): Value => ({ kind: 'ref', id });
const bind = (name: string, value: Value): Binding => ({ name, value });

function frame(id: number, name: string, locals: Binding[], extra: Partial<Frame> = {}): Frame {
  return { id, name, isGlobal: name === '<module>', line: 1, locals, ...extra };
}

function snapshot(frames: Frame[], heap: HeapObject[]): Snapshot {
  return {
    event: 'line',
    line: 1,
    frames,
    heap: Object.fromEntries(heap.map((object) => [String(object.id), object]))
  };
}

const list = (id: number, items: Value[]): HeapObject => ({
  id,
  kind: 'list',
  type: 'list',
  length: items.length,
  items
});

const dict = (id: number, entries: { key: Value; value: Value }[]): HeapObject => ({
  id,
  kind: 'dict',
  type: 'dict',
  length: entries.length,
  entries
});

const instance = (id: number, type: string, attrs: Binding[]): HeapObject => ({
  id,
  kind: 'instance',
  type,
  attrs
});

/** All labels pointing at one object, in order. */
function labelsFor(snap: Snapshot, id: number): string[] {
  return (edgesByTarget(snap).get(id) ?? []).map((edge) => edge.label);
}

describe('frame-level references', () => {
  it('labels an object held by a global variable with its name', () => {
    const snap = snapshot([frame(1, '<module>', [bind('a', ref(10))])], [list(10, [prim('1')])]);
    expect(labelsFor(snap, 10)).toEqual(['a']);
  });

  it('lists every name pointing at a shared object', () => {
    const snap = snapshot(
      [frame(1, '<module>', [bind('a', ref(10)), bind('b', ref(10))])],
      [list(10, [])]
    );
    expect(labelsFor(snap, 10)).toEqual(['a', 'b']);
  });

  it('marks frame-level references as top level, so they get a default arrow', () => {
    const snap = snapshot(
      [frame(1, '<module>', [bind('a', ref(10))])],
      [list(10, [ref(20)]), list(20, [])]
    );
    const edges = referenceEdges(snap);
    expect(edges.find((e) => e.targetId === 10)?.isTopLevel).toBe(true);
    expect(edges.find((e) => e.targetId === 20)?.isTopLevel).toBe(false);
  });

  it('labels an object held only by a return slot', () => {
    const snap = snapshot(
      [frame(1, '<module>', []), frame(2, 'f', [], { returnValue: ref(10) })],
      [list(10, [])]
    );
    expect(labelsFor(snap, 10)).toEqual(['(return value)']);
  });
});

describe('nested paths use real Python syntax', () => {
  it('uses a subscript for a sequence index', () => {
    const snap = snapshot(
      [frame(1, '<module>', [bind('a', ref(10))])],
      [list(10, [prim('1'), ref(20)]), list(20, [])]
    );
    expect(labelsFor(snap, 20)).toEqual(['a[1]']);
  });

  it('uses a quoted subscript for a dict key, not attribute access', () => {
    // The distinction beginners conflate: `foo` here is a key, not an attribute.
    const snap = snapshot(
      [frame(1, '<module>', [bind('d', ref(10))])],
      [dict(10, [{ key: prim("'foo'", 'str'), value: ref(20) }]), list(20, [])]
    );
    expect(labelsFor(snap, 20)).toEqual(["d['foo']"]);
  });

  it('uses attribute access for a real attribute', () => {
    const snap = snapshot(
      [frame(1, '<module>', [bind('dog', ref(10))])],
      [instance(10, 'Dog', [bind('toys', ref(20))]), list(20, [])]
    );
    expect(labelsFor(snap, 20)).toEqual(['dog.toys']);
  });

  it('composes indexes, keys and attributes into one expression', () => {
    const snap = snapshot(
      [frame(1, '<module>', [bind('a', ref(10))])],
      [
        list(10, [prim('0'), prim('1'), prim('2'), ref(20)]),
        dict(20, [{ key: prim("'foo'", 'str'), value: ref(30) }]),
        dict(30, [{ key: prim("'bar'", 'str'), value: ref(40) }]),
        list(40, [])
      ]
    );
    expect(labelsFor(snap, 40)).toEqual(["a[3]['foo']['bar']"]);
  });

  it('names every referrer of an object reached from several places', () => {
    const snap = snapshot(
      [frame(1, '<module>', [bind('rows', ref(10))])],
      [list(10, [ref(20), ref(20)]), list(20, [])]
    );
    expect(labelsFor(snap, 20)).toEqual(['rows[0]', 'rows[1]']);
  });

  it('uses a non-string dict key verbatim', () => {
    const snap = snapshot(
      [frame(1, '<module>', [bind('d', ref(10))])],
      [dict(10, [{ key: prim('7'), value: ref(20) }]), list(20, [])]
    );
    expect(labelsFor(snap, 20)).toEqual(['d[7]']);
  });
});

describe('positions Python cannot name', () => {
  it('describes a set member in prose', () => {
    const snap = snapshot(
      [frame(1, '<module>', [bind('s', ref(10))])],
      [{ id: 10, kind: 'set', type: 'set', length: 1, items: [ref(20)] }, list(20, [])]
    );
    const [edge] = edgesByTarget(snap).get(20) ?? [];
    expect(edge.label).toBe('(in s)');
    expect(edge.addressable).toBe(false);
  });

  it('describes a tuple used as a dict key in prose', () => {
    const snap = snapshot(
      [frame(1, '<module>', [bind('d', ref(10))])],
      [
        dict(10, [{ key: ref(20), value: prim('1') }]),
        { id: 20, kind: 'tuple', type: 'tuple', length: 0, items: [] }
      ]
    );
    const [edge] = edgesByTarget(snap).get(20) ?? [];
    expect(edge.label).toBe('(key in d)');
    expect(edge.addressable).toBe(false);
  });

  it('describes a closure cell in prose, naming the function', () => {
    const snap = snapshot(
      [frame(1, '<module>', [bind('counter', ref(10))])],
      [
        {
          id: 10,
          kind: 'function',
          type: 'function',
          name: 'counter',
          signature: '()',
          closure: [bind('total', ref(20))]
        },
        list(20, [])
      ]
    );
    const [edge] = edgesByTarget(snap).get(20) ?? [];
    expect(edge.label).toBe('(captured by counter)');
    expect(edge.addressable).toBe(false);
  });

  it('marks an ordinary path as addressable', () => {
    const snap = snapshot([frame(1, '<module>', [bind('a', ref(10))])], [list(10, [])]);
    expect(edgesByTarget(snap).get(10)?.[0].addressable).toBe(true);
  });

  it('prefers an addressable route even when an unnameable one is shorter', () => {
    // `s` holds the tuple directly; `box.inner` reaches it too, one step further.
    // The longer label is the one a student could actually type.
    const tuple: HeapObject = { id: 30, kind: 'tuple', type: 'tuple', length: 0, items: [] };
    const snap = snapshot(
      [frame(1, '<module>', [bind('s', ref(10)), bind('box', ref(20))])],
      [
        { id: 10, kind: 'set', type: 'set', length: 1, items: [ref(30)] },
        instance(20, 'Box', [bind('inner', ref(30))]),
        tuple,
        list(40, [])
      ]
    );
    // A nested object under the tuple must be described through the addressable
    // route, not through the set.
    const withChild = {
      ...snap,
      heap: {
        ...snap.heap,
        '30': { ...tuple, items: [ref(40)], length: 1 }
      }
    };
    expect(labelsFor(withChild, 40)).toEqual(['box.inner[0]']);
  });
});

describe('cycles', () => {
  it('terminates and names the self-reference', () => {
    const snap = snapshot([frame(1, '<module>', [bind('a', ref(10))])], [list(10, [ref(10)])]);
    expect(labelsFor(snap, 10)).toEqual(['a', 'a[0]']);
  });

  it('terminates on a two-object cycle', () => {
    const snap = snapshot(
      [frame(1, '<module>', [bind('a', ref(10))])],
      [list(10, [ref(20)]), list(20, [ref(10)])]
    );
    expect(labelsFor(snap, 20)).toEqual(['a[0]']);
    expect(labelsFor(snap, 10)).toEqual(['a', 'a[0][0]']);
  });
});

describe('frame qualification', () => {
  it('does not qualify names that appear in only one frame', () => {
    const snap = snapshot(
      [frame(1, '<module>', [bind('a', ref(10))]), frame(2, 'f', [bind('b', ref(10))])],
      [list(10, [])]
    );
    expect(labelsFor(snap, 10)).toEqual(['a', 'b']);
  });

  it('qualifies a name bound in more than one frame', () => {
    const snap = snapshot(
      [
        frame(1, '<module>', []),
        frame(2, 'countdown', [bind('path', ref(10))]),
        frame(3, 'countdown', [bind('path', ref(10))])
      ],
      [list(10, [])]
    );
    // Numbered per function name, so "#2" means the second countdown call.
    expect(labelsFor(snap, 10)).toEqual(['countdown#1:path', 'countdown#2:path']);
  });

  it('carries the qualifier into nested paths built on that root', () => {
    const snap = snapshot(
      [frame(1, 'f', [bind('x', ref(10))]), frame(2, 'f', [bind('x', ref(20))])],
      [list(10, [ref(30)]), list(20, []), list(30, [])]
    );
    expect(labelsFor(snap, 30)).toEqual(['f#1:x[0]']);
  });

  it('keeps keys unique across frames so pins cannot collide', () => {
    const snap = snapshot(
      [
        frame(1, 'countdown', [bind('path', ref(10))]),
        frame(2, 'countdown', [bind('path', ref(10))])
      ],
      [list(10, [])]
    );
    const keys = (edgesByTarget(snap).get(10) ?? []).map((edge) => edge.key);
    expect(new Set(keys).size).toBe(2);
  });
});

describe('edge identity', () => {
  it('gives every reference a distinct key', () => {
    const snap = snapshot(
      [frame(1, '<module>', [bind('a', ref(10)), bind('b', ref(10))])],
      [list(10, [ref(20), ref(20)]), list(20, [])]
    );
    const keys = referenceEdges(snap).map((edge) => edge.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('records where each arrow starts', () => {
    const snap = snapshot(
      [frame(1, '<module>', [bind('a', ref(10))])],
      [list(10, [ref(20)]), list(20, [])]
    );
    const edges = referenceEdges(snap);
    expect(edges.find((e) => e.targetId === 10)?.source).toEqual({
      kind: 'frame',
      frameId: 1,
      name: 'a'
    });
    expect(edges.find((e) => e.targetId === 20)?.source).toEqual({
      kind: 'heap',
      objectId: 10,
      slot: 'item:0'
    });
  });

  it('keeps the same key for the same location across snapshots', () => {
    // What makes pinning survive a step: the key names a location, never an id.
    const before = snapshot([frame(1, '<module>', [bind('a', ref(10))])], [list(10, [prim('1')])]);
    const after = snapshot(
      [frame(99, '<module>', [bind('a', ref(77))])],
      [list(77, [prim('1'), prim('2')])]
    );
    expect(referenceEdges(before)[0].key).toBe(referenceEdges(after)[0].key);
  });
});

describe('truncateLabel', () => {
  it('leaves a short label alone', () => {
    expect(truncateLabel('a[3]', 20)).toEqual({ text: 'a[3]', truncated: false });
  });

  it('keeps the tail of a long label, which is the most specific part', () => {
    const result = truncateLabel("data['users'][3]['address']['city']", 18);
    expect(result.truncated).toBe(true);
    expect(result.text.startsWith('…')).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(19);
    expect("data['users'][3]['address']['city']".endsWith(result.text.slice(1))).toBe(true);
  });
});
