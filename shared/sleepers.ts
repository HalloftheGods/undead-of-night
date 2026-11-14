import { SLEEPER_COUNT, SLEEPER_RISE_SEC, SLEEPER_WAKE_CHANCE, SLEEPER_WAKE_RANGE, ZOMBIE_LOSE_INTEREST_SEC, ZOMBIES } from './constants.ts';
import type { Point } from './flow-field.ts';
import { randRange } from './rng.ts';
import type { PlayerState, SimState, ZombieState } from './sim-state.ts';
import { emit } from './sim-state.ts';
import { townHeight } from './storeys.ts';
import { spawnZombie } from './waves.ts';
import { buildingAt, circleHitsSolid, isBlockedAt } from './world-query.ts';

const SPOT_TRIES = 60;

function streetSpot(sim: SimState): Point | null {
  const spot = { x: randRange(sim.rng, 0, sim.map.width), y: randRange(sim.rng, 0, townHeight(sim.map)) };
  const outside = buildingAt(sim.map, spot.x, spot.y) === null;
  const open = outside && !isBlockedAt(sim.map, spot.x, spot.y) && !circleHitsSolid(sim.map, spot.x, spot.y, ZOMBIES.walker.radius + 1);
  return open ? spot : null;
}

/**
 * Leaves dead people lying about the streets. Each is a walker that does nothing until a survivor
 * comes close or something makes a noise, then gets up and hunts. `allowed` keeps the spawn clear.
 */
export function placeSleepers(sim: SimState, allowed: (spot: Point) => boolean): void {
  let placed = 0;
  for (let attempt = 0; attempt < SPOT_TRIES && placed < SLEEPER_COUNT; attempt++) {
    const spot = streetSpot(sim);
    if (!spot || !allowed(spot)) continue;
    spawnZombie(sim, 'walker', spot.x, spot.y);
    const body = sim.zombies[sim.zombies.length - 1];
    body.dormant = true;
    body.angle = randRange(sim.rng, 0, Math.PI * 2);
    placed += 1;
  }
}

/** Gets up where it lay, stands a moment, and then goes for the living. */
export function riseSleeper(sim: SimState, z: ZombieState): void {
  delete z.dormant;
  z.gettingUp = true;
  z.recoveryLeft = SLEEPER_RISE_SEC;
  z.mode = 'hunt';
  z.interestLeft = ZOMBIE_LOSE_INTEREST_SEC;
  emit(sim, { type: 'zombie_alert', zombieId: z.id, zombieType: z.type, x: z.x, y: z.y });
}

/** A survivor close by may wake it: a chance each tick, so walking past quickly is a gamble. */
export function stirSleeper(sim: SimState, z: ZombieState, players: readonly PlayerState[]): void {
  const reach = SLEEPER_WAKE_RANGE * SLEEPER_WAKE_RANGE;
  const near = players.some((p) => (p.x - z.x) ** 2 + (p.y - z.y) ** 2 <= reach);
  if (near && sim.rng() < SLEEPER_WAKE_CHANCE) riseSleeper(sim, z);
}
