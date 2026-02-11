<script lang="ts">
  import type { KarelWorld as KarelWorldType, Wall, BeeperLocation, DirectionType } from '$lib/karel/types';

  interface Props {
    world: KarelWorldType;
    onupdate?: (world: KarelWorldType) => void;
    class?: string;
    editMode?: 'karel' | 'walls' | 'beepers';
    handleCellClick?: (x: number, y: number) => void;
  }

  let { world = $bindable(), onupdate, class: className = '', editMode = $bindable('karel'), handleCellClick = $bindable() }: Props = $props();

  let internalEditMode: 'karel' | 'walls' | 'beepers' = $state('karel');
  $effect(() => {
    if (editMode !== undefined) {
      internalEditMode = editMode;
    }
  });
  $effect(() => {
    if (editMode !== undefined) {
      editMode = internalEditMode;
    }
  });
  let beeperCount = $state(1);

  function updateWorld(updater: (w: KarelWorldType) => KarelWorldType) {
    world = updater(world);
    if (onupdate) {
      onupdate(world);
    }
  }

  function setDimensions(width: number, height: number) {
    updateWorld((w) => ({
      ...w,
      dimensions: { width, height }
    }));
  }

  function setKarelDirection(direction: DirectionType) {
    updateWorld((w) => ({
      ...w,
      karel: {
        ...w.karel,
        direction: { type: direction }
      }
    }));
  }

  function setKarelBeepers(beepers: number) {
    updateWorld((w) => ({
      ...w,
      karel: {
        ...w.karel,
        beepers
      }
    }));
  }

  function setKarelPosition(x: number, y: number) {
    updateWorld((w) => ({
      ...w,
      karel: {
        ...w.karel,
        position: { x, y }
      }
    }));
  }

  function handleInternalCellClick(x: number, y: number) {
    if (internalEditMode === 'karel') {
      setKarelPosition(x, y);
    }
    // TODO: Implement walls and beepers editing
  }

  // Expose the handler
  handleCellClick = handleInternalCellClick;

  function clearWorld() {
    updateWorld((w) => ({
      ...w,
      walls: [],
      beepers: []
    }));
  }

  function exportWorld() {
    const json = JSON.stringify(world, null, 2);
    navigator.clipboard.writeText(json);
    alert('World data copied to clipboard!');
  }

  function downloadWorld() {
    const json = JSON.stringify(world, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'karel-world.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importWorld() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        try {
          const imported = JSON.parse(text);
          world = imported;
          if (onupdate) {
            onupdate(world);
          }
        } catch (err) {
          alert('Invalid JSON file');
        }
      }
    };
    input.click();
  }
</script>

<div class="world-editor {className}">
  <div class="editor-section">
    <h3>Grid Dimensions</h3>
    <div class="dimension-controls">
      <label>
        Width:
        <input
          type="number"
          min="1"
          max="30"
          value={world.dimensions.width}
          oninput={(e) => setDimensions(parseInt(e.currentTarget.value), world.dimensions.height)}
        />
      </label>
      <label>
        Height:
        <input
          type="number"
          min="1"
          max="30"
          value={world.dimensions.height}
          oninput={(e) => setDimensions(world.dimensions.width, parseInt(e.currentTarget.value))}
        />
      </label>
    </div>
  </div>

  <div class="editor-section">
    <h3>Karel Configuration</h3>
    <div class="karel-config">
      <label>
        Position:
        <input type="text" readonly value="({world.karel.position.x}, {world.karel.position.y})" />
      </label>
      <label>
        Direction:
        <select
          value={world.karel.direction.type}
          onchange={(e) => setKarelDirection(e.currentTarget.value as DirectionType)}
        >
          <option value="north">North</option>
          <option value="east">East</option>
          <option value="south">South</option>
          <option value="west">West</option>
        </select>
      </label>
      <label>
        Beepers in Bag:
        <input
          type="number"
          min="-1"
          value={world.karel.beepers}
          oninput={(e) => setKarelBeepers(parseInt(e.currentTarget.value))}
          placeholder="-1 for infinite"
        />
      </label>
    </div>
  </div>

  <div class="editor-section">
    <h3>Edit Mode</h3>
    <div class="mode-buttons">
      <button
        class="mode-btn {internalEditMode === 'karel' ? 'active' : ''}"
        onclick={() => (internalEditMode = 'karel')}
      >
        Move Karel
      </button>
      <button
        class="mode-btn {internalEditMode === 'walls' ? 'active' : ''}"
        onclick={() => (internalEditMode = 'walls')}
      >
        Add/Remove Walls
      </button>
      <button
        class="mode-btn {internalEditMode === 'beepers' ? 'active' : ''}"
        onclick={() => (internalEditMode = 'beepers')}
      >
        Place Beepers
      </button>
    </div>

    <div class="mode-instruction">
      {#if internalEditMode === 'karel'}
        <p>Click on a cell in the Karel World to move Karel there</p>
      {:else if internalEditMode === 'walls'}
        <p>Click between cells to toggle walls</p>
      {:else if internalEditMode === 'beepers'}
        <p>Click on cells to add/remove beepers</p>
      {/if}
    </div>

    {#if internalEditMode === 'beepers'}
      <div class="beeper-config">
        <label>
          Beeper Count:
          <input type="number" min="1" bind:value={beeperCount} />
        </label>
      </div>
    {/if}
  </div>

  <div class="editor-section">
    <h3>Actions</h3>
    <div class="action-buttons">
      <button onclick={clearWorld} class="action-btn">Clear Walls & Beepers</button>
      <button onclick={exportWorld} class="action-btn">Copy to Clipboard</button>
      <button onclick={downloadWorld} class="action-btn">Download JSON</button>
      <button onclick={importWorld} class="action-btn">Import JSON</button>
    </div>
  </div>
</div>

<style>
  .world-editor {
    padding: 1rem;
    background: #f5f5f5;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .editor-section {
    background: white;
    padding: 1rem;
    border-radius: 4px;
    border: 1px solid #e0e0e0;
  }

  .editor-section h3 {
    margin: 0 0 0.75rem 0;
    font-size: 16px;
    color: #333;
  }

  .dimension-controls,
  .karel-config {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.75rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 14px;
    color: #666;
  }

  input,
  select {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
  }

  .mode-buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .mode-btn {
    padding: 0.5rem 1rem;
    border: 2px solid #ccc;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }

  .mode-btn:hover {
    background: #f0f0f0;
  }

  .mode-btn.active {
    border-color: #3b82f6;
    background: #dbeafe;
    color: #1e40af;
  }

  .beeper-config {
    margin-top: 0.75rem;
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .action-btn {
    padding: 0.5rem 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: #e5e5e5;
    transform: translateY(-1px);
  }

  .action-btn:active {
    transform: translateY(0);
  }

  .mode-instruction {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: #f0f9ff;
    border-left: 3px solid #3b82f6;
    border-radius: 4px;
  }

  .mode-instruction p {
    margin: 0;
    font-size: 14px;
    color: #1e40af;
  }
</style>
