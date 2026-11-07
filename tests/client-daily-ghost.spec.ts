import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SceneView } from '../src/engine/scene.ts';
import { GHOST_ID, loadGhost } from '../src/game/daily-ghost.ts';
import { dateKeyOf } from '../src/game/daily-night.ts';
import { GameController } from '../src/game/game-controller.ts';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';
import type { FakeBrowser } from './client-fake-dom.ts';
import { addZombie, stateOf } from './helpers/sim-harness.ts';

const FRAME_MS = 1000 / 60;

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
}

describe('Daily Night ghost, end to end', () => {
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

  const scene = (): SceneView => (game as unknown as { runFrame: { lastScene: SceneView } }).runFrame.lastScene;

  function dieSoon(): void {
    const state = stateOf(game.sim!);
    const { x, y } = state.players[0];
    for (let i = 0; i < 6; i += 1) addZombie(state, 'brute', x + (i - 3) * 8, y + 14);
    for (let i = 0; i < 60 && game.ui.value.screen === 'game'; i += 1) pump(1000);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    browser = installFakeBrowser();
    vi.stubGlobal('localStorage', memoryStorage());
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

  it('records the counted run, then replays it as a ghost on the next run of the day', () => {
    const day = dateKeyOf(new Date());
    game.startDaily();
    pump(300);
    expect(scene().ghost ?? null).toBeNull();
    const start = { ...stateOf(game.sim!).players[0] };
    dieSoon();
    expect(game.ui.value.screen).toBe('gameover');
    expect(game.ui.value.result?.daily?.counted).toBe(true);
    const saved = loadGhost(day);
    expect(saved).not.toBeNull();
    const town = Object.values(saved!.towns)[0];
    expect(town.length).toBeGreaterThan(9);
    expect(Math.abs(town[0] - start.x)).toBeLessThan(2);

    game.playAgain();
    pump(300);
    expect(game.ui.value.screen).toBe('game');
    const ghost = scene().ghost;
    expect(ghost?.id).toBe(GHOST_ID);
    expect(Math.abs(ghost!.x - start.x)).toBeLessThan(40);

    // The practice run dies too: the counted run stays the ghost.
    dieSoon();
    expect(game.ui.value.result?.daily?.counted).toBe(false);
    expect(loadGhost(day)?.score).toBe(saved!.score);
  }, 120_000);
});
