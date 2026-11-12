import { describe, expect, it } from 'vitest';
import { PLAYER_RADIUS } from '../shared/constants.ts';
import { levelDef } from '../shared/levels.ts';
import type { SnapshotPacket, WorldMap } from '../shared/protocol.ts';
import type { SimState } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { driveableProps } from '../shared/vehicle-choice.ts';
import { buildingAt, circleHitsSolid, propBox } from '../shared/world-query.ts';
import type { Box } from '../shared/world-query.ts';
import { eventsOf, input, SEED, stateOf, steps, surviveHorde } from './helpers/sim-harness.ts';

/** A lull so long nothing else happens, with one survivor 'a'. */
function townSim(testDrive: boolean): { sim: GameSimulation; state: SimState } {
  const sim = new GameSimulation({ seed: SEED, testDrive });
  sim.addPlayer('a', 'a');
  const state = stateOf(sim);
  state.intermissionLeft = 1e6;
  state.zombies = [];
  state.pickups = [];
  state.populationTarget = 0;
  sim.snapshot();
  return { sim, state };
}

/** Open ground just beside a box, found by looking, never by setting a car up by hand. */
function beside(state: SimState, box: Box): { x: number; y: number } {
  const off = PLAYER_RADIUS + 4;
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  const spots = [{ x: cx, y: box.y1 + off }, { x: cx, y: box.y0 - off }, { x: box.x0 - off, y: cy }, { x: box.x1 + off, y: cy }];
  const spot = spots.find((s) => !circleHitsSolid(state.map, s.x, s.y, PLAYER_RADIUS));
  if (!spot) throw new Error('no ground beside the prop');
  return spot;
}

/** Stands player a beside the prop and taps the search key, as a survivor would. */
function tryToEnter(sim: GameSimulation, state: SimState, propIndex: number): void {
  const spot = beside(state, propBox(state.map.props[propIndex]));
  state.players[0].x = spot.x;
  state.players[0].y = spot.y;
  for (let i = 0; i < 3; i++) {
    sim.setInput('a', input({ search: true }));
    sim.step();
  }
  sim.setInput('a', input());
  sim.step();
}

const wreckIndex = (state: SimState): number => state.map.props.findIndex((p) => p.kind === 'car_wreck_h');
const CAR_KINDS = ['car_sedan_h', 'car_sedan_v', 'car_hatch_h', 'car_hatch_v', 'pickup_h', 'police_h', 'police_v', 'ambulance_h', 'van_h'];
/** A car parked inside a building, preferring one a normal run leaves as loot. */
const garageIndex = (map: WorldMap): number => {
  const indoors = (kind: string, x: number, y: number): boolean => CAR_KINDS.includes(kind) && buildingAt(map, x, y - 1) !== null;
  const normal = new Set(driveableProps(map).map((car) => car.id));
  const loot = map.props.findIndex((p, id) => indoors(p.kind, p.x, p.y) && !normal.has(id));
  return loot >= 0 ? loot : map.props.findIndex((p) => indoors(p.kind, p.x, p.y));
};

describe('test drive: what can be driven', () => {
  it('lets a wreck be driven as a sedan facing west, only with the flag', () => {
    const on = townSim(true);
    const index = wreckIndex(on.state);
    expect(index).toBeGreaterThanOrEqual(0);
    tryToEnter(on.sim, on.state, index);
    expect(on.state.vehicles.get(index)).toMatchObject({ body: 'sedan', facing: 'w' });
    expect(on.state.players[0].vehicle).toMatchObject({ id: index });

    const off = townSim(false);
    tryToEnter(off.sim, off.state, wreckIndex(off.state));
    expect(off.state.vehicles.size).toBe(0);
  });

  it('lets a car parked inside a building be driven with the flag, and only with it unless the building is an Auto Garage', () => {
    const on = townSim(true);
    const index = garageIndex(on.state.map);
    expect(index).toBeGreaterThanOrEqual(0);
    tryToEnter(on.sim, on.state, index);
    expect(on.state.vehicles.has(index)).toBe(true);

    const off = townSim(false);
    const drivenAnyway = driveableProps(off.state.map).some((car) => car.id === index);
    tryToEnter(off.sim, off.state, index);
    // An outdoor car close by may take the press; a car that is loot in a normal run never does.
    expect(off.state.vehicles.has(index)).toBe(drivenAnyway);
  });
});

describe('test drive: the run itself', () => {
  const frames = (sim: GameSimulation, ticks: number): SnapshotPacket[] => {
    const seen: SnapshotPacket[] = [];
    for (let i = 0; i < ticks; i++) {
      sim.step();
      seen.push(sim.snapshot());
    }
    return seen;
  };

  it('never opens the exit over the span where it opens without the flag', () => {
    const plain = townSim(false);
    surviveHorde(plain.sim, plain.state);
    surviveHorde(plain.sim, plain.state);
    expect(plain.state.wave).toBe(levelDef(1).hordes);
    expect(plain.state.exit).not.toBeNull();

    const drive = townSim(true);
    surviveHorde(drive.sim, drive.state);
    surviveHorde(drive.sim, drive.state);
    surviveHorde(drive.sim, drive.state);
    expect(drive.state.wave).toBeGreaterThanOrEqual(levelDef(1).hordes);
    expect(drive.state.exit).toBeNull();
    const seen = frames(drive.sim, 600);
    expect(seen.every((f) => f.exit === null && eventsOf(f, 'exit_open').length === 0)).toBe(true);
    expect(drive.state.level).toBe(1);
  });

  it('still sends hordes', () => {
    const { sim, state } = townSim(true);
    state.intermissionLeft = 0;
    steps(sim, 60);
    expect(state.phase).toBe('wave');
    expect(state.spawnQueue.length > 0 || state.zombies.some((z) => z.horde)).toBe(true);
  });
});
