import { afterEach, describe, expect, it } from 'vitest';
import { crowdSpeed, currentStreak, noteHeadshotStreak, pickLock, resetStreak, ringAt, ringPeriod } from '../src/game/input/pad-lock.ts';

const z = (id: string, x: number, y: number, health = 10) => ({ id, type: 'walker' as const, x, y, angle: 0, health });

describe('the pad ring', () => {
  it('speeds up with the streak, to a floor', () => {
    expect(ringPeriod(0)).toBeCloseTo(0.9);
    expect(ringPeriod(1)).toBeCloseTo(0.9);
    expect(ringPeriod(4)).toBeCloseTo(0.75);
    expect(ringPeriod(20)).toBeCloseTo(0.55);
  });

  it('starts wide, closes, and is perfect in the last 0.15 s', () => {
    expect(ringAt(0, 0)).toEqual({ radius: 28, perfect: false, progress: 0 });
    expect(ringAt(0.5, 0).perfect).toBe(false);
    expect(ringAt(0.8, 0).perfect).toBe(true);
    expect(ringAt(0.8, 0).radius).toBeLessThan(10);
  });

  it('wraps at the period so it recurs', () => {
    expect(ringAt(0.95, 0).radius).toBeGreaterThan(20);
    expect(ringAt(0.9 + 0.8, 0).perfect).toBe(true);
  });
});

describe('the crowd', () => {
  it('quickens the ring with each zombie in reach, to double', () => {
    expect(crowdSpeed(0)).toBe(1);
    expect(crowdSpeed(1)).toBe(1);
    expect(crowdSpeed(6)).toBeCloseTo(1.4);
    expect(crowdSpeed(40)).toBe(2);
  });
});

describe('the streak the ring reads', () => {
  afterEach(resetStreak);
  it('lapses after 3.5 s', () => {
    noteHeadshotStreak(3, 1000);
    expect(currentStreak(2000)).toBe(3);
    expect(currentStreak(4600)).toBe(0);
  });
});

describe('picking a lock', () => {
  const me = { x: 0, y: 0 };
  const list = [z('1', 40, 0), z('2', 100, 0), z('3', 0, 60), z('4', -50, 0, 0)];

  it('never locks by itself', () => {
    expect(pickLock(me, list, null, null, 300)).toBeNull();
  });

  it('takes the nearest that way from the survivor on the first push', () => {
    expect(pickLock(me, list, null, 'right', 300)).toBe('1');
    expect(pickLock(me, list, null, 'down', 300)).toBe('3');
    expect(pickLock(me, list, null, 'up', 300)).toBe('3');
  });

  it('moves to the nearest in the pushed direction from the current one', () => {
    expect(pickLock(me, list, '1', 'right', 300)).toBe('2');
    expect(pickLock(me, list, '1', 'down', 300)).toBe('3');
  });

  it('stays put with nothing else to pick, and skips the far', () => {
    expect(pickLock(me, [z('9', 900, 0)], null, 'right', 300)).toBeNull();
    expect(pickLock(me, [z('1', 40, 0)], '1', 'right', 300)).toBe('1');
  });

  it('loops to the far end when nothing lies that way, so it never sticks at the back', () => {
    expect(pickLock(me, list, '2', 'right', 300)).toBe('1');
    expect(pickLock(me, list, '1', 'up', 300)).toBe('3');
  });

  it('skips zombies the survivor cannot reach, such as ones inside a house', () => {
    const inside = (zombie: { x: number }) => zombie.x !== 40;
    expect(pickLock(me, list, null, 'right', 300, inside)).toBe('2');
    expect(pickLock(me, list, '1', null, 300, inside)).toBeNull();
  });

  it('keeps a lock that is alive and in reach, and drops one that is not, without picking another', () => {
    expect(pickLock(me, list, '2', null, 300)).toBe('2');
    expect(pickLock(me, list, '2', null, 50)).toBeNull();
    expect(pickLock(me, [z('2', 100, 0, 0)], '2', null, 300)).toBeNull();
  });
});
