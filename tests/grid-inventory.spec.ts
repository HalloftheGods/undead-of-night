import { describe, expect, it } from 'vitest';
import {
  autoPackItem,
  canPlaceItem,
  createInventoryGrid,
  findAvailableSlot,
  findItemAtTile,
  getItemFootprint,
  isCellBlocked,
  isWithinGridBounds,
  placeItem,
  randomPackItem,
  removeItem,
  rotateItem,
  transferItem,
  type GridItem,
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
    expect(normalBottle).toEqual({ width: 1, height: 1 });

    const normalKnife = getItemFootprint('knife', false);
    expect(normalKnife).toEqual({ width: 1, height: 2 });

    const rotatedKnife = getItemFootprint('knife', true);
    expect(rotatedKnife).toEqual({ width: 2, height: 1 });

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
      id: 'knife-1',
      type: 'knife',
      x: 0,
      y: 0,
      rotated: false,
    });

    // 1x2 at (0,0) rotates to 2x1 at (0,0)
    const rotated = rotateItem(grid, 'knife-1');
    expect(rotated).toBe(true);
    expect(grid.items[0].rotated).toBe(true);

    // Place obstacle at (0, 1)
    placeItem(grid, {
      id: 'blocker',
      type: 'ammo_box',
      x: 0,
      y: 1,
      rotated: false,
    });

    // Rotating back to vertical 1x2 would hit (0,1) which is occupied
    const rotatedBackBlocked = rotateItem(grid, 'knife-1');
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

    // Knife is 1x2, should fit at (0, 1) if rotated (2x1)
    const knifePacked = autoPackItem(grid, {
      id: 'knife-1',
      type: 'knife',
      rotated: false,
    });
    expect(knifePacked).toBe(true);
    expect(grid.items[2]).toMatchObject({ x: 0, y: 1, rotated: true });

    // Grid full now
    const overflowPacked = autoPackItem(grid, {
      id: 'ammo-3',
      type: 'ammo_box',
      rotated: false,
    });
    expect(overflowPacked).toBe(false);
  });

  it('rejects placing or auto-packing invalid items without a type', () => {
    const grid = createInventoryGrid(2, 2);
    expect(canPlaceItem(grid, '', 0, 0, false)).toBe(false);
    expect(placeItem(grid, { id: 'bad-1', type: '', x: 0, y: 0, rotated: false })).toBe(false);
    expect(placeItem(grid, null as unknown as GridItem)).toBe(false);
    expect(autoPackItem(grid, { id: 'bad-2', type: '', rotated: false })).toBe(false);
    expect(autoPackItem(grid, null as unknown as GridItem)).toBe(false);
  });

  it('randomPackItem places items in available random slots', () => {
    const grid = createInventoryGrid(6, 6);
    const rng = () => 0.5;
    const placed = randomPackItem(grid, { id: 'random-1', type: 'bandage', rotated: false }, rng);
    expect(placed).toBe(true);
    expect(grid.items.length).toBe(1);

    const isWithinBounds = grid.items[0].x >= 0 && grid.items[0].x < 6 && grid.items[0].y >= 0 && grid.items[0].y < 6;
    expect(isWithinBounds).toBe(true);

    // Full grid rejection
    const fullGrid = createInventoryGrid(1, 1);
    expect(randomPackItem(fullGrid, { id: 'medkit-1', type: 'medkit', rotated: false })).toBe(false);
  });

  it('detects blocked cells and prevents item placement on blocked cells', () => {
    const blocked = [{ x: 1, y: 1 }, { x: 2, y: 1 }];
    const grid = createInventoryGrid(4, 4, blocked);

    expect(isCellBlocked(grid, 1, 1)).toBe(true);
    expect(isCellBlocked(grid, 2, 1)).toBe(true);
    expect(isCellBlocked(grid, 0, 0)).toBe(false);

    // 1x1 item at blocked tile fails
    expect(canPlaceItem(grid, 'bandage', 1, 1, false)).toBe(false);
    expect(canPlaceItem(grid, 'bandage', 2, 1, false)).toBe(false);
    expect(canPlaceItem(grid, 'bandage', 0, 0, false)).toBe(true);

    // 2x1 item spanning over (1, 1) fails
    expect(canPlaceItem(grid, 'full_size_bar', 0, 1, false)).toBe(false);
    // 2x1 item on clear row succeeds
    expect(canPlaceItem(grid, 'full_size_bar', 0, 0, false)).toBe(true);
  });

  it('autoPackItem and randomPackItem respect blocked cells', () => {
    const blocked = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
    const grid = createInventoryGrid(2, 2, blocked);

    const packed = autoPackItem(grid, { id: 'item-1', type: 'bandage', rotated: false });
    expect(packed).toBe(true);
    expect(grid.items[0].x).toBe(1);
    expect(grid.items[0].y).toBe(1);

    const packedSecond = autoPackItem(grid, { id: 'item-2', type: 'bandage', rotated: false });
    expect(packedSecond).toBe(false);

    const grid2 = createInventoryGrid(2, 2, blocked);
    const rng = () => 0.1;
    const randomPlaced = randomPackItem(grid2, { id: 'rand-1', type: 'bandage', rotated: false }, rng);
    expect(randomPlaced).toBe(true);
    expect(grid2.items[0].x).toBe(1);
    expect(grid2.items[0].y).toBe(1);
  });
});
