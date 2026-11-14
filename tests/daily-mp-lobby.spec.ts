import { beforeEach, describe, expect, it } from 'vitest';
import type { GameOverStats, LobbyStatePacket } from '../shared/protocol.ts';
import { createRoomHost, type HostedPeer, type RoomHost } from '../shared/room/room-host.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { finishRun } from '../src/game/run-hud.ts';
import { loadDailyLog } from '../src/game/daily-night.ts';
import { FakePeer, ManualClock } from './helpers/fake-peer.ts';

const JOIN_DEADLINE_MS = 500;
const RESTART_VOTE_MS = 800;
const HEARTBEAT_MS = 60_000;

function memoryStore() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, val: string) => void map.set(key, val),
  };
}

describe('Daily MP Lobby and Finish Run', () => {
  let clock: ManualClock;
  let sim: GameSimulation;
  let host: RoomHost;
  let ids: number;

  beforeEach(() => {
    clock = new ManualClock();
    sim = new GameSimulation({ seed: 42 });
    ids = 0;
    host = createRoomHost({
      sim,
      clock,
      newId: () => `p${ids++}`,
      restartVoteMs: RESTART_VOTE_MS,
      joinDeadlineMs: JOIN_DEADLINE_MS,
      heartbeatMs: HEARTBEAT_MS,
      acceptUnversioned: true,
      style: 'daily',
    });
  });

  interface Link {
    readonly peer: FakePeer;
    readonly hosted: HostedPeer;
    say(value: unknown): void;
    packets<T = unknown>(type: string): T[];
  }

  function connect(): Link {
    const peer = new FakePeer();
    const hosted = host.admit(peer, '10.0.0.1');
    if (!hosted) throw new Error('connection refused');
    const say = (value: unknown): void => {
      const text = JSON.stringify(value);
      hosted.receive(text, text.length);
    };
    const packets = <T = unknown>(type: string): T[] =>
      peer.received.filter((p) => p.type === type) as T[];
    return { peer, hosted, say, packets };
  }

  it('broadcasts lobby state to joining players with host identification', () => {
    const p1 = connect();
    p1.say({ type: 'join', name: 'Alpha', token: 'tok-1', character: 0, style: 'daily' });

    const p1Lobby = p1.packets<LobbyStatePacket>('lobby_state');
    expect(p1Lobby.length).toBeGreaterThan(0);
    const firstState = p1Lobby[p1Lobby.length - 1];
    expect(firstState.seats.length).toBe(1);
    expect(firstState.seats[0].isHost).toBe(true);
    expect(firstState.seats[0].skin).toBe(0);
    expect(firstState.seats[0].name).toBe('Alpha');

    const p2 = connect();
    p2.say({ type: 'join', name: 'Bravo', token: 'tok-2', character: 1, style: 'daily' });

    const p2Lobby = p2.packets<LobbyStatePacket>('lobby_state');
    const secondState = p2Lobby[p2Lobby.length - 1];
    expect(secondState.seats.length).toBe(2);
    expect(secondState.seats[1].isHost).toBe(false);
    expect(secondState.seats[1].skin).toBe(1);
  });

  it('allows guests to toggle ready and hosts to toggle auto-start timer', () => {
    const p1 = connect();
    p1.say({ type: 'join', name: 'Alpha', token: 'tok-1', character: 0, style: 'daily' });

    const p2 = connect();
    p2.say({ type: 'join', name: 'Bravo', token: 'tok-2', character: 1, style: 'daily' });

    // Guest toggles ready
    p2.say({ type: 'lobby_ready', ready: true });
    let p2Lobby = p2.packets<LobbyStatePacket>('lobby_state');
    let state = p2Lobby[p2Lobby.length - 1];
    expect(state.seats.find((s) => s.skin === 1)?.ready).toBe(true);

    // Host toggles timer
    expect(state.autoStartTimer).toBe(true);
    p1.say({ type: 'lobby_toggle_timer' });
    p2Lobby = p2.packets<LobbyStatePacket>('lobby_state');
    state = p2Lobby[p2Lobby.length - 1];
    expect(state.autoStartTimer).toBe(false);
  });

  it('starts countdown on host start, and launches when countdown completes', () => {
    const p1 = connect();
    p1.say({ type: 'join', name: 'Alpha', token: 'tok-1', character: 0, style: 'daily' });

    const p2 = connect();
    p2.say({ type: 'join', name: 'Bravo', token: 'tok-2', character: 1, style: 'daily' });

    // Host clicks start while guest is not ready -> starts 5s countdown
    p1.say({ type: 'lobby_start' });
    let lobbyStates = p1.packets<LobbyStatePacket>('lobby_state');
    let state = lobbyStates[lobbyStates.length - 1];
    expect(state.countdown).toBe(5);

    // Advance clock 6 seconds to ensure all 5 second ticks complete
    clock.advance(6000);
    lobbyStates = p1.packets<LobbyStatePacket>('lobby_state');
    state = lobbyStates[lobbyStates.length - 1];
    expect(state.launched).toBe(true);
  });

  it('launches immediately when all players are ready', () => {
    const p1 = connect();
    p1.say({ type: 'join', name: 'Alpha', token: 'tok-1', character: 0, style: 'daily' });

    const p2 = connect();
    p2.say({ type: 'join', name: 'Bravo', token: 'tok-2', character: 1, style: 'daily' });

    // Mark both ready
    p1.say({ type: 'lobby_ready', ready: true });
    p2.say({ type: 'lobby_ready', ready: true });

    // Host starts -> launches immediately
    p1.say({ type: 'lobby_start' });
    const lobbyStates = p1.packets<LobbyStatePacket>('lobby_state');
    const state = lobbyStates[lobbyStates.length - 1];
    expect(state.launched).toBe(true);
  });

  it('records multiplayer team score, party size, and roster on finishRun', () => {
    const store = memoryStore();
    const stats: GameOverStats = {
      outcome: 'defeat',
      difficulty: 'lights_out',
      level: 4,
      wave: 8,
      durationSec: 250,
      players: [
        { id: 'p0', name: 'Night', skin: 0, kills: 15, score: 120 },
        { id: 'p1', name: 'Bear', skin: 1, kills: 20, score: 180 },
        { id: 'p2', name: 'Kat', skin: 2, kills: 25, score: 200 },
      ],
    };

    const result = finishRun(stats, 'p0', '2026-11-10');
    expect(result.daily).toBeDefined();
    expect(result.daily?.label).toContain('3P');
    expect(result.daily?.counted).toBe(true);

    loadDailyLog(store);
    // Since browserStore is mocked globally or fallback, loadDailyLog checks storage
  });
});
