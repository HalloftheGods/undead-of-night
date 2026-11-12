import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_PLAYERS, TICK_RATE } from '../shared/constants.ts';
import { CLOSE, UPDATE_REASON } from '../shared/close-codes.ts';
import { hurtPlayer } from '../shared/player-health.ts';
import { PROTOCOL_VERSION } from '../shared/protocol.ts';
import {
  JOIN_TIMEOUT_CODE,
  MAX_PACKET_BYTES,
  MAX_UNJOINED_PER_ADDRESS,
  MAX_UNJOINED_SOCKETS,
  MESSAGE_TOO_BIG_CODE,
  PACKET_BURST,
  ROOM_FULL_CODE,
  SERVER_BUSY_CODE,
} from '../shared/room/limits.ts';
import { createRoomHost, type HostedPeer, type RoomHost } from '../shared/room/room-host.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { FakePeer, ManualClock } from './helpers/fake-peer.ts';
import { stateOf } from './helpers/sim-harness.ts';

const TICK_MS = 1000 / TICK_RATE;
const JOIN_DEADLINE_MS = 500;
const RESTART_VOTE_MS = 800;
const HEARTBEAT_MS = 1000;

let clock: ManualClock;
let sim: GameSimulation;
let host: RoomHost;
let ids: number;

beforeEach(() => {
  clock = new ManualClock();
  sim = new GameSimulation({ seed: 11 });
  ids = 0;
  host = createRoomHost({ sim, clock, newId: () => `p${ids++}`, restartVoteMs: RESTART_VOTE_MS, joinDeadlineMs: JOIN_DEADLINE_MS, heartbeatMs: HEARTBEAT_MS, acceptUnversioned: true });
});

interface Link {
  readonly peer: FakePeer;
  readonly hosted: HostedPeer;
  say(value: unknown): void;
}

function connect(address = '10.0.0.1'): Link {
  const peer = new FakePeer();
  const hosted = host.admit(peer, address);
  if (!hosted) throw new Error(`refused with ${peer.closeCode}`);
  const say = (value: unknown): void => {
    const text = JSON.stringify(value);
    hosted.receive(text, text.length);
  };
  return { peer, hosted, say };
}

function joined(name: string, token: string, style?: string): Link {
  const link = connect();
  link.say({ type: 'join', name, token, style });
  return link;
}

/** Everyone down for good, then ticks until the sim calls it. */
function endRun(): void {
  const state = stateOf(sim);
  for (const player of state.players) {
    hurtPlayer(state, player, 1e6);
    player.status = 'dead';
  }
  for (let ticks = 0; ticks < TICK_RATE && sim.phase !== 'gameover'; ticks++) clock.advance(TICK_MS);
  expect(sim.phase).toBe('gameover');
}


describe('a Test Drive room', () => {
  it('says so in its welcome, and a normal room leaves the mark off', () => {
    expect('testDrive' in joined('Ann', 'token-a').peer.packet('welcome')!).toBe(false);
    sim = new GameSimulation({ seed: 11, testDrive: true });
    host = createRoomHost({ sim, clock, newId: () => `p${ids++}`, restartVoteMs: RESTART_VOTE_MS, joinDeadlineMs: JOIN_DEADLINE_MS, heartbeatMs: HEARTBEAT_MS, acceptUnversioned: true });
    expect(joined('Bea', 'token-b').peer.packet('welcome')?.testDrive).toBe(true);
  });
});

describe('RoomHost versions', () => {
  function strictJoin(protocol?: number): FakePeer {
    const strict = createRoomHost({ sim, clock, newId: () => `p${ids++}`, restartVoteMs: RESTART_VOTE_MS, joinDeadlineMs: JOIN_DEADLINE_MS, heartbeatMs: HEARTBEAT_MS });
    const peer = new FakePeer();
    const hosted = strict.admit(peer, '10.0.0.9');
    const text = JSON.stringify({ type: 'join', name: 'Ann', token: 't', ...(protocol === undefined ? {} : { protocol }) });
    hosted?.receive(text, text.length);
    return peer;
  }

  it('lets a join of the same protocol in', () => {
    const peer = strictJoin(PROTOCOL_VERSION);
    expect(peer.packet('welcome')).toBeDefined();
    expect(peer.closeCode).toBeNull();
  });

  it('closes an older guest with 4014 and a bye that says the guest is behind', () => {
    const peer = strictJoin(PROTOCOL_VERSION - 1);
    expect(peer.packet('bye')).toEqual({ type: 'bye', code: CLOSE.needsUpdate, reason: UPDATE_REASON.guestOlder });
    expect(peer.closeCode).toBe(4014);
    expect(peer.packet('welcome')).toBeUndefined();
  });

  it('closes a newer guest with 4014 and a bye that says the host is behind', () => {
    const peer = strictJoin(PROTOCOL_VERSION + 1);
    expect(peer.packet('bye')).toMatchObject({ code: 4014, reason: UPDATE_REASON.hostOlder });
    expect(peer.closeCode).toBe(4014);
  });

  it('turns away a join with no protocol unless the adapter allows it', () => {
    expect(strictJoin().closeCode).toBe(4014);
    const lan = new FakePeer();
    const hosted = host.admit(lan, '10.0.0.8');
    const text = JSON.stringify({ type: 'join', name: 'Ann', token: 't2' });
    hosted?.receive(text, text.length);
    expect(lan.packet('welcome')).toBeDefined();
  });
});

