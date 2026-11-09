import { describe, expect, it } from 'vitest';
import { TICK_RATE } from '../shared/constants.ts';
import { MERCHANT_IDS } from '../shared/home-protocol.ts';
import type { Loadout } from '../shared/home-protocol.ts';
import { emptyLoadout } from '../shared/loadout.ts';
import { OVERRUN_HORDE_MAX, OVERRUN_MAX_KILLED, OVERRUN_RECOVERY_TRIPS } from '../shared/overrun.ts';
import { hurtPlayer } from '../shared/player-health.ts';
import type { PlayerState, SimState } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { emptySave } from '../src/game/home/home-store.ts';
import type { HomeSave } from '../src/game/home/home-store.ts';
import { fleeCasualties } from '../src/game/home/overrun-merchants.ts';
import { buy, closedStalls, rollStock, shopRows } from '../src/game/home/shop.ts';
import type { ShopContext } from '../src/game/home/shop.ts';
import { bankTrip, driveToTown, playerNamed, quietTown } from './helpers/home-harness.ts';
import { SEED, stateOf, stepUntil } from './helpers/sim-harness.ts';

const stocked = (): HomeSave => rollStock({ ...emptySave(12345), silver: 10_000 });
const closedOf = (save: HomeSave) => closedStalls(save.shop);

describe('the casualties of a flight', () => {
  it('kills three merchants for a share of 1 and one for a share of 0.2', () => {
    const save = stocked();
    expect(fleeCasualties(save, 1).killed).toHaveLength(OVERRUN_MAX_KILLED);
    expect(fleeCasualties(save, 0.2).killed).toHaveLength(1);
    expect(fleeCasualties(save, 0.5).killed).toHaveLength(2);
  });

  it('costs nothing for a share of 0', () => {
    const save = stocked();
    expect(fleeCasualties(save, 0)).toEqual({ save, killed: [] });
  });

  it('always leaves one stall standing, however often the room runs', () => {
    let save = stocked();
    for (let flight = 0; flight < 4; flight++) {
      save = fleeCasualties(save, 1).save;
      expect(closedOf(save).length).toBeLessThan(MERCHANT_IDS.length);
    }
  });

  it('empties and closes the dead, and thins the living to a quarter', () => {
    const save = stocked();
    const { save: after, killed } = fleeCasualties(save, 1);
    for (const id of killed) expect(after.shop.merchants[id]).toEqual({ items: {}, closedTrips: OVERRUN_RECOVERY_TRIPS });
    const survivors = MERCHANT_IDS.filter((id) => !killed.includes(id));
    for (const id of survivors) {
      expect(after.shop.merchants[id].thinTrips).toBe(OVERRUN_RECOVERY_TRIPS);
      for (const [item, count] of Object.entries(save.shop.merchants[id].items)) {
        expect(after.shop.merchants[id].items[item]).toBe(Math.floor(count / 4));
      }
    }
    expect(save.shop.merchants[killed[0]].closedTrips).toBeUndefined();
  });

  it('gives the same casualties on a reload, which is the same save', () => {
    const save = stocked();
    const reloaded: HomeSave = JSON.parse(JSON.stringify(save));
    expect(fleeCasualties(reloaded, 0.7).killed).toEqual(fleeCasualties(save, 0.7).killed);
  });
});

describe('recovery over banked trips', () => {
  it('restores full stock and reopens the stall after three rolls', () => {
    const start = stocked();
    const { save: hit, killed } = fleeCasualties(start, 1);
    const survivor = MERCHANT_IDS.find((id) => !killed.includes(id)) as (typeof MERCHANT_IDS)[number];
    let save = hit;
    const open: number[] = [];
    const thin: (number | undefined)[] = [];
    for (let trip = 0; trip < OVERRUN_RECOVERY_TRIPS; trip++) {
      save = rollStock(save);
      open.push(closedOf(save).length);
      thin.push(save.shop.merchants[survivor].thinTrips);
    }
    expect(open).toEqual([killed.length, killed.length, 0]);
    expect(thin).toEqual([2, 1, undefined]);
    for (const id of MERCHANT_IDS) {
      expect(save.shop.merchants[id].closedTrips).toBeUndefined();
      expect(save.shop.merchants[id].thinTrips).toBeUndefined();
    }
    const reference = rollStock(rollStock(rollStock(start)));
    expect(save.shop.merchants[killed[0]].items).not.toEqual({});
    expect(reference.shop.rolls).toBe(save.shop.rolls);
    for (const id of MERCHANT_IDS) expect(save.shop.merchants[id].items).toEqual(reference.shop.merchants[id].items);
  });

  it('thins to a half, then three quarters, then full', () => {
    const { save: hit, killed } = fleeCasualties(stocked(), 0.2);
    const survivor = MERCHANT_IDS.find((id) => !killed.includes(id)) as (typeof MERCHANT_IDS)[number];
    const once = rollStock(hit);
    expect(once.shop.merchants[survivor].thinTrips).toBe(2);
    expect(rollStock(once).shop.merchants[survivor].thinTrips).toBe(1);
  });
});

