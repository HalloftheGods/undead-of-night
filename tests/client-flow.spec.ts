import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILDING_DEFS } from '../shared/protocol.ts';
import type { GameEvent, GameOverStats, PlayerEntity, SnapshotPacket } from '../shared/protocol.ts';
import { createInitialProgression, PROGRESSION_STORAGE_KEY } from '../shared/progression.ts';
import type { ProgressionState } from '../shared/progression.ts';
import { AudioEngine } from '../src/audio/audio-engine.ts';
import { GameController } from '../src/game/game-controller.ts';
import { ammoState, gunRounds, switchKey } from '../src/game/hud-state.ts';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';
import { addZombie, stateOf } from './helpers/sim-harness.ts';
import type { FakeBrowser } from './client-fake-dom.ts';

const FRAME_MS = 1000 / 60;

/** A co-op server the test speaks for. */
class FakeSocket {
  static readonly OPEN = 1;
  static latest: FakeSocket;
  readonly readyState = FakeSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;

  constructor() {
    FakeSocket.latest = this;
  }

  readonly sent: string[] = [];

  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {}

  receive(packet: object): void {
    this.onmessage?.({ data: JSON.stringify(packet) });
  }
}

const noRounds = { pistol: 0, carbine: 0, shotgun: 0 };

const me: PlayerEntity = {
  id: 'me', name: 'ANA', skin: 0, x: 500, y: 500, angle: 0, moving: false, status: 'alive',
  health: 100, maxHealth: 100, weapon: 'pistol', ammo: 12, magSize: 12, reserve: 12, owned: ['pistol'],
  ammoBag: { ...noRounds, pistol: 12 }, mags: { ...noRounds, pistol: 12 }, medkits: 0, indoors: null,
  reload: 0, bleedout: 0, revive: 0, score: 0, kills: 0, lastInputSeq: 0, knife: false, search: 0,
};

const stats: GameOverStats = {
  outcome: 'defeat',
  difficulty: 'lights_out',
  level: 1,
  wave: 2,
  durationSec: 90,
  players: [{ id: 'me', name: 'ANA', skin: 0, kills: 5, score: 300 }],
};

function frame(tick: number, patch: Partial<SnapshotPacket> = {}): SnapshotPacket {
  return {
    type: 'snapshot', tick, phase: 'intermission', level: 1, mapSeed: 4242, wave: 0, intermission: 60, hostiles: 0, players: [me],
    zombies: [], bullets: [], pickups: [], exit: null, openedContainers: [], events: [], gameOver: null, ...patch,
  };
}

const endOfRun = (tick: number): SnapshotPacket => frame(tick, { phase: 'gameover', gameOver: stats });

const kill = (points: number): GameEvent => ({ type: 'zombie_die', zombieId: 'z1', zombieType: 'walker', x: 500, y: 500, angle: 0, killerId: 'me', points });

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

function savedProgression(store: ReturnType<typeof memoryStorage>): ProgressionState | null {
  const raw = store.getItem(PROGRESSION_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as ProgressionState) : null;
}

function textField(id: string): object {
  const { HTMLInputElement: Field } = globalThis as unknown as { HTMLInputElement: new () => object };
  return Object.assign(new Field(), { id });
}

