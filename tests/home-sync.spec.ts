import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUNKER_SEED } from '../shared/home-protocol.ts';
import { MEDKIT_MAX, TICK_RATE } from '../shared/constants.ts';
import { emptyLoadout, loadoutOfEntity } from '../shared/loadout.ts';
import type { PlayerEntity, SnapshotPacket } from '../shared/protocol.ts';
import { createBrowserHomeStore } from '../src/game/home/browser-home-store.ts';
import { emptySave } from '../src/game/home/home-store.ts';
import type { SaveResult } from '../src/game/home/home-store.ts';
import { joinHomeFor, OPEN_TRIP_WAIT_MS } from '../src/game/home/home-sync.ts';
import { SaveQueue } from '../src/game/home/save-queue.ts';

import { ME, TOWN_SEED, entity, frame, atVan, inTown, receipt, trip, sharedStore, syncOver, opened, see, readyCalls, equipCalls, lockerGuns, holdingCarbine } from './helpers/home-sync-frames.ts';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('boarding the van', () => {
  it('writes the open trip, then says ready', async () => {
    const { slot, store } = sharedStore();
    const { sync, sent } = await opened(store);
    await see(sync, frame({ picked: 2, player: atVan }));
    expect(slot.save.openTrip).toMatchObject({ level: 2, mode: 'solo', difficulty: 'stay_close' });
    expect(readyCalls(sent)).toEqual([{ kind: 'ready', ready: true }]);
  });

  it('owning no gun at all boards as it is, for the free pistol', async () => {
    const { store } = sharedStore();
    const { sync, sent } = await opened(store);
    await see(sync, frame({ picked: 2, player: atVan }));
    expect(equipCalls(sent)).toEqual([]);
  });

  it('a gun already in hand boards with nothing moved', async () => {
    const hands = { ...emptyLoadout(), guns: { pistol: {} } };
    const { slot, store } = sharedStore({ hands, locker: lockerGuns });
    const { sync, sent } = await opened(store);
    await see(sync, frame({ picked: 2, player: { ...atVan, owned: ['pistol'] } }));
    expect(equipCalls(sent)).toEqual([]);
    expect(readyCalls(sent)).toEqual([{ kind: 'ready', ready: true }]);
    expect(slot.save.locker).toEqual(lockerGuns);
  });

  it('empty hands take the gun from the locker, and the trip opens once it is in the save', async () => {
    const { slot, store } = sharedStore({ locker: lockerGuns });
    const { sync, sent } = await opened(store);
    await see(sync, frame({ picked: 2, player: atVan }));
    expect(equipCalls(sent)).toHaveLength(1);
    expect(readyCalls(sent)).toEqual([]);
    expect(slot.save.openTrip).toBeNull();
    await see(sync, frame({ tick: 101, picked: 2, player: holdingCarbine }));
    expect(slot.save.hands.guns).toEqual({ carbine: {} });
    expect(slot.save.hands.ammoBag.carbine).toBe(40);
    expect(slot.save.locker.guns).toEqual({ pistol: {} });
    expect(slot.save.locker.ammoBag.carbine).toBe(0);
    expect(slot.save.locker.ammoBag.pistol).toBe(10);
    await see(sync, frame({ tick: 102, picked: 2, player: holdingCarbine }));
    expect(readyCalls(sent)).toEqual([{ kind: 'ready', ready: true }]);
    expect(slot.save.openTrip).toMatchObject({ level: 2 });
    expect(equipCalls(sent)).toHaveLength(1);
  });

  it('asks once while the room has not answered', async () => {
    const { store } = sharedStore({ locker: lockerGuns });
    const { sync, sent } = await opened(store);
    await see(sync, frame({ picked: 2, player: atVan }), frame({ tick: 101, picked: 2, player: atVan }), frame({ tick: 102, picked: 2, player: atVan }));
    expect(equipCalls(sent)).toHaveLength(1);
  });

  it('walking off mid-handover keeps the gun in hand and opens no trip', async () => {
    const { slot, store } = sharedStore({ locker: lockerGuns });
    const { sync, sent } = await opened(store);
    await see(sync, frame({ picked: 2, player: atVan }));
    await see(sync, frame({ tick: 101, picked: 2, player: { owned: ['carbine'], ammoBag: { pistol: 0, carbine: 40, shotgun: 0 } } }));
    expect(slot.save.hands.guns).toEqual({ carbine: {} });
    expect(slot.save.locker.guns).toEqual({ pistol: {} });
    expect(slot.save.openTrip).toBeNull();
    expect(readyCalls(sent)).toEqual([]);
  });

  it('a failed save of the handover settles on the retry, with no second gun', async () => {
    const { slot, scripted, store } = sharedStore({ locker: lockerGuns });
    const { sync, sent } = await opened(store);
    await see(sync, frame({ picked: 2, player: atVan }));
    scripted.push({ kind: 'failed', reason: 'quota' });
    await see(sync, frame({ tick: 101, picked: 2, player: holdingCarbine }));
    expect(readyCalls(sent)).toEqual([]);
    await see(sync, frame({ tick: 101 + TICK_RATE * 3, picked: 2, player: holdingCarbine }), frame({ tick: 102 + TICK_RATE * 3, picked: 2, player: holdingCarbine }));
    expect(slot.save.locker.guns).toEqual({ pistol: {} });
    expect(slot.save.hands.guns).toEqual({ carbine: {} });
    expect(readyCalls(sent)).toEqual([{ kind: 'ready', ready: true }]);
  });

  it('with no level picked, the van asks for the furthest the room has reached, and boards when it lands', async () => {
    const { slot, store } = sharedStore();
    const { sync, sent } = await opened(store);
    await see(sync, frame({ player: atVan }), frame({ tick: 101, player: atVan }));
    expect(sent.filter((action) => action.kind === 'pick_level')).toEqual([{ kind: 'pick_level', level: 3 }]);
    expect(slot.save.openTrip).toBeNull();
    expect(readyCalls(sent)).toEqual([]);
    await see(sync, frame({ tick: 102, picked: 3, player: atVan }));
    expect(slot.save.openTrip).toMatchObject({ level: 3 });
    expect(readyCalls(sent)).toEqual([{ kind: 'ready', ready: true }]);
  });

  it('picks nothing away from the van, or for the dead, and leaves a pick alone', async () => {
    const { store } = sharedStore();
    const { sync, sent } = await opened(store);
    await see(sync, frame(), frame({ tick: 101, player: { ...atVan, status: 'dead' } }), frame({ tick: 102, picked: 1, player: atVan }));
    expect(sent.filter((action) => action.kind === 'pick_level')).toEqual([]);
  });

  it('stepping away before the van leaves cancels the trip', async () => {
    const { slot, store } = sharedStore();
    const { sync, sent } = await opened(store);
    await see(sync, frame({ picked: 2, player: atVan }), frame({ picked: 2 }));
    expect(slot.save.openTrip).toBeNull();
    expect(readyCalls(sent)).toEqual([{ kind: 'ready', ready: true }, { kind: 'ready', ready: false }]);
  });

  it('the player is never ready on a failed save', async () => {
    const { slot, scripted, store } = sharedStore();
    const { sync, sent } = await opened(store);
    scripted.push({ kind: 'failed', reason: 'quota' });
    await see(sync, frame({ picked: 2, player: atVan }));
    await see(sync, frame({ tick: 101, picked: 2, player: atVan }));
    expect(readyCalls(sent)).toEqual([]);
    expect(slot.save.openTrip).toBeNull();
    expect(sync.saveError).toBe('quota');
  });

  it('never readies on blocked storage, and says so', async () => {
    const { sync, sent } = await opened(createBrowserHomeStore(null));
    await see(sync, frame({ picked: 2, player: atVan }));
    expect(readyCalls(sent)).toEqual([]);
    expect(sync.saveError).not.toBeNull();
  });

  it('tries again after stepping away and back', async () => {
    const { scripted, store } = sharedStore();
    const { sync, sent } = await opened(store);
    scripted.push({ kind: 'failed', reason: 'quota' });
    await see(sync, frame({ picked: 2, player: atVan }), frame({ tick: 110, picked: 2 }), frame({ tick: 100 + TICK_RATE * 3, picked: 2, player: atVan }));
    expect(readyCalls(sent)).toEqual([{ kind: 'ready', ready: true }]);
    expect(sync.saveError).toBeNull();
  });

  it('a second tab cannot board on a trip the first has open', async () => {
    const { store } = sharedStore();
    const first = await opened(store);
    const second = await opened(store);
    await see(first.sync, frame({ picked: 2, player: atVan }));
    await see(second.sync, frame({ picked: 2, player: atVan }));
    expect(readyCalls(second.sent)).toEqual([]);
    expect(second.sync.saveError).not.toBeNull();
  });
});

