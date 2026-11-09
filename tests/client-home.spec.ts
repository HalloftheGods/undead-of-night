import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUNKER_SEED, MERCHANT_IDS, isBunkerSeed } from '../shared/home-protocol.ts';
import type { Loadout } from '../shared/home-protocol.ts';
import { FINAL_LEVEL } from '../shared/levels.ts';
import { emptyLoadout } from '../shared/loadout.ts';
import type { GameSimulation } from '../shared/simulation.ts';
import { AudioEngine } from '../src/audio/audio-engine.ts';
import { WorldRenderer } from '../src/engine/world-renderer.ts';
import { GameController } from '../src/game/game-controller.ts';
import { emptySave } from '../src/game/home/home-store.ts';
import { questTracker } from '../src/game/home/quest-view.ts';
import type { HomeSave, HomeStore } from '../src/game/home/home-store.ts';
import { hordeStatus } from '../src/game/hud-state.ts';
import { levelLine } from '../src/game/level-hud.ts';
import { loadCampaignProgress, loadLevelProgress, recordLevelReached } from '../src/game/level-progress.ts';
import { loadLeaderboard } from '../src/game/storage.ts';
import { noteVanCover } from '../src/game/stage-cut.ts';
import { loadBestTrip } from '../src/game/trip-record.ts';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';
import type { FakeBrowser } from './client-fake-dom.ts';
import { bankTrip, driveToTown, playerNamed, standAtStation, standAtVan } from './helpers/home-harness.ts';
import { stateOf } from './helpers/sim-harness.ts';

const FRAME_MS = 1000 / 60;
const LOCAL = 'local';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

let nextSaveFails = false;
const failNextSaves = (): void => {
  nextSaveFails = true;
};

/** One slot, as one tab sees one localStorage. */
function memoryStore(initial: Partial<HomeSave> = {}): HomeStore {
  let slot: HomeSave = { ...emptySave(7), ...initial };
  return {
    load: async () => slot,
    async save(next) {
      if (nextSaveFails) {
        nextSaveFails = false;
        return { kind: 'failed', reason: 'quota' };
      }
      if (next.version !== slot.version) return { kind: 'conflict' };
      const version = next.version + 1;
      slot = { ...next, version };
      return { kind: 'saved', version };
    },
  };
}

const gear = (patch: Partial<Loadout> = {}): Loadout => ({ ...emptyLoadout(), ...patch });

