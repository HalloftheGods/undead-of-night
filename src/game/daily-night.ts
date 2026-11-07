// Daily Night: one town a day, the same for everyone. The day picks the seed, the level and the difficulty;
// the first run of the day is the one that counts, and later ones are practice. Solo and Arcade rules only.

import { difficultyDef } from '../../shared/difficulty.ts';
import type { DifficultyId } from '../../shared/difficulty.ts';
import { levelDef, levelSeed } from '../../shared/levels.ts';
import { nightEventFor } from '../../shared/night-events.ts';
import { townRule } from '../../shared/town-rules.ts';
import { browserStore, readJson, writeJson } from './storage.ts';
import type { Store } from './storage.ts';

const DAILY_KEY = 'outbreak.daily';
/** The levels a day can start on: late enough to be a fight, early enough to be finished before bed. */
const FIRST_DAILY_LEVEL = 2;
const LAST_DAILY_LEVEL = 8;
/** Most days are the game as tuned; some are kinder, some are not. */
const DAILY_DIFFICULTIES: readonly DifficultyId[] = ['stay_close', 'lights_out', 'lights_out', 'lights_out', 'undead_tired'];
/** Days kept in the save, newest first; older ones only ever mattered to a streak long since counted. */
const KEPT_DAYS = 60;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface DailyNight {
  /** The local date it belongs to, YYYY-MM-DD. */
  readonly key: string;
  readonly seed: number;
  readonly level: number;
  readonly difficulty: DifficultyId;
}

/** What one day's counted run came to. */
export interface DailyResult {
  readonly score: number;
  readonly kills: number;
  /** The level the run reached. */
  readonly level: number;
  /** Runs made that day, the counted one included. */
  readonly attempts: number;
  /** The best practice score after the counted run, if any beat zero. */
  readonly practiceBest: number;
}

export type DailyLog = Readonly<Record<string, DailyResult>>;

const pad = (n: number): string => String(n).padStart(2, '0');

/** The player's own calendar day, so the day turns over at their midnight. */
export function dateKeyOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "7 Nov", for the day's label. */
export function dayLabel(key: string): string {
  const [, month, day] = key.split('-').map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]}`;
}

/** FNV-1a over the key: every browser turns the same date into the same night. */
function hashKey(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function dailyFor(key: string): DailyNight {
  const hash = hashKey(key);
  const span = LAST_DAILY_LEVEL - FIRST_DAILY_LEVEL + 1;
  const level = FIRST_DAILY_LEVEL + (hash % span);
  const difficulty = DAILY_DIFFICULTIES[Math.floor(hash / span) % DAILY_DIFFICULTIES.length];
  return { key, seed: hash & 0x7fffffff, level, difficulty };
}

export function todaysNight(now: Date = new Date()): DailyNight {
  return dailyFor(dateKeyOf(now));
}

/** Milliseconds to the player's next midnight, when a new night is drawn. */
export function msUntilTomorrow(now: Date = new Date()): number {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return tomorrow.getTime() - now.getTime();
}

/** "5h 12m", or "12m" in the last hour. */
export function countdownText(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${pad(minutes % 60)}m` : `${minutes}m`;
}

/** The day's page lines about the town: its name, level, difficulty, and any rule or event. */
export interface NightFacts {
  title: string;
  level: string;
  difficulty: string;
  rule: string | null;
  event: string | null;
}

/** What the day's page says about the town before anyone goes in. */
export function nightFacts(night: DailyNight): NightFacts {
  const rule = townRule(night.level);
  const event = nightEventFor(levelSeed(night.seed, night.level), night.level);
  return {
    title: levelDef(night.level).title,
    level: `Level ${night.level}`,
    difficulty: difficultyDef(night.difficulty).label,
    rule: rule ? `${rule.name}: ${rule.blurb}` : null,
    event: event ? event.name : null,
  };
}

function isResult(v: unknown): v is DailyResult {
  const isNotObject = typeof v !== 'object' || v === null;
  if (isNotObject) return false;
  const r = v as Record<string, unknown>;
  return ['score', 'kills', 'level', 'attempts', 'practiceBest'].every((key) => Number.isFinite(r[key]));
}

