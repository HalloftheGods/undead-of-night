// The Room: one per code. It authenticates the host, relays SDP and ICE between the host and each guest,
// tracks the host's liveness and mints TURN credentials. Game packets never pass through it (option A).
// Every socket uses the hibernation API and the only timer is the alarm, so an idle room costs almost nothing.
import { DurableObject } from 'cloudflare:workers';
import { CLOSE, UPDATE_REASON } from '../../shared/close-codes.ts';
import {
  parseGuestSignal,
  parseHostSignal,
  type IceServer,
  type RoomReport,
  type ToGuestSignal,
  type ToHostSignal,
} from '../../shared/lobby/lobby-protocol.ts';
import { HOST_RECONNECT_GRACE_MS, hostGraceExpired, roomTooOld } from '../../shared/lobby/ttl.ts';
import type { Visibility } from '../../shared/lobby/types.ts';
import { IP_KEY_HEADER, lobbyOf, logEvent, ROLE_HEADER, type Env } from './env.ts';
import { closedSocket, echoable } from './http.ts';
import { sha256Hex } from './lobby.ts';
import { iceServersFor } from './turn.ts';

/** The host must send `auth` this soon after its socket opens. */
export const HOST_AUTH_MS = 5_000;
/** The liveness check, and the Lobby touch, run this often. */
export const LIVENESS_MS = 60_000;
/** A host socket with no ping or message for this long counts as dropped (it pings every 20 s). */
export const HOST_SILENT_MS = 75_000;
/** Each guest's signaling lasts at most this long and this many messages. */
export const GUEST_WINDOW_MS = 60_000;
export const GUEST_MAX_MESSAGES = 200;
/** Guests signaling at once. More than a room's seats, for retries, but not unbounded. */
export const MAX_SIGNALING_GUESTS = 8;
/** Listing updates reach the Lobby at most this often. */
export const REPORT_EVERY_MS = 1_000;

const POLICY = 1008;
const NORMAL = 1000;

/** What the Lobby hands a new Room. */
export interface RoomInit {
  readonly code: string;
  readonly hostKeyHash: string;
  readonly protocol: number;
  readonly visibility: Visibility;
  readonly maxSeats: number;
  readonly createdAt: number;
}

interface RoomMeta extends RoomInit {
  /** The host's last report; until the first one, the host alone in an open room. */
  report: RoomReport | null;
  /** Set while the host's signal socket is gone and it may still reconnect. */
  hostDroppedAt: number | null;
  reportSentAt: number;
  reportPending: boolean;
  touchedAt: number;
}

/** Kept on each socket, so it survives hibernation. Never holds an IP: ipKey is a salted HMAC. */
type Attachment =
  | { readonly role: 'host'; readonly openedAt: number; readonly ipKey: string; authed: boolean; heardAt: number }
  | { readonly role: 'guest'; readonly openedAt: number; readonly peerId: string; messages: number };

const send = (ws: WebSocket, message: ToHostSignal | ToGuestSignal): void => {
  try {
    ws.send(JSON.stringify(message));
  } catch {
    // chemx-allow: best-effort the socket is already closing; its close handler tidies up
  }
};

const shut = (ws: WebSocket, code: number, reason: string): void => {
  try {
    ws.close(code, reason);
  } catch {
    // chemx-allow: best-effort the socket is already closed
  }
};