describe('arriving in town', () => {
  it('a player carried along by the idle rule has a trip opened on arrival', async () => {
    const { slot, store } = sharedStore();
    const { sync } = await opened(store);
    await see(sync, frame(inTown));
    expect(slot.save.openTrip).toMatchObject({ level: 2, mode: 'solo' });
  });

  it('reads the level from the town when the pick changed at the van', async () => {
    const { slot, store } = sharedStore();
    const { sync } = await opened(store);
    await see(sync, frame({ picked: 1, player: atVan }), frame(inTown));
    expect(slot.save.openTrip?.level).toBe(2);
  });
});

describe('a receipt coming in', () => {
  it('a stale save returns conflict, and a receipt re-reads and reapplies', async () => {
    const { slot, store } = sharedStore({ openTrip: trip({ mode: 'coop' }) });
    const { sync, credited } = syncOver(store, 'coop');
    await sync.open();
    sync.welcomed({ type: 'welcome', yourId: ME, tickRate: TICK_RATE, mapSeed: TOWN_SEED, resumed: true });
    await sync.settled();
    slot.save = { ...slot.save, version: slot.save.version + 1, silver: 500 };
    await see(sync, frame({ home: { receipt: receipt() } }));
    expect(slot.save.silver).toBe(550);
    expect(slot.save.appliedReceipts).toEqual(['sim-a:1']);
    expect(credited).toHaveLength(1);
  });

  it('a receipt applied, then a refresh before the save finished, applies once', async () => {
    const { slot, scripted, store } = sharedStore();
    const before = await opened(store, 'coop');
    scripted.push({ kind: 'failed', reason: 'tab closed' });
    await see(before.sync, frame({ home: { receipt: receipt() } }));
    expect(slot.save.silver).toBe(0);
    const after = await opened(store, 'coop');
    await see(after.sync, frame({ home: { receipt: receipt() } }), frame({ tick: 101, home: { receipt: receipt() } }));
    expect(slot.save.silver).toBe(50);
    const again = await opened(store, 'coop');
    await see(again.sync, frame({ home: { receipt: receipt() } }));
    expect(slot.save.silver).toBe(50);
    expect(slot.save.ledger).toHaveLength(1);
    expect(again.credited).toEqual([]);
  });

  it('two tabs on one receipt credit it once', async () => {
    const { slot, store } = sharedStore();
    const first = await opened(store, 'coop');
    const second = await opened(store, 'coop');
    await see(first.sync, frame({ home: { receipt: receipt() } }));
    await see(second.sync, frame({ home: { receipt: receipt() } }));
    expect(slot.save.silver).toBe(50);
    expect(second.credited).toEqual([]);
  });

  it('tries a failed result again, without trying every frame', async () => {
    const { slot, scripted, store } = sharedStore();
    const { sync } = await opened(store);
    const save = vi.spyOn(store, 'save');
    scripted.push({ kind: 'failed', reason: 'quota' });
    const home = { receipt: receipt() };
    await see(sync, frame({ home }), frame({ tick: 101, home }), frame({ tick: 102, home }));
    expect(save).toHaveBeenCalledTimes(1);
    await see(sync, frame({ tick: 100 + TICK_RATE * 2, home }));
    expect(slot.save.silver).toBe(50);
    expect(sync.saveError).toBeNull();
  });

  it('does not board on a result still waiting to save', async () => {
    const { scripted, store } = sharedStore();
    const { sync, sent } = await opened(store);
    scripted.push({ kind: 'failed', reason: 'quota' });
    await see(sync, frame({ picked: 2, player: atVan, home: { receipt: receipt() } }));
    expect(readyCalls(sent)).toEqual([]);
  });
});

