import { describe, expect, it } from 'vitest';
import { containerLoot } from '../shared/container-loot.ts';
import { KNIFE_COOLDOWN_SEC, KNIFE_STAGGER_IMMUNE_SEC, MELEE_COOLDOWN_SEC, MELEE_DAMAGE, MELEE_MAX_TARGETS, TICK_RATE } from '../shared/constants.ts';
import { LOOT_RULES } from '../shared/loot.ts';
import { KNIFE_DAMAGE } from '../shared/melee.ts';
import { moveToNextTown } from '../shared/level-change.ts';
import type { SimState } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { addZombie, eventsOf, input, quietSim, stateOf, steps } from './helpers/sim-harness.ts';

function armed() {
  const quiet = quietSim();
  const [p] = quiet.state.players;
  p.knife = true;
  return { ...quiet, p };
}

function dropKnife(state: SimState, x: number, y: number): void {
  state.pickups.push({ id: 'test-knife', type: 'knife', x, y, ttl: null, rounds: 0 });
}

describe('finding a knife', () => {
  it('is picked up and carried', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    expect(p.knife).toBe(false);
    dropKnife(state, p.x, p.y);
    sim.step();
    expect(p.knife).toBe(true);
    expect(state.pickups).toEqual([]);
    expect(sim.snapshot().players[0].knife).toBe(true);
  });

  it('leaves a second one for a teammate', () => {
    const { sim, state, p } = armed();
    dropKnife(state, p.x, p.y);
    sim.step();
    expect(state.pickups.length).toBe(1);
  });

  it('turns up on the floor of diners, houses and garages', () => {
    for (const kind of ['diner', 'house', 'garage'] as const) expect(LOOT_RULES[kind].table.knife).toBeGreaterThan(0);
  });

  it('turns up in a town\'s containers', () => {
    const knives = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((seed) => containerLoot(stateOf(new GameSimulation({ seed }))).filter((item) => item.type === 'knife'));
    expect(knives.length).toBeGreaterThan(3);
  });
});

describe('the stab', () => {
  it('hits four to five times as hard as a shove', () => {
    expect(KNIFE_DAMAGE / MELEE_DAMAGE).toBeGreaterThanOrEqual(4);
    expect(KNIFE_DAMAGE / MELEE_DAMAGE).toBeLessThanOrEqual(5);
  });

  it('lands that damage, and only with the knife', () => {
    const { sim, state, p } = armed();
    const zombie = addZombie(state, 'bloater', p.x + 12, p.y);
    const health = zombie.health;
    sim.setInput('a', input({ seq: 1, melee: true }));
    sim.step();
    expect(health - zombie.health).toBe(KNIFE_DAMAGE);

    p.knife = false;
    zombie.staggerImmuneLeft = 0;
    zombie.x = p.x + 12;
    zombie.y = p.y;
    const after = zombie.health;
    p.meleeCooldown = 0;
    sim.setInput('a', input({ seq: 2, melee: true }));
    sim.step();
    expect(after - zombie.health).toBe(MELEE_DAMAGE);
  });

  it('makes no noise', () => {
    const { sim, state, p } = armed();
    addZombie(state, 'bloater', p.x + 12, p.y);
    sim.setInput('a', input({ seq: 1, melee: true }));
    sim.step();
    expect(state.noises).toEqual([]);
  });

  it('keeps the two-target limit', () => {
    const { sim, state, p } = armed();
    const crowd = [addZombie(state, 'bloater', p.x + 10, p.y), addZombie(state, 'bloater', p.x + 12, p.y + 4), addZombie(state, 'bloater', p.x + 14, p.y - 4)];
    sim.setInput('a', input({ seq: 1, melee: true }));
    sim.step();
    expect(crowd.filter((z) => z.health < z.maxHealth).length).toBe(MELEE_MAX_TARGETS);
  });

  it('keeps stagger immunity: a body cannot be stabbed twice within the knife window', () => {
    const { sim, state, p } = armed();
    const zombie = addZombie(state, 'brute', p.x + 12, p.y);
    sim.setInput('a', input({ seq: 1, melee: true }));
    sim.step();
    const once = zombie.health;
    let seq = 2;
    const ticks = Math.floor(KNIFE_STAGGER_IMMUNE_SEC * TICK_RATE) - 2;
    for (let tick = 0; tick < ticks; tick++) {
      zombie.x = p.x + 12;
      zombie.y = p.y;
      sim.setInput('a', input({ seq: seq++, melee: true }));
      sim.step();
    }
    expect(KNIFE_COOLDOWN_SEC).toBeLessThan(MELEE_COOLDOWN_SEC);
    expect(zombie.health).toBe(once);

    // After knife stagger window, the second hit lands smoothly
    p.meleeCooldown = 0;
    zombie.staggerImmuneLeft = 0;
    zombie.x = p.x + 12;
    zombie.y = p.y;
    sim.setInput('a', input({ seq, melee: true }));
    sim.step();
    expect(zombie.health).toBe(once - KNIFE_DAMAGE);
  });
});

describe('keeping it', () => {
  it('comes along to the next town', () => {
    const { state, p } = armed();
    moveToNextTown(state);
    expect(p.knife).toBe(true);
  });

  it('is lost with the rest of the kit on death', () => {
    const { sim, state } = quietSim(['a', 'b']);
    const [a] = state.players;
    a.knife = true;
    a.status = 'dead';
    moveToNextTown(state);
    expect(a.status).toBe('alive');
    expect(a.knife).toBe(false);
    expect(sim.snapshot().players[0].knife).toBe(false);
  });

  it('is gone on a new run', () => {
    const { sim, p } = armed();
    sim.restart();
    expect(p.knife).toBe(false);
  });

  it('survives a teammate\'s revive', () => {
    const { sim, state } = quietSim(['a', 'b']);
    const [a, b] = state.players;
    a.knife = true;
    a.status = 'downed';
    a.bleedout = 30;
    b.x = a.x;
    b.y = a.y;
    steps(sim, 4 * TICK_RATE);
    expect(a.status).toBe('alive');
    expect(a.knife).toBe(true);
    expect(eventsOf(sim.snapshot(), 'player_dead')).toEqual([]);
  });
});
