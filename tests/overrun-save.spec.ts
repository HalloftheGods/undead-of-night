import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MEDKIT_MAX, TICK_RATE } from '../shared/constants.ts';
import { MERCHANT_IDS } from '../shared/home-protocol.ts';
import type { Loadout } from '../shared/home-protocol.ts';
import { emptyLoadout } from '../shared/loadout.ts';
import { openChest } from '../shared/overrun-chest.ts';
import { overrunHolds, writeDied, writeFlight } from '../shared/overrun-fight.ts';
import type { PlayerEntity } from '../shared/protocol.ts';
import type { SimState } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { createBrowserHomeStore } from '../src/game/home/browser-home-store.ts';
import { migrateCamp } from '../src/game/home/camp-migrate.ts';
import { emptySave } from '../src/game/home/home-store.ts';
import type { HomeSave, HomeStore, OverrunRecord } from '../src/game/home/home-store.ts';
import { joinHomeFor } from '../src/game/home/home-sync.ts';
import { applyOverrunReceipt, overrunKey } from '../src/game/home/overrun-ledger.ts';
import { fleeCasualties } from '../src/game/home/overrun-merchants.ts';
import { closedStalls, rollStock } from '../src/game/home/shop.ts';
import { frame, inTown, opened, overrunReceipt, receipt, see, sharedStore, syncOver } from './helpers/home-sync-frames.ts';
import { SEED, stateOf } from './helpers/sim-harness.ts';

const HOME_KEY = 'outbreak.home';
const PROGRESS_KEY = 'outbreak.level-progress';
const PROGRESS = '{"highest":4,"finished":false}';

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

/** A save as it was written before the overrun: no records, no open overrun, no stall counts. */
function oldSave(): Record<string, unknown> {
  const { overruns: _records, openOverrun: _open, ...before } = { ...emptySave(7), version: 3, silver: 120 };
  return before;
}

/** A load gives a save with no camp one: a brand-new save starts with nobody rescued and no quest taken. */
const withCamp = (save: HomeSave): HomeSave => migrateCamp(save, { radio: false, tracks: [] });

const record: OverrunRecord = {
  outcome: 'fled', share: 0.5, highest: 4, difficulty: 'lights_out', kills: 9, merchantsLost: ['medic', 'powder'], silver: 0, at: 1000,
};

describe('a save from before the overrun', () => {
  it('loads unchanged, with no records, no open overrun and every stall open', async () => {
    const memory = memoryStore({ [HOME_KEY]: JSON.stringify(oldSave()), [PROGRESS_KEY]: PROGRESS });
    const loaded = await createBrowserHomeStore(memory).load();
    expect(loaded).toEqual(withCamp({ ...oldSave(), overruns: [], openOverrun: null } as unknown as HomeSave));
    for (const stock of Object.values(loaded.shop.merchants)) {
      expect(stock.closedTrips ?? 0).toBe(0);
      expect(stock.thinTrips ?? 0).toBe(0);
    }
  });

  it('leaves the level progress alone through a load and a save', async () => {
    const memory = memoryStore({ [HOME_KEY]: JSON.stringify(oldSave()), [PROGRESS_KEY]: PROGRESS });
    const store = createBrowserHomeStore(memory);
    const loaded = await store.load();
    expect(await store.save(loaded)).toEqual({ kind: 'saved', version: 4 });
    expect(memory.data.get(PROGRESS_KEY)).toBe(PROGRESS);
  });
});

