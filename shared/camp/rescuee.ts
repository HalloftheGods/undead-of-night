// The people to find in the first four towns: each waits where it was left, follows whoever frees it, and counts as
// rescued when it is at the van as the van leaves. Their own list, so shop and station code never sees them.

import { PLAYER_SPEED, TICK_DT } from '../constants.ts';
import { FlowField } from '../flow-field.ts';
import { MERCHANT_IDS } from '../home-protocol.ts';
import type { MerchantEntity, MerchantId } from '../home-protocol.ts';
import { lootSpots } from '../loot.ts';
import { freeSpot } from '../part-loot.ts';
import { spawnPickup } from '../pickups.ts';
import type { BuildingInstance, BuildingKind, PickupType } from '../protocol.ts';
import { groundBuildingId } from '../leftovers.ts';
import { isSewerBuilding } from '../map-protocol.ts';
import type { Rng } from '../rng.ts';
import { TILE_SIZE } from '../protocol.ts';
import { createRng, shuffle } from '../rng.ts';
import type { PlayerState, SimState } from '../sim-state.ts';
import { round2 } from '../snapshot-build.ts';
import { layField, walkTo } from '../bunker-merchants.ts';

/** Keeps the placer's rolls apart from the town's own use of its seed. */
export const RESCUE_SALT = 0x52455343;
/** Who waits in which of the first four towns. */
export const RESCUE_BY_LEVEL: Readonly<Record<number, MerchantId>> = { 1: 'quartermaster', 2: 'gunsmith', 3: 'medic', 4: 'powder' };
const KINDS_WISHED: Readonly<Record<MerchantId, readonly BuildingKind[]>> = {
  quartermaster: ['house', 'apartment'],
  gunsmith: ['garage', 'house'],
  medic: ['clinic', 'pharmacy', 'house'],
  powder: ['warehouse', 'garage', 'house'],
};
/** What lies near them when they are found. */
const FINDS: Readonly<Record<MerchantId, readonly PickupType[]>> = {
  quartermaster: ['pistol_ammo', 'carbine_ammo', 'shells'],
  gunsmith: ['shotgun'],
  medic: ['medkit', 'medkit'],
  powder: ['shells', 'shells'],
};
/** Doc and Cinder know of a stash: a gun part and a stack or kit of rounds. */
const STASH_BY: Readonly<Record<MerchantId, readonly PickupType[]>> = {
  quartermaster: [],
  gunsmith: [],
  medic: ['magazine', 'pistol_ammo'],
  powder: ['piercing_kit', 'shells'],
};
/** Seconds of holding E beside them to take them with you. */
export const FREE_SEC = 1.2;
/** How near you must stand to free them. */
export const FREE_REACH = 34;
/** They stay this far back from the leader. */
const KEEP_BACK_PX = 36;
const FIELD_TICKS = 20;
const STUCK_SEC = 3;
/** Within this of the van as it leaves, they are aboard. */
export const BOARD_RADIUS = 90;
/** Further behind than this, they are put down by the leader. */
const LOST_PX = 18 * TILE_SIZE;

export interface RescueeState {
  readonly id: MerchantId;
  x: number;
  y: number;
  angle: number;
  moving: boolean;
  status: 'waiting' | 'following';
  /** 0..1 through the hold that frees them. */
  hold: number;
  leaderId: string | null;
  readonly field: FlowField;
  fieldTick: number;
  stuckLeft: number;
  /** The building their stash is in, and what lies there to be marked: told when they are freed. Null for those with none. */
  stash: { readonly building: string; readonly mark: PickupType } | null;
}

/** Who this town has waiting: the person of its level, if anyone on the trip has not rescued them. */
function wantedIn(sim: SimState, level: number): MerchantId | null {
  const id = RESCUE_BY_LEVEL[level];
  if (!id) return null;
  const someoneNeedsThem = sim.players.some((p) => !(p.home?.rescued ?? MERCHANT_IDS).includes(id));
  return someoneNeedsThem ? id : null;
}

/** Puts the level's person in a building of the wished kind and their finds on the floor beside them. A town without a spot has none. */
export function placeRescuees(sim: SimState, level: number): void {
  sim.rescuees = [];
  const id = sim.homeRun ? wantedIn(sim, level) : null;
  if (!id) return;
  const rng = createRng(sim.map.seed ^ RESCUE_SALT);
  const fits = (kind: BuildingKind): boolean => KINDS_WISHED[id].includes(kind);
  const buildings = shuffle(rng, sim.map.buildings.filter((b) => fits(b.kind) && lootSpots(sim.map, b).length > 1));
  const ranked = [...buildings].sort((a, b) => KINDS_WISHED[id].indexOf(a.kind) - KINDS_WISHED[id].indexOf(b.kind));
  const home = ranked[0];
  if (!home) return;
  const [spot, ...rest] = shuffle(rng, [...lootSpots(sim.map, home)]);
  sim.rescuees.push({ id, x: spot.x, y: spot.y, angle: Math.PI / 2, moving: false, status: 'waiting', hold: 0, leaderId: null, field: new FlowField(sim.map), fieldTick: -1, stuckLeft: 0, stash: null });
  for (const type of FINDS[id]) {
    const at = freeSpot(sim, rest);
    if (at) spawnPickup(sim, type, at.x, at.y);
  }
  if (STASH_BY[id]) sim.rescuees[0].stash = layStash(sim, rng, home, STASH_BY[id]);
}

