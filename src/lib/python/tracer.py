"""Line-by-line tracer and heap serializer for the call stack visualizer.

This module is executed inside the Pyodide worker. It installs a ``sys.settrace``
hook that, at every trace event in the user's own code, serializes the whole
program state to JSON and hands it to the JavaScript host, which blocks the
worker until the UI asks for the next step.

Two design points are load-bearing (see ``PythonInterpreterDesign.md`` section 3):

* The ``co_filename`` check happens **per frame**, not once globally, so a user
  callback handed to library code (``sorted(key=user_fn)``) is still traced.
* Serialization is *eager and heap-based*: anything that is not a small
  immutable value becomes an entry keyed by ``id()``, and frames hold
  references to it. That is what lets the UI show two names pointing at one
  list, which is the whole point of the tool.
"""

import builtins
import json
import sys
import types

import _visualizer_host as host

#: Sentinel filename the user's code is compiled under, so its frames -- and
#: only its frames -- can be picked out of the stack.
USER_FILENAME = "<user_code>"

#: Caps. Serializing an unbounded structure produces a snapshot that is slow to
#: build, slow to transfer, and unreadable once rendered, so these are
#: mandatory rather than a nicety.
MAX_STRING = 240
MAX_ITEMS = 100
MAX_HEAP_ENTRIES = 400
MAX_TRACEBACK_FRAMES = 12

#: What the host wants the tracer to do at this event. Mirrors the TRACE_*
#: constants in protocol.ts.
TRACE_RUN = 0
TRACE_PAUSE = 1
TRACE_STOP = 2

#: Commands the host can return from a pause. Mirrors the CMD_* constants in
#: protocol.ts.
CMD_STOP = 4

TRACED_EVENTS = ("call", "line", "return", "exception")


class StopExecution(BaseException):
    """Raised to abandon execution when the user presses Stop.

    Derived from ``BaseException`` so that a user's ``except Exception`` does
    not swallow it and keep the program running.
    """


# ---------------------------------------------------------------------------
# Value serialization
# ---------------------------------------------------------------------------


def _safe_repr(value, limit=MAX_STRING):
    """``repr(value)``, capped, and never raising."""
    try:
        text = repr(value)
    except BaseException as exc:  # a user-defined __repr__ may do anything
        return "<unrepresentable: %s>" % type(exc).__name__, False
    if len(text) > limit:
        return text[:limit] + "…", True
    return text, False


def _primitive(value):
    """Inline form for the values small enough to render inside a frame slot."""
    if value is None:
        return {"kind": "prim", "type": "NoneType", "repr": "None"}
    kind = type(value)
    if kind is bool:
        return {"kind": "prim", "type": "bool", "repr": "True" if value else "False"}
    if kind is str:
        if len(value) > MAX_STRING:
            return {
                "kind": "prim",
                "type": "str",
                "repr": repr(value[:MAX_STRING]) + "…",
                "truncated": True,
            }
        return {"kind": "prim", "type": "str", "repr": repr(value)}
    text, truncated = _safe_repr(value)
    entry = {"kind": "prim", "type": kind.__name__, "repr": text}
    if truncated:
        entry["truncated"] = True
    return entry


def _is_primitive(value):
    return value is None or type(value) in (bool, int, float, str)


class Heap:
    """Collects every non-primitive object reachable from the current frames.

    Objects are memoized by ``id()`` **before** their contents are walked, and
    the walk itself is a work queue rather than recursion. That handles cycles
    (a list appended to itself) for free, and keeps a deeply nested structure --
    a thousand linked list nodes, say -- from exhausting the interpreter's
    stack while the user's own recursion is already partway down it.
    """

    def __init__(self):
        self.entries = {}
        self._pending = []

    def value(self, value):
        """Inline the value, or file it on the heap and return a reference."""
        if _is_primitive(value):
            return _primitive(value)
        key = str(id(value))
        if key not in self.entries:
            if len(self.entries) >= MAX_HEAP_ENTRIES:
                # Far past the point of being readable; name the type and stop.
                return {
                    "kind": "prim",
                    "type": type(value).__name__,
                    "repr": "<%s not shown>" % type(value).__name__,
                    "truncated": True,
                }
            entry = {"id": id(value), "type": type(value).__name__}
            self.entries[key] = entry
            self._pending.append((entry, value))
        return {"kind": "ref", "id": id(value)}

    def drain(self):
        """Fill every queued entry, including ones queued while filling."""
        while self._pending:
            entry, value = self._pending.pop(0)
            _fill(entry, value, self)


