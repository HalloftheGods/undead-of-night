// Signaling between a host or guest tab and its Room DO. The DO relays SDP and ICE and never sees game packets.
// Every message is JSON text of at most SIGNAL_MAX_BYTES; the guards return null for anything else.
import { CHARACTERS } from '../characters.ts';

export const SIGNAL_MAX_BYTES = 16 * 1024;
const PEER_ID_MAX = 64;
const SDP_MAX = 12 * 1024;
const CANDIDATE_MAX = 2048;
const HOST_KEY_MAX = 128;
const END_REASON_MAX = 64;
/** `taken` has one bit per survivor, so the largest honest value has every one set. */
const ALL_SURVIVORS_TAKEN = (1 << CHARACTERS.length) - 1;

/** The ICE candidate a browser hands over (RTCIceCandidateInit, trimmed to what the relay needs). */
export interface IceCandidate {
  readonly candidate: string;
  readonly sdpMid?: string | null;
  readonly sdpMLineIndex?: number | null;
}

/** What the host last reported about the room, for the listing. */
export interface RoomReport {
  readonly seats: number;
  readonly taken: number;
  readonly level: number;
  readonly highest: number;
  readonly phase: 'muster' | 'playing' | 'over';
  readonly locked: boolean;
}

export type HostSignal =
  | { readonly type: 'auth'; readonly hostKey: string }
  | { readonly type: 'answer'; readonly peerId: string; readonly sdp: string }
  | { readonly type: 'ice'; readonly peerId: string; readonly ice: IceCandidate }
  | { readonly type: 'report'; readonly report: RoomReport }
  | { readonly type: 'end'; readonly reason?: string };

export type GuestSignal =
  | { readonly type: 'offer'; readonly sdp: string }
  | { readonly type: 'ice'; readonly ice: IceCandidate };

/** One entry of RTCConfiguration.iceServers, as the Room DO hands it out. */
export interface IceServer {
  readonly urls: string | readonly string[];
  readonly username?: string;
  readonly credential?: string;
}

/**
 * DO to host. `ready` answers a good `auth` with the ICE servers to use; `relayOnly` means
 * iceTransportPolicy 'relay' (public rooms). `peer-left` tells the host to drop a connection
 * whose channel has not opened yet: a guest also closes its signal socket once the channel is up.
 */
export type ToHostSignal =
  | { readonly type: 'ready'; readonly iceServers: readonly IceServer[]; readonly relayOnly: boolean }
  | { readonly type: 'offer'; readonly peerId: string; readonly sdp: string }
  | { readonly type: 'ice'; readonly peerId: string; readonly ice: IceCandidate }
  | { readonly type: 'peer-left'; readonly peerId: string };

/** DO to guest. `admitted` is the first message on an admitted guest's socket. */
export type ToGuestSignal =
  | { readonly type: 'admitted'; readonly peerId: string; readonly iceServers: readonly IceServer[]; readonly relayOnly: boolean }
  | { readonly type: 'answer'; readonly sdp: string }
  | { readonly type: 'ice'; readonly ice: IceCandidate }
  | { readonly type: 'peer-left' };

type Raw = Record<string, unknown>;

const isRaw = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max;
const isCount = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;

/** JSON.parse that refuses oversize text and anything that is not an object. */
export function parseSignalText(text: unknown): Raw | null {
  const isUnreadableText = typeof text !== 'string' || new TextEncoder().encode(text).length > SIGNAL_MAX_BYTES;
  if (isUnreadableText) return null;
  try {
    const value: unknown = JSON.parse(text);
    return isRaw(value) ? value : null;
  } catch {
    return null;
  }
}

export function parseIce(value: unknown): IceCandidate | null {
  if (!isRaw(value)) return null;
  const { candidate, sdpMid, sdpMLineIndex } = value;
  if (!isText(candidate, CANDIDATE_MAX)) return null;
  const midOk = sdpMid === undefined || sdpMid === null || isText(sdpMid, 64);
  const indexOk = sdpMLineIndex === undefined || sdpMLineIndex === null || isCount(sdpMLineIndex, 255);
  const isBadPlacement = !midOk || !indexOk;
  if (isBadPlacement) return null;
  return { candidate, sdpMid: sdpMid as string | null | undefined, sdpMLineIndex: sdpMLineIndex as number | null | undefined };
}

export function parseReport(value: unknown): RoomReport | null {
  if (!isRaw(value)) return null;
  const { seats, taken, level, highest, phase, locked } = value;
  const phaseOk = phase === 'muster' || phase === 'playing' || phase === 'over';
  const shapeOk = isCount(seats, 4) && isCount(taken, ALL_SURVIVORS_TAKEN) && isCount(level, 99) && isCount(highest, 99);
  const isBadRoomInfo = !phaseOk || !shapeOk || typeof locked !== 'boolean';
  if (isBadRoomInfo) return null;
  return { seats, taken, level, highest, phase, locked };
}

