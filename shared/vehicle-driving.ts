// Moving cars through the sim: the driver's stick each tick, and any car nobody drives coasting to rest.

import { TICK_DT } from './constants.ts';
import { doorBlocksCircle } from './doors.ts';
import type { PlayerState, SimState, VehicleState } from './sim-state.ts';
import { emit } from './sim-state.ts';
import { groundSpeedScale } from './town-rules.ts';
import { checkVehicleRoadkill } from './vehicle-combat.ts';
import { isResting } from './vehicle-choice.ts';
import { stepVehicle, VEHICLE_TOP_SPEED } from './vehicle-physics.ts';
import type { Blocked } from './vehicle-physics.ts';
import { carryOccupants, ejectFallen, restVehicle, unparkVehicle, vehicleOf } from './vehicles.ts';
import { buildingAt, circleHitsSolid } from './world-query.ts';
import type { WorldMap } from './protocol.ts';

/** Speed lost against a solid in one tick that is heard as a crash rather than a scrape. */
export const CRASH_EVENT_SPEED = 60;

/** Any of the circle's edge points inside a building's footprint: a car never noses into a house, even through its door. */
function touchesBuilding(map: WorldMap, x: number, y: number, r: number): boolean {
  const atCentre = buildingAt(map, x, y) !== null;
  const atSide = buildingAt(map, x - r, y) !== null || buildingAt(map, x + r, y) !== null;
  return atCentre || atSide || buildingAt(map, x, y - r) !== null || buildingAt(map, x, y + r) !== null;
}

/** What a car cannot drive into: the map's solids, closed doors, the map's edge and every building's footprint. */
export function roadBlocked(sim: SimState): Blocked {
  const { map } = sim;
  return (x, y, r) => {
    const offMap = x < r || y < r || x > map.width - r || y > map.height - r;
    if (offMap) return true;
    return touchesBuilding(map, x, y, r) || circleHitsSolid(map, x, y, r) || doorBlocksCircle(sim, x, y, r);
  };
}

/** One tick of motion, then whoever sits in it comes along; a car that has come to a stop is a solid again. */
function roll(sim: SimState, car: VehicleState, dirX: number, dirY: number): void {
  const paceScale = groundSpeedScale(sim.level, sim.map, car.x, car.y);
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

/** The driver's held keys steer the car they sit at the wheel of. A parked car only stirs once a key is down. */
export function driveVehicle(sim: SimState, p: PlayerState): void {
  const car = vehicleOf(sim, p);
  const atTheWheel = car !== null && p.vehicle?.seat === 0;
  if (!car || !atTheWheel) return;
  const dirX = Number(p.right) - Number(p.left);
  const dirY = Number(p.down) - Number(p.up);
  const hasInput = dirX !== 0 || dirY !== 0;
  const parked = isResting(car);
  if (parked && !hasInput) return;
  if (parked) unparkVehicle(sim, car);
  roll(sim, car, dirX, dirY);
  checkVehicleRoadkill(sim, car, p.id);
}

/** Once a tick, after everyone has moved: fallen occupants are put out, and cars with nobody at the wheel coast to rest. */
export function updateVehicles(sim: SimState): void {
  ejectFallen(sim);
  for (const car of sim.vehicles.values()) {
    const coasting = car.seats[0] === null && !isResting(car);
    if (coasting) roll(sim, car, 0, 0);
  }
}
