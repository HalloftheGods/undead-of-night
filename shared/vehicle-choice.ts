// What the search key does around cars, worked out from the map and the cars alone, so the sim and every
// client agree on it: the sim acts on it, a client draws the prompt from the snapshot's vehicle list.

import { containerInReach } from './containers.ts';
import type { Container } from './containers.ts';
import { isBunkerMap } from './home-protocol.ts';
import type { VehicleSeat, VehicleView, WorldMap } from './protocol.ts';
import { centreOfProp, parkedVehicle, restBox } from './vehicle-bodies.ts';
import type { ParkedVehicle } from './vehicle-bodies.ts';
import { buildingAt, isLifted, isSolidProp } from './world-query.ts';
import type { Box } from './world-query.ts';

/** Gap from a survivor's centre to a car's resting footprint that still counts as at its door. */
export const VEHICLE_REACH = 14;
/** A seat is left only below this speed, so nobody steps out of a car at full tilt. */
export const EXIT_MAX_SPEED = 40;

/** What these rules read of a car: a snapshot's VehicleView, or the sim's own VehicleState. */
export type VehicleLike = Pick<VehicleView, 'id' | 'body' | 'x' | 'y' | 'facing' | 'speed' | 'seats'>;

/** Get into seat `seat` of car `id`, or get out of the seat held now. */
export type VehicleChoice =
  | { readonly kind: 'enter'; readonly id: number; readonly seat: number }
  | { readonly kind: 'exit'; readonly id: number; readonly seat: number };

/** A map prop that can be driven away, as it is parked. */
export interface ParkedCar {
  /** Its index in the map's props, which becomes the car's id. */
  readonly id: number;
  readonly parked: ParkedVehicle;
  /** Centre of its footprint. */
  readonly x: number;
  readonly y: number;
  readonly box: Box;
}

const parkedCars = new WeakMap<WorldMap, readonly ParkedCar[]>();
const testDriveMaps = new WeakSet<WorldMap>();

/** A wreck drives as a sedan body facing west, which is the footprint it already sits on. */
const WRECK_BODY: ParkedVehicle = { body: 'sedan', facing: 'w' };

/** Test Drive: every car prop on this map can be driven. The sim marks its map and a client marks the one it built. */
export function markTestDrive(map: WorldMap): void {
  testDriveMaps.add(map);
  parkedCars.delete(map);
}

export const isTestDrive = (map: WorldMap): boolean => testDriveMaps.has(map);

/** Every car parked on the map that could be driven: outdoors only (a garage car stays loot), never on the bunker map, never a wreck. Test Drive lifts the first and the last. */
export function driveableProps(map: WorldMap): readonly ParkedCar[] {
  const have = parkedCars.get(map);
  if (have) return have;
  const onBunker = isBunkerMap(map);
  const cars = onBunker
    ? []
    : map.props.flatMap((prop, id): ParkedCar[] => {
        const testDrive = testDriveMaps.has(map);
        const parked = parkedVehicle(prop.kind) ?? (testDrive && prop.kind === 'car_wreck_h' ? WRECK_BODY : null);
        const isIndoors = !testDrive && buildingAt(map, prop.x, prop.y - 1) !== null;
        const isDriveable = parked !== null && isSolidProp(prop) && !isIndoors;
        if (!isDriveable) return [];
        const centre = centreOfProp(parked, prop.x, prop.y);
        return [{ id, parked, x: centre.x, y: centre.y, box: restBox(parked.body, parked.facing, centre.x, centre.y) }];
      });
  parkedCars.set(map, cars);
  return cars;
}

/** At rest a car is a solid, has a door to open and a boot to search. */
export const isResting = (car: Pick<VehicleLike, 'speed'>): boolean => car.speed === 0;

/** The box a car covers at rest, where it is now. */
export const restBoxOf = (car: VehicleLike): Box => restBox(car.body, car.facing, car.x, car.y);

function gapTo({ x0, y0, x1, y1 }: Box, x: number, y: number): number {
  return Math.hypot(x - Math.max(x0, Math.min(x, x1)), y - Math.max(y0, Math.min(y, y1)));
}

function exitChoice(cars: readonly VehicleLike[], seat: VehicleSeat): VehicleChoice | null {
  const car = cars.find((candidate) => candidate.id === seat.id);
  const slowEnough = car !== undefined && Math.abs(car.speed) < EXIT_MAX_SPEED;
  return slowEnough ? { kind: 'exit', id: seat.id, seat: seat.seat } : null;
}

function nearestEnterable(map: WorldMap, cars: readonly VehicleLike[], x: number, y: number): VehicleChoice | null {
  let best: VehicleChoice | null = null;
  let bestGap = VEHICLE_REACH;
  const consider = (id: number, box: Box): void => {
    const gap = gapTo(box, x, y);
    if (gap > bestGap) return;
    bestGap = gap;
    best = { kind: 'enter', id, seat: 0 };
  };
  for (const car of cars) {
    const driverSeatFree = car.seats[0] === null;
    if (isResting(car) && driverSeatFree) consider(car.id, restBoxOf(car));
  }
  const taken = new Set(cars.map((car) => car.id));
  for (const parked of driveableProps(map)) {
    const stillParked = !taken.has(parked.id) && !isLifted(map, parked.id);
    if (stillParked) consider(parked.id, parked.box);
  }
  return best;
}

/**
 * What a press of the search key does for someone at x,y: get out of the car they sit in (only once it has
 * nearly stopped), or get into the driver's seat of the nearest car in reach. Null when it does neither.
 */
export function vehicleChoiceAt(
  map: WorldMap,
  cars: readonly VehicleLike[],
  x: number,
  y: number,
  player: { readonly vehicle?: VehicleSeat | null },
): VehicleChoice | null {
  if (player.vehicle) return exitChoice(cars, player.vehicle);
  const outdoors = buildingAt(map, x, y) === null || testDriveMaps.has(map);
  return outdoors ? nearestEnterable(map, cars, x, y) : null;
}

/** `containerInReach` with each driven car's boot where the car is now: at its rest box, or out of reach while it rolls. */
export function containerInReachOf(
  map: WorldMap,
  cars: readonly VehicleLike[],
  x: number,
  y: number,
  isOpen?: (id: number) => boolean,
): Container | null {
  const moved = new Map(cars.map((car) => [car.id, isResting(car) ? restBoxOf(car) : null] as const));
  return containerInReach(map, x, y, isOpen, moved);
}
