import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameController } from '../src/game/game-controller.ts';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';
import type { FakeBrowser } from './client-fake-dom.ts';

/** A room that never answers, so a run stays in its connecting state. */
function quietRoom(kind: string) {
  return { kind: 'coop', made: kind, onWelcome: null, onSnapshot: null, onClosed: null, onRoom: null, connect: vi.fn(), disconnect: vi.fn(), join: vi.fn(), requestRestart: vi.fn() };
}

const rooms = vi.hoisted(() => ({
  hosted: [] as string[],
  joined: [] as string[],
  openings: [] as unknown[],
  publicJoins: [] as boolean[],
  matches: [] as unknown[],
  answer: { ok: true, match: { kind: 'join', code: 'KMPRT', card: {} } } as unknown,
}));

vi.mock('../src/network/play-api.ts', async (real) => ({
  ...(await real<object>()),
  onlineRoomsLive: () => true,
  PLAY_API: 'https://play.test',
  matchRoom: async (request: unknown) => {
    rooms.matches.push(request);
    return rooms.answer;
  },
}));
vi.mock('../src/network/online-session.ts', () => {
  return {
    hostDevice: () => 'desktop',
    hostRoom: (style: string, _events: unknown, opening: unknown = { public: false }) => {
      rooms.hosted.push(style);
      rooms.openings.push(opening);
      return quietRoom('host');
    },
    joinRoom: (code: string, isPublic = false) => {
      rooms.joined.push(code);
      rooms.publicJoins.push(isPublic);
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
    rooms.openings.length = 0;
    rooms.publicJoins.length = 0;
    rooms.matches.length = 0;
    rooms.answer = { ok: true, match: { kind: 'join', code: 'KMPRT', card: {} } };
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

  it('Host for friends hosts a private room whatever the field holds', async () => {
    game.setServerAddress('bcdfg');
    game.startCoop('arcade', 'host');
    await settle();
    expect(rooms.hosted).toEqual(['arcade']);
    expect(rooms.openings).toEqual([{ public: false }]);
    expect(rooms.joined).toEqual([]);
  });

  it('Join with code asks for a code rather than hosting when the field is blank', async () => {
    game.setServerAddress('');
    game.startCoop('arcade', 'code');
    await settle();
    expect(rooms.hosted).toEqual([]);
    expect(game.ui.value.error).toMatch(/room code/i);
  });

  it('Find a team joins the public room it was matched into, without callsigns', async () => {
    game.startCoop('campaign', 'find');
    await settle();
    expect(rooms.matches).toEqual([expect.objectContaining({ style: 'campaign', device: 'desktop' })]);
    expect(rooms.joined).toEqual(['KMPRT']);
    expect(rooms.publicJoins).toEqual([true]);
  });

  it('Find a team hosts the public room the Lobby made when nothing fits', async () => {
    rooms.answer = { ok: true, match: { kind: 'host', code: 'VWXRT', hostKey: 'key' } };
    game.startCoop('arcade', 'find');
    await settle();
    expect(rooms.openings).toEqual([{ public: true, preset: { code: 'VWXRT', hostKey: 'key' } }]);
  });

  it('Find a team says when the rooms are busy and starts nothing', async () => {
    rooms.answer = { ok: false, reason: 'The online rooms are busy. Try again in a moment.' };
    game.startCoop('arcade', 'find');
    await settle();
    expect(rooms.hosted).toEqual([]);
    expect(rooms.joined).toEqual([]);
    expect(game.ui.value).toMatchObject({ connecting: false, error: 'The online rooms are busy. Try again in a moment.' });
  });
});
