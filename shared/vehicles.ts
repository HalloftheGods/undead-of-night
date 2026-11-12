// Cars as bodies of their own: made the first time someone gets into a parked one, then kept for the
// town. Getting in and out, who sits where, and the solid a car is while it stands still.

import { PLAYER_RADIUS, TICK_DT } from './constants.ts';
import { stopSearch } from './container-search.ts';
import { DOOR_TAP_SEC, doorBlocksCircle } from './doors.ts';
import type { PlayerState, SimState, VehicleState, ZombieState } from './sim-state.ts';
import { emit } from './sim-state.ts';
import { FACING_HEADING, VEHICLE_BODIES } from './vehicle-bodies.ts';
import { driveableProps, isResting, restBoxOf, vehicleChoiceAt } from './vehicle-choice.ts';
import { buildingAt, circleHitsSolid, liftProp, restoreSolids, setSolid } from './world-query.ts';
import type { Box } from './world-query.ts';

/** What a car can take before it is done for. Durability itself comes later; every car starts whole. */
export const VEHICLE_HEALTH = 300;
/** Daylight between a car's side and someone stepping out of it. */
const EXIT_GAP = 2;

interface Spot {
  readonly x: number;
  readonly y: number;
}

/** The sim's cars as the shared rules in `vehicle-choice.ts` read them. */
export const carsOf = (sim: SimState): VehicleState[] => [...sim.vehicles.values()];

/** The car someone sits in, or null on foot. */
export function vehicleOf(sim: SimState, p: PlayerState): VehicleState | null {
  return p.vehicle ? sim.vehicles.get(p.vehicle.id) ?? null : null;
}

const solidKey = (car: VehicleState): string => `vehicle:${car.id}`;

/** The chase field routes round solids, so it has to be worked out again whenever one comes or goes. */
function solidsChanged(sim: SimState): void {
  sim.flow.invalidate();
}

/** A rolling car is no solid: it is the one doing the colliding. */
export function unparkVehicle(sim: SimState, car: VehicleState): void {
  setSolid(sim.map, solidKey(car), null);
  solidsChanged(sim);
}

/** A parked car on the map becomes a car of its own, standing exactly where it was parked. */
function takeOverParked(sim: SimState, id: number): VehicleState | null {
  const parked = driveableProps(sim.map).find((candidate) => candidate.id === id);
  if (!parked) return null;
  const { body, facing } = parked.parked;
  const car: VehicleState = {
    id,
    body,
    x: parked.x,
    y: parked.y,
    heading: FACING_HEADING[facing],
    speed: 0,
    facing,
    seats: new Array<null>(VEHICLE_BODIES[body].seats).fill(null),
    health: VEHICLE_HEALTH,
    maxHealth: VEHICLE_HEALTH,
    hornLeft: 0,
  };
  sim.vehicles.set(id, car);
  liftProp(sim.map, id);
  setSolid(sim.map, solidKey(car), restBoxOf(car));
  solidsChanged(sim);
  return car;
}

const overlaps = (box: Box, x: number, y: number, r: number): boolean => {
  const dx = x - Math.max(box.x0, Math.min(x, box.x1));
  const dy = y - Math.max(box.y0, Math.min(y, box.y1));
  return dx * dx + dy * dy < r * r;
};

/** Open ground for a body of radius `r`: on the map, outdoors, and clear of every solid and closed door. */
function isOpenFor(sim: SimState, x: number, y: number, r: number): boolean {
  const onMap = x >= r && y >= r && x <= sim.map.width - r && y <= sim.map.height - r;
  const outdoors = onMap && buildingAt(sim.map, x, y) === null;
  return outdoors && !circleHitsSolid(sim.map, x, y, r) && !doorBlocksCircle(sim, x, y, r);
}

/** The nearest spot just off one of the box's four edges where a body of radius `r` fits, or null. */
function pushOutSpot(sim: SimState, box: Box, x: number, y: number, r: number): Spot | null {
  const edges: Spot[] = [
    { x: box.x0 - r - 0.5, y },
    { x: box.x1 + r + 0.5, y },
    { x, y: box.y0 - r - 0.5 },
    { x, y: box.y1 + r + 0.5 },
  ];
  const byDistance = edges.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  return byDistance.find((spot) => isOpenFor(sim, spot.x, spot.y, r)) ?? null;
}

function shove(sim: SimState, box: Box, body: PlayerState | ZombieState, r: number): void {
  if (!overlaps(box, body.x, body.y, r)) return;
  const spot = pushOutSpot(sim, box, body.x, body.y, r);
  if (!spot) return;
  body.x = spot.x;
  body.y = spot.y;
}

/**
 * The car has stopped: it is a solid again, and anyone or anything it stopped on is put off its edge.
 * With nobody at the wheel it settles square to its facing, the way the art draws a parked car.
 */
export function restVehicle(sim: SimState, car: VehicleState): void {
  car.speed = 0;
  const unattended = car.seats[0] === null;
  if (unattended) car.heading = FACING_HEADING[car.facing];
  const box = restBoxOf(car);
  setSolid(sim.map, solidKey(car), box);
  solidsChanged(sim);
  for (const p of sim.players) {
    const onFoot = p.vehicle === null && p.status !== 'dead';
    if (onFoot) shove(sim, box, p, PLAYER_RADIUS);
  }
  for (const z of sim.zombies) {
    if (z.health > 0) shove(sim, box, z, z.radius);
  }
}

