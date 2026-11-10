import { describe, expect, it } from 'vitest';
import { TICK_RATE } from '../shared/constants.ts';
import type { MerchantId, StationId } from '../shared/home-protocol.ts';
import { emptySave } from '../src/game/home/home-store.ts';
import type { HomeSave, HomeStore } from '../src/game/home/home-store.ts';
import { HomeSync } from '../src/game/home/home-sync.ts';
import { emptyTally } from '../src/game/home/quest-tally.ts';
import type { TripTally } from '../src/game/home/quest-tally.ts';
import type { QuestContext } from '../src/game/home/quests.ts';
import { ME, TOWN_SEED, frame, receipt, sharedStore } from './helpers/home-sync-frames.ts';

const withActive = (save: HomeSave, merchant: MerchantId, id: string, progress = 0): HomeSave => ({
  ...save,
  quests: { ...save.quests, active: { ...save.quests.active, [merchant]: { id, progress, acceptedAt: 0 } } },
});
const noQuests = (): HomeSave => {
  const save = emptySave(7);
  return { ...save, quests: { ...save.quests, active: {} } };
};
const counter = (merchant: MerchantId | null, patch: Partial<QuestContext> = {}): QuestContext => ({ station: merchant, highest: 3, difficulty: 'stay_close', now: 9, ...patch });

/** A session over the store that counts what the tally was asked for. */
async function session(store: HomeStore, tally: TripTally = emptyTally()) {
  const asked = { tally: 0 };
  const sync = new HomeSync({
    store,
    mode: 'solo',
    sendHome: () => {},
    tally: () => {
      asked.tally += 1;
      return tally;
    },
    highest: () => 3,
  });
  await sync.open();
  sync.welcomed({ type: 'welcome', yourId: ME, tickRate: TICK_RATE, mapSeed: 1, difficulty: 'stay_close' });
  await sync.settled();
  return { sync, asked };
}

const bunkerWith = (home: Parameters<typeof frame>[0] = {}, tick = 100) => frame({ ...home, tick });
const progressOf = (save: HomeSave, merchant: MerchantId): number | undefined => save.quests.active[merchant]?.progress;

