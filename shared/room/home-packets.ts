// What a client may say about home, checked before it reaches the sim.

import type { HomeAction, JoinHome } from '../home-protocol.ts';
import { FINAL_LEVEL, FIRST_LEVEL } from '../levels.ts';
import { emptyLoadout, validateLoadout } from '../loadout.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isLevel = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= FIRST_LEVEL && value <= FINAL_LEVEL;

function parseEquip(value: Record<string, unknown>): HomeAction | null {
  const loadout = validateLoadout(value.loadout);
  return loadout ? { kind: 'equip', loadout } : null;
}

const parseReady = ({ ready }: Record<string, unknown>): HomeAction | null => (typeof ready === 'boolean' ? { kind: 'ready', ready } : null);

const ACTION_PARSERS: Readonly<Record<HomeAction['kind'], (value: Record<string, unknown>) => HomeAction | null>> = {
  pick_level: ({ level }) => (isLevel(level) ? { kind: 'pick_level', level } : null),
  equip: parseEquip,
  ready: parseReady,
  leave_station: () => ({ kind: 'leave_station' }),
  highest: ({ highest }) => (isLevel(highest) ? { kind: 'highest', highest } : null),
  jukebox: ({ track }) => (track === null || typeof track === 'string' ? { kind: 'jukebox', track } : null),
};

const isActionKind = (kind: unknown): kind is HomeAction['kind'] => typeof kind === 'string' && Object.hasOwn(ACTION_PARSERS, kind);

/** Null for anything that is not exactly a home action. Refused gear stays out, so it stays in the sender's locker. */
export function parseHome(value: unknown): HomeAction | null {
  if (!isRecord(value)) return null;
  return isActionKind(value.kind) ? ACTION_PARSERS[value.kind](value) : null;
}

/** Undefined for a client that brought nothing. Nobody is turned away: bad gear becomes none, and the van's free pistol covers that. */
export function parseJoinHome(value: unknown): JoinHome | undefined {
  if (!isRecord(value)) return undefined;
  const finished = value.finished === true ? { finished: true } : {};
  return { loadout: validateLoadout(value.loadout) ?? emptyLoadout(), highest: isLevel(value.highest) ? value.highest : FIRST_LEVEL, ...finished };
}
