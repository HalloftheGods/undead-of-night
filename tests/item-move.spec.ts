import { describe, expect, it } from 'vitest';
import { parseItemMove } from '../shared/item-move.ts';
import type { ItemMove } from '../shared/item-move.ts';
import { applyMoveToGrids, candyMoveFor } from '../shared/item-move-grids.ts';
import type { MoveGrids } from '../shared/item-move-grids.ts';
import { createInventoryGrid } from '../shared/grid-inventory.ts';

function grids(): MoveGrids {
  return {
    pack: createInventoryGrid(4, 4),
    pockets: createInventoryGrid(2, 2),
    candy: createInventoryGrid(2, 6),
    container: createInventoryGrid(3, 3),
    gear: { primary: null, secondary: null, sidearm: null, armor: null },
  };
}

const takeMedkit: ItemMove = {
  id: 1,
  item: 'c-medkit-1',
  type: 'medkit',
  from: { kind: 'cell', grid: 'container', x: 0, y: 0 },
  to: { kind: 'cell', grid: 'pack', x: 1, y: 1, rotated: false },
  container: 3,
};

describe('parseItemMove', () => {
  it('accepts every target kind', () => {
    const targets = [
      { kind: 'cell', grid: 'pockets', x: 0, y: 1, rotated: true },
      { kind: 'gear', slot: 'primary' },
      { kind: 'ground', x: 120.5, y: -40 },
      { kind: 'use' },
      { kind: 'player', id: 'p2' },
    ];
    for (const to of targets) {
      expect(parseItemMove({ ...takeMedkit, to })).toEqual({ ...takeMedkit, to });
    }
  });

  it('accepts a gear source and a move with no container', () => {
    const move = { id: 2, item: 'pistol', type: 'pistol', from: { kind: 'gear', slot: 'sidearm' }, to: { kind: 'gear', slot: 'primary' } };
    expect(parseItemMove(move)).toEqual(move);
  });

  it('rejects an id of zero or below', () => {
    expect(parseItemMove({ ...takeMedkit, id: 0 })).toBeNull();
    expect(parseItemMove({ ...takeMedkit, id: -3 })).toBeNull();
    expect(parseItemMove({ ...takeMedkit, id: 1.5 })).toBeNull();
  });

  it('rejects a grid the game does not have', () => {
    expect(parseItemMove({ ...takeMedkit, to: { kind: 'cell', grid: 'roof', x: 0, y: 0, rotated: false } })).toBeNull();
    expect(parseItemMove({ ...takeMedkit, from: { kind: 'gear', slot: 'hat' } })).toBeNull();
  });

  it('rejects fractional cell coordinates', () => {
    expect(parseItemMove({ ...takeMedkit, to: { kind: 'cell', grid: 'pack', x: 0.5, y: 0, rotated: false } })).toBeNull();
    expect(parseItemMove({ ...takeMedkit, from: { kind: 'cell', grid: 'container', x: 0, y: 1.25 } })).toBeNull();
  });

  it('rejects what is not a move at all', () => {
    expect(parseItemMove(null)).toBeNull();
    expect(parseItemMove({ ...takeMedkit, item: '' })).toBeNull();
    expect(parseItemMove({ ...takeMedkit, container: 'car' })).toBeNull();
  });
});

describe('applyMoveToGrids', () => {
  it('moves a medkit from the container to the pack', () => {
    const g = grids();
    g.container!.items.push({ id: 'c-medkit-1', type: 'medkit', x: 0, y: 0, rotated: false });
    expect(applyMoveToGrids(g, takeMedkit)).toBeNull();
    expect(g.container!.items).toEqual([]);
    expect(g.pack.items).toEqual([{ id: 'c-medkit-1', type: 'medkit', x: 1, y: 1, rotated: false }]);
  });

  it('says gone for an id that is not at the source', () => {
    const g = grids();
    expect(applyMoveToGrids(g, takeMedkit)).toBe('gone');
    expect(g.pack.items).toEqual([]);
  });

  it('says no room onto an occupied cell and leaves both grids as they were', () => {
    const g = grids();
    g.container!.items.push({ id: 'c-medkit-1', type: 'medkit', x: 0, y: 0, rotated: false });
    g.pack.items.push({ id: 'plank:1', type: 'plank', x: 1, y: 0, rotated: false });
    const containerBefore = structuredClone(g.container!.items);
    const packBefore = structuredClone(g.pack.items);
    expect(applyMoveToGrids(g, takeMedkit)).toBe('no_room');
    expect(g.container!.items).toEqual(containerBefore);
    expect(g.pack.items).toEqual(packBefore);
  });

  it('only takes the item out for a use target', () => {
    const g = grids();
    g.pack.items.push({ id: 'medkit:1', type: 'medkit', x: 0, y: 0, rotated: false });
    const use: ItemMove = { id: 4, item: 'medkit:1', type: 'medkit', from: { kind: 'cell', grid: 'pack', x: 0, y: 0 }, to: { kind: 'use' } };
    expect(applyMoveToGrids(g, use)).toBeNull();
    expect(g.pack.items).toEqual([]);
  });

  it('trades two worn guns between their slots when each fits the other', () => {
    const g = grids();
    g.gear.primary = { id: 'pistol', type: 'pistol', x: 0, y: 0, rotated: false };
    g.gear.secondary = { id: 'shotgun', type: 'shotgun', x: 0, y: 0, rotated: false };
    const swap: ItemMove = { id: 5, item: 'shotgun', type: 'shotgun', from: { kind: 'gear', slot: 'secondary' }, to: { kind: 'gear', slot: 'primary' } };
    expect(applyMoveToGrids(g, swap)).toBeNull();
    expect(g.gear.primary?.id).toBe('shotgun');
    expect(g.gear.secondary?.id).toBe('pistol');
  });

  it('refuses a worn slot that is taken by a gun that can not go where the other came from', () => {
    const g = grids();
    g.gear.primary = { id: 'carbine', type: 'carbine', x: 0, y: 0, rotated: false };
    g.gear.sidearm = { id: 'pistol', type: 'pistol', x: 0, y: 0, rotated: false };
    const swap: ItemMove = { id: 6, item: 'pistol', type: 'pistol', from: { kind: 'gear', slot: 'sidearm' }, to: { kind: 'gear', slot: 'primary' } };
    expect(applyMoveToGrids(g, swap)).toBe('no_room');
    expect(g.gear.primary?.id).toBe('carbine');
  });

  it('finds a candy piece by its kind when its id is not in the bag, and a free cell when its own is taken', () => {
    const g = grids();
    g.candy.items.push({ id: 'candy-carried-jawbreaker-0', type: 'jawbreaker', x: 0, y: 5, rotated: false });
    const eat: ItemMove = { id: 7, item: 'old-id', type: 'jawbreaker', from: { kind: 'cell', grid: 'candy', x: 1, y: 5 }, to: { kind: 'use' } };
    expect(candyMoveFor(g, eat).item).toBe('candy-carried-jawbreaker-0');
    const into: ItemMove = { id: 8, item: 'c-1', type: 'ghost_gum', from: { kind: 'cell', grid: 'container', x: 0, y: 0 }, to: { kind: 'cell', grid: 'candy', x: 0, y: 5, rotated: false }, container: 3 };
    const moved = candyMoveFor(g, into);
    expect(moved.to).not.toMatchObject({ x: 0, y: 5 });
    expect(moved.to.kind).toBe('cell');
  });
});
