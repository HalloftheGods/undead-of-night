import { TICK_RATE } from './constants.ts';
import { damageZombie } from './combat.ts';
import type { EntityId } from './protocol.ts';
import { emit } from './sim-state.ts';
import type { SimState, VehicleState, ZombieState } from './sim-state.ts';
import { capsuleCentres, VEHICLE_TOP_SPEED } from './vehicle-physics.ts';
import { VEHICLE_BODIES } from './vehicle-bodies.ts';

/** Speed at and above which a car hurts what it touches; below it, it only shoves. */
export const MIN_ROADKILL_SPEED = 75;
/** Damage at the slowest hit and at top speed; it rises linearly between. */
export const ROADKILL_DAMAGE_MIN = 60;
export const ROADKILL_DAMAGE_MAX = 220;
/** Share of its speed a car keeps after hitting one body; a boss costs it half. */
export const ROADKILL_SPEED_KEPT = 0.85;
export const BOSS_SPEED_KEPT = 0.5;
/** Seconds before the same car can hit the same zombie again. */
export const ROADKILL_REHIT_SEC = 0.4;
/** Extra knock, px/s, along the travel direction on a hit. */
const ROADKILL_KNOCK = 240;
/** Sideways knock, px/s, for a zombie nudged out of a slow car's path. */
const SHOVE_KNOCK = 60;
const MIN_MOVING_SPEED = 5;

const lastHit = new WeakMap<VehicleState, Map<number, number>>();

function hitLog(car: VehicleState, tick: number): Map<number, number> {
  const log = lastHit.get(car) ?? new Map<number, number>();
  for (const [id, at] of log) if (tick - at >= ROADKILL_REHIT_SEC * TICK_RATE) log.delete(id);
  lastHit.set(car, log);
  return log;
}

/** Whether the zombie's body touches either end of the car's capsule. */
function touches(car: VehicleState, z: ZombieState): boolean {
  const reach = VEHICLE_BODIES[car.body].radius + z.radius;
  return capsuleCentres(car.body, car.x, car.y, car.heading).some((c) => Math.hypot(z.x - c.x, z.y - c.y) <= reach);
}

function damageFor(speed: number): number {
  const span = VEHICLE_TOP_SPEED - MIN_ROADKILL_SPEED;
  const share = Math.min(1, Math.max(0, (Math.abs(speed) - MIN_ROADKILL_SPEED) / span));
  return ROADKILL_DAMAGE_MIN + (ROADKILL_DAMAGE_MAX - ROADKILL_DAMAGE_MIN) * share;
}

/** One blow: damage by speed, a shove along the travel direction, the car slowed. A boss is hurt but never killed outright. */
function runOver(sim: SimState, car: VehicleState, z: ZombieState, driver: EntityId): void {
  const isBoss = z.bossState !== undefined;
  const travel = car.speed >= 0 ? car.heading : car.heading + Math.PI;
  const damage = isBoss ? Math.min(damageFor(car.speed), z.health - 1) : damageFor(car.speed);
  const strength = Math.abs(car.speed) / VEHICLE_TOP_SPEED;
  damageZombie(sim, z, damage, travel, driver);
  z.knockX += Math.cos(travel) * ROADKILL_KNOCK;
  z.knockY += Math.sin(travel) * ROADKILL_KNOCK;
  car.speed *= isBoss ? BOSS_SPEED_KEPT : ROADKILL_SPEED_KEPT;
  emit(sim, { type: 'vehicle_hit', vehicle: car.id, x: z.x, y: z.y, strength, kill: z.health <= 0 });
}

/** A slow car nudges a zombie out of its path: sideways, no damage, no event. */
function nudge(car: VehicleState, z: ZombieState): void {
  const across = Math.cos(car.heading) * (z.y - car.y) - Math.sin(car.heading) * (z.x - car.x);
  const side = across >= 0 ? 1 : -1;
  z.knockX = -Math.sin(car.heading) * SHOVE_KNOCK * side;
  z.knockY = Math.cos(car.heading) * SHOVE_KNOCK * side;
}

/** A driven car going fast enough hurts every zombie it touches, credited to its driver; a slow one shoves them aside. */
export function checkVehicleRoadkill(sim: SimState, car: VehicleState, driver: EntityId): void {
  const isMoving = Math.abs(car.speed) >= MIN_MOVING_SPEED;
  if (!isMoving) return;
  const log = hitLog(car, sim.tick);
  for (const z of sim.zombies) {
    const isAlive = z.health > 0;
    if (!isAlive || !touches(car, z)) continue;
    const isFast = Math.abs(car.speed) >= MIN_ROADKILL_SPEED;
    if (!isFast) {
      nudge(car, z);
      continue;
    }
    const isRecent = log.has(z.id);
    if (isRecent) continue;
    log.set(z.id, sim.tick);
    runOver(sim, car, z, driver);
  }
}
