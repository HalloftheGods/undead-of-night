import { describe, expect, it } from 'vitest';
import {
  HORDE_MAX_SEC,
  HORDE_SPEED_SCALE,
  INTERMISSION_SEC,
  LEAD_IN_SEC,
  LEVEL_ONE_LEAD_IN_SEC,
  POPULATION_TOPUP_SEC,
  SPAWN_MIN_DISTANCE,
  SPAWN_SAFE_RADIUS,
  STANDING_POPULATION,
  TICK_RATE,
  TOPUP_MIN_DISTANCE,
  ZOMBIE_CAP,
} from '../shared/constants.ts';
import { createRng } from '../shared/rng.ts';
import type { SimState } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { waveRoster } from '../shared/waves.ts';
import { buildingAt, circleHitsSolid } from '../shared/world-map.ts';
import { SEED, addRoamer, addZombie, eventsOf, quietSim, stateOf, stepUntil, steps } from './helpers/sim-harness.ts';

function soloSim() {
  const sim = new GameSimulation({ seed: SEED });
  sim.addPlayer('a', 'a');
  return { sim, state: stateOf(sim) };
}

/** A quiet town with the first horde about to start and nobody to hurt. */
function hordeSim(wave = 0) {
  const { sim, state } = quietSim();
  const [p] = state.players;
  p.health = p.maxHealth = 1e9;
  state.wave = wave;
  state.intermissionLeft = 0.01;
  sim.step();
  sim.snapshot();
  return { sim, state, p };
}

const hordeBodies = (state: SimState) => state.zombies.filter((z) => z.horde);

describe('horde roster', () => {
  const rng = createRng(1);
  const count = (wave: number, type: string) => waveRoster(wave, rng).filter((t) => t === type).length;

  it('introduces types on schedule', () => {
    expect(count(1, 'runner')).toBe(0);
    expect(count(1, 'bloater')).toBe(0);
    expect(count(2, 'runner')).toBeGreaterThan(0);
    expect(count(2, 'bloater')).toBe(0);
    expect(count(3, 'bloater')).toBeGreaterThan(0);
    expect(count(4, 'brute')).toBe(0);
    expect(count(5, 'brute')).toBe(1);
    expect(count(6, 'brute')).toBe(0);
    expect(count(10, 'brute')).toBe(2);
  });

  it('grows every horde', () => {
    for (let wave = 1; wave < 30; wave++) {
      expect(waveRoster(wave + 1, rng).length).toBeGreaterThan(waveRoster(wave, rng).length);
    }
  });
});