describe('a save with the overrun in it', () => {
  const withOverrun = (patch: Partial<HomeSave> = {}): HomeSave => ({
    ...emptySave(7),
    overruns: [record],
    openOverrun: { simId: 'sim-a', mode: 'coop', startedAt: 2000 },
    ...patch,
  });

  it('reads back what it wrote', async () => {
    const memory = memoryStore();
    const store = createBrowserHomeStore(memory);
    const next = withOverrun();
    next.shop.merchants.medic = { items: {}, closedTrips: 3 };
    next.shop.merchants.powder = { items: {}, thinTrips: 2 };
    await store.save(next);
    expect(await store.load()).toEqual(withCamp({ ...next, version: 1 }));
  });

  it('drops a bad record alone, and a bad open overrun becomes none', async () => {
    const bad = { ...record, merchantsLost: ['the mayor'] };
    const raw = { ...withOverrun(), overruns: [record, bad, { ...record, outcome: 'won' }], openOverrun: { simId: 'sim-a', mode: 'party' } };
    const loaded = await createBrowserHomeStore(memoryStore({ [HOME_KEY]: JSON.stringify(raw) })).load();
    expect(loaded.overruns).toEqual([record]);
    expect(loaded.openOverrun).toBeNull();
  });

  it('refuses a stall count that is not a number, as any bad stock is', async () => {
    const raw = withOverrun();
    const broken = { ...raw, shop: { ...raw.shop, merchants: { ...raw.shop.merchants, medic: { items: {}, closedTrips: 'two' } } } };
    const loaded = await createBrowserHomeStore(memoryStore({ [HOME_KEY]: JSON.stringify(broken) })).load();
    expect(loaded.shop.merchants.medic.closedTrips).toBeUndefined();
    expect(loaded.shop.seed).not.toBe(raw.shop.seed);
  });
});

const BREACHED = { phase: 'breached', left: 0, slowed: false, hostiles: 10, total: 10 } as const;
const HELD = { ...BREACHED, phase: 'held', hostiles: 0 } as const;
const CHEST: Loadout = { ...emptyLoadout(), medkits: 1, ammoBag: { pistol: 30, carbine: 0, shotgun: 0 } };
const ARMED: Loadout = { ...emptyLoadout(), guns: { pistol: {} }, ammoBag: { pistol: 20, carbine: 0, shotgun: 0 } };
const CONTEXT = { highest: 3, difficulty: 'stay_close' } as const;

const held = (patch = {}) => overrunReceipt({ outcome: 'held', chest: CHEST, silver: 90, jewels: { small: 1, large: 0 }, ...patch });
const stockedSave = (patch: Partial<HomeSave> = {}): HomeSave => rollStock({ ...emptySave(7), silver: 10, ...patch });

