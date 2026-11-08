import { hasKeepsake, LIGHTER_SPIN } from './keepsakes.ts';
// Fireworks and flares: two throws besides the bottle, both found in town and both left behind
// when the town is. A firework is lit and tossed, and lands as a ground spinner: a flower of sparks
// whirling on the street that sets alight whatever walks through it.

import { landingSpot } from './bottles.ts';
import { sugarOf } from './candy.ts';
import { TICK_DT } from './constants.ts';
import type { Container } from './containers.ts';
import { hurtPlayer } from './player-health.ts';
import type { EntityId } from './protocol.ts';
import { createRng } from './rng.ts';
import type { PlayerState, SimState, ZombieState } from './sim-state.ts';
import { emit } from './sim-state.ts';
import { igniteZombie } from './zombie-status.ts';
import { makeNoise } from './zombie-senses.ts';

/** Most fireworks and flares a survivor carries. */
export const FIREWORK_CARRY = 2;
export const FLARE_CARRY = 2;

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

/** A flare lands where it is thrown and burns red for this long, hissing loud enough to draw a crowd. */
export const FLARE_RANGE = 190;
export const FLARE_SEC = 20;
export const FLARE_NOISE_RADIUS = 260;
export const FLARE_NOISE_SEC = 1.5;

/** Shared with the bottle, so the three throws cannot be chained in one breath. */
export const THROW_COOLDOWN_SEC = 0.6;

/** Where each is left, and how often a container there holds one. Rolled from the town's seed alone. */
export const FIREWORK_ODDS: Partial<Record<Container['buildingKind'], number>> = { garage: 0.3, warehouse: 0.2, diner: 0.12 };
export const FLARE_ODDS: Partial<Record<Container['buildingKind'], number>> = { police: 0.25, garage: 0.12 };
export const CAR_FLARE_ODDS = 0.1;
const STASH_SALT = 0x464c4152;

export type Stash = 'firework' | 'flare';

export interface SpinnerState {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly ownerId: EntityId;
  left: number;
  noiseLeft: number;
}

export interface FlareState {
  readonly x: number;
  readonly y: number;
  left: number;
  noiseLeft: number;
}

/**
 * What a container hides besides its loot: a firework or a flare, or nothing. Picked from the town's seed and
 * the container's place in the list on a generator of its own, so the simulation's rolls never move.
 */
export function stashIn(seed: number, container: Container): Stash | null {
  const rng = createRng((seed ^ STASH_SALT ^ Math.imul(container.id + 1, 0x9e3779b1)) >>> 0);
  const roll = rng();
  const flareOdds = container.kind === 'car' ? CAR_FLARE_ODDS : FLARE_ODDS[container.buildingKind] ?? 0;
  const isFlare = roll < flareOdds;
  if (isFlare) return 'flare';
  const fireworkOdds = FIREWORK_ODDS[container.buildingKind] ?? 0;
  return roll < flareOdds + fireworkOdds ? 'firework' : null;
}

/** The searcher takes it if they have room; otherwise it stays where it was, and the container is searched all the same. */
export function takeStash(p: PlayerState, stash: Stash | null): Stash | null {
  const takesFirework = stash === 'firework' && p.fireworks < FIREWORK_CARRY;
  if (takesFirework) {
    p.fireworks += 1;
    return stash;
  }
  const takesFlare = stash === 'flare' && p.flares < FLARE_CARRY;
  if (takesFlare) {
    p.flares += 1;
    return stash;
  }
  return null;
}

/** A spinner or flare asked for this tick. The bottle's own throw runs first and shares the cooldown. */
export function updateThrowables(sim: SimState, p: PlayerState): void {
  const wantsSpinner = p.spinnerQueued;
  const wantsFlare = p.flareQueued;
  p.spinnerQueued = false;
  p.flareQueued = false;
  const isCoolingDown = p.throwCooldown > 0;
  if (isCoolingDown) return;
  const canSpinner = wantsSpinner && p.fireworks > 0;
  const canFlare = !canSpinner && wantsFlare && p.flares > 0;
  if (canSpinner) lightSpinner(sim, p);
  if (canFlare) throwFlare(sim, p);
}

function lightSpinner(sim: SimState, p: PlayerState): void {
  p.fireworks -= 1;
  p.throwCooldown = THROW_COOLDOWN_SEC;
  const spot = landingSpot(sim, p, SPINNER_RANGE);
  const sec = SPINNER_SEC * (hasKeepsake(p, 'lighter') ? LIGHTER_SPIN : 1);
  const radius = SPINNER_RADIUS * (1 + POPPING_REACH * sugarOf(p, 'popping_eyeballs'));
  sim.spinners.push({ x: spot.x, y: spot.y, radius, ownerId: p.id, left: sec, noiseLeft: SPARK_NOISE_SEC });
  makeNoise(sim, spot.x, spot.y, SPINNER_NOISE_RADIUS);
  emit(sim, { type: 'spinner_lit', playerId: p.id, x: spot.x, y: spot.y, fromX: p.x, fromY: p.y, radius, sec });
}

function throwFlare(sim: SimState, p: PlayerState): void {
  p.flares -= 1;
  p.throwCooldown = THROW_COOLDOWN_SEC;
  const spot = landingSpot(sim, p, FLARE_RANGE);
  sim.flares.push({ x: spot.x, y: spot.y, left: FLARE_SEC, noiseLeft: 0 });
  emit(sim, { type: 'flare_lit', playerId: p.id, x: spot.x, y: spot.y, fromX: p.x, fromY: p.y, sec: FLARE_SEC });
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

/** Every spinner and every flare in town, burning down. Runs once a tick, after the players. */
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
  for (const flare of sim.flares) {
    flare.left -= TICK_DT;
    flare.noiseLeft -= TICK_DT;
    const isDueToHiss = flare.noiseLeft <= 1e-9;
    if (isDueToHiss) {
      flare.noiseLeft += FLARE_NOISE_SEC;
      makeNoise(sim, flare.x, flare.y, FLARE_NOISE_RADIUS);
    }
  }
  sim.flares = sim.flares.filter((flare) => flare.left > 1e-9);
}