def _sorted_for_display(items):
    """Sets have no order; sort so the same set renders the same way twice."""
    try:
        return sorted(items)
    except BaseException:
        try:
            return sorted(items, key=repr)
        except BaseException:
            return list(items)


def _cap(entry, items):
    """Trim a collection to ``MAX_ITEMS``, recording that it was trimmed."""
    entry["length"] = len(items)
    if len(items) > MAX_ITEMS:
        entry["truncated"] = True
        return items[:MAX_ITEMS]
    return items


def _fill_sequence(entry, value, heap):
    if isinstance(value, list):
        entry["kind"] = "list"
        items = list(value)
    elif isinstance(value, tuple):
        entry["kind"] = "tuple"
        items = list(value)
    else:
        entry["kind"] = "set"
        items = _sorted_for_display(value)
    entry["items"] = [heap.value(item) for item in _cap(entry, items)]


def _fill_dict(entry, value, heap):
    entry["kind"] = "dict"
    pairs = _cap(entry, list(value.items()))
    entry["entries"] = [{"key": heap.value(k), "value": heap.value(v)} for k, v in pairs]


def _fill_class(entry, value, heap):
    entry["kind"] = "class"
    entry["name"] = value.__name__
    entry["bases"] = [base.__name__ for base in value.__bases__ if base is not object]
    attrs = []
    try:
        members = list(vars(value).items())
    except BaseException:
        members = []
    for name, member in members:
        if name.startswith("__"):
            continue
        attrs.append({"name": name, "value": heap.value(member)})
    entry["attrs"] = attrs


def _signature(func):
    try:
        import inspect

        text = str(inspect.signature(func))
    except BaseException:
        return "(...)"
    if len(text) > MAX_STRING:
        return text[:MAX_STRING] + "…)"
    return text


def _fill_function(entry, value, heap):
    entry["kind"] = "function"
    entry["name"] = value.__name__
    entry["signature"] = _signature(value)
    closure = []
    for name, cell in zip(value.__code__.co_freevars, value.__closure__ or ()):
        try:
            captured = cell.cell_contents
        except ValueError:
            continue  # cell not filled in yet (a not-yet-bound recursive name)
        closure.append({"name": name, "value": heap.value(captured)})
    if closure:
        entry["closure"] = closure


def _fill_method(entry, value, heap):
    entry["kind"] = "method"
    entry["name"] = value.__func__.__name__
    entry["self"] = heap.value(value.__self__)


def _fill_generator(entry, value):
    if value.gi_running:
        state = "running"
    elif value.gi_frame is None:
        state = "exhausted"
    else:
        state = "suspended"
    entry["kind"] = "other"
    entry["repr"] = "<generator %s: %s>" % (value.gi_code.co_name, state)


def _fill_opaque(entry, value):
    text, truncated = _safe_repr(value)
    entry["kind"] = "other"
    entry["repr"] = text
    if truncated:
        entry["truncated"] = True


def _instance_attrs(value):
    """``__dict__`` plus ``__slots__``, or ``None`` if this isn't an instance."""
    try:
        instance_dict = getattr(value, "__dict__", None)
    except BaseException:
        instance_dict = None

    found = []
    seen = set()
    if isinstance(instance_dict, dict):
        for name, member in instance_dict.items():
            seen.add(name)
            found.append((name, member))

    for klass in type(value).__mro__:
        slots = klass.__dict__.get("__slots__")
        if not slots:
            continue
        if isinstance(slots, str):
            slots = (slots,)
        for name in slots:
            if name in ("__dict__", "__weakref__") or name in seen:
                continue
            try:
                member = getattr(value, name)
            except BaseException:
                continue
            seen.add(name)
            found.append((name, member))

    if not isinstance(instance_dict, dict) and not found:
        return None
    return found


def _fill_instance(entry, attrs, heap):
    entry["kind"] = "instance"
    entry["attrs"] = [
        {"name": name, "value": heap.value(member)} for name, member in _cap(entry, attrs)
    ]
    entry.pop("length", None)


