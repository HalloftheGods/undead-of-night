import { describe, expect, it } from 'vitest';
import { BOSSES } from '../shared/bosses.ts';
import { ZOMBIES } from '../shared/constants.ts';
import { BUNKER_LEVEL } from '../shared/home-protocol.ts';
import { chainMultiplier } from '../shared/kill-chain.ts';
import { killPoints, townOf } from '../shared/kill-points.ts';
import type { ZombieType } from '../shared/protocol.ts';
import { newHomeRun } from '../shared/trip.ts';

const TOWNS = [1, 2, 5, 10];

describe('kill points', () => {
  it.each<[ZombieType, number[]]>([
    ['walker', [1, 2, 5, 10]],
    ['runner', [2, 3, 8, 15]],
    ['bloater', [3, 5, 13, 25]],
    ['screamer', [3, 6, 15, 30]],
    ['brute', [12, 24, 60, 120]],
  ])('pay a %s a tenth of its worth times the town', (type, row) => {
    expect(TOWNS.map((town) => killPoints(ZOMBIES[type].points, town, 1, 1))).toEqual(row);
  });

  it('pay bosses 150, 250 and 400 times the town', () => {
    expect([BOSSES.howler, BOSSES.mother, BOSSES.butcher].map((b) => killPoints(b.points, 2, 1, 1))).toEqual([300, 500, 800]);
  });

  it('still chain on a 1-point walker', () => {
    expect([1, 2, 3, 4, 5].map((n) => killPoints(ZOMBIES.walker.points, 1, chainMultiplier(n), 1))).toEqual([1, 1, 2, 2, 2]);
  });

  it('double under a blood moon', () => {
    expect(killPoints(ZOMBIES.walker.points, 3, 1, 2)).toBe(6);
  });
});

describe('townOf', () => {
  it('is the level in a town and the furthest town reached in the bunker', () => {
    expect(townOf({ level: 7, homeRun: null })).toBe(7);
    expect(townOf({ level: BUNKER_LEVEL, homeRun: { ...newHomeRun(1), roomHighest: 4 } })).toBe(4);
    expect(townOf({ level: BUNKER_LEVEL, homeRun: null })).toBe(1);
  });
});
