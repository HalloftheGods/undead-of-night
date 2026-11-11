import { describe, expect, it } from 'vitest';
import {
  autoPackItem,
  canPlaceItem,
  createInventoryGrid,
  findAvailableSlot,
  findItemAtTile,
  getItemFootprint,
  isWithinGridBounds,
  placeItem,
  removeItem,
  rotateItem,
  transferItem,
} from '../shared/grid-inventory.ts';

describe('Spatial Grid Inventory Engine', () => {
  it('creates an empty grid with bounds', () => {
    const grid = createInventoryGrid(5, 4);
    expect(grid.cols).toBe(5);
    expect(grid.rows).toBe(4);
    expect(grid.items).toHaveLength(0);
  });

  it('correctly calculates item footprints and rotation swaps', () => {
    const normalBottle = getItemFootprint('bottle', false);
    expect(normalBottle).toEqual({ width: 1, height: 2 });

    const rotatedBottle = getItemFootprint('bottle', true);
    expect(rotatedBottle).toEqual({ width: 2, height: 1 });

    const normalShotgun = getItemFootprint('shotgun', false);
    expect(normalShotgun).toEqual({ width: 4, height: 1 });

    const rotatedShotgun = getItemFootprint('shotgun', true);
    expect(rotatedShotgun).toEqual({ width: 1, height: 4 });
  });

  it('validates boundaries properly', () => {
    const grid = createInventoryGrid(5, 4);

    expect(isWithinGridBounds(grid, 0, 0, 1, 1)).toBe(true);
    expect(isWithinGridBounds(grid, 4, 3, 1, 1)).toBe(true);
    expect(isWithinGridBounds(grid, 5, 0, 1, 1)).toBe(false);
    expect(isWithinGridBounds(grid, 0, 4, 1, 1)).toBe(false);
    expect(isWithinGridBounds(grid, 4, 0, 2, 1)).toBe(false);
    expect(isWithinGridBounds(grid, 0, 3, 1, 2)).toBe(false);
  });

  it('detects collisions between items', () => {
    const grid = createInventoryGrid(5, 4);

    const medkitPlaced = placeItem(grid, {
      id: 'medkit-1',
      type: 'medkit',
      x: 1,
      y: 1,
      rotated: false,
    });
    expect(medkitPlaced).toBe(true);

    // Overlapping tile at (1, 1)
    const canOverlapDirect = canPlaceItem(grid, 'ammo_box', 1, 1, false);
    expect(canOverlapDirect).toBe(false);

    // Overlapping tile at (2, 2)
    const canOverlapCorner = canPlaceItem(grid, 'ammo_box', 2, 2, false);
    expect(canOverlapCorner).toBe(false);

    // Free tile at (0, 0)
    const canPlaceFree = canPlaceItem(grid, 'ammo_box', 0, 0, false);
    expect(canPlaceFree).toBe(true);

    // Placing overlapping item fails
    const ammoPlaced = placeItem(grid, {
      id: 'ammo-1',
      type: 'ammo_box',
      x: 2,
      y: 2,
      rotated: false,
    });
    expect(ammoPlaced).toBe(false);
  });

  it('allows item to occupy its own spot when excluding self ID', () => {
    const grid = createInventoryGrid(5, 4);

    placeItem(grid, {
      id: 'bottle-1',
      type: 'bottle',
      x: 0,
      y: 0,
      rotated: false,
    });

    const canSelfOccupy = canPlaceItem(grid, 'bottle', 0, 0, false, 'bottle-1');
    expect(canSelfOccupy).toBe(true);
  });

  it('handles item rotation within space and rejects when blocked', () => {
    const grid = createInventoryGrid(5, 4);

    placeItem(grid, {
      id: 'bottle-1',
      type: 'bottle',
      x: 0,
      y: 0,
      rotated: false,
    });

    // 1x2 at (0,0) rotates to 2x1 at (0,0)
    const rotated = rotateItem(grid, 'bottle-1');
    expect(rotated).toBe(true);
    expect(grid.items[0].rotated).toBe(true);

    // Place obstacle at (1, 1)
    placeItem(grid, {
      id: 'blocker',
      type: 'ammo_box',
      x: 0,
      y: 1,
      rotated: false,
    });

    // Rotating back to vertical 1x2 would hit (0,1) which is occupied
    const rotatedBackBlocked = rotateItem(grid, 'bottle-1');
    expect(rotatedBackBlocked).toBe(false);
    expect(grid.items[0].rotated).toBe(true);
  });

  it('finds items at specific grid tiles', () => {
    const grid = createInventoryGrid(5, 4);

    placeItem(grid, {
      id: 'medkit-1',
      type: 'medkit',
      x: 1,
      y: 1,
      rotated: false,
    });

    expect(findItemAtTile(grid, 0, 0)).toBeNull();
    expect(findItemAtTile(grid, 1, 1)?.id).toBe('medkit-1');
    expect(findItemAtTile(grid, 2, 2)?.id).toBe('medkit-1');
    expect(findItemAtTile(grid, 3, 3)).toBeNull();
  });

  it('removes items cleanly', () => {
    const grid = createInventoryGrid(5, 4);

    placeItem(grid, {
      id: 'nails-1',
      type: 'nails',
      x: 3,
      y: 3,
      rotated: false,
    });

    expect(grid.items).toHaveLength(1);
    const removed = removeItem(grid, 'nails-1');
    expect(removed?.id).toBe('nails-1');
    expect(grid.items).toHaveLength(0);
    expect(canPlaceItem(grid, 'nails', 3, 3, false)).toBe(true);
  });

  it('transfers items between two grids', () => {
    const containerGrid = createInventoryGrid(4, 4);
    const playerGrid = createInventoryGrid(5, 4);

    placeItem(containerGrid, {
      id: 'soda-1',
      type: 'soda',
      x: 0,
      y: 0,
      rotated: false,
    });

    // Transfer from container (0,0) into player grid at (2,1)
    const transferSuccess = transferItem(containerGrid, playerGrid, 'soda-1', 2, 1, true);
    expect(transferSuccess).toBe(true);

    expect(containerGrid.items).toHaveLength(0);
    expect(playerGrid.items).toHaveLength(1);
    expect(playerGrid.items[0]).toMatchObject({
      id: 'soda-1',
      type: 'soda',
      x: 2,
      y: 1,
      rotated: true,
    });
  });

  it('auto-packs items into first available slot', () => {
    const grid = createInventoryGrid(2, 2);

    const firstPacked = autoPackItem(grid, {
      id: 'ammo-1',
      type: 'ammo_box',
      rotated: false,
    });
    expect(firstPacked).toBe(true);
    expect(grid.items[0]).toMatchObject({ x: 0, y: 0 });

    const secondPacked = autoPackItem(grid, {
      id: 'ammo-2',
      type: 'ammo_box',
      rotated: false,
    });
    expect(secondPacked).toBe(true);
    expect(grid.items[1]).toMatchObject({ x: 1, y: 0 });

    // Water bottle is 1x2, should fit at (0, 1) if rotated (2x1)
    const bottlePacked = autoPackItem(grid, {
      id: 'bottle-1',
      type: 'bottle',
      rotated: false,
    });
    expect(bottlePacked).toBe(true);
    expect(grid.items[2]).toMatchObject({ x: 0, y: 1, rotated: true });

    // Grid full now
    const overflowPacked = autoPackItem(grid, {
      id: 'ammo-3',
      type: 'ammo_box',
      rotated: false,
    });
    expect(overflowPacked).toBe(false);
  });
});
