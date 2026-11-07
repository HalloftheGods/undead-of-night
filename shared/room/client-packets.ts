import { isKeepsakeId } from '../keepsakes.ts';
import { cleanCallsign } from '../callsign.ts';
import { isCharacterIndex } from '../characters.ts';
import { JOIN_TOKEN_MAX_LENGTH } from '../constants.ts';
import { isDifficultyId } from '../difficulty.ts';
import { isEmoteId } from '../emotes.ts';
import { isGameStyle } from '../game-style.ts';
import { WEAPON_ORDER } from '../protocol.ts';
import type { ClientInputPacket, ClientPacket, WeaponId } from '../protocol.ts';
import { isBenchAction } from '../workbench.ts';
import { parseHome, parseJoinHome } from './home-packets.ts';

const DEFAULT_NAME = 'Survivor';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isWeaponRequest = (value: unknown): value is WeaponId | null =>
  value === null || WEAPON_ORDER.includes(value as WeaponId);

const isJoinToken = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= JOIN_TOKEN_MAX_LENGTH;

const isCoordinate = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Both or neither: an input with no crosshair is fine, half of one is not a real client. */
function parseAim(aimX: unknown, aimY: unknown): { aimX?: number; aimY?: number } | null {
  const hasNoAim = aimX === undefined && aimY === undefined;
  if (hasNoAim) return {};
  return isCoordinate(aimX) && isCoordinate(aimY) ? { aimX, aimY } : null;
}

function parseInput(value: unknown): ClientInputPacket | null {
  if (!isRecord(value)) return null;
  const { seq, up, down, left, right, angle, aimX, aimY, touch, shoot, reload, weapon, melee, heal, search, sneak, sprint, throw: toss, molotov, flare, eat, keepsake } = value;
  const numbersValid = typeof seq === 'number' && Number.isFinite(seq) && seq >= 0 && typeof angle === 'number' && Number.isFinite(angle);
  const flags = [up, down, left, right, shoot, reload, melee, heal, search];
  const aim = parseAim(aimX, aimY);
  const optionalFlags = [touch, sneak, sprint, toss, molotov, flare, eat];
  const optionalValid = optionalFlags.every((flag) => flag === undefined || typeof flag === 'boolean');
  const isMalformedInput = !numbersValid || !aim || !optionalValid || !flags.every((flag) => typeof flag === 'boolean') || !isWeaponRequest(weapon);
  if (isMalformedInput) return null;
  return {
    seq,
    angle,
    ...aim,
    ...(touch === true ? { touch } : {}),
    ...(sneak === true ? { sneak } : {}),
    ...(sprint === true ? { sprint } : {}),
    ...(toss === true ? { throw: true } : {}),
    ...(molotov === true ? { molotov: true } : {}),
    ...(flare === true ? { flare: true } : {}),
    ...(eat === true ? { eat: true } : {}),
    ...(isKeepsakeId(keepsake) ? { keepsake } : {}),
    weapon,
    up: up as boolean,
    down: down as boolean,
    left: left as boolean,
    right: right as boolean,
    shoot: shoot as boolean,
    reload: reload as boolean,
    melee: melee as boolean,
    heal: heal as boolean,
    search: search as boolean,
  };
}

/** The callsign filter (shared/callsign.ts), falling back to a generic label. */
export function sanitiseName(value: string): string {
  return cleanCallsign(value) || DEFAULT_NAME;
}

/** Null for anything that is not exactly a valid client packet. */
export function parseClientPacket(raw: string): ClientPacket | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;

  const isJoin = value.type === 'join';
  if (isJoin) {
    const { name, token, character, difficulty, style } = value;
    const validCharacter = character === undefined || isCharacterIndex(character);
    const valid = typeof name === 'string' && isJoinToken(token) && validCharacter;
    // An older client sends none, and an unknown one is not worth turning a player away for.
    const chosen = isDifficultyId(difficulty) ? { difficulty } : {};
    const styled = isGameStyle(style) ? { style } : {};
    const home = parseJoinHome(value.home);
    // Left off by an older client; a bad one is not a client of ours.
    const { protocol } = value;
    const versioned = protocol === undefined || (typeof protocol === 'number' && Number.isInteger(protocol) && protocol >= 0);
    const version = typeof protocol === 'number' ? { protocol } : {};
    return valid && versioned ? { type: 'join', name: cleanCallsign(name), token, character, ...chosen, ...styled, ...version, ...(home ? { home } : {}) } : null;
  }
  const isInput = value.type === 'input';
  if (isInput) {
    const input = parseInput(value.input);
    return input ? { type: 'input', input } : null;
  }
  const isBench = value.type === 'bench';
  if (isBench) return isBenchAction(value.action) ? { type: 'bench', action: value.action } : null;
  const emote = value.type === 'emote' && isEmoteId(value.emote) ? value.emote : null;
  if (emote) return { type: 'emote', emote };
  const homeAction = value.type === 'home' ? parseHome(value.action) : null;
  if (homeAction) return { type: 'home', action: homeAction };
  return value.type === 'restart' ? { type: 'restart' } : null;
}
