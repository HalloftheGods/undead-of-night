import { describe, expect, it } from 'vitest';
import {
  LEAD_IN_SEC,
  LEVEL_ONE_HORDE_ONE_GAP_SEC,
  LEVEL_ONE_HORDE_ONE_SHARE,
  LEVEL_ONE_LEAD_IN_SEC,
  OPENING_SHAMBLERS,
  TICK_RATE,
} from '../shared/constants.ts';
import { LEVELS, leadInSeconds, levelPopulation } from '../shared/levels.ts';
import { createRng } from '../shared/rng.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { waveRoster } from '../shared/waves.ts';
import { SEED, stateOf } from './helpers/sim-harness.ts';

const SEEDS = [1, 2, 3, 4, 5];

function townAt(seed: number, startLevel: number) {
  const sim = new GameSimulation({ seed, startLevel });
  sim.addPlayer('a', 'a');
  return { sim, state: stateOf(sim) };
}

describe('level 1 opening', () => {
  it('pins the values', () => {
    expect(LEVEL_ONE_LEAD_IN_SEC).toBe(60);
    expect(OPENING_SHAMBLERS).toBe(3);
    expect(LEVEL_ONE_HORDE_ONE_SHARE).toBe(0.6);
    expect(LEVEL_ONE_HORDE_ONE_GAP_SEC).toBe(2.5);
  });

  it('cuts only the level 1 lead-in', () => {
    expect(leadInSeconds(1)).toBe(60);
    for (let level = 2; level <= LEVELS.length; level++) expect(leadInSeconds(level)).toBe(LEAD_IN_SEC);
    expect(leadInSeconds(0)).toBe(LEAD_IN_SEC);
    expect(townAt(SEED, 1).state.intermissionLeft).toBe(60);
    expect(townAt(SEED, 2).state.intermissionLeft).toBe(LEAD_IN_SEC);
  });

  it.each(SEEDS)('seed %i: slow walkers stand near the spawn, inside the usual population', (seed) => {
    const { state } = townAt(seed, 1);
    const { spawn } = state.map;
    const near = state.zombies.filter((z) => Math.hypot(z.x - spawn.x, z.y - spawn.y) <= 160);
    expect(near.length).toBeGreaterThanOrEqual(2);
    expect(near.length).toBeLessThanOrEqual(OPENING_SHAMBLERS);
    for (const z of near) {
      expect(z.type).toBe('walker');
      expect(z.speed).toBeLessThan(30);
    }
    expect(state.zombies.length).toBeLessThanOrEqual(levelPopulation(1));
  });

  it.each(SEEDS)('seed %i: a walker is on a player who stands still within 20 s', (seed) => {
    const { sim, state } = townAt(seed, 1);
    const [p] = state.players;
    let contact = false;
    for (let t = 0; t < 20 * TICK_RATE && !contact; t++) {
      sim.step();
      contact = p.health < p.maxHealth || state.zombies.some((z) => z.mode !== 'wander' && Math.hypot(z.x - p.x, z.y - p.y) < 40);
    }
    expect(contact).toBe(true);
  });

  it('leaves later levels without opening shamblers', () => {
    const { state } = townAt(SEED, 2);
    const { spawn } = state.map;
    expect(state.zombies.filter((z) => Math.hypot(z.x - spawn.x, z.y - spawn.y) <= 160)).toHaveLength(0);
  });

  it('softens Horde 1 on level 1 only', () => {
    const plain = waveRoster(1, createRng(1), { ...LEVELS[0], number: 9 }).length;
    expect(plain).toBe(8);
    expect(waveRoster(1, createRng(1), LEVELS[0]).length).toBe(5);
    expect(waveRoster(2, createRng(1), LEVELS[0]).length).toBe(11);
    for (const level of LEVELS.slice(1)) expect(waveRoster(1, createRng(1), level).length).toBe(Math.round(8 * level.difficulty));
  });

  it('lets Horde 1 out one body at a time', () => {
    const { sim, state } = townAt(SEED, 1);
    state.zombies = [];
    state.populationTarget = 0;
    state.players[0].health = 1e9;
    state.intermissionLeft = 0.01;
    for (let i = 0; i < 4; i++) sim.step();
    expect(state.wave).toBe(1);
    expect(state.spawnQueue.length + state.zombies.length).toBe(5);
    for (let t = 0; t < 5 * TICK_RATE; t++) sim.step();
    expect(state.zombies.filter((z) => z.horde).length).toBeLessThanOrEqual(3);
  });
});