describe('a trip found open on load', () => {
  it('an open solo trip resolves as a death on load', async () => {
    const { slot, store } = sharedStore({ openTrip: trip() });
    await syncOver(store).sync.open();
    expect(slot.save.openTrip).toBeNull();
    expect(slot.save.ledger).toEqual([expect.objectContaining({ outcome: 'died', difficulty: 'stay_close' })]);
  });

  it('an open co-op trip waits for welcome.resumed up to 10 seconds', async () => {
    const { slot, store } = sharedStore({ openTrip: trip({ mode: 'coop' }) });
    const { sync } = syncOver(store, 'coop');
    await sync.open();
    await vi.advanceTimersByTimeAsync(OPEN_TRIP_WAIT_MS - 1);
    expect(slot.save.openTrip).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    await sync.settled();
    expect(OPEN_TRIP_WAIT_MS).toBe(10_000);
    expect(slot.save.openTrip).toBeNull();
    expect(slot.save.ledger).toHaveLength(1);
  });

  it('keeps the trip when the body was reclaimed', async () => {
    const { slot, store } = sharedStore({ openTrip: trip({ mode: 'coop' }) });
    const { sync } = syncOver(store, 'coop');
    await sync.open();
    sync.welcomed({ type: 'welcome', yourId: ME, tickRate: TICK_RATE, mapSeed: TOWN_SEED, resumed: true });
    await vi.advanceTimersByTimeAsync(OPEN_TRIP_WAIT_MS);
    await sync.settled();
    expect(slot.save.openTrip).not.toBeNull();
  });

  it('settles at once on a welcome with no body', async () => {
    const { slot, store } = sharedStore({ openTrip: trip({ mode: 'coop' }) });
    const { sync } = syncOver(store, 'coop');
    await sync.open();
    sync.welcomed({ type: 'welcome', yourId: ME, tickRate: TICK_RATE, mapSeed: BUNKER_SEED });
    await sync.settled();
    expect(slot.save.openTrip).toBeNull();
  });

  it('a co-op trip left open is a death in a solo session, with no server to ask', async () => {
    const { slot, store } = sharedStore({ openTrip: trip({ mode: 'coop' }) });
    await syncOver(store, 'solo').sync.open();
    expect(slot.save.openTrip).toBeNull();
  });

  it('a join with a trip open brings nothing', () => {
    const hands = { ...emptyLoadout(), medkits: 2 };
    const progress = { highest: 3, finished: false };
    expect(joinHomeFor({ ...emptySave(1), hands, openTrip: trip() }, progress)).toEqual({ loadout: emptyLoadout(), highest: 3 });
    expect(joinHomeFor({ ...emptySave(1), hands }, progress)).toEqual({ loadout: hands, highest: 3 });
    expect(joinHomeFor(emptySave(1), { highest: 10, finished: true })).toMatchObject({ finished: true });
  });

  it('a join with a breach open brings nothing either, so a refresh in the horde cannot rejoin armed', () => {
    const hands = { ...emptyLoadout(), medkits: 2 };
    const openOverrun = { simId: '', mode: 'coop', startedAt: 1 } as const;
    expect(joinHomeFor({ ...emptySave(1), hands, openOverrun }, { highest: 3, finished: false })).toEqual({ loadout: emptyLoadout(), highest: 3 });
  });
});

