// Before a code join: is there a seat, and is this player's survivor still free? Co-op never shares a survivor.
import { CHARACTERS, characterOf } from '../../shared/characters.ts';
import type { RoomCard } from '../../shared/lobby/types.ts';

const isTaken = (taken: number, skin: number): boolean => (taken & (1 << skin)) !== 0;

function orList(names: readonly string[]): string {
  const isSingle = names.length <= 1;
  if (isSingle) return names.join('');
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

/** What to tell a player who cannot take a seat in this room as this survivor, or null when they can. */
export function seatRefusal(card: Pick<RoomCard, 'seats' | 'maxSeats' | 'taken'>, character: number): string | null {
  const isRoomFull = card.seats >= card.maxSeats;
  if (isRoomFull) return 'That room is full.';
  const isFree = !isTaken(card.taken, character);
  if (isFree) return null;
  const free = CHARACTERS.filter((_, skin) => !isTaken(card.taken, skin)).map((each) => each.name);
  return `${characterOf(character).name} is already in that room. Pick ${orList(free)}, then join.`;
}