/** Better-than-usual finds on the floor of another building, which the person names when freed. Null if the town has no other room for it. */
function layStash(sim: SimState, rng: Rng, not: BuildingInstance, finds: readonly PickupType[]): RescueeState['stash'] {
  const rooms = shuffle(rng, sim.map.buildings.filter((b) => b !== not && !isSewerBuilding(b) && lootSpots(sim.map, b).length >= finds.length));
  const room = rooms[0];
  if (!room) return null;
  const spots = shuffle(rng, [...lootSpots(sim.map, room)]);
  const laid = finds.filter((type, i) => {
    const at = freeSpot(sim, spots.slice(i));
    if (at) spawnPickup(sim, type, at.x, at.y);
    return at !== null;
  });
  return laid.length > 0 ? { building: groundBuildingId(room), mark: laid[0] } : null;
}

/** A player on their feet who is standing at them, not walking, with the use key held. */
function holder(sim: SimState, r: RescueeState): PlayerState | null {
  const near = (p: PlayerState): boolean => p.status === 'alive' && p.searchHeld && !p.moving && Math.hypot(p.x - r.x, p.y - r.y) <= FREE_REACH;
  return sim.players.find(near) ?? null;
}

function leaderOf(sim: SimState, r: RescueeState): PlayerState | null {
  const chosen = sim.players.find((p) => p.id === r.leaderId && p.status === 'alive');
  if (chosen) return chosen;
  let best: PlayerState | null = null;
  for (const p of sim.players) {
    if (p.status !== 'alive') continue;
    if (!best || Math.hypot(p.x - r.x, p.y - r.y) < Math.hypot(best.x - r.x, best.y - r.y)) best = p;
  }
  return best;
}

function follow(sim: SimState, r: RescueeState): void {
  const leader = leaderOf(sim, r);
  if (!leader) {
    r.moving = false;
    return;
  }
  r.leaderId = leader.id;
  const gap = Math.hypot(leader.x - r.x, leader.y - r.y);
  if (gap > LOST_PX || r.stuckLeft >= STUCK_SEC) {
    r.x = leader.x - 12;
    r.y = leader.y;
    r.stuckLeft = 0;
    return;
  }
  if (gap <= KEEP_BACK_PX) {
    r.moving = false;
    r.stuckLeft = 0;
    return;
  }
  if (sim.tick - r.fieldTick >= FIELD_TICKS) layField(sim, r, [leader]);
  const moved = walkTo(sim, r, leader, PLAYER_SPEED);
  r.stuckLeft = moved ? 0 : r.stuckLeft + TICK_DT;
}

/** One tick for everyone in town: waiting ones are freed by a held key, freed ones follow. */
export function updateRescuees(sim: SimState): void {
  for (const r of sim.rescuees) {
    if (r.status === 'following') {
      follow(sim, r);
      continue;
    }
    const by = holder(sim, r);
    r.hold = by ? Math.min(1, r.hold + TICK_DT / FREE_SEC) : Math.max(0, r.hold - TICK_DT);
    if (by && r.hold >= 1) {
      r.status = 'following';
      r.leaderId = by.id;
      if (r.stash) {
        sim.entered.add(r.stash.building);
        sim.clues.set(r.stash.building, r.stash.mark);
      }
    }
  }
}

/** Who is at the van as it leaves. */
export function boardedAtVan(sim: SimState): MerchantId[] {
  const { exit } = sim;
  if (!exit) return [];
  return sim.rescuees.filter((r) => r.status === 'following' && Math.hypot(r.x - exit.x, r.y - exit.y) <= BOARD_RADIUS).map((r) => r.id);
}

/** As the snapshot carries them: a merchant's body, told apart by `rescue`. */
export function rescueeView(r: RescueeState): MerchantEntity {
  return { id: r.id, x: round2(r.x), y: round2(r.y), angle: round2(r.angle), moving: r.moving, status: 'alive', health: 100, maxHealth: 100, weapon: 'pistol', reload: 0, rescue: r.status === 'waiting' ? 'waiting' : 'following', ...(r.hold > 0 ? { hold: round2(r.hold) } : {}) };
}