describe('RoomHost', () => {
  it('greets a new link, welcomes its join and streams snapshots at the tick rate', () => {
    const link = connect();
    expect(link.peer.received).toEqual([{ type: 'room', style: null }]);
    link.say({ type: 'join', name: 'Tester', token: 'tab-1' });
    expect(link.peer.packet('welcome')).toMatchObject({ yourId: 'p0', tickRate: TICK_RATE, mapSeed: sim.map.seed, level: sim.level });
    const before = link.peer.snapshots.length;
    // Half a tick of slack, since tick times are thirds of a millisecond.
    clock.advance(1000 + TICK_MS / 2);
    expect(link.peer.snapshots.length - before).toBe(TICK_RATE);
  });

  it('closes a join past MAX_PLAYERS with 4000, but lets a refreshed tab take its own body over', () => {
    const links = Array.from({ length: MAX_PLAYERS }, (_, index) => joined('Tester', `tab-${index}`));
    const late = joined('Cy', 'tab-late');
    expect(late.peer.closeCode).toBe(ROOM_FULL_CODE);

    const back = joined('Tester', 'tab-0');
    expect(back.peer.packet('welcome')).toBeDefined();
    expect(links[0].peer.dropped).toBe(true);
    links[0].hosted.closed();
    expect(sim.playerCount).toBe(MAX_PLAYERS);
  });

  it('re-greets a join under another style with what the room plays, and turns away a client from before styles', () => {
    joined('Tester', 'tab-1', 'campaign');
    const arcade = joined('Bea', 'tab-2', 'arcade');
    expect(arcade.peer.received.filter((packet) => packet.type === 'room').at(-1)).toEqual({ type: 'room', style: 'campaign' });
    expect(arcade.peer.packet('welcome')).toBeUndefined();
    expect(arcade.peer.open).toBe(true);

    const old = joined('Cy', 'tab-3');
    expect(old.peer.closeCode).toBe(ROOM_FULL_CODE);
  });

  it('closes a link that has not joined by the deadline with 4002, and spares one that has', () => {
    const idle = connect();
    const player = joined('Tester', 'tab-1');
    clock.advance(JOIN_DEADLINE_MS);
    expect(idle.peer.closeCode).toBe(JOIN_TIMEOUT_CODE);
    expect(player.peer.closeCode).toBeNull();
  });

  it('turns away a fifth unjoined link from one address with 4001, but not one from elsewhere', () => {
    for (let index = 0; index < MAX_UNJOINED_PER_ADDRESS; index++) connect('10.0.0.9');
    const peer = new FakePeer();
    expect(host.admit(peer, '10.0.0.9')).toBeNull();
    expect(peer.closeCode).toBe(SERVER_BUSY_CODE);
    expect(connect('10.0.0.10').peer.open).toBe(true);
  });

  it('turns away any link once the room holds MAX_UNJOINED_SOCKETS unjoined', () => {
    for (let index = 0; index < MAX_UNJOINED_SOCKETS; index++) connect(`10.0.1.${index}`);
    const peer = new FakePeer();
    expect(host.admit(peer, '10.0.2.1')).toBeNull();
    expect(peer.closeCode).toBe(SERVER_BUSY_CODE);
  });

  it('closes a link that sends a frame over MAX_PACKET_BYTES with 1009, and takes one right at the cap', () => {
    const link = connect();
    link.hosted.receive('{}', MAX_PACKET_BYTES);
    expect(link.peer.closeCode).toBeNull();
    link.hosted.receive('{}', MAX_PACKET_BYTES + 1);
    expect(link.peer.closeCode).toBe(MESSAGE_TOO_BIG_CODE);
  });

  it('drops a flood unread, and takes the same link again once it calms down', () => {
    const link = connect();
    for (let index = 0; index < PACKET_BURST; index++) link.say({ type: 'nonsense' });
    link.say({ type: 'join', name: 'Tester', token: 'tab-1' });
    expect(link.peer.packet('welcome')).toBeUndefined();

    clock.advance(100);
    link.say({ type: 'join', name: 'Tester', token: 'tab-1' });
    expect(link.peer.packet('welcome')).toBeDefined();
  });

  it('drops binary frames unread without spending the allowance', () => {
    const link = connect();
    for (let index = 0; index < PACKET_BURST - 1; index++) link.say({ type: 'nonsense' });
    for (let index = 0; index < 50; index++) link.hosted.receive(null, 8);
    link.say({ type: 'join', name: 'Tester', token: 'tab-1' });
    expect(link.peer.packet('welcome')).toBeDefined();
  });

  it('restarts a run once everyone has asked, or when the first asker has waited out the vote', () => {
    const first = joined('Tester', 'tab-1');
    const second = joined('Bea', 'tab-2');
    endRun();
    first.say({ type: 'restart' });
    expect(sim.phase).toBe('gameover');
    second.say({ type: 'restart' });
    expect(sim.phase).toBe('intermission');

    endRun();
    first.say({ type: 'restart' });
    clock.advance(RESTART_VOTE_MS - 1);
    expect(sim.phase).toBe('gameover');
    clock.advance(1);
    expect(sim.phase).toBe('intermission');
  });

  it('stops ticking and resets the run when the last player leaves, telling nobody', () => {
    const stays = joined('Tester', 'tab-1');
    const leaves = joined('Bea', 'tab-2');
    clock.advance(TICK_MS * 5);
    leaves.hosted.closed();
    expect(stays.peer.packet('player_disconnected')).toEqual({ type: 'player_disconnected', playerId: 'p1' });

    const state = stateOf(sim);
    state.wave = 4;
    state.phase = 'wave';
    stays.hosted.closed();
    expect(sim.playerCount).toBe(0);
    expect(sim.phase).toBe('intermission');
    expect(state.wave).toBe(0);
    const pausedAt = state.tick;
    clock.advance(1000);
    expect(state.tick).toBe(pausedAt);
    expect(connect().peer.received).toEqual([{ type: 'room', style: null }]);
  });

  it('skips frames for a backed-up link without holding up the rest', () => {
    const slow = joined('Tester', 'tab-1');
    const fast = joined('Bea', 'tab-2');
    slow.peer.backedUp = true;
    const slowBefore = slow.peer.snapshots.length;
    const fastBefore = fast.peer.snapshots.length;
    clock.advance(TICK_MS * 6.5);
    expect(slow.peer.snapshots.length).toBe(slowBefore);
    expect(fast.peer.snapshots.length - fastBefore).toBe(6);
  });

  it('probes every link each heartbeat and drops one that stayed silent', () => {
    const quiet = joined('Tester', 'tab-1');
    const chatty = joined('Bea', 'tab-2');
    clock.advance(HEARTBEAT_MS);
    expect(quiet.peer.probes).toBe(1);
    expect(chatty.peer.probes).toBe(1);
    chatty.hosted.heard();
    clock.advance(HEARTBEAT_MS);
    expect(quiet.peer.dropped).toBe(true);
    expect(chatty.peer.dropped).toBe(false);
    expect(chatty.peer.probes).toBe(2);
  });

  it('drops every link and leaves no timer behind on shutdown', () => {
    const player = joined('Tester', 'tab-1');
    const idle = connect();
    host.shutdown();
    expect(player.peer.dropped).toBe(true);
    expect(idle.peer.dropped).toBe(true);
    expect(clock.pending).toBe(0);
  });
});

describe('RoomHost in a public room', () => {
  it('drops every callsign on the way in, so players show as their survivor', () => {
    host = createRoomHost({ sim, clock, newId: () => `p${ids++}`, restartVoteMs: RESTART_VOTE_MS, joinDeadlineMs: JOIN_DEADLINE_MS, heartbeatMs: HEARTBEAT_MS, acceptUnversioned: true, anonymous: true });
    joined('Rude Name', 'tok-a');
    joined('Another', 'tok-b');
    expect(stateOf(sim).players.map((each) => each.name)).toEqual(['', '']);
  });

  it('keeps callsigns in a private room', () => {
    joined('Ann', 'tok-c');
    expect(stateOf(sim).players.map((each) => each.name)).toEqual(['Ann']);
  });
});
