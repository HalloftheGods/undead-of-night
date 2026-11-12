import { describe, expect, it } from 'vitest';
import {
  CHAIN_WINDOW_SEC,
  chainKill,
  chainMultiplier,
  HEADSHOT_CHAIN_WINDOW_SEC,
  chainHeadshot,
  headshotChainMultiplier,
} from '../shared/kill-chain.ts';
import { TICK_DT } from '../shared/constants.ts';
import type { SimState } from '../shared/sim-state.ts';

const simAt = (tick: number) => ({ tick, killChains: new Map(), headshotChains: new Map(), players: [] }) as unknown as SimState;

describe('kill chains', () => {
  it('pays a quarter more for each kill in a chain, up to double', () => {
    expect([1, 2, 3, 4, 5, 9].map(chainMultiplier)).toEqual([1, 1.25, 1.5, 1.75, 2, 2]);
  });

  it('chains kills inside the window and starts over after it', () => {
    const sim = simAt(100);
    expect(chainKill(sim, 'p1')).toBe(1);
    sim.tick += Math.round(CHAIN_WINDOW_SEC / TICK_DT);
    expect(chainKill(sim, 'p1')).toBe(2);
    expect(chainKill(sim, 'p2')).toBe(1);
    sim.tick += Math.round(CHAIN_WINDOW_SEC / TICK_DT) + 1;
    expect(chainKill(sim, 'p1')).toBe(1);
  });
});

describe('headshot chains', () => {
  it('scales multipliers by 0.5 per consecutive headshot up to 3x', () => {
    expect([1, 2, 3, 4, 5, 8].map(headshotChainMultiplier)).toEqual([1, 1.5, 2.0, 2.5, 3.0, 3.0]);
  });

  it('chains headshots inside the generous 3.5s window and resets after expiration', () => {
    const sim = simAt(100);
    expect(chainHeadshot(sim, 'p1')).toBe(1);
    // Advance 3.0s (within 3.5s window)
    sim.tick += Math.round(3.0 / TICK_DT);
    expect(chainHeadshot(sim, 'p1')).toBe(2);
    expect(chainHeadshot(sim, 'p2')).toBe(1);

    // Advance 4.0s (past 3.5s window)
    sim.tick += Math.round(HEADSHOT_CHAIN_WINDOW_SEC / TICK_DT) + 1;
    expect(chainHeadshot(sim, 'p1')).toBe(1);
  });
});

describe('kill chains in the sim', () => {
  it('counts a second quick kill in the chain and says so on the event', async () => {
    const { damageZombie } = await import('../shared/combat.ts');
    const { addZombie, quietSim } = await import('./helpers/sim-harness.ts');
    const { state } = quietSim(['a']);
    const [a] = state.players;
    const first = addZombie(state, 'walker', a.x + 200, a.y);
    const second = addZombie(state, 'walker', a.x + 220, a.y);
    const before = a.score;
    damageZombie(state, first, 1e6, 0, 'a');
    damageZombie(state, second, 1e6, 0, 'a');
    expect(a.score - before).toBe(2);
    const deaths = state.events.filter((event) => event.type === 'zombie_die');
    expect(deaths.map((event) => event.type === 'zombie_die' && event.chain)).toEqual([1, 2]);
  });

  it('flags the chain on the event only when it changed the points', async () => {
    const { damageZombie } = await import('../shared/combat.ts');
    const { addZombie, quietSim } = await import('./helpers/sim-harness.ts');
    const { state } = quietSim(['a']);
    const [a] = state.players;
    for (const gap of [200, 220, 240]) damageZombie(state, addZombie(state, 'walker', a.x + gap, a.y), 1e6, 0, 'a');
    const deaths = state.events.filter((e) => e.type === 'zombie_die');
    expect(deaths.map((e) => e.type === 'zombie_die' && e.points)).toEqual([1, 1, 2]);
    expect(deaths.map((e) => e.type === 'zombie_die' && e.chainPaid)).toEqual([false, false, true]);
  });
});