describe('a trip receipt and the quests', () => {
  it('moves progress in the same save as the credit, and only once across a refresh', async () => {
    const { slot, store } = sharedStore(withActive(noQuests(), 'quartermaster', 'out_and_back'));
    const first = await session(store);
    first.sync.observe(bunkerWith({ home: { receipt: receipt() } }), ME);
    await first.sync.settled();
    expect(progressOf(slot.save, 'quartermaster')).toBe(1);
    expect(slot.save.silver).toBe(50);
    const again = await session(store);
    again.sync.observe(bunkerWith({ home: { receipt: receipt() } }, 101), ME);
    await again.sync.settled();
    expect(progressOf(slot.save, 'quartermaster')).toBe(1);
    expect(slot.save.silver).toBe(50);
    expect(slot.save.appliedReceipts).toHaveLength(1);
  });

  it('reapplies after a conflict with the tally it first read, and counts once', async () => {
    const { slot, store, scripted } = sharedStore(withActive(noQuests(), 'quartermaster', 'out_and_back'));
    const { sync, asked } = await session(store);
    scripted.push({ kind: 'conflict' });
    sync.observe(bunkerWith({ home: { receipt: receipt() } }), ME);
    await sync.settled();
    expect(progressOf(slot.save, 'quartermaster')).toBe(1);
    expect(slot.save.appliedReceipts).toHaveLength(1);
    expect(asked.tally).toBe(1);
  });

  it('moves nothing for a death except resetting a streak', async () => {
    const base = withActive(withActive(noQuests(), 'medic', 'steady_hands', 2), 'quartermaster', 'out_and_back');
    const { slot, store } = sharedStore(base);
    const { sync } = await session(store);
    sync.observe(bunkerWith({ home: { receipt: receipt({ outcome: 'died', silver: 30 }) } }), ME);
    await sync.settled();
    expect(progressOf(slot.save, 'medic')).toBe(0);
    expect(progressOf(slot.save, 'quartermaster')).toBe(0);
    expect(slot.save.silver).toBe(base.silver);
  });

  it('keeps a finished streak through a death, and ignores a death the quest does not count', async () => {
    const finished = sharedStore(withActive(noQuests(), 'medic', 'steady_hands', 3));
    const one = await session(finished.store);
    one.sync.observe(bunkerWith({ home: { receipt: receipt({ outcome: 'died', level: 3 }) } }), ME);
    await one.sync.settled();
    expect(progressOf(finished.slot.save, 'medic')).toBe(3);
    const running = sharedStore(withActive(noQuests(), 'medic', 'steady_hands', 2));
    const two = await session(running.store);
    two.sync.observe(bunkerWith({ home: { receipt: receipt({ outcome: 'died', level: 1 }) } }), ME);
    await two.sync.settled();
    expect(progressOf(running.slot.save, 'medic')).toBe(2);
  });

  it('counts a trip found open on load, a quit or a crash, as a death for a streak', async () => {
    const out = { level: 3, mode: 'solo' as const, difficulty: 'stay_close' as const, startedAt: 1 };
    const running = sharedStore({ ...withActive(noQuests(), 'medic', 'steady_hands', 2), openTrip: out });
    await session(running.store);
    expect(running.slot.save.openTrip).toBeNull();
    expect(running.slot.save.ledger).toEqual([expect.objectContaining({ outcome: 'died', level: 3 })]);
    expect(progressOf(running.slot.save, 'medic')).toBe(0);
    const finished = sharedStore({ ...withActive(noQuests(), 'medic', 'steady_hands', 3), openTrip: out });
    await session(finished.store);
    expect(progressOf(finished.slot.save, 'medic')).toBe(3);
    const shallow = sharedStore({ ...withActive(noQuests(), 'medic', 'steady_hands', 2), openTrip: { ...out, level: 1 } });
    await session(shallow.store);
    expect(progressOf(shallow.slot.save, 'medic')).toBe(2);
  });

  it('rolls jobs only on a banked receipt: ten quit trips leave the offers alone', async () => {
    const { slot, store } = sharedStore(noQuests());
    const { sync } = await session(store);
    const before = slot.save.quests;
    for (let serial = 1; serial <= 10; serial++) {
      sync.observe(bunkerWith({ home: { receipt: receipt({ outcome: 'died', serial }) } }, 100 + serial), ME);
      await sync.settled();
    }
    expect(slot.save.appliedReceipts).toHaveLength(10);
    expect(slot.save.quests.jobs).toEqual(before.jobs);
    expect(slot.save.quests.rolls).toBe(before.rolls);
    sync.observe(bunkerWith({ home: { receipt: receipt({ serial: 11 }) } }, 120), ME);
    await sync.settled();
    expect(slot.save.quests.rolls).toBe(before.rolls + 1);
  });

  it('counts the tally the player earned toward a trip quest', async () => {
    const base = emptyTally();
    const earned: TripTally = { ...base, counts: { ...base.counts, headshots: 15 } };
    const { slot, store } = sharedStore(withActive(noQuests(), 'gunsmith', 'headhunter'));
    const { sync } = await session(store, earned);
    sync.observe(bunkerWith({ home: { receipt: receipt({ level: 2 }) } }), ME);
    await sync.settled();
    expect(progressOf(slot.save, 'gunsmith')).toBe(15);
  });
});

describe('the forge and visits', () => {
  it('counts a smelt in the same save as the payout', async () => {
    const { slot, store } = sharedStore({ ...withActive(noQuests(), 'powder', 'first_smelt'), rawJewels: { small: 1, large: 0 } });
    const { sync } = await session(store);
    for (let second = 0; second <= 3; second++) {
      sync.observe(bunkerWith({ home: { station: 'forge' as StationId } }, 100 + second * TICK_RATE), ME);
      await sync.settled();
    }
    expect(slot.save.rawJewels).toEqual({ small: 0, large: 0 });
    expect(slot.save.silver).toBeGreaterThan(0);
    expect(progressOf(slot.save, 'powder')).toBe(1);
  });

  it('counts opening a station toward a visit quest', async () => {
    const { slot, store } = sharedStore(withActive(noQuests(), 'quartermaster', 'report_in'));
    const { sync } = await session(store);
    sync.visit('quartermaster');
    await sync.settled();
    expect(progressOf(slot.save, 'quartermaster')).toBe(1);
  });
});

