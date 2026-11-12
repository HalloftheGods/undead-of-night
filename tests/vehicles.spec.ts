import { describe, expect, it } from 'vitest';
import { PLAYER_RADIUS } from '../shared/constants.ts';
import { townContainers } from '../shared/containers.ts';
import { FlowField } from '../shared/flow-field.ts';
import { moveToNextTown } from '../shared/level-change.ts';
import { hurtPlayer } from '../shared/player-health.ts';
import type { PlayerEntity, SnapshotPacket, VehicleView } from '../shared/protocol.ts';
import type { SimState } from '../shared/sim-state.ts';
import type { GameSimulation } from '../shared/simulation.ts';
import { FACING_HEADING, parkedVehicle } from '../shared/vehicle-bodies.ts';
import type { VehicleFacing } from '../shared/vehicle-bodies.ts';
import { driveableProps, vehicleChoiceAt } from '../shared/vehicle-choice.ts';
import type { ParkedCar } from '../shared/vehicle-choice.ts';
import { buildingAt, circleHitsSolid, isLifted, setSolid } from '../shared/world-query.ts';
import type { Box } from '../shared/world-query.ts';
import { eventsOf, input, quietSim, steps } from './helpers/sim-harness.ts';

type Spot = { x: number; y: number };
type Keys = { up?: boolean; down?: boolean; left?: boolean; right?: boolean };

/** Every event across the snapshots taken while stepping, so none is missed between reads. */
function run(sim: GameSimulation, ticks: number, keys: Keys & { search?: boolean } = {}): SnapshotPacket[] {
  const frames: SnapshotPacket[] = [];
  for (let i = 0; i < ticks; i++) {
    for (const id of ['a']) sim.setInput(id, input(keys));
    sim.step();
    frames.push(sim.snapshot());
  }
  return frames;
}

const allEvents = <T extends Parameters<typeof eventsOf>[1]>(frames: SnapshotPacket[], type: T) => frames.flatMap((frame) => eventsOf(frame, type));
const me = (sim: GameSimulation): PlayerEntity => sim.snapshot().players.find((p) => p.id === 'a') as PlayerEntity;
const tap = (sim: GameSimulation): SnapshotPacket[] => [...run(sim, 3, { search: true }), ...run(sim, 1)];
const press = (sim: GameSimulation): SnapshotPacket[] => [...run(sim, 1, { search: true }), ...run(sim, 1)];

const NOSE_KEYS: Record<VehicleFacing, Keys> = { n: { up: true }, s: { down: true }, e: { right: true }, w: { left: true } };
const TAIL_KEYS: Record<VehicleFacing, Keys> = { n: { down: true }, s: { up: true }, e: { left: true }, w: { right: true } };

function isOpen(state: SimState, x: number, y: number, r = PLAYER_RADIUS): boolean {
  const onMap = x > r && y > r && x < state.map.width - r && y < state.map.height - r;
  return onMap && buildingAt(state.map, x, y) === null && !circleHitsSolid(state.map, x, y, r);
}

/** Open ground just off the car's long sides, within reach of the door. */
function besideCar(state: SimState, box: Box): Spot | null {
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  const off = PLAYER_RADIUS + 4;
  const wide = box.x1 - box.x0 > box.y1 - box.y0;
  const spots = wide
    ? [{ x: cx, y: box.y1 + off }, { x: cx, y: box.y0 - off }, { x: box.x0 - off, y: cy }, { x: box.x1 + off, y: cy }]
    : [{ x: box.x0 - off, y: cy }, { x: box.x1 + off, y: cy }, { x: cx, y: box.y1 + off }, { x: cx, y: box.y0 - off }];
  return spots.find((spot) => isOpen(state, spot.x, spot.y)) ?? null;
}

/** A parked car with open road 120px ahead of its nose, open ground beside it, and nothing else solid near it. */
function roomyCar(state: SimState, wanted: (car: ParkedCar) => boolean = () => true): { car: ParkedCar; spot: Spot } {
  for (const car of driveableProps(state.map)) {
    if (!wanted(car)) continue;
    const heading = FACING_HEADING[car.parked.facing];
    const halfLength = Math.max(car.box.x1 - car.box.x0, car.box.y1 - car.box.y0) / 2;
    const road = [30, 60, 90, 120].every((d) => isOpen(state, car.x + Math.cos(heading) * (halfLength + d), car.y + Math.sin(heading) * (halfLength + d), 14));
    const spot = besideCar(state, car.box);
    const others = driveableProps(state.map).every((other) => other.id === car.id || Math.hypot(other.x - car.x, other.y - car.y) > 80);
    if (road && spot && others) return { car, spot };
  }
  throw new Error('no roomy car on this map');
}

