import { describe, expect, it } from 'vitest';
import { TICK_DT, ZOMBIE_CAP } from '../shared/constants.ts';
import type { SnapshotPacket } from '../shared/protocol.ts';
import type { SimState } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { circleHitsSolid } from '../shared/world-map.ts';
import { CirclingBot, ScavengerBot } from './helpers/bots.ts';
import { arrivesAlone } from './helpers/lone-chase.ts';
import { clearNeeds, input, stateOf } from './helpers/sim-harness.ts';

const SOAK_TICKS = 20000;
/** A hunter this far from everyone that has not moved this long is stuck, unless it is only queueing behind the crowd. */
const STUCK_TICKS = 150;
const STUCK_RANGE = 40;

/** One assertion per tick: with a whole town of bodies, an expect() each would dominate the run. */
function assertFinite(state: SimState): void {
  const faults: string[] = [];
  for (const p of state.players) {
    const finite = Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.angle) && Number.isFinite(p.health);
    if (!finite || p.ammo < 0 || p.reserve < 0) faults.push(`player ${p.id}`);
  }
  for (const z of state.zombies) {
    const finite = Number.isFinite(z.x) && Number.isFinite(z.y) && Number.isFinite(z.health);
    if (!finite || circleHitsSolid(state.map, z.x, z.y, z.radius)) faults.push(`${z.type} ${z.id} at ${z.x},${z.y}`);
  }
  for (const b of state.bullets) {
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) faults.push(`bullet ${b.id}`);
  }
  expect(faults).toEqual([]);
}

class StuckWatch {
  private readonly marks = new Map<string, { x: number; y: number; tick: number }>();
  readonly stuck: string[] = [];

  check(state: SimState): void {
    const seen = new Set<string>();
    for (const z of state.zombies) {
      seen.add(z.id);
      const mark = this.marks.get(z.id);
      const moved = !mark || Math.hypot(z.x - mark.x, z.y - mark.y) > 4;
      const nearPlayer = state.players.some((p) => Math.hypot(p.x - z.x, p.y - z.y) < STUCK_RANGE);
      // Roamers stand about on purpose; only a body with somewhere to be can be stuck.
      const idleByChoice = z.mode !== 'hunt';
      if (moved || nearPlayer || idleByChoice) {
        this.marks.set(z.id, { x: z.x, y: z.y, tick: state.tick });
      } else if (state.tick - mark.tick > STUCK_TICKS) {
        const heldByTheWorld = !arrivesAlone(state, z);
        if (heldByTheWorld) this.stuck.push(`${z.type} ${z.id} at ${z.x.toFixed(1)},${z.y.toFixed(1)} tick ${state.tick}`);
        this.marks.delete(z.id);
      }
    }
    for (const id of this.marks.keys()) {
      if (!seen.has(id)) this.marks.delete(id);
    }
  }
}

function assertSerialisable(snapshot: SnapshotPacket): void {
  expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
}

describe('soak', () => {
  it(`solo bot plays ${SOAK_TICKS} ticks across restarts without corrupting anything`, () => {
    const sim = new GameSimulation({ seed: 31337 });
    sim.addPlayer('bot', 'bot');
    const state = stateOf(sim);
    let bot = new ScavengerBot('bot', sim.map);
    const watch = new StuckWatch();
    let snapshot = sim.snapshot();
    let restarts = 0;
    let bestWave = 0;

    for (let tick = 0; tick < SOAK_TICKS; tick++) {
      const packet = bot.think(snapshot);
      if (packet) sim.setInput('bot', packet);
      sim.step();
      snapshot = sim.snapshot();
      assertFinite(state);
      watch.check(state);
      if (tick % 40 === 0) assertSerialisable(snapshot);
      bestWave = Math.max(bestWave, snapshot.wave);
      if (snapshot.phase === 'gameover') {
        restarts += 1;
        sim.restart();
        bot = new ScavengerBot('bot', sim.map);
      }
    }
    console.info(`soak solo: ${SOAK_TICKS} ticks, best horde ${bestWave}, ${restarts} game overs, ${watch.stuck.length} stuck zombies`);
    expect(watch.stuck).toEqual([]);
  }, 120000);

  it('an unkillable co-op team pushes deep hordes', () => {
    const sim = new GameSimulation({ seed: 271828 });
    const ids = ['p1', 'p2', 'p3'];
    for (const id of ids) sim.addPlayer(id, id);
    const state = stateOf(sim);
    const bots = ids.map((id) => new CirclingBot(id, sim.map));
    const watch = new StuckWatch();
    let snapshot = sim.snapshot();
    let peak = 0;

    for (let tick = 0; tick < SOAK_TICKS; tick++) {
      bots.forEach((bot, index) => {
        const packet = bot.think(snapshot);
        if (packet) sim.setInput(ids[index], packet);
      });
      for (const p of state.players) p.health = p.maxHealth;
      clearNeeds(sim);
      sim.step();
      snapshot = sim.snapshot();
      assertFinite(state);
      watch.check(state);
      peak = Math.max(peak, state.zombies.length);
      if (tick % 40 === 0) assertSerialisable(snapshot);
    }
    console.info(`soak co-op: reached horde ${snapshot.wave}, peak ${peak} zombies, ${watch.stuck.length} stuck zombies`);
    expect(snapshot.wave).toBeGreaterThanOrEqual(4);
    expect(peak).toBeLessThanOrEqual(ZOMBIE_CAP);
    expect(watch.stuck).toEqual([]);
  }, 120000);

  it('survives hostile input', () => {
    const sim = new GameSimulation({ seed: 5 });
    sim.addPlayer('x', 'x');
    const state = stateOf(sim);
    const nasty = [Number.NaN, Number.POSITIVE_INFINITY, -1e308, 1e308, 0];
    for (let tick = 0; tick < 3000; tick++) {
      const angle = nasty[tick % nasty.length];
      sim.setInput('x', input({ seq: tick, angle, shoot: true, melee: true, heal: true, right: tick % 2 === 0, up: tick % 3 === 0, reload: tick % 5 === 0 }));
      sim.step();
      assertSerialisable(sim.snapshot());
      assertFinite(state);
      if (sim.phase === 'gameover') sim.restart();
    }
  }, 60000);

  it('holds a tick well inside budget with 150 zombies in play', () => {
    const sim = new GameSimulation({ seed: 77 });
    sim.addPlayer('bot', 'bot');
    const state = stateOf(sim);
    const [p] = state.players;
    p.maxHealth = p.health = 1e9;
    state.intermissionLeft = 0.01;
    const bot = new ScavengerBot('bot', sim.map);
    let snapshot = sim.snapshot();
    const costs: number[] = [];
    for (let tick = 0; tick < 3000; tick++) {
      const packet = bot.think(snapshot);
      if (packet) sim.setInput('bot', packet);
      const start = performance.now();
      sim.step();
      costs.push(performance.now() - start);
      snapshot = sim.snapshot();
    }
    costs.sort((a, b) => a - b);
    const mean = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
    const p99 = costs[Math.floor(costs.length * 0.99)];
    console.info(`tick cost: mean ${mean.toFixed(3)}ms, p99 ${p99.toFixed(3)}ms, ${state.zombies.length} zombies, budget ${(TICK_DT * 1000).toFixed(1)}ms`);
    expect(state.zombies.length).toBeGreaterThanOrEqual(100);
    expect(mean).toBeLessThan(4);
  }, 60000);
});
