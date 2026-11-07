// The room behind every adapter: who gets in, what a frame may be, and when a silent link goes.
// Node ws, a browser host over WebRTC and a Durable Object hand it links; it never touches a socket API itself.

import { CLOSE, UPDATE_REASON } from '../close-codes.ts';
import { PROTOCOL_VERSION, type ClientPacket } from '../protocol.ts';
import { parseClientPacket } from './client-packets.ts';
import { createGameRoom, type GameRoomOptions, type RoomClient } from './game-room.ts';
import {
  JOIN_TIMEOUT_CODE,
  MAX_PACKET_BYTES,
  MAX_UNJOINED_PER_ADDRESS,
  MAX_UNJOINED_SOCKETS,
  MESSAGE_TOO_BIG_CODE,
  PACKET_BURST,
  SERVER_BUSY_CODE,
  takePacketAllowance,
} from './limits.ts';
import type { PeerSocket } from './peer.ts';

export interface RoomHostOptions extends GameRoomOptions {
  /** A socket that has not joined by then is closed with 4002. */
  readonly joinDeadlineMs: number;
  /** How often every link is probed; one that stayed silent since the last probe is dropped. */
  readonly heartbeatMs: number;
  /** A join that names no protocol is let in. Only the Node adapter sets it, so LAN play keeps working with old tabs. */
  readonly acceptUnversioned?: boolean;
}

/** What an adapter reports about one admitted link. */
export interface HostedPeer {
  /** A frame arrived. Text is null for a binary frame, which is dropped unread. */
  receive(text: string | null, bytes: number): void;
  /** The far end answered a probe. */
  heard(): void;
  /** The link has closed, however it went. */
  closed(): void;
}

export interface RoomHost {
  /** Takes a new link in and greets it, or closes it with 4001 when too many sit unjoined. */
  admit(peer: PeerSocket, address: string): HostedPeer | null;
  /** Stops ticking, the vote and the heartbeat, and drops every link. */
  shutdown(): void;
}

export function createRoomHost(options: RoomHostOptions): RoomHost {
  const { clock } = options;
  const room = createGameRoom(options);
  const clients = room.clients;
  let heartbeat = clock.after(options.heartbeatMs, sweep);

  function sweep(): void {
    heartbeat = clock.after(options.heartbeatMs, sweep);
    for (const client of clients) {
      if (!client.alive) {
        client.peer.drop();
        continue;
      }
      client.alive = false;
      client.peer.probe();
    }
  }

  function isBusyFor(address: string): boolean {
    const waiting = room.unjoined();
    const waitingHere = waiting.filter((client) => client.address === address).length;
    return waiting.length >= MAX_UNJOINED_SOCKETS || waitingHere >= MAX_UNJOINED_PER_ADDRESS;
  }

  /** Closes a join from another build with 4014, saying which side is behind. True when it was turned away. */
  function turnedAwayForVersion(client: RoomClient, packet: ClientPacket): boolean {
    const isNotJoin = packet.type !== 'join';
    if (isNotJoin) return false;
    const theirs = packet.protocol;
    const sameBuild = theirs === PROTOCOL_VERSION;
    const unversionedAllowed = theirs === undefined && options.acceptUnversioned === true;
    const isCompatible = sameBuild || unversionedAllowed;
    if (isCompatible) return false;
    const hostIsBehind = theirs !== undefined && theirs > PROTOCOL_VERSION;
    const reason = hostIsBehind ? UPDATE_REASON.hostOlder : UPDATE_REASON.guestOlder;
    // A data channel has no close code, so the bye carries it.
    const bye = JSON.stringify({ type: 'bye', code: CLOSE.needsUpdate, reason });
    if (client.peer.open) client.peer.send(bye);
    client.peer.close(CLOSE.needsUpdate, reason);
    return true;
  }

  function receive(client: RoomClient, text: string | null, bytes: number): void {
    // On a slow link the pong queues behind the frames, but its input still arrives.
    client.alive = true;
    // ws refuses these before they get here; a link without a payload cap is cut now.
    const oversized = bytes > MAX_PACKET_BYTES;
    if (oversized) {
      client.peer.close(MESSAGE_TOO_BIG_CODE, 'message too big');
      return;
    }
    const admitted = text !== null && takePacketAllowance(client, clock.now());
    if (!admitted) return;
    const packet = parseClientPacket(text);
    const isAcceptedPacket = packet && !turnedAwayForVersion(client, packet);
    if (isAcceptedPacket) room.receive(client, packet);
  }

  function admit(peer: PeerSocket, address: string): HostedPeer | null {
    const tooManyWaiting = isBusyFor(address);
    if (tooManyWaiting) {
      peer.close(SERVER_BUSY_CODE, 'server busy');
      return null;
    }
    const client: RoomClient = {
      peer,
      address,
      playerId: null,
      alive: true,
      wantsRestart: false,
      packetAllowance: PACKET_BURST,
      allowanceAt: clock.now(),
      joinDeadline: clock.after(options.joinDeadlineMs, () => peer.close(JOIN_TIMEOUT_CODE, 'no join')),
    };
    clients.add(client);
    room.greet(client);
    return {
      receive: (text, bytes) => receive(client, text, bytes),
      heard: () => {
        client.alive = true;
      },
      closed: () => room.disconnect(client),
    };
  }

  function shutdown(): void {
    room.shutdown();
    clock.cancel(heartbeat);
    for (const client of clients) {
      clock.cancel(client.joinDeadline);
      client.peer.drop();
    }
  }

  return { admit, shutdown };
}