function standAt(state: SimState, spot: Spot): void {
  const [p] = state.players;
  p.x = spot.x;
  p.y = spot.y;
}

function viewOf(sim: GameSimulation, id: number): VehicleView | undefined {
  return sim.snapshot().vehicles?.find((view) => view.id === id);
}

/** Holds the nose's key, then lets go and waits for the car to stop. */
function driveOff(sim: GameSimulation, facing: VehicleFacing, ticks = 20): void {
  run(sim, ticks, NOSE_KEYS[facing]);
  run(sim, 60);
}

function containerOf(state: SimState, car: ParkedCar): number {
  const container = townContainers(state.map).find((c) => c.propIndex === car.id);
  if (!container) throw new Error('car has no container');
  return container.id;
}

describe('vehicles: getting in and out with the search key', () => {
  it('a tap gets into the driver seat, and the snapshot carries the car and the seat (bug 2)', () => {
    const { sim, state } = quietSim();
    const { car, spot } = roomyCar(state);
    standAt(state, spot);
    const frames = tap(sim);
    expect(allEvents(frames, 'vehicle_enter')).toHaveLength(1);
    expect(me(sim).vehicle).toEqual({ id: car.id, seat: 0 });
    const view = viewOf(sim, car.id);
    expect(view?.seats[0]).toBe('a');
    expect(view?.speed).toBe(0);
    expect(me(sim).x).toBeCloseTo(car.x, 1);
  });

  it('holding the key past the tap window searches the car instead', () => {
    const { sim, state } = quietSim();
    const { car, spot } = roomyCar(state);
    standAt(state, spot);
    const frames = run(sim, 90, { search: true });
    const opened = allEvents(frames, 'container_opened');
    expect(opened.map((event) => event.container)).toEqual([containerOf(state, car)]);
    expect(me(sim).vehicle).toBeUndefined();
    run(sim, 1);
    expect(me(sim).vehicle).toBeUndefined();
  });

  it('no search starts inside the tap window', () => {
    const { sim, state } = quietSim();
    const { spot } = roomyCar(state);
    standAt(state, spot);
    run(sim, 6, { search: true });
    expect(me(sim).search).toBe(0);
  });

  it('press, release, press: in, then out beside the car (bug 1)', () => {
    const { sim, state } = quietSim();
    const { car, spot } = roomyCar(state);
    standAt(state, spot);
    tap(sim);
    expect(me(sim).vehicle).toBeDefined();
    const frames = press(sim);
    expect(allEvents(frames, 'vehicle_exit')).toHaveLength(1);
    const p = me(sim);
    expect(p.vehicle).toBeUndefined();
    expect(Math.hypot(p.x - car.x, p.y - car.y)).toBeGreaterThan(PLAYER_RADIUS);
    expect(circleHitsSolid(state.map, p.x, p.y, PLAYER_RADIUS)).toBe(false);
    tap(sim);
    expect(me(sim).vehicle).toEqual({ id: car.id, seat: 0 });
  });

  it('a press refused at speed does not spend the next one (bug 1)', () => {
    const { sim, state } = quietSim();
    const { car, spot } = roomyCar(state);
    standAt(state, spot);
    tap(sim);
    run(sim, 12, NOSE_KEYS[car.parked.facing]);
    run(sim, 1, { ...NOSE_KEYS[car.parked.facing], search: true });
    expect(me(sim).vehicle).toBeDefined();
    run(sim, 60);
    expect(viewOf(sim, car.id)?.speed).toBe(0);
    press(sim);
    expect(me(sim).vehicle).toBeUndefined();
  });

  it('a car with its boot already searched still gets in on a tap', () => {
    const { sim, state } = quietSim();
    const { car, spot } = roomyCar(state);
    standAt(state, spot);
    run(sim, 90, { search: true });
    run(sim, 2);
    tap(sim);
    expect(me(sim).vehicle).toEqual({ id: car.id, seat: 0 });
  });

  it('a *_v car starts nose up: heading -PI/2 and facing n (bug 6)', () => {
    const { sim, state } = quietSim();
    const { car, spot } = roomyCar(state, (candidate) => candidate.parked.facing === 'n');
    standAt(state, spot);
    tap(sim);
    const view = viewOf(sim, car.id);
    expect(view?.facing).toBe('n');
    expect(view?.heading).toBeCloseTo(-Math.PI / 2, 2);
  });

  it('a car boxed in on every side keeps its driver (bug 7)', () => {
    const { sim, state } = quietSim();
    const { car, spot } = roomyCar(state);
    standAt(state, spot);
    tap(sim);
    const { box } = car;
    const pad = 40;
    setSolid(state.map, 'test:north', { x0: box.x0 - pad, y0: box.y0 - pad, x1: box.x1 + pad, y1: box.y0 - 1 });
    setSolid(state.map, 'test:south', { x0: box.x0 - pad, y0: box.y1 + 1, x1: box.x1 + pad, y1: box.y1 + pad });
    setSolid(state.map, 'test:west', { x0: box.x0 - pad, y0: box.y0 - pad, x1: box.x0 - 1, y1: box.y1 + pad });
    setSolid(state.map, 'test:east', { x0: box.x1 + 1, y0: box.y0 - pad, x1: box.x1 + pad, y1: box.y1 + pad });
    press(sim);
    expect(me(sim).vehicle).toEqual({ id: car.id, seat: 0 });
  });

  it('a car parked in an Auto Garage can be driven; a spot inside any other building offers no car', () => {
    const { state } = quietSim();
    const garageCars = state.map.props.flatMap((prop, id) => (parkedVehicle(prop.kind) && buildingAt(state.map, prop.x, prop.y - 1)?.kind === 'garage' ? [id] : []));
    expect(garageCars.length).toBeGreaterThan(0);
    const driveable = new Set(driveableProps(state.map).map((car) => car.id));
    expect(garageCars.every((id) => driveable.has(id))).toBe(true);
    const house = state.map.buildings.find((b) => b.kind === 'house');
    if (!house) throw new Error('town has no house');
    const inHouse = vehicleChoiceAt(state.map, [], house.x + 20, house.y + 20, {});
    expect(inHouse).toBeNull();
  });
});

