import { describe, expect, it } from 'vitest';
import { PLAYER_RADIUS } from '../shared/constants.ts';
import { emptyLoadout } from '../shared/loadout.ts';
import { campSizeFor } from '../shared/camp/camp-latch.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { circleHitsSolid } from '../shared/world-query.ts';
import { bankTrip, driveToTown, homeSim, playerNamed } from './helpers/home-harness.ts';
import { SEED, stateOf } from './helpers/sim-harness.ts';

/** A fresh room whose first player brings `highest`, and a second who has been less far. */
function roomOf(highest: number, second?: number): { sim: GameSimulation; state: ReturnType<typeof stateOf> } {
  const sim = new GameSimulation({ seed: SEED, home: true });
  sim.addPlayer('a', 'a', null, undefined, { loadout: emptyLoadout(), highest });
  if (second !== undefined) sim.addPlayer('b', 'b', null, undefined, { loadout: emptyLoadout(), highest: second });
  sim.snapshot();
  return { sim, state: stateOf(sim) };
}

describe('the camp size latch', () => {
  it('grows one size a level and stops at five', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 10].map(campSizeFor)).toEqual([1, 1, 2, 3, 4, 5, 5, 5]);
  });

  it('starts a fresh room at the size its first player has reached, standing on open ground', () => {
    const { state } = roomOf(4);
    expect(state.homeRun?.campSize).toBe(4);
    expect(state.homeRun?.campLevel).toBe(4);
    expect(state.map.camp?.size).toBe(4);
    const [p] = state.players;
    expect(circleHitsSolid(state.map, p.x, p.y, PLAYER_RADIUS)).toBe(false);
    expect(state.merchants.length).toBeGreaterThan(0);
  });

  it('grows on the arrival that banks a new level, not before', () => {
    const { sim, state } = homeSim();
    expect(state.homeRun?.campSize).toBe(1);
    driveToTown(sim, state, 2);
    expect(state.map.camp).toBeUndefined();
    bankTrip(sim, state);
    expect(state.homeRun?.roomHighest).toBe(3);
    expect(state.homeRun?.campSize).toBe(3);
    expect(state.map.camp?.size).toBe(3);
    for (const p of state.players) expect(circleHitsSolid(state.map, p.x, p.y, PLAYER_RADIUS)).toBe(false);
  });

  it('keeps its size and level when the furthest player leaves mid-visit', () => {
    const { sim, state } = roomOf(5, 2);
    const map = state.map;
    sim.removePlayer('a');
    sim.step();
    expect(state.homeRun?.roomHighest).toBe(2);
    expect(state.homeRun?.campSize).toBe(5);
    expect(state.homeRun?.campLevel).toBe(5);
    expect(state.map).toBe(map);
    expect(playerNamed(state, 'b').status).toBe('alive');
  });

  it('keeps its size when a further player joins mid-visit, until the next arrival', () => {
    const { sim, state } = roomOf(2);
    sim.addPlayer('b', 'b', null, undefined, { loadout: emptyLoadout(), highest: 5 });
    sim.step();
    expect(state.homeRun?.roomHighest).toBe(5);
    expect(state.homeRun?.campSize).toBe(2);
    expect(state.map.camp?.size).toBe(2);
  });
});