describe('at the forge', () => {
  const seconds = (count: number): number => 100 + count * TICK_RATE;
  const atForge = (tick: number): SnapshotPacket => frame({ tick, home: { station: 'forge' } });

  it('the forge pays per jewel and only while at the forge', async () => {
    const { slot, store } = sharedStore({ rawJewels: { small: 2, large: 0 } });
    const { sync } = await opened(store);
    await see(sync, atForge(seconds(0)), atForge(seconds(1)), atForge(seconds(2)));
    expect(sync.forgeProgress).toBeCloseTo(2 / 3);
    expect(slot.save.silver).toBe(0);
    await see(sync, atForge(seconds(3)));
    expect(slot.save).toMatchObject({ silver: 40, rawJewels: { small: 1, large: 0 } });
    await see(sync, atForge(seconds(4)), atForge(seconds(5)), frame({ tick: seconds(6) }), atForge(seconds(7)));
    expect(slot.save).toMatchObject({ silver: 40, rawJewels: { small: 1, large: 0 } });
    expect(sync.forgeProgress).toBeLessThan(1 / 2);
  });

  it('does not run with no jewels', async () => {
    const { slot, store } = sharedStore();
    const { sync } = await opened(store);
    await see(sync, atForge(seconds(0)), atForge(seconds(1)), atForge(seconds(2)), atForge(seconds(3)));
    expect(slot.save.silver).toBe(0);
    expect(sync.forgeProgress).toBe(0);
  });

  it('a jewel a second tab has smelted is not paid twice', async () => {
    const { slot, store } = sharedStore({ rawJewels: { small: 1, large: 0 } });
    const { sync } = await opened(store);
    await see(sync, atForge(seconds(0)), atForge(seconds(1)), atForge(seconds(2)));
    slot.save = { ...slot.save, version: slot.save.version + 1, silver: 40, rawJewels: { small: 0, large: 0 } };
    await see(sync, atForge(seconds(3)));
    expect(slot.save.silver).toBe(40);
  });

  it('is not paid for a stalled tab', async () => {
    const { slot, store } = sharedStore({ rawJewels: { small: 3, large: 0 } });
    const { sync } = await opened(store);
    await see(sync, atForge(seconds(0)), atForge(seconds(60)));
    expect(slot.save.silver).toBe(0);
  });
});