describe('the standing population', () => {
  it('fills the town at the start, indoors and out, and leaves the spawn alone', () => {
    const { state } = soloSim();
    const [p] = state.players;
    expect(state.zombies.length).toBe(STANDING_POPULATION);
    const indoors = state.zombies.filter((z) => buildingAt(state.map, z.x, z.y) !== null).length;
    expect(indoors).toBeGreaterThan(STANDING_POPULATION * 0.25);
    expect(indoors).toBeLessThan(STANDING_POPULATION * 0.75);
    // Level 1 opens with a few slow walkers in sight of the spawn; everyone else keeps clear of it.
    const opening = state.zombies.filter((z) => Math.hypot(z.x - p.x, z.y - p.y) < SPAWN_SAFE_RADIUS - 30);
    expect(opening.length).toBeGreaterThanOrEqual(2);
    expect(opening.length).toBeLessThanOrEqual(3);
    for (const z of opening) expect(z.type).toBe('walker');
    for (const z of state.zombies.filter((each) => !opening.includes(each))) {
      expect(z.mode).toBe('wander');
      expect(z.horde).toBe(false);
      expect(circleHitsSolid(state.map, z.x, z.y, z.radius)).toBe(false);
      expect(Math.hypot(z.x - p.x, z.y - p.y)).toBeGreaterThanOrEqual(SPAWN_SAFE_RADIUS - 30);
    }
  });

  it('guards the places worth raiding', () => {
    const { state } = soloSim();
    const police = state.map.buildings.find((b) => b.kind === 'police');
    const inside = state.zombies.filter((z) => buildingAt(state.map, z.x, z.y) === police);
    expect(inside.length).toBeGreaterThanOrEqual(3);
  });

  it('is topped up slowly, out of sight, and never in a building someone stands in', () => {
    const { sim, state } = soloSim();
    const [p] = state.players;
    state.intermissionLeft = 1e6;
    const building = state.map.buildings[0];
    p.x = building.x + 40;
    p.y = building.y + 40;
    p.indoors = building.id;
    p.health = 1e9;
    state.zombies = state.zombies.slice(0, 100);
    const known = new Set(state.zombies.map((z) => z.id));
    const seconds = POPULATION_TOPUP_SEC * 8;
    steps(sim, seconds * TICK_RATE);
    const added = state.zombies.filter((z) => !known.has(z.id));
    expect(added.length).toBeGreaterThan(4);
    expect(added.length).toBeLessThanOrEqual(9);
    for (const z of added) {
      expect(buildingAt(state.map, z.x, z.y)).not.toBe(building);
      expect(z.home).not.toBe(building.id);
    }
  });

  it('spawns replacements far from every player', () => {
    const { sim, state } = soloSim();
    const [p] = state.players;
    state.intermissionLeft = 1e6;
    p.health = 1e9;
    state.zombies = [];
    state.topUpTimer = 0;
    sim.step();
    expect(state.zombies.length).toBe(1);
    expect(Math.hypot(state.zombies[0].x - p.x, state.zombies[0].y - p.y)).toBeGreaterThanOrEqual(TOPUP_MIN_DISTANCE - 2);
  });
});

