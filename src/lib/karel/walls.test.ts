import { describe, it, expect } from 'vitest';
import { checkWallInDirection } from './walls';
import type { Wall } from './types';

describe('checkWallInDirection', () => {
  // Convention (types.ts): a horizontal wall at (x, y) is below cell (x, y);
  // a vertical wall at (x, y) is to the right of cell (x, y).

  describe('horizontal walls', () => {
    const wallBelow33: Wall[] = [{ type: 'horizontal', x: 3, y: 3 }];

    it('blocks moving north from the cell below the wall', () => {
      // Wall below (3,3) sits between (3,2) and (3,3)
      expect(checkWallInDirection(wallBelow33, 3, 2, 'north')).toBe(true);
    });

    it('blocks moving south from the cell above the wall', () => {
      expect(checkWallInDirection(wallBelow33, 3, 3, 'south')).toBe(true);
    });

    it('does not block moving north out of the cell the wall is below', () => {
      // Karel standing at (3,3): the wall is under its feet, not overhead
      expect(checkWallInDirection(wallBelow33, 3, 3, 'north')).toBe(false);
    });

    it('does not block moving south from the cell below the wall', () => {
      expect(checkWallInDirection(wallBelow33, 3, 2, 'south')).toBe(false);
    });

    it('does not block east/west movement', () => {
      expect(checkWallInDirection(wallBelow33, 3, 3, 'east')).toBe(false);
      expect(checkWallInDirection(wallBelow33, 3, 3, 'west')).toBe(false);
    });

    it('does not block movement in other columns', () => {
      expect(checkWallInDirection(wallBelow33, 2, 2, 'north')).toBe(false);
      expect(checkWallInDirection(wallBelow33, 4, 3, 'south')).toBe(false);
    });
  });

  describe('vertical walls', () => {
    const wallRightOf33: Wall[] = [{ type: 'vertical', x: 3, y: 3 }];

    it('blocks moving east from the cell left of the wall', () => {
      // Wall right of (3,3) sits between (3,3) and (4,3)
      expect(checkWallInDirection(wallRightOf33, 3, 3, 'east')).toBe(true);
    });

    it('blocks moving west from the cell right of the wall', () => {
      expect(checkWallInDirection(wallRightOf33, 4, 3, 'west')).toBe(true);
    });

    it('does not block moving west from the cell left of the wall', () => {
      expect(checkWallInDirection(wallRightOf33, 3, 3, 'west')).toBe(false);
    });

    it('does not block moving east from the cell right of the wall', () => {
      expect(checkWallInDirection(wallRightOf33, 4, 3, 'east')).toBe(false);
    });

    it('does not block north/south movement', () => {
      expect(checkWallInDirection(wallRightOf33, 3, 3, 'north')).toBe(false);
      expect(checkWallInDirection(wallRightOf33, 3, 3, 'south')).toBe(false);
    });

    it('does not block movement in other rows', () => {
      expect(checkWallInDirection(wallRightOf33, 3, 2, 'east')).toBe(false);
      expect(checkWallInDirection(wallRightOf33, 4, 4, 'west')).toBe(false);
    });
  });

  describe('no walls', () => {
    it('never blocks', () => {
      expect(checkWallInDirection([], 1, 1, 'north')).toBe(false);
      expect(checkWallInDirection([], 1, 1, 'east')).toBe(false);
      expect(checkWallInDirection([], 1, 1, 'south')).toBe(false);
      expect(checkWallInDirection([], 1, 1, 'west')).toBe(false);
    });
  });

  describe('stair-climbing world (lesson 1/4 regression)', () => {
    // The staircase from the Stair Climbing Karel example: each step has a
    // vertical wall as its riser and a horizontal wall as its tread.
    const stairs: Wall[] = [
      { type: 'vertical', x: 1, y: 1 },
      { type: 'vertical', x: 2, y: 2 },
      { type: 'vertical', x: 3, y: 3 },
      { type: 'vertical', x: 4, y: 4 },
      { type: 'vertical', x: 5, y: 5 },
      { type: 'horizontal', x: 2, y: 2 },
      { type: 'horizontal', x: 3, y: 3 },
      { type: 'horizontal', x: 4, y: 4 },
      { type: 'horizontal', x: 5, y: 5 },
      { type: 'horizontal', x: 6, y: 6 }
    ];

    it('blocks east from (1,1) — the first riser', () => {
      expect(checkWallInDirection(stairs, 1, 1, 'east')).toBe(true);
    });

    it('lets Karel climb: north is clear when standing on a tread', () => {
      // Karel on step (2,2): the tread under it must not block going north
      expect(checkWallInDirection(stairs, 2, 2, 'north')).toBe(false);
      expect(checkWallInDirection(stairs, 3, 3, 'north')).toBe(false);
      expect(checkWallInDirection(stairs, 4, 4, 'north')).toBe(false);
      expect(checkWallInDirection(stairs, 5, 5, 'north')).toBe(false);
    });

    it('treads stop Karel falling south off a step', () => {
      expect(checkWallInDirection(stairs, 2, 2, 'south')).toBe(true);
      expect(checkWallInDirection(stairs, 6, 6, 'south')).toBe(true);
    });

    it('risers block east until Karel has climbed above them', () => {
      expect(checkWallInDirection(stairs, 2, 2, 'east')).toBe(true);
      expect(checkWallInDirection(stairs, 2, 3, 'east')).toBe(false);
    });
  });
});
