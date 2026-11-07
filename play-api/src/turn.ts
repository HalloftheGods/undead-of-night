// ICE servers for a room socket. TURN credentials are minted only after the Room DO has
// authenticated a host or admitted a guest, and never over plain HTTP.
import type { IceServer } from '../../shared/lobby/lobby-protocol.ts';

/** The part of Env that TURN reads. */
export interface TurnEnv {
  readonly TURN_ENABLED: string;
  readonly TURN_KEY_ID?: string;
  readonly TURN_KEY_API_TOKEN?: string;
}

export const STUN_SERVER: IceServer = { urls: 'stun:stun.cloudflare.com:3478' };
/** Six hours. A room lives up to 12 h, so a long session re-mints when its signal socket reconnects. */
export const TURN_TTL_S = 6 * 60 * 60;

const turnUrl = (keyId: string): string =>
  `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`;

/** Port 53 URLs are dropped: browsers block them and they only slow ICE down. ":5349" is kept. */
const usesPort53 = (url: string): boolean => /:53(?=$|[/?])/.test(url);

export function dropPort53(servers: readonly IceServer[]): IceServer[] {
  return servers.flatMap((server) => {
    const urls = (typeof server.urls === 'string' ? [server.urls] : [...server.urls]).filter((url) => !usesPort53(url));
    return urls.length ? [{ ...server, urls }] : [];
  });
}

export const turnConfigured = (env: TurnEnv): boolean => env.TURN_ENABLED === '1' && !!env.TURN_KEY_ID && !!env.TURN_KEY_API_TOKEN;

/** The API answers `iceServers` as one server or a list; absent means none. */
function asServerList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  return raw ? [raw] : [];
}

function readServers(data: unknown): IceServer[] {
  const raw = (data as { iceServers?: unknown } | null)?.iceServers;
  const list = asServerList(raw);
  return list.filter((each): each is IceServer => typeof each === 'object' && each !== null && 'urls' in each);
}

/** STUN plus Cloudflare TURN when it is on and minting works; STUN alone otherwise. */
export async function iceServersFor(env: TurnEnv, fetcher: typeof fetch = fetch): Promise<IceServer[]> {
  const isTurnOff = !turnConfigured(env);
  if (isTurnOff) return [STUN_SERVER];
  try {
    const response = await fetcher(turnUrl(env.TURN_KEY_ID as string), {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: TURN_TTL_S }),
    });
    if (!response.ok) return [STUN_SERVER];
    const minted = dropPort53(readServers(await response.json()));
    return minted.length ? minted : [STUN_SERVER];
  } catch {
    return [STUN_SERVER];
  }
}
