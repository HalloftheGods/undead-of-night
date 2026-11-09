import { describe, expect, it } from 'vitest';
import {
  CANDIES,
  CANDY_ORDER,
  CANDY_SEC,
  candyIn,
  candySpeed,
  FULL_SIZE_SEC,
  sugarOf,
  takeCandy,
  bagOf,
} from '../shared/candy.ts';
import { POPPING_REACH, SPINNER_RADIUS } from '../shared/throwables.ts';
import { townContainers } from '../shared/containers.ts';
import { hurtPlayer } from '../shared/player-health.ts';
import type { CandyId } from '../shared/protocol.ts';
import type { PlayerState } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { addZombie, eventsOf, input, quietSim, steps } from './helpers/sim-harness.ts';
import { damageZombie } from '../shared/combat.ts';
import { TICK_RATE } from '../shared/constants.ts';

const HOMES = new Set(['house', 'apartment']);
const SHOPS = new Set(['gun_shop', 'warehouse']);

function eat(sim: GameSimulation, p: PlayerState, seq: number, pick: true | CandyId = true): void {
  sim.setInput(p.id, input({ seq, eat: pick }));
  sim.step();
  sim.setInput(p.id, input({ seq: seq + 1 }));
}

function carrying(p: PlayerState, ...ids: CandyId[]): void {
  p.candy = [...ids];
}

