import { afterEach, describe, expect, it } from 'vitest';
import { MAX_BUFFERED_BYTES } from '../server/limits.ts';
import { startGameServer } from '../server/server.ts';
import type { RunningGameServer } from '../server/server.ts';
import { BOTTLE_CARRY } from '../shared/bottles.ts';
import { MAX_PLAYERS, MEDKIT_MAX, TICK_RATE, WEAPONS } from '../shared/constants.ts';
import { PART_CARRY_CAP, PART_ORDER } from '../shared/gun-upgrade-data.ts';
import { OVERRUN_LIVE } from '../shared/home-protocol.ts';
import type { Loadout, OverrunView } from '../shared/home-protocol.ts';
import { FINAL_LEVEL } from '../shared/levels.ts';
import { emptyLoadout, loadoutOfEntity } from '../shared/loadout.ts';
import { gunsFree, OVERRUN_CLOCK_SEC } from '../shared/overrun.ts';
import { hurtPlayer } from '../shared/player-health.ts';
import { TILE_SIZE, WEAPON_ORDER } from '../shared/protocol.ts';
import type { PlayerState, SimState } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import type { HomeSave } from '../src/game/home/home-store.ts';
import { driveToTown, playerNamed, standAtStation } from './helpers/home-harness.ts';
import { browserWith, HomeTab, waitFor } from './helpers/home-socket.ts';
import { SEED, stateOf, steps } from './helpers/sim-harness.ts';

/** Past the first visit, so the clock runs. */
const HIGHEST = 2;

const PISTOL: Loadout = { ...emptyLoadout(), guns: { pistol: {} }, ammoBag: { pistol: 30, carbine: 0, shotgun: 0 }, medkits: 1 };
const CARBINE: Loadout = { ...emptyLoadout(), guns: { pistol: {}, carbine: {} }, ammoBag: { pistol: 10, carbine: 20, shotgun: 0 }, knife: true };
/** What the locker holds while the overrun takes the hands: it must come through untouched. */
const LOCKER: Loadout = { ...emptyLoadout(), medkits: 2, bottles: 1 };

/** Every gun, every bag full: the most any snapshot has to say about a body's kit. */
function fullKit(): Loadout {
  const counts = <K extends string>(ids: readonly K[], count: (id: K) => number) => Object.fromEntries(ids.map((id) => [id, count(id)])) as Record<K, number>;
  return {
    ...emptyLoadout(),
    guns: Object.fromEntries(WEAPON_ORDER.map((weapon) => [weapon, {}])),
    ammoBag: counts(WEAPON_ORDER, (weapon) => WEAPONS[weapon].reserveCap),
    parts: counts(PART_ORDER, () => PART_CARRY_CAP),
    medkits: MEDKIT_MAX,
    knife: true,
    bottles: BOTTLE_CARRY,
  };
}

const heldBy = (tab: HomeTab): Loadout => loadoutOfEntity(tab.me as NonNullable<HomeTab['me']>);
const homeOf = (p: PlayerState): NonNullable<PlayerState['home']> => p.home as NonNullable<PlayerState['home']>;
const overrunOf = (state: SimState): NonNullable<SimState['overrun']> => state.overrun as NonNullable<SimState['overrun']>;
/** The clock as this tab's last frame showed it. */
const viewOf = (tab: HomeTab): OverrunView | undefined => tab.client.lastSnapshot?.home?.overrun;
const receiptOf = (tab: HomeTab) => tab.me?.home?.overrun ?? null;