describe('applying an overrun receipt', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a held chest goes to the locker and the bank, with a record, once', async () => {
    const { slot, store } = sharedStore();
    const { sync } = await opened(store);
    await see(sync, frame({ home: { overrun: held() } }));
    expect(slot.save.silver).toBe(90);
    expect(slot.save.rawJewels).toEqual({ small: 1, large: 0 });
    expect(slot.save.locker.medkits).toBe(1);
    expect(slot.save.overruns).toHaveLength(1);
    expect(slot.save.overruns[0]).toMatchObject({ outcome: 'held', highest: 3, silver: 90, merchantsLost: [] });
    expect(slot.save.appliedReceipts).toEqual(['sim-a:2']);
    await see(sync, frame({ tick: 101, home: { overrun: held() } }));
    expect(slot.save.silver).toBe(90);
    expect(slot.save.overruns).toHaveLength(1);
  });

  it('a refresh between the receipt and the save applies it exactly once', async () => {
    const { slot, scripted, store } = sharedStore();
    const first = await opened(store);
    scripted.push({ kind: 'failed', reason: 'quota' });
    await see(first.sync, frame({ home: { overrun: held() } }));
    expect(slot.save.silver).toBe(0);
    const second = await opened(store);
    await see(second.sync, frame({ home: { overrun: held() } }));
    await see(second.sync, frame({ tick: 101, home: { overrun: held() } }));
    expect(slot.save.silver).toBe(90);
    expect(slot.save.overruns).toHaveLength(1);
    const third = await opened(store);
    await see(third.sync, frame({ home: { overrun: held() } }));
    expect(slot.save.silver).toBe(90);
  });

  it('a failed save warns and applies nothing, then applies on the retry', async () => {
    const { slot, scripted, store } = sharedStore();
    const { sync } = await opened(store);
    scripted.push({ kind: 'failed', reason: 'quota' });
    await see(sync, frame({ home: { overrun: held() } }));
    expect(sync.saveError).toBe('quota');
    expect(slot.save.appliedReceipts).toEqual([]);
    expect(slot.save.silver).toBe(0);
    await see(sync, frame({ tick: 101, home: { overrun: held() } }));
    expect(slot.save.silver).toBe(0);
    await see(sync, frame({ tick: 101 + TICK_RATE * 3, home: { overrun: held() } }));
    expect(slot.save.silver).toBe(90);
    expect(sync.saveError).toBeNull();
  });

  it('a conflict re-reads the save, and a receipt another tab already applied is not credited twice', async () => {
    const { slot, store } = sharedStore();
    const { sync } = await opened(store);
    slot.save = { ...slot.save, version: slot.save.version + 1, silver: 90, appliedReceipts: ['sim-a:2'] };
    await see(sync, frame({ home: { overrun: held() } }));
    expect(slot.save.silver).toBe(90);
    expect(slot.save.appliedReceipts).toEqual(['sim-a:2']);
  });

  it('a conflict over a receipt nobody applied re-reads and credits once', async () => {
    const { slot, store } = sharedStore();
    const { sync } = await opened(store);
    slot.save = { ...slot.save, version: slot.save.version + 1, silver: 40 };
    await see(sync, frame({ home: { overrun: held() } }));
    expect(slot.save.silver).toBe(130);
    expect(slot.save.overruns).toHaveLength(1);
  });

  it('a died receipt empties the hands and the open trip and nothing else', async () => {
    const locker = { ...emptyLoadout(), medkits: 2 };
    const { slot, store } = sharedStore({ hands: ARMED, locker, silver: 55, openTrip: { level: 2, mode: 'solo', difficulty: 'stay_close', startedAt: 1 } });
    const { sync } = await opened(store);
    await see(sync, frame({ home: { overrun: overrunReceipt({ lost: ARMED }) } }));
    expect(slot.save.hands).toEqual(emptyLoadout());
    expect(slot.save.openTrip).toBeNull();
    expect(slot.save.locker).toEqual(locker);
    expect(slot.save.silver).toBe(55);
    expect(slot.save.overruns[0]).toMatchObject({ outcome: 'died', kills: 4, merchantsLost: [] });
  });

  it('a held receipt carrying a death not yet applied applies both, each once, with a record each', async () => {
    const locker = { ...emptyLoadout(), medkits: 2 };
    const { slot, store } = sharedStore({ hands: ARMED, locker });
    const { sync } = await opened(store);
    const both = held({ serial: 3, died: overrunReceipt({ serial: 2, lost: ARMED }) });
    await see(sync, frame({ home: { overrun: both } }), frame({ tick: 101, home: { overrun: both } }));
    expect(slot.save.hands).toEqual(emptyLoadout());
    expect(slot.save.locker.medkits).toBe(3);
    expect(slot.save.silver).toBe(90);
    expect(slot.save.overruns.map((r) => r.outcome)).toEqual(['died', 'held']);
    expect(slot.save.appliedReceipts).toEqual(['sim-a:2', 'sim-a:3']);
  });

  it('a held receipt carrying a death already applied credits the chest alone', async () => {
    const hands = { ...emptyLoadout(), medkits: 1 };
    const { slot, store } = sharedStore({ hands, appliedReceipts: ['sim-a:2'] });
    const { sync } = await opened(store);
    await see(sync, frame({ home: { overrun: held({ serial: 3, died: overrunReceipt({ serial: 2, lost: ARMED }) }) } }));
    expect(slot.save.hands).toEqual(hands);
    expect(slot.save.overruns.map((r) => r.outcome)).toEqual(['held']);
    expect(slot.save.appliedReceipts).toEqual(['sim-a:2', 'sim-a:3']);
  });

  it('a fled receipt seen in town costs merchants in a save of its own, which a death on that trip does not undo', async () => {
    const { slot, store } = sharedStore();
    const { sync } = await opened(store);
    await sync.settled();
    const before = slot.save.shop.merchants;
    await see(sync, frame({ ...inTown, home: { overrun: overrunReceipt({ outcome: 'fled', share: 1 }) } }));
    const lost = slot.save.overruns[0].merchantsLost;
    expect(lost).toHaveLength(3);
    expect(closedStalls(slot.save.shop)).toEqual(expect.arrayContaining([...lost]));
    expect(slot.save.shop.merchants).not.toEqual(before);
    await see(sync, frame({ ...inTown, tick: 101, home: { overrun: overrunReceipt({ outcome: 'fled', share: 1 }), receipt: receipt({ outcome: 'died', serial: 3 }) } }));
    expect(slot.save.ledger).toHaveLength(1);
    expect(closedStalls(slot.save.shop)).toHaveLength(3);
    expect(slot.save.overruns).toHaveLength(1);
  });
});

