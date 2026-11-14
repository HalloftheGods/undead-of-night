// The room itself: who is in it, what it plays, its tick and its restart vote. Links and time come from the room host.

import { MAX_PLAYERS, TICK_RATE } from '../constants.ts';
import { playsFromHome, STYLELESS_CLIENT } from '../game-style.ts';
import type { GameStyle } from '../game-style.ts';
import type { ClientPacket, ServerPacket, SnapshotPacket } from '../protocol.ts';
import type { GameSimulation } from '../simulation.ts';
import { viewFor } from '../snapshot-view.ts';
import { MAX_CATCH_UP_TICKS, MAX_LAG_MS, ROOM_FULL_CODE } from './limits.ts';
import type { HostClock, PeerSocket } from './peer.ts';
import { createRestartVote } from './restart-vote.ts';
import { campSizeField } from '../camp/camp-ring.ts';
import { townPrint } from '../town-print.ts';

const TICK_MS = 1000 / TICK_RATE;

type JoinPacket = Extract<ClientPacket, { type: 'join' }>;

export interface RoomClient {
  readonly peer: PeerSocket;
  readonly address: string;
  /** Set once the client has joined. */
  playerId: string | null;
  alive: boolean;
  /** Asked to play again since the run ended. */
  wantsRestart: boolean;
  /** Packets it may still send, refilled with time. */
  packetAllowance: number;
  allowanceAt: number;
  joinDeadline: unknown;
}

export interface GameRoomOptions {
  readonly sim: GameSimulation;
  readonly clock: HostClock;
  /** A fresh player id for each join. */
  readonly newId: () => string;
  readonly restartVoteMs: number;
  /** A public room: every callsign is dropped on the way in, so players show as their survivor (shared/callsign.ts). */
  readonly anonymous?: boolean;
  readonly style?: GameStyle;
}

export interface GameRoom {
  readonly clients: Set<RoomClient>;
  unjoined(): RoomClient[];
  /** Tells a new socket what the room plays, before it joins. */
  greet(client: RoomClient): void;
  receive(client: RoomClient, packet: ClientPacket): void;
  disconnect(client: RoomClient): void;
  /** Stops ticking and any pending vote. */
  shutdown(): void;
}

