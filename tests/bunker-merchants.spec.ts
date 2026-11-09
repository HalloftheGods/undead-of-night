import { describe, expect, it } from 'vitest';
import { MERCHANT_ROAM, MERCHANT_STARTS } from '../shared/bunker-map.ts';
import { MERCHANT_HEALTH } from '../shared/bunker-merchants.ts';
import type { MerchantState } from '../shared/bunker-merchants.ts';
import { PLAYER_RADIUS, TICK_RATE } from '../shared/constants.ts';
import { MERCHANT_IDS } from '../shared/home-protocol.ts';
import type { MerchantId } from '../shared/home-protocol.ts';
import { emptyLoadout } from '../shared/loadout.ts';
import type { GameEvent } from '../shared/protocol.ts';
import type { SimState } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { circleHitsSolid } from '../shared/world-query.ts';
import { driveToTown, homeSim, standAtStation } from './helpers/home-harness.ts';
import { addZombie, input, SEED, stateOf, stepUntil, steps } from './helpers/sim-harness.ts';

const SECONDS = (n: number): number => n * TICK_RATE;
const merchantOf = (state: SimState, id: MerchantId): MerchantState => state.merchants.find((m) => m.id === id) as MerchantState;
/** West of the garage's wall, where the van parks. */
const outOfGarage = (m: MerchantState): boolean => m.x < Math.max(...MERCHANT_ROAM.map((box) => box.x1)) + 16;

/** A room whose clock is running, everyone far off in the garage and unhurt by anything. */
function overrunRoom(): { sim: GameSimulation; state: SimState } {
  const sim = new GameSimulation({ seed: SEED, overrun: true, home: true });
  sim.addPlayer('a', 'a', null, undefined, { loadout: { ...emptyLoadout(), guns: { pistol: {} } }, highest: 2 });
  sim.snapshot();
  const state = stateOf(sim);
  for (const p of state.players) {
    p.maxHealth = 1e9;
    p.health = 1e9;
  }
  return { sim, state };
}

/** Runs the clock out on the next tick, and the events that tick made. */
function breachNow(sim: GameSimulation, state: SimState): GameEvent[] {
  (state.overrun as NonNullable<SimState['overrun']>).left = 1e-6;
  sim.step();
  return [...state.events];
}

/** Steps with every event kept, since a snapshot drains them. */
function collect(sim: GameSimulation, ticks: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let t = 0; t < ticks; t++) {
    sim.step();
    events.push(...sim.snapshot().events);
  }
  return events;
}

