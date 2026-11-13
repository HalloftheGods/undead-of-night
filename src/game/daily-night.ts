// Nightly Run: one town a day, the same for everyone. The day picks the seed, the level and the difficulty;
// the first run of the day is the one that counts, and later ones are practice. Solo and Arcade rules only.

import { difficultyDef } from "../../shared/difficulty.ts";
import type { DifficultyId } from "../../shared/difficulty.ts";
import { levelDef, levelSeed, townName } from "../../shared/levels.ts";
import { nightEventFor } from "../../shared/night-events.ts";
import { townRule } from "../../shared/town-rules.ts";
import { browserStore, readJson, writeJson } from "./storage.ts";
import type { Store } from "./storage.ts";

/** The log since level 100. The one before it, on the old point scale, stays in storage under its own key. */
const DAILY_KEY = "outbreak.daily.v2";
const OLD_DAILY_KEY = "outbreak.daily";
/** The levels a day can start on: late enough to be a fight, early enough to be finished before bed. */
const FIRST_DAILY_LEVEL = 2;
const LAST_DAILY_LEVEL = 8;
/** Most days are the game as tuned; some are kinder, some are not. */
const DAILY_DIFFICULTIES: readonly DifficultyId[] = [
  "stay_close",
  "lights_out",
  "lights_out",
  "lights_out",
  "undead_tired"
];
/** Days kept in the save, newest first; older ones only ever mattered to a streak long since counted. */
const KEPT_DAYS = 60;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface DailyNight {
  /** The local date it belongs to, YYYY-MM-DD. */
  readonly key: string;
  readonly seed: number;
  readonly level: number;
  readonly difficulty: DifficultyId;
}

export type DailyPartySize = 2 | 3 | 4 | 5;
export const DAILY_PARTY_SIZES: readonly DailyPartySize[] = [2, 3, 4, 5];

export interface DailyTeammate {
  readonly name: string;
  readonly character: number;
  readonly score: number;
  readonly kills: number;
}

export interface DailyMpRunResult {
  readonly partySize: DailyPartySize;
  readonly teamScore: number;
  readonly teamKills: number;
  readonly playerScore: number;
  readonly playerKills: number;
  readonly level: number;
  readonly attempts: number;
  readonly practiceBestTeamScore: number;
  readonly roster?: readonly DailyTeammate[];
}

export interface DailySoloResult {
  readonly score: number;
  readonly kills: number;
  readonly level: number;
  readonly attempts: number;
  readonly practiceBest: number;
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
  readonly solo?: DailySoloResult;
  readonly mp?: Partial<Record<DailyPartySize, DailyMpRunResult>>;
  /** A counted day from before level 100, kept for the streak. Its points are not kept. */
  readonly carried?: true;
}

export interface DailyRunInput {
  readonly score: number;
  readonly kills: number;
  readonly level: number;
  readonly partySize?: number;
  readonly teamScore?: number;
  readonly teamKills?: number;
  readonly roster?: readonly DailyTeammate[];
}

export type DailyLog = Readonly<Record<string, DailyResult>>;

const pad = (n: number): string => String(n).padStart(2, "0");

/** The player's own calendar day, so the day turns over at their midnight. */
export function dateKeyOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "7 Nov", for the day's label. */
export function dayLabel(key: string): string {
  const [, month, day] = key.split("-").map(Number);
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
    level: townName(night.level),
    difficulty: difficultyDef(night.difficulty).label,
    rule: rule ? `${rule.name}: ${rule.blurb}` : null,
    event: event ? event.name : null
  };
}

function isResult(v: unknown): v is DailyResult {
  const isNotObject = typeof v !== "object" || v === null;
  if (isNotObject) return false;
  const r = v as Record<string, unknown>;
  return ["score", "kills", "level", "attempts", "practiceBest"].every((key) =>
    Number.isFinite(r[key])
  );
}

