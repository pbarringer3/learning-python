<script lang="ts">
  import { tick } from 'svelte';
  import KarelEnvironment from '$lib/components/KarelEnvironment.svelte';
  import KarelWorld from '$lib/components/KarelWorld.svelte';
  import WorldEditor from '$lib/components/WorldEditor.svelte';
  import {
    createDefaultWorld,
    cloneWorld,
    type KarelWorld as KarelWorldType,
    type KarelConfig
  } from '$lib/karel/types';

  // State
  let mode = $state<'play' | 'edit'>('play');
  let editableWorld = $state(createDefaultWorld());
  let editorMode = $state<'karel' | 'walls' | 'addBeepers' | 'removeBeepers'>('karel');
  let editorCellClickHandler: ((x: number, y: number) => void) | undefined = $state();
  let editorWallClickHandler:
    | ((type: 'horizontal' | 'vertical', x: number, y: number) => void)
    | undefined = $state();

  // Mode toggle slider
  let playButton: HTMLButtonElement | undefined = $state();
  let editButton: HTMLButtonElement | undefined = $state();
  let toggleContainer: HTMLDivElement | undefined = $state();
  let mounted = $state(false);
  let sliderStyle = $derived.by(() => {
    void mounted; // re-evaluate after mount
    const btn = mode === 'play' ? playButton : editButton;
    if (!btn || !toggleContainer) return '';
    const containerRect = toggleContainer.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const left = btnRect.left - containerRect.left;
    const width = btnRect.width;
    return `left: ${left}px; width: ${width}px;`;
  });

  // Initial code for the playground
  const initialCode = `# Welcome to Karel the Robot Playground!
# Write your code here
# Try moving Karel around
turn_left()
turn_left()
if front_is_clear():
  move()
else:
  turn_left()
  turn_left()
`;

  // Karel config for the environment
  let karelConfig = $state<KarelConfig>({
    initialWorld: cloneWorld(editableWorld),
    initialCode: initialCode
  });

  // Update config when world changes in edit mode
  function handleWorldUpdate(newWorld: KarelWorldType) {
    editableWorld = cloneWorld(newWorld);
    // Update the config to trigger a re-render of KarelEnvironment
    karelConfig = {
      initialWorld: cloneWorld(newWorld),
      initialCode: initialCode
    };
  }

  async function handleModeChange(newMode: 'play' | 'edit') {
    mode = newMode;
    if (mode === 'play') {
      // Update config when switching back to play mode
      karelConfig = {
        initialWorld: cloneWorld(editableWorld),
        initialCode: initialCode
      };
    }
    await tick();
    mounted = true;
  }

  // Initialize mounted state
  $effect(() => {
    mounted = true;
  });
</script>

<svelte:head>
  <title>Karel Playground</title>
</svelte:head>

<div class="playground-container">
  <header class="playground-header">
    <h1>Karel the Robot - Playground</h1>
  </header>

  <!-- Mode Toggle -->
  <div class="mode-toggle-container">
    <div class="mode-toggle" bind:this={toggleContainer}>
      <button
        class="mode-button"
        class:active={mode === 'play'}
        bind:this={playButton}
        onclick={() => handleModeChange('play')}
      >
        Play
      </button>
      <button
        class="mode-button"
        class:active={mode === 'edit'}
        bind:this={editButton}
        onclick={() => handleModeChange('edit')}
      >
        Setup
      </button>
      <div class="slider" style={sliderStyle}></div>
    </div>
  </div>

  {#if mode === 'play'}
    <!-- Use KarelEnvironment component for play mode -->
    {#key karelConfig.initialWorld}
      <KarelEnvironment config={karelConfig} />
    {/key}
  {:else}
    <!-- Edit mode with world editor -->
    <div class="playground-content">
      <div class="editor-panel">
        <div class="editor-section">
          <h2>World Editor</h2>
          <WorldEditor
            bind:world={editableWorld}
            onupdate={handleWorldUpdate}
            bind:editMode={editorMode}
            bind:handleCellClick={editorCellClickHandler}
            bind:handleWallClick={editorWallClickHandler}
          />
        </div>
      </div>

      <div class="world-panel">
        <div class="world-display">
          <h2>Karel World</h2>
          <KarelWorld
            world={editableWorld}
            interactive={true}
            onCellClick={editorMode !== 'walls' ? editorCellClickHandler : undefined}
            onWallClick={editorMode === 'walls' ? editorWallClickHandler : undefined}
          />
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .playground-container {
    max-width: 1600px;
    margin: 0 auto;
    padding: 2rem;
  }

  .playground-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .playground-header h1 {
    font-size: 2.5rem;
    margin: 0;
    color: #1e293b;
  }

  .mode-toggle-container {
    display: flex;
    justify-content: center;
    margin-bottom: 2rem;
  }

  .mode-toggle {
    position: relative;
    display: inline-flex;
    background: #e2e8f0;
    border-radius: 9999px;
    padding: 4px;
  }

  .mode-button {
    position: relative;
    z-index: 1;
    padding: 0.5rem 1.5rem;
    border: none;
    background: transparent;
    color: #64748b;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    border-radius: 9999px;
    transition: color 0.3s ease;
  }

  .mode-button.active {
    color: white;
  }

  .slider {
    position: absolute;
    top: 4px;
    height: calc(100% - 8px);
    background: #3b82f6;
    border-radius: 9999px;
    transition:
      left 0.3s ease,
      width 0.3s ease;
    z-index: 0;
  }

  .playground-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  .editor-panel,
  .world-panel {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  h2 {
    font-size: 1.25rem;
    margin: 0 0 0.75rem 0;
    color: #334155;
  }

  .world-display {
    display: flex;
    flex-direction: column;
  }

  .world-display :global(.karel-world) {
    max-height: 400px;
    width: 100%;
  }

  @media (max-width: 1024px) {
    .playground-content {
      grid-template-columns: 1fr;
    }

    .world-display :global(.karel-world) {
      max-height: none;
    }
  }
</style>
