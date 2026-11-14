// Moving cars through the sim: the driver's stick each tick, and any car nobody drives coasting to rest.

import { TICK_DT } from './constants.ts';
import { doorBlocksCircle } from './doors.ts';
import type { PlayerState, SimState, VehicleState } from './sim-state.ts';
import { emit } from './sim-state.ts';
import { groundSpeedScale } from './town-rules.ts';
import { checkVehicleRoadkill } from './vehicle-combat.ts';
import { carBlockedAt } from './vehicle-footprint.ts';
import { carSounds, honk } from './vehicle-feel.ts';
import { isResting } from './vehicle-choice.ts';
import { stepVehicle, VEHICLE_TOP_SPEED } from './vehicle-physics.ts';
import type { Blocked } from './vehicle-physics.ts';
import { carryOccupants, ejectFallen, restVehicle, unparkVehicle, vehicleOf } from './vehicles.ts';

/** Speed lost against a solid in one tick that is heard as a crash rather than a scrape. */
export const CRASH_EVENT_SPEED = 60;

/** What a car cannot drive into: see carBlockedAt, with the sim's doors. */
export function roadBlocked(sim: SimState): Blocked {
  return (x, y, r) => carBlockedAt(sim.map, x, y, r, (dx, dy, dr) => doorBlocksCircle(sim, dx, dy, dr));
}

/** One tick of motion, then whoever sits in it comes along; a car that has come to a stop is a solid again. */
function roll(sim: SimState, car: VehicleState, dirX: number, dirY: number): void {
  const paceScale = groundSpeedScale(sim.level, sim.map, car.x, car.y, sim.drained);
  const step = stepVehicle(car, car.body, dirX, dirY, TICK_DT, roadBlocked(sim), paceScale);
  car.x = step.x;
  car.y = step.y;
  car.heading = step.heading;
  car.speed = step.speed;
  car.facing = step.facing;
  const crashed = step.crash >= CRASH_EVENT_SPEED;
  if (crashed) emit(sim, { type: 'vehicle_crash', vehicle: car.id, x: car.x, y: car.y, strength: step.crash / VEHICLE_TOP_SPEED });
  if (isResting(car)) restVehicle(sim, car);
  carryOccupants(sim, car);
}

/**
 * The driver's held keys work the car they sit at the wheel of: up and down are the pedals, left and right the wheel.
 * A parked car only stirs once a pedal is down, since the wheel alone moves nothing.
 */
export function driveVehicle(sim: SimState, p: PlayerState): void {
  const car = vehicleOf(sim, p);
  const atTheWheel = car !== null && p.vehicle?.seat === 0;
  if (!car || !atTheWheel) return;
  honk(sim, car, p);
  const dirX = Number(p.right) - Number(p.left);
  const dirY = Number(p.down) - Number(p.up);
  const hasPedal = dirY !== 0;
  const parked = isResting(car);
  if (parked && !hasPedal) return;
  if (parked) unparkVehicle(sim, car);
  roll(sim, car, dirX, dirY);
  checkVehicleRoadkill(sim, car, p.id);
}

/** Once a tick, after everyone has moved: fallen occupants are put out, and cars with nobody at the wheel coast to rest. */
export function updateVehicles(sim: SimState): void {
  ejectFallen(sim);
  for (const car of sim.vehicles.values()) {
    carSounds(sim, car);
    const coasting = car.seats[0] === null && !isResting(car);
    if (coasting) roll(sim, car, 0, 0);
  }
}
