import { roomFor } from './bag.ts';
import { hasKeepsake, LIGHTER_SPIN } from './keepsakes.ts';
// Fireworks: two throws besides the bottle, both found in town and both left behind when the town is.
// A spinner is lit and tossed, and lands as a flower of sparks whirling on the street that sets alight
// whatever walks through it. A fountain stands where it lands and sprays sparks straight up for a long
// while, hissing and crackling loud enough to pull a crowd to it, and lights whatever reaches it.
// The supply drop's red flare is the other lure: it hisses the same but burns nobody.

import { landingSpot } from './bottles.ts';
import { BOOM_DISTANCE_SCALE, BOOM_RADIUS_SCALE, sugarOf } from './candy.ts';
import { TICK_DT } from './constants.ts';
import type { Container } from './containers.ts';
import { hurtPlayer } from './player-health.ts';
import type { EntityId } from './protocol.ts';
import { createRng } from './rng.ts';
import type { PlayerState, SimState, ZombieState } from './sim-state.ts';
import { emit } from './sim-state.ts';
import { igniteZombie } from './zombie-status.ts';
import { makeNoise } from './zombie-senses.ts';

/** Most spinners and fountains a survivor carries. */
export const FIREWORK_CARRY = 2;
export const FOUNTAIN_CARRY = 2;

/** A spinner flies a little short of a bottle and whirls sparks this far round it for this long. */
export const SPINNER_RANGE = 150;
export const SPINNER_RADIUS = 30;
export const SPINNER_SEC = 5;
/** Popping Eyeballs throw the sparks half as far again. */
export const POPPING_REACH = 0.5;
/** The fizz as it catches is heard this far off; the whistle and crackle carry on every so often. */
export const SPINNER_NOISE_RADIUS = 240;
export const SPARK_NOISE_SEC = 1;
export const SPARK_NOISE_RADIUS = 140;
/** Anyone standing in the sparks, survivors included, is burnt this much this often. */
export const SPARK_PLAYER_DAMAGE = 4;
export const SPARK_PLAYER_SEC = 0.5;

/** A fountain lands where it is thrown and sprays for this long; zombies that get this close catch. */
export const FOUNTAIN_RANGE = 190;
export const FOUNTAIN_SEC = 20;
export const FOUNTAIN_SPARK_RADIUS = 20;
/** The supply drop's flare burns as long. */
export const FLARE_SEC = 20;
/** A fountain and the drop's flare both hiss loud enough to draw a crowd, this far, this often. */
export const LURE_NOISE_RADIUS = 260;
export const LURE_NOISE_SEC = 1.5;

/** Shared with the bottle, so the three throws cannot be chained in one breath. */
export const THROW_COOLDOWN_SEC = 0.6;

/** Where each is left, and how often a container there holds one. Rolled from the town's seed alone. */
export const FIREWORK_ODDS: Partial<Record<Container['buildingKind'], number>> = { garage: 0.3, warehouse: 0.2, diner: 0.12 };
export const FOUNTAIN_ODDS: Partial<Record<Container['buildingKind'], number>> = { police: 0.25, garage: 0.12 };
export const CAR_FOUNTAIN_ODDS = 0.1;
const STASH_SALT = 0x464c4152;

export type Stash = 'firework' | 'fountain';

export interface SpinnerState {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly ownerId: EntityId;
  left: number;
  noiseLeft: number;
}

export interface LureState {
  readonly x: number;
  readonly y: number;
  /** Who lit it, for kills its sparks earn. Null for the supply drop's flare. */
  readonly ownerId: EntityId | null;
  /** How close a zombie must get to catch from it. Nothing for the drop's flare. */
  readonly sparks: number;
  left: number;
  noiseLeft: number;
}

/**
 * What a container hides besides its loot: a spinner or a fountain, or nothing. Picked from the town's seed and
 * the container's place in the list on a generator of its own, so the simulation's rolls never move.
 */
export function stashIn(seed: number, container: Container): Stash | null {
  const isBowl = container.kind === 'bowl';
  if (isBowl) return null;
  const rng = createRng((seed ^ STASH_SALT ^ Math.imul(container.id + 1, 0x9e3779b1)) >>> 0);
  const roll = rng();
  const fountainOdds = container.kind === 'car' ? CAR_FOUNTAIN_ODDS : FOUNTAIN_ODDS[container.buildingKind] ?? 0;
  const isFountain = roll < fountainOdds;
  if (isFountain) return 'fountain';
  const fireworkOdds = FIREWORK_ODDS[container.buildingKind] ?? 0;
  return roll < fountainOdds + fireworkOdds ? 'firework' : null;
}

/** The searcher takes it if they have room; otherwise it stays where it was, and the container is searched all the same. */
export function takeStash(p: PlayerState, stash: Stash | null): Stash | null {
  const takesFirework = stash === 'firework' && p.fireworks < FIREWORK_CARRY && roomFor(p, 'firework');
  if (takesFirework) {
    p.fireworks += 1;
    return stash;
  }
  const takesFountain = stash === 'fountain' && p.fountains < FOUNTAIN_CARRY && roomFor(p, 'fountain');
  if (takesFountain) {
    p.fountains += 1;
    return stash;
  }
  return null;
}

