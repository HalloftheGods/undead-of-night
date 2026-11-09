import { describe, expect, it } from 'vitest';
import { parseClientPacket } from '../server/packets.ts';
import { townContainers } from '../shared/containers.ts';
import { rebuildZombieGrid } from '../shared/zombies.ts';
import {
  SPARK_PLAYER_DAMAGE,
  SPINNER_SEC,
  FOUNTAIN_CARRY,
  FLARE_SEC,
  FOUNTAIN_SEC,
  FOUNTAIN_SPARK_RADIUS,
  FIREWORK_CARRY,
  SPINNER_RADIUS,
  SPINNER_RANGE,
  stashIn,
  takeStash,
} from '../shared/throwables.ts';
import { addRoamer, eventsOf, input, quietSim, steps } from './helpers/sim-harness.ts';

describe('spinner and fountain fireworks', () => {
  it('a spinner spends a firework and no bottle, lights a zombie in its sparks, and burns out', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.fireworks = 1;
    p.bottles = 1;
    const aim = { x: p.x + 1, y: p.y + 60 };
    const z = addRoamer(state, 'brute', aim.x, aim.y);
    rebuildZombieGrid(state);
    sim.setInput('a', input({ seq: 1, aimX: aim.x, aimY: aim.y, spinner: true }));
    steps(sim, 1);
    const [burst] = eventsOf(sim.snapshot(), 'spinner_lit');
    expect(burst).toBeDefined();
    expect(Math.hypot(burst.x - p.x, burst.y - p.y)).toBeLessThanOrEqual(SPINNER_RANGE + 0.01);
    expect(p.fireworks).toBe(0);
    expect(p.bottles).toBe(1);
    expect(burst.radius).toBe(SPINNER_RADIUS);
    steps(sim, 2);
    expect(z.status?.burnLeft ?? 0).toBeGreaterThan(0);
    steps(sim, Math.ceil(SPINNER_SEC * 30) + 2);
    expect(state.spinners).toEqual([]);
  });

  it('lights nothing without a firework', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.fireworks = 0;
    p.bottles = 2;
    sim.setInput('a', input({ seq: 1, spinner: true }));
    steps(sim, 1);
    expect(eventsOf(sim.snapshot(), 'spinner_lit')).toEqual([]);
    expect(p.bottles).toBe(2);
  });

  it('burns a survivor who stands in it', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    state.spinners.push({ x: p.x, y: p.y, radius: SPINNER_RADIUS, ownerId: p.id, left: SPINNER_SEC, noiseLeft: 1 });
    const before = p.health;
    steps(sim, 30);
    expect(p.health).toBeLessThanOrEqual(before - SPARK_PLAYER_DAMAGE);
  });

  it('a fountain lands, hisses for its time, and goes out', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.fountains = 1;
    sim.setInput('a', input({ seq: 1, aimX: p.x + 1, aimY: p.y + 80, fountain: true }));
    steps(sim, 1);
    expect(eventsOf(sim.snapshot(), 'fountain_lit')).toHaveLength(1);
    expect(p.fountains).toBe(0);
    expect(state.lures).toHaveLength(1);
    steps(sim, Math.ceil(FOUNTAIN_SEC * 30) + 2);
    expect(state.lures).toEqual([]);
  });

  it('a fountain lights a zombie that reaches it, and the drop\'s flare lights nobody', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const spot = { x: p.x + 1, y: p.y + 120 };
    const reached = addRoamer(state, 'brute', spot.x, spot.y);
    const flareSpot = { x: p.x + 200, y: p.y };
    const byFlare = addRoamer(state, 'brute', flareSpot.x, flareSpot.y);
    rebuildZombieGrid(state);
    state.lures.push({ ...spot, ownerId: p.id, sparks: FOUNTAIN_SPARK_RADIUS, left: FOUNTAIN_SEC, noiseLeft: 1 });
    state.lures.push({ ...flareSpot, ownerId: null, sparks: 0, left: FLARE_SEC, noiseLeft: 1 });
    steps(sim, 2);
    expect(reached.status?.burnLeft ?? 0).toBeGreaterThan(0);
    expect(byFlare.status?.burnLeft ?? 0).toBe(0);
  });

  it('carries no more than two of each', () => {
    const { state } = quietSim();
    const [p] = state.players;
    p.fireworks = FIREWORK_CARRY;
    p.fountains = FOUNTAIN_CARRY;
    expect(takeStash(p, 'firework')).toBeNull();
    expect(takeStash(p, 'fountain')).toBeNull();
    p.fireworks = 0;
    expect(takeStash(p, 'firework')).toBe('firework');
    expect(p.fireworks).toBe(1);
  });

  it('hides spinners and fountains by the seed alone, only where they belong', () => {
    const { state } = quietSim();
    const containers = townContainers(state.map);
    const first = containers.map((c) => stashIn(state.map.seed, c));
    const again = containers.map((c) => stashIn(state.map.seed, c));
    expect(again).toEqual(first);
    containers.forEach((c, i) => {
      if (first[i] === 'firework') expect(['garage', 'warehouse', 'diner']).toContain(c.buildingKind);
      if (first[i] === 'fountain') expect(c.kind === 'car' || ['police', 'garage'].includes(c.buildingKind)).toBe(true);
    });
  });

  it('the server passes the new throws through and drops junk', () => {
    const base = { seq: 1, up: false, down: false, left: false, right: false, angle: 0, shoot: false, reload: false, weapon: null, melee: false, heal: false, search: false };
    const parse = (extra: Record<string, unknown>) => parseClientPacket(JSON.stringify({ type: 'input', input: { ...base, ...extra } }));
    expect(parse({ spinner: true, fountain: true })).toMatchObject({ input: { spinner: true, fountain: true } });
    expect(parse({ spinner: 'yes' })).toBeNull();
  });
});
