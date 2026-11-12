import { describe, expect, it } from 'vitest';
import { PLAYER_RADIUS } from '../shared/constants.ts';
import { doorsOf } from '../shared/doors.ts';
import { toggleDoor } from '../shared/fortifications.ts';
import { BUILDING_DEFS } from '../shared/protocol.ts';
import type { PlayerEntity, SnapshotPacket } from '../shared/protocol.ts';
import { roadBlocked } from '../shared/vehicle-driving.ts';
import { buildingAt, circleHitsSolid } from '../shared/world-query.ts';
import type { GameSimulation } from '../shared/simulation.ts';
import { garageScene } from './helpers/garage-scene.ts';
import type { GarageScene } from './helpers/garage-scene.ts';
import { input } from './helpers/sim-harness.ts';

type Keys = { up?: boolean; down?: boolean; left?: boolean; right?: boolean; search?: boolean };

function run(sim: GameSimulation, ticks: number, keys: Keys = {}): void {
  for (let i = 0; i < ticks; i++) {
    sim.setInput('a', input(keys));
    sim.step();
  }
}

const me = (sim: GameSimulation): PlayerEntity => sim.snapshot().players.find((p) => p.id === 'a') as PlayerEntity;
const tap = (sim: GameSimulation): void => {
  run(sim, 3, { search: true });
  run(sim, 1);
};
const press = (sim: GameSimulation): void => {
  run(sim, 1, { search: true });
  run(sim, 1);
};

/** A snapshot of the car now, whoever is at its wheel. */
function carView(scene: GarageScene): NonNullable<SnapshotPacket['vehicles']>[number] | undefined {
  return scene.sim.snapshot().vehicles?.find((view) => view.id === scene.car.id);
}

/** The player outside the front door, clear of the door's own box (a door will not shut on a body) and with the car out of reach. */
function standOutsideDoor(scene: GarageScene): void {
  const [p] = scene.state.players;
  p.x = scene.door.x;
  p.y = scene.door.y + 24;
}

const frontDoor = (scene: GarageScene) => {
  const door = doorsOf(scene.state).find((d) => d.id === `${scene.garage.id}_door_front`);
  if (!door) throw new Error('garage has no front door');
  return door;
};

/** Through the real keys: hold the search key to shut the door, tap it to open it again. */
function shutThenOpenDoor(scene: GarageScene): void {
  const door = frontDoor(scene);
  standOutsideDoor(scene);
  run(scene.sim, 2, { search: true });
  run(scene.sim, 2);
  expect(door.isOpen).toBe(false);
  tap(scene.sim);
  expect(door.isOpen).toBe(true);
}

/** Walks in through the open door until the car stops the player, then taps into the car. */
function walkInAndGetIn(scene: GarageScene): void {
  standOutsideDoor(scene);
  run(scene.sim, 40, { up: true });
  tap(scene.sim);
}

const insideGarage = (scene: GarageScene, x: number, y: number): boolean => buildingAt(scene.state.map, x, y)?.id === scene.garage.id;

describe('an Auto Garage car', () => {
  it('a player opens the door, gets in the garage car and backs it out of the garage', () => {
    const scene = garageScene();
    shutThenOpenDoor(scene);
    walkInAndGetIn(scene);
    expect(me(scene.sim).vehicle).toEqual({ id: scene.car.id, seat: 0 });
    run(scene.sim, 90, { down: true });
    const view = carView(scene);
    expect(view).toBeDefined();
    expect(insideGarage(scene, view?.x ?? 0, view?.y ?? 0)).toBe(false);
    expect((view?.y ?? 0) > scene.garage.y + BUILDING_DEFS.garage.h).toBe(true);
  });

  it('with the door shut the car stays in', () => {
    const scene = garageScene();
    walkInAndGetIn(scene);
    expect(me(scene.sim).vehicle).toEqual({ id: scene.car.id, seat: 0 });
    toggleDoor(frontDoor(scene));
    run(scene.sim, 120, { down: true });
    const view = carView(scene);
    expect(insideGarage(scene, view?.x ?? 0, view?.y ?? 0)).toBe(true);
  });

  it('a player gets out of the car inside the garage, standing clear of every wall', () => {
    const scene = garageScene();
    walkInAndGetIn(scene);
    press(scene.sim);
    const p = me(scene.sim);
    expect(p.vehicle).toBeUndefined();
    expect(insideGarage(scene, p.x, p.y)).toBe(true);
    expect(circleHitsSolid(scene.state.map, p.x, p.y, PLAYER_RADIUS)).toBe(false);
  });

  it('a car still cannot go into a house or any other building, but may stand in a garage', () => {
    const scene = garageScene();
    const blocked = roadBlocked(scene.state);
    const others = scene.state.map.buildings.filter((b) => b.kind !== 'garage' && BUILDING_DEFS[b.kind] !== undefined);
    expect(others.length).toBeGreaterThan(0);
    for (const b of others) {
      const { w, h } = BUILDING_DEFS[b.kind];
      expect(blocked(b.x + w / 2, b.y + h / 2, 9)).toBe(true);
    }
    expect(blocked(scene.garage.x + 130, scene.garage.y + 85, 9)).toBe(false);
  });
});
