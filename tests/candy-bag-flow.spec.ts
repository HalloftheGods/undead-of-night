import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameController } from '../src/game/game-controller.ts';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';
import type { FakeBrowser } from './client-fake-dom.ts';

const FRAME_MS = 1000 / 60;

interface SoloSurvivor {
  candy: string[];
  sugar: { id: string; left: number }[];
}

describe('candy bag', () => {
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

  function pressKey(code: string): void {
    browser.dispatch('keydown', { code, repeat: false, target: null, preventDefault() {} });
    browser.dispatch('keyup', { code });
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

  it('opens the candy bag on X, holds solo still behind it, and eats the candy picked there', () => {
    game.startSolo('arcade');
    pump(300);
    const local = (game.sim as unknown as { sim: { players: SoloSurvivor[] } }).sim.players[0];
    local.candy = ['jawbreaker', 'ghost_gum', 'jawbreaker'];
    pump(100);
    expect(game.ui.value.hud?.candyCount).toBe(3);
    pressKey('KeyX');
    expect(game.ui.value).toMatchObject({ bagOpen: true, paused: false });
    const tick = game.sim!.snapshot().tick;
    pump(500);
    expect(game.sim!.snapshot().tick).toBe(tick);
    game.eatCandy('jawbreaker');
    game.eatCandy('jawbreaker');
    pump(100);
    expect(local.candy).toEqual(['ghost_gum']);
    expect(local.sugar.map((sugar) => sugar.id)).toEqual(['jawbreaker']);
    expect(local.sugar[0].left).toBeGreaterThan(140);
    expect(game.ui.value.hud?.bag.map((stack) => stack.id)).toEqual(['ghost_gum']);
    // Two ticks for two candies, and none besides.
    expect(game.sim!.snapshot().tick).toBe(tick + 2);
    pressKey('Tab');
    expect(game.ui.value).toMatchObject({ bagOpen: false, mapOpen: true });
    pressKey('KeyX');
    expect(game.ui.value).toMatchObject({ bagOpen: true, mapOpen: false });
    browser.dispatch('keydown', { code: 'Escape', repeat: false, target: null, preventDefault() {} });
    expect(game.ui.value).toMatchObject({ bagOpen: false, paused: false });
    pump(300);
    expect(game.sim!.snapshot().tick).toBeGreaterThan(tick + 2);
  });

  it('eats nothing for a candy that is not in the bag, and X closes it again', () => {
    game.startSolo('arcade');
    pump(300);
    expect(game.toggleBag()).toBe(true);
    expect(game.ui.value.bagOpen).toBe(true);
    game.eatCandy('ghost_gum');
    // Nothing in the bag: nothing is sent and nothing steps.
    expect(game.ui.value.hud?.candyCount).toBe(0);
    expect(game.toggleBag()).toBe(true);
    expect(game.ui.value.bagOpen).toBe(false);
  });
});
