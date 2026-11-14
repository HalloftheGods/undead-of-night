import { describe, expect, it } from 'vitest';
import { FINAL_LEVEL, LEVELS } from '../shared/levels.ts';
import { chosenStartLevel, soloStartLevel } from '../src/game/level-progress.ts';
import { startAtLabel } from '../src/game/level-select.ts';

const reachedThree = { highest: 3, finished: false };

describe('chosen start level', () => {
  it('accepts an unlocked level past the first', () => {
    expect(chosenStartLevel(2, reachedThree)).toBe(2);
    expect(chosenStartLevel(3, reachedThree)).toBe(3);
  });

  it('treats level 1 as a normal new run', () => {
    expect(chosenStartLevel(1, reachedThree)).toBeNull();
  });

  it('refuses a locked, stale or malformed level', () => {
    expect(chosenStartLevel(4, reachedThree)).toBeNull();
    expect(chosenStartLevel(FINAL_LEVEL + 1, { highest: FINAL_LEVEL, finished: true })).toBeNull();
    expect(chosenStartLevel(2.5, reachedThree)).toBeNull();
    expect(chosenStartLevel(Number.NaN, reachedThree)).toBeNull();
    expect(chosenStartLevel(0, reachedThree)).toBeNull();
  });
});

describe('solo start level', () => {
  it('uses the chosen level when given, and the furthest reached otherwise', () => {
    expect(soloStartLevel(2, reachedThree)).toBe(2);
    expect(soloStartLevel(undefined, reachedThree)).toBe(3);
  });

  it('is null with nothing to continue, and for a locked choice', () => {
    expect(soloStartLevel(undefined, { highest: 1, finished: false })).toBeNull();
    expect(soloStartLevel(5, reachedThree)).toBeNull();
  });
});

describe('start at label', () => {
  it('names the level and its title', () => {
    expect(startAtLabel(2)).toBe(`Start in Twoport: ${LEVELS[1].title}`);
  });

  it('is null with no level or an unknown one', () => {
    expect(startAtLabel(null)).toBeNull();
    expect(startAtLabel(999)).toBeNull();
  });
});
