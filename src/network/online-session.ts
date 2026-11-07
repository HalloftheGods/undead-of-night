/**
 * Online rooms (hosting from this tab, joining a code over WebRTC). Loaded only when a player starts one,
 * so a solo or LAN player never downloads the room host or the RTC code.
 */
import type { GameStyle } from '../../shared/game-style.ts';
import { HostSession } from './host-session.ts';
import { PLAY_API } from './play-api.ts';
import { RemoteSession, type RoomSession } from './remote-session.ts';
import { RtcGuestPipe } from './rtc-pipe.ts';

/** WebRTC needs a signal round trip and ICE before the room can answer. */
const ONLINE_CONNECT_TIMEOUT_MS = 20_000;
const GUEST_WORDS = { badAddress: 'That room code does not look right.', noAnswer: 'Could not reach that game. Ask the host to check it is still open.', unreachable: 'Could not reach that game.' };

export interface HostEvents {
  onHosted(code: string): void;
  /** The game goes on, but nobody new can join. */
  onUnlisted(): void;
}

/** Hosts a room from this tab. */
export function hostRoom(style: GameStyle, events: HostEvents): RoomSession {
  const hosting = new HostSession(style);
  hosting.onHosted = events.onHosted;
  hosting.onUnlisted = events.onUnlisted;
  return hosting;
}

/** Joins the room with this (already normalized) code. */
export function joinRoom(code: string): RoomSession {
  return new RemoteSession(new RtcGuestPipe(PLAY_API, code), GUEST_WORDS, ONLINE_CONNECT_TIMEOUT_MS);
}
