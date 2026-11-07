// The Worker in front of the Lobby and the Room DOs: routes, CORS for the Pages origin, the Origin check on every
// socket upgrade, and the hand-off of per-IP limits to the Lobby. It never parses game packets.
import type { Continent } from '../../shared/lobby/types.ts';
import { allowedOrigins, corsHeaders, preflight } from './cors.ts';
import { IP_KEY_HEADER, lobbyOf, logEvent, ROLE_HEADER, type Env, type SocketRole } from './env.ts';
import { closedSocket, readJson, refusal, toResponse } from './http.ts';
import { Lobby } from './lobby.ts';
import { Room } from './room.ts';

export { Lobby, Room };

/** "See open teams" is polled every 10 s by every open list; 2 s at the edge keeps most of it off the Lobby. */
const LIST_CACHE_S = 2;
const CONTINENTS: readonly Continent[] = ['AF', 'AN', 'AS', 'EU', 'NA', 'OC', 'SA'];
const ROOM_PATH = /^\/v1\/rooms\/([^/]+)$/;
const SOCKET_PATH = /^\/v1\/rooms\/([^/]+)\/(host|guest)$/;

const clientIp = (request: Request): string => request.headers.get('CF-Connecting-IP') ?? 'unknown';

function continentOf(request: Request): Continent {
  const continent = (request.cf as { continent?: unknown } | undefined)?.continent;
  return CONTINENTS.includes(continent as Continent) ? (continent as Continent) : 'unknown';
}

async function openSocket(request: Request, env: Env, code: string, role: SocketRole, origins: ReadonlySet<string>): Promise<Response> {
  const isNotUpgrade = request.headers.get('Upgrade')?.toLowerCase() !== 'websocket';
  if (isNotUpgrade) return new Response('Expected a WebSocket upgrade', { status: 426 });
  // Browsers do not apply CORS to upgrades; this only filters nuisance traffic, since non-browsers can forge it.
  const origin = request.headers.get('Origin');
  const isForeignOrigin = !origin || !origins.has(origin);
  if (isForeignOrigin) {
    logEvent('socket_refused', 'origin');
    return new Response('Forbidden', { status: 403 });
  }
  const gate = await lobbyOf(env).admitSocket(clientIp(request), code, role);
  if (!gate.ok) return closedSocket(gate.close);
  const headers = new Headers(request.headers);
  headers.set(ROLE_HEADER, role);
  headers.set(IP_KEY_HEADER, gate.ipKey);
  return env.ROOM.getByName(gate.code).fetch(new Request(request, { headers }));
}

async function listRooms(request: Request, env: Env, cors: Record<string, string>, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const cacheKey = new Request(`${url.origin}/v1/rooms?style=${url.searchParams.get('style') ?? ''}&protocol=${url.searchParams.get('protocol') ?? ''}`);
  const cache = (caches as unknown as { default: Cache }).default;
  const cached = await cache.match(cacheKey);
  const fresh = cached ?? null;
  const body = fresh
    ? await fresh.text()
    : JSON.stringify(
        await lobbyOf(env).listRooms(url.searchParams.get('style'), url.searchParams.has('protocol') ? Number(url.searchParams.get('protocol')) : null),
      );
  if (!fresh) {
    const stored = new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${LIST_CACHE_S}` } });
    ctx.waitUntil(cache.put(cacheKey, stored));
  }
  return new Response(body, { headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${LIST_CACHE_S}` } });
}

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const origins = allowedOrigins(env);
  const cors = corsHeaders(request.headers.get('Origin'), origins);
  const { pathname } = url;
  const method = request.method;

  const isHealthCheck = pathname === '/health';
  if (isHealthCheck) return Response.json({ ok: true, service: 'undead-play-api' }, { headers: cors });
  if (!pathname.startsWith('/v1/')) return new Response('Not found', { status: 404 });
  const isPreflight = method === 'OPTIONS';
  if (isPreflight) return preflight(request, origins);

  const socket = SOCKET_PATH.exec(pathname);
  if (socket) return openSocket(request, env, decodeURIComponent(socket[1]), socket[2] as SocketRole, origins);

  const lobby = lobbyOf(env);
  const isCreateRoom = pathname === '/v1/rooms' && method === 'POST';
  if (isCreateRoom) {
    return toResponse(await lobby.createRoom(clientIp(request), continentOf(request), await readJson(request)), cors);
  }
  const isListRooms = pathname === '/v1/rooms' && method === 'GET';
  if (isListRooms) return listRooms(request, env, cors, ctx);
  const isMatchRequest = pathname === '/v1/match' && method === 'POST';
  if (isMatchRequest) {
    return toResponse(await lobby.match(clientIp(request), continentOf(request), await readJson(request)), cors);
  }
  const room = ROOM_PATH.exec(pathname);
  const isRoomLookup = room && method === 'GET';
  if (isRoomLookup) return toResponse(await lobby.lookupRoom(clientIp(request), decodeURIComponent(room[1])), cors);
  const known = pathname === '/v1/rooms' || pathname === '/v1/match' || room !== null;
  return toResponse(known ? refusal(405, 'method not allowed') : refusal(404, 'not found'), cors);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await route(request, env, ctx);
    } catch (error) {
      logEvent('worker_error', error instanceof Error ? error.name : 'unknown');
      return Response.json({ error: 'internal error' }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