describe('gear in hand', () => {
  const heldMedkits = (count: number): Partial<PlayerEntity> => ({ medkits: count });

  it('takes only what comes back on the player out of the locker', async () => {
    const locker = { ...emptyLoadout(), medkits: 3 };
    const { slot, store } = sharedStore({ locker });
    const { sync, sent } = await opened(store);
    await see(sync, frame({ tick: 100 }));
    const wanted = { ...emptyLoadout(), medkits: 2 };
    sync.equip(wanted);
    expect(sent).toContainEqual({ kind: 'equip', loadout: wanted });
    await see(sync, frame({ tick: 101, player: heldMedkits(2) }));
    expect(slot.save.hands).toEqual(loadoutOfEntity(entity(heldMedkits(2))));
    expect(slot.save.locker.medkits).toBe(1);
  });

  it('leaves the locker alone when the room refuses the gear', async () => {
    const locker = { ...emptyLoadout(), medkits: 3 };
    const { slot, store } = sharedStore({ locker });
    const { sync } = await opened(store);
    await see(sync, frame({ tick: 100 }));
    sync.equip({ ...emptyLoadout(), medkits: 3 });
    await see(sync, frame({ tick: 101 }), frame({ tick: 102 }));
    expect(slot.save.locker.medkits).toBe(3);
  });

  it('gives refused gear back on a join: the hand is what the room says', async () => {
    const hands = { ...emptyLoadout(), medkits: 2 };
    const { slot, store } = sharedStore({ hands });
    const { sync } = await opened(store);
    await see(sync, frame({ tick: 100 }));
    expect(slot.save.hands.medkits).toBe(0);
    expect(slot.save.locker.medkits).toBe(2);
  });

  it('a bench action changes the hand and nothing else', async () => {
    const { slot, store } = sharedStore({ hands: { ...emptyLoadout(), medkits: 2 } });
    const { sync } = await opened(store);
    await see(sync, frame({ tick: 100, player: heldMedkits(2) }), frame({ tick: 101, player: heldMedkits(1) }));
    expect(slot.save.hands.medkits).toBe(1);
    expect(slot.save.locker.medkits).toBe(0);
  });

  it('holds still while a trip is open', async () => {
    const { slot, store } = sharedStore({ hands: { ...emptyLoadout(), medkits: 2 } });
    const { sync } = await opened(store);
    await see(sync, frame({ tick: 100, player: heldMedkits(2) }), frame({ tick: 101, picked: 2, player: { ...atVan, medkits: 2 } }), frame({ tick: 102, picked: 2, player: { ...atVan, medkits: 1 } }));
    expect(slot.save.hands.medkits).toBe(2);
  });

  describe('an answer is paired with its request, not a clock', () => {
    const wanted = { ...emptyLoadout(), medkits: 3 };

    async function afterAnEquip(scripted?: SaveResult) {
      const parts = sharedStore({ locker: wanted });
      const synced = await opened(parts.store);
      await see(synced.sync, frame({ tick: 100 }));
      synced.sync.equip(wanted);
      if (scripted) parts.scripted.push(scripted);
      return { ...parts, ...synced };
    }

    it('a save that fails on the equip is tried again, and the retry still debits the locker', async () => {
      const { slot, sync } = await afterAnEquip({ kind: 'failed', reason: 'storage full' });
      await see(sync, frame({ tick: 101, player: heldMedkits(3) }));
      expect(sync.saveError).not.toBeNull();
      await see(sync, frame({ tick: 101 + TICK_RATE * 3, player: heldMedkits(3) }));
      expect(sync.saveError).toBeNull();
      expect(slot.save.hands.medkits).toBe(3);
      expect(slot.save.locker.medkits).toBe(0);
    });

    it('an answer later than the old two second window still comes out of the locker', async () => {
      const { slot, sync } = await afterAnEquip();
      await see(sync, frame({ tick: 100 + TICK_RATE * 5 }), frame({ tick: 100 + TICK_RATE * 6, player: heldMedkits(3) }));
      expect(slot.save.hands.medkits).toBe(3);
      expect(slot.save.locker.medkits).toBe(0);
    });

    it('a bench action after a settled equip is only a bench action', async () => {
      const { slot, sync } = await afterAnEquip();
      await see(sync, frame({ tick: 101, player: heldMedkits(3) }), frame({ tick: 102, player: heldMedkits(2) }));
      expect(slot.save.hands.medkits).toBe(2);
      expect(slot.save.locker.medkits).toBe(0);
    });

    it('a refused equip is forgotten, so a later bench action does not settle', async () => {
      const { slot, sync } = await afterAnEquip();
      await see(sync, frame({ tick: 100 + TICK_RATE * 60 }), frame({ tick: 100 + TICK_RATE * 61, player: heldMedkits(3) }));
      expect(slot.save.hands.medkits).toBe(3);
      expect(slot.save.locker.medkits).toBe(3);
    });
  });

  describe('hands the room would refuse are put back before connecting', () => {
    const overCap = { ...emptyLoadout(), medkits: MEDKIT_MAX + 1 };

    it('open returns an illegal hand to the locker, so the join brings nothing', async () => {
      const { slot, store } = sharedStore({ hands: overCap });
      const { sync } = syncOver(store);
      const save = await sync.open();
      expect(save.hands).toEqual(emptyLoadout());
      expect(save.locker.medkits).toBe(overCap.medkits);
      expect(slot.save.hands).toEqual(emptyLoadout());
      expect(joinHomeFor(save, { highest: 1, finished: false }).loadout).toEqual(emptyLoadout());
    });

    it('a legal hand stays in hand', async () => {
      const hands = { ...emptyLoadout(), medkits: 2 };
      const { store } = sharedStore({ hands });
      const { sync } = syncOver(store);
      expect((await sync.open()).hands).toEqual(hands);
    });
  });
});