export function loadDailyLog(store: Store | null = browserStore()): DailyLog {
  const raw = readJson(store, DAILY_KEY);
  const isNotLog = typeof raw !== 'object' || raw === null;
  if (isNotLog) return {};
  const log: Record<string, DailyResult> = {};
  for (const [key, value] of Object.entries(raw)) {
    const isDayEntry = /^\d{4}-\d{2}-\d{2}$/.test(key) && isResult(value);
    if (isDayEntry) log[key] = value;
  }
  return log;
}

/** The first run of a day is kept as it was; later ones only count as attempts and a practice best. */
export function withRun(log: DailyLog, key: string, run: { score: number; kills: number; level: number }): { log: DailyLog; counted: boolean } {
  const earlier = log[key];
  const result: DailyResult = earlier
    ? { ...earlier, attempts: earlier.attempts + 1, practiceBest: Math.max(earlier.practiceBest, run.score) }
    : { score: run.score, kills: run.kills, level: run.level, attempts: 1, practiceBest: 0 };
  const kept = Object.keys({ ...log, [key]: result }).sort().reverse().slice(0, KEPT_DAYS);
  const next: Record<string, DailyResult> = {};
  for (const day of kept) next[day] = day === key ? result : log[day];
  return { log: next, counted: earlier === undefined };
}

/** Records a finished daily run and says whether it was the one that counts. */
export function recordDaily(key: string, run: { score: number; kills: number; level: number }, store: Store | null = browserStore()): boolean {
  const { log, counted } = withRun(loadDailyLog(store), key, run);
  writeJson(store, DAILY_KEY, log);
  return counted;
}

function previousKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  return dateKeyOf(new Date(year, month - 1, day - 1));
}

/** Days in a row with a counted run, up to today, or up to yesterday while today is still open. */
export function streakOf(log: DailyLog, todayKey: string): number {
  let day = log[todayKey] ? todayKey : previousKey(todayKey);
  let streak = 0;
  while (log[day]) {
    streak += 1;
    day = previousKey(day);
  }
  return streak;
}

/** The best counted day there has been, or null with none. */
export function bestDay(log: DailyLog): { key: string; result: DailyResult } | null {
  let best: { key: string; result: DailyResult } | null = null;
  for (const [key, result] of Object.entries(log)) {
    const isNewBest = !best || result.score > best.result.score;
    if (isNewBest) best = { key, result };
  }
  return best;
}

/** The last `count` days up to today, newest first, played or not. */
export function recentDays(log: DailyLog, todayKey: string, count = 7): { key: string; result: DailyResult | null }[] {
  const days: { key: string; result: DailyResult | null }[] = [];
  let day = todayKey;
  for (let i = 0; i < count; i += 1) {
    days.push({ key: day, result: log[day] ?? null });
    day = previousKey(day);
  }
  return days;
}

/** Where the game lives, for the shared line. */
const GAME_URL = 'https://undeadofnight.forthexp.com/';

/**
 * A few lines a player can paste anywhere: the day, how far they got, and their streak.
 * Words only, no spoilers about the town beyond its level, so it reads the same to anyone who has not played yet.
 */
export function shareText(key: string, result: Pick<DailyResult, 'score' | 'kills' | 'level'>, streak: number, url: string = GAME_URL): string {
  const nights = streak === 1 ? '1 night' : `${streak} nights`;
  const streakLine = streak > 1 ? `\nStreak: ${nights} in a row` : '';
  return `Undead of Night - Daily Night, ${dayLabel(key)}\nReached level ${result.level}: ${result.score} points, ${result.kills} kills${streakLine}\n${url}`;
}

/** The day's counted run, ready to share, or null before it is played. */
export function dailyShare(key: string, store: Store | null = browserStore()): string | null {
  const log = loadDailyLog(store);
  const counted = log[key];
  return counted ? shareText(key, counted, streakOf(log, key)) : null;
}
