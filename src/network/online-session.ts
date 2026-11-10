/**
 * Online rooms (hosting from this tab, joining a code over WebRTC). Loaded only when a player starts one,
 * so a solo or LAN player never downloads the room host or the RTC code.
 */
import type { GameSimulation } from '../../shared/simulation.ts';
import type { GameStyle } from '../../shared/game-style.ts';
import { HostSession } from './host-session.ts';
import { PLAY_API } from './play-api.ts';
import { RemoteSession, type RoomSession } from './remote-session.ts';
import { RtcGuestPipe } from './rtc-pipe.ts';

/** WebRTC needs a signal round trip and ICE before the room can answer. */
const ONLINE_CONNECT_TIMEOUT_MS = 20_000;
const GUEST_WORDS = { badAddress: 'That room code does not look right.', noAnswer: 'Could not reach that game. Ask the host to check it is still open.', unreachable: 'Could not reach that game.' };

export interface HostEvents {
  /** The room's code, and whether anyone may be matched into it. */
  onHosted(code: string, isPublic: boolean): void;
  /** The game goes on, but nobody new can join. */
  onUnlisted(): void;
}

import type { DifficultyId } from '../../shared/difficulty.ts';

/** How a hosted room is open: private (friends with the code), or public, made here or handed over by Find a team. */
export type HostOpening =
  | { readonly public: false; readonly existingSim?: GameSimulation; readonly initialTown?: { seed: number; level: number; difficulty: DifficultyId } }
  | { readonly public: true; readonly preset?: { code: string; hostKey: string }; readonly existingSim?: GameSimulation; readonly initialTown?: { seed: number; level: number; difficulty: DifficultyId } };

export { hostDevice } from './host-session.ts';

/** Hosts a room from this tab. */
export function hostRoom(style: GameStyle, events: HostEvents, opening: HostOpening = { public: false }): RoomSession {
  const hosting = new HostSession(style, undefined, undefined, undefined, opening.existingSim, opening.initialTown);
  if (opening.public) hosting.openToAnyone(opening.preset);
  hosting.onHosted = (code) => events.onHosted(code, hosting.isPublic);
  hosting.onUnlisted = events.onUnlisted;
  return hosting;
}

/** Joins the room with this (already normalized) code. A public room it was matched into sends and shows no callsigns. */
export function joinRoom(code: string, isPublic = false): RoomSession {
  return new RemoteSession(new RtcGuestPipe(PLAY_API, code), GUEST_WORDS, ONLINE_CONNECT_TIMEOUT_MS, isPublic);
}
