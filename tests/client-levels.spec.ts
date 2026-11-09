import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PLAYER_RADIUS, PLAYER_SPEED } from '../shared/constants.ts';
import { moveToNextTown } from '../shared/level-change.ts';
import { FINAL_LEVEL, LEVELS, levelDef } from '../shared/levels.ts';
import { stepMovement } from '../shared/movement.ts';
import type { GameOverStats, PlayerEntity, SnapshotPacket } from '../shared/protocol.ts';
import { generateWorldMap } from '../shared/world-map.ts';
import { circleHitsSolid } from '../shared/world-query.ts';
import { Atmosphere, flakeX, flakeY, MAX_FLAKES } from '../src/engine/atmosphere.ts';
import { lampWorks, LEVEL_LOOKS } from '../src/engine/level-look.ts';
import { edgePointer } from '../src/engine/overlay-renderer.ts';
import { WorldRenderer } from '../src/engine/world-renderer.ts';
import { ClientWorld } from '../src/game/client-world.ts';
import { GameController } from '../src/game/game-controller.ts';
import type { UiState } from '../src/game/hud-state.ts';
import { levelGoal, levelLine, levelTitle } from '../src/game/level-hud.ts';
import { hordeBanner, RunNotices } from '../src/game/run-notices.ts';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';
import type { FakeBrowser } from './client-fake-dom.ts';
import { stateOf } from './helpers/sim-harness.ts';

const FRAME_MS = 1000 / 60;
const TOWN_A = 4242;
const TOWN_B = 7171;

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

  send(): void {}
  close(): void {}

  receive(packet: object): void {
    this.onmessage?.({ data: JSON.stringify(packet) });
  }
}

const noRounds = { pistol: 0, carbine: 0, shotgun: 0 };

function player(patch: Partial<PlayerEntity> = {}): PlayerEntity {
  return {
    id: 'me', name: 'ANA', skin: 0, x: 500, y: 500, angle: 0, moving: false, status: 'alive',
    health: 100, maxHealth: 100, weapon: 'pistol', ammo: 12, magSize: 12, reserve: 12, owned: ['pistol'],
    ammoBag: { ...noRounds, pistol: 12 }, mags: { ...noRounds, pistol: 12 }, medkits: 0, indoors: null,
    reload: 0, bleedout: 0, revive: 0, score: 0, kills: 0, lastInputSeq: 0, knife: false, search: 0, ...patch,
  };
}

function frame(tick: number, patch: Partial<SnapshotPacket> = {}): SnapshotPacket {
  return {
    type: 'snapshot', tick, phase: 'intermission', level: 1, mapSeed: TOWN_A, wave: 0, intermission: 60, hostiles: 0,
    players: [player()], zombies: [], bullets: [], pickups: [], exit: null, openedContainers: [], events: [], gameOver: null, ...patch,
  };
}

const stats: GameOverStats = {
  outcome: 'defeat', difficulty: 'lights_out', level: 3, wave: 2, durationSec: 90,
  players: [{ id: 'me', name: 'ANA', skin: 0, kills: 5, score: 300 }],
};

describe('level wording', () => {
  it('names the level', () => {
    expect(levelLine(3)).toBe('Three Country: Into the Breach');
  });

  it('counts only the hordes already seen off', () => {
    const facts = { level: 3, exitOpen: false };
    expect(levelGoal({ ...facts, phase: 'intermission', wave: 0 })).toBe('0 of 3 hordes survived');
    expect(levelGoal({ ...facts, phase: 'wave', wave: 2 })).toBe('1 of 3 hordes survived');
    expect(levelGoal({ ...facts, phase: 'intermission', wave: 2 })).toBe('2 of 3 hordes survived');
  });

  it('points at the van once it has come, hordes or no hordes', () => {
    expect(levelGoal({ level: 3, exitOpen: true, phase: 'wave', wave: 4 })).toBe('Get to the van');
  });

  it('words a title card from the level table', () => {
    expect(levelTitle(4)).toEqual({ heading: `Town 4 of ${FINAL_LEVEL}: Abyssal Depths`, title: 'Four Corners', goal: 'Survive 3 hordes, then reach the van', rule: 'Floodwater: Wading outdoors slows you down. Buildings are dry.' });
    expect(levelTitle(FINAL_LEVEL).heading).toBe('The last town: Final Stand');
  });

  it('banners the van when it comes', () => {
    expect(hordeBanner({ type: 'exit_open', level: 1, x: 10, y: 10 })?.tone).toBe('hope');
  });

  it('takes a title card down when its time is up', () => {
    const notices = new RunNotices();
    const levelCard = notices.levelCard(2, 0);
    const ui = { banner: null, place: null, levelCard } as UiState;
    expect(notices.expired(ui, 4000)).toEqual({});
    expect(notices.expired(ui, 4300)).toEqual({ levelCard: null });
  });
});