describe('the overrun over sockets', () => {
  let server: RunningGameServer;
  let sim: GameSimulation;
  let state: SimState;
  const tabs: HomeTab[] = [];
  let tokens = 0;

  async function openRoom(): Promise<void> {
    sim = new GameSimulation({ seed: SEED, workbench: 'timed', overrun: true, home: true });
    state = stateOf(sim);
    server = await startGameServer({ port: 0, simulation: sim });
  }

  /** A tab in the room with its first frames seen. */
  async function joined(save: Partial<HomeSave> = {}, highest = HIGHEST): Promise<HomeTab> {
    const tab = new HomeTab(server.port, browserWith(save));
    tabs.push(tab);
    await tab.join({ token: `overrun-${tokens++}`, highest });
    await tab.nextFrame();
    await tab.nextFrame();
    return tab;
  }

  const bodyOf = (tab: HomeTab): PlayerState => playerNamed(state, tab.id);
  const unkillable = (...party: HomeTab[]): void => {
    for (const body of party.map(bodyOf)) {
      body.maxHealth = 1e9;
      body.health = 1e9;
    }
  };
  const openStation = (tab: HomeTab): void => {
    standAtStation(state, bodyOf(tab), 'locker');
    homeOf(bodyOf(tab)).station = 'locker';
  };
  const goneQuiet = (tab: HomeTab): void => {
    homeOf(bodyOf(tab)).lastActiveTick = state.tick - 61 * TICK_RATE;
  };

  /** The clock runs out, and every tab has seen the door go. */
  async function breach(...party: HomeTab[]): Promise<void> {
    overrunOf(state).left = 1e-6;
    await waitFor(() => party.every((tab) => viewOf(tab)?.phase === 'breached'));
  }

  /** Down well out of a teammate's reach, so nobody revives them, bleeding out to dead the next tick. The last one down is never seen dead: the bunker falls and the room stands in the same tick. */
  async function killOff(tab: HomeTab, seenDead = true): Promise<void> {
    const body = bodyOf(tab);
    body.x = state.map.width - 2 * TILE_SIZE;
    body.y = state.map.height - 2 * TILE_SIZE;
    hurtPlayer(state, body, body.maxHealth);
    body.bleedout = 1e-6;
    if (seenDead) await waitFor(() => tab.me?.status === 'dead');
  }

  /** Nothing is left to come and nothing stands. */
  function clearHorde(): void {
    overrunOf(state).queue = [];
    for (const z of state.zombies) if (z.horde) z.health = 0;
  }

  afterEach(async () => {
    for (const tab of tabs.splice(0)) tab.crash();
    await server.close();
  });

  describe('the clock', () => {
    it('runs in a server room only as a Campaign room, and only once the overrun is live', async () => {
      server = await startGameServer({ port: 0 });
      const tab = new HomeTab(server.port, browserWith({}));
      tabs.push(tab);
      await tab.join({ token: `overrun-${tokens++}`, highest: HIGHEST });
      await tab.nextFrame();
      await tab.nextFrame();
      expect(tab.client.lastSnapshot?.home).toBeDefined();
      expect(viewOf(tab) !== undefined).toBe(OVERRUN_LIVE);
      expect(receiptOf(tab)).toBeNull();
    });

    it('is one clock for the room: a joiner takes it up where it stands', async () => {
      await openRoom();
      const first = await joined();
      expect(viewOf(first)).toMatchObject({ phase: 'counting', slowed: false, total: 0 });
      const wound = OVERRUN_CLOCK_SEC * 0.4;
      overrunOf(state).left = wound;
      const second = await joined();
      await first.nextFrame();
      const [a, b] = [first, second].map((tab) => viewOf(tab) as OverrunView);
      expect(b.phase).toBe('counting');
      expect(b.left).toBeLessThanOrEqual(wound);
      expect(b.left).toBeGreaterThan(wound - 10);
      expect(Math.abs(a.left - b.left)).toBeLessThan(1);
      expect(overrunOf(state).left).toBeLessThan(OVERRUN_CLOCK_SEC / 2);
    });

    it('runs at half only while both have a station open, and the wire says so', async () => {
      await openRoom();
      const first = await joined();
      const second = await joined();
      openStation(first);
      await first.nextFrame();
      await first.nextFrame();
      expect(viewOf(first)?.slowed).toBe(false);
      openStation(second);
      await waitFor(() => viewOf(first)?.slowed && viewOf(second)?.slowed);
      homeOf(bodyOf(first)).station = null;
      await waitFor(() => viewOf(first)?.slowed === false && viewOf(second)?.slowed === false);
    });

    it('does not let a gone-quiet player hold the slow rate', async () => {
      await openRoom();
      const first = await joined();
      const idle = await joined();
      openStation(first);
      await first.nextFrame();
      await first.nextFrame();
      expect(viewOf(first)?.slowed).toBe(false);
      goneQuiet(idle);
      await waitFor(() => viewOf(first)?.slowed && viewOf(idle)?.slowed);
    });
  });

  describe('going down', () => {
    it('one dies and spectates to the end, then stands at the spawn holding nothing', async () => {
      await openRoom();
      const fighter = await joined({ hands: CARBINE, locker: LOCKER });
      const fallen = await joined({ hands: PISTOL, locker: LOCKER });
      unkillable(fighter);
      await breach(fighter, fallen);
      await killOff(fallen);
      await waitFor(() => receiptOf(fallen));
      expect(receiptOf(fallen)).toMatchObject({ outcome: 'died', chest: null, share: 0, lost: PISTOL });
      expect(receiptOf(fighter)).toBeNull();
      const peek = fighter.client.lastSnapshot?.players.find((p) => p.id === fallen.id);
      expect(peek?.home?.overrun ?? null).toBeNull();
      expect(heldBy(fallen)).toEqual(emptyLoadout());
      await fallen.nextFrame();
      await fallen.nextFrame();
      expect(fallen.me?.status).toBe('dead');
      expect(viewOf(fallen)?.phase).toBe('breached');
      clearHorde();
      await waitFor(() => viewOf(fallen)?.phase === 'held' && fallen.me?.status === 'alive');
      expect(fallen.me?.health).toBe(fallen.me?.maxHealth);
      expect(heldBy(fallen)).toEqual(emptyLoadout());
      expect(heldBy(fighter)).toEqual(CARBINE);
      expect(fallen.save.locker).toEqual(LOCKER);
    });

    it('both down loses the bunker, and each loses only the gear in hand', async () => {
      await openRoom();
      const first = await joined({ hands: PISTOL, locker: LOCKER });
      const second = await joined({ hands: CARBINE, locker: LOCKER });
      await breach(first, second);
      await killOff(first);
      await killOff(second, false);
      await waitFor(() => viewOf(first)?.phase === 'lost' && viewOf(second)?.phase === 'lost');
      await waitFor(() => first.me?.status === 'alive' && second.me?.status === 'alive');
      expect(receiptOf(first)).toMatchObject({ outcome: 'died', lost: PISTOL });
      expect(receiptOf(second)).toMatchObject({ outcome: 'died', lost: CARBINE });
      expect(heldBy(first)).toEqual(emptyLoadout());
      expect(heldBy(second)).toEqual(emptyLoadout());
      expect(state.zombies.filter((z) => z.horde)).toHaveLength(0);
      expect(first.save.locker).toEqual(LOCKER);
      expect(second.save.locker).toEqual(LOCKER);
    });
  });

  describe('the van and the line', () => {
    it('the van leaving mid-horde gives each a fled receipt with the same share', async () => {
      await openRoom();
      const first = await joined({ hands: PISTOL });
      const second = await joined({ hands: CARBINE });
      unkillable(first, second);
      await breach(first, second);
      steps(sim, 3 * TICK_RATE);
      for (const z of state.zombies) if (z.horde) z.health = 0;
      driveToTown(sim, state, HIGHEST);
      expect(state.overrun).toBeNull();
      await waitFor(() => receiptOf(first) && receiptOf(second));
      const [a, b] = [receiptOf(first), receiptOf(second)];
      expect(a).toMatchObject({ outcome: 'fled', chest: null, lost: null });
      expect(b).toMatchObject({ outcome: 'fled' });
      expect(a?.share).toBeGreaterThan(0);
      expect(a?.share).toBeLessThan(1);
      expect(b?.share).toBe(a?.share);
      expect(b?.kills).toBe(a?.kills);
      expect(b?.serial).not.toBe(a?.serial);
    });

    it('a disconnect mid-horde takes the body out without a word, and the refresh rejoins empty-handed, the death on file and the locker whole', async () => {
      await openRoom();
      const stays = await joined({ hands: CARBINE });
      const storage = browserWith({ hands: PISTOL, locker: LOCKER });
      const drops = new HomeTab(server.port, storage);
      tabs.push(drops);
      await drops.join({ token: 'refreshing', highest: HIGHEST });
      await drops.nextFrame();
      unkillable(stays);
      await breach(stays, drops);
      await waitFor(() => drops.save.openOverrun !== null);
      drops.crash();
      await waitFor(() => state.players.length === 1);
      expect(state.departed.size).toBe(0);
      expect(overrunOf(state).phase).toBe('breached');
      await stays.nextFrame();
      expect(viewOf(stays)?.phase).toBe('breached');

      const back = new HomeTab(server.port, storage);
      tabs.push(back);
      await back.join({ token: 'refreshing', highest: HIGHEST });
      expect(back.brought?.loadout).toEqual(emptyLoadout());
      expect(back.welcome?.resumed).toBeUndefined();
      await back.nextFrame();
      await back.nextFrame();
      expect(heldBy(back)).toEqual(emptyLoadout());
      expect(receiptOf(back)).toBeNull();
      expect(viewOf(back)?.phase).toBe('breached');
      expect(back.save.overruns.map((record) => record.outcome)).toEqual(['died']);
      expect(back.save.hands).toEqual(emptyLoadout());
      expect(back.save.locker).toEqual(LOCKER);
    });

    it('a join during the breach lands in the fight with its own gear', async () => {
      await openRoom();
      const first = await joined({ hands: CARBINE });
      unkillable(first);
      await breach(first);
      const late = await joined({ hands: PISTOL });
      expect(viewOf(late)).toMatchObject({ phase: 'breached' });
      expect(late.me?.status).toBe('alive');
      expect(heldBy(late)).toEqual(PISTOL);
      expect(receiptOf(late)).toBeNull();
      expect(gunsFree(state)).toBe(true);
      expect(state.players).toHaveLength(2);
    });
  });

  describe('the packet budget', () => {
    it('the worst snapshot in a full horde, four bodies in full kit, stays under what a socket buffers', async () => {
      await openRoom();
      const party: HomeTab[] = [];
      for (let i = 0; i < MAX_PLAYERS; i++) party.push(await joined({ hands: fullKit() }, FINAL_LEVEL));
      unkillable(...party);
      for (const tab of party) openStation(tab);
      await breach(...party);
      const { total } = overrunOf(state);
      expect(total).toBeGreaterThan(0);
      while (overrunOf(state).queue.length > 0) steps(sim, TICK_RATE);
      await waitFor(() => party.every((tab) => viewOf(tab)?.hostiles === total));
      // Stepping the sim by hand builds no snapshot, so every event of the drain waits in sim.events for the
      // next broadcast. That first frame is the test's own backlog, not what a live room sends (a snapshot
      // empties the list, shared/snapshot-build.ts), so let one go by unmeasured and size the frames after it.
      for (const tab of party) await tab.nextFrame();
      for (const tab of party) {
        for (let frame = 0; frame < 5; frame++) {
          await tab.nextFrame();
          const bytes = Buffer.byteLength(JSON.stringify(tab.client.lastSnapshot));
          expect(bytes).toBeLessThan(MAX_BUFFERED_BYTES);
        }
      }
    });
  });
});
