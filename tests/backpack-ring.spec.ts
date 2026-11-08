// The ring as the controller owns it: who may open it, what closes it, and what a pick sends.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameController } from '../src/game/game-controller.ts';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';
import type { FakeBrowser } from './client-fake-dom.ts';
import { stateOf } from './helpers/sim-harness.ts';

const FRAME_MS = 1000 / 60;

describe('the backpack ring', () => {
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

  /** A live solo run, the survivor on their feet in the first town. */
  function startRun(): void {
    game.startSolo('arcade');
    pump(500);
  }

  /** Takes the survivor off their feet in the running sim, as a horde would. */
  function goDown(): void {
    const [player] = stateOf(game.sim!).players;
    player.health = 0;
    player.status = 'downed';
  }

  const middleClick = () => browser.dispatch('mousedown', { button: 1, clientX: 400, clientY: 300, preventDefault() {} });
  const pressEsc = () => browser.dispatch('keydown', { code: 'Escape', key: 'Escape', repeat: false, target: null, preventDefault() {} });

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

  it('stays shut off a run, however it is asked', () => {
    expect(game.toggleBackpack()).toBe(false);
    expect(game.ui.value.backpackOpen).toBe(false);
    middleClick();
    expect(game.ui.value.backpackOpen).toBe(false);
  });

  it('opens and shuts on a live run', () => {
    startRun();
    expect(game.toggleBackpack()).toBe(true);
    expect(game.ui.value.backpackOpen).toBe(true);
    expect(game.toggleBackpack()).toBe(true);
    expect(game.ui.value.backpackOpen).toBe(false);
  });

  it('opens on a middle-click, which fires nothing', () => {
    startRun();
    middleClick();
    expect(game.ui.value.backpackOpen).toBe(true);
  });

  it('Esc shuts the ring and does NOT pause the run', () => {
    startRun();
    game.toggleBackpack();
    pressEsc();
    expect(game.ui.value.backpackOpen).toBe(false);
    expect(game.ui.value.paused).toBe(false);
  });

  it('Esc still pauses once the ring is away, so it takes two presses and no more', () => {
    startRun();
    game.toggleBackpack();
    pressEsc();
    pressEsc();
    expect(game.ui.value.paused).toBe(true);
  });

  it('shuts when the map opens, rather than hanging over it', () => {
    startRun();
    game.toggleBackpack();
    game.toggleMap();
    expect(game.ui.value.mapOpen).toBe(true);
    expect(game.ui.value.backpackOpen).toBe(false);
  });

  it('cannot be opened behind the pause menu or the map', () => {
    startRun();
    game.togglePause();
    expect(game.toggleBackpack()).toBe(false);
    game.togglePause();
    game.toggleMap();
    expect(game.toggleBackpack()).toBe(false);
  });

  it('shuts the moment the survivor goes down, wherever that news arrives from', () => {
    startRun();
    game.toggleBackpack();
    expect(game.ui.value.backpackOpen).toBe(true);
    goDown();
    pump(400);
    expect(game.ui.value.backpackOpen).toBe(false);
  });

  it('a pick shuts the ring and sends that item key on to the sim', () => {
    startRun();
    game.toggleBackpack();
    game.pickFromBackpack('KeyH');
    expect(game.ui.value.backpackOpen).toBe(false);
    expect(game.input.sample(1, 0, null).heal).toBe(true);
  });

  it('a pick of the map shuts the ring and opens the map, not the other way round', () => {
    startRun();
    game.toggleBackpack();
    game.pickFromBackpack('KeyN');
    expect(game.ui.value.mapOpen).toBe(true);
    expect(game.ui.value.backpackOpen).toBe(false);
  });
});