describe('the van pointer', () => {
  it('stays clear of the edge it points past', () => {
    const inset = 26;
    const pointer = edgePointer(-400, 900, 480, 270, inset)!;
    expect(pointer.x).toBeGreaterThanOrEqual(inset);
    expect(pointer.y).toBeLessThanOrEqual(270 - inset);
  });
});

describe('level looks', () => {
  it('has a look for every level, and the first two are the plain night', () => {
    for (const level of LEVELS) expect(LEVEL_LOOKS[level.theme]).toBeDefined();
    expect(LEVEL_LOOKS[levelDef(1).theme]).toBe(LEVEL_LOOKS.night);
    expect(LEVEL_LOOKS[levelDef(2).theme]).toBe(LEVEL_LOOKS.night);
    expect(LEVEL_LOOKS.night.wash).toBeNull();
    expect(LEVEL_LOOKS.night.weather).toBeNull();
  });

  it('leaves one street lamp in six burning in the blackout', () => {
    const lit = Array.from({ length: 60 }, (_, index) => lampWorks(LEVEL_LOOKS.blackout, index)).filter(Boolean);
    expect(lit).toHaveLength(10);
  });

  it('pulses the emergency light, but not for reduced motion', () => {
    const moving = new Atmosphere(false);
    const still = new Atmosphere(true);
    moving.setTheme('emergency');
    still.setTheme('emergency');
    expect(moving.washAlpha(0.7)).not.toBeCloseTo(moving.washAlpha(0));
    expect(still.washAlpha(0.7)).toBe(still.washAlpha(0));
  });

  function flakesAt(atmosphere: Atmosphere, time: number): number[][] {
    const cells: number[][] = [];
    const ctx = {
      globalAlpha: 1,
      fillStyle: '',
      fillRect: (x: number, y: number) => cells.push([x, y]),
    } as unknown as CanvasRenderingContext2D;
    atmosphere.drawWeather(ctx, 0, 0, 480, 270, time, 1);
    return cells;
  }

  it('lets the snow fall, and holds it still for reduced motion', () => {
    const moving = new Atmosphere(false);
    const still = new Atmosphere(true);
    moving.setTheme('snow');
    still.setTheme('snow');
    expect(flakesAt(moving, 3)).not.toEqual(flakesAt(moving, 0));
    expect(flakesAt(still, 3)).toEqual(flakesAt(still, 0));
  });

  it('never draws more than the budget, and keeps it all on screen', () => {
    for (const theme of Object.keys(LEVEL_LOOKS) as (keyof typeof LEVEL_LOOKS)[]) {
      const atmosphere = new Atmosphere(false);
      atmosphere.setTheme(theme);
      const cells = flakesAt(atmosphere, 12.5);
      expect(cells.length).toBeLessThanOrEqual(MAX_FLAKES);
      expect(cells.every(([x, y]) => x >= 0 && x < 480 && y >= 0 && y < 270)).toBe(true);
    }
    const spec = { count: 1, driftX: 5, driftY: 5, sway: 0, width: 1, height: 1, colors: ['#fff', '#fff'] as const };
    expect(flakeX(spec, 0, 0, 0, 100)).toBe(0);
    expect(flakeY(spec, 0, 0, 0, 100)).toBe(0);
  });
});