def _fill(entry, value, heap):
    """Populate a heap entry according to the type policy."""
    if isinstance(value, (list, tuple, set, frozenset)):
        _fill_sequence(entry, value, heap)
    elif isinstance(value, dict):
        _fill_dict(entry, value, heap)
    elif isinstance(value, types.ModuleType):
        _fill_opaque(entry, value)
    elif isinstance(value, type):
        _fill_class(entry, value, heap)
    elif isinstance(value, types.FunctionType):
        _fill_function(entry, value, heap)
    elif isinstance(value, types.MethodType):
        _fill_method(entry, value, heap)
    elif isinstance(value, types.GeneratorType):
        _fill_generator(entry, value)
    elif isinstance(value, (types.BuiltinFunctionType, types.BuiltinMethodType)):
        _fill_opaque(entry, value)
    else:
        attrs = _instance_attrs(value)
        if attrs is None:
            _fill_opaque(entry, value)
        else:
            _fill_instance(entry, attrs, heap)


# ---------------------------------------------------------------------------
# Frame capture
# ---------------------------------------------------------------------------


def _user_frames(frame):
    """The user's own frames, outermost first. Library frames are skipped."""
    frames = []
    current = frame
    while current is not None:
        if current.f_code.co_filename == USER_FILENAME:
            frames.append(current)
        current = current.f_back
    frames.reverse()
    return frames


def _global_names(namespace):
    """Names worth showing in the global frame.

    Dunders are interpreter bookkeeping, and an imported module is a box a
    student can learn nothing from -- both are hidden.
    """
    names = []
    for name, value in namespace.items():
        if name.startswith("__"):
            continue
        if isinstance(value, types.ModuleType):
            continue
        names.append(name)
    return names


def _local_names(frame):
    """Local names in a stable order: parameters first, then the rest in the
    order the code introduces them."""
    code = frame.f_code
    namespace = frame.f_locals
    ordered = []
    seen = set()
    for name in code.co_varnames + code.co_cellvars + code.co_freevars:
        if name in namespace and name not in seen:
            seen.add(name)
            ordered.append(name)
    for name in namespace:
        if name not in seen and not name.startswith("__"):
            seen.add(name)
            ordered.append(name)
    return ordered


def _exception_message(exc):
    try:
        return str(exc)
    except BaseException:
        return ""


def _bindings(namespace, names, heap):
    """Serialize the named members of a namespace, skipping any that vanish."""
    bindings = []
    for name in names:
        try:
            member = namespace[name]
        except KeyError:
            continue
        bindings.append({"name": name, "value": heap.value(member)})
    return bindings


def _frame_entry(user_frame, heap, line=None):
    """One stack frame, as the visualizer's ``Frame`` shape.

    Shared by live tracing and by the post-mortem snapshots, so a failure looks
    the same whether it was stepped into or run straight past. ``line`` is
    overridable because a traceback knows where a frame *was* when the
    exception passed through it, which is not where ``f_lineno`` now points.
    """
    is_global = user_frame.f_code.co_name == "<module>"
    namespace = user_frame.f_locals
    names = _global_names(namespace) if is_global else _local_names(user_frame)
    return {
        "id": id(user_frame),
        "name": "<module>" if is_global else user_frame.f_code.co_name,
        "isGlobal": is_global,
        "line": user_frame.f_lineno if line is None else line,
        "locals": _bindings(namespace, names, heap),
    }


def _capture(frame, event, arg):
    """Build the complete snapshot for one trace event."""
    heap = Heap()
    frames = [_frame_entry(user_frame, heap) for user_frame in _user_frames(frame)]

    if event == "return" and frames:
        frames[-1]["returnValue"] = heap.value(arg)

    snapshot = {
        "event": event,
        "line": frame.f_lineno,
        "frames": frames,
    }

    if event == "exception" and arg:
        exc_type = arg[0]
        snapshot["exception"] = {
            "type": getattr(exc_type, "__name__", str(exc_type)),
            "message": _exception_message(arg[1]),
        }

    heap.drain()
    snapshot["heap"] = heap.entries
    return snapshot


