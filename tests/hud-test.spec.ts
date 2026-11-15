import { describe, expect, it } from 'vitest';
import { hudTestOn } from '../src/game/dev/hud-test.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { hurtPlayer } from '../shared/player-health.ts';
import type { SimState } from '../shared/sim-state.ts';

const TICKS_PLAYED = 1200;

function stateOf(sim: GameSimulation): SimState {
  return (sim as unknown as { sim: SimState }).sim;
}

function playedTown(hudTest: boolean): SimState {
  const sim = new GameSimulation({ seed: 7, testDrive: true, hudTest, workbench: 'off' });
  sim.addPlayer('p1', 'Tester', null, 0);
  for (let tick = 0; tick < TICKS_PLAYED; tick++) sim.step();
  return stateOf(sim);
}

describe('hudTestOn', () => {
  it('opens only on a local dev build asked for with ?dev=hud', () => {
    expect(hudTestOn('?dev=hud', true, 'localhost')).toBe(true);
    expect(hudTestOn('?dev=hud', false, 'localhost')).toBe(false);
    expect(hudTestOn('?dev=hud', true, 'example.com')).toBe(false);
    expect(hudTestOn('?dev=inventory', true, 'localhost')).toBe(false);
    expect(hudTestOn('', true, 'localhost')).toBe(false);
  });
});

describe('HUD test town', () => {
  it('spawns no zombies, while a normal town is peopled', () => {
    const normal = playedTown(false);
    const hudTest = playedTown(true);
    expect(normal.zombies.length).toBeGreaterThan(0);
    expect(hudTest.zombies.length).toBe(0);
  });

  it('keeps the survivor alive through damage that would otherwise down them', () => {
    const state = playedTown(true);
    const survivor = state.players[0];
    hurtPlayer(state, survivor, 10_000);
    expect(survivor.status).toBe('alive');
    expect(survivor.health).toBe(1);
  });
});