describe('the breach on file', () => {
  it('is written when the breach is first seen, once, and closed by a receipt', async () => {
    const { slot, store } = sharedStore();
    const { sync } = await opened(store);
    await see(sync, frame({ overrun: BREACHED }), frame({ tick: 101, overrun: BREACHED }));
    expect(slot.save.openOverrun).toMatchObject({ mode: 'solo', highest: 3 });
    const versionOpen = slot.save.version;
    await see(sync, frame({ tick: 102, overrun: BREACHED }));
    expect(slot.save.version).toBe(versionOpen);
    await see(sync, frame({ tick: 103, overrun: BREACHED, home: { overrun: held() } }));
    expect(slot.save.openOverrun).toBeNull();
  });

  it('is closed by surviving it, so quitting after the horde is dead costs nothing', async () => {
    const { slot, store } = sharedStore({ hands: ARMED });
    const { sync } = await opened(store);
    const player: Partial<PlayerEntity> = { owned: ['pistol'], ammoBag: { pistol: 20, carbine: 0, shotgun: 0 } };
    await see(sync, frame({ overrun: BREACHED, player }), frame({ tick: 101, overrun: HELD, player }));
    expect(slot.save.openOverrun).toBeNull();
    expect(slot.save.hands).toEqual(ARMED);
    expect(slot.save.overruns).toEqual([]);
  });

  it('is closed when the trip starts', async () => {
    const { slot, store } = sharedStore();
    const { sync } = await opened(store);
    await see(sync, frame({ overrun: BREACHED }), frame({ ...inTown, tick: 101 }));
    expect(slot.save.openOverrun).toBeNull();
  });

  it('a solo quit in the horde resolves as a death of the hands only', async () => {
    const locker = { ...emptyLoadout(), medkits: 2 };
    const open = { simId: '', mode: 'solo', startedAt: 1, highest: 4, difficulty: 'lights_out' } as const;
    const { slot, store } = sharedStore({ hands: ARMED, locker, silver: 80, openOverrun: open });
    const { sync } = await opened(store);
    await sync.settled();
    expect(slot.save.hands).toEqual(emptyLoadout());
    expect(slot.save.locker).toEqual(locker);
    expect(slot.save.silver).toBe(80);
    expect(slot.save.openOverrun).toBeNull();
    expect(slot.save.overruns[0]).toMatchObject({ outcome: 'died', highest: 4, difficulty: 'lights_out' });
  });

  it('a co-op quit waits for the room: kept while the body is still there, a death when it is gone', async () => {
    const open = { simId: '', mode: 'coop', startedAt: 1 } as const;
    const kept = sharedStore({ hands: ARMED, openOverrun: open });
    const keeping = syncOver(kept.store, 'coop');
    await keeping.sync.open();
    keeping.sync.welcomed({ type: 'welcome', yourId: 'me', tickRate: TICK_RATE, mapSeed: 0, difficulty: 'stay_close', resumed: true });
    await keeping.sync.settled();
    expect(kept.slot.save.openOverrun).not.toBeNull();
    expect(kept.slot.save.hands).toEqual(ARMED);
    keeping.sync.close();
    const gone = sharedStore({ hands: ARMED, openOverrun: open });
    const leaving = await opened(gone.store, 'coop');
    leaving.sync.welcomed({ type: 'welcome', yourId: 'me', tickRate: TICK_RATE, mapSeed: 0, difficulty: 'stay_close', resumed: false });
    await leaving.sync.settled();
    expect(gone.slot.save.hands).toEqual(emptyLoadout());
    expect(gone.slot.save.openOverrun).toBeNull();
  });

  it('a co-op refresh mid-breach joins empty-handed, and the body the room let go is a death of the hands alone', async () => {
    const locker = { ...emptyLoadout(), guns: { carbine: {} }, medkits: 2 };
    const { slot, store } = sharedStore({ hands: ARMED, locker });
    const first = await opened(store, 'coop');
    await see(first.sync, frame({ overrun: BREACHED, player: { owned: ['pistol'], ammoBag: { pistol: 20, carbine: 0, shotgun: 0 } } }));
    expect(slot.save.openOverrun).not.toBeNull();
    first.sync.close();

    const again = syncOver(store, 'coop');
    const save = await again.sync.open();
    expect(joinHomeFor(save, { highest: 3, finished: false }).loadout).toEqual(emptyLoadout());
    again.sync.welcomed({ type: 'welcome', yourId: 'me', tickRate: TICK_RATE, mapSeed: 0, difficulty: 'stay_close' });
    await again.sync.settled();
    expect(slot.save.hands).toEqual(emptyLoadout());
    expect(slot.save.overruns.map((r) => r.outcome)).toEqual(['died']);

    await see(again.sync, frame({ tick: 200, overrun: BREACHED }), frame({ tick: 201, overrun: BREACHED }));
    expect(slot.save.hands).toEqual(emptyLoadout());
    expect(slot.save.locker).toEqual(locker);
    expect(slot.save.overruns).toHaveLength(1);
    again.sync.close();
  });

  it('a breach on file keeps its forfeit: hands the room would refuse are not put back in the locker', async () => {
    const overCap = { ...emptyLoadout(), medkits: MEDKIT_MAX + 1 };
    const { store } = sharedStore({ hands: overCap, openOverrun: { simId: '', mode: 'coop', startedAt: 1 } });
    const { sync } = syncOver(store, 'coop');
    const save = await sync.open();
    expect(save.locker.medkits).toBe(0);
    expect(joinHomeFor(save, { highest: 1, finished: false }).loadout).toEqual(emptyLoadout());
    sync.close();
  });

  it.each([
    ['survived', HELD],
    ['over without this player', { ...HELD, phase: 'lost' }],
  ] as const)('a breach %s is closed by one write at a time, so a failed save waits for its retry', async (_name, after) => {
    const { slot, scripted, store } = sharedStore();
    let attempts = 0;
    const counted: HomeStore = { load: store.load, save: (next) => (attempts++, store.save(next)) };
    const { sync } = await opened(counted);
    await see(sync, frame({ overrun: BREACHED }));
    const before = attempts;
    scripted.push({ kind: 'failed', reason: 'quota' });
    sync.observe(frame({ tick: 101, overrun: after }), 'me');
    sync.observe(frame({ tick: 102, overrun: after }), 'me');
    await sync.settled();
    expect(attempts - before).toBe(1);
    expect(sync.saveError).toBe('quota');
    expect(slot.save.openOverrun).not.toBeNull();
  });

  it('an old breach left on file by a body the room kept, with the horde long over, is a death', async () => {
    const open = { simId: '', mode: 'coop', startedAt: 1 } as const;
    const { slot, store } = sharedStore({ hands: ARMED, openOverrun: open });
    const { sync } = await opened(store, 'coop');
    await see(sync, frame({ overrun: { ...HELD, phase: 'counting', left: 200 } }));
    expect(slot.save.hands).toEqual(emptyLoadout());
    expect(slot.save.openOverrun).toBeNull();
  });
});

