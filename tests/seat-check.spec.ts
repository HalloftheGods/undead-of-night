import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../shared/characters.ts';
import { seatRefusal } from '../src/game/seat-check.ts';

const card = (taken: number, seats = 1) => ({ seats, maxSeats: 5, taken });
const names = CHARACTERS.map((each) => each.name);

describe('seatRefusal', () => {
  it('lets a free survivor in', () => {
    expect(seatRefusal(card(0b00001), 1)).toBeNull();
  });

  it('refuses a survivor already in the room and names the free ones', () => {
    expect(seatRefusal(card(0b00110, 2), 1)).toBe(`${names[1]} is already in that room. Pick ${names[0]}, ${names[3]} or ${names[4]}, then join.`);
  });

  it('names the one survivor left when only one is free', () => {
    expect(seatRefusal(card(0b11101, 4), 0)).toBe(`${names[0]} is already in that room. Pick ${names[1]}, then join.`);
  });

  it('says a full room is full', () => {
    expect(seatRefusal(card(0b11111, 5), 0)).toBe('That room is full.');
  });
});