describe('quest actions', () => {
  it('accept, then turn in once ready, each saved; a second try is refused', async () => {
    const { slot, store } = sharedStore(noQuests());
    const { sync } = await session(store);
    expect(await sync.acceptQuest('gunsmith', 'bring_iron', counter('gunsmith'))).toBe('saved');
    expect(slot.save.quests.active.gunsmith?.id).toBe('bring_iron');
    expect(await sync.acceptQuest('gunsmith', 'bring_iron', counter('gunsmith'))).toBe('refused');
    expect(await sync.turnInQuest('gunsmith', counter('gunsmith'))).toBe('refused');
    expect(await sync.abandonQuest('gunsmith', counter('gunsmith'))).toBe('saved');
    expect(await sync.abandonQuest('gunsmith', counter('gunsmith'))).toBe('refused');
    expect(slot.save.quests.active.gunsmith).toBeUndefined();
  });

  it('is refused away from the counter', async () => {
    const { slot, store } = sharedStore(noQuests());
    const { sync } = await session(store);
    expect(await sync.acceptQuest('gunsmith', 'bring_iron', counter('medic'))).toBe('refused');
    expect(slot.save.quests.active.gunsmith).toBeUndefined();
  });

  it('turns a ready quest in once, paying silver', async () => {
    const { slot, store } = sharedStore(withActive(noQuests(), 'medic', 'pharmacy_run', 1));
    const { sync } = await session(store);
    expect(await sync.turnInQuest('medic', counter('medic'))).toBe('saved');
    expect(slot.save.silver).toBe(60);
    expect(slot.save.quests.done).toContain('pharmacy_run');
    expect(await sync.turnInQuest('medic', counter('medic'))).toBe('refused');
    expect(slot.save.silver).toBe(60);
  });

  it('reports a conflict and a failed write without changing the save', async () => {
    const { slot, store, scripted } = sharedStore(noQuests());
    const { sync } = await session(store);
    scripted.push({ kind: 'conflict' });
    expect(await sync.acceptQuest('gunsmith', 'bring_iron', counter('gunsmith'))).toBe('conflict');
    scripted.push({ kind: 'failed', reason: 'full' });
    expect(await sync.acceptQuest('gunsmith', 'bring_iron', counter('gunsmith'))).toBe('failed');
    expect(slot.save.quests.active.gunsmith).toBeUndefined();
  });

  it('refuses accept and turn-in at a closed stall, and the open quest waits', async () => {
    const open = withActive(noQuests(), 'medic', 'pharmacy_run', 1);
    const closed: HomeSave = { ...open, shop: { ...open.shop, merchants: { ...open.shop.merchants, medic: { items: {}, closedTrips: 2 }, gunsmith: { items: {}, closedTrips: 2 } } } };
    const { slot, store } = sharedStore(closed);
    const { sync } = await session(store);
    expect(await sync.turnInQuest('medic', counter('medic'))).toBe('refused');
    expect(await sync.acceptQuest('gunsmith', 'bring_iron', counter('gunsmith'))).toBe('refused');
    expect(progressOf(slot.save, 'medic')).toBe(1);
  });
});

describe('a town frame', () => {
  it('leaves quests alone while the van is out', async () => {
    const { slot, store } = sharedStore(withActive(noQuests(), 'quartermaster', 'out_and_back'));
    const { sync } = await session(store);
    const before = slot.save.quests;
    sync.observe(frame({ mapSeed: TOWN_SEED, level: 2 }), ME);
    await sync.settled();
    expect(slot.save.quests).toEqual(before);
  });
});
