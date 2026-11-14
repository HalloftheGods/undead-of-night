import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TripReceipt } from '../shared/home-protocol.ts';
import { emptyLoadout } from '../shared/loadout.ts';
import { createBrowserHomeStore } from '../src/game/home/browser-home-store.ts';
import { migrateCamp } from '../src/game/home/camp-migrate.ts';
import { smeltTick } from '../src/game/home/forge.ts';
import { settleHands } from '../src/game/home/gear-pool.ts';
import { emptySave } from '../src/game/home/home-store.ts';
import type { HomeSave, OpenTrip } from '../src/game/home/home-store.ts';
import { applyReceipt, resolveOpenTrip } from '../src/game/home/trip-ledger.ts';

const HOME_KEY = 'outbreak.home';

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

const fullStore = {
  getItem: () => null,
  setItem(): void {
    throw new Error('QuotaExceededError');
  },
};

const blockedStore = {
  getItem(): string {
    throw new Error('blocked');
  },
  setItem(): void {
    throw new Error('blocked');
  },
};

const receipt = (patch: Partial<TripReceipt> = {}): TripReceipt => ({
  simId: 'sim-a', serial: 1, outcome: 'banked', level: 2, difficulty: 'stay_close', silver: 50, jewels: { small: 2, large: 1 },
  replay: false, score: 10, kills: 1, hordes: 1, seconds: 60, ending: false, gear: null, ...patch,
});

const trip = (patch: Partial<OpenTrip> = {}): OpenTrip => ({ level: 3, mode: 'solo', difficulty: 'lights_out', startedAt: 1000, ...patch });

const save = (patch: Partial<HomeSave> = {}): HomeSave => ({ ...emptySave(7), ...patch });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the browser store', () => {
  it('starts with an empty save, and each browser gets its own shop seed', async () => {
    const first = await createBrowserHomeStore(memoryStore()).load();
    const second = await createBrowserHomeStore(memoryStore()).load();
    expect(first).toMatchObject({ version: 0, silver: 0, openTrip: null });
    expect(first.shop.seed).not.toBe(second.shop.seed);
  });

  it('saves under its own key and counts versions up', async () => {
    const memory = memoryStore();
    const store = createBrowserHomeStore(memory);
    const result = await store.save(save({ silver: 30 }));
    expect(result).toEqual({ kind: 'saved', version: 1 });
    expect(memory.data.has(HOME_KEY)).toBe(true);
    expect(await store.load()).toMatchObject({ version: 1, silver: 30 });
  });

  it('a stale save returns conflict and writes nothing', async () => {
    const store = createBrowserHomeStore(memoryStore());
    await store.save(save({ silver: 30 }));
    expect(await store.save(save({ silver: 999 }))).toEqual({ kind: 'conflict' });
    expect((await store.load()).silver).toBe(30);
  });

  it('a write failure comes back as failed, not silence', async () => {
    expect(await createBrowserHomeStore(fullStore).save(save())).toEqual({ kind: 'failed', reason: 'QuotaExceededError' });
    expect((await createBrowserHomeStore(blockedStore).save(save())).kind).toBe('failed');
    expect((await createBrowserHomeStore(null).save(save())).kind).toBe('failed');
  });

  it('loads an empty save when storage is blocked', async () => {
    expect((await createBrowserHomeStore(blockedStore).load()).version).toBe(0);
    expect((await createBrowserHomeStore(null).load()).version).toBe(0);
  });

  it('wraps read, compare and write in one lock', async () => {
    const order: string[] = [];
    const memory = memoryStore();
    const request = vi.fn(async (name: string, step: () => unknown) => {
      order.push(`lock ${name}`);
      const result = step();
      order.push('unlock');
      return result;
    });
    vi.stubGlobal('navigator', { locks: { request } });
    const spied = { getItem: memory.getItem, setItem: (key: string, value: string) => { order.push('write'); memory.setItem(key, value); } };
    await createBrowserHomeStore(spied).save(save());
    // The save, then the marker that says this build wrote it: both inside the lock.
    expect(order).toEqual([`lock ${HOME_KEY}`, 'write', 'write', 'unlock']);
  });

  it('still saves on a plain http page, which has no locks', async () => {
    vi.stubGlobal('navigator', {});
    expect((await createBrowserHomeStore(memoryStore()).save(save())).kind).toBe('saved');
  });

  it('comes back as failed when the lock itself fails', async () => {
    vi.stubGlobal('navigator', { locks: { request: () => Promise.reject(new Error('no lock')) } });
    expect(await createBrowserHomeStore(memoryStore()).save(save())).toEqual({ kind: 'failed', reason: 'no lock' });
  });

  it('reads a garbled save as a new one, and can write over it', async () => {
    const memory = memoryStore({ [HOME_KEY]: '{nope' });
    const store = createBrowserHomeStore(memory);
    const loaded = await store.load();
    expect(loaded.version).toBe(0);
    expect((await store.save(loaded)).kind).toBe('saved');
  });

  it('keeps what reads and falls back only for the field that does not', async () => {
    const stored = { ...save({ version: 4, silver: 80 }), rawJewels: 'many', ledger: [{ level: 'x' }], openTrip: { level: 2 } };
    const loaded = await createBrowserHomeStore(memoryStore({ [HOME_KEY]: JSON.stringify(stored) })).load();
    expect(loaded).toMatchObject({ version: 4, silver: 80, rawJewels: { small: 0, large: 0 }, ledger: [], openTrip: null });
  });

  it('brings a saved trip, ledger and locker back whole', async () => {
    const memory = memoryStore();
    const store = createBrowserHomeStore(memory);
    const written = applyReceipt(save({ openTrip: trip(), silver: 5 }), receipt());
    await store.save({ ...written, openTrip: trip() });
    const { version: _version, ...loaded } = await store.load();
    const { version: _old, ...expected } = { ...written, openTrip: trip() };
    expect(loaded).toEqual(migrateCamp(expected as HomeSave, { radio: false, tracks: [] }));
  });
});