const isDayKey = (key: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(key);

function parseLog(raw: unknown): Record<string, DailyResult> | null {
  const isNotLog = typeof raw !== "object" || raw === null;
  if (isNotLog) return null;
  const log: Record<string, DailyResult> = {};
  for (const [key, value] of Object.entries(raw)) {
    const isDayEntry = isDayKey(key) && isResult(value);
    if (isDayEntry) log[key] = value;
  }
  return log;
}

/**
 * The log as saved, or, until a level-100 log has been written, the days of the old one carried over:
 * they keep the streak, with their kills, town and attempts but none of their points, which were on
 * the old scale. Today is not carried, so tonight's first run on the new scale is the one that counts.
 */
function readLog(store: Store | null, todayKey: string): DailyLog {
  const saved = parseLog(readJson(store, DAILY_KEY));
  if (saved) return saved;
  const old = parseLog(readJson(store, OLD_DAILY_KEY)) ?? {};
  const carried: Record<string, DailyResult> = {};
  for (const [key, { kills, level, attempts }] of Object.entries(old)) {
    const isToday = key === todayKey;
    if (!isToday)
      carried[key] = { score: 0, kills, level, attempts, practiceBest: 0, carried: true };
  }
  return carried;
}

export function loadDailyLog(
  store: Store | null = browserStore(),
  now: Date = new Date()
): DailyLog {
  return readLog(store, dateKeyOf(now));
}

/** The first run of a day (solo or per party size in MP) is kept as it was; later ones only count as attempts and practice best. */
export function withRun(
  log: DailyLog,
  key: string,
  run: DailyRunInput
): { log: DailyLog; counted: boolean } {
  // A day carried over from before level 100 holds no run on this scale, so the next one is its first.
  const saved = log[key];
  const earlier = saved?.carried ? undefined : saved;
  const isMp = run.partySize !== undefined && run.partySize >= 2 && run.partySize <= 5;

  let nextResult: DailyResult;
  let counted = false;

  if (isMp) {
    const partySize = run.partySize as DailyPartySize;
    const earlierMp = earlier?.mp?.[partySize];
    const isNewMpParty = earlierMp === undefined;
    counted = isNewMpParty;

    const teamScore = run.teamScore ?? run.score;
    const teamKills = run.teamKills ?? run.kills;
    const mpResult: DailyMpRunResult = isNewMpParty
      ? {
          partySize,
          teamScore,
          teamKills,
          playerScore: run.score,
          playerKills: run.kills,
          level: run.level,
          attempts: 1,
          practiceBestTeamScore: 0,
          roster: run.roster
        }
      : {
          ...earlierMp,
          attempts: earlierMp.attempts + 1,
          practiceBestTeamScore: Math.max(earlierMp.practiceBestTeamScore, teamScore),
          roster: run.roster ?? earlierMp.roster
        };

    const nextMp = { ...(earlier?.mp ?? {}), [partySize]: mpResult };
    const earlierAttempts = earlier?.attempts ?? 0;
    const earlierPracticeBest = earlier?.practiceBest ?? 0;
    nextResult = {
      score: earlier?.score ?? run.score,
      kills: earlier?.kills ?? run.kills,
      level: earlier?.level ?? run.level,
      attempts: earlierAttempts + 1,
      practiceBest: earlierPracticeBest,
      solo: earlier?.solo,
      mp: nextMp
    };
  } else {
    const earlierSolo = earlier?.solo ?? (earlier && !earlier.mp ? earlier : undefined);
    const isNewSolo = earlierSolo === undefined;
    counted = isNewSolo;

    const soloResult: DailySoloResult = isNewSolo
      ? {
          score: run.score,
          kills: run.kills,
          level: run.level,
          attempts: 1,
          practiceBest: 0
        }
      : {
          ...earlierSolo,
          attempts: earlierSolo.attempts + 1,
          practiceBest: Math.max(earlierSolo.practiceBest, run.score)
        };

    const nextAttempts = earlier ? earlier.attempts + 1 : 1;
    const nextPracticeBest = isNewSolo
      ? (earlier?.practiceBest ?? 0)
      : Math.max(earlier?.practiceBest ?? 0, run.score);

    nextResult = {
      score: soloResult.score,
      kills: soloResult.kills,
      level: soloResult.level,
      attempts: nextAttempts,
      practiceBest: nextPracticeBest,
      solo: soloResult,
      mp: earlier?.mp
    };
  }

  const kept = Object.keys({ ...log, [key]: nextResult })
    .sort()
    .reverse()
    .slice(0, KEPT_DAYS);
  const next: Record<string, DailyResult> = {};
  for (const day of kept) next[day] = day === key ? nextResult : log[day];
  return { log: next, counted };
}

/** Records a finished daily run and says whether it was the one that counts. */
export function recordDaily(
  key: string,
  run: DailyRunInput,
  store: Store | null = browserStore()
): boolean {
  const { log, counted } = withRun(readLog(store, key), key, run);
  writeJson(store, DAILY_KEY, log);
  return counted;
}

export function soloResultOf(result: DailyResult | null | undefined): DailySoloResult | null {
  if (!result) return null;
  if (result.solo) return result.solo;
  return {
    score: result.score,
    kills: result.kills,
    level: result.level,
    attempts: result.attempts,
    practiceBest: result.practiceBest
  };
}

export function mpResultOf(
  result: DailyResult | null | undefined,
  size?: DailyPartySize
): DailyMpRunResult | null {
  if (!result || !result.mp) return null;
  if (size !== undefined) return result.mp[size] ?? null;
  const sizes = DAILY_PARTY_SIZES.filter((s) => result.mp?.[s]);
  if (sizes.length === 0) return null;
  let best: DailyMpRunResult | null = null;
  for (const s of sizes) {
    const entry = result.mp[s];
    if (entry && (!best || entry.teamScore > best.teamScore)) {
      best = entry;
    }
  }
  return best;
}

function previousKey(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
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
    if (result.carried) continue;
    const isNewBest = !best || result.score > best.result.score;
    if (isNewBest) best = { key, result };
  }
  return best;
}