describe('vehicles: a car is its own body and the map stays as built', () => {
  it('driving moves the solid, never the map prop, and the old spot is open to flow fields (bug 4)', () => {
    const { sim, state } = quietSim();
    const { car, spot } = roomyCar(state);
    const propsBefore = structuredClone(state.map.props);
    standAt(state, spot);
    tap(sim);
    driveOff(sim, car.parked.facing);
    const view = viewOf(sim, car.id) as VehicleView;
    expect(Math.hypot(view.x - car.x, view.y - car.y)).toBeGreaterThan(40);
    expect(view.speed).toBe(0);
    expect(state.map.props).toEqual(propsBefore);
    expect(isLifted(state.map, car.id)).toBe(true);
    expect(circleHitsSolid(state.map, car.x, car.y, 2)).toBe(false);
    expect(circleHitsSolid(state.map, view.x, view.y, 2)).toBe(true);
    const field = new FlowField(state.map);
    field.recompute([{ x: car.x, y: car.y }]);
    expect(field.distanceAt(car.x, car.y)).toBe(0);
  });

  it("a moved car's boot is searched where the car is now, and no longer at its map spot (bug 3)", () => {
    const { sim, state } = quietSim();
    const { car, spot } = roomyCar(state);
    standAt(state, spot);
    run(sim, 90, { search: true });
    run(sim, 2);
    tap(sim);
    driveOff(sim, car.parked.facing);
    press(sim);
    expect(me(sim).vehicle).toBeUndefined();

    standAt(state, spot);
    const atOldSpot = run(sim, 30, { search: true });
    expect(allEvents(atOldSpot, 'container_opened')).toHaveLength(0);
    run(sim, 2);

    const view = viewOf(sim, car.id) as VehicleView;
    const beside = besideCar(state, { x0: view.x - 22, y0: view.y - 9, x1: view.x + 22, y1: view.y + 9 });
    standAt(state, beside as Spot);
    const atNewSpot = run(sim, 30, { search: true });
    const reopened = allEvents(atNewSpot, 'container_opened');
    expect(reopened.map((event) => [event.container, event.reopen])).toEqual([[containerOf(state, car), true]]);
  });

  it('a downed driver is put out beside the car, which a teammate can then drive (bug 5)', () => {
    const { sim, state } = quietSim(['a', 'b']);
    const { car, spot } = roomyCar(state);
    standAt(state, spot);
    tap(sim);
    const [driver, mate] = state.players;
    hurtPlayer(state, driver, driver.health + 1);
    run(sim, 1);
    const down = me(sim);
    expect(down.status).toBe('downed');
    expect(down.vehicle).toBeUndefined();
    expect(viewOf(sim, car.id)?.seats[0]).toBeNull();
    mate.x = spot.x;
    mate.y = spot.y;
    for (let i = 0; i < 3; i++) {
      sim.setInput('b', input({ search: true }));
      sim.step();
    }
    sim.setInput('b', input());
    sim.step();
    expect(viewOf(sim, car.id)?.seats[0]).toBe('b');
  });

  it('a driver who leaves the room leaves the car behind, empty', () => {
    const { sim, state } = quietSim(['a', 'b']);
    const { car, spot } = roomyCar(state);
    standAt(state, spot);
    tap(sim);
    sim.removePlayer('a');
    steps(sim, 1);
    expect(viewOf(sim, car.id)?.seats[0]).toBeNull();
  });

  it('a car let go of at speed coasts to rest on its own and is a solid there', () => {
    const { sim, state } = quietSim();
    const { car, spot } = roomyCar(state);
    standAt(state, spot);
    tap(sim);
    run(sim, 3, NOSE_KEYS[car.parked.facing]);
    const rolling = viewOf(sim, car.id) as VehicleView;
    expect(Math.abs(rolling.speed)).toBeGreaterThan(0);
    expect(Math.abs(rolling.speed)).toBeLessThan(40);
    press(sim);
    expect(me(sim).vehicle).toBeUndefined();
    run(sim, 60);
    const parked = viewOf(sim, car.id) as VehicleView;
    expect(parked.speed).toBe(0);
    expect(parked.seats[0]).toBeNull();
    expect(parked.heading).toBeCloseTo(FACING_HEADING[parked.facing], 2);
    expect(circleHitsSolid(state.map, parked.x, parked.y, 2)).toBe(true);
  });

  it('a level change clears the cars and puts the map back as built', () => {
    const { sim, state } = quietSim();
    const { car, spot } = roomyCar(state);
    standAt(state, spot);
    tap(sim);
    driveOff(sim, car.parked.facing);
    sim.restart();
    expect(sim.snapshot().vehicles).toBeUndefined();
    expect(me(sim).vehicle).toBeUndefined();
    expect(isLifted(state.map, car.id)).toBe(false);
    expect(circleHitsSolid(state.map, car.x, car.y, 2)).toBe(true);
    moveToNextTown(state);
    expect(state.vehicles.size).toBe(0);
  });
});

