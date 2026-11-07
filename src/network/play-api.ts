// The browser's side of play-api (spec: Lobby HTTP API). Online rooms are live only in a build made with
// ZOMBIE_PLAY_API set, so a plain build has no online play and never calls out.
import type { CreateRoomRequest, CreateRoomResult } from '../../shared/lobby/lobby-http.ts';
import type { RoomCard } from '../../shared/lobby/types.ts';

declare const __ZOMBIE_PLAY_API__: string | undefined;

/** The API's origin, without a trailing slash, or '' when this build has none. */
export const PLAY_API: string = typeof __ZOMBIE_PLAY_API__ === 'string' ? __ZOMBIE_PLAY_API__.replace(/\/+$/, '') : '';

export const onlineRoomsLive = (api: string = PLAY_API): boolean => api !== '';

/** The socket URL for a path on the API: https becomes wss. */
export function socketUrl(api: string, path: string): string {
  const url = new URL(path, `${api}/`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export type Lookup = { ok: true; card: RoomCard } | { ok: false; reason: string };

const LOOKUP_TEXT: Readonly<Record<number, string>> = {
  400: 'That is not a room code.',
  404: 'No game has that code. Check the letters.',
  410: 'That game has ended.',
  429: 'Too many tries. Wait a moment and try again.',
};
const OFFLINE = 'Could not reach the online rooms. Check your connection.';

/** A call that takes longer than this counts as unreachable, so a stuck network never leaves the player waiting. */
export const API_TIMEOUT_MS = 10_000;

async function call(fetcher: typeof fetch, url: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetcher(url, { ...init, signal: AbortSignal.timeout(API_TIMEOUT_MS) });
  } catch {
    return null;
  }
}

/** The room card for a code, or what to tell the player. */
export async function lookupRoom(code: string, api: string = PLAY_API, fetcher: typeof fetch = fetch): Promise<Lookup> {
  const response = await call(fetcher, `${api}/v1/rooms/${encodeURIComponent(code)}`);
  if (!response) return { ok: false, reason: OFFLINE };
  if (response.ok) return { ok: true, card: (await response.json()) as RoomCard };
  return { ok: false, reason: LOOKUP_TEXT[response.status] ?? OFFLINE };
}

export type Created = { ok: true; room: CreateRoomResult } | { ok: false; reason: string };

/** A new private room with this tab as its host. */
export async function createRoom(request: CreateRoomRequest, api: string = PLAY_API, fetcher: typeof fetch = fetch): Promise<Created> {
  const response = await call(fetcher, `${api}/v1/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response) return { ok: false, reason: OFFLINE };
  const isRateLimited = response.status === 429;
  if (isRateLimited) return { ok: false, reason: 'You have opened too many games. Wait a while and try again.' };
  const busy = { ok: false, reason: 'The online rooms are busy. Try again in a moment.' } as const;
  if (!response.ok) return busy;
  try {
    return { ok: true, room: (await response.json()) as CreateRoomResult };
  } catch {
    return busy;
  }
}
