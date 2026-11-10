import { describe, expect, it } from 'vitest';
import { TICK_RATE } from '../shared/constants.ts';
import { FlowField } from '../shared/flow-field.ts';
import type { Point } from '../shared/flow-field.ts';
import { TILE_SIZE } from '../shared/protocol.ts';
import type { ZombieType } from '../shared/protocol.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { addZombie, stateOf, stepUntil } from './helpers/sim-harness.ts';

const ARRIVAL_TICKS = TICK_RATE * 5;
/** Three survivors backed into the same corner of a building, a tile-edge from the furniture, seed 5150. */
const STACKED_IN_A_CORNER: readonly Point[] = [
  { x: 1888.1, y: 912.1 },
  { x: 1888.24, y: 912.02 },
  { x: 1887.92, y: 912.23 },
];

/** A real town from a known seed, emptied, with one body hunting players who stay put. */
function huntInTown(seed: number, type: ZombieType, prey: readonly Point[], body: Point) {
  const sim = new GameSimulation({ seed });
  prey.forEach((_, index) => sim.addPlayer(`p${index}`, `p${index}`));
  const state = stateOf(sim);
  state.intermissionLeft = 1e6;
  state.populationTarget = 0;
  state.pickups = [];
  state.zombies = [];
  state.players.forEach((p, index) => {
    p.x = prey[index].x;
    p.y = prey[index].y;
  });
  const zombie = addZombie(state, type, body.x, body.y);
  sim.step();
  return { sim, state, zombie };
}

/**
 * Pressed into a corner, a player stands on no tile of the flow field, which ends a few strides off.
 * From there a body walks at them through part-blocked tiles, and in each of these scenes the field
 * used to send it back out of those tiles, for as long as the player stayed put.
 */
describe('a body closing on a player cornered behind furniture', () => {
  const scenes = [
    { name: 'a walker past a corner of the furniture', seed: 5150, type: 'walker', prey: STACKED_IN_A_CORNER, body: { x: 1921, y: 933 } },
    { name: 'a bloater beside a shelf', seed: 7, type: 'bloater', prey: [{ x: 1328, y: 920 }], body: { x: 1280, y: 914 } },
  ] as const;

  for (const { name, seed, type, prey, body } of scenes) {
    it(`${name} gets there`, () => {
      const { sim, state, zombie } = huntInTown(seed, type, prey, body);
      expect(state.flow.distanceAt(prey[0].x, prey[0].y)).toBe(Infinity);
      expect(stepUntil(sim, () => zombie.attacking, ARRIVAL_TICKS)).toBeGreaterThanOrEqual(0);
    });
  }
});

describe('flow field seeds', () => {
  const fieldOf = (seeds: readonly Point[]): number[] => {
    const { map } = new GameSimulation({ seed: 5150 });
    const field = new FlowField(map);
    field.recompute(seeds);
    const distances: number[] = [];
    for (let row = 0; row < map.rows; row++) {
      for (let col = 0; col < map.cols; col++) distances.push(field.distanceAt((col + 0.5) * TILE_SIZE, (row + 0.5) * TILE_SIZE));
    }
    return distances;
  };

  it('players sharing a corner seed the tiles one of them would', () => {
    expect(fieldOf(STACKED_IN_A_CORNER)).toEqual(fieldOf(STACKED_IN_A_CORNER.slice(0, 1)));
  });
});