def _final_snapshot(user_globals):
    """The state a completed program left behind.

    Built from the globals ``exec`` filled in, which ``run_user_code`` still
    holds after it returns -- so this works with no tracer installed, and Play
    keeps its fast path (``PythonInterpreterDesign.md`` section 12.5).
    """
    heap = Heap()
    frames = [
        {
            "id": id(user_globals),
            "name": "<module>",
            "isGlobal": True,
            # Nothing is executing any more, so there is no line to highlight.
            "line": 0,
            "locals": _bindings(user_globals, _global_names(user_globals), heap),
        }
    ]
    heap.drain()
    return {"event": "final", "line": 0, "frames": frames, "heap": heap.entries}


def _error_snapshot(exc):
    """The frames as they stood when the program failed.

    Reachable after the fact from ``exc.__traceback__``, so Run and Step show
    the same view of a failure. Traceback order is outermost-first already,
    which is the order the visualizer draws.
    """
    heap = Heap()
    user_frames = []
    traceback_obj = exc.__traceback__
    while traceback_obj is not None:
        if traceback_obj.tb_frame.f_code.co_filename == USER_FILENAME:
            user_frames.append((traceback_obj.tb_frame, traceback_obj.tb_lineno))
        traceback_obj = traceback_obj.tb_next

    # A RecursionError arrives with hundreds of near-identical frames, each of
    # which would be serialized in full. Keep the global frame and the deepest
    # few; the console traceback already says how many were dropped.
    if len(user_frames) > MAX_TRACEBACK_FRAMES:
        user_frames = user_frames[:1] + user_frames[-(MAX_TRACEBACK_FRAMES - 1) :]

    frames = [_frame_entry(frame, heap, line) for frame, line in user_frames]
    heap.drain()
    return {
        "event": "final",
        "line": frames[-1]["line"] if frames else 0,
        "frames": frames,
        "heap": heap.entries,
        "exception": {"type": type(exc).__name__, "message": _exception_message(exc)},
    }


# ---------------------------------------------------------------------------
# Tracing
# ---------------------------------------------------------------------------


def _tracer(frame, event, arg):
    # Per-frame, not global: returning None here disables line events for this
    # frame only, leaving a user callback called from library code traceable.
    if frame.f_code.co_filename != USER_FILENAME:
        return None

    # The module's own 'call' event fires before line 1, with f_lineno 0 and
    # nothing bound yet. There is nothing to show, and no line to highlight, so
    # stepping starts at the first real line instead. A function's 'call' event
    # is kept: that one has the parameters bound, which is worth seeing.
    if event == "call" and frame.f_code.co_name == "<module>":
        return _tracer

    if event in TRACED_EVENTS:
        # The line and event go to the host because the breakpoint set lives in
        # shared memory on the JavaScript side -- it has to, so that a
        # breakpoint toggled while this worker is blocked still arrives. See
        # PythonInterpreterDesign.md section 12.3.
        decision = host.before_snapshot(frame.f_lineno, event)
        if decision == TRACE_STOP:
            raise StopExecution()
        if decision == TRACE_PAUSE:
            payload = json.dumps(_capture(frame, event, arg), default=str)
            if host.pause(payload) == CMD_STOP:
                raise StopExecution()

    return _tracer


# ---------------------------------------------------------------------------
# stdout / stdin
# ---------------------------------------------------------------------------


class _OutputStream:
    """Streams writes straight to the host instead of buffering them.

    Output is an append-only stream, so there is nothing to reconcile with the
    stepping position -- see ``PythonInterpreterDesign.md`` section 3.
    """

    def __init__(self, writer):
        self._writer = writer

    def write(self, text):
        text = str(text)
        if text:
            self._writer(text)
        return len(text)

    def writelines(self, lines):
        for line in lines:
            self.write(line)

    def flush(self):
        pass

    def isatty(self):
        return False

    def writable(self):
        return True

    def readable(self):
        return False

    def seekable(self):
        return False


def _input(prompt=""):
    """``input()`` that genuinely blocks the worker until the user answers."""
    text = "" if prompt is None else str(prompt)
    if text:
        sys.stdout.write(text)
    answer = host.request_input(text)
    if answer is None:  # the user pressed Stop instead of answering
        raise StopExecution()
    return answer