describe('vehicles: every parked car on a town can be driven away', () => {
  it('enters and drives each driveable outdoor car on a generated town', () => {
    const { sim, state } = quietSim(['keeper', 'a']);
    const stuck: string[] = [];
    const unreachable: string[] = [];
    for (const car of driveableProps(state.map)) {
      const spot = besideCar(state, car.box);
      if (!spot) {
        unreachable.push(`${car.id}:${state.map.props[car.id].kind}`);
        continue;
      }
      const p = state.players.find((candidate) => candidate.id === 'a');
      if (!p) throw new Error('driver missing');
      p.x = spot.x;
      p.y = spot.y;
      tap(sim);
      const seated = me(sim).vehicle;
      if (seated?.id !== car.id) {
        stuck.push(`${car.id}:${state.map.props[car.id].kind} (got into ${seated?.id ?? 'nothing'})`);
      } else {
        const start = viewOf(sim, car.id) as VehicleView;
        run(sim, 20, NOSE_KEYS[car.parked.facing]);
        const forward = viewOf(sim, car.id) as VehicleView;
        const movedForward = Math.hypot(forward.x - start.x, forward.y - start.y) > 6;
        if (!movedForward) run(sim, 45, TAIL_KEYS[car.parked.facing]);
        const after = viewOf(sim, car.id) as VehicleView;
        const moved = Math.hypot(after.x - start.x, after.y - start.y) > 6;
        if (!moved) stuck.push(`${car.id}:${state.map.props[car.id].kind}`);
      }
      sim.removePlayer('a');
      sim.addPlayer('a', 'a');
    }
    expect(stuck).toEqual([]);
    expect(driveableProps(state.map).length).toBeGreaterThan(10);
    expect(unreachable.length).toBeLessThan(driveableProps(state.map).length / 2);
  });
});