describe('the casualties of one receipt', () => {
  it('are the same whatever the roll count, and are keyed by the receipt', () => {
    const save = stockedSave();
    const later = { ...save, shop: { ...save.shop, rolls: save.shop.rolls + 5 } };
    const key = overrunKey(overrunReceipt({ outcome: 'fled', share: 0.5 }));
    expect(fleeCasualties(later, 0.5, key).killed).toEqual(fleeCasualties(save, 0.5, key).killed);
    const others = ['a:1', 'b:2', 'c:3', 'd:4', 'e:5', 'f:6'].map((k) => fleeCasualties(save, 0.5, k).killed.join());
    expect(new Set(others).size).toBeGreaterThan(1);
  });

  it('leave the stream the next stock roll draws from alone', () => {
    const save = stockedSave();
    const after = applyOverrunReceipt(save, overrunReceipt({ outcome: 'fled', share: 1 }), CONTEXT);
    expect(after.shop.rolls).toBe(save.shop.rolls);
    expect(after.shop.seed).toBe(save.shop.seed);
    const stockNext = rollStock(after).shop.merchants;
    const survivors = MERCHANT_IDS.filter((id) => !after.overruns[0].merchantsLost.includes(id));
    expect(survivors.length).toBeGreaterThan(0);
    expect(Object.keys(stockNext)).toEqual(Object.keys(after.shop.merchants));
  });
});