describe('candy', () => {
  it('has twelve kinds, all named and described', () => {
    expect(CANDY_ORDER).toHaveLength(12);
    for (const id of CANDY_ORDER) expect(CANDIES[id].blurb.length).toBeGreaterThan(0);
  });

  it('hides candy in the same containers for everyone, and most of it in homes', () => {
    const map = new GameSimulation({ seed: 21 }).map;
    const containers = townContainers(map);
    const twice = new GameSimulation({ seed: 21 }).map;
    expect(containers.map((c) => candyIn(map.seed, c))).toEqual(townContainers(twice).map((c) => candyIn(twice.seed, c)));
    expect(containers.filter((c) => c.kind === 'car').every((c) => candyIn(map.seed, c) === null)).toBe(true);
    let homes = 0;
    let shops = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const town = new GameSimulation({ seed }).map;
      for (const c of townContainers(town)) {
        const found = candyIn(town.seed, c) !== null;
        if (!found) continue;
        const home = HOMES.has(c.buildingKind);
        const shop = SHOPS.has(c.buildingKind);
        if (home) homes += 1;
        if (shop) shops += 1;
      }
    }
    expect(homes).toBeGreaterThan(shops);
    // Builds thirty towns, so it scales with machine load; the global 20s cap is too tight.
  }, 120_000);

  it('carries as much as it finds: the bag has no bottom', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    for (let i = 0; i < 30; i++) expect(takeCandy(p, 'jawbreaker')).toBe('jawbreaker');
    expect(takeCandy(p, 'ghost_gum')).toBe('ghost_gum');
    expect(p.candy).toHaveLength(31);
    expect(bagOf(p.candy)).toEqual({ jawbreaker: 30, ghost_gum: 1 });
    expect(sim.snapshot().players[0].bag).toEqual({ jawbreaker: 30, ghost_gum: 1 });
  });

  it('eats the candy picked out of the bag, not the first one in it', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    carrying(p, 'pumpkin_fizz', 'jawbreaker', 'ghost_gum');
    eat(sim, p, 1, 'ghost_gum');
    expect(p.candy).toEqual(['pumpkin_fizz', 'jawbreaker']);
    expect(p.sugar.map((s) => s.id)).toEqual(['ghost_gum']);
    eat(sim, p, 3, 'bat_bites');
    expect(p.candy).toEqual(['pumpkin_fizz', 'jawbreaker']);
  });

  it('eats the first candy in the bag on a plain eat, which works for about a horde and then wears off', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    carrying(p, 'pumpkin_fizz', 'jawbreaker');
    eat(sim, p, 1);
    expect(p.candy).toEqual(['jawbreaker']);
    expect(sugarOf(p, 'pumpkin_fizz')).toBe(1);
    expect(candySpeed(p)).toBeCloseTo(1.25);
    const frame = sim.snapshot();
    expect(eventsOf(frame, 'candy_eaten')).toMatchObject([{ type: 'candy_eaten', playerId: 'a', candy: 'pumpkin_fizz' }]);
    expect(frame.players[0].sugar?.[0].id).toBe('pumpkin_fizz');
    steps(sim, Math.ceil(CANDY_SEC * TICK_RATE) + 1);
    expect(sugarOf(p, 'pumpkin_fizz')).toBe(0);
  });

  it('stacks time, not strength: the same candy again makes its boost last longer', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    carrying(p, 'jawbreaker', 'jawbreaker', 'ghost_gum');
    eat(sim, p, 1, 'jawbreaker');
    eat(sim, p, 3, 'jawbreaker');
    expect(p.sugar).toHaveLength(1);
    expect(p.sugar[0].left).toBeCloseTo(CANDY_SEC * 2, 0);
    expect(p.sugar[0].total).toBeCloseTo(p.sugar[0].left, 5);
    expect(sugarOf(p, 'jawbreaker')).toBe(1);
    expect(p.candy).toEqual(['ghost_gum']);
    const eaten = eventsOf(sim.snapshot(), 'candy_eaten');
    expect(eaten.map((each) => each.stacked === true)).toEqual([false, true]);
  });

  it('eats several picks made between two ticks, in the order picked', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    carrying(p, 'jawbreaker', 'ghost_gum', 'jawbreaker');
    sim.setInput(p.id, input({ seq: 1, eat: 'ghost_gum' }));
    sim.setInput(p.id, input({ seq: 2, eat: 'jawbreaker' }));
    sim.setInput(p.id, input({ seq: 3, eat: 'jawbreaker' }));
    sim.step();
    expect(p.candy).toEqual([]);
    expect(p.sugar.map((s) => s.id)).toEqual(['ghost_gum', 'jawbreaker']);
  });

  it('halves damage under a Jawbreaker', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    carrying(p, 'jawbreaker');
    eat(sim, p, 1);
    const before = p.health;
    hurtPlayer(state, p, 20);
    expect(before - p.health).toBe(10);
  });

  it('heals the killer under Witch\'s Brittle', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    carrying(p, 'witchs_brittle');
    eat(sim, p, 1);
    p.health = 50;
    const z = addZombie(state, 'walker', p.x + 300, p.y);
    damageZombie(state, z, 1e6, 0, 'a');
    expect(p.health).toBe(52);
  });

  it('picks a survivor straight back up once with a Caramel Apple', () => {
    const { sim, state } = quietSim(['a', 'b']);
    const [p] = state.players;
    carrying(p, 'caramel_apple');
    eat(sim, p, 1);
    hurtPlayer(state, p, 1000);
    expect(p.status).toBe('alive');
    expect(p.health).toBe(Math.ceil(p.maxHealth * 0.3));
    expect(p.sugar).toEqual([]);
    hurtPlayer(state, p, 1000);
    expect(p.status).toBe('downed');
  });

  it('throws a spinner\'s sparks half as far again under Popping Eyeballs', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    carrying(p, 'popping_eyeballs');
    eat(sim, p, 1);
    p.fireworks = 1;
    p.throwCooldown = 0;
    sim.setInput('a', input({ seq: 3, spinner: true }));
    sim.step();
    const [lit] = eventsOf(sim.snapshot(), 'spinner_lit');
    expect(lit.radius).toBeCloseTo(SPINNER_RADIUS * (1 + POPPING_REACH));
    expect(state.spinners[0].radius).toBeCloseTo(SPINNER_RADIUS * (1 + POPPING_REACH));
    expect(p.fireworks).toBe(0);
  });

  it('gives everything at half strength, for a short while, from a Full-Size Bar', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    carrying(p, 'full_size_bar');
    eat(sim, p, 1);
    expect(p.sugar[0].left).toBeCloseTo(FULL_SIZE_SEC, 0);
    expect(sugarOf(p, 'sour_skulls')).toBe(0.5);
    expect(candySpeed(p)).toBeCloseTo(1.125);
  });

  it('wears off when a survivor goes down, and is gone on a fresh start', () => {
    const { sim, state } = quietSim(['a', 'b']);
    const [p] = state.players;
    carrying(p, 'jawbreaker', 'ghost_gum');
    eat(sim, p, 1);
    hurtPlayer(state, p, 1000);
    expect(p.status).toBe('downed');
    expect(p.sugar).toEqual([]);
    expect(p.candy).toEqual(['ghost_gum']);
  });
});