describe('the run from the bunker', () => {
  let browser: FakeBrowser;
  let game: GameController;
  let clock = 0;

  /** Frames and timers, with the save's promises settling between them. */
  async function pump(ms: number): Promise<void> {
    for (let elapsed = 0; elapsed < ms; elapsed += FRAME_MS) {
      await vi.advanceTimersByTimeAsync(FRAME_MS);
      clock += FRAME_MS;
      browser.runFrame(clock);
    }
  }

  async function boot(save: Partial<HomeSave> = {}): Promise<void> {
    game?.dispose();
    game = new GameController({ homeStore: () => memoryStore(save) });
    game.mount(fakeCanvas() as unknown as HTMLCanvasElement);
    await pump(100);
  }

  /** Into the bunker, with the world on screen. */
  async function startHome(save: Partial<HomeSave> = {}): Promise<{ sim: GameSimulation; state: ReturnType<typeof stateOf> }> {
    await boot(save);
    game.startSolo('campaign');
    await pump(300);
    const sim = game.sim as GameSimulation;
    return { sim, state: stateOf(sim) };
  }

  function press(code: string): void {
    browser.dispatch('keydown', { code, repeat: false, target: null, preventDefault() {} });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    browser = installFakeBrowser();
    vi.stubGlobal('localStorage', memoryStorage());
    clock = 0;
  });

  afterEach(() => {
    game?.dispose();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('Play starts in the bunker', async () => {
    const { sim } = await startHome();
    expect(game.ui.value).toMatchObject({ screen: 'game', runStyle: 'campaign' });
    expect(sim.map.seed).toBe(BUNKER_SEED);
    expect(game.ui.value.home).toMatchObject({ inBunker: true });
  });

  it('plays Arcade on the same controller after Campaign, and Campaign again after that', async () => {
    await startHome();
    game.toMenu();
    await pump(100);
    expect(game.ui.value.runStyle).toBeNull();

    game.startSolo('arcade');
    await pump(300);
    expect(game.sim?.map.seed).not.toBe(BUNKER_SEED);
    expect(game.ui.value).toMatchObject({ home: null, runStyle: 'arcade' });

    game.toMenu();
    await pump(100);
    game.startSolo('campaign');
    await pump(300);
    expect(game.sim?.map.seed).toBe(BUNKER_SEED);
    expect(game.ui.value.home).toMatchObject({ inBunker: true });
  });

  it('starts a first-time player on Campaign, then the style last chosen, on the next page load too', async () => {
    await boot();
    expect(game.ui.value.style).toBe('campaign');
    game.startSolo();
    await pump(300);
    expect(game.sim?.map.seed).toBe(BUNKER_SEED);
    game.toMenu();
    await pump(100);

    game.chooseStyle('arcade');
    expect(game.ui.value.style).toBe('arcade');
    await boot();
    expect(game.ui.value.style).toBe('arcade');
    game.startSolo();
    await pump(300);
    expect(game.sim?.map.seed).not.toBe(BUNKER_SEED);
  });

  it('starting a run does not change what is remembered', async () => {
    await boot();
    game.startSolo('arcade');
    await pump(300);
    expect(game.ui.value).toMatchObject({ style: 'campaign', runStyle: 'arcade' });
  });

  it('continuing from a level is Arcade whatever was last chosen', async () => {
    recordLevelReached(3);
    await boot();
    game.continueSolo();
    await pump(300);
    expect(game.ui.value).toMatchObject({ style: 'campaign', runStyle: 'arcade' });
    expect(game.sim?.level).toBe(3);
  });

  it('plays the music of the run\'s style', async () => {
    const setStyle = vi.spyOn(AudioEngine.prototype, 'setStyle');
    await boot();
    game.startSolo('arcade');
    await pump(100);
    expect(setStyle).toHaveBeenLastCalledWith('arcade');
    game.toMenu();
    await pump(100);
    game.startSolo('campaign');
    await pump(100);
    expect(setStyle).toHaveBeenLastCalledWith('campaign');
  });

  describe('the first visit', () => {
    it('shows no hint line: the four starter quests in the tracker are the hint', async () => {
      await startHome();
      expect(game.ui.value.banner).toBeNull();
      const home = game.ui.value.home;
      expect(home && questTracker(home).lines.map((line) => line.merchant).sort()).toEqual([...MERCHANT_IDS].sort());
    });

    it('standing at the van with no level picked boards for the furthest level', async () => {
      const { state } = await startHome();
      const me = playerNamed(state, LOCAL);
      standAtVan(state, me);
      await pump(1000);
      expect(state.homeRun?.pickedLevel).toBe(state.homeRun?.roomHighest);
      expect(me.home?.ready).toBe(true);
    });

    it('a save that fails at the van says so on screen', async () => {
      const { state } = await startHome({ openTrip: null });
      failNextSaves();
      game.home.pickLevel(1);
      standAtVan(state, playerNamed(state, LOCAL));
      await pump(1000);
      expect(game.ui.value.banner?.tone).toBe('danger');
    });

    it('empty hands at the van take the gun from the locker and board, with nothing to answer', async () => {
      const { state } = await startHome({ locker: gear({ guns: { carbine: {} }, ammoBag: { pistol: 0, carbine: 30, shotgun: 0 } }) });
      const me = playerNamed(state, LOCAL);
      game.home.pickLevel(1);
      standAtVan(state, me);
      await pump(1000);
      expect(me.owned).toEqual(['carbine']);
      expect(me.home?.ready).toBe(true);
    });

    it('boards at once with nothing owned, for the free pistol', async () => {
      const { state } = await startHome();
      const me = playerNamed(state, LOCAL);
      game.home.pickLevel(1);
      standAtVan(state, me);
      await pump(1000);
      expect(me.home?.ready).toBe(true);
    });
  });

  it('the bunker shows no horde timer, level card or town weather', async () => {
    const setTheme = vi.spyOn(WorldRenderer.prototype, 'setTheme');
    await startHome();
    const { hud, levelCard } = game.ui.value;
    expect(setTheme).toHaveBeenCalledWith('bunker');
    expect(levelCard).toBeNull();
    expect(hud?.level).toBe(0);
    expect(hordeStatus(hud!).title).not.toMatch(/horde/i);
    expect(levelLine(hud!.level)).toBe('Zero Point');
  });

  describe('a trip out', () => {
    it('a death shows the summary and wakes in the bunker, with no game over screen', async () => {
      const { sim, state } = await startHome({ hands: gear({ guns: { carbine: {} } }) });
      driveToTown(sim, state, 1);
      await pump(400);
      expect(isBunkerSeed(game.sim!.map.seed)).toBe(false);

      playerNamed(state, LOCAL).status = 'dead';
      await pump(600);
      const { screen, result, home } = game.ui.value;
      expect(screen).toBe('game');
      expect(result).toBeNull();
      expect(home?.inBunker).toBe(true);
      expect(home?.death?.receipt?.outcome).toBe('died');
      expect(home?.death?.lost.guns.carbine).toBeDefined();

      game.home.wake();
      await pump(100);
      expect(game.ui.value.home?.death).toBeNull();
    });

    it('Enter cannot wake past a summary still under the van, or only just shown', async () => {
      const { sim, state } = await startHome({ hands: gear({ guns: { carbine: {} } }) });
      driveToTown(sim, state, 1);
      await pump(400);
      noteVanCover(true);
      playerNamed(state, LOCAL).status = 'dead';
      await pump(2000);
      expect(game.ui.value.home?.death).not.toBeNull();

      press('Enter');
      await pump(100);
      expect(game.ui.value.home?.death).not.toBeNull();

      noteVanCover(false);
      press('Enter');
      await pump(100);
      expect(game.ui.value.home?.death).not.toBeNull();

      await pump(1100);
      press('Enter');
      await pump(100);
      expect(game.ui.value.home?.death).toBeNull();
    });

    it('a carried player does not unlock on arrival, and does at the van', async () => {
      const { sim, state } = await startHome();
      driveToTown(sim, state, 3);
      await pump(600);
      expect(loadCampaignProgress().highest).toBe(1);

      bankTrip(sim, state);
      await pump(600);
      expect(loadCampaignProgress().highest).toBe(4);
    });

    it('keeps Campaign\'s reach apart from Arcade\'s', async () => {
      recordLevelReached(7);
      const { sim, state } = await startHome();
      expect(sim.playsHome).toBe(true);
      expect(game.ui.value.home?.highest).toBe(1);
      driveToTown(sim, state, 1);
      await pump(600);
      bankTrip(sim, state);
      await pump(600);
      expect(loadCampaignProgress().highest).toBe(2);
      expect(loadLevelProgress().highest).toBe(7);
    });

    it('a trip further out than Arcade has been does not move Arcade on', async () => {
      const { sim, state } = await startHome();
      driveToTown(sim, state, 5);
      await pump(600);
      bankTrip(sim, state);
      await pump(600);
      expect(loadCampaignProgress().highest).toBe(6);
      expect(loadLevelProgress().highest).toBe(1);
    });

    it('the best trip is recorded from a receipt, banked or not', async () => {
      const { sim, state } = await startHome();
      driveToTown(sim, state, 1);
      await pump(400);
      const me = playerNamed(state, LOCAL);
      Object.assign(me, { score: 120, kills: 7, status: 'dead' });
      await pump(600);
      expect(loadBestTrip()).toMatchObject({ score: 120, kills: 7, trip: true });
      expect(loadLeaderboard()[0]).toMatchObject({ score: 120, trip: true });

      game.home.wake();
      driveToTown(sim, state, 1);
      await pump(400);
      me.score = 300;
      bankTrip(sim, state);
      await pump(600);
      expect(loadBestTrip()).toMatchObject({ score: 300, trip: true });
    });
  });

  describe('the ending', () => {
    async function clearFinalLevel(sim: GameSimulation, state: ReturnType<typeof stateOf>): Promise<void> {
      driveToTown(sim, state, FINAL_LEVEL);
      await pump(400);
      bankTrip(sim, state);
      await pump(600);
    }

    it('a first clear of level 10 plays the ending and returns to the bunker without toMenu, and a later clear does not', async () => {
      const { sim, state } = await startHome();
      const toMenu = vi.spyOn(game, 'toMenu');
      await clearFinalLevel(sim, state);
      expect(game.ui.value.screen).toBe('gameover');
      expect(game.ui.value.result?.stats.outcome).toBe('victory');

      game.home.continueFromEnding();
      await pump(200);
      expect(toMenu).not.toHaveBeenCalled();
      expect(game.ui.value).toMatchObject({ screen: 'game', result: null });
      expect(game.sim).toBe(sim);
      expect(game.ui.value.home?.inBunker).toBe(true);

      await clearFinalLevel(sim, state);
      expect(game.ui.value.screen).toBe('game');
    });

    it('the credits end in the bunker, not on the title', async () => {
      const { sim, state } = await startHome();
      await clearFinalLevel(sim, state);
      game.toMenu();
      await pump(200);
      expect(game.ui.value.screen).toBe('game');
      expect(game.sim).toBe(sim);
    });
  });

  describe('a station', () => {
    async function atStation(id: 'gunsmith' | 'bench') {
      const { sim, state } = await startHome();
      const me = playerNamed(state, LOCAL);
      standAtStation(state, me, id);
      (me.home as NonNullable<typeof me.home>).station = id;
      await pump(300);
      return { sim, state, me };
    }
    const atGunsmith = () => atStation('gunsmith');

    it('a shop holds input without pausing the run, and closes when the station clears', async () => {
      const { state, me } = await atGunsmith();
      expect(game.ui.value.home?.shop).toBe('gunsmith');
      expect(game.ui.value.paused).toBe(false);

      press('KeyD');
      expect(game.input.dirX).toBe(0);
      const tick = state.tick;
      await pump(300);
      expect(state.tick).toBeGreaterThan(tick);

      (me.home as NonNullable<typeof me.home>).station = null;
      await pump(300);
      expect(game.ui.value.home?.shop).toBeNull();
      expect(game.input.dirX).toBe(1);
    });

    it('the bench opens its screen for the player alone, with no van timer', async () => {
      const { me } = await atStation('bench');
      expect(game.ui.value.hud?.bench).toMatchObject({ secondsLeft: null, youReady: false, waitingFor: 0 });
      expect(game.ui.value.home?.station).toBe('bench');
      expect(me.home?.station).toBe('bench');
    });

    it('Esc closes a station before it toggles pause', async () => {
      await atGunsmith();
      press('Escape');
      await pump(300);
      expect(game.ui.value.paused).toBe(false);
      expect(game.ui.value.home?.station).toBeNull();

      press('Escape');
      expect(game.ui.value.paused).toBe(true);
    });

    it('Esc closes through the open screen when it has something to settle, as its Close button does', async () => {
      await atGunsmith();
      const close = vi.fn(() => game.home.closeStation());
      game.home.closeWith(close);
      press('Escape');
      await pump(300);
      expect(close).toHaveBeenCalledOnce();
      expect(game.ui.value.paused).toBe(false);
      expect(game.ui.value.home?.station).toBeNull();

      game.home.closeWith(null);
      press('Escape');
      expect(close).toHaveBeenCalledOnce();
      expect(game.ui.value.paused).toBe(true);
    });
  });

  describe('leaving while a receipt is being saved', () => {
    /** A store whose saves wait for the test once it is told to hold them. */
    function gatedStore() {
      const inner = memoryStore();
      let held: Array<() => void> = [];
      let gated = false;
      const store: HomeStore = {
        load: () => inner.load(),
        save: (next) => (gated ? new Promise((resolve) => held.push(() => resolve(inner.save(next)))) : inner.save(next)),
      };
      return {
        store,
        hold: () => void (gated = true),
        release: () => {
          gated = false;
          const waiting = held;
          held = [];
          waiting.forEach((go) => go());
        },
      };
    }

    async function bootGated() {
      const gate = gatedStore();
      game?.dispose();
      game = new GameController({ homeStore: () => gate.store });
      game.mount(fakeCanvas() as unknown as HTMLCanvasElement);
      await pump(100);
      game.startSolo('campaign');
      await pump(300);
      const sim = game.sim as GameSimulation;
      return { gate, sim, state: stateOf(sim) };
    }

    it('an ending that lands late does not come up over the title', async () => {
      const { gate, sim, state } = await bootGated();
      driveToTown(sim, state, FINAL_LEVEL);
      await pump(400);
      gate.hold();
      bankTrip(sim, state);
      await pump(300);

      game.toMenu();
      await pump(100);
      expect(game.ui.value.screen).toBe('title');

      gate.release();
      await pump(300);
      expect(game.ui.value.screen).toBe('title');
    });

    it('a death that lands late does not hold the keys in the next session', async () => {
      const { gate, sim, state } = await bootGated();
      driveToTown(sim, state, 1);
      await pump(400);
      gate.hold();
      Object.assign(playerNamed(state, LOCAL), { status: 'dead' });
      await pump(300);

      game.toMenu();
      await pump(100);
      game.startSolo('campaign');
      await pump(300);
      gate.release();
      await pump(300);
      expect(game.ui.value.home?.death ?? null).toBeNull();
    });
  });
});
