<script lang="ts">
  /**
   * Renders one execution snapshot: the call stack on the left, the heap on the
   * right, and the references between them.
   *
   * References are shown two ways, because an arrow answers two different
   * questions badly at once. The *backward* question — "who points at this
   * list?" — is answered in text, by labelling each object with the Python
   * expressions that reach it (`← a, b`, `← rows[0]`). The *forward* question
   * is answered by an arrow, but only for references held directly by a frame;
   * nested ones appear on hover or when pinned. Drawing every reference produces
   * an unreadable fan of curves in which the two arrows that carry the lesson
   * look exactly like the forty that carry nothing.
   *
   * See `PythonInterpreterDesign.md` §11.
   *
   * Connectors are SVG paths computed from real element rects after render,
   * rather than a graph-layout library. The layout is two fixed columns, not an
   * arbitrary graph — measuring what the browser already laid out is both
   * simpler and always in sync with the text it connects.
   */
  import {
    orderedHeap,
    type Frame,
    type HeapObject,
    type Snapshot,
    type Value
  } from '$lib/python/snapshot';
  import {
    referenceEdges,
    truncateLabel,
    type ReferenceEdge,
    type ReferenceSource
  } from '$lib/python/paths';

  interface Props {
    snapshot: Snapshot | null;
    /** Shown when there is no snapshot yet. */
    placeholder?: string;
    /**
     * Says what happened when the program ended, above a snapshot that is now
     * a final state rather than a live one. Wiping the panel instead would be
     * honest about the frames being gone, but blanks it at exactly the moment a
     * student wants to check how their variables ended up
     * (`PythonInterpreterDesign.md` §12.5).
     */
    banner?: string | null;
    /** `error` tints the banner red; anything else is neutral. */
    bannerTone?: 'neutral' | 'error';
    class?: string;
  }

  let {
    snapshot = null,
    placeholder = 'Press Step to start walking through your program.',
    banner = null,
    bannerTone = 'neutral',
    class: className = ''
  }: Props = $props();

  /** Referrers shown before the list is collapsed behind a "+N more" control. */
  const REFERRER_CAP = 3;
  /** Characters of a path label shown before it is truncated to its tail. */
  const LABEL_MAX = 28;

  let content: HTMLDivElement | undefined = $state();
  let arrows = $state<{ d: string; key: string; hot: boolean }[]>([]);

  /** Edge keys the user has explicitly pinned on, and explicitly hidden. */
  let pinned = $state(new Set<string>());
  let hidden = $state(new Set<string>());
  /** Edge keys lit by the current hover or focus. Transient. */
  let hovered = $state<string[]>([]);
  /** Objects whose referrer list is expanded past the cap. Collapses on step. */
  let expanded = $state(new Set<number>());

  let frames = $derived(snapshot?.frames ?? []);
  let heap = $derived(snapshot ? orderedHeap(snapshot) : []);
  let edges = $derived(snapshot ? referenceEdges(snapshot) : []);

  /** Where a reference is rendered, so a render site can find its edge. */
  function sourceId(source: ReferenceSource): string {
    return source.kind === 'frame'
      ? `f:${source.frameId}:${source.name}`
      : `h:${source.objectId}:${source.slot}`;
  }

  let edgeBySource = $derived.by(() => {
    const map = new Map<string, ReferenceEdge>();
    for (const edge of edges) map.set(sourceId(edge.source), edge);
    return map;
  });

  /** Every reference pointing at an object, in display order. */
  let inbound = $derived.by(() => {
    const map = new Map<number, ReferenceEdge[]>();
    for (const edge of edges) {
      const list = map.get(edge.targetId) ?? [];
      list.push(edge);
      map.set(edge.targetId, list);
    }
    return map;
  });

  let visibleKeys = $derived.by(() => {
    const keys = new Set<string>();
    // Frame-level references are on by default; nested ones are not.
    for (const edge of edges) {
      if (edge.isTopLevel && !hidden.has(edge.key)) keys.add(edge.key);
    }
    for (const key of pinned) if (!hidden.has(key)) keys.add(key);
    for (const key of hovered) keys.add(key);
    return keys;
  });

  // Toggles are keyed by path, so they survive a step; anything whose location
  // no longer exists is dropped rather than left dangling. Expansion is view
  // state, not a preference, so it collapses.
  let lastSnapshot: Snapshot | null = null;
  $effect(() => {
    if (snapshot === lastSnapshot) return;
    lastSnapshot = snapshot;
    const live = new Set(edges.map((edge) => edge.key));
    pinned = new Set([...pinned].filter((key) => live.has(key)));
    hidden = new Set([...hidden].filter((key) => live.has(key)));
    expanded = new Set();
    hovered = [];
  });

  function edgeAt(source: string): ReferenceEdge | undefined {
    return edgeBySource.get(source);
  }

  function isOn(edge: ReferenceEdge): boolean {
    return (edge.isTopLevel && !hidden.has(edge.key)) || pinned.has(edge.key);
  }

  function setToggle(keys: string[], on: boolean): void {
    const nextPinned = new Set(pinned);
    const nextHidden = new Set(hidden);
    for (const key of keys) {
      if (on) {
        nextHidden.delete(key);
        nextPinned.add(key);
      } else {
        nextPinned.delete(key);
        nextHidden.add(key);
      }
    }
    pinned = nextPinned;
    hidden = nextHidden;
  }

  function toggleEdge(edge: ReferenceEdge): void {
    setToggle([edge.key], !isOn(edge));
  }

  /** Clicking an object toggles every arrow into it as one group. */
  function toggleObject(id: number): void {
    const group = inbound.get(id) ?? [];
    if (group.length === 0) return;
    const allOn = group.every(isOn);
    setToggle(
      group.map((edge) => edge.key),
      !allOn
    );
  }

  function hoverKeys(keys: string[]): void {
    hovered = keys;
  }

  function clearHover(): void {
    hovered = [];
  }

  /** Enter and Space activate a reference the same way a click does. */
  function onKey(event: KeyboardEvent, run: () => void): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      run();
    }
  }

  /** Label for a heap box's header row. */
  function heapLabel(object: HeapObject): string {
    switch (object.kind) {
      case 'class':
        return object.bases.length > 0
          ? `class ${object.name}(${object.bases.join(', ')})`
          : `class ${object.name}`;
      case 'function':
        return `function ${object.name}${object.signature}`;
      case 'method':
        return `method ${object.name}`;
      default:
        return object.type;
    }
  }

  /** Note appended to a box header when the contents were capped. */
  function capNote(object: HeapObject): string {
    if (!('truncated' in object) || !object.truncated) return '';
    if ('length' in object && typeof object.length === 'number') {
      return ` — showing the first items of ${object.length}`;
    }
    return ' — truncated';
  }

  function frameTitle(frame: Frame): string {
    return frame.isGlobal ? 'Global frame' : frame.name;
  }

  /**
   * Recompute every visible connector from the DOM.
   *
   * Rects are viewport-relative, so subtracting the container's own rect gives
   * coordinates inside the (possibly scrolled) content box without having to
   * track scroll offsets separately.
   */
  function measure(): void {
    if (!content) return;

    const origin = content.getBoundingClientRect();
    const paths: { d: string; key: string; hot: boolean }[] = [];

    const targets = new Map<string, DOMRect>();
    for (const element of content.querySelectorAll<HTMLElement>('[data-heap-id]')) {
      targets.set(element.dataset.heapId as string, element.getBoundingClientRect());
    }

    for (const source of content.querySelectorAll<HTMLElement>('[data-ref-target]')) {
      const key = source.dataset.edgeKey as string;
      if (!visibleKeys.has(key)) continue;
      const target = targets.get(source.dataset.refTarget as string);
      if (!target) continue;

      const sourceRect = source.getBoundingClientRect();
      const x1 = sourceRect.right - origin.left;
      const y1 = sourceRect.top + sourceRect.height / 2 - origin.top;
      const x2 = target.left - origin.left - 4;
      const y2 = target.top + Math.min(target.height / 2, 14) - origin.top;

      // Bow the curve out by roughly the horizontal gap, so parallel arrows to
      // nearby boxes stay distinguishable instead of overlapping.
      const bow = Math.max(24, Math.abs(x2 - x1) * 0.4);
      paths.push({
        d: `M ${x1} ${y1} C ${x1 + bow} ${y1}, ${x2 - bow} ${y2}, ${x2} ${y2}`,
        key,
        hot: hovered.includes(key)
      });
    }

    arrows = paths;
  }

  // Measure after the browser has laid out the new snapshot, not during the
  // update that produced it.
  $effect(() => {
    void snapshot;
    void visibleKeys;
    void expanded;
    const handle = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(handle);
  });

  $effect(() => {
    if (!content || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(content);
    return () => observer.disconnect();
  });
</script>

{#snippet valueView(value: Value, source: string)}
  {#if value.kind === 'prim'}
    <span class="value prim" class:truncated={value.truncated}>{value.repr}</span>
  {:else}
    {@const edge = edgeAt(source)}
    {#if edge}
      <button
        type="button"
        class="ref-button"
        class:on={isOn(edge)}
        aria-label="Reference {edge.label}"
        aria-pressed={isOn(edge)}
        title={edge.label}
        onmouseenter={() => hoverKeys([edge.key])}
        onmouseleave={clearHover}
        onfocus={() => hoverKeys([edge.key])}
        onblur={clearHover}
        onclick={() => toggleEdge(edge)}
      >
        <span class="ref" data-ref-target={value.id} data-edge-key={edge.key}></span>
      </button>
    {:else}
      <span class="value ref" data-ref-target={value.id}></span>
    {/if}
  {/if}
{/snippet}

{#snippet bindingRows(entries: { name: string; value: Value }[], prefix: string)}
  {#each entries as entry (entry.name)}
    <div class="row">
      <span class="name">{entry.name}</span>
      {@render valueView(entry.value, prefix + entry.name)}
    </div>
  {/each}
{/snippet}

{#snippet referrers(object: HeapObject)}
  {@const all = inbound.get(object.id) ?? []}
  {#if all.length > 0}
    {@const isExpanded = expanded.has(object.id)}
    {@const overflowing = all.length > REFERRER_CAP && !isExpanded}
    {@const shown = overflowing ? all.slice(0, REFERRER_CAP - 1) : all}
    <div class="referrers">
      <span class="referrers-arrow" aria-hidden="true">←</span>
      {#each shown as edge (edge.key)}
        {@const short = truncateLabel(edge.label, LABEL_MAX)}
        <button
          type="button"
          class="referrer"
          class:prose={!edge.addressable}
          class:active={hovered.includes(edge.key)}
          class:on={isOn(edge)}
          title={short.truncated ? edge.label : undefined}
          onmouseenter={() => hoverKeys([edge.key])}
          onmouseleave={clearHover}
          onfocus={() => hoverKeys([edge.key])}
          onblur={clearHover}
          onclick={() => toggleEdge(edge)}
        >
          {short.text}
        </button>
      {/each}
      {#if overflowing}
        <button
          type="button"
          class="more"
          onclick={() => (expanded = new Set([...expanded, object.id]))}
        >
          +{all.length - (REFERRER_CAP - 1)} more
        </button>
      {:else if isExpanded}
        <button
          type="button"
          class="more"
          onclick={() => (expanded = new Set([...expanded].filter((id) => id !== object.id)))}
        >
          show less
        </button>
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet heapBody(object: HeapObject)}
  {#if object.kind === 'list' || object.kind === 'tuple'}
    {#if object.items.length === 0}
      <div class="row empty">empty</div>
    {:else}
      <div class="cells">
        {#each object.items as item, index (index)}
          <div class="cell">
            <span class="index">{index}</span>
            {@render valueView(item, `h:${object.id}:item:${index}`)}
          </div>
        {/each}
      </div>
    {/if}
  {:else if object.kind === 'set'}
    {#if object.items.length === 0}
      <div class="row empty">empty</div>
    {:else}
      <div class="cells">
        {#each object.items as item, index (index)}
          <div class="cell">{@render valueView(item, `h:${object.id}:item:${index}`)}</div>
        {/each}
      </div>
    {/if}
  {:else if object.kind === 'dict'}
    {#if object.entries.length === 0}
      <div class="row empty">empty</div>
    {:else}
      {#each object.entries as entry, index (index)}
        <div class="row">
          <span class="name key">{entry.key.kind === 'prim' ? entry.key.repr : ''}</span>
          {#if entry.key.kind === 'ref'}
            {@render valueView(entry.key, `h:${object.id}:key:${index}`)}
          {/if}
          {@render valueView(entry.value, `h:${object.id}:value:${index}`)}
        </div>
      {/each}
    {/if}
  {:else if object.kind === 'instance' || object.kind === 'class'}
    {#if object.attrs.length === 0}
      <div class="row empty">no attributes</div>
    {:else}
      {@render bindingRows(object.attrs, `h:${object.id}:attr:`)}
    {/if}
  {:else if object.kind === 'function'}
    {#if object.closure && object.closure.length > 0}
      <div class="row caption">captured</div>
      {@render bindingRows(object.closure, `h:${object.id}:closure:`)}
    {:else}
      <div class="row empty">no captured variables</div>
    {/if}
  {:else if object.kind === 'method'}
    <div class="row">
      <span class="name">self</span>
      {@render valueView(object.self, `h:${object.id}:self`)}
    </div>
  {:else if object.kind === 'other'}
    <div class="row opaque">{object.repr}</div>
  {/if}
{/snippet}

<div class="visualizer {className}">
  {#if banner}
    <div class="banner" class:error={bannerTone === 'error'} role="status">{banner}</div>
  {/if}
  {#if !snapshot}
    <p class="placeholder">{placeholder}</p>
  {:else}
    <div class="scroller">
      <div class="content" bind:this={content}>
        <!--
          The arrow layer is pinned to the content box and clipped. It used to
          be a bare <svg> sized from `content.scrollHeight`, which is circular —
          an absolutely positioned child contributes to its container's
          scrollable overflow, so the overlay inflated the very measurement it
          was derived from and the panel grew scrollbars over empty space.
        -->
        <div class="arrow-layer">
          <svg class="arrows" aria-hidden="true">
            <defs>
              <marker
                id="cs-arrowhead"
                markerWidth="7"
                markerHeight="7"
                refX="6"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 7 3.5, 0 7" fill="#3b82f6" />
              </marker>
            </defs>
            {#each arrows as arrow (arrow.key)}
              <path class:hot={arrow.hot} d={arrow.d} marker-end="url(#cs-arrowhead)" />
            {/each}
          </svg>
        </div>

        <div class="columns">
          <section class="column">
            <h4 class="column-title">Call stack</h4>
            {#each frames as frame, index (frame.id)}
              <div class="frame" class:active={index === frames.length - 1}>
                <div class="frame-title">
                  {frameTitle(frame)}
                  <span class="frame-line">line {frame.line}</span>
                </div>
                {#if frame.locals.length === 0 && !frame.returnValue}
                  <div class="row empty">no variables yet</div>
                {:else}
                  {@render bindingRows(frame.locals, `f:${frame.id}:`)}
                {/if}
                {#if frame.returnValue}
                  <div class="row return">
                    <span class="name">return</span>
                    {@render valueView(frame.returnValue, `f:${frame.id}:(return value)`)}
                  </div>
                {/if}
              </div>
            {/each}
          </section>

          <section class="column">
            <h4 class="column-title">Objects</h4>
            {#if heap.length === 0}
              <p class="empty-column">
                Nothing on the heap yet — every value so far is a simple one that lives directly in
                a frame.
              </p>
            {:else}
              {#each heap as object (object.id)}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="heap-object"
                  data-heap-id={object.id}
                  onmouseenter={() => hoverKeys((inbound.get(object.id) ?? []).map((e) => e.key))}
                  onmouseleave={clearHover}
                >
                  <div class="heap-title">
                    <button
                      type="button"
                      class="heap-toggle"
                      onclick={() => toggleObject(object.id)}
                      onkeydown={(event) => onKey(event, () => toggleObject(object.id))}
                      aria-label="Show references to this {object.type}"
                    >
                      {heapLabel(object)}
                    </button>
                    <span class="cap">{capNote(object)}</span>
                  </div>
                  {@render referrers(object)}
                  {@render heapBody(object)}
                </div>
              {/each}
            {/if}
          </section>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /*
   * Grows to fill the column beside the editor, so the panel is at least as
   * tall as the code it is explaining and only scrolls when the program really
   * has more state than fits.
   */
  .visualizer {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 20rem;
    background: #f5f5f5;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    padding: 0.75rem;
    font-size: 13px;
  }

  .banner {
    margin-bottom: 0.5rem;
    padding: 0.35rem 0.6rem;
    border-radius: 4px;
    background: #e5e7eb;
    color: #374151;
    font-size: 12px;
    font-weight: 600;
  }

  .banner.error {
    background: #fee2e2;
    color: #991b1b;
  }

  .placeholder,
  .empty-column {
    margin: 0;
    padding: 0.5rem;
    color: #6b7280;
  }

  .placeholder {
    flex: 1;
  }

  .scroller {
    flex: 1;
    /* Without this a flex item refuses to shrink below its content, and the
       scroller never actually scrolls. */
    min-height: 0;
    overflow: auto;
  }

  .content {
    position: relative;
    /* Tall enough to hold the arrow layer open, but never taller than the
       scroller, so short programs show no scrollbar at all. */
    min-height: 100%;
  }

  /* Pinned to the content box and clipped, so the overlay can never contribute
     to the scroll area it is drawn over. */
  .arrow-layer {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .arrows {
    width: 100%;
    height: 100%;
  }

  .arrows path {
    fill: none;
    stroke: #3b82f6;
    stroke-width: 1.5;
    opacity: 0.55;
  }

  .arrows path.hot {
    opacity: 1;
    stroke-width: 2.25;
  }

  .columns {
    display: grid;
    grid-template-columns: minmax(190px, 1fr) minmax(210px, 1.2fr);
    gap: 2.5rem;
    align-items: start;
  }

  .column {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }

  .column-title {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6b7280;
  }

  .frame,
  .heap-object {
    background: white;
    border: 1px solid #d4d4d8;
    border-radius: 6px;
    overflow: hidden;
  }

  /* The innermost frame is the one whose line is executing right now. */
  .frame.active {
    border-color: #3b82f6;
    box-shadow: 0 0 0 1px #3b82f6;
  }

  .frame-title,
  .heap-title {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.3rem 0.5rem;
    background: #eef2f7;
    border-bottom: 1px solid #e5e7eb;
    font-weight: 600;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
  }

  .heap-toggle {
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    color: inherit;
    cursor: pointer;
    text-align: left;
  }

  .frame-line {
    font-weight: 400;
    color: #6b7280;
  }

  .cap {
    font-weight: 400;
    color: #9ca3af;
  }

  /* Where an object came from, in Python the student could actually type. */
  .referrers {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: #f8fafc;
    border-bottom: 1px solid #eef2f7;
  }

  .referrers-arrow {
    color: #9ca3af;
  }

  .referrer {
    padding: 0 0.2rem;
    border: 1px solid transparent;
    border-radius: 3px;
    background: none;
    cursor: pointer;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    color: #1d4ed8;
  }

  .referrer.on {
    border-color: #bfdbfe;
    background: #eff6ff;
  }

  .referrer.active {
    border-color: #3b82f6;
    background: #dbeafe;
  }

  /* Positions Python has no expression for are described, not named — so they
     are deliberately not styled as code. */
  .referrer.prose {
    font-family: inherit;
    font-style: italic;
    color: #6b7280;
  }

  .more {
    padding: 0 0.25rem;
    border: 1px dashed #cbd5e1;
    border-radius: 3px;
    background: none;
    cursor: pointer;
    font-size: 11px;
    color: #6b7280;
  }

  .more:hover {
    background: #f1f5f9;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    border-top: 1px solid #f1f5f9;
  }

  .row:first-of-type {
    border-top: none;
  }

  .row.empty,
  .row.caption {
    color: #9ca3af;
    font-style: italic;
  }

  .row.opaque {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: #4b5563;
    word-break: break-all;
  }

  .row.return .name {
    color: #7c3aed;
  }

  .name {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: #1f2937;
    white-space: nowrap;
  }

  .name.key::after {
    content: ':';
    color: #9ca3af;
  }

  .cells {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    padding: 0.35rem 0.5rem;
  }

  .cell {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 0.1rem 0.3rem;
    background: #fafafa;
  }

  .index {
    font-size: 10px;
    color: #9ca3af;
  }

  .value {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .prim {
    color: #0f766e;
    word-break: break-all;
  }

  .prim.truncated::after {
    content: ' (truncated)';
    color: #9ca3af;
    font-size: 10px;
  }

  /* A real button so the reference is focusable and keyboard-activatable; the
     padding is the hit target, the inner dot is the arrow's anchor. */
  .ref-button {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem;
    margin: -0.25rem;
    border: none;
    background: none;
    cursor: pointer;
    line-height: 0;
  }

  .ref-button:focus-visible {
    outline: 2px solid #3b82f6;
    outline-offset: 1px;
    border-radius: 4px;
  }

  .ref {
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #93c5fd;
    flex: none;
  }

  .ref-button.on .ref,
  .ref-button:hover .ref {
    background: #3b82f6;
  }
</style>