export function createGameRoom(options: GameRoomOptions): GameRoom {
  const { sim, clock, newId, restartVoteMs, anonymous = false } = options;
  const isDaily = options.style === 'daily';
  let inLobby = isDaily;
  const readyClients = new Set<string>();
  let autoStartTimerEnabled = true;
  let countdownSeconds: number | null = null;
  let countdownTimer: unknown = null;

  const clients = new Set<RoomClient>();
  let tickTimer: unknown = null;
  let nextTickAt = 0;

  const joined = (): RoomClient[] => [...clients].filter((client) => client.playerId !== null);
  const unjoined = (): RoomClient[] => [...clients].filter((client) => client.playerId === null);
  const vote = createRestartVote(sim, joined, restartVoteMs, clock);

  function send(client: RoomClient, packet: ServerPacket): void {
    if (client.peer.open) client.peer.send(JSON.stringify(packet));
  }

  function broadcastLobbyState(): void {
    const currentJoined = joined();
    const snapshot = sim.snapshot();
    const seats = currentJoined.map((c, index) => {
      const p = snapshot.players.find((player) => player.id === c.playerId);
      return {
        skin: p?.skin ?? 0,
        name: p?.name ?? '',
        ready: readyClients.has(c.playerId as string),
        isHost: index === 0,
      };
    });
    const packet: ServerPacket = {
      type: 'lobby_state',
      seats,
      countdown: countdownSeconds,
      autoStartTimer: autoStartTimerEnabled,
      launched: !inLobby,
    };
    for (const c of currentJoined) {
      send(c, packet);
    }
  }

  function startCountdown(seconds: number): void {
    if (countdownTimer !== null) return;
    countdownSeconds = seconds;
    broadcastLobbyState();
    function tickCountdown(): void {
      if (!inLobby || countdownSeconds === null) return;
      countdownSeconds -= 1;
      if (countdownSeconds <= 0) {
        countdownTimer = null;
        countdownSeconds = null;
        launchLobby();
        return;
      }
      broadcastLobbyState();
      countdownTimer = clock.after(1000, tickCountdown);
    }
    countdownTimer = clock.after(1000, tickCountdown);
  }

  function cancelCountdown(): void {
    if (countdownTimer !== null) {
      clock.cancel(countdownTimer);
      countdownTimer = null;
    }
    countdownSeconds = null;
    broadcastLobbyState();
  }

  function launchLobby(): void {
    if (!inLobby) return;
    inLobby = false;
    if (countdownTimer !== null) {
      clock.cancel(countdownTimer);
      countdownTimer = null;
    }
    countdownSeconds = null;
    broadcastLobbyState();
    startTicking();
  }

  /** What the room plays while someone is in it. An empty room plays nothing, so the next one in can change it. */
  function roomStyle(): GameStyle | null {
    if (options.style) return options.style;
    const isEmpty = sim.playerCount === 0;
    if (isEmpty) return null;
    return sim.playsHome ? 'campaign' : 'arcade';
  }

  function greet(client: RoomClient): void {
    send(client, { type: 'room', style: roomStyle() });
  }

  /** True if this join can go ahead as the room's style. If not, it hears what the room plays, and a client that knows styles asks again with the right gear. */
  function settleStyle(client: RoomClient, asked: GameStyle | undefined): boolean {
    const style = asked ?? STYLELESS_CLIENT;
    const current = roomStyle();
    const isUnclaimed = current === null;
    if (isUnclaimed) sim.setHome(playsFromHome(style));
    const agreed = current === null || current === style;
    if (agreed) return true;
    // A client from before styles has no way to play this room, and this is the nearest thing it can show.
    const isStylelessClient = asked === undefined;
    if (isStylelessClient) client.peer.close(ROOM_FULL_CODE, 'room full');
    else greet(client);
    return false;
  }

  /** Each client gets its own cut of the frame, unless it is already too far behind to take one. */
  function sendFrame(frame: SnapshotPacket): void {
    for (const client of joined()) {
      if (!client.peer.open) continue;
      const text = JSON.stringify(viewFor(frame, client.playerId as string));
      // Near enough its size in bytes: only a player's name can carry anything past ASCII.
      if (client.peer.canTakeFrame(text.length)) client.peer.send(text);
    }
  }

  function runDueTicks(): void {
    const now = clock.now();
    const isFarBehind = now - nextTickAt > MAX_LAG_MS;
    if (isFarBehind) nextTickAt = now;
    for (let ticks = 0; ticks < MAX_CATCH_UP_TICKS && now >= nextTickAt; ticks++) {
      sim.step();
      sendFrame(sim.snapshot());
      nextTickAt += TICK_MS;
    }
    tickTimer = clock.after(Math.max(0, nextTickAt - clock.now()), runDueTicks);
  }

  function startTicking(): void {
    const isTicking = tickTimer !== null;
    if (isTicking || inLobby) return;
    nextTickAt = clock.now();
    runDueTicks();
  }

  function stopTicking(): void {
    const isTicking = tickTimer !== null;
    if (isTicking) clock.cancel(tickTimer);
    tickTimer = null;
  }

  /**
   * Whether this join may take a seat: the client is not seated yet, there is a seat (or its own old body) to take,
   * and it agrees with the room's style. Null when it may not; otherwise the stale connection it takes over, if any.
   */
  function admitJoin(client: RoomClient, token: JoinPacket['token'], style: JoinPacket['style']): { stale: RoomClient | undefined } | null {
    if (client.playerId) return null;
    // A dropped link can outlive its refresh: the old socket goes and the new one takes that body over.
    const heldBy = sim.playerWithToken(token);
    const stale = joined().find((other) => other.playerId === heldBy);
    const isRoomFull = !stale && sim.playerCount >= MAX_PLAYERS;
    if (isRoomFull) {
      client.peer.close(ROOM_FULL_CODE, 'room full');
      return null;
    }
    return settleStyle(client, style) ? { stale } : null;
  }

  function join(client: RoomClient, { name, token, character, difficulty, home, style }: JoinPacket): void {
    const admitted = admitJoin(client, token, style);
    if (!admitted) return;
    const { stale } = admitted;
    const id = newId();
    // The first player into an empty room sets how hard the run is.
    const setsDifficulty = difficulty && sim.playerCount === 0;
    if (setsDifficulty) sim.setDifficulty(difficulty);
    // After that restart, which lets every body go, and before addPlayer takes this one back.
    const resumed = sim.hasBodyFor(token);
    sim.addPlayer(id, anonymous ? '' : name, token, character, home);
    client.playerId = id;
    clock.cancel(client.joinDeadline);
    send(client, { type: 'welcome', yourId: id, tickRate: TICK_RATE, mapSeed: sim.map.seed, level: sim.level, ...campSizeField(sim.map), difficulty: sim.difficulty, town: townPrint(sim.map), ...(resumed ? { resumed } : {}), ...(sim.testDrive ? { testDrive: true } : {}) });
    stale?.peer.drop();
    if (inLobby) {
      sendFrame(sim.snapshot());
      broadcastLobbyState();
      if (autoStartTimerEnabled && joined().length >= MAX_PLAYERS) {
        launchLobby();
      }
    } else {
      startTicking();
    }
  }

  function receive(client: RoomClient, packet: ClientPacket): void {
    if (packet.type === 'join') join(client, packet);
    else if (client.playerId === null) return;
    else if (packet.type === 'lobby_ready') {
      if (!inLobby) return;
      if (packet.ready) readyClients.add(client.playerId);
      else readyClients.delete(client.playerId);
      const currentJoined = joined();
      const allReady = currentJoined.length >= 2 && currentJoined.every((c) => readyClients.has(c.playerId as string));
      if (allReady) {
        launchLobby();
      } else {
        broadcastLobbyState();
      }
    }
    else if (packet.type === 'lobby_start') {
      if (!inLobby) return;
      const currentJoined = joined();
      const isHost = currentJoined[0]?.playerId === client.playerId;
      if (!isHost) return;
      const allReady = currentJoined.length >= 2 && currentJoined.every((c) => readyClients.has(c.playerId as string));
      if (allReady) {
        launchLobby();
      } else if (currentJoined.length >= 2 && countdownSeconds === null) {
        startCountdown(5);
      }
    }
    else if (packet.type === 'lobby_toggle_timer') {
      if (!inLobby) return;
      const isHost = joined()[0]?.playerId === client.playerId;
      if (!isHost) return;
      autoStartTimerEnabled = packet.enabled !== undefined ? packet.enabled : !autoStartTimerEnabled;
      broadcastLobbyState();
    }
    else if (packet.type === 'input') sim.setInput(client.playerId, packet.input);
    else if (packet.type === 'bench') sim.benchCommand(client.playerId, packet.action);
    else if (packet.type === 'bag') sim.bagCommand(client.playerId, packet.commit);
    else if (packet.type === 'home') sim.homeCommand(client.playerId, packet.action);
    else if (packet.type === 'emote') sim.emote(client.playerId, packet.emote);
    else if (packet.type === 'boon') sim.giveBoon(client.playerId, packet.count);
    else vote.ask(client);
  }

  function disconnect(client: RoomClient): void {
    clients.delete(client);
    clock.cancel(client.joinDeadline);
    const { playerId } = client;
    const neverJoined = playerId === null;
    if (neverJoined) return;
    if (playerId) readyClients.delete(playerId);
    sim.removePlayer(playerId);
    for (const other of joined()) send(other, { type: 'player_disconnected', playerId });
    if (inLobby) {
      if (joined().length < 2 && countdownSeconds !== null) {
        cancelCountdown();
      } else {
        broadcastLobbyState();
      }
    }
    const isRoomEmpty = sim.playerCount === 0;
    if (isRoomEmpty) {
      if (countdownTimer !== null) clock.cancel(countdownTimer);
      countdownTimer = null;
      countdownSeconds = null;
      inLobby = isDaily;
      readyClients.clear();
      stopTicking();
      vote.end();
      sim.restart();
      return;
    }
    vote.restartIfAgreed();
  }

  function shutdown(): void {
    if (countdownTimer !== null) clock.cancel(countdownTimer);
    countdownTimer = null;
    countdownSeconds = null;
    stopTicking();
    vote.end();
  }

  return { clients, unjoined, greet, receive, disconnect, shutdown };
}
