/**
 * Co-op invite links: the page URL plus ?join=<server address> (a LAN host:port), or ?room=<code>
 * (a private room code). ?room is its own param: ?join accepts bare host labels, so a code
 * must never be read through it. When both are present ?room wins.
 */
import { normalizeRoomCode } from '../../shared/lobby/room-code.ts';

export const JOIN_PARAM = 'join';
export const ROOM_PARAM = 'room';

const MAX_ADDRESS_LENGTH = 260;
const SCHEME = /^(wss?):\/\//i;
const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const SHAPE = /^([^:/?#@\s]+)(?::(\d{1,5}))?$/;

/**
 * Accepts only [ws://|wss://]host[:port] and returns it normalised, or null.
 * Paths, queries, credentials, other schemes and odd characters are all refused:
 * the value comes from a link anyone can send, so it is never trusted as typed.
 */
export function sanitizeJoinAddress(raw: string | null | undefined): string | null {
  const isNotText = typeof raw !== 'string';
  if (isNotText) return null;
  const text = raw.trim();
  const isBadLength = !text || text.length > MAX_ADDRESS_LENGTH;
  if (isBadLength) return null;

  const scheme = SCHEME.exec(text)?.[1]?.toLowerCase() ?? null;
  const rest = scheme ? text.slice(scheme.length + 3) : text;
  const shape = SHAPE.exec(rest);
  if (!shape) return null;

  const host = shape[1]!.toLowerCase();
  const isBadHost = host.length > 253 || !host.split('.').every((label) => HOST_LABEL.test(label));
  if (isBadHost) return null;

  const port = shape[2];
  const hasPort = port !== undefined;
  if (hasPort) {
    const number = Number(port);
    const isBadPort = number < 1 || number > 65535;
    if (isBadPort) return null;
  }

  const address = port === undefined ? host : `${host}:${Number(port)}`;
  return scheme ? `${scheme}://${address}` : address;
}

/** Reads ?join= from a location search string (e.g. "?join=10.0.0.5:9000"). Null when absent or unsafe. */
export function parseJoinParam(search: string): string | null {
  return sanitizeJoinAddress(new URLSearchParams(search).get(JOIN_PARAM));
}

/** The page URL with ?join=<address>. Other params and any hash are dropped. Null when the address is unusable. */
export function buildInviteLink(pageHref: string, address: string): string | null {
  const clean = sanitizeJoinAddress(address);
  if (!clean) return null;
  let url: URL;
  try {
    url = new URL(pageHref);
  } catch {
    return null;
  }
  url.search = '';
  url.hash = '';
  url.searchParams.set(JOIN_PARAM, clean);
  return url.toString();
}

/** Reads ?room= from a location search string. Null when absent or not a valid room code. */
export function parseRoomParam(search: string): string | null {
  const check = normalizeRoomCode(new URLSearchParams(search).get(ROOM_PARAM));
  return check.ok ? check.code : null;
}

export type InviteTarget = { kind: 'room'; code: string } | { kind: 'join'; address: string };

/** What a link asks for: a room code if it has a valid one, else a LAN address, else nothing. */
export function parseInvite(search: string): InviteTarget | null {
  const code = parseRoomParam(search);
  if (code) return { kind: 'room', code };
  const address = parseJoinParam(search);
  return address ? { kind: 'join', address } : null;
}

/** The page URL with ?room=<code>. Other params and any hash are dropped. Null when the code or page is unusable. */
export function buildRoomLink(pageHref: string, rawCode: string): string | null {
  const check = normalizeRoomCode(rawCode);
  if (!check.ok) return null;
  let url: URL;
  try {
    url = new URL(pageHref);
  } catch {
    return null;
  }
  url.search = '';
  url.hash = '';
  url.searchParams.set(ROOM_PARAM, check.code);
  return url.toString();
}

/** The same page without ?join= or ?room=, so a refresh does not keep reopening the invite. */
export function withoutJoinParam(pageHref: string): string {
  const url = new URL(pageHref);
  url.searchParams.delete(JOIN_PARAM);
  url.searchParams.delete(ROOM_PARAM);
  return url.toString();
}
