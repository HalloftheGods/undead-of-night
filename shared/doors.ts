import { plankCapForTier } from './backpack.ts';
import { roomFor } from './bag.ts';
import { deriveMapOpenings, findNearbyOpening } from './building-openings.ts';
import { PLAYER_RADIUS, TICK_RATE } from './constants.ts';
import { containerInReachOf } from './vehicle-choice.ts';
import { carsOf } from './vehicles.ts';
import {
  addPlank,
  calculateDoorMaxHealth,
  canAddPlank,
  canDismantlePlank,
  damageDoorOpening,
  dismantlePlank,
  toggleDoor,
} from './fortifications.ts';
import type { BarricadeOpening } from './fortifications.ts';
import { isBunkerMap } from './home-protocol.ts';
import type { DoorView, WorldMap } from './protocol.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { emit } from './sim-state.ts';
import { makeNoise } from './zombie-senses.ts';
import { segmentEntersBox } from './world-query.ts';
import type { Box } from './world-query.ts';

/** A press shorter than this, on a closed door with no planks, opens it. */
export const DOOR_TAP_SEC = 0.4;
/** Holding the key on a closed door adds (or, sneaking, removes) one plank this often. */
export const DOOR_PLANK_SEC = 0.8;
/** A zombie this close to a closed door is bashing it. */
export const DOOR_BASH_REACH = 6;
/** At most one door-hit event per door in this long. */
const HIT_EVENT_TICKS = Math.round(0.5 * TICK_RATE);

interface DoorCache {
  readonly map: WorldMap;
  closed: Box[];
}

/** Keyed by the list, so two sims on one map never share a door. */
const caches = new WeakMap<BarricadeOpening[], DoorCache>();
const lastHit = new WeakMap<BarricadeOpening, number>();

/** The map's doors, every one open, unbroken and unplanked at full base health. Same order on every host and client. */
export function freshDoors(map: WorldMap): BarricadeOpening[] {
  return deriveMapOpenings(map)
    .filter((opening) => opening.type === 'door')
    .map((door) => {
      door.isOpen = true;
      door.maxHealth = calculateDoorMaxHealth(0);
      door.health = door.maxHealth;
      return door;
    });
}

export function doorBoxOf(door: Pick<BarricadeOpening, 'x' | 'y' | 'w' | 'h'>): Box {
  return { x0: door.x - door.w / 2, y0: door.y - door.h / 2, x1: door.x + door.w / 2, y1: door.y + door.h / 2 };
}

function touchesBox(box: Box, x: number, y: number, r: number): boolean {
  const dx = x - Math.max(box.x0, Math.min(x, box.x1));
  const dy = y - Math.max(box.y0, Math.min(y, box.y1));
  return dx * dx + dy * dy < r * r;
}

/** The sim's doors, built the first time they are wanted for this map and again whenever the map changes. */
export function doorsOf(sim: SimState): BarricadeOpening[] {
  const have = sim.doors;
  if (have && caches.get(have)?.map === sim.map) return have;
  const doors = freshDoors(sim.map);
  sim.doors = doors;
  caches.set(doors, { map: sim.map, closed: [] });
  return doors;
}

function refreshClosed(sim: SimState, doors: BarricadeOpening[]): void {
  const cache = caches.get(doors);
  if (cache) cache.closed = doors.filter((door) => !door.isOpen).map(doorBoxOf);
}

function closedBoxes(sim: SimState): readonly Box[] {
  const doors = sim.doors;
  const cache = doors ? caches.get(doors) : undefined;
  return cache && cache.map === sim.map ? cache.closed : [];
}

/** True where a closed door stands in the way of a body of radius `r`. */
export function doorBlocksCircle(sim: SimState, x: number, y: number, r: number): boolean {
  return closedBoxes(sim).some((box) => touchesBox(box, x, y, r));
}

/** The first point a closed door stops the segment, or null. */
export function doorBlocksSegment(sim: SimState, x0: number, y0: number, x1: number, y1: number): { x: number; y: number } | null {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let best = Infinity;
  for (const box of closedBoxes(sim)) best = Math.min(best, segmentEntersBox(box, x0, y0, dx, dy));
  return best <= 1 ? { x: x0 + dx * best, y: y0 + dy * best } : null;
}

const viewLists = new WeakMap<WorldMap, BarricadeOpening[]>();

/** The map's doors as they start, for a client to hang the snapshot's door list on. Index for index the sim's own. */
export function mapDoors(map: WorldMap): readonly BarricadeOpening[] {
  const have = viewLists.get(map);
  if (have) return have;
  const doors = freshDoors(map);
  viewLists.set(map, doors);
  return doors;
}

/** The client's twin of `doorBlocksCircle`, off the snapshot's door list. Doors not listed are open. */
export function viewsBlockCircle(map: WorldMap, views: readonly DoorView[], x: number, y: number, r: number): boolean {
  if (views.length === 0) return false;
  const doors = mapDoors(map);
  return views.some((view) => {
    const door = doors[view.i];
    return door !== undefined && !view.open && touchesBox(doorBoxOf(door), x, y, r);
  });
}

