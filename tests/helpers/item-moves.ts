// Drives the host's item moves the way a loot window does (shared/item-move-sim.ts), for specs that used to send a
// bag commit: stand at the container and view it, then move one item at a time by id.

import { townContainers } from '../../shared/containers.ts';
import { viewContainer } from '../../shared/container-viewers.ts';
import { findAvailableSlot, type GridItem, type InventoryGrid } from '../../shared/grid-inventory.ts';
import type { MoveGridId, MoveReason, MoveTo } from '../../shared/item-move.ts';
import { candyGridOf, isCandyItemType } from '../../shared/item-move-grids.ts';
import { applyItemMove } from '../../shared/item-move-sim.ts';
import type { PlayerState, SimState } from '../../shared/sim-state.ts';

type BagGrid = 'pack' | 'pockets';

/** The next id this survivor's window would number a move with. */
export const nextMoveId = (p: PlayerState): number => p.lastMoveId + 1;

function candyGrid(p: PlayerState): InventoryGrid {
  const counts = new Map<string, number>();
  for (const kind of p.candy) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  return candyGridOf([...counts].map(([id, count]) => ({ id, count })));
}

/** The survivor opens the container's window, walking to it (and searching it, if it was not) when out of reach. */
export function viewAt(sim: SimState, p: PlayerState, containerId: number): boolean {
  const def = townContainers(sim.map)[containerId];
  const state = sim.containers[containerId];
  if (!def || !state) return false;
  // Already standing in reach: stay put, so a spec's own spot is kept.
  if (state.opened && viewContainer(sim, p, containerId)) return true;
  p.x = def.x;
  p.y = def.y;
  state.opened = true;
  return viewContainer(sim, p, containerId);
}

/** The first cell with room for the item: the candy bag for candy, else the pack and then the pockets. */
function gridsFor(type: string, grid?: MoveGridId): MoveGridId[] {
  if (grid) return [grid];
  return isCandyItemType(type) ? ['candy'] : ['pack', 'pockets'];
}

function roomFor(p: PlayerState, type: string, grid?: MoveGridId): MoveTo {
  const order = gridsFor(type, grid);
  for (const each of order) {
    const into = each === 'candy' ? candyGrid(p) : p.inventory[each as BagGrid];
    const slot = findAvailableSlot(into, type, true);
    if (slot) return { kind: 'cell', grid: each, x: slot.x, y: slot.y, rotated: slot.rotated };
  }
  return { kind: 'cell', grid: order[0]!, x: 0, y: 0, rotated: false };
}

/** Takes one item out of a container into the first cell with room for it, the way a double click does. */
export function takeOut(sim: SimState, p: PlayerState, containerId: number, item: GridItem, grid?: MoveGridId): MoveReason | null {
  viewAt(sim, p, containerId);
  const to = roomFor(p, item.type, grid);
  return applyItemMove(sim, p, { id: nextMoveId(p), item: item.id, type: item.type, from: { kind: 'cell', grid: 'container', x: item.x, y: item.y }, to, container: containerId });
}

/** Sets one carried item down in a container's cell. Candy is named by its kind. */
export function putIn(sim: SimState, p: PlayerState, containerId: number, item: GridItem, from: MoveGridId, x: number, y: number): MoveReason | null {
  viewAt(sim, p, containerId);
  const to: MoveTo = { kind: 'cell', grid: 'container', x, y, rotated: item.rotated };
  return applyItemMove(sim, p, { id: nextMoveId(p), item: item.id, type: item.type, from: { kind: 'cell', grid: from, x: item.x, y: item.y }, to, container: containerId });
}

/** The first carried item of a type, and the grid it is in. Candy is looked up in the candy bag. */
export function carried(p: PlayerState, type: string): { item: GridItem; grid: MoveGridId } | null {
  if (isCandyItemType(type)) {
    const item = candyGrid(p).items.find((each) => each.type === type);
    return item ? { item, grid: 'candy' } : null;
  }
  for (const grid of ['pack', 'pockets'] as const) {
    const item = p.inventory[grid].items.find((each) => each.type === type);
    if (item) return { item, grid };
  }
  return null;
}

/** Uses (USE button) or drops (DROP button) the first carried item of a type. 'gone' when none is carried. */
export function actOn(sim: SimState, p: PlayerState, type: string, to: 'use' | 'ground'): MoveReason | null {
  const found = carried(p, type);
  if (!found) return 'gone';
  const target: MoveTo = to === 'use' ? { kind: 'use' } : { kind: 'ground', x: p.x, y: p.y };
  const { item, grid } = found;
  return applyItemMove(sim, p, { id: nextMoveId(p), item: item.id, type: item.type, from: { kind: 'cell', grid, x: item.x, y: item.y }, to: target });
}

/** Moves a carried item to a cell in the pack or pockets. */
export function rearrange(sim: SimState, p: PlayerState, item: GridItem, from: BagGrid, to: BagGrid, x: number, y: number, rotated = item.rotated): MoveReason | null {
  return applyItemMove(sim, p, { id: nextMoveId(p), item: item.id, type: item.type, from: { kind: 'cell', grid: from, x: item.x, y: item.y }, to: { kind: 'cell', grid: to, x, y, rotated } });
}
