/**
 * Reference paths: naming every place a heap object is referenced from.
 *
 * This is what lets the visualizer label an object `list ← a[3]['foo']['bar']`
 * instead of drawing forty indistinguishable arrows. See
 * `PythonInterpreterDesign.md` §11 for the design and the reasoning.
 *
 * Two properties are load-bearing:
 *
 *  - **Labels are real Python.** `['foo']` for a dict key, `.foo` only for a
 *    genuine attribute. A label is an expression the student could paste into
 *    their own code, which also keeps putting the key-vs-attribute distinction
 *    in front of them.
 *  - **Keys name locations, not addresses.** `id()` is only meaningful inside
 *    one snapshot (§3), so a pin keyed by address would silently reattach to an
 *    unrelated object after a collection. Keying by path means a pin survives
 *    stepping, and vanishes when the location does.
 *
 * Everything here is a pure function of one snapshot, so it is unit-testable
 * without a browser or an interpreter.
 */

import {
  isRef,
  orderedHeap,
  type Frame,
  type HeapObject,
  type Snapshot,
  type Value
} from './snapshot';

/** How to get from a container to one of the things it holds. */
type Segment =
  | { kind: 'index'; index: number }
  | { kind: 'key'; repr: string }
  | { kind: 'attr'; name: string }
  | { kind: 'set-member' }
  | { kind: 'dict-key' }
  | { kind: 'closure'; owner: string }
  | { kind: 'bound-self' };

/** Where an arrow starts. */
export type ReferenceSource =
  | { kind: 'frame'; frameId: number; name: string }
  | { kind: 'heap'; objectId: number; slot: string };

/** One reference: a single place that points at a heap object. */
export interface ReferenceEdge {
  /** Heap id being pointed at. */
  targetId: number;
  /** Rendered label, e.g. `a[3]['foo']` or `(in s)`. */
  label: string;
  /** False when the path crosses a position Python has no expression for. */
  addressable: boolean;
  /**
   * Stable identity for pinning. Derived from the location, never from `id()`,
   * so it means the same thing in the next snapshot.
   */
  key: string;
  source: ReferenceSource;
  /** Frame-level references get a default arrow; nested ones do not. */
  isTopLevel: boolean;
}

/** A canonical route to an object, already rendered. */
interface CanonicalPath {
  text: string;
  addressable: boolean;
}

/** Label used for an object held only by a returning frame's return slot. */
const RETURN_SLOT = '(return value)';

/** Extend a path by one step, rendering as Python where Python can say it. */
function extend(parent: CanonicalPath, segment: Segment): CanonicalPath {
  switch (segment.kind) {
    case 'index':
      return { text: `${parent.text}[${segment.index}]`, addressable: parent.addressable };
    case 'key':
      return { text: `${parent.text}[${segment.repr}]`, addressable: parent.addressable };
    case 'attr':
      return { text: `${parent.text}.${segment.name}`, addressable: parent.addressable };
    // The rest are positions no expression can address, so they are described
    // rather than named — and the description swallows the path so far.
    case 'set-member':
      return { text: `(in ${parent.text})`, addressable: false };
    case 'dict-key':
      return { text: `(key in ${parent.text})`, addressable: false };
    case 'closure':
      return { text: `(captured by ${segment.owner})`, addressable: false };
    case 'bound-self':
      return { text: `(bound to ${parent.text})`, addressable: false };
  }
}

/** Every reference held by one heap object, in display order. */
function outgoing(object: HeapObject): { slot: string; target: number; segment: Segment }[] {
  const edges: { slot: string; target: number; segment: Segment }[] = [];
  const add = (slot: string, value: Value, segment: Segment) => {
    if (isRef(value)) edges.push({ slot, target: value.id, segment });
  };

  switch (object.kind) {
    case 'list':
    case 'tuple':
      object.items.forEach((item, index) => add(`item:${index}`, item, { kind: 'index', index }));
      break;
    case 'set':
      object.items.forEach((item, index) => add(`item:${index}`, item, { kind: 'set-member' }));
      break;
    case 'dict':
      object.entries.forEach((entry, index) => {
        add(`key:${index}`, entry.key, { kind: 'dict-key' });
        // A key's repr is only usable as a subscript when the key is a value
        // small enough to have been inlined; a heap-allocated key is handled by
        // the `dict-key` edge above.
        const segment: Segment = isRef(entry.key)
          ? { kind: 'dict-key' }
          : { kind: 'key', repr: entry.key.repr };
        add(`value:${index}`, entry.value, segment);
      });
      break;
    case 'instance':
    case 'class':
      object.attrs.forEach((attr) =>
        add(`attr:${attr.name}`, attr.value, { kind: 'attr', name: attr.name })
      );
      break;
    case 'function':
      (object.closure ?? []).forEach((cell) =>
        add(`closure:${cell.name}`, cell.value, { kind: 'closure', owner: object.name })
      );
      break;
    case 'method':
      add('self', object.self, { kind: 'bound-self' });
      break;
    case 'other':
      break;
  }

  return edges;
}

/**
 * Render each frame's root names, qualifying only where a name is ambiguous.
 *
 * Five recursive frames sharing one list would otherwise all label it `path`,
 * which is useless. Qualifying every name instead would make the common case
 * needlessly noisy, so it is done lazily: a name is prefixed with its frame
 * only when more than one frame binds it. The ordinal counts calls of the same
 * function, so `countdown#2` means the second `countdown` call.
 */
