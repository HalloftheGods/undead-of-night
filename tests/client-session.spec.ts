import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TICK_DT } from '../shared/constants.ts';
import { closeText, FRIEND_NEEDS_UPDATE_TEXT, NEEDS_UPDATE_TEXT, UPDATE_REASON } from '../shared/close-codes.ts';
import type { GameStyle } from '../shared/game-style.ts';
import { PROTOCOL_VERSION, type SnapshotPacket, type WelcomePacket } from '../shared/protocol.ts';
import { LocalSession } from '../src/network/local-session.ts';
import { SocketSession } from '../src/network/socket-session.ts';
import { TickClock } from '../src/network/tick-clock.ts';

const TICK_MS = TICK_DT * 1000;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('TickClock', () => {
  it('holds the average rate even though each timer fires late', () => {
    let ticks = 0;
    const clock = new TickClock(10, () => { ticks += 1; });
    clock.start();
    vi.advanceTimersByTime(1000);
    clock.stop();
    expect(ticks).toBe(100);
  });

  it('owes nothing for time spent stopped', () => {
    let ticks = 0;
    const clock = new TickClock(10, () => { ticks += 1; });
    clock.start();
    vi.advanceTimersByTime(100);
    clock.stop();
    vi.advanceTimersByTime(5000);
    expect(ticks).toBe(10);
    clock.start();
    vi.advanceTimersByTime(100);
    clock.stop();
    expect(ticks).toBe(20);
  });

  it('can be stopped from inside a tick', () => {
    let ticks = 0;
    const clock = new TickClock(10, () => {
      ticks += 1;
      clock.stop();
    });
    clock.start();
    vi.advanceTimersByTime(200);
    expect(ticks).toBe(1);
    expect(clock.running).toBe(false);
  });

  it('drops the backlog after a long stall rather than spiralling', () => {
    let now = 0;
    let ticks = 0;
    const clock = new TickClock(10, () => { ticks += 1; }, () => now);
    clock.start();
    now = 10_000;
    vi.advanceTimersByTime(10);
    clock.stop();
    expect(ticks).toBeLessThanOrEqual(5);
  });
});

describe('LocalSession', () => {
  function connect() {
    const session = new LocalSession();
    const snapshots: SnapshotPacket[] = [];
    const welcomes: WelcomePacket[] = [];
    session.onWelcome = (packet) => welcomes.push(packet);
    session.onSnapshot = (packet) => snapshots.push(packet);
    session.connect({ name: 'ANA' });
    return { session, snapshots, welcomes };
  }

  it('welcomes the player and starts ticking', () => {
    const { session, snapshots, welcomes } = connect();
    expect(welcomes).toHaveLength(1);
    expect(snapshots[0].players[0].name).toBe('ANA');
    vi.advanceTimersByTime(TICK_MS * 10 + 1);
    expect(snapshots.length).toBeGreaterThanOrEqual(10);
    expect(snapshots[snapshots.length - 1].tick).toBeGreaterThan(snapshots[0].tick);
    session.disconnect();
  });

  it('stops the sim while paused', () => {
    const { session, snapshots } = connect();
    vi.advanceTimersByTime(TICK_MS * 3);
    session.setPaused(true);
    const before = snapshots.length;
    vi.advanceTimersByTime(5000);
    expect(snapshots.length).toBe(before);
    session.setPaused(false);
    vi.advanceTimersByTime(TICK_MS * 3 + 1);
    expect(snapshots.length).toBeGreaterThan(before);
    session.disconnect();
  });

  it('reaches the sim with input', () => {
    const { session, snapshots } = connect();
    session.sendInput({ seq: 4, up: false, down: false, left: false, right: true, angle: 0, shoot: false, reload: false, weapon: null, melee: false, heal: false, search: false });
    vi.advanceTimersByTime(TICK_MS * 4);
    const local = snapshots[snapshots.length - 1].players[0];
    expect(local.x).toBeGreaterThan(snapshots[0].players[0].x);
    expect(local.lastInputSeq).toBe(4);
    session.disconnect();
  });

  it('builds a fresh city for every run', () => {
    const { session, welcomes } = connect();
    session.requestRestart();
    expect(welcomes).toHaveLength(2);
    expect(welcomes[1].mapSeed).not.toBe(welcomes[0].mapSeed);
    session.disconnect();
  });

  it('goes quiet after disconnect', () => {
    const { session, snapshots } = connect();
    session.disconnect();
    const before = snapshots.length;
    vi.advanceTimersByTime(1000);
    expect(snapshots.length).toBe(before);
  });
});

class FakeSocket {
  static readonly OPEN = 1;
  static last: FakeSocket;
  readyState = 0;
  sent: string[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number; reason?: string }) => void) | null = null;
  closed = false;

  constructor() {
    FakeSocket.last = this;
  }

  send(text: string): void {
    this.sent.push(text);
  }

  close(): void {
    this.closed = true;
  }

  /** The server's first word is what the room plays. */
  open(style: GameStyle | null = null): void {
    this.readyState = FakeSocket.OPEN;
    this.onmessage?.({ data: JSON.stringify({ type: 'room', style }) });
  }
}

