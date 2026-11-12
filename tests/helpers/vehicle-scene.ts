import { PLAYER_RADIUS } from '../../shared/constants.ts';
import type { SnapshotPacket } from '../../shared/protocol.ts';
import type { SimState, VehicleState } from '../../shared/sim-state.ts';
import type { GameSimulation } from '../../shared/simulation.ts';
import { FACING_HEADING } from '../../shared/vehicle-bodies.ts';
import { driveableProps } from '../../shared/vehicle-choice.ts';
import type { ParkedCar } from '../../shared/vehicle-choice.ts';
import { buildingAt, circleHitsSolid } from '../../shared/world-query.ts';
import { input } from './sim-harness.ts';

type Keys = Parameters<typeof input>[0];

function isOpen(state: SimState, x: number, y: number, r: number): boolean {
  const onMap = x > r && y > r && x < state.map.width - r && y < state.map.height - r;
  return onMap && buildingAt(state.map, x, y) === null && !circleHitsSolid(state.map, x, y, r);
}

/** Steps `ticks` ticks with the same keys held for player a, returning each snapshot. */
export function drive(sim: GameSimulation, ticks: number, keys: Keys = {}): SnapshotPacket[] {
  const frames: SnapshotPacket[] = [];
  for (let i = 0; i < ticks; i++) {
    sim.setInput('a', input(keys));
    sim.step();
    frames.push(sim.snapshot());
  }
  return frames;
}

/** Puts player a in the driver seat of a parked car with open road 150px ahead of its nose; returns the car, its heading and the gas key. */
export function seatDriver(sim: GameSimulation, state: SimState): { car: VehicleState; heading: number; nose: { x: number; y: number }; keys: Keys } {
  const parked = driveableProps(state.map).find((candidate: ParkedCar) => {
    const heading = FACING_HEADING[candidate.parked.facing];
    const half = Math.max(candidate.box.x1 - candidate.box.x0, candidate.box.y1 - candidate.box.y0) / 2;
    const ahead = [30, 60, 90, 120, 150].every((d) => isOpen(state, candidate.x + Math.cos(heading) * (half + d), candidate.y + Math.sin(heading) * (half + d), 14));
    const others = driveableProps(state.map).every((o) => o.id === candidate.id || Math.hypot(o.x - candidate.x, o.y - candidate.y) > 80);
    return ahead && others;
  });
  if (!parked) throw new Error('no roomy car on this map');
  const heading = FACING_HEADING[parked.parked.facing];
  const half = Math.max(parked.box.x1 - parked.box.x0, parked.box.y1 - parked.box.y0) / 2;
  const off = PLAYER_RADIUS + 4;
  const wide = parked.box.x1 - parked.box.x0 > parked.box.y1 - parked.box.y0;
  const sides = wide
    ? [{ x: parked.x, y: parked.box.y1 + off }, { x: parked.x, y: parked.box.y0 - off }]
    : [{ x: parked.box.x0 - off, y: parked.y }, { x: parked.box.x1 + off, y: parked.y }];
  const spot = sides.find((s) => isOpen(state, s.x, s.y, PLAYER_RADIUS));
  if (!spot) throw new Error('no open ground beside the car');
  state.players[0].x = spot.x;
  state.players[0].y = spot.y;
  drive(sim, 3, { search: true });
  drive(sim, 1);
  const car = state.vehicles.get(parked.id);
  if (!car) throw new Error('did not get into the car');
  return { car, heading, nose: { x: Math.cos(heading), y: Math.sin(heading) }, keys: { up: true } };
}
