// The Lobby: one global SQLite-backed object. It owns codes, listings, matching, tombstones and the per-IP limits.
// DO input gates serialise its methods, and each decision below reads and writes SQL with no await in between,
// so two searchers who arrive together meet in one room instead of both hosting.
import { DurableObject } from 'cloudflare:workers';
import { CLOSE } from '../../shared/close-codes.ts';
import { MAX_PLAYERS } from '../../shared/constants.ts';
import { parseCreateRoom, parseMatchRequest, type CreateRoomRequest } from '../../shared/lobby/lobby-http.ts';
import type { RoomReport } from '../../shared/lobby/lobby-protocol.ts';
import { findOrCreate } from '../../shared/lobby/match.ts';
import { generateRoomCode, normalizeRoomCode } from '../../shared/lobby/room-code.ts';
import { isStale, isTombstoned, SWEEP_AFTER_MS, TOMBSTONE_MS } from '../../shared/lobby/ttl.ts';
import type { Continent, MatchResult, RoomCard, RoomListing } from '../../shared/lobby/types.ts';
import { logEvent, type Env, type SocketRole } from './env.ts';
import { refusal, reply, type Reply } from './http.ts';
import { ipKey, LOOKUP_MISS_COST, MAX_LIVE_ROOMS_PER_IP, newSalt, RateLimiter, saltDay } from './limits.ts';

/** Past this many open rooms the Lobby says busy instead of creating more. */
export const MAX_LIVE_ROOMS = 1000;
/** How many public rooms "See open teams" shows. */
export const LIST_LIMIT = 8;
const SWEEP_EVERY_MS = 60_000;
const HOST_KEY_BYTES = 32;

/** What the Worker gets back for a socket upgrade: forward it, or close it with a code. */
export type SocketGate = { readonly ok: true; readonly code: string; readonly ipKey: string } | { readonly ok: false; readonly close: number };

interface ListingRow {
  code: string;
  protocol: number;
  style: string;
  difficulty: string;
  visibility: string;
  device: string;
  continent: string;
  level: number;
  highest: number;
  seats: number;
  max_seats: number;
  taken: number;
  phase: string;
  locked: number;
  hidden: number;
  created_at: number;
  seen_at: number;
  host_label: string | null;
}

interface Listed {
  readonly listing: RoomListing;
  readonly hidden: boolean;
  readonly hostLabel: string | null;
}

function fromRow(row: ListingRow): Listed {
  const listing = {
    code: row.code,
    protocol: row.protocol,
    style: row.style,
    difficulty: row.difficulty,
    visibility: row.visibility,
    device: row.device,
    continent: row.continent,
    level: row.level,
    highest: row.highest,
    seats: row.seats,
    maxSeats: row.max_seats,
    taken: row.taken,
    phase: row.phase,
    locked: row.locked === 1,
    createdAt: row.created_at,
    seenAt: row.seen_at,
  } as RoomListing;
  return { listing, hidden: row.hidden === 1, hostLabel: row.host_label };
}

/** What a client may see: no continent, no timestamps, and a label only on a private room. */
export function toCard({ listing, hostLabel }: Listed): RoomCard {
  const card: RoomCard = {
    code: listing.code,
    protocol: listing.protocol,
    style: listing.style,
    difficulty: listing.difficulty,
    visibility: listing.visibility,
    level: listing.level,
    seats: listing.seats,
    maxSeats: listing.maxSeats,
    taken: listing.taken,
    phase: listing.phase,
    locked: listing.locked,
  };
  return listing.visibility === 'private' && hostLabel ? { ...card, hostLabel } : card;
}

function newHostKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(HOST_KEY_BYTES));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class Lobby extends DurableObject<Env> {
  private readonly sql: SqlStorage;
  private readonly limiter = new RateLimiter();
  /** ipKey to the codes it has open, in memory only: it resets with the salt. */
  private readonly liveByKey = new Map<string, Set<string>>();
  private salt: { day: number; key: CryptoKey } | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS listings (
      code TEXT PRIMARY KEY, protocol INTEGER NOT NULL, style TEXT NOT NULL, difficulty TEXT NOT NULL,
      visibility TEXT NOT NULL, device TEXT NOT NULL, continent TEXT NOT NULL, level INTEGER NOT NULL,
      highest INTEGER NOT NULL, seats INTEGER NOT NULL, max_seats INTEGER NOT NULL, taken INTEGER NOT NULL,
      phase TEXT NOT NULL, locked INTEGER NOT NULL, hidden INTEGER NOT NULL, created_at INTEGER NOT NULL,
      seen_at INTEGER NOT NULL, host_label TEXT)`);
    this.sql.exec('CREATE TABLE IF NOT EXISTS tombstones (code TEXT PRIMARY KEY, ended_at INTEGER NOT NULL)');
  }

  // ---- HTTP, through the Worker ----

  async createRoom(ip: string, continent: Continent, body: unknown): Promise<Reply> {
    const request = parseCreateRoom(body);
    if (!request) return refusal(400, 'bad room request');
    const key = await this.keyFor(ip);
    const opened = this.openRoom(key, continent, request, Date.now());
    if (!opened.ok) return refusal(opened.status, opened.error);
    const answer = await this.initRoom(opened.code, opened.hostKey, request, key);
    return answer ?? reply(201, { code: opened.code, hostKey: opened.hostKey });
  }

  async lookupRoom(ip: string, raw: string): Promise<Reply> {
    const check = normalizeRoomCode(raw);
    if (!check.ok) return refusal(400, check.reason);
    const key = await this.keyFor(ip);
    const now = Date.now();
    const isLookupLimited = !this.limiter.take(key, 'lookup', now);
    if (isLookupLimited) return refusal(429, 'rate limited');
    const found = this.listed(check.code);
    if (found) return reply(200, toCard(found));
    this.limiter.charge(key, 'lookup', now, LOOKUP_MISS_COST - 1);
    return this.tombstoned(check.code, now) ? refusal(410, 'That game has ended') : refusal(404, 'no such room');
  }

  async match(ip: string, continent: Continent, body: unknown): Promise<Reply> {
    const request = parseMatchRequest(body);
    if (!request) return refusal(400, 'bad match request');
    const key = await this.keyFor(ip);
    const now = Date.now();
    const isMatchLimited = !this.limiter.take(key, 'match', now);
    if (isMatchLimited) return refusal(429, 'rate limited');
    const rooms = this.rows('SELECT * FROM listings WHERE visibility = ? AND hidden = 0', 'public').map((each) => each.listing);
    const decision = findOrCreate(rooms, request, now, continent);
    const isJoiningRoom = decision.kind === 'join';
    if (isJoiningRoom) {
      const found = this.listed(decision.room.code);
      const result: MatchResult = { kind: 'join', code: decision.room.code, card: toCard(found as Listed) };
      return reply(200, result);
    }
    const create: CreateRoomRequest = {
      protocol: request.protocol,
      style: request.style,
      difficulty: request.difficulty,
      visibility: 'public',
      device: request.device ?? 'desktop',
    };
    const opened = this.openRoom(key, continent, create, now);
    if (!opened.ok) return reply(200, { kind: 'busy' } satisfies MatchResult);
    const failed = await this.initRoom(opened.code, opened.hostKey, create, key);
    if (failed) return reply(200, { kind: 'busy' } satisfies MatchResult);
    return reply(200, { kind: 'host', code: opened.code, hostKey: opened.hostKey } satisfies MatchResult);
  }

  /** Up to LIST_LIMIT public rooms someone could join now, youngest first. */
  listRooms(style: string | null, protocol: number | null): RoomCard[] {
    const now = Date.now();
    return this.rows('SELECT * FROM listings WHERE visibility = ? AND hidden = 0 AND locked = 0 ORDER BY created_at DESC', 'public')
      .filter(({ listing }) => !isStale(listing.seenAt, now) && listing.seats < listing.maxSeats)
      .filter(({ listing }) => (style === null || listing.style === style) && (protocol === null || listing.protocol === protocol))
      .slice(0, LIST_LIMIT)
      .map(toCard);
  }

  /** Rate limits and existence for a socket upgrade. The Room DO does the rest. */
  async admitSocket(ip: string, raw: string, role: SocketRole): Promise<SocketGate> {
    const check = normalizeRoomCode(raw);
    if (!check.ok) return { ok: false, close: CLOSE.notFound };
    const key = await this.keyFor(ip);
    const isConnectLimited = !this.limiter.take(key, 'connect', Date.now());
    if (isConnectLimited) {
      logEvent('socket_refused', 'rate_limited');
      return { ok: false, close: CLOSE.rateLimited };
    }
    const isUnlistedRoom = !this.listed(check.code);
    if (isUnlistedRoom) {
      logEvent('socket_refused', `${role}_no_room`);
      return { ok: false, close: CLOSE.notFound };
    }
    return { ok: true, code: check.code, ipKey: key };
  }

  // ---- RPC from Room DOs ----

  /** One TURN mint for this caller, if the hourly cap allows it. */
  allowTurn(key: string): boolean {
    const allowed = this.limiter.take(key, 'turn', Date.now());
    logEvent(allowed ? 'turn_minted' : 'turn_refused');
    return allowed;
  }

  /** The host's latest report. False when the room is no longer listed, which tells the Room to end. */
  roomReport(code: string, report: RoomReport): boolean {
    const cursor = this.sql.exec(
      'UPDATE listings SET seats = ?, taken = ?, level = ?, highest = ?, phase = ?, locked = ?, hidden = 0, seen_at = ? WHERE code = ?',
      report.seats,
      report.taken,
      report.level,
      report.highest,
      report.phase,
      report.locked ? 1 : 0,
      Date.now(),
      code,
    );
    return cursor.rowsWritten > 0;
  }

  /** The Room is alive. `hidden` while its host is away and may still come back. False when no longer listed. */
  roomSeen(code: string, hidden: boolean): boolean {
    const cursor = this.sql.exec('UPDATE listings SET hidden = ?, seen_at = ? WHERE code = ?', hidden ? 1 : 0, Date.now(), code);
    return cursor.rowsWritten > 0;
  }

  roomEnded(code: string, reason: string): void {
    this.endListing(code, Date.now());
    logEvent('room_end', reason);
  }

  // ---- Upkeep ----

  override async alarm(): Promise<void> {
    const now = Date.now();
    const stale = this.sql.exec<{ code: string }>('SELECT code FROM listings WHERE seen_at <= ?', now - SWEEP_AFTER_MS).toArray();
    for (const { code } of stale) this.endListing(code, now);
    if (stale.length) logEvent('rooms_swept', String(stale.length));
    this.sql.exec('DELETE FROM tombstones WHERE ended_at <= ?', now - TOMBSTONE_MS);
    this.limiter.sweep(now);
    const left = this.sql.exec<{ n: number }>('SELECT (SELECT COUNT(*) FROM listings) + (SELECT COUNT(*) FROM tombstones) AS n').one().n;
    const hasRowsLeft = left > 0;
    if (hasRowsLeft) await this.ctx.storage.setAlarm(now + SWEEP_EVERY_MS);
  }

  // ---- Inside ----

  /** Picks a free code and writes the listing, all without an await. */
  private openRoom(
    key: string,
    continent: Continent,
    request: CreateRoomRequest,
    now: number,
  ): { ok: true; code: string; hostKey: string } | { ok: false; status: number; error: string } {
    const mine = this.liveByKey.get(key) ?? new Set<string>();
    const hasTooManyRooms = mine.size >= MAX_LIVE_ROOMS_PER_IP;
    if (hasTooManyRooms) return { ok: false, status: 429, error: 'too many open rooms' };
    const total = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM listings').one().n;
    const isLobbyFull = total >= MAX_LIVE_ROOMS;
    if (isLobbyFull) return { ok: false, status: 503, error: 'busy' };
    const isCreateLimited = !this.limiter.take(key, 'create', now);
    if (isCreateLimited) return { ok: false, status: 429, error: 'rate limited' };
    const code = this.freeCode(now);
    this.sql.exec(
      `INSERT INTO listings (code, protocol, style, difficulty, visibility, device, continent, level, highest, seats,
        max_seats, taken, phase, locked, hidden, created_at, seen_at, host_label)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 1, ?, 0, ?, 0, 0, ?, ?, ?)`,
      code,
      request.protocol,
      request.style,
      request.difficulty,
      request.visibility,
      request.device,
      continent,
      MAX_PLAYERS,
      request.style === 'arcade' ? 'muster' : 'playing',
      now,
      now,
      request.label ?? null,
    );
    mine.add(code);
    this.liveByKey.set(key, mine);
    void this.ensureSweep(now);
    return { ok: true, code, hostKey: newHostKey() };
  }

  /** Hands the Room DO its host key's hash. Undefined when it worked; a refusal (and no listing) when it did not. */
  private async initRoom(code: string, hostKey: string, request: CreateRoomRequest, key: string): Promise<Reply | undefined> {
    try {
      const room = this.env.ROOM.getByName(code);
      await room.init({
        code,
        hostKeyHash: await sha256Hex(hostKey),
        protocol: request.protocol,
        visibility: request.visibility,
        maxSeats: MAX_PLAYERS,
        createdAt: Date.now(),
      });
      logEvent('room_created', request.visibility);
      return undefined;
    } catch {
      this.sql.exec('DELETE FROM listings WHERE code = ?', code);
      this.liveByKey.get(key)?.delete(code);
      logEvent('room_create_failed');
      return refusal(503, 'busy');
    }
  }

  private freeCode(now: number): string {
    for (;;) {
      const code = generateRoomCode();
      const isCodeFree = !this.listed(code) && !this.tombstoned(code, now);
      if (isCodeFree) return code;
    }
  }

  private endListing(code: string, now: number): void {
    this.sql.exec('DELETE FROM listings WHERE code = ?', code);
    this.sql.exec('INSERT OR REPLACE INTO tombstones (code, ended_at) VALUES (?, ?)', code, now);
    for (const codes of this.liveByKey.values()) codes.delete(code);
  }

  private listed(code: string): Listed | null {
    return this.rows('SELECT * FROM listings WHERE code = ?', code)[0] ?? null;
  }

  private tombstoned(code: string, now: number): boolean {
    const row = this.sql.exec<{ ended_at: number }>('SELECT ended_at FROM tombstones WHERE code = ?', code).toArray()[0];
    return row !== undefined && isTombstoned(row.ended_at, now);
  }

  private rows(query: string, ...bindings: unknown[]): Listed[] {
    return this.sql
      .exec<Record<string, SqlStorageValue>>(query, ...bindings)
      .toArray()
      .map((row) => fromRow(row as unknown as ListingRow));
  }

  private async ensureSweep(now: number): Promise<void> {
    const hasNoSweep = (await this.ctx.storage.getAlarm()) === null;
    if (hasNoSweep) await this.ctx.storage.setAlarm(now + SWEEP_EVERY_MS);
  }

  /** The caller's ipKey under today's salt. A new day drops yesterday's limits along with the salt. */
  private async keyFor(ip: string): Promise<string> {
    const day = saltDay(Date.now());
    const current = this.salt;
    const isSaltFresh = current?.day === day;
    if (isSaltFresh) return ipKey(current.key, ip);
    const salt = { day, key: await newSalt() };
    this.salt = salt;
    this.limiter.clear();
    this.liveByKey.clear();
    return ipKey(salt.key, ip);
  }
}