describe('SocketSession (ws link)', () => {
  const welcome = JSON.stringify({ type: 'welcome', yourId: 'a', tickRate: 30, mapSeed: 7 });

  function connect() {
    vi.stubGlobal('WebSocket', FakeSocket);
    const session = new SocketSession('ws://host:8097');
    const closed: string[] = [];
    const welcomes: WelcomePacket[] = [];
    session.onClosed = (reason) => closed.push(reason);
    session.onWelcome = (packet) => welcomes.push(packet);
    session.onRoom = (style) => session.join(style ?? 'arcade');
    session.connect({ name: 'ANA' });
    return { session, closed, welcomes, socket: FakeSocket.last };
  }

  it('joins once the room has said what it plays, naming that style', () => {
    const { socket } = connect();
    expect(socket.sent).toHaveLength(0);
    socket.open('campaign');
    expect(JSON.parse(socket.sent[0])).toEqual({ type: 'join', name: 'ANA', token: expect.any(String), style: 'campaign', protocol: PROTOCOL_VERSION });
  });

  it('hears the room again if it moved on before the join landed, but not after the welcome', () => {
    const { session, socket } = connect();
    const heard: (GameStyle | null)[] = [];
    session.onRoom = (style) => heard.push(style);
    socket.open(null);
    socket.onmessage?.({ data: JSON.stringify({ type: 'room', style: 'arcade' }) });
    socket.onmessage?.({ data: welcome });
    socket.onmessage?.({ data: JSON.stringify({ type: 'room', style: 'campaign' }) });
    expect(heard).toEqual([null, 'arcade']);
  });

  it('takes no notice of a room packet that names no style it knows', () => {
    const { session, socket } = connect();
    const heard: unknown[] = [];
    session.onRoom = (style) => heard.push(style);
    socket.onmessage?.({ data: JSON.stringify({ type: 'room', style: 'endless' }) });
    socket.onmessage?.({ data: JSON.stringify({ type: 'room' }) });
    expect(heard).toEqual([]);
  });

  it('gives up with a reason when nothing answers', () => {
    const { closed, socket } = connect();
    vi.advanceTimersByTime(7000);
    expect(closed).toHaveLength(1);
    expect(closed[0]).toContain('ws://host:8097');
    expect(socket.closed).toBe(true);
  });

  it('still times out if the socket opens but no welcome comes', () => {
    const { closed, socket } = connect();
    socket.open();
    vi.advanceTimersByTime(7000);
    expect(closed).toHaveLength(1);
  });

  it('does not time out once welcomed', () => {
    const { closed, socket, welcomes } = connect();
    socket.open();
    socket.onmessage?.({ data: welcome });
    vi.advanceTimersByTime(60_000);
    expect(welcomes).toHaveLength(1);
    expect(closed).toHaveLength(0);
  });

  it('reports a refused connection', () => {
    const { closed, socket } = connect();
    socket.onclose?.({ code: 1006 });
    expect(closed[0]).toMatch(/could not reach/i);
  });

  it('explains a full room', () => {
    const { closed, socket } = connect();
    socket.open();
    socket.onclose?.({ code: 4000 });
    expect(closed[0]).toMatch(/full/i);
  });

  it('tells the older side to reload and the newer side to wait for its friend', () => {
    const older = connect();
    older.socket.open();
    older.socket.onclose?.({ code: 4014, reason: UPDATE_REASON.guestOlder });
    expect(older.closed[0]).toBe(NEEDS_UPDATE_TEXT);
    const newer = connect();
    newer.socket.open();
    newer.socket.onclose?.({ code: 4014, reason: UPDATE_REASON.hostOlder });
    expect(newer.closed[0]).toBe(FRIEND_NEEDS_UPDATE_TEXT);
  });

  it('takes a bye packet as the close, since a data channel has no close code', () => {
    const { closed, socket } = connect();
    socket.open();
    socket.onmessage?.({ data: JSON.stringify({ type: 'bye', code: 4011, reason: 'host left' }) });
    expect(closed).toEqual([closeText(4011)]);
    socket.onclose?.({ code: 1006 });
    expect(closed).toHaveLength(1);
  });

  it('reports a dropped connection once, and never after disconnect', () => {
    const { session, closed, socket } = connect();
    socket.open();
    socket.onmessage?.({ data: welcome });
    socket.onclose?.({ code: 1006 });
    expect(closed).toEqual(['The connection to the server dropped.']);
    session.disconnect();
    expect(closed).toHaveLength(1);
  });

  it('stays silent when the player leaves on purpose', () => {
    const { session, closed, socket } = connect();
    session.disconnect();
    socket.onclose?.({ code: 1000 });
    vi.advanceTimersByTime(7000);
    expect(closed).toHaveLength(0);
  });

  it('drops malformed packets without throwing', () => {
    const { session, socket, welcomes } = connect();
    socket.onmessage?.({ data: '{"type":"welcome"}' });
    socket.onmessage?.({ data: 'garbage' });
    expect(welcomes).toHaveLength(0);
    session.disconnect();
  });

  it('holds back input until welcomed', () => {
    const { session, socket } = connect();
    socket.open();
    const input = { seq: 1, up: false, down: false, left: false, right: false, angle: 0, shoot: false, reload: false, weapon: null, melee: false, heal: false, search: false };
    session.sendInput(input);
    expect(socket.sent).toHaveLength(1);
    socket.onmessage?.({ data: welcome });
    session.sendInput(input);
    expect(JSON.parse(socket.sent[1]).type).toBe('input');
    session.disconnect();
  });
});
