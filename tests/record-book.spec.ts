import { describe, expect, it } from 'vitest';
import { dailySummary, leafLabel, openLeaves, turnLeaves, weekLines } from '../src/game/record-book.ts';

const NOW = new Date(2026, 10, 7, 20, 0);
const run = (score: number, attempts = 1) => ({ score, kills: 10, level: 4, attempts, practiceBest: 0 });

describe('the record book', () => {
  it('reads two leaves at a time on a wide screen and one on a tall one', () => {
    expect(openLeaves(0, 'spread').map((leaf) => leaf.id)).toEqual(['bests', 'ledger']);
    expect(openLeaves(3, 'spread').map((leaf) => leaf.id)).toEqual(['daily', 'week']);
    expect(openLeaves(2, 'single').map((leaf) => leaf.id)).toEqual(['daily']);
    expect(openLeaves(5, 'spread').map((leaf) => leaf.id)).toEqual(['stamps', 'more_stamps']);
    expect(leafLabel(0, 'spread')).toBe('Pages 1-2 of 6');
    expect(leafLabel(3, 'single')).toBe('Page 4 of 6');
  });

  it('turns within the book and stops at its covers', () => {
    expect(turnLeaves(0, 1, 'spread')).toBe(2);
    expect(turnLeaves(2, 1, 'spread')).toBe(4);
    expect(turnLeaves(4, 1, 'spread')).toBe(4);
    expect(turnLeaves(0, -1, 'single')).toBe(0);
    expect(turnLeaves(1, 1, 'single')).toBe(2);
  });

  it('sums up the Daily Night: streak, best night, nights kept and tonight', () => {
    const log = { '2026-11-06': run(900), '2026-11-05': run(1400), '2026-11-01': run(300) };
    const summary = dailySummary(log, NOW);
    expect(summary.streak).toBe(2);
    expect(summary.nights).toBe(3);
    expect(summary.best).toEqual({ label: '5 Nov', score: 1400, level: 4 });
    expect(summary.tonight.label).toBe('7 Nov');
    expect(summary.tonight.played).toBeNull();
  });

  it('stamps each of the last seven nights, today still open until played', () => {
    const lines = weekLines({ '2026-11-06': run(900, 3) }, NOW);
    expect(lines).toHaveLength(7);
    expect(lines.map((line) => line.stamp).slice(0, 3)).toEqual(['open', 'counted', 'missed']);
    expect(lines[0]).toMatchObject({ weekday: 'Sat', label: '7 Nov', score: '-' });
    expect(lines[1]).toMatchObject({ score: '900', detail: 'Four Corners, 10 kills, 2 practice' });
  });
});
