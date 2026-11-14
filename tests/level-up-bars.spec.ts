import { describe, expect, it } from 'vitest';
import { GameSimulation } from '../shared/simulation.ts';
import { maybeDropBarOnKill } from '../shared/pickups.ts';
import type { PlayerState } from '../shared/sim-state.ts';

function setup() {
  const game = new GameSimulation({ seed: 7 });
  game.addPlayer('p1', 'Player 1', null, 0);
  const sim = (game as unknown as { sim: { players: PlayerState[]; pickups: { type: string; candyId?: string }[] } }).sim;
  return { game, sim, player: sim.players[0] };
}

describe('level up boon bars', () => {
  it('gives one Full-Size Bar per level reached', () => {
    const { game, player } = setup();
    game.giveBoon('p1', 3);
    expect(player.sugar.find((s) => s.id === 'full_size_bar')).toBeDefined();
    expect(player.barDropsOwed).toBe(1);
  });

  it('drops the owed bar on the next kill, then only sometimes', () => {
    const { game, sim, player } = setup();
    game.giveBoon('p1', 1);
    maybeDropBarOnKill(sim as never, 0, 0, player);
    expect(sim.pickups.filter((p) => p.candyId === 'full_size_bar')).toHaveLength(1);
    expect(player.barDropsOwed).toBe(0);
    expect(player.barDropsLive).toBe(true);
  });

  it('drops nothing when there is no killer', () => {
    const { game, sim } = setup();
    game.giveBoon('p1', 1);
    maybeDropBarOnKill(sim as never, 0, 0, undefined);
    expect(sim.pickups.filter((p) => p.candyId === 'full_size_bar')).toHaveLength(0);
  });
});