function sameText(a: string, b: string): boolean {
  const isLengthDifferent = a.length !== b.length;
  if (isLengthDifferent) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export class Room extends DurableObject<Env> {
  private meta: RoomMeta | null | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // The host's 20 s keepalive is answered without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  /** Called once by the Lobby right after it lists the code. */
  async init(init: RoomInit): Promise<void> {
    // A host that never connects still lets the room end: the drop grace starts now.
    const meta: RoomMeta = { ...init, report: null, hostDroppedAt: init.createdAt, reportSentAt: 0, reportPending: false, touchedAt: init.createdAt };
    await this.save(meta);
    await this.wakeBy(init.createdAt + LIVENESS_MS);
  }

  override async fetch(request: Request): Promise<Response> {
    const meta = await this.load();
    if (!meta) return closedSocket(CLOSE.notFound, 'no such room');
    const ipKey = request.headers.get(IP_KEY_HEADER) ?? '';
    return request.headers.get(ROLE_HEADER) === 'host' ? this.openHost(ipKey) : this.openGuest(meta, request, ipKey);
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const meta = await this.load();
    if (!meta) return shut(ws, CLOSE.notFound, 'room ended');
    const isBinaryMessage = typeof message !== 'string';
    if (isBinaryMessage) return shut(ws, 1003, 'text only');
    const at = ws.deserializeAttachment() as Attachment;
    const isFromHost = at.role === 'host';
    if (isFromHost) return at.authed ? this.fromHost(meta, ws, at, message) : this.authHost(meta, ws, at, message);
    return this.fromGuest(ws, at, message);
  }

  override async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    shut(ws, echoable(code), 'bye');
    await this.socketGone(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.socketGone(ws);
  }

  override async alarm(): Promise<void> {
    const meta = await this.load();
    if (!meta) return;
    const now = Date.now();
    const isRoomExpired = roomTooOld(meta.createdAt, now);
    if (isRoomExpired) return this.end(meta, 'max_age');
    this.closeOverdue(now);
    const host = this.authedHost();
    const isHostSilent = host && now - this.lastHeard(host) >= HOST_SILENT_MS;
    if (isHostSilent) {
      shut(host, 1001, 'silent');
      await this.hostDropped(meta, now);
    }
    const isHostGone = !this.authedHost() && meta.hostDroppedAt !== null && hostGraceExpired(meta.hostDroppedAt, now);
    if (isHostGone) {
      return this.end(meta, 'host_gone');
    }
    const isReportDue = meta.reportPending && now - meta.reportSentAt >= REPORT_EVERY_MS;
    if (isReportDue) {
      const isUnlisted = !(await this.sendReport(meta, now));
      if (isUnlisted) return this.end(meta, 'unlisted');
    }
    const isLivenessDue = now - meta.touchedAt >= LIVENESS_MS;
    if (isLivenessDue) {
      meta.touchedAt = now;
      await this.save(meta);
      const listed = await lobbyOf(this.env).roomSeen(meta.code, this.authedHost() === null);
      if (!listed) return this.end(meta, 'unlisted');
    }
    await this.ctx.storage.setAlarm(this.nextWake(meta, now));
  }

  // ---- Opening sockets ----

  private openHost(ipKey: string): Response {
    const pair = new WebSocketPair();
    const now = Date.now();
    this.ctx.acceptWebSocket(pair[1], ['host']);
    pair[1].serializeAttachment({ role: 'host', openedAt: now, ipKey, authed: false, heardAt: now } satisfies Attachment);
    void this.wakeBy(now + HOST_AUTH_MS);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  private async openGuest(meta: RoomMeta, request: Request, ipKey: string): Promise<Response> {
    const refused = this.guestRefusal(meta, request);
    if (refused) {
      logEvent('join_refused', refused.reason || String(refused.code));
      return closedSocket(refused.code, refused.reason);
    }
    const isTurnRefused = !(await lobbyOf(this.env).allowTurn(ipKey));
    if (isTurnRefused) return closedSocket(CLOSE.rateLimited, 'rate limited');
    const iceServers = await this.iceServers();
    const pair = new WebSocketPair();
    const peerId = crypto.randomUUID();
    const now = Date.now();
    this.ctx.acceptWebSocket(pair[1], ['guest', `peer:${peerId}`]);
    pair[1].serializeAttachment({ role: 'guest', openedAt: now, peerId, messages: 0 } satisfies Attachment);
    send(pair[1], { type: 'admitted', peerId, iceServers, relayOnly: meta.visibility === 'public' });
    await this.wakeBy(now + GUEST_WINDOW_MS);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  /** Why a guest may not start signaling, judged from the host's last report. */
  private guestRefusal(meta: RoomMeta, request: Request): { code: number; reason: string } | null {
    const protocol = Number(new URL(request.url).searchParams.get('protocol'));
    const isProtocolMismatch = protocol !== meta.protocol;
    if (isProtocolMismatch) {
      return { code: CLOSE.needsUpdate, reason: protocol < meta.protocol ? UPDATE_REASON.guestOlder : UPDATE_REASON.hostOlder };
    }
    if (meta.report?.locked) return { code: CLOSE.locked, reason: 'locked' };
    const isRoomFull = (meta.report?.seats ?? 1) >= meta.maxSeats;
    if (isRoomFull) return { code: CLOSE.roomFull, reason: 'full' };
    const isHostAway = !this.authedHost();
    if (isHostAway) return { code: CLOSE.serverBusy, reason: 'host away' };
    const hasTooManyGuests = this.ctx.getWebSockets('guest').length >= MAX_SIGNALING_GUESTS;
    if (hasTooManyGuests) return { code: CLOSE.serverBusy, reason: 'busy' };
    return null;
  }

  // ---- Host ----

  private async authHost(meta: RoomMeta, ws: WebSocket, at: Extract<Attachment, { role: 'host' }>, text: string): Promise<void> {
    const signal = parseHostSignal(text);
    const now = Date.now();
    const isAuthTooLate = now - at.openedAt > HOST_AUTH_MS;
    if (isAuthTooLate) return shut(ws, POLICY, 'auth too late');
    // Anything else that races ahead of the auth answer (a report, say) is dropped; the deadline still holds.
    const isNotAuth = signal?.type !== 'auth';
    if (isNotAuth) return;
    const isWrongHostKey = !sameText(await sha256Hex(signal.hostKey), meta.hostKeyHash);
    if (isWrongHostKey) {
      logEvent('host_refused', 'bad_key');
      return shut(ws, POLICY, 'bad host key');
    }
    for (const other of this.ctx.getWebSockets('host')) {
      const isOtherHost = other !== ws;
      if (isOtherHost) shut(other, NORMAL, 'replaced');
    }
    const isTurnRefused = !(await lobbyOf(this.env).allowTurn(at.ipKey));
    if (isTurnRefused) return shut(ws, CLOSE.rateLimited, 'rate limited');
    ws.serializeAttachment({ ...at, authed: true, heardAt: now } satisfies Attachment);
    meta.hostDroppedAt = null;
    meta.touchedAt = now;
    await this.save(meta);
    await lobbyOf(this.env).roomSeen(meta.code, false);
    send(ws, { type: 'ready', iceServers: await this.iceServers(), relayOnly: meta.visibility === 'public' });
    logEvent('host_ready');
  }

  private async fromHost(meta: RoomMeta, ws: WebSocket, at: Extract<Attachment, { role: 'host' }>, text: string): Promise<void> {
    const now = Date.now();
    ws.serializeAttachment({ ...at, heardAt: now } satisfies Attachment);
    const signal = parseHostSignal(text);
    if (!signal) return;
    // A repeated auth from an authed host needs no answer, so it falls through every branch.
    const isAnswer = signal.type === 'answer';
    if (isAnswer) return this.toGuest(signal.peerId, { type: 'answer', sdp: signal.sdp });
    const isIce = signal.type === 'ice';
    if (isIce) return this.toGuest(signal.peerId, { type: 'ice', ice: signal.ice });
    const isReport = signal.type === 'report';
    if (isReport) return this.takeReport(meta, signal.report, now);
    const isEnd = signal.type === 'end';
    if (isEnd) return this.end(meta, 'host_ended');
  }

  /** The newest report waits to be sent at most once per REPORT_EVERY_MS. */
  private async takeReport(meta: RoomMeta, report: RoomReport, now: number): Promise<void> {
    meta.report = report;
    meta.reportPending = true;
    const isReportDue = now - meta.reportSentAt >= REPORT_EVERY_MS;
    if (isReportDue) {
      const isUnlisted = !(await this.sendReport(meta, now));
      if (isUnlisted) return this.end(meta, 'unlisted');
      return;
    }
    await this.save(meta);
    return this.wakeBy(meta.reportSentAt + REPORT_EVERY_MS);
  }

  private toGuest(peerId: string, message: ToGuestSignal): void {
    for (const guest of this.ctx.getWebSockets(`peer:${peerId}`)) send(guest, message);
  }

  private async sendReport(meta: RoomMeta, now: number): Promise<boolean> {
    meta.reportPending = false;
    meta.reportSentAt = now;
    meta.touchedAt = now;
    await this.save(meta);
    return meta.report ? lobbyOf(this.env).roomReport(meta.code, meta.report) : true;
  }

  private async hostDropped(meta: RoomMeta, now: number): Promise<void> {
    const isAlreadyTracked = this.authedHost() || meta.hostDroppedAt !== null;
    if (isAlreadyTracked) return;
    meta.hostDroppedAt = now;
    await this.save(meta);
    await lobbyOf(this.env).roomSeen(meta.code, true);
    await this.wakeBy(now + HOST_RECONNECT_GRACE_MS);
    logEvent('host_dropped');
  }

  // ---- Guests ----

  private fromGuest(ws: WebSocket, at: Extract<Attachment, { role: 'guest' }>, text: string): void {
    const messages = at.messages + 1;
    const isSignalingOver = messages > GUEST_MAX_MESSAGES || Date.now() - at.openedAt > GUEST_WINDOW_MS;
    if (isSignalingOver) return shut(ws, POLICY, 'signaling over');
    ws.serializeAttachment({ ...at, messages } satisfies Attachment);
    const signal = parseGuestSignal(text);
    const host = this.authedHost();
    const cannotRelay = !signal || !host;
    if (cannotRelay) return;
    const isOffer = signal.type === 'offer';
    if (isOffer) send(host, { type: 'offer', peerId: at.peerId, sdp: signal.sdp });
    else send(host, { type: 'ice', peerId: at.peerId, ice: signal.ice });
  }

  // ---- Closing ----

  private async socketGone(ws: WebSocket): Promise<void> {
    const at = ws.deserializeAttachment() as Attachment | null;
    const meta = await this.load();
    const isUnknownSocket = !at || !meta;
    if (isUnknownSocket) return;
    const isGuest = at.role === 'guest';
    if (isGuest) {
      const host = this.authedHost();
      if (host) send(host, { type: 'peer-left', peerId: at.peerId });
      return;
    }
    if (at.authed) await this.hostDropped(meta, Date.now());
  }

  /** Closes unauthenticated hosts past the auth deadline and guests past their window. */
  private closeOverdue(now: number): void {
    for (const ws of this.ctx.getWebSockets()) {
      const at = ws.deserializeAttachment() as Attachment | null;
      const isHostAuthOverdue = at?.role === 'host' && !at.authed && now - at.openedAt >= HOST_AUTH_MS;
      if (isHostAuthOverdue) shut(ws, POLICY, 'no auth');
      const isGuestWindowOver = at?.role === 'guest' && now - at.openedAt >= GUEST_WINDOW_MS;
      if (isGuestWindowOver) {
        shut(ws, NORMAL, 'signaling over');
        const host = this.authedHost();
        if (host) send(host, { type: 'peer-left', peerId: at.peerId });
      }
    }
  }

  /** The room is over: guests still signaling hear 4011, the Lobby tombstones the code, storage is wiped. */
  private async end(meta: RoomMeta, reason: string): Promise<void> {
    for (const guest of this.ctx.getWebSockets('guest')) shut(guest, CLOSE.hostLeft, 'host left');
    for (const host of this.ctx.getWebSockets('host')) shut(host, NORMAL, 'room ended');
    this.meta = null;
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    await lobbyOf(this.env).roomEnded(meta.code, reason);
  }

  // ---- Helpers ----

  private authedHost(): WebSocket | null {
    const authed = (ws: WebSocket): boolean => {
      const at = ws.deserializeAttachment() as Attachment | null;
      return at?.role === 'host' && at.authed;
    };
    return this.ctx.getWebSockets('host').find(authed) ?? null;
  }

  private lastHeard(host: WebSocket): number {
    const at = host.deserializeAttachment() as Extract<Attachment, { role: 'host' }>;
    const pinged = this.ctx.getWebSocketAutoResponseTimestamp(host)?.getTime() ?? 0;
    return Math.max(at.heardAt, pinged);
  }

  private nextWake(meta: RoomMeta, now: number): number {
    const times = [now + LIVENESS_MS];
    if (meta.reportPending) times.push(meta.reportSentAt + REPORT_EVERY_MS);
    const droppedAt = meta.hostDroppedAt;
    const isHostDropped = droppedAt !== null;
    if (isHostDropped) times.push(droppedAt + HOST_RECONNECT_GRACE_MS);
    for (const ws of this.ctx.getWebSockets()) {
      const at = ws.deserializeAttachment() as Attachment | null;
      const isGuest = at?.role === 'guest';
      if (isGuest) times.push(at.openedAt + GUEST_WINDOW_MS);
      const isUnauthedHost = at?.role === 'host' && !at.authed;
      if (isUnauthedHost) times.push(at.openedAt + HOST_AUTH_MS);
    }
    return Math.max(now + 1, Math.min(...times));
  }

  /** Moves the alarm earlier if `at` comes before it. */
  private async wakeBy(at: number): Promise<void> {
    const current = await this.ctx.storage.getAlarm();
    const isAlarmLater = current === null || current > at;
    if (isAlarmLater) await this.ctx.storage.setAlarm(at);
  }

  private async iceServers(): Promise<IceServer[]> {
    return iceServersFor(this.env);
  }

  private async load(): Promise<RoomMeta | null> {
    const cached = this.meta;
    const isMetaLoaded = cached !== undefined;
    if (isMetaLoaded) return cached;
    const loaded = (await this.ctx.storage.get<RoomMeta>('meta')) ?? null;
    this.meta = loaded;
    return loaded;
  }

  private async save(meta: RoomMeta): Promise<void> {
    this.meta = meta;
    await this.ctx.storage.put('meta', meta);
  }
}
