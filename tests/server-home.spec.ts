import { afterEach, describe, expect, it } from 'vitest';
import { MAX_PACKET_BYTES } from '../server/limits.ts';
import { startGameServer } from '../server/server.ts';
import type { RunningGameServer } from '../server/server.ts';
import { BOTTLE_CARRY } from '../shared/bottles.ts';
import { JOIN_TOKEN_MAX_LENGTH, MEDKIT_MAX, REVIVE_RANGE, TICK_RATE, WEAPONS } from '../shared/constants.ts';
import { DIFFICULTIES } from '../shared/difficulty.ts';
import { GUN_SLOTS, PART_CARRY_CAP, PART_ORDER, UPGRADE_ORDER, UPGRADES } from '../shared/gun-upgrade-data.ts';
import type { GunUpgrade } from '../shared/gun-upgrade-data.ts';
import type { GunFit } from '../shared/gun-upgrades.ts';
import { BUNKER_LEVEL, BUNKER_SEED, isBunkerMap } from '../shared/home-protocol.ts';
import type { HomeView, Loadout } from '../shared/home-protocol.ts';
import { FINAL_LEVEL } from '../shared/levels.ts';
import { emptyLoadout, loadoutOfEntity, validateLoadout } from '../shared/loadout.ts';
import { hurtPlayer } from '../shared/player-health.ts';
import { WEAPON_ORDER } from '../shared/protocol.ts';
import type { PlayerEntity, WeaponId } from '../shared/protocol.ts';
import { EFFECT_ORDER, KIT_CARRY_CAP } from '../shared/round-effect-data.ts';
import type { PlayerState, SimState } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import type { HomeSave, OpenTrip } from '../src/game/home/home-store.ts';
import { bankTrip, driveToTown, playerNamed, quietTown, standAtVan } from './helpers/home-harness.ts';
import { browserWith, HomeTab, waitFor } from './helpers/home-socket.ts';
import { SEED, stateOf, steps, VAN_WAIT_TICKS } from './helpers/sim-harness.ts';
import { TestClient } from './helpers/ws-client.ts';

const IDLE_TICKS = 60 * TICK_RATE;

const GEAR: Loadout = {
  ...emptyLoadout(),
  guns: { pistol: {}, carbine: { fit: { ranks: { damage: 1 }, quirk: null } } },
  ammoBag: { pistol: 30, carbine: 20, shotgun: 0 },
  medkits: 2,
  knife: true,
  bottles: 1,
};

const OPEN_TRIP: OpenTrip = { level: 1, mode: 'coop', difficulty: 'stay_close', startedAt: 1 };

const heldBy = (tab: HomeTab): Loadout => loadoutOfEntity(tab.me as NonNullable<HomeTab['me']>);
const homeOf = (p: PlayerState): NonNullable<PlayerState['home']> => p.home as NonNullable<PlayerState['home']>;

/** Every field as long as it can legally be: each upgrade named, and the slots spent as far as they go. */
function longestFit(weapon: WeaponId): GunFit {
  let slots = GUN_SLOTS[weapon];
  const spend = (upgrade: GunUpgrade): [GunUpgrade, number] => {
    const rank = Math.min(slots, UPGRADES[upgrade].maxRank);
    slots -= rank;
    return [upgrade, rank];
  };
  return { ranks: Object.fromEntries(UPGRADE_ORDER.map(spend)), quirk: 'hair_trigger', effect: EFFECT_ORDER[0] };
}

function worstLoadout(): Loadout {
  const counts = <K extends string>(ids: readonly K[], count: (id: K) => number) => Object.fromEntries(ids.map((id) => [id, count(id)])) as Record<K, number>;
  return {
    guns: Object.fromEntries(WEAPON_ORDER.map((weapon) => [weapon, { fit: longestFit(weapon) }])),
    ammoBag: counts(WEAPON_ORDER, (weapon) => WEAPONS[weapon].reserveCap),
    parts: counts(PART_ORDER, () => PART_CARRY_CAP),
    kits: counts(EFFECT_ORDER, () => KIT_CARRY_CAP),
    medkits: MEDKIT_MAX,
    knife: true,
    bottles: BOTTLE_CARRY,
  };
}