# ---------------------------------------------------------------------------
# Error reporting
# ---------------------------------------------------------------------------

_source_lines = []


def _source_line(lineno):
    if lineno is None or lineno < 1 or lineno > len(_source_lines):
        return None
    return _source_lines[lineno - 1].strip()


def _syntax_error(exc):
    message = exc.msg if getattr(exc, "msg", None) else _exception_message(exc)
    lines = ['  File "your code", line %s' % exc.lineno]
    text = getattr(exc, "text", None)
    if text:
        lines.append("    " + text.rstrip())
        offset = getattr(exc, "offset", None)
        if offset:
            lines.append("    " + " " * max(offset - 1, 0) + "^")
    lines.append("%s: %s" % (type(exc).__name__, message))
    return {
        "type": type(exc).__name__,
        "message": message,
        "line": exc.lineno,
        "traceback": "\n".join(lines),
    }


def _runtime_error(exc):
    """Format an uncaught exception, showing only the user's own frames."""
    entries = []
    line = None
    traceback_obj = exc.__traceback__
    while traceback_obj is not None:
        code = traceback_obj.tb_frame.f_code
        if code.co_filename == USER_FILENAME:
            line = traceback_obj.tb_lineno
            entries.append((traceback_obj.tb_lineno, code.co_name))
        traceback_obj = traceback_obj.tb_next

    # A RecursionError otherwise produces hundreds of identical rows.
    omitted = 0
    if len(entries) > MAX_TRACEBACK_FRAMES:
        omitted = len(entries) - (MAX_TRACEBACK_FRAMES - 1)
        entries = entries[:2] + [None] + entries[-(MAX_TRACEBACK_FRAMES - 3) :]

    lines = ["Traceback (most recent call last):"]
    for item in entries:
        if item is None:
            lines.append("  ... %d more call(s) omitted ..." % omitted)
            continue
        lineno, name = item
        where = "<module>" if name == "<module>" else name
        lines.append('  File "your code", line %d, in %s' % (lineno, where))
        source = _source_line(lineno)
        if source:
            lines.append("    " + source)

    message = _exception_message(exc)
    lines.append(("%s: %s" % (type(exc).__name__, message)) if message else type(exc).__name__)
    return {
        "type": type(exc).__name__,
        "message": message,
        "line": line,
        "traceback": "\n".join(lines),
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def install():
    """Redirect stdout/stderr and stdin. Called once, after Pyodide boots."""
    sys.stdout = _OutputStream(host.write_stdout)
    sys.stderr = _OutputStream(host.write_stderr)
    builtins.input = _input


def run_user_code(source, recursion_limit, tracing):
    """Run the user's source, returning a JSON status string.

    ``tracing`` selects between the stepping path (tracer installed, pauses on
    every event) and the plain run path (no tracer at all, so full speed).
    """
    global _source_lines
    _source_lines = source.splitlines()

    # The WASM stack is smaller than a native one, and blowing it hard-crashes
    # the runtime instead of raising. Keep the limit low enough that runaway
    # recursion surfaces as a normal, displayable RecursionError.
    sys.setrecursionlimit(recursion_limit)

    try:
        code = compile(source, USER_FILENAME, "exec")
    except SyntaxError as exc:
        return json.dumps({"status": "error", "error": _syntax_error(exc)})

    user_globals = {
        "__name__": "__main__",
        "__doc__": None,
        "__builtins__": builtins,
    }

    if tracing:
        sys.settrace(_tracer)
    try:
        exec(code, user_globals)
    except StopExecution:
        # Stop leaves whatever was last displayed on screen, so no snapshot.
        return json.dumps({"status": "stopped"})
    except SystemExit:
        return _done(user_globals)
    except BaseException as exc:
        # Tracing off first: serializing the frames would otherwise trace itself.
        sys.settrace(None)
        return json.dumps(
            {"status": "error", "error": _runtime_error(exc), "snapshot": _error_snapshot(exc)},
            default=str,
        )
    finally:
        sys.settrace(None)
        sys.stdout.flush()

    return _done(user_globals)


def _done(user_globals):
    sys.settrace(None)
    return json.dumps({"status": "done", "snapshot": _final_snapshot(user_globals)}, default=str)
