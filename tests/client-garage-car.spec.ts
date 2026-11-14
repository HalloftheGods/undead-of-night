import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TICK_DT } from '../shared/constants.ts';
import { doorsOf } from '../shared/doors.ts';
import { toggleDoor } from '../shared/fortifications.ts';
import { BUILDING_DEFS } from '../shared/protocol.ts';
import type { PlayerEntity, SnapshotPacket, VehicleView } from '../shared/protocol.ts';
import { ClientWorld } from '../src/game/client-world.ts';
import { garageScene } from './helpers/garage-scene.ts';
import type { GarageScene } from './helpers/garage-scene.ts';
import { installFakeBrowser } from './client-fake-dom.ts';
import { input } from './helpers/sim-harness.ts';

const TICK_MS = TICK_DT * 1000;

function stepSim(scene: GarageScene, seq: number, keys: { up?: boolean; down?: boolean; search?: boolean }): SnapshotPacket {
  scene.sim.setInput('a', input({ seq, ...keys }));
  scene.sim.step();
  return scene.sim.snapshot();
}

const carOf = (snap: SnapshotPacket, id: number): VehicleView => snap.vehicles!.find((car) => car.id === id)!;
const meIn = (snap: SnapshotPacket): PlayerEntity => snap.players.find((p) => p.id === 'a')!;

/** The player walks in through the (open) door and taps into the garage car; a client world is fed that snapshot. */
function seatedInGarage(shutDoorAfter: boolean) {
  const scene = garageScene();
  const [p] = scene.state.players;
  p.x = scene.door.x;
  p.y = scene.door.y + 24;
  let seq = 0;
  stepSim(scene, seq, {});
  for (let i = 0; i < 40; i++) stepSim(scene, ++seq, { up: true });
  for (let i = 0; i < 3; i++) stepSim(scene, ++seq, { search: true });
  let snap = stepSim(scene, ++seq, {});
  expect(meIn(snap).vehicle).toEqual({ id: scene.car.id, seat: 0 });
  if (shutDoorAfter) toggleDoor(doorsOf(scene.state).find((d) => d.id === `${scene.garage.id}_door_front`)!);
  snap = stepSim(scene, ++seq, {});
  const world = new ClientWorld(structuredClone(scene.state.map), 'a');
  world.push(snap, 0);
  return { scene, world, seq };
}

/** Backs the car out for `frames` ticks, the client predicting each one before the sim runs it; returns the worst gap and the car's last place. */
function backOut(frames: number, shutDoorAfter: boolean): { worst: number; last: VehicleView; scene: GarageScene } {
  const { scene, world, seq } = seatedInGarage(shutDoorAfter);
  let worst = 0;
  let last = carOf(scene.sim.snapshot(), scene.car.id);
  for (let frame = 1; frame <= frames; frame += 1) {
    const shown = world.advance(frame * TICK_MS, 0, 0, 1, 0, TICK_DT)!.vehicles!.find((v) => v.id === scene.car.id)!;
    world.recordInput(seq + frame, 0, 1);
    const snap = stepSim(scene, seq + frame, { down: true });
    world.push(snap, frame * TICK_MS);
    last = carOf(snap, scene.car.id);
    worst = Math.max(worst, Math.hypot(shown.x - last.x, shown.y - last.y));
  }
  return { worst, last, scene };
}

describe('driving a car out of a garage on the client', () => {
  beforeEach(() => {
    installFakeBrowser();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('predicts the car tick for tick with the sim as it backs out through the open door', () => {
    const { worst, last, scene } = backOut(90, false);
    expect(last.y).toBeGreaterThan(scene.garage.y + BUILDING_DEFS.garage.h);
    expect(worst).toBeLessThan(0.01);
  });

  it('predicts the car staying in when the door has been shut', () => {
    const { worst, last, scene } = backOut(90, true);
    expect(last.y).toBeLessThan(scene.garage.y + BUILDING_DEFS.garage.h);
    expect(worst).toBeLessThan(2);
  });
});