describe('a receipt', () => {
  it('banks silver and jewels, closes the trip and writes a ledger row', () => {
    const next = applyReceipt(save({ silver: 10, rawJewels: { small: 1, large: 0 }, openTrip: trip() }), receipt());
    expect(next.silver).toBe(60);
    expect(next.rawJewels).toEqual({ small: 3, large: 1 });
    expect(next.openTrip).toBeNull();
    expect(next.appliedReceipts).toEqual(['sim-a:1']);
    expect(next.ledger).toEqual([expect.objectContaining({ level: 2, outcome: 'banked', difficulty: 'stay_close', silver: 50, jewels: { small: 2, large: 1 }, replay: false })]);
  });

  it('puts the gear that came home in the locker', () => {
    const gear = { ...emptyLoadout(), guns: { pistol: {} }, medkits: 1 };
    const next = applyReceipt(save({ hands: gear, openTrip: trip() }), receipt({ gear }));
    expect(next.locker.guns.pistol).toBeDefined();
    expect(next.locker.medkits).toBe(1);
    expect(next.hands).toEqual(emptyLoadout());
  });

  it('applies once', () => {
    const once = applyReceipt(save(), receipt());
    expect(applyReceipt(once, receipt())).toBe(once);
  });

  it("a new sim's serial 1 is not mistaken for an old one", () => {
    const first = applyReceipt(save(), receipt({ simId: 'sim-a', serial: 1 }));
    const second = applyReceipt(first, receipt({ simId: 'sim-b', serial: 1 }));
    expect(second.silver).toBe(100);
    expect(second.appliedReceipts).toEqual(['sim-a:1', 'sim-b:1']);
  });

  it('a death clears gear and carried treasure, and keeps the bank and locker', () => {
    const locker = { ...emptyLoadout(), medkits: 2 };
    const hands = { ...emptyLoadout(), guns: { carbine: {} } };
    const next = applyReceipt(save({ silver: 70, rawJewels: { small: 4, large: 0 }, locker, hands, openTrip: trip() }), receipt({ outcome: 'died' }));
    expect(next.hands).toEqual(emptyLoadout());
    expect(next.locker).toEqual(locker);
    expect(next.silver).toBe(70);
    expect(next.rawJewels).toEqual({ small: 4, large: 0 });
    expect(next.openTrip).toBeNull();
  });

  it('a died receipt credits nothing and records what was lost in the ledger', () => {
    const next = applyReceipt(save(), receipt({ outcome: 'died', silver: 33, jewels: { small: 1, large: 1 } }));
    expect(next.silver).toBe(0);
    expect(next.rawJewels).toEqual({ small: 0, large: 0 });
    expect(next.ledger).toEqual([expect.objectContaining({ outcome: 'died', silver: 33, jewels: { small: 1, large: 1 } })]);
    expect(next.appliedReceipts).toEqual(['sim-a:1']);
  });
});

