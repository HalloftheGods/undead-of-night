// The supply drop: once a town, after its first horde, a flare goes up over open ground and a crate
// comes down on it. The flare hisses the whole time, so whoever goes for it meets everything else that did.

import { AMMO_PICKUPS, TICK_DT } from './constants.ts';
import type { AmmoPickup } from './constants.ts';
import { scaleRounds } from './difficulty.ts';
import { PART_ORDER } from './gun-upgrade-data.ts';
import { isBunkerMap } from './home-protocol.ts';
import { spawnPickup } from './pickups.ts';
import type { PickupType } from './protocol.ts';
import { KIT_ORDER } from './round-effect-data.ts';
import { createRng, pick } from './rng.ts';
import type { Rng } from './rng.ts';
import type { SimState } from './sim-state.ts';
import { alivePlayers, emit } from './sim-state.ts';
import { FLARE_SEC } from './throwables.ts';
import { LARGE_JEWEL_SILVER } from './treasure.ts';
import { buildingAt, circleHitsSolid } from './world-query.ts';
import { townHeight } from './storeys.ts';
import { makeNoise } from './zombie-senses.ts';

/** Seconds into the lull after the first horde before the flare goes up. */
export const DROP_DELAY_SEC = 12;
/** Seconds from the flare to the crate landing. */
export const DROP_FALL_SEC = 10;
/** Seconds the landed drop stays marked on screen and map. */
export const DROP_MARK_SEC = 40;
/** The crate lands with a crash heard this far off. */
export const DROP_NOISE_RADIUS = 450;
/** How far from the nearest survivor it may come down. */
export const DROP_MIN_DISTANCE = 320;
export const DROP_MAX_DISTANCE = 900;
/** Clear ground the crate needs. */
const DROP_CLEARANCE = 22;
const DROP_SALT = 0x44524f50;
const AMMO_TYPES: readonly AmmoPickup[] = ['pistol_ammo', 'carbine_ammo', 'shells'];

export interface SupplyDrop {
  readonly x: number;
  readonly y: number;
  /** Counts down the lull before the flare, then the fall, then the time it stays marked. */
  left: number;
  phase: 'waiting' | 'falling' | 'landed';
}

/** Rolled from the town's seed on a generator of its own, so the simulation's rolls never move. */
function dropRng(sim: SimState): Rng {
  return createRng((sim.map.seed ^ DROP_SALT ^ Math.imul(sim.level + 1, 0x85ebca6b)) >>> 0);
}

/** Open ground, outdoors, a fair walk from everyone, or null if the town has none to offer. */
export function dropSpot(sim: SimState, rng: Rng): { x: number; y: number } | null {
  const { map } = sim;
  const margin = 160;
  const players = alivePlayers(sim);
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const x = margin + rng() * (map.width - margin * 2);
    const y = margin + rng() * (townHeight(map) - margin * 2);
    const open = buildingAt(map, x, y) === null && !circleHitsSolid(map, x, y, DROP_CLEARANCE);
    if (!open) continue;
    const nearest = Math.min(...players.map((p) => Math.hypot(p.x - x, p.y - y)));
    const fairWalk = players.length === 0 || (nearest >= DROP_MIN_DISTANCE && nearest <= DROP_MAX_DISTANCE);
    if (fairWalk) return { x, y };
  }
  return null;
}

/** What is in the crate: a round kit, two boxes of ammo, a medkit, and a large jewel on a trip or a gun part otherwise. */
export function dropContents(sim: SimState, rng: Rng): { type: PickupType; rounds: number }[] {
  const ammo = (type: AmmoPickup) => ({ type, rounds: scaleRounds(AMMO_PICKUPS[type].rounds * 2, sim.difficulty) });
  const prize: { type: PickupType; rounds: number } = sim.homeRun
    ? { type: 'jewel_large', rounds: LARGE_JEWEL_SILVER }
    : { type: pick(rng, PART_ORDER.filter((part) => part !== 'toolkit')), rounds: 0 };
  return [
    { type: pick(rng, KIT_ORDER), rounds: 0 },
    ammo(pick(rng, AMMO_TYPES)),
    ammo(pick(rng, AMMO_TYPES)),
    { type: 'medkit', rounds: 0 },
    prize,
  ];
}

function land(sim: SimState, drop: SupplyDrop): void {
  const rng = dropRng(sim);
  rng(); // the spot's first roll, so the contents never share it
  dropContents(sim, rng).forEach((item, index, all) => {
    const angle = (index / all.length) * Math.PI * 2 + rng();
    spawnPickup(sim, item.type, drop.x + Math.cos(angle) * 12, drop.y + Math.sin(angle) * 9, item.rounds);
  });
  makeNoise(sim, drop.x, drop.y, DROP_NOISE_RADIUS);
  emit(sim, { type: 'drop_landed', x: drop.x, y: drop.y });
}

/** Once a tick, in town. Arms after the first horde, then runs the lull, the fall and the marked time. */
export function updateSupplyDrop(sim: SimState): void {
  if (isBunkerMap(sim.map)) return;
  const due = sim.drop === null && !sim.dropDone && sim.phase === 'intermission' && sim.wave >= 1;
  if (due) {
    sim.dropDone = true;
    const spot = dropSpot(sim, dropRng(sim));
    if (spot) sim.drop = { ...spot, left: DROP_DELAY_SEC, phase: 'waiting' };
  }
  const drop = sim.drop;
  if (!drop) return;
  drop.left -= TICK_DT;
  const isStillTiming = drop.left > 1e-9;
  if (isStillTiming) return;
  const isWaiting = drop.phase === 'waiting';
  if (isWaiting) {
    drop.phase = 'falling';
    drop.left = DROP_FALL_SEC;
    sim.flares.push({ x: drop.x, y: drop.y, left: FLARE_SEC, noiseLeft: 0 });
    emit(sim, { type: 'drop_called', x: drop.x, y: drop.y, sec: DROP_FALL_SEC });
  } else {
    const isFalling = drop.phase === 'falling';
    if (isFalling) {
      drop.phase = 'landed';
      drop.left = DROP_MARK_SEC;
      land(sim, drop);
    } else {
      sim.drop = null;
    }
  }
}