const isDefault = (door: BarricadeOpening): boolean =>
  door.isOpen && door.planks === 0 && !door.isBroken && door.health >= calculateDoorMaxHealth(0);

/** Doors that are not as they started, within `inRange` of a player. */
export function doorViews(sim: SimState, inRange: (item: { x: number; y: number }) => boolean): DoorView[] {
  const doors = sim.doors;
  if (!doors || caches.get(doors)?.map !== sim.map) return [];
  const views: DoorView[] = [];
  doors.forEach((door, i) => {
    if (isDefault(door) || !inRange(door)) return;
    views.push({ i, open: door.isOpen, planks: door.planks, health: Math.round(door.health) });
  });
  return views;
}

function bodyInTheWay(sim: SimState, door: BarricadeOpening): boolean {
  const box = doorBoxOf(door);
  const person = sim.players.some((p) => p.status !== 'dead' && touchesBox(box, p.x, p.y, PLAYER_RADIUS));
  return person || sim.zombies.some((z) => z.health > 0 && touchesBox(box, z.x, z.y, z.radius));
}

function announce(sim: SimState, type: 'door_closed' | 'door_opened' | 'plank_added' | 'plank_removed', door: BarricadeOpening): void {
  emit(sim, { type, x: door.x, y: door.y });
}

function close(sim: SimState, door: BarricadeOpening): void {
  if (bodyInTheWay(sim, door)) return;
  if (toggleDoor(door)) announce(sim, 'door_closed', door);
}

/** A plank handed back needs a slot, as a pickup does; a pry with no room for the plank (and a nail) does nothing. */
function roomToPry(p: PlayerState): boolean {
  const underCap = p.materials.planks < plankCapForTier(p.backpackTier ?? 'satchel');
  const plankFits = underCap && roomFor(p, 'plank');
  return plankFits && (p.materials.nails > 0 || roomFor(p, 'nails'));
}

function work(sim: SimState, p: PlayerState, door: BarricadeOpening): void {
  if (p.stance === 'sneak') {
    if (canDismantlePlank(p.materials, door) && roomToPry(p) && dismantlePlank(p.materials, door)) announce(sim, 'plank_removed', door);
    return;
  }
  if (canAddPlank(p.materials, door) && addPlank(p.materials, door)) announce(sim, 'plank_added', door);
}

function canWorkHere(sim: SimState, p: PlayerState): boolean {
  const ready = p.status === 'alive' && p.vehicle === null && p.searchingId === null && !p.moving;
  return ready && containerInReachOf(sim.map, carsOf(sim), p.x, p.y) === null;
}

function playerAct(sim: SimState, p: PlayerState, doors: BarricadeOpening[]): void {
  const door = canWorkHere(sim, p) ? findNearbyOpening(doors, p.x, p.y) : null;
  const held = p.doorHold;
  if (!door || p.searchSpent) {
    p.doorHold = 0;
    return;
  }
  if (!p.searchHeld) {
    p.doorHold = 0;
    const tapped = held > 0 && held < DOOR_TAP_SEC && !door.isOpen && door.planks === 0;
    if (tapped && toggleDoor(door)) announce(sim, 'door_opened', door);
    return;
  }
  if (door.isOpen) {
    close(sim, door);
    p.searchSpent = true;
    return;
  }
  const dt = 1 / TICK_RATE;
  p.doorHold = held + dt;
  const crosses = Math.floor((p.doorHold + 1e-9) / DOOR_PLANK_SEC) > Math.floor((held + 1e-9) / DOOR_PLANK_SEC);
  if (crosses) work(sim, p, door);
}

function bash(sim: SimState, door: BarricadeOpening, dt: number): void {
  const box = doorBoxOf(door);
  let count = 0;
  for (const z of sim.zombies) {
    if (z.health <= 0) continue;
    const reach = z.radius + DOOR_BASH_REACH;
    if (touchesBox(box, z.x, z.y, reach)) count += 1;
  }
  if (count === 0) return;
  const result = damageDoorOpening(door, count, dt);
  const last = lastHit.get(door) ?? -Infinity;
  if (sim.tick - last >= HIT_EVENT_TICKS) {
    lastHit.set(door, sim.tick);
    emit(sim, { type: 'door_hit', x: door.x, y: door.y });
  }
  if (!result.destroyed) return;
  emit(sim, { type: 'door_broken', x: door.x, y: door.y });
  makeNoise(sim, door.x, door.y, result.noiseRadius);
}

/** Once a tick, after container search: players working doors with the search key, zombies bashing closed ones. */
export function updateDoors(sim: SimState, dt: number): void {
  if (isBunkerMap(sim.map)) return;
  const doors = doorsOf(sim);
  for (const p of sim.players) playerAct(sim, p, doors);
  for (const door of doors) {
    if (!door.isOpen) bash(sim, door, dt);
  }
  refreshClosed(sim, doors);
}
