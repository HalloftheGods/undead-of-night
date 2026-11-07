// Find a team: which open public rooms suit a player, best first. Pure: the Lobby passes its rows and the clock.
import { DIFFICULTIES } from '../difficulty.ts';
import type { Continent, MatchRequest, RoomListing } from './types.ts';
import { isStale } from './ttl.ts';

/** Campaign: a room's furthest level must sit this far below and above the player's own. */
export const CAMPAIGN_REACH_BELOW = 2;
export const CAMPAIGN_REACH_ABOVE = 3;
/** Arcade: a run past this level is too far along to drop into. */
export const ARCADE_LAST_JOINABLE_LEVEL = 3;
/** How many difficulty steps apart still match. */
export const MAX_DIFFICULTY_GAP = 1;

/** Steps apart on the difficulty ladder. An id that is not on it is infinitely far from everything, so no room matches it. */
function difficultyGap(a: string, b: string): number {
  const first = DIFFICULTIES.findIndex((each) => each.id === a);
  const second = DIFFICULTIES.findIndex((each) => each.id === b);
  const unknown = first < 0 || second < 0;
  return unknown ? Number.POSITIVE_INFINITY : Math.abs(first - second);
}

function levelFits(room: RoomListing, request: MatchRequest): boolean {
  const isArcadeRoom = room.style === 'arcade';
  if (isArcadeRoom) return room.phase === 'muster' || room.level <= ARCADE_LAST_JOINABLE_LEVEL;
  const mine = request.highest ?? 1;
  return room.highest >= mine - CAMPAIGN_REACH_BELOW && room.highest <= mine + CAMPAIGN_REACH_ABOVE;
}

/** Whether this room may be offered to this player at all. */
export function isOpenTo(room: RoomListing, request: MatchRequest, now: number): boolean {
  const isUnlisted = room.visibility !== 'public' || room.locked || isStale(room.seenAt, now);
  if (isUnlisted) return false;
  const isRoomFull = room.seats >= room.maxSeats;
  if (isRoomFull) return false;
  const isOtherGame = room.protocol !== request.protocol || room.style !== request.style;
  if (isOtherGame) return false;
  if (request.avoid?.includes(room.code)) return false;
  const isTooFarInDifficulty = difficultyGap(room.difficulty, request.difficulty) > MAX_DIFFICULTY_GAP;
  if (isTooFarInDifficulty) return false;
  return levelFits(room, request);
}

const hasFreeSurvivor = (room: RoomListing, character: number): boolean => (room.taken & (1 << character)) === 0;

/** Lower sorts first. Each term is 0 for the better side, and the earlier terms outweigh the later ones. */
function rankKey(room: RoomListing, request: MatchRequest, mine: Continent): readonly number[] {
  return [
    room.continent === mine && mine !== 'unknown' ? 0 : 1,
    difficultyGap(room.difficulty, request.difficulty),
    hasFreeSurvivor(room, request.character) ? 0 : 1,
    room.device === 'desktop' ? 0 : 1,
    -room.seats,
    -room.createdAt,
  ];
}

function compareKeys(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < a.length; i += 1) {
    const isKeyDifferent = a[i] !== b[i];
    if (isKeyDifferent) return a[i] - b[i];
  }
  return 0;
}

/** Open rooms for this player, best first. `continent` is the searcher's own, from the edge. */
export function rankRooms(
  rooms: readonly RoomListing[],
  request: MatchRequest,
  now: number,
  continent: Continent = 'unknown',
): RoomListing[] {
  return rooms
    .filter((room) => isOpenTo(room, request, now))
    .map((room) => ({ room, key: rankKey(room, request, continent) }))
    .sort((a, b) => compareKeys(a.key, b.key) || a.room.code.localeCompare(b.room.code))
    .map((entry) => entry.room);
}

export type MatchDecision = { readonly kind: 'join'; readonly room: RoomListing } | { readonly kind: 'host' };

/** Join the best open room, or ask the caller to create one with this player as host. */
export function findOrCreate(
  rooms: readonly RoomListing[],
  request: MatchRequest,
  now: number,
  continent: Continent = 'unknown',
): MatchDecision {
  const [best] = rankRooms(rooms, request, now, continent);
  return best ? { kind: 'join', room: best } : { kind: 'host' };
}
