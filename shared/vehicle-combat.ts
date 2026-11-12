import { damageZombie } from './combat.ts';
import type { EntityId } from './protocol.ts';
import type { SimState, VehicleState } from './sim-state.ts';

export const MIN_ROADKILL_SPEED = 75;
export const ROADKILL_DAMAGE = 180;
const ROADKILL_HIT_RADIUS = 26;

/** A driven car going fast enough hurts every zombie it touches, credited to its driver. */
export function checkVehicleRoadkill(sim: SimState, car: VehicleState, driver: EntityId): void {
  const isSpeedSufficient = Math.abs(car.speed) >= MIN_ROADKILL_SPEED;
  if (!isSpeedSufficient) return;

  for (const z of sim.zombies) {
    const isAlive = z.health > 0;
    if (!isAlive) continue;

    const distance = Math.hypot(z.x - car.x, z.y - car.y);
    const isContact = distance <= ROADKILL_HIT_RADIUS + z.radius;
    if (!isContact) continue;

    damageZombie(sim, z, ROADKILL_DAMAGE, car.heading, driver);
  }
}
