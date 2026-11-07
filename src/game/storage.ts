const BEST_KEY = 'outbreak.best';
const PREFS_KEY = 'outbreak.prefs';
const LEADERBOARD_KEY = 'outbreak.leaderboard';
const MAX_LEADERBOARD_ENTRIES = 5;

export interface BestRun {
  readonly score: number;
  /** Hordes survived to the end. Runs saved by older builds counted the horde that killed them too. */
  readonly wave: number;
  readonly kills: number;
  readonly durationSec: number;
}

export interface LeaderboardEntry {
  readonly callsign: string;
  readonly score: number;
  readonly wave: number;
  readonly kills: number;
  readonly durationSec: number;
  readonly timestamp: number;
}

/** Volume and mute live with the audio engine, which persists its own. */
export interface Prefs {
  readonly callsign: string;
  readonly serverAddress: string;
}

export const DEFAULT_PREFS: Prefs = { callsign: '', serverAddress: '' };

export type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** localStorage can throw on access alone in a private window or a locked-down frame. */
export function browserStore(): Store | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readJson(store: Store | null, key: string): unknown {
  try {
    const raw = store?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeJson(store: Store | null, key: string, value: unknown): void {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    // chemx-allow: best-effort a best run that does not persist is not worth interrupting a game over for
  }
}

function isBestRun(v: unknown): v is BestRun {
  const isObject = typeof v === 'object' && v !== null;
  if (!isObject) return false;
  const run = v as Record<string, unknown>;
  return ['score', 'wave', 'kills', 'durationSec'].every((key) => Number.isFinite(run[key]));
}

function isLeaderboardEntry(v: unknown): v is LeaderboardEntry {
  const isObject = typeof v === 'object' && v !== null;
  if (!isObject) return false;
  const entry = v as Record<string, unknown>;
  const hasStringCallsign = typeof entry.callsign === 'string';
  const hasValidNumbers = ['score', 'wave', 'kills', 'durationSec', 'timestamp'].every((key) => Number.isFinite(entry[key]));
  return hasStringCallsign && hasValidNumbers;
}

export function loadBest(store: Store | null = browserStore()): BestRun | null {
  const value = readJson(store, BEST_KEY);
  return isBestRun(value) ? value : null;
}

export function loadLeaderboard(store: Store | null = browserStore()): LeaderboardEntry[] {
  const value = readJson(store, LEADERBOARD_KEY);
  const isArray = Array.isArray(value);
  if (isArray) {
    return value.filter(isLeaderboardEntry);
  }
  const best = loadBest(store);
  const hasBest = best !== null && (best.score > 0 || best.wave > 0);
  if (!hasBest) return [];
  const prefs = loadPrefs(store);
  const fallbackCallsign = prefs.callsign.trim() || 'SURVIVOR';
  return [
    {
      callsign: fallbackCallsign,
      score: best.score,
      wave: best.wave,
      kills: best.kills,
      durationSec: best.durationSec,
      timestamp: Date.now(),
    },
  ];
}

export function recordLeaderboardEntry(
  entry: LeaderboardEntry,
  store: Store | null = browserStore()
): LeaderboardEntry[] {
  const list = loadLeaderboard(store);
  list.push(entry);
  list.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    const isScoreTie = scoreDiff !== 0;
    if (isScoreTie) return scoreDiff;
    const waveDiff = b.wave - a.wave;
    const isWaveTie = waveDiff !== 0;
    if (isWaveTie) return waveDiff;
    return b.kills - a.kills;
  });
  const trimmed = list.slice(0, MAX_LEADERBOARD_ENTRIES);
  writeJson(store, LEADERBOARD_KEY, trimmed);
  return trimmed;
}

export function beatsBest(run: BestRun, best: BestRun | null): boolean {
  if (!best) return run.score > 0 || run.wave > 0;
  const hasHigherScore = run.score > best.score;
  const isTiedScoreWithMoreWaves = run.score === best.score && run.wave > best.wave;
  return hasHigherScore || isTiedScoreWithMoreWaves;
}

/** Stores the run if it is a new best, and reports whether it was. */
export function recordRun(
  run: BestRun,
  store: Store | null = browserStore(),
  callsign: string = 'SURVIVOR'
): boolean {
  const hasQualifyingRun = run.score > 0 || run.wave > 0;
  if (hasQualifyingRun) {
    recordLeaderboardEntry(
      {
        callsign: callsign.trim() || 'SURVIVOR',
        score: run.score,
        wave: run.wave,
        kills: run.kills,
        durationSec: run.durationSec,
        timestamp: Date.now(),
      },
      store
    );
  }
  const isNewBest = beatsBest(run, loadBest(store));
  if (!isNewBest) return false;
  writeJson(store, BEST_KEY, run);
  return true;
}

export function loadPrefs(store: Store | null = browserStore()): Prefs {
  const value = readJson(store, PREFS_KEY);
  const isObject = typeof value === 'object' && value !== null;
  if (!isObject) return DEFAULT_PREFS;
  const saved = value as Partial<Record<keyof Prefs, unknown>>;
  const isCallsignString = typeof saved.callsign === 'string';
  const isServerString = typeof saved.serverAddress === 'string';
  return {
    callsign: isCallsignString ? (saved.callsign as string) : DEFAULT_PREFS.callsign,
    serverAddress: isServerString ? (saved.serverAddress as string) : DEFAULT_PREFS.serverAddress,
  };
}

export function savePrefs(prefs: Prefs, store: Store | null = browserStore()): void {
  writeJson(store, PREFS_KEY, prefs);
}