describe('a client entering a new town', () => {
  const townA = generateWorldMap(TOWN_A);
  const townB = generateWorldMap(TOWN_B);

  /** Solid ground in the first town, open in the second. */
  function spotOnlyOpenInB(): { x: number; y: number } {
    for (let y = 200; y < townA.height - 200; y += 8) {
      for (let x = 200; x < townA.width - 200; x += 8) {
        const clearAhead = !circleHitsSolid(townB, x + 40, y, PLAYER_RADIUS);
        const fits = circleHitsSolid(townA, x, y, PLAYER_RADIUS) && !circleHitsSolid(townB, x, y, PLAYER_RADIUS) && clearAhead;
        if (fits) return { x, y };
      }
    }
    throw new Error('no such spot between these towns');
  }

  it('walks by the new town and forgets the old one', () => {
    const { x, y } = spotOnlyOpenInB();
    const world = new ClientWorld(townA, 'me');
    world.push(frame(1), 0);
    world.enterTown(townB);
    expect(world.latest).toBeNull();
    world.push(frame(2, { mapSeed: TOWN_B, players: [player({ x, y })] }), 40);
    const dt = 1 / 60;
    world.advance(100, 0, 1, 0, 0, dt);
    const expected = stepMovement(townB, x, y, 1, 0, PLAYER_SPEED, dt, PLAYER_RADIUS);
    expect(world.predictor.x).toBeCloseTo(expected.x);
    expect(world.predictor.y).toBeCloseTo(expected.y);
  });
});

describe('levels in a run', () => {
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

  function joinRoom(): FakeSocket {
    vi.stubGlobal('WebSocket', FakeSocket);
    game.startCoop('arcade');
    const socket = FakeSocket.latest;
    socket.receive({ type: 'room', style: null });
    socket.receive({ type: 'welcome', yourId: 'me', tickRate: 30, mapSeed: TOWN_A });
    return socket;
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

  it('rebuilds the town when the sim moves on, and puts up the next level', () => {
    const setMap = vi.spyOn(WorldRenderer.prototype, 'setMap');
    const setTheme = vi.spyOn(WorldRenderer.prototype, 'setTheme');
    game.startSolo('arcade');
    pump(300);
    expect(game.ui.value.levelCard?.title).toBe(levelDef(1).town);

    const sim = stateOf(game.sim!);
    moveToNextTown(sim);
    moveToNextTown(sim);
    pump(300);
    expect(setMap.mock.lastCall?.[0].seed).toBe(sim.map.seed);
    expect(setTheme.mock.lastCall?.[0]).toBe(levelDef(3).theme);
    expect(game.ui.value.levelCard?.title).toBe(levelDef(3).town);
    expect(game.ui.value.hud?.level).toBe(3);
  });

  it('shows a joiner the level they walked into, in its own look', () => {
    const setTheme = vi.spyOn(WorldRenderer.prototype, 'setTheme');
    joinRoom().receive(frame(1, { level: 6 }));
    expect(setTheme.mock.lastCall?.[0]).toBe('blackout');
    expect(game.ui.value.levelCard?.title).toBe(levelDef(6).town);
  });

  it('takes the card down in its own time', () => {
    game.startSolo('arcade');
    pump(300);
    expect(game.ui.value.levelCard).not.toBeNull();
    pump(4500);
    expect(game.ui.value.levelCard).toBeNull();
  });

  it('clears what the last town had to say', () => {
    const socket = joinRoom();
    socket.receive(frame(1, { events: [{ type: 'exit_open', level: 1, x: 900, y: 900 }] }));
    expect(game.ui.value.banner?.tone).toBe('hope');
    socket.receive(frame(2, { level: 2, mapSeed: TOWN_B }));
    expect(game.ui.value.banner).toBeNull();
  });

  it('goes back to the first level and town on Play Again', () => {
    const setMap = vi.spyOn(WorldRenderer.prototype, 'setMap');
    const setTheme = vi.spyOn(WorldRenderer.prototype, 'setTheme');
    const socket = joinRoom();
    socket.receive(frame(1, { level: 3, mapSeed: TOWN_B }));
    socket.receive(frame(2, { level: 3, mapSeed: TOWN_B, phase: 'gameover', gameOver: stats }));
    socket.receive(frame(3));
    expect(setMap.mock.lastCall?.[0].seed).toBe(TOWN_A);
    expect(setTheme.mock.lastCall?.[0]).toBe('night');
    expect(game.ui.value.levelCard?.title).toBe(levelDef(1).town);
  });

  it('gives a run that restarts in the same town its title card too', () => {
    const socket = joinRoom();
    socket.receive(frame(1));
    socket.receive(frame(2, { phase: 'gameover', gameOver: { ...stats, level: 1 } }));
    pump(5000);
    expect(game.ui.value.levelCard).toBeNull();
    socket.receive(frame(3));
    expect(game.ui.value.levelCard?.title).toBe(levelDef(1).town);
  });
});
