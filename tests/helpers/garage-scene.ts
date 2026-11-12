// A generated town with an Auto Garage whose car is parked and a clear lane outside its front door.

import { BUILDING_DEFS } from '../../shared/protocol.ts';
import type { BuildingInstance } from '../../shared/protocol.ts';
import type { SimState } from '../../shared/sim-state.ts';
import { GameSimulation } from '../../shared/simulation.ts';
import { driveableProps } from '../../shared/vehicle-choice.ts';
import type { ParkedCar } from '../../shared/vehicle-choice.ts';
import { circleHitsSolid } from '../../shared/world-query.ts';
import { stateOf } from './sim-harness.ts';

/** How far south of the door the lane must be clear, so a car backing out has somewhere to go. */
const LANE_OUT = 90;

export interface GarageScene {
  readonly sim: GameSimulation;
  readonly state: SimState;
  readonly garage: BuildingInstance;
  readonly car: ParkedCar;
  /** The middle of the front door's opening. */
  readonly door: { readonly x: number; readonly y: number };
}

function carInside(state: SimState, garage: BuildingInstance): ParkedCar | null {
  const { w, h } = BUILDING_DEFS.garage;
  const inside = (car: ParkedCar): boolean => car.x > garage.x && car.x < garage.x + w && car.y > garage.y && car.y < garage.y + h;
  return driveableProps(state.map).find(inside) ?? null;
}

function laneIsClear(state: SimState, door: { x: number; y: number }): boolean {
  for (let d = 4; d <= LANE_OUT; d += 6) {
    if (circleHitsSolid(state.map, door.x, door.y + d, 14)) return false;
  }
  return true;
}

/** The first seed whose town has a garage with its car and open ground outside the door; the scene is a quiet town with one player, `a`. */
export function garageScene(): GarageScene {
  for (let seed = 1; seed < 200; seed++) {
    const sim = new GameSimulation({ seed });
    sim.addPlayer('a', 'a');
    const state = stateOf(sim);
    state.intermissionLeft = 1e6;
    state.zombies = [];
    state.pickups = [];
    state.populationTarget = 0;
    sim.snapshot();
    for (const garage of state.map.buildings.filter((b) => b.kind === 'garage')) {
      const car = carInside(state, garage);
      const door = { x: garage.x + BUILDING_DEFS.garage.doorX, y: garage.y + BUILDING_DEFS.garage.h };
      if (car && laneIsClear(state, door)) return { sim, state, garage, car, door };
    }
  }
  throw new Error('no seed has a garage with its car and a clear lane');
}
