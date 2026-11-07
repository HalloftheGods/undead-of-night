import { describe, expect, it } from 'vitest';
import { createRng } from '../shared/rng.ts';
import type { GameSimulation } from '../shared/simulation.ts';
import { bankTrip, driveToTown, homeSim } from './helpers/home-harness.ts';
import { input, SEED } from './helpers/sim-harness.ts';

/**
 * Draws a seeded home run takes from `sim.rng()` with the overrun switched off: a while in the bunker, a trip to the first town
 * with both players moving and shooting, the van home, and a while back in the bunker. A slice that adds or removes a draw on
 * the off path changes this, and must not.
 *
 * The town itself draws from the same rng, so a change to what a town is built from moves it too: furniture against the side
 * walls (#14) and rooms behind back doors (#17) took it from 4878 to 5337, and turning the overrun on (#4) left it alone.
 * Re-record it only for a change like those, after checking the overrun code is not what moved it.
 */
const OFF_PATH_DRAWS = 5337;

const BUNKER_TICKS = 200;
const TOWN_TICKS = 600;
const HOME_AGAIN_TICKS = 100;

function play(sim: GameSimulation, ticks: number, from: number): void {
  for (let i = 0; i < ticks; i++) {
    const tick = from + i;
    sim.setInput('a', input({ seq: tick, right: tick % 160 < 80, left: tick % 160 >= 80, angle: tick * 0.05, shoot: tick % 9 < 4 }));
    sim.setInput('b', input({ seq: tick, up: tick % 240 < 120, down: tick % 240 >= 120, angle: -tick * 0.03, shoot: true, reload: tick % 90 === 0 }));
    sim.step();
  }
}

function drawsOfAnOffRun(): { draws: number; overrunSeen: boolean; levels: number[] } {
  const rng = createRng(SEED ^ 0x5eed);
  let draws = 0;
  const counted = (): number => {
    draws += 1;
    return rng();
  };
  const { sim, state } = homeSim({ players: ['a', 'b'], random: counted });
  let overrunSeen = false;
  const levels: number[] = [];
  const look = (): void => {
    overrunSeen ||= state.overrun !== null || sim.snapshot().home?.overrun !== undefined;
    levels.push(state.level);
  };
  play(sim, BUNKER_TICKS, 0);
  look();
  driveToTown(sim, state);
  play(sim, TOWN_TICKS, BUNKER_TICKS);
  look();
  bankTrip(sim, state);
  play(sim, HOME_AGAIN_TICKS, BUNKER_TICKS + TOWN_TICKS);
  look();
  return { draws, overrunSeen, levels };
}

describe('the overrun switched off', () => {
  it('draws from the sim rng exactly as the game did before the overrun', () => {
    const run = drawsOfAnOffRun();
    expect(run.overrunSeen).toBe(false);
    expect(run.levels).toEqual([0, 1, 0]);
    expect(run.draws).toBe(OFF_PATH_DRAWS);
    expect(drawsOfAnOffRun().draws).toBe(run.draws);
  }, 30_000);
});