describe('the bunker merchants', () => {
  it('are all in the bunker, on their feet where the stalls were, and in its snapshot; a town has none', () => {
    const { sim, state } = homeSim();
    expect(state.merchants.map((m) => m.id)).toEqual([...MERCHANT_IDS]);
    for (const m of state.merchants) {
      expect([m.x, m.y]).toEqual([MERCHANT_STARTS[m.id].x, MERCHANT_STARTS[m.id].y]);
      expect(m).toMatchObject({ status: 'alive', health: MERCHANT_HEALTH });
    }
    expect(sim.snapshot().merchants?.map((m) => m.id)).toEqual([...MERCHANT_IDS]);
    driveToTown(sim, state);
    expect(state.merchants).toEqual([]);
    expect(sim.snapshot().merchants).toBeUndefined();
  });

  it('walk about the bunker on their own, never into the walls, and keep out of the garage', () => {
    const { sim, state } = homeSim();
    const [p] = state.players;
    p.x = state.map.exit?.x ?? p.x;
    p.y = (state.map.exit?.y ?? p.y) - 40;
    const walked = new Set<MerchantId>();
    for (let t = 0; t < SECONDS(40); t++) {
      sim.step();
      for (const m of state.merchants) {
        const start = MERCHANT_STARTS[m.id];
        const away = Math.hypot(m.x - start.x, m.y - start.y) > 24;
        if (away) walked.add(m.id);
        expect(circleHitsSolid(state.map, m.x, m.y, PLAYER_RADIUS - 1), m.id).toBe(false);
        expect(outOfGarage(m), `${m.id} at ${m.x},${m.y}`).toBe(true);
      }
    }
    expect(walked.size).toBe(MERCHANT_IDS.length);
  });

  it('roll on their own streams: walking about never moves the sim rng', () => {
    const { sim, state } = homeSim();
    const probe = homeSim();
    probe.state.merchants = [];
    steps(sim, SECONDS(20));
    steps(probe.sim, SECONDS(20));
    expect(state.rng()).toBe(probe.state.rng());
  });

  it('stop for a customer, open their shop where they stand, and wait while it is open', () => {
    const { sim, state } = homeSim();
    const [p] = state.players;
    steps(sim, SECONDS(8));
    const medic = merchantOf(state, 'medic');
    standAtStation(state, p, 'medic');
    sim.setInput('a', input({ seq: 1, search: true }));
    expect(stepUntil(sim, () => p.home?.station === 'medic', SECONDS(2))).toBeGreaterThanOrEqual(0);
    const spot = { x: medic.x, y: medic.y };
    steps(sim, SECONDS(10));
    expect(p.home?.station).toBe('medic');
    expect([medic.x, medic.y]).toEqual([spot.x, spot.y]);
    expect(medic.moving).toBe(false);
  });

  it('shoot at the horde once it is through the door, and kill some of it themselves', () => {
    const { sim, state } = overrunRoom();
    breachNow(sim, state);
    const events = collect(sim, SECONDS(20));
    const merchantIds: readonly string[] = MERCHANT_IDS;
    const shots = events.filter((event) => event.type === 'shot' && merchantIds.includes(event.playerId));
    const kills = events.filter((event) => event.type === 'zombie_die' && merchantIds.includes(event.killerId ?? ''));
    expect(new Set(shots.map((event) => 'playerId' in event && event.playerId)).size).toBe(MERCHANT_IDS.length);
    expect(kills.length).toBeGreaterThan(0);
  });

  it('are gone for by the horde: one with no one beside them goes down, and stays down until it is over', () => {
    const { sim, state } = overrunRoom();
    const powder = merchantOf(state, 'powder');
    breachNow(sim, state);
    const overrun = state.overrun as NonNullable<SimState['overrun']>;
    overrun.queue = [];
    for (const z of state.zombies) z.health = 0;
    for (const m of state.merchants) m.ammo = 0;
    for (const m of state.merchants) m.reloadLeft = 1e9;
    const biters = [0, 1, 2, 3].map((k) => addZombie(state, 'walker', powder.x + 10 * Math.cos(k), powder.y + 10 * Math.sin(k)));
    const events = collect(sim, SECONDS(30));
    expect(events.some((event) => event.type === 'merchant_hurt' && event.merchant === 'powder')).toBe(true);
    expect(events.some((event) => event.type === 'merchant_downed' && event.merchant === 'powder')).toBe(true);
    expect(powder.status).toBe('downed');
    steps(sim, SECONDS(5));
    expect(powder.status).toBe('downed');
    for (const z of biters) z.health = 0;
    sim.step();
    sim.step();
    expect(overrun.phase).toBe('held');
    expect(powder).toMatchObject({ status: 'alive', health: MERCHANT_HEALTH });
  });

  it('leave a downed merchant alone and keep after the survivors', () => {
    const { sim, state } = overrunRoom();
    breachNow(sim, state);
    const overrun = state.overrun as NonNullable<SimState['overrun']>;
    overrun.queue = [];
    for (const z of state.zombies) z.health = 0;
    for (const m of state.merchants) {
      m.status = 'downed';
      m.health = 0;
    }
    const gunsmith = merchantOf(state, 'gunsmith');
    const z = addZombie(state, 'walker', gunsmith.x + 12, gunsmith.y);
    const [p] = state.players;
    const before = Math.hypot(p.x - z.x, p.y - z.y);
    const events = collect(sim, SECONDS(3));
    expect(events.some((event) => event.type === 'merchant_hurt')).toBe(false);
    expect(Math.hypot(p.x - z.x, p.y - z.y)).toBeLessThan(before);
  });
});
