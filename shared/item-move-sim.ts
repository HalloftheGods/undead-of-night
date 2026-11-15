import { ammoBoxRounds, ammoBoxWeapon, bagWanted, isAmmoBoxType, isBagItemType, stampAmmoBoxes, syncBag } from './bag.ts';
import type { BagGridId } from './bag.ts';
import { take } from './bag-sim.ts';
import { bagOf, eatCandyDirect, isCandyId } from './candy.ts';
import type { CandyId } from './candy.ts';
import { WEAPONS } from './constants.ts';
import { takeFromContainer } from './container-take.ts';
import { isViewing } from './container-viewers.ts';
import { containerGridFor, townContainers } from './containers.ts';
import type { ContainerState } from './containers.ts';
import { canPlaceItem, createInventoryGrid, findAvailableSlot, placeItem, removeItem } from './grid-inventory.ts';
import type { GridItem, InventoryGrid } from './grid-inventory.ts';
import { touchesContainer } from './item-move.ts';
import type { GearSlotId, ItemMove, MoveFrom, MoveReason } from './item-move.ts';
import { applyMoveToGrids, candyGridOf, copyGrid, moveSourceItem } from './item-move-grids.ts';
import type { MoveGrids } from './item-move-grids.ts';
import { useMedkit } from './player-health.ts';
import type { WeaponId } from './protocol.ts';
import { emit } from './sim-state.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { useSupply } from './supplies.ts';
import { isSupplyType } from './supply-types.ts';
import { armHordeSurge } from './waves.ts';
import { syncGun } from './weapons.ts';

/** The container a move works on, with the host's own copy of its grid to try the move on. */
interface ViewedContainer {
  readonly id: number;
  readonly state: ContainerState;
  readonly grid: InventoryGrid;
  readonly isBowl: boolean;
}

const isBagGrid = (grid: string): grid is BagGridId => grid === 'pack' || grid === 'pockets';
const isGun = (type: string): type is WeaponId => Object.hasOwn(WEAPONS, type);
const countCandy = (items: readonly GridItem[]): number => items.filter((item) => isCandyId(item.type)).length;

function gunItem(p: PlayerState, weapon: WeaponId | null): GridItem | null {
  if (!weapon) return null;
  const loaded = p.guns[weapon]?.ammo ?? 0;
  return { id: weapon, type: weapon, x: 0, y: 0, rotated: false, ammo: loaded + p.ammoBag[weapon] };
}

/** The guns as the window wears them: the held gun is primary, a second long gun secondary, the pistol the sidearm. */
function gearOf(p: PlayerState): Record<GearSlotId, GridItem | null> {
  const owned = (weapon: WeaponId): boolean => p.owned.includes(weapon);
  const primary = owned(p.weapon) ? p.weapon : null;
  const secondary = (['carbine', 'shotgun'] as const).find((weapon) => owned(weapon) && weapon !== primary) ?? null;
  const sidearm = owned('pistol') && primary !== 'pistol' ? 'pistol' : null;
  return { primary: gunItem(p, primary), secondary: gunItem(p, secondary), sidearm: gunItem(p, sidearm), armor: null };
}

/** The container the move names, if the survivor has its window open. */
function viewedContainer(sim: SimState, p: PlayerState, id: number | undefined): ViewedContainer | null {
  const state = id === undefined ? undefined : sim.containers[id];
  if (id === undefined || !state || !isViewing(sim, p, id)) return null;
  const def = sim.map ? townContainers(sim.map)[id] : undefined;
  const { cols, rows, blocked } = containerGridFor(def);
  const grid = createInventoryGrid(cols, rows, blocked);
  grid.items = (state.items ?? []).map((item) => ({ ...item }));
  return { id, state, grid, isBowl: def?.kind === 'bowl' };
}

function moveGridsOf(p: PlayerState, view: ViewedContainer | null): MoveGrids {
  const stacks = Object.entries(bagOf(p.candy)).map(([id, count]) => ({ id, count: count ?? 0 }));
  return {
    pack: copyGrid(p.inventory.pack),
    pockets: copyGrid(p.inventory.pockets),
    candy: candyGridOf(stacks),
    container: view ? view.grid : null,
    gear: gearOf(p),
  };
}

/**
 * The host keeps candy as a list, not a layout, so its candy bag can not hold the client's ids or cells: a piece is
 * named by its kind, and one set down in the candy bag goes wherever there is room.
 */
