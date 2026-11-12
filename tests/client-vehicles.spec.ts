import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PLAYER_RADIUS, TICK_DT } from '../shared/constants.ts';
import type { PlayerEntity, SnapshotPacket, VehicleView } from '../shared/protocol.ts';
import type { SimState } from '../shared/sim-state.ts';
import type { GameSimulation } from '../shared/simulation.ts';
import { FACING_HEADING, restBox } from '../shared/vehicle-bodies.ts';
import type { VehicleFacing } from '../shared/vehicle-bodies.ts';
import { driveableProps } from '../shared/vehicle-choice.ts';
import type { ParkedCar } from '../shared/vehicle-choice.ts';
import { buildingAt, circleHitsSolid, isLifted } from '../shared/world-query.ts';
import { buildArtBook } from '../src/art/index.ts';
import { BuildingLayer } from '../src/engine/building-layer.ts';
import { EntityRenderer } from '../src/engine/entity-renderer.ts';
import { EMPTY_SCENE } from '../src/engine/scene.ts';
import { spriteCanvas } from '../src/engine/sprite-cache.ts';
import { vehicleAnchor, vehicleSprite } from '../src/engine/vehicle-draw.ts';
import { vehiclePrompt } from '../src/engine/vehicle-prompt.ts';
import { ClientWorld } from '../src/game/client-world.ts';
import { blendVehicle } from '../src/game/client-vehicles.ts';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';
import { input, quietSim } from './helpers/sim-harness.ts';

type Key = 'up' | 'right' | 'down' | 'left';
const TICK_MS = TICK_DT * 1000;
const CLOCKWISE: readonly Key[] = ['up', 'right', 'down', 'left'];
const NOSE_KEY: Record<VehicleFacing, Key> = { n: 'up', e: 'right', s: 'down', w: 'left' };

const keysOf = (key: Key | null) => (key ? { [key]: true } : {});
const stickOf = (key: Key | null): [number, number] => [Number(key === 'right') - Number(key === 'left'), Number(key === 'down') - Number(key === 'up')];

function isOpen(state: SimState, x: number, y: number, r: number): boolean {
  const onMap = x > r && y > r && x < state.map.width - r && y < state.map.height - r;
  return onMap && buildingAt(state.map, x, y) === null && !circleHitsSolid(state.map, x, y, r);
}

/** The parked car with the least in its way within reach of a square drive, and room beside its door. */
function carWithRoom(state: SimState): ParkedCar {
  const blockedAround = (car: ParkedCar): number => {
    let blocked = 0;
    for (let dx = -100; dx <= 100; dx += 20) {
      for (let dy = -100; dy <= 100; dy += 20) {
        const insideCar = car.box.x0 - 16 < car.x + dx && car.x + dx < car.box.x1 + 16 && car.box.y0 - 16 < car.y + dy && car.y + dy < car.box.y1 + 16;
        if (!insideCar && !isOpen(state, car.x + dx, car.y + dy, 12)) blocked += 1;
      }
    }
    return blocked;
  };
  const cars = driveableProps(state.map).filter((car) => hasRoomBeside(state, car));
  const [best] = cars.map((car) => ({ car, blocked: blockedAround(car) })).sort((a, b) => a.blocked - b.blocked);
  if (!best) throw new Error('no car with room beside it on this map');
  return best.car;
}

function doorSpots(car: ParkedCar): { x: number; y: number }[] {
  return [{ x: car.x, y: car.box.y1 + PLAYER_RADIUS + 4 }, { x: car.x, y: car.box.y0 - PLAYER_RADIUS - 4 }, { x: car.box.x0 - PLAYER_RADIUS - 4, y: car.y }, { x: car.box.x1 + PLAYER_RADIUS + 4, y: car.y }];
}

const hasRoomBeside = (state: SimState, car: ParkedCar): boolean => doorSpots(car).some((s) => isOpen(state, s.x, s.y, PLAYER_RADIUS));

/** A spot beside the car's door where a survivor can stand and still reach it. */
function beside(state: SimState, car: ParkedCar): { x: number; y: number } {
  const spot = doorSpots(car).find((s) => isOpen(state, s.x, s.y, PLAYER_RADIUS));
  if (!spot) throw new Error('no room beside the car');
  return spot;
}

function stepSim(sim: GameSimulation, seq: number, key: Key | null, search = false): SnapshotPacket {
  sim.setInput('a', input({ seq, ...keysOf(key), search }));
  sim.step();
  return sim.snapshot();
}