const longestDifficulty = (): string => DIFFICULTIES.map(({ id }) => id).sort((a, b) => b.length - a.length)[0];

describe('home over sockets', () => {
  let server: RunningGameServer;
  let sim: GameSimulation;
  let state: SimState;
  const tabs: HomeTab[] = [];
  let tokens = 0;

  async function openRoom(): Promise<void> {
    sim = new GameSimulation({ seed: SEED, workbench: 'timed', home: true });
    state = stateOf(sim);
    server = await startGameServer({ port: 0, simulation: sim });
  }

  const tabOn = (storage: ReturnType<typeof browserWith>): HomeTab => {
    const tab = new HomeTab(server.port, storage);
    tabs.push(tab);
    return tab;
  };

  /** A tab in the room with its first frame seen and its save settled. */
  async function joined(save: Partial<HomeSave> = {}, highest?: number): Promise<HomeTab> {
    const tab = await tabOn(browserWith(save)).join({ token: `home-${tokens++}`, highest });
    await tab.nextFrame();
    await tab.nextFrame();
    return tab;
  }

  const bodyOf = (tab: HomeTab): PlayerState => playerNamed(state, tab.id);

  /** Out in a quiet town, with every tab's trip on file. */
  async function outOnATrip(...party: HomeTab[]): Promise<void> {
    driveToTown(sim, state);
    quietTown(state);
    for (const tab of party) await waitFor(() => tab.save.openTrip);
  }

  const left = (count: number): Promise<boolean> => waitFor(() => state.departed.size === count);

  afterEach(async () => {
    for (const tab of tabs.splice(0)) tab.crash();
    await server.close();
  });

  describe('gear at the door', () => {
    it('join with gear', async () => {
      await openRoom();
      const tab = await joined({ hands: GEAR }, 3);
      expect(tab.welcome).toMatchObject({ mapSeed: BUNKER_SEED });
      expect(tab.welcome?.resumed).toBeUndefined();
      expect(heldBy(tab)).toEqual(GEAR);
      expect(tab.save.hands).toEqual(GEAR);
      expect(tab.client.lastSnapshot?.home?.roomHighest).toBe(3);
    });

    it('refused gear stays in the locker, and the client takes the server\'s view', async () => {
      await openRoom();
      const overCap = { ...GEAR, medkits: MEDKIT_MAX + 1 };
      const tab = await joined({ hands: overCap });
      expect(heldBy(tab)).toEqual(emptyLoadout());
      await waitFor(() => tab.save.locker.medkits === overCap.medkits);
      expect(tab.save.hands).toEqual(emptyLoadout());
      expect(tab.save.locker.guns).toEqual(GEAR.guns);
      expect(tab.client.closeCode).toBeNull();
    });

    it('refused gear stays in the locker when the join lands mid-trip', async () => {
      await openRoom();
      const friend = await joined();
      await outOnATrip(friend);
      const overCap = { ...GEAR, medkits: MEDKIT_MAX + 1 };
      const tab = await joined({ hands: overCap });
      expect(tab.me).toMatchObject({ owned: ['pistol'], medkits: 0, knife: false });
      expect(tab.save.hands).toEqual(emptyLoadout());
      expect(tab.save.locker).toEqual(overCap);
      bankTrip(sim, state);
      await waitFor(() => tab.save.appliedReceipts.length === 1);
      expect(tab.save.locker).toMatchObject({ guns: GEAR.guns, medkits: MEDKIT_MAX, knife: true });
    });

    it('refused gear stays in the locker when the join lands beside a teammate at the van, bar the gun the van hands over', async () => {
      await openRoom();
      const friend = await joined();
      friend.client.send({ type: 'home', action: { kind: 'pick_level', level: 1 } });
      await waitFor(() => friend.client.lastSnapshot?.home?.pickedLevel);
      standAtVan(state, bodyOf(friend));
      await waitFor(() => homeOf(bodyOf(friend)).ready);
      const overCap = { ...GEAR, medkits: MEDKIT_MAX + 1 };
      const tab = await joined({ hands: overCap });
      await waitFor(() => Object.keys(tab.save.hands.guns).length === 1);
      const [gun] = Object.keys(tab.save.hands.guns);
      expect(tab.save.locker.guns).not.toHaveProperty(gun);
      expect(tab.save.hands).toMatchObject({ medkits: 0, knife: false });
      expect(tab.save.locker).toMatchObject({ medkits: MEDKIT_MAX + 1, knife: GEAR.knife });
    });

    it('an equip the room refuses changes nothing on either side', async () => {
      await openRoom();
      const tab = await joined({ hands: GEAR, locker: { ...emptyLoadout(), medkits: 1 } });
      tab.sync.equip({ ...GEAR, medkits: MEDKIT_MAX + 1 });
      await tab.nextFrame();
      await tab.nextFrame();
      expect(heldBy(tab)).toEqual(GEAR);
      expect(tab.save.hands).toEqual(GEAR);
      expect(tab.save.locker.medkits).toBe(1);
    });

    it('a body left in the bunker is not kept, so the save is the word on what is in hand and nothing is doubled', async () => {
      await openRoom();
      const friend = await joined();
      const tab = await joined({ hands: GEAR });
      const { token } = bodyOf(tab);
      tab.crash();
      await waitFor(() => state.players.length === 1);
      expect(state.departed.size).toBe(0);
      const movedBackToLocker = browserWith({ locker: GEAR });
      const back = await tabOn(movedBackToLocker).join({ token: token as string });
      expect(back.welcome?.resumed).toBeUndefined();
      await back.nextFrame();
      expect(heldBy(back)).toEqual(emptyLoadout());
      expect(back.save.locker).toEqual(GEAR);
      expect(friend.client.closeCode).toBeNull();
    });

    it('a new loadout between trips', async () => {
      await openRoom();
      const tab = await joined({ hands: GEAR });
      await outOnATrip(tab);
      bankTrip(sim, state);
      await waitFor(() => tab.save.appliedReceipts.length === 1);
      expect(tab.save.locker).toEqual(GEAR);

      const lighter = { ...emptyLoadout(), guns: { carbine: GEAR.guns.carbine }, ammoBag: { pistol: 0, carbine: 20, shotgun: 0 } };
      tab.sync.equip(lighter);
      await waitFor(() => tab.save.hands.guns.carbine);
      expect(heldBy(tab)).toEqual(lighter);
      expect(tab.save.locker.guns).toEqual({ pistol: {} });
      expect(tab.save.locker.ammoBag.carbine).toBe(0);

      await outOnATrip(tab);
      await waitFor(() => tab.client.lastSnapshot?.mapSeed !== BUNKER_SEED);
      tab.client.send({ type: 'home', action: { kind: 'equip', loadout: GEAR } });
      await tab.nextFrame();
      await tab.nextFrame();
      expect(heldBy(tab)).toEqual(lighter);
    });

    it('a worst-case join fits MAX_PACKET_BYTES', async () => {
      await openRoom();
      const loadout = worstLoadout();
      expect(validateLoadout(loadout)).not.toBeNull();
      const home = { loadout, highest: FINAL_LEVEL, finished: true };
      const packet = { type: 'join', name: '\u{1F9DF}'.repeat(16), token: 'x'.repeat(JOIN_TOKEN_MAX_LENGTH), character: 4, difficulty: longestDifficulty(), style: 'campaign', home };
      const bytes = Buffer.byteLength(JSON.stringify(packet));
      expect(bytes).toBeLessThanOrEqual(MAX_PACKET_BYTES);
      expect(Buffer.byteLength(JSON.stringify({ type: 'home', action: { kind: 'equip', loadout } }))).toBeLessThan(bytes);

      const client = new TestClient(server.port);
      await client.opened();
      client.send(packet);
      const welcome = await waitFor(() => client.received.find((heard) => heard.type === 'welcome'));
      const frame = await waitFor(() => client.lastSnapshot);
      const body = frame.players.find((player) => welcome.type === 'welcome' && player.id === welcome.yourId);
      client.socket.terminate();
      expect(loadoutOfEntity(body as PlayerEntity).guns).toEqual(loadout.guns);
    });
  });

  describe('a trip that was not finished', () => {
    it('a join with a trip still open brings an empty loadout', async () => {
      await openRoom();
      const tab = await joined({ hands: GEAR, openTrip: OPEN_TRIP });
      expect(tab.brought?.loadout).toEqual(emptyLoadout());
      expect(heldBy(tab)).toEqual(emptyLoadout());
      await waitFor(() => tab.save.ledger.length === 1);
      expect(tab.save).toMatchObject({ openTrip: null, hands: emptyLoadout(), locker: emptyLoadout() });
      expect(tab.save.ledger[0]).toMatchObject({ outcome: 'died', level: OPEN_TRIP.level });
    });

    it('joining a trip under way with that save gets only the free pistol', async () => {
      await openRoom();
      const friend = await joined();
      await outOnATrip(friend);
      const tab = await joined({ hands: GEAR, openTrip: OPEN_TRIP });
      expect(tab.welcome?.resumed).toBeUndefined();
      expect(tab.me).toMatchObject({ owned: ['pistol'], medkits: 0, knife: false });
      await waitFor(() => tab.save.ledger.length === 1);
      expect(tab.save.hands).toEqual(emptyLoadout());
    });

    it('a quit trip cannot be escaped by coming back under a new token', async () => {
      await openRoom();
      const friend = await joined();
      const storage = browserWith({ hands: GEAR });
      const tab = await tabOn(storage).join({ token: 'first-tab' });
      await tab.nextFrame();
      await outOnATrip(friend, tab);
      tab.crash();
      await left(1);

      const again = await tabOn(storage).join({ token: 'second-tab' });
      expect(again.brought?.loadout).toEqual(emptyLoadout());
      expect(again.welcome?.resumed).toBeUndefined();
      await waitFor(() => again.save.ledger.length === 1);
      await again.nextFrame();
      expect(again.me).toMatchObject({ owned: ['pistol'], medkits: 0, knife: false });
      expect(again.save.ledger[0].outcome).toBe('died');
      expect(again.save.hands).toEqual(emptyLoadout());
      expect(again.save.locker).toEqual(emptyLoadout());

      bankTrip(sim, state);
      await waitFor(() => friend.save.appliedReceipts.length === 1);
      await waitFor(() => again.save.appliedReceipts.length === 1);
      expect(again.save.locker.guns).toEqual({ pistol: {} });
      expect(again.save.locker.knife).toBe(false);
    });

    it('a refresh takes the body back with what it has, and the trip stays open', async () => {
      await openRoom();
      const friend = await joined();
      const storage = browserWith({ hands: GEAR });
      const tab = await tabOn(storage).join({ token: 'refreshing' });
      await tab.nextFrame();
      await outOnATrip(friend, tab);
      homeOf(bodyOf(tab)).silver = 50;
      tab.crash();
      await left(1);

      const back = await tabOn(storage).join({ token: 'refreshing' });
      expect(back.brought?.loadout).toEqual(emptyLoadout());
      expect(back.welcome?.resumed).toBe(true);
      await back.nextFrame();
      await back.nextFrame();
      expect(heldBy(back)).toEqual(GEAR);
      expect(back.save.openTrip).not.toBeNull();
      expect(back.save.ledger).toEqual([]);

      bankTrip(sim, state);
      await waitFor(() => back.save.appliedReceipts.length === 1);
      expect(back.save).toMatchObject({ silver: 50, locker: GEAR, openTrip: null });
    });

    it('a refresh at the van is not read as another tab, and stepping away cancels the trip', async () => {
      await openRoom();
      const friend = await joined();
      const storage = browserWith({ hands: GEAR });
      const tab = await tabOn(storage).join({ token: 'at-the-van' });
      await tab.nextFrame();
      tab.client.send({ type: 'home', action: { kind: 'pick_level', level: 1 } });
      await waitFor(() => tab.client.lastSnapshot?.home?.pickedLevel);
      standAtVan(state, bodyOf(tab));
      await waitFor(() => homeOf(bodyOf(tab)).ready);
      tab.crash();
      await left(1);

      const back = await tabOn(storage).join({ token: 'at-the-van' });
      expect(back.welcome?.resumed).toBe(true);
      await back.nextFrame();
      await back.nextFrame();
      expect(back.sync.saveError).toBeNull();
      expect(back.save.openTrip).not.toBeNull();

      const body = bodyOf(back);
      body.x = bodyOf(friend).x;
      body.y = bodyOf(friend).y;
      await waitFor(() => back.save.openTrip === null);
      await waitFor(() => !homeOf(bodyOf(back)).ready);
      expect(back.save.hands).toEqual(GEAR);
    });

    it('a body left behind comes back in the bunker holding a died receipt', async () => {
      await openRoom();
      const friend = await joined();
      const storage = browserWith({ hands: GEAR });
      const tab = await tabOn(storage).join({ token: 'left-behind' });
      await tab.nextFrame();
      await outOnATrip(friend, tab);
      homeOf(bodyOf(tab)).silver = 50;
      tab.crash();
      await left(1);
      bankTrip(sim, state);

      const back = await tabOn(storage).join({ token: 'left-behind' });
      expect(back.welcome).toMatchObject({ mapSeed: BUNKER_SEED, resumed: true });
      await waitFor(() => back.save.appliedReceipts.length === 1);
      expect(back.save).toMatchObject({ silver: 0, openTrip: null, hands: emptyLoadout(), locker: emptyLoadout() });
      expect(back.save.ledger).toHaveLength(1);
      expect(back.save.ledger[0]).toMatchObject({ outcome: 'died', silver: 50 });
      await back.nextFrame();
      expect(heldBy(back)).toEqual(emptyLoadout());
    });
  });

  describe('an empty room', () => {
    async function emptiedMidTrip(storage: ReturnType<typeof browserWith>, token: string): Promise<void> {
      const tab = await tabOn(storage).join({ token });
      await tab.nextFrame();
      await outOnATrip(tab);
      tab.crash();
      await waitFor(() => sim.playerCount === 0);
    }

    it('an emptied room resets to the bunker', async () => {
      await openRoom();
      await emptiedMidTrip(browserWith({ hands: GEAR }), 'last-out');
      expect(isBunkerMap(sim.map)).toBe(true);
      expect(sim.level).toBe(BUNKER_LEVEL);
      expect(sim.phase).not.toBe('gameover');
      expect(state.homeRun).toMatchObject({ tripLevel: null, pickedLevel: null });
      expect(state.departed.size).toBe(0);
      expect(state.zombies).toEqual([]);
      expect(sim.hasBodyFor('last-out')).toBe(false);
    });

    it('the last one out cannot come back to their body, and the trip counts as a death', async () => {
      await openRoom();
      const storage = browserWith({ hands: GEAR });
      await emptiedMidTrip(storage, 'last-out');
      const back = await tabOn(storage).join({ token: 'last-out' });
      expect(back.welcome?.mapSeed).toBe(BUNKER_SEED);
      expect(back.welcome?.resumed).toBeUndefined();
      await waitFor(() => back.save.ledger.length === 1);
      expect(back.save).toMatchObject({ openTrip: null, hands: emptyLoadout(), locker: emptyLoadout() });
      await back.nextFrame();
      expect(heldBy(back)).toEqual(emptyLoadout());
    });

    it('receipts carry on from where they were, so a later trip is not mistaken for an old one', async () => {
      await openRoom();
      const storage = browserWith({ hands: GEAR });
      await emptiedMidTrip(storage, 'last-out');
      const spent = state.homeRun?.nextReceipt as number;
      expect(spent).toBeGreaterThan(1);
      const back = await tabOn(storage).join({ token: 'last-out' });
      await back.nextFrame();
      await outOnATrip(back);
      bankTrip(sim, state);
      await waitFor(() => back.save.appliedReceipts.length === 1);
      expect(back.save.appliedReceipts[0]).toBe(`${state.homeRun?.simId}:${spent}`);
    });

    it('a first player choosing a new difficulty still starts in the bunker', async () => {
      await openRoom();
      await emptiedMidTrip(browserWith(), 'last-out');
      const other = DIFFICULTIES.map(({ id }) => id).find((id) => id !== sim.difficulty);
      const tab = await tabOn(browserWith()).join({ token: 'next-in', difficulty: other });
      expect(tab.welcome).toMatchObject({ mapSeed: BUNKER_SEED, difficulty: other });
      expect(isBunkerMap(sim.map)).toBe(true);
    });
  });

  describe('the co-op rules, seen from a tab', () => {
    const receiptOf = (tab: HomeTab): HomeView['receipt'] => tab.me?.home?.receipt ?? null;

    it('level pick is capped at the room\'s highest', async () => {
      await openRoom();
      const far = await joined({}, 3);
      await joined({}, 1);
      far.client.send({ type: 'home', action: { kind: 'pick_level', level: 7 } });
      await waitFor(() => far.client.lastSnapshot?.home?.pickedLevel);
      expect(far.client.lastSnapshot?.home?.pickedLevel).toBe(3);
    });

    it('a player gone quiet rides along, and their trip opens on arrival', async () => {
      await openRoom();
      const keen = await joined();
      const quiet = await joined({ hands: GEAR });
      keen.client.send({ type: 'home', action: { kind: 'pick_level', level: 1 } });
      await waitFor(() => keen.client.lastSnapshot?.home?.pickedLevel);
      standAtVan(state, bodyOf(keen));
      await waitFor(() => homeOf(bodyOf(keen)).ready);
      expect(keen.save.openTrip).not.toBeNull();
      steps(sim, IDLE_TICKS + VAN_WAIT_TICKS);
      expect(isBunkerMap(sim.map)).toBe(false);
      await waitFor(() => quiet.save.openTrip);
      expect(heldBy(quiet)).toEqual(GEAR);
    });

    it('a teammate who dies loses it all, and the rest bank', async () => {
      await openRoom();
      const lucky = await joined();
      const unlucky = await joined({ hands: GEAR });
      await outOnATrip(lucky, unlucky);
      const body = bodyOf(unlucky);
      homeOf(body).jewels = { small: 1, large: 0 };
      hurtPlayer(state, body, body.maxHealth * 2);
      // They set out together at the van, close enough to revive, so the lucky one steps out of reach.
      bodyOf(lucky).x = body.x + REVIVE_RANGE * 4;
      body.bleedout = 0;
      sim.step();
      expect(body.status).toBe('dead');
      expect(state.pickups.map((item) => item.type)).toContain('jewel_small');
      bankTrip(sim, state);
      await waitFor(() => unlucky.save.ledger.length === 1);
      await waitFor(() => lucky.save.ledger.length === 1);
      expect(unlucky.save.ledger[0]).toMatchObject({ outcome: 'died', jewels: { small: 1, large: 0 } });
      expect(unlucky.save).toMatchObject({ silver: 0, rawJewels: { small: 0, large: 0 }, locker: emptyLoadout() });
      expect(lucky.save.ledger[0].outcome).toBe('banked');
    });

    it('downed when the van leaves counts as dead', async () => {
      await openRoom();
      const standing = await joined();
      const downed = await joined({ hands: GEAR });
      await outOnATrip(standing, downed);
      const body = bodyOf(downed);
      hurtPlayer(state, body, body.maxHealth * 2);
      expect(body.status).toBe('downed');
      bankTrip(sim, state);
      await waitFor(() => downed.save.ledger.length === 1);
      expect(receiptOf(downed)?.outcome).toBe('died');
      expect(downed.save.locker).toEqual(emptyLoadout());
    });

    it('disconnecting while downed drops what is carried at once', async () => {
      await openRoom();
      const friend = await joined();
      const tab = await joined({ hands: GEAR });
      await outOnATrip(friend, tab);
      const body = bodyOf(tab);
      homeOf(body).jewels = { small: 0, large: 1 };
      hurtPlayer(state, body, body.maxHealth * 2);
      tab.crash();
      await left(1);
      expect(state.pickups.filter((item) => item.type === 'jewel_large').map((item) => item.rounds)).toEqual([200]);
      expect(homeOf(body).jewels).toEqual({ small: 0, large: 0 });
    });
  });
});
