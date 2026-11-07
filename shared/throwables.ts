import { hasKeepsake, LIGHTER_FIRE } from './keepsakes.ts';
// Molotovs and flares: two throws besides the bottle, both found in town and both left behind
// when the town is. A molotov is a bottle with fuel in it, so it spends one of each.

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

/** Most fuel and flares a survivor carries. */
export const FUEL_CARRY = 2;
export const FLARE_CARRY = 2;

/** A molotov flies a little short of a bottle and leaves a pool of fire this wide for this long. */
export const MOLOTOV_RANGE = 150;
export const FIRE_RADIUS = 30;
export const FIRE_SEC = 5;
/** The smash and the whoomp are heard this far off; the flames crackle on every so often. */
export const MOLOTOV_NOISE_RADIUS = 240;
export const FIRE_NOISE_SEC = 1;
export const FIRE_NOISE_RADIUS = 140;
/** Anyone standing in it, survivors included, is burnt this much this often. */
export const FIRE_PLAYER_DAMAGE = 4;
export const FIRE_PLAYER_SEC = 0.5;

/** A flare lands where it is thrown and burns red for this long, hissing loud enough to draw a crowd. */
export const FLARE_RANGE = 190;
export const FLARE_SEC = 20;
export const FLARE_NOISE_RADIUS = 260;
export const FLARE_NOISE_SEC = 1.5;

/** Shared with the bottle, so the three throws cannot be chained in one breath. */
export const THROW_COOLDOWN_SEC = 0.6;

/** Where each is left, and how often a container there holds one. Rolled from the town's seed alone. */
const FUEL_ODDS: Partial<Record<Container['buildingKind'], number>> = { garage: 0.3, warehouse: 0.2, diner: 0.12 };
const FLARE_ODDS: Partial<Record<Container['buildingKind'], number>> = { police: 0.25, garage: 0.12 };
const CAR_FLARE_ODDS = 0.1;
const STASH_SALT = 0x464c4152;

export type Stash = 'fuel' | 'flare';

export interface FireState {
  readonly x: number;
  readonly y: number;
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
 * What a container hides besides its loot: fuel or a flare, or nothing. Picked from the town's seed and
 * the container's place in the list on a generator of its own, so the simulation's rolls never move.
 */
export function stashIn(seed: number, container: Container): Stash | null {
  const rng = createRng((seed ^ STASH_SALT ^ Math.imul(container.id + 1, 0x9e3779b1)) >>> 0);
  const roll = rng();
  const flareOdds = container.kind === 'car' ? CAR_FLARE_ODDS : FLARE_ODDS[container.buildingKind] ?? 0;
  const isFlare = roll < flareOdds;
  if (isFlare) return 'flare';
  const fuelOdds = FUEL_ODDS[container.buildingKind] ?? 0;
  return roll < flareOdds + fuelOdds ? 'fuel' : null;
}

/** The searcher takes it if they have room; otherwise it stays where it was, and the container is searched all the same. */
export function takeStash(p: PlayerState, stash: Stash | null): Stash | null {
  const takesFuel = stash === 'fuel' && p.fuel < FUEL_CARRY;
  if (takesFuel) {
    p.fuel += 1;
    return stash;
  }
  const takesFlare = stash === 'flare' && p.flares < FLARE_CARRY;
  if (takesFlare) {
    p.flares += 1;
    return stash;
  }
  return null;
}

/** A molotov or flare asked for this tick. The bottle's own throw runs first and shares the cooldown. */
export function updateThrowables(sim: SimState, p: PlayerState): void {
  const wantsMolotov = p.molotovQueued;
  const wantsFlare = p.flareQueued;
  p.molotovQueued = false;
  p.flareQueued = false;
  const isCoolingDown = p.throwCooldown > 0;
  if (isCoolingDown) return;
  const fuelled = p.fuel > 0 || sugarOf(p, 'popping_eyeballs') > 0;
  const canMolotov = wantsMolotov && fuelled && p.bottles > 0;
  const canFlare = !canMolotov && wantsFlare && p.flares > 0;
  if (canMolotov) throwMolotov(sim, p);
  if (canFlare) throwFlare(sim, p);
}

function throwMolotov(sim: SimState, p: PlayerState): void {
  // Popping Eyeballs light the bottle without spending fuel.
  const free = sugarOf(p, 'popping_eyeballs') > 0;
  if (!free) p.fuel -= 1;
  p.bottles -= 1;
  p.throwCooldown = THROW_COOLDOWN_SEC;
  const spot = landingSpot(sim, p, MOLOTOV_RANGE);
  const sec = FIRE_SEC * (hasKeepsake(p, 'lighter') ? LIGHTER_FIRE : 1);
  sim.fires.push({ x: spot.x, y: spot.y, ownerId: p.id, left: sec, noiseLeft: FIRE_NOISE_SEC });
  makeNoise(sim, spot.x, spot.y, MOLOTOV_NOISE_RADIUS);
  emit(sim, { type: 'molotov_burst', playerId: p.id, x: spot.x, y: spot.y, fromX: p.x, fromY: p.y, radius: FIRE_RADIUS, sec });
}

function throwFlare(sim: SimState, p: PlayerState): void {
  p.flares -= 1;
  p.throwCooldown = THROW_COOLDOWN_SEC;
  const spot = landingSpot(sim, p, FLARE_RANGE);
  sim.flares.push({ x: spot.x, y: spot.y, left: FLARE_SEC, noiseLeft: 0 });
  emit(sim, { type: 'flare_lit', playerId: p.id, x: spot.x, y: spot.y, fromX: p.x, fromY: p.y, sec: FLARE_SEC });
}

const caught: ZombieState[] = [];

function burnPool(sim: SimState, fire: FireState, burnPlayers: boolean): void {
  caught.length = 0;
  sim.grid.query(fire.x, fire.y, FIRE_RADIUS, caught);
  for (const z of caught) {
    const inside = z.health > 0 && Math.hypot(z.x - fire.x, z.y - fire.y) <= FIRE_RADIUS + z.radius;
    if (inside) igniteZombie(sim, z, fire.ownerId);
  }
  if (!burnPlayers) return;
  for (const p of sim.players) {
    const inside = p.status === 'alive' && Math.hypot(p.x - fire.x, p.y - fire.y) <= FIRE_RADIUS;
    if (inside) hurtPlayer(sim, p, FIRE_PLAYER_DAMAGE);
  }
}

/** Every pool of fire and every flare in town, burning down. Runs once a tick, after the players. */
export function updateFires(sim: SimState): void {
  const playerPulse = sim.tick % Math.round(FIRE_PLAYER_SEC / TICK_DT) === 0;
  for (const fire of sim.fires) {
    fire.left -= TICK_DT;
    fire.noiseLeft -= TICK_DT;
    const isDueToCrackle = fire.noiseLeft <= 1e-9;
    if (isDueToCrackle) {
      fire.noiseLeft += FIRE_NOISE_SEC;
      makeNoise(sim, fire.x, fire.y, FIRE_NOISE_RADIUS);
    }
    burnPool(sim, fire, playerPulse);
  }
  sim.fires = sim.fires.filter((fire) => fire.left > 1e-9);
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