function hostCandyMove(grids: MoveGrids, move: ItemMove): ItemMove {
  let { item, to } = move;
  if (move.from.kind === 'cell' && move.from.grid === 'candy') {
    const piece = grids.candy.items.find((each) => each.id === item) ?? grids.candy.items.find((each) => each.type === move.type);
    if (piece) item = piece.id;
  }
  if (to.kind === 'cell' && to.grid === 'candy' && !canPlaceItem(grids.candy, move.type, to.x, to.y, to.rotated)) {
    const slot = findAvailableSlot(grids.candy, move.type, false);
    if (slot) to = { ...to, x: slot.x, y: slot.y, rotated: slot.rotated };
  }
  return { ...move, item, to };
}

function syncAll(p: PlayerState): void {
  syncBag(p.inventory, bagWanted(p));
  stampAmmoBoxes(p.inventory, p.ammoBag);
}

/** The bag item a pickup just packed is moved to the cell the survivor chose, when it fits there. */
function placeArrival(p: PlayerState, before: ReadonlySet<string>, move: ItemMove): void {
  const { to } = move;
  if (to.kind !== 'cell' || !isBagGrid(to.grid)) return;
  for (const grid of [p.inventory.pack, p.inventory.pockets]) {
    const arrived = grid.items.find((item) => !before.has(item.id));
    if (!arrived) continue;
    const target = p.inventory[to.grid];
    const fits = canPlaceItem(target, arrived.type, to.x, to.y, to.rotated, arrived.id);
    if (!fits) return;
    removeItem(grid, arrived.id);
    placeItem(target, { ...arrived, x: to.x, y: to.y, rotated: to.rotated });
    return;
  }
}

/** Out of the container, by the rules of finding it on the ground. A partly taken box of rounds stays where it was. */
function takeIn(sim: SimState, p: PlayerState, item: GridItem, move: ItemMove, view: ViewedContainer): MoveReason | null {
  const before = new Set([...p.inventory.pack.items, ...p.inventory.pockets.items].map((each) => each.id));
  const candyBefore = countCandy(view.state.items ?? []);
  const left = takeFromContainer(p, item);
  if (left === item) return 'no_room';
  // A Radio is found the moment it leaves the grid: the event unlocks it for the party, as one on the floor does.
  if (item.type === 'radio' && left === null) emit(sim, { type: 'pickup', playerId: p.id, pickup: 'radio', x: p.x, y: p.y });
  const items = view.grid.items;
  if (left) items.push({ ...left, x: item.x, y: item.y, rotated: item.rotated });
  view.state.items = items;
  // A candy bowl starts full, so the pieces gone from it are the ones taken. The second one calls the horde.
  if (view.isBowl) {
    const full = view.grid.cols * view.grid.rows - (view.grid.blocked?.length ?? 0);
    const crossed = full - candyBefore < 2 && full - countCandy(items) >= 2;
    if (crossed) armHordeSurge(sim);
  }
  placeArrival(p, before, move);
  stampAmmoBoxes(p.inventory, p.ammoBag);
  return null;
}

/** Into the container: the piece leaves the survivor's counters and sits where it was set down. */
function deposit(p: PlayerState, item: GridItem, from: MoveFrom, view: ViewedContainer): MoveReason | null {
  if (from.kind !== 'cell') return 'bad';
  const placed = view.grid.items.find((each) => each.id === item.id);
  if (!placed) return 'bad';
  if (from.grid === 'candy') {
    const at = p.candy.indexOf(item.type as CandyId);
    if (at < 0) return 'gone';
    p.candy.splice(at, 1);
  } else if (isBagGrid(from.grid) && isAmmoBoxType(item.type)) {
    const weapon = ammoBoxWeapon(item.type);
    const rounds = Math.min(p.ammoBag[weapon], item.ammo ?? ammoBoxRounds(item.type));
    if (rounds <= 0) return 'gone';
    removeItem(p.inventory[from.grid], item.id);
    p.ammoBag[weapon] -= rounds;
    placed.ammo = rounds;
    syncGun(p);
  } else if (isBagGrid(from.grid) && isBagItemType(item.type)) {
    removeItem(p.inventory[from.grid], item.id);
    take(p, item.type, item.count ?? 1);
  } else {
    return 'bad';
  }
  view.state.items = view.grid.items;
  syncAll(p);
  return null;
}

