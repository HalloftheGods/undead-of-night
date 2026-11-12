// The Records screen as a printed record book: six leaves, read two at a time on a wide screen and one at a time
// on a tall one. The leaves' words come from here, so the page only lays them out.

import { townName } from '../../shared/levels.ts';
import type { DailyLog, DailyMpRunResult, DailyResult, DailySoloResult } from './daily-night.ts';
import { bestDay, bestMpDay, dayLabel, mpResultOf, nightFacts, recentDays, soloResultOf, streakOf, todaysNight } from './daily-night.ts';
import { openOf, pagesLabel, turnWithin } from './book-turn.ts';
import type { BookMode } from './book-turn.ts';
import { STAMPS } from './stamps.ts';
import type { StampBook, StampId } from './stamps.ts';

export type LeafId = 'bests' | 'ledger' | 'daily' | 'week' | 'stamps' | 'more_stamps';
export type { BookMode };

export interface Leaf {
  readonly id: LeafId;
  /** The section named in the running head. */
  readonly head: string;
  /** The band colour, from the magazine's palette. */
  readonly color: 'tomato' | 'teal' | 'violet' | 'mustard' | 'pink' | 'sky';
}

export const RECORD_LEAVES: readonly Leaf[] = [
  { id: 'bests', head: 'Personal bests', color: 'tomato' },
  { id: 'ledger', head: 'The ledger', color: 'teal' },
  { id: 'daily', head: 'Daily Night', color: 'violet' },
  { id: 'week', head: 'The last seven nights', color: 'mustard' },
  { id: 'stamps', head: 'Stamps', color: 'pink' },
  { id: 'more_stamps', head: 'More stamps', color: 'sky' },
];

export const RECORD_BOOK_TITLE = "Survivor's Record Book";

/** The leaves open in front of the reader. */
export function openLeaves(index: number, mode: BookMode): readonly Leaf[] {
  return openOf(RECORD_LEAVES, index, mode);
}

/** The leaf a turn lands on, held inside the book. */
export function turnLeaves(index: number, by: number, mode: BookMode): number {
  return turnWithin(RECORD_LEAVES.length, index, by, mode);
}

/** "Pages 1-2 of 4", or "Page 3 of 4" one at a time. */
export function leafLabel(index: number, mode: BookMode): string {
  return pagesLabel(RECORD_LEAVES.length, index, mode);
}

export interface DailySummary {
  readonly streak: number;
  /** Counted days kept on this device. */
  readonly nights: number;
  readonly best: { readonly label: string; readonly score: number; readonly level: number } | null;
  readonly bestMp?: { readonly label: string; readonly teamScore: number; readonly partySize: number; readonly level: number } | null;
  readonly tonight: {
    readonly label: string;
    readonly title: string;
    readonly line: string;
    readonly played: DailyResult | null;
    readonly solo?: DailySoloResult | null;
    readonly mp?: DailyMpRunResult | null;
  };
}

export function dailySummary(log: DailyLog, now: Date = new Date()): DailySummary {
  const night = todaysNight(now);
  const facts = nightFacts(night);
  const best = bestDay(log);
  const bestMp = bestMpDay(log);
  const todayEntry = log[night.key] ?? null;
  return {
    streak: streakOf(log, night.key),
    nights: Object.keys(log).length,
    best: best ? { label: dayLabel(best.key), score: best.result.score, level: best.result.level } : null,
    bestMp: bestMp
      ? {
          label: dayLabel(bestMp.key),
          teamScore: bestMp.result.teamScore,
          partySize: bestMp.result.partySize,
          level: bestMp.result.level,
        }
      : null,
    tonight: {
      label: dayLabel(night.key),
      title: facts.title,
      line: `${facts.level}, ${facts.difficulty}`,
      played: todayEntry,
      solo: soloResultOf(todayEntry),
      mp: mpResultOf(todayEntry),
    },
  };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface WeekLine {
  readonly key: string;
  readonly weekday: string;
  readonly label: string;
  readonly score: string;
  readonly detail: string;
  /** Counted, missed, or today and not yet played. */
  readonly stamp: 'counted' | 'missed' | 'open';
}

function stampFor(result: DailyResult | null, today: boolean): WeekLine['stamp'] {
  if (result) return 'counted';
  return today ? 'open' : 'missed';
}

const UNPLAYED: Readonly<Record<WeekLine['stamp'], string>> = { counted: '', open: 'Still open tonight', missed: 'No run' };

/** The last seven days, newest first, each stamped. */
export function weekLines(log: DailyLog, now: Date = new Date()): readonly WeekLine[] {
  const todayKey = todaysNight(now).key;
  return recentDays(log, todayKey, 7).map(({ key, result }) => {
    const [year, month, day] = key.split('-').map(Number);
    const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()];
    const practice = result && result.attempts > 1 ? `, ${result.attempts - 1} practice` : '';
    const stamp = stampFor(result, key === todayKey);
    return {
      key,
      weekday,
      label: dayLabel(key),
      score: result && !result.carried ? String(result.score) : '-',
      detail: result ? `${townName(result.level)}, ${result.kills} kills${practice}` : UNPLAYED[stamp],
      stamp,
    };
  });
}

export interface StampCard {
  readonly id: StampId;
  readonly name: string;
  readonly how: string;
  /** The day it was earned, as the book prints it, or null while the ring is empty. */
  readonly earned: string | null;
  /** A slight turn of the stamp, the same every time for the same stamp. */
  readonly tilt: number;
}

/** The stamps the first stamps leaf holds; the rest go on the second. */
const FIRST_LEAF_STAMPS = 9;

/** One stamps leaf's cards, in book order. */
export function stampCards(book: StampBook, leaf: 'stamps' | 'more_stamps'): readonly StampCard[] {
  const defs = leaf === 'stamps' ? STAMPS.slice(0, FIRST_LEAF_STAMPS) : STAMPS.slice(FIRST_LEAF_STAMPS);
  return defs.map((def, index) => {
    const day = book.earned[def.id];
    return { id: def.id, name: def.name, how: def.how, earned: day ? dayLabel(day) : null, tilt: ((index * 7) % 11) - 5 };
  });
}

/** "6 of 17 stamped". */
export function stampTally(book: StampBook): string {
  const got = STAMPS.filter((def) => book.earned[def.id] !== undefined).length;
  return `${got} of ${STAMPS.length} stamped`;
}
