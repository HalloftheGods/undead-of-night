import { describe, expect, it } from 'vitest';
import { candiesInBowl } from '../shared/candy.ts';
import { HORDE_CALL_LEAD, armHordeSurge } from '../shared/waves.ts';
import { quietSim, steps } from './helpers/sim-harness.ts';
import { containerGridFor, type Container } from '../shared/containers.ts';

const bowl = { id: 3, kind: 'bowl', buildingKind: 'house' } as unknown as Container;

describe('candy bowl label', () => {
  it('always says TAKE ONE, and every bowl is filled to its max: one piece per open grid cell', () => {
    const grid = containerGridFor(bowl);
    const max = grid.cols * grid.rows - (grid.blocked?.length ?? 0);
    expect(max).toBeGreaterThan(1);
    for (let id = 0; id < 200; id += 1) {
      const loot = candiesInBowl(12345, { ...bowl, id });
      expect(loot.label).toBe('TAKE ONE');
      expect(loot.candies).toHaveLength(max);
    }
  });
});

describe('horde surge from a second bowl piece', () => {
  it('in a lull, cuts the countdown to the warning lead', () => {
    const { state } = quietSim();
    state.phase = 'intermission';
    state.wave = 0;
    state.intermissionLeft = 60;
    armHordeSurge(state);
    expect(state.hordeSurges).toBe(1);
    expect(state.intermissionLeft).toBe(HORDE_CALL_LEAD);
  });

  it('keeps a shorter lull as it is', () => {
    const { state } = quietSim();
    state.phase = 'intermission';
    state.wave = 0;
    state.intermissionLeft = 4;
    armHordeSurge(state);
    expect(state.intermissionLeft).toBe(4);
  });

  it('mid-horde, only arms the next horde and leaves the fight alone', () => {
    const { state } = quietSim();
    state.phase = 'wave';
    state.wave = 1;
    state.hordeLeft = 50;
    armHordeSurge(state);
    expect(state.hordeSurges).toBe(1);
    expect(state.phase).toBe('wave');
    expect(state.hordeLeft).toBe(50);
  });

  it('stacks, and is spent when the next horde starts', () => {
    const { sim, state } = quietSim();
    state.phase = 'intermission';
    state.wave = 0;
    state.intermissionLeft = 60;
    armHordeSurge(state);
    armHordeSurge(state);
    expect(state.hordeSurges).toBe(2);
    state.intermissionLeft = 0.01;
    // A few ticks run the lull out and start the horde.
    steps(sim, 3);
    expect(state.phase).toBe('wave');
    expect(state.hordeSurges).toBe(0);
  });

  it('does nothing once the last horde is behind us', () => {
    const { state } = quietSim();
    state.phase = 'intermission';
    state.level = 1;
    state.wave = 999;
    state.intermissionLeft = 60;
    armHordeSurge(state);
    expect(state.hordeSurges ?? 0).toBe(0);
    expect(state.intermissionLeft).toBe(60);
  });
});
