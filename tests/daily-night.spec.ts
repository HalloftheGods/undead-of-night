import { describe, expect, it } from 'vitest';
import {
  bestDay,
  countdownText,
  dailyFor,
  dateKeyOf,
  dayLabel,
  loadDailyLog,
  msUntilTomorrow,
  recentDays,
  recordDaily,
  streakOf,
  withRun,
} from '../src/game/daily-night.ts';
import type { DailyLog } from '../src/game/daily-night.ts';

function memoryStore(): Pick<Storage, 'getItem' | 'setItem'> {
  const data = new Map<string, string>();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
}

const run = (score: number) => ({ score, kills: score / 10, level: 4 });

describe('Daily Night', () => {
  it('turns a date into the same night every time, within the daily levels', () => {
    expect(dailyFor('2026-11-07')).toEqual(dailyFor('2026-11-07'));
    const nights = Array.from({ length: 60 }, (_, i) => dailyFor(dateKeyOf(new Date(2026, 0, 1 + i))));
    for (const night of nights) {
      expect(night.level).toBeGreaterThanOrEqual(2);
      expect(night.level).toBeLessThanOrEqual(8);
    }
    expect(new Set(nights.map((night) => night.seed)).size).toBe(60);
    expect(new Set(nights.map((night) => night.level)).size).toBeGreaterThan(3);
  });

  it('names days the way a player reads them', () => {
    expect(dateKeyOf(new Date(2026, 10, 7, 23, 59))).toBe('2026-11-07');
    expect(dayLabel('2026-11-07')).toBe('7 Nov');
    expect(countdownText(5 * 3600_000 + 12 * 60_000)).toBe('5h 12m');
    expect(countdownText(12 * 60_000 + 5000)).toBe('12m');
    expect(msUntilTomorrow(new Date(2026, 10, 7, 23, 0))).toBe(3600_000);
  });

  it('counts the first run of a day and keeps later ones as practice', () => {
    const store = memoryStore();
    expect(recordDaily('2026-11-07', run(300), store)).toBe(true);
    expect(recordDaily('2026-11-07', run(900), store)).toBe(false);
    const day = loadDailyLog(store)['2026-11-07'];
    expect(day).toMatchObject({ score: 300, attempts: 2, practiceBest: 900 });
  });

  it('counts a streak up to today, or yesterday while today is open', () => {
    let log: DailyLog = {};
    for (const key of ['2026-11-04', '2026-11-05', '2026-11-06']) log = withRun(log, key, run(100)).log;
    expect(streakOf(log, '2026-11-07')).toBe(3);
    log = withRun(log, '2026-11-07', run(100)).log;
    expect(streakOf(log, '2026-11-07')).toBe(4);
    expect(streakOf(log, '2026-11-09')).toBe(0);
  });

  it('finds the best day and lists the last week, gaps included', () => {
    let log: DailyLog = {};
    log = withRun(log, '2026-11-01', run(500)).log;
    log = withRun(log, '2026-11-06', run(200)).log;
    expect(bestDay(log)?.key).toBe('2026-11-01');
    const week = recentDays(log, '2026-11-07');
    expect(week.map((day) => day.key)).toEqual(['2026-11-07', '2026-11-06', '2026-11-05', '2026-11-04', '2026-11-03', '2026-11-02', '2026-11-01']);
    expect(week[1].result?.score).toBe(200);
    expect(week[0].result).toBeNull();
  });

  it('ignores a damaged save', () => {
    const store = memoryStore();
    store.setItem('outbreak.daily', '{"2026-11-07":{"score":"lots"},"nonsense":{}}');
    expect(loadDailyLog(store)).toEqual({});
  });
});

describe('the shared Daily result', () => {
  it('names the day, the level, the points and kills, and a streak past one night', async () => {
    const { shareText } = await import('../src/game/daily-night.ts');
    const run = { score: 1310, kills: 61, level: 6 };
    expect(shareText('2026-11-07', run, 3, 'https://x/')).toBe(
      'Undead of Night - Daily Night, 7 Nov\nReached Sixburg: 1310 points, 61 kills\nStreak: 3 nights in a row\nhttps://x/',
    );
    expect(shareText('2026-11-07', run, 1, 'https://x/')).not.toContain('Streak');
  });
});