/** Used on the survivor: food, water and bandages as the USE button would, candy eaten, a box loaded, a medkit used. */
function useItem(sim: SimState, p: PlayerState, item: GridItem, from: MoveFrom): MoveReason | null {
  if (from.kind !== 'cell' || from.grid === 'container') return 'bad';
  const { type } = item;
  if (from.grid === 'candy') {
    if (!isCandyId(type) || !p.candy.includes(type)) return 'gone';
    eatCandyDirect(sim, p, type);
    return null;
  }
  // Loading a box: the gun it feeds starts its reload. The rounds leave the counter when it ends, and the box with them.
  if (isAmmoBoxType(type)) {
    if (ammoBoxWeapon(type) !== p.weapon) return 'not_needed';
    p.reloadQueued = true;
    return null;
  }
  const isMedkit = type === 'medkit';
  const needsCare = p.health < p.maxHealth || p.needs?.bleeding === true;
  if (isMedkit && (!needsCare || p.medkits <= 0)) return 'not_needed';
  const isUsable = isMedkit || (isSupplyType(type) && useSupply(p, type));
  if (!isUsable) return isSupplyType(type) ? 'not_needed' : 'bad';
  removeItem(p.inventory[from.grid], item.id);
  if (isMedkit) {
    p.healQueued = true;
    useMedkit(sim, p);
  }
  syncAll(p);
  return null;
}

/** What the move does to the survivor and the container once the grids say it fits. Changes nothing when it refuses. */
function moveEffects(sim: SimState, p: PlayerState, item: GridItem, move: ItemMove, grids: MoveGrids, view: ViewedContainer | null): MoveReason | null {
  const { from, to } = move;
  if (to.kind === 'use') return useItem(sim, p, item, from);
  if (to.kind === 'ground' || to.kind === 'player') return 'bad';
  const fromContainer = from.kind === 'cell' && from.grid === 'container';
  const toContainer = to.kind === 'cell' && to.grid === 'container';
  if (view && fromContainer && toContainer) {
    view.state.items = view.grid.items;
    return null;
  }
  if (view && fromContainer) return to.kind === 'gear' && !isGun(item.type) ? 'bad' : takeIn(sim, p, item, move, view);
  if (view && toContainer) return deposit(p, item, from, view);
  // Guns are worn and never packed: a gun changes slots, and nothing else goes on or off the gear.
  if (from.kind === 'gear' || to.kind === 'gear') {
    const isSlotChange = from.kind === 'gear' && to.kind === 'gear';
    if (!isSlotChange || !isGun(item.type)) return 'bad';
    if (to.slot === 'primary') p.weaponQueued = item.type;
    return null;
  }
  // Within the survivor's own bag: the host keeps the pack and pockets as laid out; the candy bag has no layout to keep.
  p.inventory.pack.items = grids.pack.items;
  p.inventory.pockets.items = grids.pockets.items;
  stampAmmoBoxes(p.inventory, p.ammoBag);
  return null;
}

function tryMove(sim: SimState, p: PlayerState, move: ItemMove): MoveReason | null {
  if (p.status !== 'alive') return 'bad';
  const usesContainer = touchesContainer(move);
  const view = usesContainer ? viewedContainer(sim, p, move.container) : null;
  if (usesContainer && !view) return 'bad';
  const grids = moveGridsOf(p, view);
  const hostMove = hostCandyMove(grids, move);
  const item = moveSourceItem(grids, hostMove);
  if (!item) return 'gone';
  const refusal = applyMoveToGrids(grids, hostMove);
  if (refusal) return refusal;
  return moveEffects(sim, p, item, hostMove, grids, view);
}

/**
 * One item move from a survivor's window. A move at or below the last one applied is a repeat and is ignored ('bad',
 * no event). Otherwise the host checks it against its own bag and container, applies it, and answers `move_ok`, or
 * `move_no` with the reason and nothing changed. Container items move one at a time by id; the container is never
 * replaced wholesale. Ground and teammate targets are refused until aimed drops and care land.
 */
export function applyItemMove(sim: SimState, p: PlayerState, move: ItemMove): MoveReason | null {
  if (move.id <= p.lastMoveId) return 'bad';
  const reason = tryMove(sim, p, move);
  if (reason) {
    emit(sim, { type: 'move_no', playerId: p.id, moveId: move.id, reason });
    return reason;
  }
  p.lastMoveId = move.id;
  emit(sim, { type: 'move_ok', playerId: p.id, moveId: move.id });
  return null;
}

