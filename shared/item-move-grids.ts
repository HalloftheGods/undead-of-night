import { CANDY_GRID, isCandyId } from './candy.ts';
import { autoPackFromBottom, canPlaceItem, createInventoryGrid, findAvailableSlot, placeItem, removeItem } from './grid-inventory.ts';
import type { GridItem, InventoryGrid } from './grid-inventory.ts';
import type { GearSlotId, ItemMove, MoveGridId, MoveReason } from './item-move.ts';

/** Every grid and worn slot one survivor's move can touch. The container is null when none is open. */
export interface MoveGrids {
  pack: InventoryGrid;
  pockets: InventoryGrid;
  candy: InventoryGrid;
  container: InventoryGrid | null;
  gear: Record<GearSlotId, GridItem | null>;
}

/** Candy lives only in the candy bag, and the candy bag holds nothing else. */
export const isCandyItemType = (type: string): boolean => isCandyId(type) || type === 'candy';

/** Which worn slot takes which item: the armor slot a vest, the gun slots the guns (and a knife) that fit them. */
export function isItemValidForGearSlot(itemType: string, slotId: GearSlotId): boolean {
  if (slotId === 'armor') return itemType === 'armor_vest';
  if (slotId === 'sidearm') return itemType === 'pistol';
  if (slotId === 'primary') return ['carbine', 'shotgun', 'pistol', 'knife'].includes(itemType);
  if (slotId === 'secondary') return ['pistol', 'knife', 'shotgun'].includes(itemType);
  return false;
}

export function copyGrid(grid: InventoryGrid): InventoryGrid {
  return { cols: grid.cols, rows: grid.rows, items: grid.items.map((item) => ({ ...item })), ...(grid.blocked ? { blocked: grid.blocked } : {}) };
}

/** The candy bag laid out from its stacks, bottom first, as the window draws it. Ids are `candy-carried-<kind>-<n>`. */
export function candyGridOf(stacks: readonly { readonly id: string; readonly count: number }[]): InventoryGrid {
  const grid = createInventoryGrid(CANDY_GRID.cols, CANDY_GRID.rows);
  let serial = 0;
  for (const stack of stacks) {
    for (let piece = 0; piece < stack.count; piece += 1) {
      autoPackFromBottom(grid, { id: `candy-carried-${stack.id}-${serial}`, type: stack.id, rotated: false });
      serial += 1;
    }
  }
  return grid;
}

function gridOf(grids: MoveGrids, id: MoveGridId): InventoryGrid | null {
  return grids[id];
}

/** The item the move names, where the move says it is, or null when it is not there. */
export function moveSourceItem(grids: MoveGrids, move: ItemMove): GridItem | null {
  const { from } = move;
  const found = from.kind === 'gear' ? grids.gear[from.slot] : gridOf(grids, from.grid)?.items.find((item) => item.id === move.item);
  return found && found.id === move.item && found.type === move.type ? found : null;
}

function takeFromSource(grids: MoveGrids, move: ItemMove): void {
  const { from } = move;
  if (from.kind === 'gear') {
    grids.gear[from.slot] = null;
    return;
  }
  const grid = gridOf(grids, from.grid);
  if (grid) removeItem(grid, move.item);
}

/** Why a cell can not take the item, or null when it can. */
function cellRefusal(grids: MoveGrids, move: ItemMove, item: GridItem): MoveReason | null {
  const { to, from } = move;
  if (to.kind !== 'cell') return null;
  const target = gridOf(grids, to.grid);
  if (!target) return 'bad';
  const isCandy = isCandyItemType(item.type);
  const isCandyGrid = to.grid === 'candy';
  const isWrongBag = isCandy !== isCandyGrid && to.grid !== 'container';
  if (isWrongBag) return 'bad';
  const isSameGrid = from.kind === 'cell' && from.grid === to.grid;
  const fits = canPlaceItem(target, item.type, to.x, to.y, to.rotated, isSameGrid ? item.id : undefined);
  return fits ? null : 'no_room';
}

/** What a gear-to-gear move swaps out: the worn item, when it can take the slot the moving one left. */
function swappedOut(grids: MoveGrids, move: ItemMove, item: GridItem): GridItem | null {
  const { from, to } = move;
  if (to.kind !== 'gear' || from.kind !== 'gear') return null;
  const worn = grids.gear[to.slot];
  const isOther = worn !== null && worn.id !== item.id;
  return isOther && isItemValidForGearSlot(worn.type, from.slot) ? worn : null;
}

/** Why a worn slot can not take the item, or null when it can. Two guns trade slots when each fits the other's. */
function gearRefusal(grids: MoveGrids, move: ItemMove, item: GridItem): MoveReason | null {
  const { to } = move;
  if (to.kind !== 'gear') return null;
  if (!isItemValidForGearSlot(item.type, to.slot)) return 'bad';
  const worn = grids.gear[to.slot];
  const isTaken = worn !== null && worn.id !== item.id && swappedOut(grids, move, item) === null;
  return isTaken ? 'no_room' : null;
}

/**
 * The host keeps candy as a list, not a layout, so neither side's candy bag keeps ids or cells across a snapshot: a
 * piece is found by its kind when its id is gone, and one set down where there is no room goes wherever there is.
 */
export function candyMoveFor(grids: MoveGrids, move: ItemMove): ItemMove {
  let { item, to } = move;
  if (move.from.kind === 'cell' && move.from.grid === 'candy') {
    const piece = grids.candy.items.find((each) => each.id === item) ?? grids.candy.items.find((each) => each.type === move.type);
    if (piece) item = piece.id;
  }
  const isCandyTarget = to.kind === 'cell' && to.grid === 'candy';
  if (isCandyTarget && to.kind === 'cell' && !canPlaceItem(grids.candy, move.type, to.x, to.y, to.rotated, item)) {
    const slot = findAvailableSlot(grids.candy, move.type, false);
    if (slot) to = { ...to, x: slot.x, y: slot.y, rotated: slot.rotated };
  }
  return { ...move, item, to };
}

/**
 * Applies one move to the grids, in place: the item leaves its source by id and lands at its target if its footprint
 * fits there. Null when applied. 'gone' when the item is not at its source, 'no_room' when it does not fit, and 'bad'
 * for a target that can not hold it; on any of those nothing changes. Use, ground and teammate targets only take the
 * item out; what they do is the host's call.
 */
export function applyMoveToGrids(grids: MoveGrids, move: ItemMove): MoveReason | null {
  const item = moveSourceItem(grids, move);
  if (!item) return 'gone';
  const refusal = cellRefusal(grids, move, item) ?? gearRefusal(grids, move, item);
  if (refusal) return refusal;
  const moved: GridItem = { ...item };
  const swapped = swappedOut(grids, move, item);
  takeFromSource(grids, move);
  const { to, from } = move;
  if (to.kind === 'cell') {
    const target = gridOf(grids, to.grid);
    if (target) placeItem(target, { ...moved, x: to.x, y: to.y, rotated: to.rotated });
  } else if (to.kind === 'gear') {
    grids.gear[to.slot] = moved;
    if (swapped && from.kind === 'gear') grids.gear[from.slot] = { ...swapped };
  }
  return null;
}