describe('a trip found open', () => {
  it('an open solo trip resolves as a death on load', () => {
    const hands = { ...emptyLoadout(), medkits: 1 };
    const next = resolveOpenTrip(save({ hands, silver: 9, openTrip: trip() }), null);
    expect(next.openTrip).toBeNull();
    expect(next.hands).toEqual(emptyLoadout());
    expect(next.silver).toBe(9);
    expect(next.ledger).toEqual([expect.objectContaining({ level: 3, outcome: 'died', difficulty: 'lights_out', silver: 0 })]);
  });

  it('holds a co-op trip until the server has answered', () => {
    const open = save({ openTrip: trip({ mode: 'coop' }) });
    expect(resolveOpenTrip(open, null)).toBe(open);
    expect(resolveOpenTrip(open, true)).toBe(open);
    expect(resolveOpenTrip(open, false).openTrip).toBeNull();
  });

  it('leaves a save with no trip alone', () => {
    const quiet = save();
    expect(resolveOpenTrip(quiet, false)).toBe(quiet);
  });
});

describe('the forge', () => {
  const raw = save({ rawJewels: { small: 2, large: 1 } });

  it('takes 3 seconds a jewel, paying 40 and 200', () => {
    expect(smeltTick(raw, 3)).toMatchObject({ silver: 200, rawJewels: { small: 2, large: 0 } });
    expect(smeltTick(raw, 6)).toMatchObject({ silver: 240, rawJewels: { small: 1, large: 0 } });
    expect(smeltTick(raw, 9)).toMatchObject({ silver: 280, rawJewels: { small: 0, large: 0 } });
  });

  it('pays nothing for a part-done jewel', () => {
    expect(smeltTick(raw, 2.9)).toBe(raw);
  });

  it('stops when the jewels run out', () => {
    expect(smeltTick(raw, 300).silver).toBe(280);
    const empty = save();
    expect(smeltTick(empty, 3)).toBe(empty);
  });
});

describe('settling hands', () => {
  it('moves what the server gave out of the locker', () => {
    const locker = { ...emptyLoadout(), guns: { pistol: {}, carbine: {} }, medkits: 3, ammoBag: { pistol: 40, carbine: 20, shotgun: 0 } };
    const held = { ...emptyLoadout(), guns: { pistol: {} }, medkits: 1, ammoBag: { pistol: 30, carbine: 0, shotgun: 0 } };
    const next = settleHands(save({ locker }), held);
    expect(next.hands).toEqual(held);
    expect(Object.keys(next.locker.guns)).toEqual(['carbine']);
    expect(next.locker.medkits).toBe(2);
    expect(next.locker.ammoBag).toEqual({ pistol: 10, carbine: 20, shotgun: 0 });
  });

  it('puts gear back when the hand is changed, and never counts below none', () => {
    const hands = { ...emptyLoadout(), guns: { carbine: {} }, bottles: 2 };
    const held = { ...emptyLoadout(), guns: { pistol: {} }, medkits: 1 };
    const next = settleHands(save({ hands }), held);
    expect(next.locker.guns).toEqual({ carbine: {} });
    expect(next.locker.bottles).toBe(2);
    expect(next.locker.medkits).toBe(0);
  });
});