const carOf = (snap: SnapshotPacket, id: number): VehicleView => snap.vehicles!.find((car) => car.id === id)!;
const meIn = (snap: SnapshotPacket): PlayerEntity => snap.players.find((p) => p.id === 'a')!;

/** A sim with its player sat in a car that has room, and a client world on its own copy of the map. */
function seated(ticksUp = 0) {
  const { sim, state } = quietSim();
  const clientMap = structuredClone(state.map);
  const car = carWithRoom(state);
  Object.assign(state.players[0], beside(state, car));
  stepSim(sim, 0, null, true);
  stepSim(sim, 0, null, true);
  stepSim(sim, 0, null, true);
  const entered = stepSim(sim, 0, null);
  expect(meIn(entered).vehicle).toEqual({ id: car.id, seat: 0 });
  const world = new ClientWorld(clientMap, 'a');
  world.push(entered, 0);
  const nose = NOSE_KEY[car.parked.facing];
  const start = CLOCKWISE.indexOf(nose);
  const keyAt = (frame: number): Key => CLOCKWISE[(start + Math.floor((frame - 1) / 15)) % 4];
  return { sim, state, car, world, clientMap, keyAt, ticksUp };
}

describe('driving a car on the client', () => {
  beforeEach(() => {
    installFakeBrowser();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('predicts the car tick for tick with the sim at zero latency', () => {
    const { sim, car, world, keyAt } = seated();
    let worst = 0;
    let farthest = 0;
    for (let frame = 1; frame <= 60; frame += 1) {
      const key = keyAt(frame);
      const [dirX, dirY] = stickOf(key);
      const shown = world.advance(frame * TICK_MS, 0, dirX, dirY, 0, TICK_DT)!.vehicles!.find((v) => v.id === car.id)!;
      farthest = Math.max(farthest, Math.hypot(shown.x - car.x, shown.y - car.y));
      world.recordInput(frame, dirX, dirY);
      const snap = stepSim(sim, frame, key);
      world.push(snap, frame * TICK_MS);
      const truth = carOf(snap, car.id);
      worst = Math.max(worst, Math.hypot(shown.x - truth.x, shown.y - truth.y));
    }
    expect(farthest).toBeGreaterThan(40);
    expect(worst).toBeLessThan(0.01);
  });

  it('shows no divergence beyond 2px driving a square under 100ms of delay', () => {
    const { sim, car, world, keyAt } = seated();
    const reference = seated();
    const UP = 2;
    const DOWN = 1;
    const snaps: SnapshotPacket[] = [];
    let worst = 0;
    let farthest = 0;
    for (let frame = 1; frame <= 60; frame += 1) {
      const key = keyAt(frame);
      const [dirX, dirY] = stickOf(key);
      const shown = world.advance(frame * TICK_MS, 0, dirX, dirY, 0, TICK_DT)!.vehicles!.find((v) => v.id === car.id)!;
      farthest = Math.max(farthest, Math.hypot(shown.x - car.x, shown.y - car.y));
      world.recordInput(frame, dirX, dirY);
      const arrived = frame - UP;
      snaps.push(stepSim(sim, Math.max(0, arrived), arrived >= 1 ? keyAt(arrived) : null));
      const delivered = snaps[frame - 1 - DOWN];
      if (delivered) world.push(delivered, frame * TICK_MS);
      const ideal = carOf(stepSim(reference.sim, frame, key), car.id);
      worst = Math.max(worst, Math.hypot(shown.x - ideal.x, shown.y - ideal.y));
    }
    expect(farthest).toBeGreaterThan(40);
    expect(worst).toBeLessThan(2);
  });

  it('makes the map solids agree with the sim after the car has driven off and stopped', () => {
    const { sim, state, car, world, clientMap } = seated();
    let frame = 0;
    let snap = sim.snapshot();
    const nose = NOSE_KEY[car.parked.facing];
    for (; frame < 70; frame += 1) {
      const key = frame < 20 ? nose : null;
      const [dirX, dirY] = stickOf(key);
      world.advance((frame + 1) * TICK_MS, 0, dirX, dirY, 0, TICK_DT);
      world.recordInput(frame + 1, dirX, dirY);
      snap = stepSim(sim, frame + 1, key);
      world.push(snap, (frame + 1) * TICK_MS);
    }
    expect(carOf(snap, car.id).speed).toBe(0);
    expect(isLifted(clientMap, car.id)).toBe(true);
    const moved = carOf(snap, car.id);
    const spots = [car, moved].flatMap((c) => {
      const box = restBox(car.parked.body, car.parked.facing, c.x, c.y);
      return [-30, -12, 0, 12, 30].flatMap((dx) => [-24, -9, 0, 9, 24].map((dy) => ({ x: (box.x0 + box.x1) / 2 + dx, y: (box.y0 + box.y1) / 2 + dy })));
    });
    for (const spot of spots) {
      expect(circleHitsSolid(clientMap, spot.x, spot.y, PLAYER_RADIUS)).toBe(circleHitsSolid(state.map, spot.x, spot.y, PLAYER_RADIUS));
    }
  });
});

describe('cars on screen', () => {
  const art = buildArtBook();
  beforeEach(() => {
    installFakeBrowser();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips the lifted prop and draws the vehicle at its new place', () => {
    const { state } = quietSim();
    const car = driveableProps(state.map)[0];
    const layer = new BuildingLayer(art.environment);
    layer.setMap(state.map);
    const entities = new EntityRenderer(art, { get: () => ({}) } as never, layer);
    entities.setMap(state.map, () => {});
    const drawn = (scene = EMPTY_SCENE) => {
      const ctx = fakeCanvas().getContext();
      const drawImage = vi.fn();
      ctx.drawImage = drawImage;
      entities.drawWorld(ctx as unknown as CanvasRenderingContext2D, scene, Math.round(car.x) - 160, Math.round(car.y) - 120, 320, 240, 0, 1 / 60);
      return drawImage.mock.calls as unknown[][];
    };
    const prop = state.map.props[car.id];
    const parkedImage = spriteCanvas(vehicleSprite(art, { body: car.parked.body, facing: car.parked.facing }, prop));
    expect(drawn().some((call) => call[0] === parkedImage)).toBe(true);

    const view: VehicleView = { id: car.id, body: car.parked.body, x: car.x + 40, y: car.y + 10, heading: FACING_HEADING.e, speed: 80, facing: 'e', seats: [null] };
    const calls = drawn({ ...EMPTY_SCENE, vehicles: [view] });
    const eastImage = spriteCanvas(vehicleSprite(art, view, prop));
    const at = vehicleAnchor(view);
    const east = calls.find((call) => call[0] === eastImage)!;
    expect(east).toBeDefined();
    expect(east[1]).toBe(at.x - (Math.round(car.x) - 160) - vehicleSprite(art, view, prop).ax);
    expect(calls.some((call) => call[0] === parkedImage && view.facing !== car.parked.facing)).toBe(false);
  });

  it('blends a car between snapshots along the shortest arc', () => {
    const base: VehicleView = { id: 1, body: 'sedan', x: 0, y: 0, heading: Math.PI - 0.1, speed: 100, facing: 'w', seats: ['a'] };
    const next: VehicleView = { ...base, x: 10, heading: -Math.PI + 0.1, speed: 120 };
    const half = blendVehicle(base, next, 0.5);
    expect(half.x).toBe(5);
    expect(Math.abs(Math.abs(half.heading) - Math.PI)).toBeLessThan(0.001);
    expect(blendVehicle(base, { ...next, x: 400 }, 0.5).x).toBe(400);
  });
});

describe('the prompt over a car', () => {
  it('says what the key does, with the boot when there is one', () => {
    expect(vehiclePrompt({ kind: 'enter', boot: false }, false)).toBe('E: DRIVE');
    expect(vehiclePrompt({ kind: 'enter', boot: true }, false)).toBe('E: DRIVE / HOLD: SEARCH');
    expect(vehiclePrompt({ kind: 'exit', boot: false }, false)).toBe('E: EXIT');
  });

  it('drops the key on touch', () => {
    expect(vehiclePrompt({ kind: 'enter', boot: true }, true)).toBe('DRIVE / HOLD: SEARCH');
    expect(vehiclePrompt({ kind: 'exit', boot: false }, true)).toBe('EXIT');
  });

  it('is on the scene when the local player stands at a car, and flips to EXIT once seated and slow', () => {
    const { sim, state } = quietSim();
    const car = driveableProps(state.map)[0];
    Object.assign(state.players[0], beside(state, car));
    const world = new ClientWorld(structuredClone(state.map), 'a');
    world.push(sim.snapshot(), 0);
    expect(world.advance(TICK_MS, 0, 0, 0, 0, TICK_DT)!.vehicle?.kind).toBe('enter');
    Object.assign(state.players[0], { x: car.x, y: car.y });
    for (let i = 0; i < 3; i += 1) stepSim(sim, 0, null, true);
    world.push(stepSim(sim, 0, null), 2 * TICK_MS);
    expect(world.advance(3 * TICK_MS, 0, 0, 0, 0, TICK_DT)!.vehicle?.kind).toBe('exit');
  });
});
