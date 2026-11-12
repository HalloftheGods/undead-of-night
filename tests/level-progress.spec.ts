import { describe, expect, it } from 'vitest';
import { FINAL_LEVEL } from '../shared/levels.ts';
import { continueLevel, isLevelUnlocked, loadCampaignProgress, loadFurthestProgress, loadLevelProgress, recordCampaignFinished, recordGameFinished, recordLevelCleared, recordLevelReached } from '../src/game/level-progress.ts';
import { loadBest } from '../src/game/storage.ts';

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe('level progress', () => {
  it('level progress and best runs load untouched', () => {
    const store = memoryStore();
    const best = { score: 900, wave: 7, kills: 40, durationSec: 300 };
    store.setItem('outbreak.level-progress', JSON.stringify({ highest: 6, finished: false }));
    store.setItem('outbreak.best.v2', JSON.stringify(best));
    expect(loadLevelProgress(store)).toEqual({ highest: 6, finished: false });
    expect(loadBest(store)).toEqual(best);
  });

  it('unlocks the next level when a level is cleared, and never moves back', () => {
    const store = memoryStore();
    expect(recordLevelCleared(3, store).highest).toBe(4);
    expect(recordLevelCleared(1, store).highest).toBe(4);
    expect(loadCampaignProgress(store).highest).toBe(4);
  });

  it('keeps Campaign and Arcade apart: neither moves the other', () => {
    const store = memoryStore();
    recordLevelCleared(5, store);
    recordCampaignFinished(store);
    expect(loadLevelProgress(store)).toEqual({ highest: 1, finished: false });
    expect(loadCampaignProgress(store)).toEqual({ highest: FINAL_LEVEL, finished: true });

    const arcade = memoryStore();
    recordLevelReached(7, arcade);
    recordGameFinished(arcade);
    expect(loadCampaignProgress(arcade)).toEqual({ highest: 1, finished: false });
  });

  it('counts the further of the two for what has been heard', () => {
    const store = memoryStore();
    recordLevelReached(4, store);
    recordLevelCleared(6, store);
    expect(loadFurthestProgress(store)).toEqual({ highest: 7, finished: false });
    recordCampaignFinished(store);
    expect(loadFurthestProgress(store)).toEqual({ highest: FINAL_LEVEL, finished: true });
  });

  it('stops at the final level, and does not call that finished', () => {
    const store = memoryStore();
    expect(recordLevelCleared(FINAL_LEVEL, store)).toEqual({ highest: FINAL_LEVEL, finished: false });
  });

  it('starts with level 1 only, and loads old saves without it', () => {
    const progress = loadLevelProgress(memoryStore());
    expect(progress).toEqual({ highest: 1, finished: false });
    expect(isLevelUnlocked(1, progress)).toBe(true);
    expect(isLevelUnlocked(2, progress)).toBe(false);
  });

  it('only moves the highest level up', () => {
    const store = memoryStore();
    recordLevelReached(4, store);
    recordLevelReached(2, store);
    expect(loadLevelProgress(store).highest).toBe(4);
  });

  it('clamps to the final level and marks a finished game', () => {
    const store = memoryStore();
    recordLevelReached(99, store);
    expect(loadLevelProgress(store).highest).toBe(FINAL_LEVEL);
    recordGameFinished(store);
    expect(loadLevelProgress(store)).toEqual({ highest: FINAL_LEVEL, finished: true });
  });

  it('offers to continue only once a level past the first has been reached', () => {
    const store = memoryStore();
    expect(continueLevel(loadLevelProgress(store))).toBeNull();
    recordLevelReached(5, store);
    expect(continueLevel(loadLevelProgress(store))).toBe(5);
    recordLevelReached(3, store);
    expect(continueLevel(loadLevelProgress(store))).toBe(5);
  });

  it('continues from the last level after the game is finished', () => {
    const store = memoryStore();
    recordGameFinished(store);
    expect(continueLevel(loadLevelProgress(store))).toBe(FINAL_LEVEL);
  });

  it('offers nothing from a corrupt or blocked save', () => {
    const bad = { getItem: () => '{"highest":"banana"}', setItem: () => undefined };
    expect(continueLevel(loadLevelProgress(bad))).toBeNull();
    expect(continueLevel(loadLevelProgress(null))).toBeNull();
  });

  it('ignores corrupt saves and survives blocked storage', () => {
    const bad = { getItem: () => '{nope', setItem: () => undefined };
    expect(loadLevelProgress(bad).highest).toBe(1);
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => recordLevelReached(3, blocked)).not.toThrow();
    expect(loadLevelProgress(null).highest).toBe(1);
  });
});
