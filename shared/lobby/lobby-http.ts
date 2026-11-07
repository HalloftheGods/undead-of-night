// The JSON bodies of the Lobby's HTTP API (/v1), and their runtime guards. The Worker and the browser both import them.
import { cleanCallsign } from '../callsign.ts';
import { isCharacterIndex } from '../characters.ts';
import { isDifficultyId, type DifficultyId } from '../difficulty.ts';
import { isGameStyle, type GameStyle } from '../game-style.ts';
import { normalizeRoomCode } from './room-code.ts';
import { MAX_AVOID, type HostDevice, type MatchRequest, type Visibility } from './types.ts';

/** A request body larger than this is refused before it is parsed. */
export const LOBBY_BODY_MAX_BYTES = 4096;
/** The highest level a Campaign player can claim to have reached. */
const HIGHEST_MAX = 99;
const PROTOCOL_MAX = 9999;

/** The JSON body of POST /v1/rooms. */
export interface CreateRoomRequest {
  readonly protocol: number;
  readonly style: GameStyle;
  readonly difficulty: DifficultyId;
  readonly visibility: Visibility;
  readonly device: HostDevice;
  /** The host's callsign, shown on a private room's card. A public room never carries one. */
  readonly label?: string;
}

/** The answer to POST /v1/rooms. The hostKey is sent once, here, and never appears in a URL. */
export interface CreateRoomResult {
  readonly code: string;
  readonly hostKey: string;
}

/** Every refusal from the Lobby carries a short reason. */
export interface LobbyError {
  readonly error: string;
}

type Raw = Record<string, unknown>;

const isRaw = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value);
const isWhole = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

export const isProtocol = (value: unknown): value is number => isWhole(value, 1, PROTOCOL_MAX);
export const isVisibility = (value: unknown): value is Visibility => value === 'public' || value === 'private';
export const isHostDevice = (value: unknown): value is HostDevice => value === 'desktop' || value === 'phone';

export function parseCreateRoom(value: unknown): CreateRoomRequest | null {
  if (!isRaw(value)) return null;
  const { protocol, style, difficulty, visibility, device, label } = value;
  const shapeOk = isProtocol(protocol) && isGameStyle(style) && isDifficultyId(difficulty);
  const isBadShape = !shapeOk || !isVisibility(visibility) || !isHostDevice(device);
  if (isBadShape) return null;
  const isBadLabel = label !== undefined && typeof label !== 'string';
  if (isBadLabel) return null;
  const base = { protocol, style, difficulty, visibility, device };
  const cleaned = visibility === 'private' && label ? cleanCallsign(label) : '';
  return cleaned ? { ...base, label: cleaned } : base;
}

/** Codes in `avoid` that are not room codes are dropped, not refused: an old client may hold one. */
export function parseMatchRequest(value: unknown): MatchRequest | null {
  if (!isRaw(value)) return null;
  const { protocol, style, difficulty, character, highest, avoid, device } = value;
  const isBadShape = !isProtocol(protocol) || !isGameStyle(style) || !isDifficultyId(difficulty) || !isCharacterIndex(character);
  if (isBadShape) return null;
  const isBadHighest = highest !== undefined && !isWhole(highest, 1, HIGHEST_MAX);
  if (isBadHighest) return null;
  const isBadDevice = device !== undefined && !isHostDevice(device);
  if (isBadDevice) return null;
  const isBadAvoidList = avoid !== undefined && (!Array.isArray(avoid) || avoid.length > MAX_AVOID);
  if (isBadAvoidList) return null;
  const codes = (avoid ?? []).flatMap((raw: unknown) => {
    const check = normalizeRoomCode(raw);
    return check.ok ? [check.code] : [];
  });
  return {
    protocol,
    style,
    difficulty,
    character,
    ...(highest === undefined ? {} : { highest }),
    ...(codes.length ? { avoid: codes } : {}),
    ...(device === undefined ? {} : { device }),
  };
}
