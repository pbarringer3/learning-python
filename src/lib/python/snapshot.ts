/**
 * The snapshot format produced by the tracer (`tracer.py`) and consumed by the
 * call stack visualiser.
 *
 * The shape follows Python Tutor's trace format closely enough to reuse its
 * rendering ideas: frames hold *bindings*, and anything that is not a small
 * immutable value lives on a heap keyed by `id()`. Two names pointing at the
 * same list therefore produce two references to one heap entry — which is the
 * whole reason the tool is worth building.
 *
 * Every snapshot is self-contained. Ids are only meaningful within one
 * snapshot, because CPython recycles addresses after collection.
 */

/** A value small enough to render inline in a frame slot. */
export interface PrimValue {
  kind: 'prim';
  /** Python type name, e.g. `int`, `str`, `NoneType`. */
  type: string;
  /** `repr()` of the value, already capped. */
  repr: string;
  /** True when `repr` was cut short. */
  truncated?: boolean;
}

/** A pointer to an entry in the snapshot's heap. */
export interface RefValue {
  kind: 'ref';
  id: number;
}

export type Value = PrimValue | RefValue;

/** A name bound to a value, in a frame, an instance, or a closure. */
export interface Binding {
  name: string;
  value: Value;
}

/** A dict entry. Keys are values too — a tuple key is a heap reference. */
export interface DictEntry {
  key: Value;
  value: Value;
}

interface HeapObjectBase {
  id: number;
  /** Python type name, used as the box label. */
  type: string;
}

export interface SequenceHeapObject extends HeapObjectBase {
  kind: 'list' | 'tuple' | 'set';
  items: Value[];
  /** Full length before capping. */
  length: number;
  truncated?: boolean;
}

export interface DictHeapObject extends HeapObjectBase {
  kind: 'dict';
  entries: DictEntry[];
  length: number;
  truncated?: boolean;
}

export interface InstanceHeapObject extends HeapObjectBase {
  kind: 'instance';
  attrs: Binding[];
  truncated?: boolean;
}

export interface ClassHeapObject extends HeapObjectBase {
  kind: 'class';
  name: string;
  bases: string[];
  attrs: Binding[];
}

export interface FunctionHeapObject extends HeapObjectBase {
  kind: 'function';
  name: string;
  /** Parameter list, e.g. `(a, b=3)`. */
  signature: string;
  /** Captured variables, shown so closures are visible rather than magic. */
  closure?: Binding[];
}

export interface MethodHeapObject extends HeapObjectBase {
  kind: 'method';
  name: string;
  /** The instance the method is bound to. */
  self: Value;
}

export interface OpaqueHeapObject extends HeapObjectBase {
  kind: 'other';
  repr: string;
  truncated?: boolean;
}

export type HeapObject =
  | SequenceHeapObject
  | DictHeapObject
  | InstanceHeapObject
  | ClassHeapObject
  | FunctionHeapObject
  | MethodHeapObject
  | OpaqueHeapObject;

/** One stack frame. */
export interface Frame {
  /** `id()` of the Python frame object — stable while the frame is alive. */
  id: number;
  /** `<module>` for the global frame, otherwise the function name. */
  name: string;
  isGlobal: boolean;
  /** 1-based line currently executing in this frame. */
  line: number;
  locals: Binding[];
  /** Present on a `return` event, on the frame that is about to pop. */
  returnValue?: Value;
}

/** The exception in flight, on an `exception` event. */
export interface SnapshotException {
  type: string;
  message: string;
}

/** Trace events the tracer pauses on. */
export type SnapshotEvent = 'call' | 'line' | 'return' | 'exception';

/** A complete picture of the program at one trace event. */
export interface Snapshot {
  event: SnapshotEvent;
  /** 1-based line in the user's source, for editor highlighting. */
  line: number;
  /** Outermost first: `frames[0]` is the global frame. */
  frames: Frame[];
  /** Heap entries keyed by stringified `id()` — JSON object keys are strings. */
  heap: Record<string, HeapObject>;
  exception?: SnapshotException;
}

/** Narrow a value to a heap reference. */
export function isRef(value: Value): value is RefValue {
  return value.kind === 'ref';
}

/** Heap ids reachable directly from a value. */
export function valueRefs(value: Value): number[] {
  return isRef(value) ? [value.id] : [];
}

/** Heap ids reachable directly from a heap object's own slots. */
export function heapObjectRefs(object: HeapObject): number[] {
  switch (object.kind) {
    case 'list':
    case 'tuple':
    case 'set':
      return object.items.flatMap(valueRefs);
    case 'dict':
      return object.entries.flatMap((entry) => [
        ...valueRefs(entry.key),
        ...valueRefs(entry.value)
      ]);
    case 'instance':
    case 'class':
      return object.attrs.flatMap((attr) => valueRefs(attr.value));
    case 'function':
      return (object.closure ?? []).flatMap((cell) => valueRefs(cell.value));
    case 'method':
      return valueRefs(object.self);
    case 'other':
      return [];
  }
}

/** Heap ids reachable directly from a frame. */
function frameRefs(frame: Frame): number[] {
  const refs = frame.locals.flatMap((binding) => valueRefs(binding.value));
  if (frame.returnValue) refs.push(...valueRefs(frame.returnValue));
  return refs;
}

/**
 * Heap objects in the order they should be drawn: breadth-first from the
 * frames, so an object appears near the name that introduced it and rows stay
 * put as the program runs. Unknown ids and cycles are both handled by the
 * `seen` set, so `a.append(a)` terminates.
 */
export function orderedHeap(snapshot: Snapshot): HeapObject[] {
  const seen = new Set<number>();
  const ordered: HeapObject[] = [];
  const queue: number[] = snapshot.frames.flatMap(frameRefs);

  while (queue.length > 0) {
    const id = queue.shift() as number;
    if (seen.has(id)) continue;
    seen.add(id);
    const object = snapshot.heap[String(id)];
    if (!object) continue;
    ordered.push(object);
    queue.push(...heapObjectRefs(object));
  }

  return ordered;
}

/** The innermost frame — the one whose line is currently executing. */
export function activeFrame(snapshot: Snapshot): Frame | undefined {
  return snapshot.frames[snapshot.frames.length - 1];
}

/** The global frame, if the stack has one. */
export function globalFrame(snapshot: Snapshot): Frame | undefined {
  return snapshot.frames[0];
}

/** Parse the JSON payload the tracer sends over `postMessage`. */
export function parseSnapshot(json: string): Snapshot {
  return JSON.parse(json) as Snapshot;
}
