import { describe, expect, it } from 'vitest';
import { findOrCreate, isOpenTo, rankRooms } from '../shared/lobby/match.ts';
import type { MatchRequest, RoomListing } from '../shared/lobby/types.ts';

const NOW = 1_000_000;

function room(over: Partial<RoomListing> = {}): RoomListing {
  return {
    code: 'BCDFG', protocol: 1, style: 'arcade', difficulty: 'lights_out', visibility: 'public', device: 'desktop',
    continent: 'EU', level: 1, highest: 1, seats: 1, maxSeats: 5, taken: 0b0001, phase: 'playing', locked: false,
    createdAt: NOW - 60_000, seenAt: NOW - 1000, ...over,
  };
}

const ask = (over: Partial<MatchRequest> = {}): MatchRequest => ({
  protocol: 1, style: 'arcade', difficulty: 'lights_out', character: 1, ...over,
});

const codes = (rooms: RoomListing[]): string[] => rooms.map((each) => each.code);

describe('which rooms are open', () => {
  it('takes an ordinary public room', () => {
    expect(isOpenTo(room(), ask(), NOW)).toBe(true);
  });

  it('refuses private, locked, full, stale, avoided, other protocol and other style', () => {
    const refused = [
      room({ visibility: 'private' }), room({ locked: true }), room({ seats: 5 }), room({ seenAt: NOW - 90_000 }),
      room({ protocol: 2 }), room({ style: 'campaign' }),
    ];
    for (const each of refused) expect(isOpenTo(each, ask(), NOW)).toBe(false);
    expect(isOpenTo(room(), ask({ avoid: ['BCDFG'] }), NOW)).toBe(false);
  });

  it('matches difficulty exactly or one step away, never two', () => {
    expect(isOpenTo(room({ difficulty: 'stay_close' }), ask(), NOW)).toBe(true);
    expect(isOpenTo(room({ difficulty: 'undead_tired' }), ask(), NOW)).toBe(true);
    expect(isOpenTo(room({ difficulty: 'night_light' }), ask(), NOW)).toBe(false);
    expect(isOpenTo(room({ difficulty: 'night_light' }), ask({ difficulty: 'undead_tired' }), NOW)).toBe(false);
  });

  it('never matches a difficulty that is not on the ladder', () => {
    const unknown = (difficulty: string) => room({ difficulty: difficulty as RoomListing['difficulty'] });
    expect(isOpenTo(unknown('nonsense'), ask(), NOW)).toBe(false);
    expect(isOpenTo(room(), ask({ difficulty: 'nonsense' as MatchRequest['difficulty'] }), NOW)).toBe(false);
    expect(isOpenTo(unknown('nonsense'), ask({ difficulty: 'nonsense' as MatchRequest['difficulty'] }), NOW)).toBe(false);
    expect(codes(rankRooms([unknown('nonsense'), room({ code: 'REAL' })], ask(), NOW))).toEqual(['REAL']);
    expect(findOrCreate([unknown('nonsense')], ask(), NOW)).toEqual({ kind: 'host' });
  });

  it('lets Arcade in during muster or up to level 3', () => {
    expect(isOpenTo(room({ level: 3 }), ask(), NOW)).toBe(true);
    expect(isOpenTo(room({ level: 4 }), ask(), NOW)).toBe(false);
    expect(isOpenTo(room({ level: 7, phase: 'muster' }), ask(), NOW)).toBe(true);
  });

  it('keeps Campaign within [highest-2, highest+3]', () => {
    const camp = (highest: number) => room({ style: 'campaign', highest });
    const mine = ask({ style: 'campaign', highest: 5 });
    expect([2, 3, 8, 9].map((h) => isOpenTo(camp(h), mine, NOW))).toEqual([false, true, true, false]);
    expect(isOpenTo(camp(1), ask({ style: 'campaign' }), NOW)).toBe(true);
  });
});

describe('ranking', () => {
  it('puts the same continent first', () => {
    const rooms = [room({ code: 'AAAAA', continent: 'NA' }), room({ code: 'BBBBB', continent: 'EU' })];
    expect(codes(rankRooms(rooms, ask(), NOW, 'EU'))).toEqual(['BBBBB', 'AAAAA']);
  });

  it('never offers a room that already has your survivor', () => {
    expect(isOpenTo(room({ taken: 0b0010 }), ask(), NOW)).toBe(false);
    expect(isOpenTo(room({ taken: 0b1101 }), ask(), NOW)).toBe(true);
  });

  it('prefers an exact difficulty, then a desktop host', () => {
    const exact = room({ code: 'EXACT' });
    const close = room({ code: 'CLOSE', difficulty: 'stay_close' });
    expect(codes(rankRooms([close, exact], ask(), NOW, 'EU'))).toEqual(['EXACT', 'CLOSE']);
    const phone = room({ code: 'PHONE', device: 'phone' });
    const desk = room({ code: 'DESK' });
    expect(codes(rankRooms([phone, desk], ask(), NOW, 'EU'))).toEqual(['DESK', 'PHONE']);
  });

  it('then prefers a fuller room, then the younger one', () => {
    const empty = room({ code: 'EMPTY', seats: 1 });
    const fuller = room({ code: 'FULLR', seats: 3 });
    expect(codes(rankRooms([empty, fuller], ask(), NOW, 'EU'))).toEqual(['FULLR', 'EMPTY']);
    const old = room({ code: 'OLDER', createdAt: NOW - 500_000 });
    const young = room({ code: 'YOUNG', createdAt: NOW - 1000 });
    expect(codes(rankRooms([old, young], ask(), NOW, 'EU'))).toEqual(['YOUNG', 'OLDER']);
  });

  it('widens to another continent only when that is all there is', () => {
    expect(codes(rankRooms([room({ code: 'FARAW', continent: 'AS' })], ask(), NOW, 'EU'))).toEqual(['FARAW']);
  });
});

describe('findOrCreate', () => {
  it('joins the best room', () => {
    const found = findOrCreate([room({ code: 'AAAAA', seats: 1 }), room({ code: 'BBBBB', seats: 2 })], ask(), NOW);
    expect(found.kind === 'join' && found.room.code).toBe('BBBBB');
  });

  it('asks the caller to host when nothing fits', () => {
    expect(findOrCreate([room({ locked: true })], ask(), NOW)).toEqual({ kind: 'host' });
    expect(findOrCreate([], ask(), NOW)).toEqual({ kind: 'host' });
  });
});
