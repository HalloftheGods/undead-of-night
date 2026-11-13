import { describe, expect, it } from 'vitest';
import { MERCHANT_IDS } from '../shared/home-protocol.ts';
import { emptyLoadout } from '../shared/loadout.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { bankTrip, driveToTown, quietTown } from './helpers/home-harness.ts';
import { openLevelExit, SEED, stateOf, steps } from './helpers/sim-harness.ts';

/** A solo home room whose player has rescued only `rescued`. */
function roomWith(rescued: typeof MERCHANT_IDS[number][]): { sim: GameSimulation; state: ReturnType<typeof stateOf> } {
  const sim = new GameSimulation({ seed: SEED, home: true });
  sim.addPlayer('a', 'a', null, undefined, { loadout: emptyLoadout(), highest: 1, rescued });
  sim.snapshot();
  return { sim, state: stateOf(sim) };
}

describe('the people to find', () => {
  it('starts a new campaign with an empty camp, and the first town holds Sarge', () => {
    const { sim, state } = roomWith([]);
    expect(state.merchants).toHaveLength(0);
    expect(state.homeRun?.campSize).toBe(1);
    driveToTown(sim, state, 1);
    expect(state.rescuees.map((r) => r.id)).toEqual(['quartermaster']);
    expect(state.rescuees[0].status).toBe('waiting');
  });

  it('puts no one in a town when the player has them all, as an older client does', () => {
    const sim = new GameSimulation({ seed: SEED, home: true });
    sim.addPlayer('a', 'a');
    sim.snapshot();
    const state = stateOf(sim);
    expect(state.merchants).toHaveLength(4);
    driveToTown(sim, state, 1);
    expect(state.rescuees).toHaveLength(0);
  });

  it('frees on a held key, follows, and comes home aboard the van, growing the camp', () => {
    const { sim, state } = roomWith([]);
    driveToTown(sim, state, 1);
    quietTown(state);
    const [person] = state.rescuees;
    const p = state.players[0];
    p.x = person.x + 10;
    p.y = person.y;
    p.searchHeld = true;
    for (let i = 0; i < 100 && person.status === 'waiting'; i++) {
      p.searchHeld = true;
      p.moving = false;
      steps(sim, 1);
    }
    expect(person.status).toBe('following');
    p.searchHeld = false;
    openLevelExit(state);
    const van = state.exit;
    expect(van).not.toBeNull();
    person.x = van!.x + 20;
    person.y = van!.y;
    bankTrip(sim, state);
    expect(p.home?.receipt?.rescued).toEqual(['quartermaster']);
    expect(p.home?.rescued).toContain('quartermaster');
    expect(state.homeRun?.campSize).toBe(2);
    expect(state.merchants.map((m) => m.id)).toEqual(['quartermaster']);
  });
});
