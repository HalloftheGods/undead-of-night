import { describe, expect, it } from 'vitest';
import { SLEEPER_COUNT, SLEEPER_RISE_SEC, SLEEPER_WAKE_RANGE } from '../shared/constants.ts';
import { makeNoise } from '../shared/zombie-senses.ts';
import { seedPopulation } from '../shared/town-population.ts';
import { addRoamer, quietSim, steps } from './helpers/sim-harness.ts';

function lyingBody() {
  const { sim, state } = quietSim();
  const [p] = state.players;
  const body = addRoamer(state, 'walker', p.x + 400, p.y);
  body.dormant = true;
  body.speed = 0;
  return { sim, state, p, body };
}

describe('dead people on the streets', () => {
  it('seeds some bodies lying about, away from the spawn', () => {
    const { state } = quietSim();
    state.populationTarget = 0;
    seedPopulation(state);
    const lying = state.zombies.filter((z) => z.dormant);
    expect(lying.length).toBeGreaterThan(0);
    expect(lying.length).toBeLessThanOrEqual(SLEEPER_COUNT);
  });

  it('shows in the snapshot as dormant', () => {
    const { sim, body } = lyingBody();
    const seen = sim.snapshot().zombies.find((z) => z.id === body.id);
    expect(seen?.dormant).toBe(true);
  });

  it('stays down while nobody is near', () => {
    const { sim, body } = lyingBody();
    steps(sim, 200);
    expect(body.dormant).toBe(true);
  });

  it('may get up when a survivor stands over it, and then hunts', () => {
    const { sim, p, body } = lyingBody();
    body.x = p.x + SLEEPER_WAKE_RANGE / 2;
    body.y = p.y;
    steps(sim, 400);
    expect(body.dormant).toBeUndefined();
    expect(body.mode).toBe('hunt');
  });

  it('gets up at a noise and stands for the rise before moving', () => {
    const { state, body } = lyingBody();
    makeNoise(state, body.x, body.y, 100);
    expect(body.dormant).toBeUndefined();
    expect(body.recoveryLeft).toBe(SLEEPER_RISE_SEC);
  });

  it('shows the rise in the snapshot, then clears it', () => {
    const { sim, state, body } = lyingBody();
    makeNoise(state, body.x, body.y, 100);
    const rising = sim.snapshot().zombies.find((z) => z.id === body.id);
    expect(rising?.rising).toBeGreaterThan(0);
    steps(sim, Math.ceil(SLEEPER_RISE_SEC * 30) + 5);
    const done = sim.snapshot().zombies.find((z) => z.id === body.id);
    expect(done?.rising).toBeUndefined();
  });
});