/** Where someone could step out: the driver's side, the far side, behind, in front, in that order. */
function exitSpots(car: VehicleState): Spot[] {
  const def = VEHICLE_BODIES[car.body];
  const side = Math.max(def.sideDepth, def.noseWidth) / 2 + PLAYER_RADIUS + EXIT_GAP;
  const end = def.length / 2 + PLAYER_RADIUS + EXIT_GAP;
  const ahead = { x: Math.cos(car.heading), y: Math.sin(car.heading) };
  // Screen y runs down, so the left of a car heading east is north.
  const left = { x: ahead.y, y: -ahead.x };
  return [
    { x: car.x + left.x * side, y: car.y + left.y * side },
    { x: car.x - left.x * side, y: car.y - left.y * side },
    { x: car.x - ahead.x * end, y: car.y - ahead.y * end },
    { x: car.x + ahead.x * end, y: car.y + ahead.y * end },
  ];
}

function firstExit(sim: SimState, car: VehicleState): Spot | null {
  return exitSpots(car).find((spot) => isOpenFor(sim, spot.x, spot.y, PLAYER_RADIUS)) ?? null;
}

/** Out of the seat and onto `spot`. A car left standing settles; one still rolling coasts on by itself. */
function leaveSeat(sim: SimState, p: PlayerState, car: VehicleState, spot: Spot): void {
  const seat = p.vehicle?.seat ?? 0;
  car.seats[seat] = null;
  p.vehicle = null;
  p.x = spot.x;
  p.y = spot.y;
  p.moving = false;
  p.vehicleHold = 0;
  emit(sim, { type: 'vehicle_exit', vehicle: car.id, playerId: p.id, seat, x: p.x, y: p.y });
  const leftStanding = seat === 0 && isResting(car);
  if (leftStanding) restVehicle(sim, car);
}

function getIn(sim: SimState, p: PlayerState, id: number): void {
  const car = sim.vehicles.get(id) ?? takeOverParked(sim, id);
  const driverSeatFree = car !== null && car.seats[0] === null;
  if (!car || !driverSeatFree) return;
  car.seats[0] = p.id;
  p.vehicle = { id, seat: 0 };
  p.x = car.x;
  p.y = car.y;
  p.moving = false;
  p.indoors = null;
  p.vehicleHold = 0;
  stopSearch(p);
  emit(sim, { type: 'vehicle_enter', vehicle: id, playerId: p.id, seat: 0, x: p.x, y: p.y });
}

/** The search key could still turn out to be a tap on a car, so a search waits for the tap window to pass. */
export const waitingOnTap = (p: PlayerState): boolean => p.vehicleHold > 0 && p.vehicleHold < DOOR_TAP_SEC;

/** On foot, before searching: a tap of the search key at a car gets in; a hold past the tap window is left to the search. */
export function tapToEnter(sim: SimState, p: PlayerState): void {
  const choice = p.searchSpent ? null : vehicleChoiceAt(sim.map, carsOf(sim), p.x, p.y, p);
  const canEnter = choice !== null && choice.kind === 'enter';
  if (!canEnter) {
    p.vehicleHold = 0;
    return;
  }
  if (p.searchHeld) {
    p.vehicleHold += TICK_DT;
    return;
  }
  const tapped = waitingOnTap(p);
  p.vehicleHold = 0;
  if (tapped) getIn(sim, p, choice.id);
}

/** Seated: a fresh press of the search key gets out, once the car has nearly stopped and there is somewhere to stand. */
export function pressToLeave(sim: SimState, p: PlayerState): void {
  const pressed = p.searchHeld && !p.searchSpent;
  if (!pressed) return;
  p.searchSpent = true;
  const car = vehicleOf(sim, p);
  const choice = vehicleChoiceAt(sim.map, carsOf(sim), p.x, p.y, p);
  const spot = car && choice?.kind === 'exit' ? firstExit(sim, car) : null;
  if (car && spot) leaveSeat(sim, p, car, spot);
}

/** Taken out of the seat whatever the car is doing: downed, dead or gone. They land beside it, or on it if it is boxed in. */
export function ejectOccupant(sim: SimState, p: PlayerState): void {
  const car = vehicleOf(sim, p);
  if (!car) {
    p.vehicle = null;
    return;
  }
  leaveSeat(sim, p, car, firstExit(sim, car) ?? { x: car.x, y: car.y });
}

/** Seats held by someone downed, dead or no longer in the room are emptied, so no car is ever lost with them. */
export function ejectFallen(sim: SimState): void {
  for (const car of sim.vehicles.values()) {
    car.seats.forEach((id, seat) => {
      if (id === null) return;
      const p = sim.players.find((candidate) => candidate.id === id && candidate.vehicle?.id === car.id);
      if (!p) car.seats[seat] = null;
      else if (p.status !== 'alive') ejectOccupant(sim, p);
    });
  }
}

/** Everyone in a car sits at its centre. */
export function carryOccupants(sim: SimState, car: VehicleState): void {
  for (const p of sim.players) {
    if (p.vehicle?.id !== car.id) continue;
    p.x = car.x;
    p.y = car.y;
    p.moving = !isResting(car);
  }
}

/** Nothing of the last town's cars survives a level change; their map's solids go back as built. */
export function clearVehicles(sim: SimState): void {
  sim.vehicles.clear();
  restoreSolids(sim.map);
  for (const p of [...sim.players, ...sim.departed.values()]) p.vehicle = null;
}
