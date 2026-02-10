<script lang="ts">
  import type { KarelWorld } from '$lib/karel/types';

  interface Props {
    world: KarelWorld;
    class?: string;
  }

  let { world, class: className = '' }: Props = $props();

  // SVG dimensions
  const CELL_SIZE = 40;
  const PADDING = 20;
  const WALL_THICKNESS = 3;
  const BEEPER_RADIUS = 8;

  // Calculate SVG dimensions
  const svgWidth = $derived(world.dimensions.width * CELL_SIZE + PADDING * 2);
  const svgHeight = $derived(world.dimensions.height * CELL_SIZE + PADDING * 2);

  // Convert grid coordinates to SVG coordinates
  function gridToSvg(x: number, y: number): { x: number; y: number } {
    return {
      x: PADDING + (x - 1) * CELL_SIZE,
      y: svgHeight - PADDING - y * CELL_SIZE
    };
  }

  // Get Karel's rotation angle
  function getKarelRotation(): number {
    switch (world.karel.direction.type) {
      case 'east':
        return 0;
      case 'south':
        return 90;
      case 'west':
        return 180;
      case 'north':
        return 270;
    }
  }

  // Get Karel's position in SVG coordinates
  const karelPos = $derived(gridToSvg(world.karel.position.x, world.karel.position.y));
  const karelTransform = $derived(
    `translate(${karelPos.x + CELL_SIZE / 2}, ${karelPos.y + CELL_SIZE / 2}) rotate(${getKarelRotation()})`
  );

  // Generate grid lines
  const verticalLines = $derived(
    Array.from({ length: world.dimensions.width + 1 }, (_, i) => ({
      x: PADDING + i * CELL_SIZE,
      y1: PADDING,
      y2: PADDING + world.dimensions.height * CELL_SIZE
    }))
  );

  const horizontalLines = $derived(
    Array.from({ length: world.dimensions.height + 1 }, (_, i) => ({
      y: PADDING + i * CELL_SIZE,
      x1: PADDING,
      x2: PADDING + world.dimensions.width * CELL_SIZE
    }))
  );

  // Generate corner markers
  const corners = $derived(
    Array.from({ length: (world.dimensions.width + 1) * (world.dimensions.height + 1) }, (_, i) => {
      const col = i % (world.dimensions.width + 1);
      const row = Math.floor(i / (world.dimensions.width + 1));
      return {
        x: PADDING + col * CELL_SIZE,
        y: PADDING + row * CELL_SIZE
      };
    })
  );

  // Generate wall segments
  const wallSegments = $derived(
    world.walls.map((wall) => {
      const pos = gridToSvg(wall.x, wall.y);
      if (wall.type === 'horizontal') {
        // Wall below cell (x, y)
        return {
          x1: pos.x,
          y1: pos.y + CELL_SIZE,
          x2: pos.x + CELL_SIZE,
          y2: pos.y + CELL_SIZE
        };
      } else {
        // Wall to right of cell (x, y)
        return {
          x1: pos.x + CELL_SIZE,
          y1: pos.y,
          x2: pos.x + CELL_SIZE,
          y2: pos.y + CELL_SIZE
        };
      }
    })
  );

  // Generate beeper locations
  const beeperPositions = $derived(
    world.beepers.map((beeper) => {
      const pos = gridToSvg(beeper.x, beeper.y);
      return {
        cx: pos.x + CELL_SIZE / 2,
        cy: pos.y + CELL_SIZE / 2,
        count: beeper.count
      };
    })
  );

  // Check if Karel is on a beeper
  const karelOnBeeper = $derived(
    world.beepers.some((b) => b.x === world.karel.position.x && b.y === world.karel.position.y)
  );
</script>

<svg
  width={svgWidth}
  height={svgHeight}
  viewBox="0 0 {svgWidth} {svgHeight}"
  class="karel-world {className}"
>
  <!-- Background -->
  <rect width={svgWidth} height={svgHeight} fill="white" />

  <!-- Grid lines -->
  <g class="grid" stroke="#ddd" stroke-width="1">
    {#each verticalLines as line}
      <line x1={line.x} y1={line.y1} x2={line.x} y2={line.y2} />
    {/each}
    {#each horizontalLines as line}
      <line x1={line.x1} y1={line.y} x2={line.x2} y2={line.y} />
    {/each}
  </g>

  <!-- Corner markers -->
  <g class="corners" fill="#999">
    {#each corners as corner}
      <circle cx={corner.x} cy={corner.y} r="2" />
    {/each}
  </g>

  <!-- Walls -->
  <g class="walls" stroke="#333" stroke-width={WALL_THICKNESS} stroke-linecap="round">
    {#each wallSegments as wall}
      <line x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} />
    {/each}
  </g>

  <!-- Beepers -->
  <g class="beepers">
    {#each beeperPositions as beeper}
      <circle
        cx={beeper.cx}
        cy={beeper.cy}
        r={BEEPER_RADIUS}
        fill="#4ade80"
        stroke="#22c55e"
        stroke-width="2"
      />
      {#if beeper.count > 1}
        <text
          x={beeper.cx}
          y={beeper.cy}
          text-anchor="middle"
          dominant-baseline="middle"
          fill="white"
          font-size="12"
          font-weight="bold"
        >
          {beeper.count}
        </text>
      {/if}
    {/each}
  </g>

  <!-- Karel -->
  <g class="karel" transform={karelTransform}>
    <!-- Karel's body (triangle pointing right/east) -->
    <path d="M -12 -12 L 12 0 L -12 12 Z" fill="#3b82f6" stroke="#1e40af" stroke-width="2" />
    <!-- Transparent gap to show underlying beeper -->
    {#if karelOnBeeper}
      <circle cx="-4" cy="0" r="6" fill="white" opacity="0.7" />
    {/if}
  </g>
</svg>

<style>
  .karel-world {
    border: 1px solid #ccc;
    border-radius: 4px;
    max-width: 100%;
    height: auto;
  }
</style>