function rootNamer(frames: Frame[]): (frame: Frame, name: string) => string {
  const framesPerName = new Map<string, Set<number>>();
  for (const frame of frames) {
    for (const binding of frame.locals) {
      const owners = framesPerName.get(binding.name) ?? new Set<number>();
      owners.add(frame.id);
      framesPerName.set(binding.name, owners);
    }
  }

  const seenNames = new Map<string, number>();
  const totals = new Map<string, number>();
  for (const frame of frames) {
    const display = frame.isGlobal ? 'global' : frame.name;
    totals.set(display, (totals.get(display) ?? 0) + 1);
  }

  const qualifiers = new Map<number, string>();
  for (const frame of frames) {
    const display = frame.isGlobal ? 'global' : frame.name;
    const ordinal = (seenNames.get(display) ?? 0) + 1;
    seenNames.set(display, ordinal);
    qualifiers.set(frame.id, (totals.get(display) ?? 1) > 1 ? `${display}#${ordinal}` : display);
  }

  return (frame, name) => {
    const ambiguous = (framesPerName.get(name)?.size ?? 0) > 1;
    return ambiguous ? `${qualifiers.get(frame.id)}:${name}` : name;
  };
}

/** The references held directly by frames — the roots of every path. */
function rootEdges(
  snapshot: Snapshot
): { frame: Frame; name: string; label: string; target: number }[] {
  const nameFor = rootNamer(snapshot.frames);
  const roots: { frame: Frame; name: string; label: string; target: number }[] = [];

  for (const frame of snapshot.frames) {
    for (const binding of frame.locals) {
      if (isRef(binding.value)) {
        roots.push({
          frame,
          name: binding.name,
          label: nameFor(frame, binding.name),
          target: binding.value.id
        });
      }
    }
    if (frame.returnValue && isRef(frame.returnValue)) {
      roots.push({
        frame,
        name: RETURN_SLOT,
        label: RETURN_SLOT,
        target: frame.returnValue.id
      });
    }
  }

  return roots;
}

/**
 * The shortest route to every object, preferring routes a student could type.
 *
 * Run as two passes: the first walks only addressable edges, so an object
 * reachable both through a set and through an attribute is described by the
 * attribute even though the set route is shorter. The second pass allows the
 * unnameable edges, picking up whatever the first could not reach.
 */
function canonicalPaths(snapshot: Snapshot): Map<number, CanonicalPath> {
  const canonical = new Map<number, CanonicalPath>();
  const roots = rootEdges(snapshot);

  const walk = (allowUnaddressable: boolean) => {
    const seen = new Set<number>();
    const queue: { id: number; path: CanonicalPath }[] = roots.map((root) => ({
      id: root.target,
      path: { text: root.label, addressable: true }
    }));

    while (queue.length > 0) {
      const { id, path } = queue.shift() as { id: number; path: CanonicalPath };
      if (seen.has(id)) continue;
      seen.add(id);
      if (!canonical.has(id)) canonical.set(id, path);

      const object = snapshot.heap[String(id)];
      if (!object) continue;

      // Build children on the best route known to this object, which may be a
      // better one found by the addressable-only pass.
      const from = canonical.get(id) as CanonicalPath;
      for (const edge of outgoing(object)) {
        const next = extend(from, edge.segment);
        if (!allowUnaddressable && !next.addressable) continue;
        if (seen.has(edge.target)) continue;
        queue.push({ id: edge.target, path: next });
      }
    }
  };

  walk(false);
  walk(true);
  return canonical;
}

/** Heap objects in display order, including any the ordered walk missed. */
function allObjects(snapshot: Snapshot): HeapObject[] {
  const ordered = orderedHeap(snapshot);
  const seen = new Set(ordered.map((object) => object.id));
  const rest = Object.values(snapshot.heap).filter((object) => !seen.has(object.id));
  return [...ordered, ...rest];
}

/**
 * Every reference in the snapshot: frame-level ones first, then the references
 * held inside heap objects, in display order.
 */
export function referenceEdges(snapshot: Snapshot): ReferenceEdge[] {
  const canonical = canonicalPaths(snapshot);
  const edges: ReferenceEdge[] = [];

  for (const root of rootEdges(snapshot)) {
    edges.push({
      targetId: root.target,
      label: root.label,
      addressable: root.name !== RETURN_SLOT,
      key: root.label,
      source: { kind: 'frame', frameId: root.frame.id, name: root.name },
      isTopLevel: true
    });
  }

  for (const object of allObjects(snapshot)) {
    const from = canonical.get(object.id);
    if (!from) continue;
    for (const edge of outgoing(object)) {
      const path = extend(from, edge.segment);
      edges.push({
        targetId: edge.target,
        label: path.text,
        addressable: path.addressable,
        // The slot keeps two references from the same container distinct even
        // when they render identically, as two set members would.
        key: `${from.text}|${edge.slot}`,
        source: { kind: 'heap', objectId: object.id, slot: edge.slot },
        isTopLevel: false
      });
    }
  }

  return edges;
}

/** References grouped by what they point at, preserving edge order. */
export function edgesByTarget(snapshot: Snapshot): Map<number, ReferenceEdge[]> {
  const grouped = new Map<number, ReferenceEdge[]>();
  for (const edge of referenceEdges(snapshot)) {
    const list = grouped.get(edge.targetId) ?? [];
    list.push(edge);
    grouped.set(edge.targetId, list);
  }
  return grouped;
}

/**
 * Shorten a long label, keeping the tail.
 *
 * The end of a path is the specific part (`…['address']['city']`), and an
 * untruncated deep path is how a horizontal scrollbar gets back into a narrow
 * column. The full text belongs in a `title` attribute.
 */
export function truncateLabel(label: string, max: number): { text: string; truncated: boolean } {
  if (label.length <= max) return { text: label, truncated: false };
  return { text: `…${label.slice(label.length - max)}`, truncated: true };
}