export function parseHostSignal(text: unknown): HostSignal | null {
  const m = parseSignalText(text);
  if (!m) return null;
  switch (m.type) {
    case 'auth':
      return isText(m.hostKey, HOST_KEY_MAX) ? { type: 'auth', hostKey: m.hostKey } : null;
    case 'answer':
      return isText(m.peerId, PEER_ID_MAX) && isText(m.sdp, SDP_MAX) ? { type: 'answer', peerId: m.peerId, sdp: m.sdp } : null;
    case 'ice': {
      const ice = parseIce(m.ice);
      return isText(m.peerId, PEER_ID_MAX) && ice ? { type: 'ice', peerId: m.peerId, ice } : null;
    }
    case 'report': {
      const report = parseReport(m.report);
      return report ? { type: 'report', report } : null;
    }
    case 'end': {
      const hasNoReason = m.reason === undefined;
      if (hasNoReason) return { type: 'end' };
      return isText(m.reason, END_REASON_MAX) ? { type: 'end', reason: m.reason } : null;
    }
    default:
      return null;
  }
}

export function parseGuestSignal(text: unknown): GuestSignal | null {
  const m = parseSignalText(text);
  if (!m) return null;
  const isOffer = m.type === 'offer';
  if (isOffer) return isText(m.sdp, SDP_MAX) ? { type: 'offer', sdp: m.sdp } : null;
  const isIce = m.type === 'ice';
  if (isIce) {
    const ice = parseIce(m.ice);
    return ice ? { type: 'ice', ice } : null;
  }
  return null;
}

const ICE_SERVERS_MAX = 8;
const ICE_URLS_MAX = 8;
const ICE_URL_MAX = 256;
const ICE_SECRET_MAX = 512;

function parseIceServer(value: unknown): IceServer | null {
  if (!isRaw(value)) return null;
  const { urls, username, credential } = value;
  const listOk = Array.isArray(urls) && urls.length > 0 && urls.length <= ICE_URLS_MAX && urls.every((url) => isText(url, ICE_URL_MAX));
  const isBadUrls = !isText(urls, ICE_URL_MAX) && !listOk;
  if (isBadUrls) return null;
  const isBadUsername = username !== undefined && !isText(username, ICE_SECRET_MAX);
  if (isBadUsername) return null;
  const isBadCredential = credential !== undefined && !isText(credential, ICE_SECRET_MAX);
  if (isBadCredential) return null;
  return {
    urls: urls as string | string[],
    ...(username === undefined ? {} : { username: username as string }),
    ...(credential === undefined ? {} : { credential: credential as string }),
  };
}

/** A non-empty list of at most ICE_SERVERS_MAX good entries, or null. */
export function parseIceServers(value: unknown): IceServer[] | null {
  const isBadServerList = !Array.isArray(value) || value.length === 0 || value.length > ICE_SERVERS_MAX;
  if (isBadServerList) return null;
  const servers = value.map(parseIceServer);
  return servers.every((server): server is IceServer => server !== null) ? servers : null;
}

/** The DO's side: what the host or guest receives. */
export function parseToHostSignal(text: unknown): ToHostSignal | null {
  const m = parseSignalText(text);
  const isReadySignal = m?.type === 'ready';
  if (isReadySignal) {
    const iceServers = parseIceServers(m.iceServers);
    return iceServers && typeof m.relayOnly === 'boolean' ? { type: 'ready', iceServers, relayOnly: m.relayOnly } : null;
  }
  if (!m) return null;
  const { peerId } = m;
  if (!isText(peerId, PEER_ID_MAX)) return null;
  const isPeerLeft = m.type === 'peer-left';
  if (isPeerLeft) return { type: 'peer-left', peerId };
  const isOffer = m.type === 'offer';
  if (isOffer) return isText(m.sdp, SDP_MAX) ? { type: 'offer', peerId, sdp: m.sdp } : null;
  const ice = m.type === 'ice' ? parseIce(m.ice) : null;
  return ice ? { type: 'ice', peerId, ice } : null;
}

export function parseToGuestSignal(text: unknown): ToGuestSignal | null {
  const m = parseSignalText(text);
  if (!m) return null;
  const isPeerLeft = m.type === 'peer-left';
  if (isPeerLeft) return { type: 'peer-left' };
  const isAdmitted = m.type === 'admitted';
  if (isAdmitted) {
    const iceServers = parseIceServers(m.iceServers);
    const shapeOk = isText(m.peerId, PEER_ID_MAX) && iceServers && typeof m.relayOnly === 'boolean';
    return shapeOk ? { type: 'admitted', peerId: m.peerId as string, iceServers, relayOnly: m.relayOnly as boolean } : null;
  }
  const isAnswer = m.type === 'answer';
  if (isAnswer) return isText(m.sdp, SDP_MAX) ? { type: 'answer', sdp: m.sdp } : null;
  const ice = m.type === 'ice' ? parseIce(m.ice) : null;
  return ice ? { type: 'ice', ice } : null;
}
