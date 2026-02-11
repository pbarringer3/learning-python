<script lang="ts">
  import type { KarelWorld } from '$lib/karel/types';

  interface Props {
    world: KarelWorld;
    class?: string;
    interactive?: boolean;
    onCellClick?: (x: number, y: number) => void;
  }

  let { world, class: className = '', interactive = false, onCellClick }: Props = $props();

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

  // Generate interactive cells if needed
  const interactiveCells = $derived(
    interactive
      ? Array.from({ length: world.dimensions.width * world.dimensions.height }, (_, i) => {
          const gridX = (i % world.dimensions.width) + 1;
          const gridY = Math.floor(i / world.dimensions.width) + 1;
          const pos = gridToSvg(gridX, gridY);
          return {
            x: pos.x,
            y: pos.y,
            gridX,
            gridY
          };
        })
      : []
  );

  function handleCellClick(x: number, y: number) {
    if (onCellClick) {
      onCellClick(x, y);
    }
  }
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
      <!-- Teal diamond -->
      <path
        d="M {beeper.cx} {beeper.cy - BEEPER_RADIUS * 1.2} 
           L {beeper.cx + BEEPER_RADIUS * 1.2} {beeper.cy} 
           L {beeper.cx} {beeper.cy + BEEPER_RADIUS * 1.2} 
           L {beeper.cx - BEEPER_RADIUS * 1.2} {beeper.cy} Z"
        fill="#14b8a6"
        stroke="#0d9488"
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
    <!-- Classic Stanford Karel - scaled to fit cell -->
    <g transform="scale(0.22) translate(-67.5, -80.5)">
      <g
        transform="translate(67.500000, 80.500000) scale(-1, 1) rotate(-180.000000) translate(-67.500000, -80.500000)"
      >
        <path
          d="M26,118 L26,75 L13,75 L0,75 L0,59.5 L0,44 L6.5,44 L13,44 L13,52.5 L13,61 L19.5,61 L26,61 L26,50.3 L26,39.5 L34.7,30.8 L43.5,22 L58.8,22 L74,22 L73.8,11.3 L73.5,0.5 L91.3,0.2 L109.1,0 L108.8,6.7 L108.5,13.5 L97.8,13.8 L87,14.1 L87,18 L87,22 L110.8,22.2 L134.5,22.5 L134.8,79 L135,135.5 L122.3,148.2 L109.5,161 L67.8,161 L26,161 L26,118 Z M117.3,144.2 L130,131.5 L129.8,79 L129.5,26.5 L89,26.4 L48.5,26.3 L39.3,35.3 L30,44.4 L30,100.7 L30,157 L67.3,157 L104.5,157 L117.3,144.2 Z"
          fill="#000000"
          fill-rule="nonzero"
        />
        <path
          d="M130,26 L130,131.5 L104.5,157 L30,157 L30,44.4 L48,26.3 L130,26 Z M100,70 L48,70 L48,144 L100,144 L100,70 Z"
          fill="#FFFFFF"
        />
        <path
          d="M48,107 L48,70 L74,70 L100,70 L100,107 L100,144 L74,144 L48,144 L48,107 Z M95.5,107 L95.5,74.5 L74,74.5 L52.5,74.5 L52.2,107.3 L52,140 L73.7,139.8 L95.5,139.5 L95.5,107 Z"
          fill="#000000"
          fill-rule="nonzero"
        />
        <path
          d="M74,50.5 L74,48 L91.3,48.2 C107.7,48.5 108.5,48.6 108.5,50.5 C108.5,52.4 107.7,52.5 91.3,52.8 L74,53 L74,50.5 Z"
          fill="#000000"
          fill-rule="nonzero"
        />
      </g>
    </g>
  </g>

  <!-- Interactive cells overlay -->
  {#if interactive}
    <g class="interactive-cells">
      {#each interactiveCells as cell}
        <rect
          x={cell.x}
          y={cell.y}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="transparent"
          class="cell-hotspot"
          role="button"
          tabindex="0"
          onclick={() => handleCellClick(cell.gridX, cell.gridY)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleCellClick(cell.gridX, cell.gridY);
            }
          }}
        />
      {/each}
    </g>
  {/if}
</svg>

<style>
  .karel-world {
    border: 1px solid #ccc;
    border-radius: 4px;
    max-width: 100%;
    height: auto;
  }

  .cell-hotspot {
    cursor: pointer;
    stroke: none;
  }

  .cell-hotspot:hover {
    fill: rgba(59, 130, 246, 0.1);
  }

  .cell-hotspot:focus {
    outline: none;
    fill: rgba(59, 130, 246, 0.2);
  }
</style>
