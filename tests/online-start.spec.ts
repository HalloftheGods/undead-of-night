import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameController } from '../src/game/game-controller.ts';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';
import type { FakeBrowser } from './client-fake-dom.ts';

/** A room that never answers, so a run stays in its connecting state. */
function quietRoom(kind: string) {
  return { kind: 'coop', made: kind, onWelcome: null, onSnapshot: null, onClosed: null, onRoom: null, connect: vi.fn(), disconnect: vi.fn(), join: vi.fn(), requestRestart: vi.fn() };
}

const rooms = vi.hoisted(() => ({ hosted: [] as string[], joined: [] as string[] }));

vi.mock('../src/network/play-api.ts', async (real) => ({ ...(await real<object>()), onlineRoomsLive: () => true, PLAY_API: 'https://play.test' }));
vi.mock('../src/network/online-session.ts', () => {
  return {
    hostRoom: (style: string) => {
      rooms.hosted.push(style);
      return quietRoom('host');
    },
    joinRoom: (code: string) => {
      rooms.joined.push(code);
      return quietRoom('guest');
    },
  };
});

const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await vi.advanceTimersByTimeAsync(0);
};

describe('online co-op loads its room code on demand', () => {
  let browser: FakeBrowser;
  let game: GameController;

  beforeEach(() => {
    vi.useFakeTimers();
    browser = installFakeBrowser();
    rooms.hosted.length = 0;
    rooms.joined.length = 0;
    game = new GameController();
    game.mount(fakeCanvas() as unknown as HTMLCanvasElement);
    for (let ms = 0; ms < 100; ms += 16) {
      vi.advanceTimersByTime(16);
      browser.runFrame(ms);
    }
  });

  afterEach(() => {
    game.dispose();
    vi.useRealTimers();
  });

  it('a blank field holds the menu in connecting, then hosts a room from this tab', async () => {
    game.setServerAddress('');
    game.startCoop('arcade');
    expect(game.ui.value.connecting).toBe(true);
    game.startCoop('arcade');
    await settle();
    expect(rooms.hosted).toEqual(['arcade']);
    expect(game.ui.value).toMatchObject({ mode: 'coop', connecting: true });
  });

  it('a room code joins that room, upper-cased', async () => {
    game.setServerAddress(' bcdfg ');
    game.startCoop('arcade');
    await settle();
    expect(rooms.joined).toEqual(['BCDFG']);
    expect(game.ui.value).toMatchObject({ mode: 'coop', connecting: true });
  });

  it('starts nothing when the player has left the menu before the code arrives', async () => {
    game.setServerAddress('');
    game.startCoop('arcade');
    game.toMenu();
    await settle();
    expect(rooms.hosted).toEqual([]);
    expect(game.ui.value.connecting).toBe(false);
  });
});