describe('two tabs racing', () => {
  it('warns when a result cannot land after several tries', async () => {
    const { scripted, store } = sharedStore();
    const { sync } = await opened(store);
    scripted.push({ kind: 'conflict' }, { kind: 'conflict' }, { kind: 'conflict' }, { kind: 'conflict' });
    await see(sync, frame({ home: { receipt: receipt() } }));
    expect(sync.saveError).not.toBeNull();
  });
});

describe('a sale', () => {
  it('reports a refusal without saving', async () => {
    const { store } = sharedStore();
    const { sync } = await opened(store);
    const save = vi.spyOn(store, 'save');
    expect(await sync.buy('medic', 'nothing', { highest: 1, station: 'medic', difficulty: 'stay_close' })).toBe('refused');
    expect(save).not.toHaveBeenCalled();
  });

  it('does not retry on a conflict, and shows the fresh save', async () => {
    const { slot, store } = sharedStore({ silver: 500 });
    const queue = new SaveQueue({ store });
    await queue.load();
    slot.save = { ...slot.save, version: slot.save.version + 1, silver: 100 };
    const saved = vi.spyOn(store, 'save');
    const result = await queue.write((save) => ({ ...save, silver: save.silver - 50 }), 0);
    expect(result).toEqual({ kind: 'conflict' });
    expect(saved).toHaveBeenCalledTimes(1);
    expect(queue.save?.silver).toBe(100);
    expect(queue.error).toBeNull();
  });
});
