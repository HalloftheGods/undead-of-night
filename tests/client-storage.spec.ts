import { describe, expect, it } from 'vitest';
import { formatDuration } from '../src/game/hud-state.ts';
import { beatsBest, loadBest, loadLeaderboard, loadPrefs, recordRun, savePrefs } from '../src/game/storage.ts';

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

const brokenStore = {
  getItem(): string {
    throw new Error('blocked');
  },
  setItem(): void {
    throw new Error('blocked');
  },
};

const run = { score: 100, wave: 3, kills: 9, durationSec: 80 };

describe('best run', () => {
  it('stores the first real run', () => {
    const store = memoryStore();
    expect(recordRun(run, store)).toBe(true);
    expect(loadBest(store)).toEqual(run);
  });

  it('keeps the better run', () => {
    const store = memoryStore();
    recordRun(run, store);
    expect(recordRun({ ...run, score: 50 }, store)).toBe(false);
    expect(recordRun({ ...run, score: 150 }, store)).toBe(true);
    expect(loadBest(store)?.score).toBe(150);
  });

  it('breaks a tied score on the hordes survived', () => {
    expect(beatsBest({ ...run, wave: 4 }, run)).toBe(true);
    expect(beatsBest(run, run)).toBe(false);
  });

  it('does not celebrate an empty first run', () => {
    expect(beatsBest({ score: 0, wave: 0, kills: 0, durationSec: 4 }, null)).toBe(false);
  });

  it('counts a first run that outlasted a horde without a kill', () => {
    expect(beatsBest({ score: 0, wave: 1, kills: 0, durationSec: 200 }, null)).toBe(true);
  });

  it('ignores corrupt saved data', () => {
    expect(loadBest(memoryStore({ 'outbreak.best.v2': '{oops' }))).toBeNull();
    expect(loadBest(memoryStore({ 'outbreak.best.v2': '{"score":"lots"}' }))).toBeNull();
  });

  it('does not show records from before level 100, and leaves them in storage', () => {
    const oldBest = JSON.stringify({ score: 9000, wave: 9, kills: 400, durationSec: 1800 });
    const oldBoard = JSON.stringify([{ callsign: 'ANA', score: 9000, wave: 9, kills: 400, durationSec: 1800, timestamp: 1 }]);
    const store = memoryStore({ 'outbreak.best': oldBest, 'outbreak.leaderboard': oldBoard });
    expect(loadBest(store)).toBeNull();
    expect(loadLeaderboard(store)).toEqual([]);
    expect(recordRun(run, store)).toBe(true);
    expect(loadBest(store)).toEqual(run);
    expect(loadLeaderboard(store)).toHaveLength(1);
    expect(store.getItem('outbreak.best')).toBe(oldBest);
    expect(store.getItem('outbreak.leaderboard')).toBe(oldBoard);
    expect(JSON.parse(store.getItem('outbreak.best.v2')!)).toEqual(run);
  });

  it('survives storage that throws', () => {
    expect(loadBest(brokenStore)).toBeNull();
    expect(() => recordRun(run, brokenStore)).not.toThrow();
  });
});

describe('prefs', () => {
  it('round-trips', () => {
    const store = memoryStore();
    savePrefs({ callsign: 'ANA', serverAddress: '10.0.0.5' }, store);
    expect(loadPrefs(store)).toEqual({ callsign: 'ANA', serverAddress: '10.0.0.5' });
  });

  it('falls back field by field', () => {
    const store = memoryStore({ 'outbreak.prefs': '{"callsign":7,"serverAddress":"x"}' });
    expect(loadPrefs(store)).toEqual({ callsign: '', serverAddress: 'x' });
  });
});

describe('formatDuration', () => {
  it('reads as minutes and seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65.9)).toBe('1:05');
    expect(formatDuration(600)).toBe('10:00');
  });
});