describe('leaving the room mid-horde', () => {
  const TOKEN = 'token-a';

  function readyAt(state: SimState, id: string): void {
    const body = state.players.find((p) => p.id === id) as SimState['players'][number];
    (body.home as NonNullable<typeof body.home>).ready = true;
  }

  function breachedRoom(): { sim: GameSimulation; state: SimState } {
    const sim = new GameSimulation({ seed: SEED, overrun: true, home: true });
    sim.addPlayer('a', 'a', TOKEN, undefined, { loadout: ARMED, highest: 2 });
    sim.addPlayer('b', 'b', 'token-b', undefined, { loadout: ARMED, highest: 2 });
    sim.snapshot();
    const state = stateOf(sim);
    const overrun = state.overrun as NonNullable<SimState['overrun']>;
    overrun.phase = 'breached';
    overrun.total = 10;
    overrun.left = 0;
    return { sim, state };
  }

  it('a body ready at the van that closes the tab dies in it, its gear lost, and the room keeps the receipt for a refresh', () => {
    const { sim, state } = breachedRoom();
    readyAt(state, 'a');
    sim.removePlayer('a');
    const body = state.departed.get(TOKEN);
    expect(body?.home?.overrun).toMatchObject({ outcome: 'died', lost: ARMED });
  });

  it('a body that left from the van before the breach gets no flight receipt and costs nothing', () => {
    const { sim, state } = breachedRoom();
    const overrun = state.overrun as NonNullable<SimState['overrun']>;
    overrun.phase = 'counting';
    readyAt(state, 'a');
    sim.removePlayer('a');
    const left = state.departed.get(TOKEN) as SimState['players'][number];
    expect(left.home?.overrun).toBeNull();
    overrun.phase = 'breached';
    writeFlight(state);
    expect(left.home?.overrun).toBeNull();
    const b = state.players.find((p) => p.id === 'b') as SimState['players'][number];
    expect(b.home?.overrun).toMatchObject({ outcome: 'fled' });
  });

  it('a body that fell in the horde and opens its chest keeps its died receipt inside the held one', () => {
    const { state } = breachedRoom();
    const overrun = state.overrun as NonNullable<SimState['overrun']>;
    const a = state.players.find((p) => p.id === 'a') as SimState['players'][number];
    writeDied(state, a, overrun);
    const died = a.home?.overrun;
    overrunHolds(state, overrun);
    openChest(state, a);
    expect(a.home?.overrun).toMatchObject({ outcome: 'held', died });
    const b = state.players.find((p) => p.id === 'b') as SimState['players'][number];
    openChest(state, b);
    expect(b.home?.overrun).toMatchObject({ outcome: 'held' });
    expect(b.home?.overrun).not.toHaveProperty('died');
  });

  it('a body ready at the van gets a died receipt, not a fled one, when it disconnects', () => {
    const { sim, state } = breachedRoom();
    readyAt(state, 'a');
    sim.removePlayer('a');
    writeFlight(state);
    expect(state.departed.get(TOKEN)?.home?.overrun?.outcome).toBe('died');
    const b = state.players.find((p) => p.id === 'b');
    expect(b?.home?.overrun?.outcome).toBe('fled');
  });

  it('a body holding an unapplied chest receipt is kept through a refresh, not thrown away', () => {
    const { sim, state } = breachedRoom();
    overrunHolds(state, state.overrun as NonNullable<SimState['overrun']>);
    const a = state.players.find((p) => p.id === 'a') as SimState['players'][number];
    openChest(state, a);
    sim.removePlayer('a');
    expect(state.departed.get(TOKEN)?.home?.overrun?.outcome).toBe('held');
  });

  it('a body that died in the horde is kept through a refresh with its died receipt, and so is one left in the bunker', () => {
    const { sim, state } = breachedRoom();
    const a = state.players.find((p) => p.id === 'a') as SimState['players'][number];
    writeDied(state, a, state.overrun as NonNullable<SimState['overrun']>);
    sim.removePlayer('a');
    expect(state.departed.get(TOKEN)?.home?.overrun?.outcome).toBe('died');
  });

  it('a body with nothing at stake is let go, and its open breach resolves it on the next load', () => {
    const { sim, state } = breachedRoom();
    sim.removePlayer('a');
    expect(state.departed.has(TOKEN)).toBe(false);
  });

  it('a body with nothing at stake is still let go once the horde is dead', () => {
    const { sim, state } = breachedRoom();
    overrunHolds(state, state.overrun as NonNullable<SimState['overrun']>);
    sim.removePlayer('a');
    expect(state.departed.has(TOKEN)).toBe(false);
  });
});
