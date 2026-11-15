// How a loot window names what the hand just did as an item move (shared/item-move.ts). Both windows run the same
// state functions (dual-loot-modal.ts); they note where the item came from before, find where it sits after, and
// propose the move from one to the other. Cells are in the window's own layout: the ledger turns a flipped
// container's cells back to the host's (use-move-ledger.ts).

import type { GridItem } from '../../../shared/grid-inventory.ts';
import type { ItemMove, MoveFrom, MoveGridId, MoveTo } from '../../../shared/item-move.ts';
import { arrivalCamera } from './move-motion.ts';
import { resolveGridById, type DualLootState, type GearSlotId, type GridIdentifier, type ItemSource } from './dual-loot-modal.ts';

/** A move as a window proposes it: the ledger numbers it. */
export type ProposedMove = Omit<ItemMove, 'id'>;

const GRID_IDS: readonly GridIdentifier[] = ['container', 'pockets', 'backpack', 'candyBag'];
const GEAR_SLOTS: readonly GearSlotId[] = ['primary', 'secondary', 'sidearm', 'armor'];

/** A window grid as a move names it. */
export function moveGridOf(id: GridIdentifier): MoveGridId {
  if (id === 'backpack') return 'pack';
  if (id === 'candyBag') return 'candy';
  return id;
}

/** A move's grid as the window names it. */
export function windowGridOf(grid: MoveGridId): GridIdentifier {
  if (grid === 'pack') return 'backpack';
  if (grid === 'candy') return 'candyBag';
  return grid;
}

/** Where a held item was lifted from. */
export function sourceOf(source: ItemSource): MoveFrom {
  if (source.kind === 'gear') return { kind: 'gear', slot: source.slotId };
  return { kind: 'cell', grid: moveGridOf(source.gridId), x: source.x, y: source.y };
}

/** An item still sitting in a grid, as a move's source. */
export function cellFrom(gridId: GridIdentifier, item: Pick<GridItem, 'x' | 'y'>): MoveFrom {
  return { kind: 'cell', grid: moveGridOf(gridId), x: item.x, y: item.y };
}

/** Where the item sits in the window now, as a move's target; null when it is in hand or gone. */
export function placedAt(state: DualLootState, itemId: string): MoveTo | null {
  for (const gridId of GRID_IDS) {
    const item = resolveGridById(state, gridId).items.find((each) => each.id === itemId);
    if (item) return { kind: 'cell', grid: moveGridOf(gridId), x: item.x, y: item.y, rotated: item.rotated };
  }
  const slot = GEAR_SLOTS.find((each) => state.gear[each]?.id === itemId);
  return slot ? { kind: 'gear', slot } : null;
}

/** The item and the grid it sits in, in the window, or null when it is not in any grid. */
export function findShown(state: DualLootState, itemId: string): { gridId: GridIdentifier; item: GridItem } | null {
  for (const gridId of GRID_IDS) {
    const item = resolveGridById(state, gridId).items.find((each) => each.id === itemId);
    if (item) return { gridId, item };
  }
  return null;
}

/** One move of one item, or null when it has nowhere to go or went back to the slot it left. */
export function windowMove(item: Pick<GridItem, 'id' | 'type'>, from: MoveFrom, to: MoveTo | null): ProposedMove | null {
  if (!to) return null;
  const isGearBack = from.kind === 'gear' && to.kind === 'gear' && from.slot === to.slot;
  return isGearBack ? null : { item: item.id, type: item.type, from, to };
}

/** The survivor's own use of the item in hand. */
export const USE_TARGET: MoveTo = { kind: 'use' };

/** The item in hand let go over the world with no pointer to aim by (a pad): world (0, 0) is off the map, so the host drops it at the feet. */
export const GROUND_TARGET: MoveTo = { kind: 'ground', x: 0, y: 0 };

/** The item in hand let go over the game at a client point: tossed toward the world point under it. */
export function groundTargetAt(clientX: number, clientY: number): MoveTo {
  const world = arrivalCamera()?.toWorld({ x: clientX, y: clientY });
  return world ? { kind: 'ground', x: world.x, y: world.y } : GROUND_TARGET;
}
