import { backpackDef, type BackpackTier } from '../../shared/backpack.ts';
import { autoPackItem, createInventoryGrid, type GridItem, type InventoryGrid } from '../../shared/grid-inventory.ts';
import type { HudState } from './hud-state.ts';

/** The pack as the local player really carries it: the grid, and what had no room in it. */
export interface CarriedPack {
  readonly tier: BackpackTier;
  readonly grid: InventoryGrid;
  /** Item ids that fit nowhere. The modal has no row for them, so a test and a reader can still see it. */
  readonly unplaced: readonly string[];
}

type Carried = Pick<HudState, 'owned' | 'ammoBag' | 'mags' | 'medkits' | 'bottles' | 'fireworks' | 'fountains' | 'bag' | 'backpackTier' | 'materials'>;

type Wanted = Omit<GridItem, 'x' | 'y' | 'rotated'>;

/** `count` separate items of one kind, each its own footprint, as a medkit or a plank is in a pack. */
function each(type: string, count: number): Wanted[] {
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => ({ id: `${type}-${index + 1}`, type }));
}

/** One item standing for a stack of `count`; nothing at all when there are none. */
function stack(type: string, count: number, id = type): Wanted[] {
  return count > 0 ? [{ id, type, count }] : [];
}

/** Every carried thing, biggest guns first, so the grid packs the way a person would pack it. */
function carriedItems(carried: Carried): Wanted[] {
  const materials = carried.materials;
  const guns: Wanted[] = carried.owned.map((weapon) => ({
    id: weapon,
    type: weapon,
    ammo: carried.mags[weapon] + carried.ammoBag[weapon],
  }));
  const candy = carried.bag.flatMap((kind) => stack('candy', kind.count, `candy-${kind.id}`));
  return [
    ...guns,
    ...each('medkit', carried.medkits),
    ...each('plank', materials?.planks ?? 0),
    ...(materials?.hasCrowbar ? [{ id: 'crowbar', type: 'crowbar' }] : []),
    ...(materials?.hasHammer ? [{ id: 'hammer_tool', type: 'hammer_tool' }] : []),
    ...each('sheet_curtain', materials?.sheets ?? 0),
    ...each('bottle', carried.bottles),
    ...stack('firework', carried.fireworks),
    ...stack('fountain', carried.fountains),
    ...stack('nails', materials?.nails ?? 0),
    ...candy,
  ];
}

/** Lays what the survivor carries into a grid the size of their pack. Nothing carried is an empty grid. */
export function carriedPack(carried: Carried): CarriedPack {
  const tier = carried.backpackTier ?? 'satchel';
  const { cols, rows } = backpackDef(tier);
  const grid = createInventoryGrid(cols, rows);
  const unplaced: string[] = [];
  for (const item of carriedItems(carried)) {
    const placed = autoPackItem(grid, { ...item, rotated: false });
    if (!placed) unplaced.push(item.id);
  }
  return { tier, grid, unplaced };
}