/** The best counted MP run across all days, or null with none. */
export function bestMpDay(log: DailyLog): { key: string; result: DailyMpRunResult } | null {
  let best: { key: string; result: DailyMpRunResult } | null = null;
  for (const [key, daily] of Object.entries(log)) {
    const mp = mpResultOf(daily);
    if (mp && (!best || mp.teamScore > best.result.teamScore)) {
      best = { key, result: mp };
    }
  }
  return best;
}

/** The last `count` days up to today, newest first, played or not. */
export function recentDays(
  log: DailyLog,
  todayKey: string,
  count = 7
): { key: string; result: DailyResult | null }[] {
  const days: { key: string; result: DailyResult | null }[] = [];
  let day = todayKey;
  for (let i = 0; i < count; i += 1) {
    days.push({ key: day, result: log[day] ?? null });
    day = previousKey(day);
  }
  return days;
}

/** Where the game lives, for the shared line. */
const GAME_URL = "https://undeadofnight.forthexp.com/";

/**
 * A few lines a player can paste anywhere: the day, how far they got, and their streak.
 * Words only, no spoilers about the town beyond its name, so it reads the same to anyone who has not played yet.
 */
export function shareText(
  key: string,
  result: Pick<DailyResult, "score" | "kills" | "level">,
  streak: number,
  url: string = GAME_URL,
  party?: { size: number; teamScore: number }
): string {
  const nights = streak === 1 ? "1 night" : `${streak} nights`;
  const streakLine = streak > 1 ? `\nStreak: ${nights} in a row` : "";
  const partyLine =
    party && party.size > 1
      ? `\nParty: ${party.size} survivors, ${party.teamScore} team points`
      : "";
  return `Undead of Night - Nightly Run, ${dayLabel(key)}\nReached ${townName(result.level)}: ${result.score} points, ${result.kills} kills${partyLine}${streakLine}\n${url}`;
}

/** The day's counted run, ready to share, or null before it is played. */
export function dailyShare(
  key: string,
  store: Store | null = browserStore(),
  partySize?: DailyPartySize
): string | null {
  const log = loadDailyLog(store);
  const counted = log[key];
  if (!counted) return null;
  const streak = streakOf(log, key);
  if (partySize && counted.mp?.[partySize]) {
    const mp = counted.mp[partySize];
    return shareText(
      key,
      { score: mp.playerScore, kills: mp.playerKills, level: mp.level },
      streak,
      GAME_URL,
      { size: mp.partySize, teamScore: mp.teamScore }
    );
  }
  return shareText(key, counted, streak);
}