describe('horde flow', () => {
  it('leads in with a long lull, then starts the first horde and counts only its own', () => {
    const { sim, state } = soloSim();
    const first = sim.snapshot();
    expect(first.phase).toBe('intermission');
    expect(first.wave).toBe(0);
    expect(first.intermission).toBeCloseTo(LEVEL_ONE_LEAD_IN_SEC, 1);
    expect(LEAD_IN_SEC).toBeGreaterThan(INTERMISSION_SEC);
    expect(first.hostiles).toBe(0);
    expect(eventsOf(first, 'wave_intermission')).toEqual([{ type: 'wave_intermission', wave: 1, seconds: LEVEL_ONE_LEAD_IN_SEC }]);

    state.players[0].health = 1e9;
    steps(sim, LEVEL_ONE_LEAD_IN_SEC * TICK_RATE + 1);
    const started = sim.snapshot();
    expect(started.phase).toBe('wave');
    expect(started.wave).toBe(1);
    const [start] = eventsOf(started, 'wave_start');
    expect(start.wave).toBe(1);
    expect(start.hostiles).toBe(waveRoster(1, createRng(1)).length);
    expect(started.hostiles).toBe(start.hostiles);
    expect(started.intermission).toBe(0);
  });

  it('trickles spawns instead of dumping the horde', () => {
    const { sim, state } = hordeSim();
    steps(sim, TICK_RATE);
    expect(hordeBodies(state).length).toBeGreaterThan(0);
    expect(hordeBodies(state).length).toBeLessThan(4);
    expect(hordeBodies(state).length + state.spawnQueue.length).toBe(sim.snapshot().hostiles);
  });

  it('streams in out of sight, outdoors, on walkable ground', () => {
    const { sim, state, p } = hordeSim();
    const seen = new Set<string>();
    stepUntil(
      sim,
      () => {
        for (const z of hordeBodies(state)) {
          if (seen.has(z.id)) continue;
          seen.add(z.id);
          expect(Math.hypot(z.x - p.x, z.y - p.y)).toBeGreaterThanOrEqual(SPAWN_MIN_DISTANCE - 4);
          expect(circleHitsSolid(state.map, z.x, z.y, z.radius)).toBe(false);
          expect(buildingAt(state.map, z.x, z.y)).toBeNull();
        }
        return state.spawnQueue.length === 0;
      },
      2000,
    );
    expect(seen.size).toBe(5);
  });

  it('knows where the players are, with no need to see them', () => {
    const { sim, state } = hordeSim();
    steps(sim, 3 * TICK_RATE);
    const bodies = hordeBodies(state);
    expect(bodies.length).toBeGreaterThan(0);
    for (const z of bodies) expect(z.mode).toBe('hunt');
    steps(sim, 30 * TICK_RATE);
    for (const z of hordeBodies(state)) expect(z.mode).toBe('hunt');
  });

  it('holds the concurrent cap', () => {
    const { sim, state } = hordeSim(60);
    state.zombies = [];
    state.spawnQueue = Array(ZOMBIE_CAP + 40).fill('walker');
    state.hordeLeft = 1e6;
    steps(sim, 2400);
    expect(state.zombies.length).toBe(ZOMBIE_CAP);
    expect(state.spawnQueue.length).toBeGreaterThan(0);
  }, 30000);

  it('calls only as many bodies as the cap has room for, so the count on the HUD is real', () => {
    const { sim, state } = hordeSim(40);
    const room = 3;
    state.phase = 'intermission';
    state.intermissionLeft = 0.01;
    state.spawnQueue = [];
    state.zombies = [];
    state.populationTarget = ZOMBIE_CAP;
    const far = { x: state.players[0].x + 2000, y: state.players[0].y };
    while (state.zombies.length < ZOMBIE_CAP - room) addRoamer(state, 'walker', far.x, far.y);
    state.populationTarget = 0;
    sim.step();
    const [start] = eventsOf(sim.snapshot(), 'wave_start');
    expect(start.hostiles).toBe(room);
    expect(state.spawnQueue.length).toBe(room);
  });

  it('keeps a waiting horde\'s places under the cap from the top-ups', () => {
    const { sim, state } = hordeSim();
    state.zombies = [];
    state.spawnQueue = Array(10).fill('walker');
    state.spawnTimer = 1e6;
    state.hordeLeft = 1e6;
    state.populationTarget = ZOMBIE_CAP;
    while (state.zombies.length < ZOMBIE_CAP - 10) addRoamer(state, 'walker', state.players[0].x + 2000, state.players[0].y);
    steps(sim, POPULATION_TOPUP_SEC * TICK_RATE * 2);
    expect(state.zombies.length).toBe(ZOMBIE_CAP - 10);
  });

  it('thins the survivors of a horde back to the town\'s level, out of sight', () => {
    const { sim, state, p } = hordeSim();
    state.populationTarget = 2;
    state.spawnQueue = [];
    state.hordeLeft = 1e6;
    state.zombies = [];
    const guard = addRoamer(state, 'walker', p.x + TOPUP_MIN_DISTANCE + 200, p.y);
    const inSight = addRoamer(state, 'walker', p.x + 120, p.y);
    for (const i of [1, 2, 3]) addZombie(state, 'walker', p.x + SPAWN_MIN_DISTANCE + 20, p.y + i * 30);
    for (const z of state.zombies) z.speed = 0;
    state.hordeLeft = 0.01;
    sim.step();
    expect(state.phase).toBe('intermission');
    expect(state.zombies).toEqual([guard, inSight]);
  });

  it('never culls in front of a player, even above the level', () => {
    const { sim, state, p } = hordeSim();
    state.populationTarget = 0;
    state.spawnQueue = [];
    state.zombies = [];
    const inSight = addZombie(state, 'walker', p.x + 120, p.y);
    inSight.speed = 0;
    state.hordeLeft = 0.01;
    sim.step();
    expect(state.phase).toBe('intermission');
    expect(state.zombies).toEqual([inSight]);
  });

  it('later hordes still arrive when hordes are evaded, and the HUD count matches them', () => {
    const { sim, state } = soloSim();
    const [p] = state.players;
    p.health = p.maxHealth = 1e9;
    const seen: { called: number; spawned: number; total: number }[] = [];
    let called = 0;
    let spawned = new Set<string>();
    for (let tick = 0; tick < (LEAD_IN_SEC + 7 * (INTERMISSION_SEC + HORDE_MAX_SEC) + 5) * TICK_RATE; tick++) {
      sim.step();
      const snapshot = sim.snapshot();
      for (const z of state.zombies) if (z.horde) spawned.add(z.id);
      const [start] = eventsOf(snapshot, 'wave_start');
      if (start) {
        called = start.hostiles;
        spawned = new Set();
      }
      const [clear] = eventsOf(snapshot, 'wave_clear');
      if (clear) seen.push({ called, spawned: spawned.size, total: state.zombies.length });
    }
    expect(seen.length).toBeGreaterThanOrEqual(6);
    for (const { called: hud, spawned: real, total } of seen) {
      expect(real).toBe(hud);
      expect(total).toBeLessThan(ZOMBIE_CAP);
    }
  }, 120000);

  it('ends when the horde is dead, rests for the lull, then the next one comes', () => {
    const { sim, state } = hordeSim();
    state.spawnQueue = [];
    state.zombies = [];
    sim.step();
    const cleared = sim.snapshot();
    expect(eventsOf(cleared, 'wave_clear')).toEqual([{ type: 'wave_clear', wave: 1 }]);
    expect(eventsOf(cleared, 'wave_intermission')).toEqual([{ type: 'wave_intermission', wave: 2, seconds: INTERMISSION_SEC }]);
    expect(cleared.phase).toBe('intermission');
    expect(cleared.wave).toBe(1);
    expect(cleared.intermission).toBeCloseTo(INTERMISSION_SEC, 1);

    steps(sim, INTERMISSION_SEC * TICK_RATE - 2);
    expect(sim.snapshot().phase).toBe('intermission');
    steps(sim, 3);
    const next = sim.snapshot();
    expect(next.phase).toBe('wave');
    expect(next.wave).toBe(2);
  });

  it('roamers do not hold a horde open', () => {
    const { sim, state } = hordeSim();
    state.populationTarget = 20;
    state.topUpTimer = 0;
    state.spawnQueue = [];
    state.zombies = [];
    sim.step();
    expect(sim.phase).toBe('intermission');
  });

  it('ends on the clock with bodies left, and the leftovers go back to roaming at a walk', () => {
    const { sim, state } = hordeSim();
    const ticks = stepUntil(sim, () => sim.phase === 'intermission', (HORDE_MAX_SEC + 1) * TICK_RATE);
    expect(ticks).toBeGreaterThanOrEqual((HORDE_MAX_SEC - 1) * TICK_RATE);
    expect(ticks).toBeLessThanOrEqual((HORDE_MAX_SEC + 1) * TICK_RATE);
    expect(state.zombies.length).toBeGreaterThan(0);
    for (const z of state.zombies) {
      expect(z.horde).toBe(false);
      expect(z.mode === 'wander').toBe(true);
      expect(z.speed).toBeLessThan(42);
    }
    expect(sim.snapshot().hostiles).toBe(0);
  });

  it('a horde drops the rest of its queue when it ends', () => {
    const { sim, state } = hordeSim();
    state.spawnQueue = Array(200).fill('walker');
    state.hordeLeft = 0.05;
    steps(sim, 3);
    expect(sim.phase).toBe('intermission');
    expect(state.spawnQueue).toEqual([]);
  });

  it('restocks far-off buildings when a horde ends', () => {
    const { sim, state } = hordeSim();
    expect(state.pickups.length).toBe(0);
    state.spawnQueue = [];
    state.zombies = [];
    sim.step();
    expect(state.pickups.length).toBeGreaterThanOrEqual(3);
    for (const item of state.pickups) expect(buildingAt(state.map, item.x, item.y)).not.toBeNull();
  });

  it('gets tougher each horde: health and speed scale mildly, and a hunting horde is frenzied', () => {
    const { sim, state } = hordeSim(9);
    stepUntil(sim, () => hordeBodies(state).some((z) => z.type === 'walker'), 200);
    const walker = hordeBodies(state).find((z) => z.type === 'walker');
    expect(walker?.maxHealth).toBeGreaterThan(60);
    expect(walker?.maxHealth).toBeLessThan(120);
    expect(walker?.speed).toBeGreaterThan(30 * HORDE_SPEED_SCALE);
    expect(walker?.speed).toBeLessThan(45 * HORDE_SPEED_SCALE);
  });
});