/** A spinner or fountain asked for this tick. The bottle's own throw runs first and shares the cooldown. */
export function updateThrowables(sim: SimState, p: PlayerState): void {
  const wantsSpinner = p.spinnerQueued;
  const wantsFountain = p.fountainQueued;
  p.spinnerQueued = false;
  p.fountainQueued = false;
  const isCoolingDown = p.throwCooldown > 0;
  if (isCoolingDown) return;
  const canSpinner = wantsSpinner && p.fireworks > 0;
  const canFountain = !canSpinner && wantsFountain && p.fountains > 0;
  if (canSpinner) lightSpinner(sim, p);
  if (canFountain) lightFountain(sim, p);
}

function lightSpinner(sim: SimState, p: PlayerState): void {
  p.fireworks -= 1;
  p.throwCooldown = THROW_COOLDOWN_SEC;
  const boomDist = 1 + (BOOM_DISTANCE_SCALE - 1) * sugarOf(p, 'boom_drops');
  const boomRad = 1 + (BOOM_RADIUS_SCALE - 1) * sugarOf(p, 'boom_drops');
  const spot = landingSpot(sim, p, SPINNER_RANGE * boomDist);
  const sec = SPINNER_SEC * (hasKeepsake(p, 'lighter') ? LIGHTER_SPIN : 1);
  const radius = SPINNER_RADIUS * (1 + POPPING_REACH * sugarOf(p, 'popping_eyeballs')) * boomRad;
  sim.spinners.push({ x: spot.x, y: spot.y, radius, ownerId: p.id, left: sec, noiseLeft: SPARK_NOISE_SEC });
  makeNoise(sim, spot.x, spot.y, SPINNER_NOISE_RADIUS);
  emit(sim, { type: 'spinner_lit', playerId: p.id, x: spot.x, y: spot.y, fromX: p.x, fromY: p.y, radius, sec });
}

function lightFountain(sim: SimState, p: PlayerState): void {
  p.fountains -= 1;
  p.throwCooldown = THROW_COOLDOWN_SEC;
  const boomDist = 1 + (BOOM_DISTANCE_SCALE - 1) * sugarOf(p, 'boom_drops');
  const spot = landingSpot(sim, p, FOUNTAIN_RANGE * boomDist);
  sim.lures.push({ x: spot.x, y: spot.y, ownerId: p.id, sparks: FOUNTAIN_SPARK_RADIUS, left: FOUNTAIN_SEC, noiseLeft: 0 });
  emit(sim, { type: 'fountain_lit', playerId: p.id, x: spot.x, y: spot.y, fromX: p.x, fromY: p.y, sec: FOUNTAIN_SEC });
}

const caught: ZombieState[] = [];

function sparkSpinner(sim: SimState, spinner: SpinnerState, burnPlayers: boolean): void {
  caught.length = 0;
  sim.grid.query(spinner.x, spinner.y, spinner.radius, caught);
  for (const z of caught) {
    const inside = z.health > 0 && Math.hypot(z.x - spinner.x, z.y - spinner.y) <= spinner.radius + z.radius;
    if (inside) igniteZombie(sim, z, spinner.ownerId);
  }
  if (!burnPlayers) return;
  for (const p of sim.players) {
    const inside = p.status === 'alive' && Math.hypot(p.x - spinner.x, p.y - spinner.y) <= spinner.radius;
    if (inside) hurtPlayer(sim, p, SPARK_PLAYER_DAMAGE);
  }
}

/** Sets alight every zombie that has reached a fountain. */
function sparkFountain(sim: SimState, lure: LureState): void {
  caught.length = 0;
  sim.grid.query(lure.x, lure.y, lure.sparks, caught);
  for (const z of caught) {
    const reached = z.health > 0 && Math.hypot(z.x - lure.x, z.y - lure.y) <= lure.sparks + z.radius;
    if (reached) igniteZombie(sim, z, lure.ownerId);
  }
}

/** Every spinner, fountain and flare in town, burning down. Runs once a tick, after the players. */
export function updateSpinners(sim: SimState): void {
  const playerPulse = sim.tick % Math.round(SPARK_PLAYER_SEC / TICK_DT) === 0;
  for (const spinner of sim.spinners) {
    spinner.left -= TICK_DT;
    spinner.noiseLeft -= TICK_DT;
    const isDueToCrackle = spinner.noiseLeft <= 1e-9;
    if (isDueToCrackle) {
      spinner.noiseLeft += SPARK_NOISE_SEC;
      makeNoise(sim, spinner.x, spinner.y, SPARK_NOISE_RADIUS);
    }
    sparkSpinner(sim, spinner, playerPulse);
  }
  sim.spinners = sim.spinners.filter((spinner) => spinner.left > 1e-9);
  for (const lure of sim.lures) {
    lure.left -= TICK_DT;
    lure.noiseLeft -= TICK_DT;
    const isDueToHiss = lure.noiseLeft <= 1e-9;
    if (isDueToHiss) {
      lure.noiseLeft += LURE_NOISE_SEC;
      makeNoise(sim, lure.x, lure.y, LURE_NOISE_RADIUS);
    }
    const throwsSparks = lure.sparks > 0;
    if (throwsSparks) sparkFountain(sim, lure);
  }
  sim.lures = sim.lures.filter((lure) => lure.left > 1e-9);
}
