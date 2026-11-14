import { describe, expect, it } from 'vitest';
import { flipDimensions, flipItem, isVerticalLook } from '../shared/container-flip.ts';
import { canPlaceItem, createInventoryGrid, getItemFootprint, getOccupiedTiles, ITEM_FOOTPRINTS } from '../shared/grid-inventory.ts';
import { containerGridDimensions } from '../shared/containers.ts';

describe('a car parked nose up shows its grid on end', () => {
  it('knows which props and looks stand on end', () => {
    expect(isVerticalLook('car_sedan_v')).toBe(true);
    expect(isVerticalLook('police_v')).toBe(true);
    expect(isVerticalLook('car_v')).toBe(true);
    expect(isVerticalLook('car_sedan_h')).toBe(false);
    expect(isVerticalLook('car')).toBe(false);
    expect(isVerticalLook(undefined)).toBe(false);
  });

  it('swaps columns and rows, and flips the blocked cells with them', () => {
    const car = containerGridDimensions('car');
    expect(flipDimensions(car)).toEqual({ cols: car.rows, rows: car.cols, blocked: car.blocked?.map(({ x, y }) => ({ x: y, y: x })) });
    const flipped = flipDimensions({ cols: 3, rows: 2, blocked: [{ x: 2, y: 0 }] });
    expect(flipped).toEqual({ cols: 2, rows: 3, blocked: [{ x: 0, y: 2 }] });
  });

  it('flipping twice gives every item back where it was', () => {
    const item = { id: 'a', type: 'bandage', x: 5, y: 1, rotated: false };
    expect(flipItem(flipItem(item))).toEqual(item);
    const long = { id: 'b', type: 'knife', x: 3, y: 2, rotated: true };
    expect(flipItem(flipItem(long))).toEqual(long);
  });

  it('an item covers the mirrored cells in the flipped grid, and still fits there', () => {
    const type = 'plank';
    const before = ITEM_FOOTPRINTS[type];
    ITEM_FOOTPRINTS[type] = { width: 3, height: 1 };
    try {
      const car = containerGridDimensions('car');
      const grid = createInventoryGrid(car.cols, car.rows);
      const item = { id: 'p', type, x: 2, y: 1, rotated: false };
      expect(canPlaceItem(grid, type, item.x, item.y, item.rotated)).toBe(true);
      const flippedGrid = createInventoryGrid(car.rows, car.cols);
      const flipped = flipItem(item);
      expect(getItemFootprint(flipped.type, flipped.rotated)).toEqual({ width: 1, height: 3 });
      expect(canPlaceItem(flippedGrid, type, flipped.x, flipped.y, flipped.rotated)).toBe(true);
      const mirrored = getOccupiedTiles({ ...item }).map((t) => ({ x: t.y, y: t.x }));
      expect(getOccupiedTiles(flipped)).toEqual(mirrored);
    } finally {
      if (before) ITEM_FOOTPRINTS[type] = before;
      else delete ITEM_FOOTPRINTS[type];
    }
  });
});