describe('game flow', () => {
  let browser: FakeBrowser;
  let game: GameController;
  let clock = 0;

  function pump(ms: number): void {
    for (let elapsed = 0; elapsed < ms; elapsed += FRAME_MS) {
      vi.advanceTimersByTime(FRAME_MS);
      clock += FRAME_MS;
      browser.runFrame(clock);
    }
  }

  function pressEnter(): void {
    browser.dispatch('keydown', { code: 'Enter', repeat: false, target: null, preventDefault() {} });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    browser = installFakeBrowser();
    clock = 0;
    game = new GameController();
    game.mount(fakeCanvas() as unknown as HTMLCanvasElement);
    pump(100);
  });

  afterEach(() => {
    game.dispose();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function joinRoom(welcome: object = {}): FakeSocket {
    vi.stubGlobal('WebSocket', FakeSocket);
    game.startCoop('arcade');
    const socket = FakeSocket.latest;
    socket.onopen?.();
    socket.receive({ type: 'welcome', yourId: 'me', tickRate: 30, mapSeed: 4242, ...welcome });
    return socket;
  }

  it.each([['Knight', 'Knight'], ['', ''], ['  \u0007 ', ''], ['sh1t', ''], ['x'.repeat(30), 'x'.repeat(12)]])(
    'joins a room as callsign %j with the name %j, never a stand-in label',
    (typed, sent) => {
      game.setCallsign(typed);
      vi.stubGlobal('WebSocket', FakeSocket);
      game.startCoop('arcade');
      const socket = FakeSocket.latest;
      socket.onopen?.();
      socket.receive({ type: 'room', style: 'arcade' });
      const join = socket.sent.map((text) => JSON.parse(text) as { type: string; name?: string }).find((packet) => packet.type === 'join');
      expect(join?.name).toBe(sent);
    },
  );

  it('loads the art behind the title', () => {
    expect(game.ui.value.screen).toBe('title');
    expect(game.ui.value.art).not.toBeNull();
  });

  it('starts solo from the setup page and fills in the HUD', () => {
    game.startSolo('arcade');
    pump(500);
    const { screen, hud, mode } = game.ui.value;
    expect(screen).toBe('game');
    expect(mode).toBe('solo');
    expect(hud?.weapon).toBe('pistol');
    expect(hud?.health).toBe(hud?.maxHealth);
  });

  it('connects from the co-op setup page', () => {
    vi.stubGlobal('WebSocket', FakeSocket);
    game.startCoop('arcade');
    expect(game.ui.value).toMatchObject({ mode: 'coop', connecting: true });
    expect(game.sim).toBeNull();
  });

  it.each([null, 'callsign', 'server'])('never starts a run on a bare Enter at the title (focus: %s)', (field) => {
    vi.stubGlobal('WebSocket', FakeSocket);
    const target = field ? textField(field) : null;
    browser.dispatch('keydown', { code: 'Enter', repeat: false, target, preventDefault() {} });
    expect(game.ui.value).toMatchObject({ screen: 'title', connecting: false });
    expect(game.sim).toBeNull();
  });

  it('pauses solo when the window loses focus', () => {
    game.startSolo('arcade');
    pump(300);
    browser.dispatch('blur', {});
    expect(game.ui.value.paused).toBe(true);
    const tick = game.sim!.snapshot().tick;
    pump(500);
    expect(game.sim!.snapshot().tick).toBe(tick);
  });

  it('leaves an open map alone when the window loses focus', () => {
    game.startSolo('arcade');
    pump(300);
    pressKey('Tab');
    browser.dispatch('blur', {});
    expect(game.ui.value).toMatchObject({ mapOpen: true, paused: false });
  });

  it('has nothing to pause on the title or in co-op', () => {
    browser.dispatch('blur', {});
    expect(game.ui.value.paused).toBe(false);
    joinRoom().receive(frame(1));
    browser.dispatch('blur', {});
    expect(game.ui.value.paused).toBe(false);
  });

  it('keeps a held Tab in the game with the map open, and Escape still closes it', () => {
    game.startSolo('arcade');
    pump(300);
    pressKey('Tab');
    const repeat = { code: 'Tab', repeat: true, target: null, preventDefault: vi.fn() };
    browser.dispatch('keydown', repeat);
    expect(repeat.preventDefault).toHaveBeenCalled();
    expect(game.ui.value.mapOpen).toBe(true);
    browser.dispatch('keydown', { code: 'Escape', repeat: false, target: null, preventDefault() {} });
    expect(game.ui.value.mapOpen).toBe(false);
  });

  it('lets Tab move focus around the pause menu', () => {
    game.startSolo('arcade');
    pump(300);
    browser.dispatch('keydown', { code: 'Escape', repeat: false, target: null, preventDefault() {} });
    const repeat = { code: 'Tab', repeat: true, target: null, preventDefault: vi.fn() };
    browser.dispatch('keydown', repeat);
    expect(repeat.preventDefault).not.toHaveBeenCalled();
  });

  it('truly stops the sim on pause in solo', () => {
    game.startSolo('arcade');
    pump(300);
    browser.dispatch('keydown', { code: 'Escape', repeat: false, target: null, preventDefault() {} });
    expect(game.ui.value.paused).toBe(true);
    const tick = game.sim!.snapshot().tick;
    pump(1000);
    expect(game.sim!.snapshot().tick).toBe(tick);
    pressEnter();
    expect(game.ui.value.paused).toBe(false);
    pump(300);
    expect(game.sim!.snapshot().tick).toBeGreaterThan(tick);
  });

  function pressKey(code: string): void {
    browser.dispatch('keydown', { code, repeat: false, target: null, preventDefault() {} });
    browser.dispatch('keyup', { code });
  }

  it('starts the run with one magazine, one reload and no medkit', () => {
    game.startSolo('arcade');
    pump(300);
    expect(game.ui.value.hud).toMatchObject({ ammo: 12, reserve: 12, medkits: 0 });
    expect(game.ui.value.hud?.ammoBag.pistol).toBe(12);
  });

  it('fires a shot for a click that ends between ticks', () => {
    game.startSolo('arcade');
    pump(300);
    browser.dispatch('mousedown', { button: 0, clientX: 0, clientY: 0 });
    browser.dispatch('mouseup', { button: 0 });
    pump(200);
    expect(game.ui.value.hud?.ammo).toBe(11);
  });

  it('shows a found gun as loaded while the one in hand is dry', () => {
    game.startSolo('arcade');
    pump(200);
    const local = stateOf(game.sim!).players[0];
    local.owned = ['pistol', 'carbine'];
    local.guns.carbine = { ammo: 18 };
    local.guns.pistol = { ammo: 0 };
    local.ammo = 0;
    local.reserve = 0;
    local.ammoBag.pistol = 0;
    pump(300);
    const hud = game.ui.value.hud!;
    expect(gunRounds(hud, 'carbine')).toBe(18);
    expect(ammoState(hud)).not.toBe('empty');
    expect(switchKey(hud)).toBe(2);
  });

  it('walks on while the map is open and after it closes with the key still down', () => {
    game.startSolo('arcade');
    pump(300);
    const local = stateOf(game.sim!).players[0];
    const startX = local.x;
    pressKey('Tab');
    expect(game.ui.value.mapOpen).toBe(true);
    browser.dispatch('keydown', { code: 'KeyD', repeat: false, target: null, preventDefault() {} });
    pump(300);
    expect(local.x).toBeGreaterThan(startX);
    expect(local.angle).toBe(0);
    browser.dispatch('keyup', { code: 'KeyD', target: null });
    browser.dispatch('keydown', { code: 'KeyW', repeat: false, target: null, preventDefault() {} });
    pump(300);
    expect(local.angle).toBeCloseTo(-Math.PI / 2, 2);
    browser.dispatch('keyup', { code: 'KeyW', target: null });
    browser.dispatch('keydown', { code: 'KeyD', repeat: false, target: null, preventDefault() {} });
    pump(300);
    expect(local.angle).toBe(0);
    const midX = local.x;
    pressKey('Tab');
    expect(game.ui.value.mapOpen).toBe(false);
    pump(300);
    expect(local.x).toBeGreaterThan(midX);
  });

  it('allows the sim to carry on while the town map is open in solo', () => {
    game.startSolo('arcade');
    pump(300);
    pressKey('Tab');
    expect(game.ui.value.mapOpen).toBe(true);
    expect(game.ui.value.paused).toBe(false);
    const tick = game.sim!.snapshot().tick;
    pump(500);
    expect(game.sim!.snapshot().tick).toBeGreaterThan(tick);
    pressKey('KeyN');
    expect(game.ui.value.mapOpen).toBe(false);
    pump(300);
    expect(game.sim!.snapshot().tick).toBeGreaterThan(tick + 10);
  });

  it('closes the map on Escape instead of pausing on top of it', () => {
    game.startSolo('arcade');
    pump(300);
    pressKey('Tab');
    browser.dispatch('keydown', { code: 'Escape', repeat: false, target: null, preventDefault() {} });
    expect(game.ui.value.mapOpen).toBe(false);
    expect(game.ui.value.paused).toBe(false);
  });

  it('keeps the map shut behind the pause menu and on the title', () => {
    pressKey('Tab');
    expect(game.ui.value.mapOpen).toBe(false);
    game.startSolo('arcade');
    pump(300);
    browser.dispatch('keydown', { code: 'Escape', repeat: false, target: null, preventDefault() {} });
    pressKey('Tab');
    expect(game.ui.value.mapOpen).toBe(false);
  });

  it('names a landmark on the way in, once, and not a house', () => {
    game.startSolo('arcade');
    pump(200);
    const sim = game.sim!;
    const state = stateOf(sim);
    const stand = (kind: string) => {
      const building = sim.map.buildings.find((candidate) => candidate.kind === kind)!;
      const { h, doorX } = BUILDING_DEFS[building.kind];
      state.players[0].x = building.x + doorX;
      state.players[0].y = building.y + h - 14;
    };
    stand('house');
    pump(300);
    expect(game.ui.value.place).toBeNull();
    stand('pharmacy');
    pump(300);
    expect(game.ui.value.place?.label).toBe('Pharmacy');
    pump(2500);
    expect(game.ui.value.place).toBeNull();
  });

  it('paints the town map into the canvas the screen hands over', () => {
    game.startSolo('arcade');
    pump(300);
    pressKey('Tab');
    const canvas = fakeCanvas();
    game.attachTownCanvas(canvas as unknown as HTMLCanvasElement);
    expect(canvas.width).toBeGreaterThan(300);
    expect(canvas.getContext().drawImageCalls).toBeGreaterThan(0);
    game.attachTownCanvas(null);
  });

  it('runs to game over, then back into a new run', () => {
    game.startSolo('arcade');
    pump(100);
    const firstSim = game.sim;
    const state = stateOf(firstSim!);
    const { x, y } = state.players[0];
    for (let i = 0; i < 6; i += 1) addZombie(state, 'brute', x + (i - 3) * 8, y + 14);
    for (let i = 0; i < 60 && game.ui.value.screen === 'game'; i += 1) pump(1000);
    const { screen, result } = game.ui.value;
    expect(screen).toBe('gameover');
    expect(result?.stats.wave).toBeGreaterThanOrEqual(0);
    expect(result?.stats.durationSec).toBeGreaterThan(0);

    pressEnter();
    pump(200);
    expect(game.ui.value.screen).toBe('game');
    expect(game.ui.value.result).toBeNull();
    expect(game.sim).not.toBe(firstSim);
    expect(game.ui.value.hud?.status).toBe('alive');
  }, 60_000);

  it('follows the room into a new run when the old one ended between ticks', () => {
    const socket = joinRoom();
    socket.receive(frame(50));
    socket.receive(endOfRun(50));
    pump(2500);
    expect(game.ui.value.screen).toBe('gameover');
    game.playAgain();
    expect(game.ui.value.restarting).toBe(true);
    socket.receive(endOfRun(50));
    expect(game.ui.value.screen).toBe('gameover');
    socket.receive(frame(51));
    expect(game.ui.value).toMatchObject({ screen: 'game', restarting: false, result: null });
  });

  it('follows a restart whose first tick is the one the last run ended on', () => {
    const socket = joinRoom();
    socket.receive(frame(5));
    socket.receive(endOfRun(6));
    pump(2500);
    socket.receive(frame(6));
    expect(game.ui.value.screen).toBe('game');
  });

  it('banks the best run when the run ends, not when the results show', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const socket = joinRoom();
    socket.receive(frame(50));
    socket.receive(endOfRun(51));
    expect(game.ui.value.screen).toBe('game');
    expect(game.ui.value.best?.score).toBe(300);
    pump(2500);
    expect(game.ui.value.result?.isNewBest).toBe(true);
  });

  it('banks XP for a local kill', () => {
    const store = memoryStorage();
    vi.stubGlobal('localStorage', store);
    const socket = joinRoom();
    socket.receive(frame(50, { events: [kill(50)] }));
    expect(savedProgression(store)?.xp).toBe(50);
  });

  it('banks no XP on a Dev: Test Drive run', () => {
    const store = memoryStorage();
    vi.stubGlobal('localStorage', store);
    const socket = joinRoom({ testDrive: true });
    socket.receive(frame(50, { events: [kill(50)] }));
    expect(savedProgression(store)?.xp ?? 0).toBe(0);
  });

  it('banks no XP on a Dev: Test Drive run after the town changes', () => {
    const store = memoryStorage();
    vi.stubGlobal('localStorage', store);
    const socket = joinRoom({ testDrive: true });
    socket.receive(frame(50));
    socket.receive(frame(51, { level: 2, mapSeed: 9191, events: [kill(50)] }));
    socket.receive(frame(52, { level: 2, mapSeed: 9191, events: [kill(50)] }));
    expect(savedProgression(store)?.xp ?? 0).toBe(0);
  });

  it('pays an owed AP with the level-up a kill brings', () => {
    const store = memoryStorage();
    store.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify({ ...createInitialProgression(Date.now()), owedAp: 1 }));
    vi.stubGlobal('localStorage', store);
    const socket = joinRoom();
    socket.receive(frame(50, { events: [kill(113)] }));
    const saved = savedProgression(store)!;
    expect(saved).toMatchObject({ level: 2, owedAp: 0, ap: 0 });
    expect(Object.values(saved.allocations[0].spentAp).reduce((sum, n) => sum + n, 0)).toBe(2);
  });

  it('keeps banked the repaid AP that does not fit the stat it went to', () => {
    const store = memoryStorage();
    const start = createInitialProgression(Date.now());
    store.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify({ ...start, owedAp: 1, allocations: { ...start.allocations, 0: { spentAp: { stealth: 0, reload: 4, speed: 5, strength: 5, search: 5 } } } }));
    vi.stubGlobal('localStorage', store);
    const socket = joinRoom();
    socket.receive(frame(50, { events: [kill(113)] }));
    expect(savedProgression(store)).toMatchObject({ level: 2, ap: 1, owedAp: 0 });
    expect(savedProgression(store)!.allocations[0].spentAp.reload).toBe(5);
  });

  it('checks AP upkeep when a run starts', () => {
    const store = memoryStorage();
    store.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify({ ...createInitialProgression(Date.now() - 8 * 24 * 60 * 60 * 1000), level: 3, ap: 1 }));
    vi.stubGlobal('localStorage', store);
    joinRoom();
    expect(savedProgression(store)).toMatchObject({ level: 3, ap: 0, owedAp: 1 });
  });

  it('takes no pip for a week that runs out in the middle of a run', () => {
    const store = memoryStorage();
    store.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify({ ...createInitialProgression(Date.now()), level: 3, ap: 1 }));
    vi.stubGlobal('localStorage', store);
    const socket = joinRoom();
    vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000);
    socket.receive(frame(50, { events: [kill(1)] }));
    expect(savedProgression(store)).toMatchObject({ level: 3, ap: 1, owedAp: 0, xp: 1 });
  });

  it('keeps the best run of a player the room restarts on during the death beat', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const socket = joinRoom();
    socket.receive(frame(50));
    socket.receive(endOfRun(51));
    socket.receive(frame(0));
    expect(game.ui.value).toMatchObject({ screen: 'game', result: null });
    expect(game.ui.value.best?.score).toBe(300);
  });

  it('plays the horde to someone who joins in the middle of one', () => {
    const setScene = vi.spyOn(AudioEngine.prototype, 'setScene');
    const socket = joinRoom();
    socket.receive(frame(10, { phase: 'wave', wave: 2, intermission: 0, hostiles: 9 }));
    expect(setScene).toHaveBeenLastCalledWith('wave');
  });

  it('plays the lull to someone who joins in one, and after a restart', () => {
    const setScene = vi.spyOn(AudioEngine.prototype, 'setScene');
    const socket = joinRoom();
    socket.receive(frame(10));
    expect(setScene).toHaveBeenLastCalledWith('intermission');
    socket.receive(endOfRun(11));
    expect(setScene).toHaveBeenLastCalledWith('gameover');
    socket.receive(frame(0));
    expect(setScene).toHaveBeenLastCalledWith('intermission');
  });

  it('leaves the music to the wave events after the first frame', () => {
    const setScene = vi.spyOn(AudioEngine.prototype, 'setScene');
    const socket = joinRoom();
    socket.receive(frame(10));
    socket.receive(frame(11, { phase: 'wave', events: [{ type: 'wave_start', wave: 1, hostiles: 8 }] }));
    expect(setScene).toHaveBeenLastCalledWith('wave');
    socket.receive(frame(12, { phase: 'wave' }));
    expect(setScene.mock.calls.filter(([scene]) => scene === 'wave')).toHaveLength(1);
  });

  it('returns to the menu and cleans up the session', () => {
    game.startSolo('arcade');
    pump(200);
    game.toMenu();
    pump(100);
    expect(game.ui.value.screen).toBe('title');
    expect(game.sim).toBeNull();
    expect(game.ui.value.hud).toBeNull();
  });

  it('comes back from a failed connection with a reason and working buttons', () => {
    class DeadSocket {
      static readonly OPEN = 1;
      onclose: ((event: { code: number }) => void) | null = null;
      close(): void {}
      constructor() {
        setTimeout(() => this.onclose?.({ code: 1006 }), 10);
      }
    }
    vi.stubGlobal('WebSocket', DeadSocket);
    game.startCoop('arcade');
    expect(game.ui.value.connecting).toBe(true);
    pump(100);
    expect(game.ui.value.connecting).toBe(false);
    expect(game.ui.value.error).toMatch(/could not reach/i);
    expect(game.ui.value.screen).toBe('title');
    game.startSolo('arcade');
    pump(100);
    expect(game.ui.value.screen).toBe('game');
    expect(game.ui.value.error).toBeNull();
  });

  it('refuses a nonsense server address without leaving the title', () => {
    game.setServerAddress('not a host');
    game.startCoop('arcade');
    expect(game.ui.value.error).toMatch(/address/i);
    expect(game.ui.value.connecting).toBe(false);
  });

  it('leaves no listeners behind', () => {
    game.dispose();
    const left = [...browser.listeners.values()].reduce((sum, set) => sum + set.size, 0);
    expect(left).toBe(0);
  });
});
