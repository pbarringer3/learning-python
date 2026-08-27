import type { Wall, DirectionType } from './types';

/**
 * Returns true if a wall blocks movement out of cell (x, y) in the given direction.
 *
 * Wall convention (see types.ts):
 * - horizontal wall at (wx, wy): below cell (wx, wy), i.e. between (wx, wy-1) and (wx, wy)
 * - vertical wall at (wx, wy): to the right of cell (wx, wy), i.e. between (wx, wy) and (wx+1, wy)
 *
 * World boundaries are not checked here — callers handle those separately.
 */
export function checkWallInDirection(
  walls: Wall[],
  x: number,
  y: number,
  dir: DirectionType
): boolean {
  for (const wall of walls) {
    if (dir === 'north' && wall.type === 'horizontal' && wall.x === x && wall.y === y + 1) {
      return true;
    }
    if (dir === 'south' && wall.type === 'horizontal' && wall.x === x && wall.y === y) {
      return true;
    }
    if (dir === 'east' && wall.type === 'vertical' && wall.x === x && wall.y === y) {
      return true;
    }
    if (dir === 'west' && wall.type === 'vertical' && wall.x === x - 1 && wall.y === y) {
      return true;
    }
  }
  return false;
}
