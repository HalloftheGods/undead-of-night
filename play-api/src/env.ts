import type { Lobby } from './lobby.ts';
import type { Room } from './room.ts';

// What cloudflare.config.ts binds. Secrets are optional: without them TURN is off and rooms get STUN only.
export interface Env {
  readonly LOBBY: DurableObjectNamespace<Lobby>;
  readonly ROOM: DurableObjectNamespace<Room>;
  /** Comma-separated origins allowed to call the API and open sockets. */
  readonly ALLOWED_ORIGINS: string;
  /** "1" mints TURN credentials; anything else is the kill switch. */
  readonly TURN_ENABLED: string;
  readonly TURN_KEY_ID?: string;
  readonly TURN_KEY_API_TOKEN?: string;
}

/** The one Lobby object. */
export const lobbyOf = (env: Env): DurableObjectStub<Lobby> => env.LOBBY.getByName('global');

/** Headers the Worker sets on a socket upgrade it forwards to a Room DO. A client cannot set them: the Worker overwrites both. */
export const ROLE_HEADER = 'x-play-role';
export const IP_KEY_HEADER = 'x-play-ip-key';

export type SocketRole = 'host' | 'guest';

/** Event-name logs only: never an IP, a callsign or a room code. */
export function logEvent(event: string, reason?: string): void {
  // chemx-allow: UNGUARDED_LOGGING this is the Worker's one logger; Workers Logs read console output and nothing else
  console.log(reason ? `${event}:${reason}` : event);
}