describe('a closed stall', () => {
  const context = (station: ShopContext['station']): ShopContext => ({ highest: 9, station, difficulty: 'lights_out' });

  it('refuses a sale and charges nothing', () => {
    const { save, killed } = fleeCasualties(stocked(), 1);
    const [dead] = killed;
    expect(shopRows(save, dead, context(dead))).toEqual([]);
    expect(buy(save, dead, 'medkit', context(dead))).toBeNull();
    expect(save.silver).toBe(10_000);
  });

  it('keeps its counts when a sale at a thin stall goes through', () => {
    const { save, killed } = fleeCasualties(stocked(), 0.2);
    const survivor = MERCHANT_IDS.find((id) => !killed.includes(id)) as (typeof MERCHANT_IDS)[number];
    const [row] = shopRows(save, survivor, context(survivor));
    if (!row) return;
    const sold = buy(save, survivor, row.item, context(survivor));
    expect(sold?.shop.merchants[survivor].thinTrips).toBe(OVERRUN_RECOVERY_TRIPS);
  });
});

const ARMED: Loadout = { ...emptyLoadout(), guns: { pistol: {} }, ammoBag: { pistol: 20, carbine: 0, shotgun: 0 }, medkits: 1 };
const homeOf = (p: PlayerState) => p.home as NonNullable<PlayerState['home']>;

function breachedRoom(players: readonly string[]): { sim: GameSimulation; state: SimState } {
  const sim = new GameSimulation({ seed: SEED, overrun: true, home: true });
  for (const id of players) sim.addPlayer(id, id, null, undefined, { loadout: ARMED, highest: 2 });
  sim.snapshot();
  const state = stateOf(sim);
  // Without the merchants shooting, the horde's share left is the survivors' doing alone.
  state.merchants = [];
  (state.overrun as NonNullable<SimState['overrun']>).left = 1e-6;
  sim.step();
  return { sim, state };
}

describe('leaving in the middle of the horde', () => {
  it('writes a fled receipt with the share still to come, and keeps it into town', () => {
    const { sim, state } = breachedRoom(['a']);
    const me = playerNamed(state, 'a');
    driveToTown(sim, state);
    expect(state.homeRun?.tripLevel).toBe(1);
    expect(homeOf(me).overrun).toMatchObject({ outcome: 'fled', share: 1, lost: null, chest: null });
    expect(state.overrun).toBeNull();
  });

  it('shrinks the share as the horde dies', () => {
    const { sim, state } = breachedRoom(['a']);
    const overrun = state.overrun as NonNullable<SimState['overrun']>;
    stepUntil(sim, () => overrun.queue.length === 0, OVERRUN_HORDE_MAX * TICK_RATE);
    for (const p of state.players) p.health = p.maxHealth = 1e9;
    const horde = state.zombies.filter((z) => z.horde);
    for (const z of horde.slice(0, horde.length / 2)) z.health = 0;
    sim.step();
    driveToTown(sim, state);
    const share = homeOf(playerNamed(state, 'a')).overrun?.share ?? -1;
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(1);
  });

  it('gives a died receipt to a body that was down, and a fled one to the rest', () => {
    const { sim, state } = breachedRoom(['a', 'b']);
    const [a, b] = [playerNamed(state, 'a'), playerNamed(state, 'b')];
    hurtPlayer(state, b, b.maxHealth);
    sim.step();
    const diedAlready = homeOf(b).overrun;
    driveToTown(sim, state);
    expect(homeOf(a).overrun?.outcome).toBe('fled');
    expect(homeOf(b).overrun?.outcome).toBe('died');
    if (diedAlready) expect(homeOf(b).overrun).toBe(diedAlready);
  });

  it('leaves no receipt when the van leaves before the breach', () => {
    const sim = new GameSimulation({ seed: SEED, overrun: true, home: true });
    sim.addPlayer('a', 'a', null, undefined, { loadout: ARMED, highest: 2 });
    sim.snapshot();
    const state = stateOf(sim);
    driveToTown(sim, state);
    expect(homeOf(playerNamed(state, 'a')).overrun).toBeNull();
  });

  it('does not touch the receipt of a trip that comes home after', () => {
    const { sim, state } = breachedRoom(['a']);
    driveToTown(sim, state);
    quietTown(state);
    bankTrip(sim, state);
    expect(homeOf(playerNamed(state, 'a')).overrun).toBeNull();
  });
});
