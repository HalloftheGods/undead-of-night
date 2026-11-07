// What a trip's end leaves behind on this machine: the best trip, and the ending's screen.

import type { TripReceipt } from '../../shared/home-protocol.ts';
import type { GameOverStats } from '../../shared/protocol.ts';
import type { RunResult } from './hud-state.ts';
import { beatsBest, loadBest, recordLeaderboardEntry } from './storage.ts';
import type { BestRun, LeaderboardEntry } from './storage.ts';

const FALLBACK_CALLSIGN = 'SURVIVOR';
/** Apart from `outbreak.best`, which may hold a whole run's hordes that a trip's cannot be compared to. */
const BEST_TRIP_KEY = 'outbreak.best-trip';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export type BestTrip = BestRun & TripMarked;

/** Marks a record as one trip, so the Records page can tell it from a whole run played before the bunker. */
interface TripMarked {
  readonly trip: true;
}

function browserStore(): Store | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isBestTrip(value: unknown): value is BestTrip {
  const isObject = typeof value === 'object' && value !== null;
  if (!isObject) return false;
  const run = value as Record<string, unknown>;
  const numbers = ['score', 'wave', 'kills', 'durationSec'].every((key) => Number.isFinite(run[key]));
  return numbers && run.trip === true;
}

/** The best single trip, which a returning player's old best run never stands in for. */
export function loadBestTrip(store: Store | null = browserStore()): BestTrip | null {
  try {
    const raw = store?.getItem(BEST_TRIP_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return isBestTrip(value) ? value : null;
  } catch {
    return null;
  }
}

/** Each style's own best: a whole Arcade run and a single Campaign trip are never compared. */
export function loadBests(): { readonly best: BestRun | null; readonly bestTrip: BestTrip | null } {
  return { best: loadBest(), bestTrip: loadBestTrip() };
}

function saveBestTrip(store: Store, run: BestTrip): void {
  try {
    store.setItem(BEST_TRIP_KEY, JSON.stringify(run));
  } catch {
    // chemx-allow: best-effort a best that does not persist is not worth interrupting the trip's end for
  }
}

/**
 * Records a trip from its receipt, banked or not, and reports whether it is the new best trip.
 * Score, kills and hordes count per trip, so it is compared only with other trips.
 */
export function recordTrip(receipt: TripReceipt, callsign: string): boolean {
  const store = browserStore();
  if (!store) return false;
  const { score, kills, hordes, seconds } = receipt;
  const run: BestTrip = { score, kills, wave: hordes, durationSec: seconds, trip: true };
  const qualifies = score > 0 || hordes > 0;
  if (qualifies) {
    const entry: LeaderboardEntry & TripMarked = { ...run, callsign: callsign.trim() || FALLBACK_CALLSIGN, timestamp: Date.now() };
    recordLeaderboardEntry(entry, store);
  }
  const isNewBest = beatsBest(run, loadBestTrip(store));
  if (isNewBest) saveBestTrip(store, run);
  return isNewBest;
}

export interface Survivor {
  readonly id: string;
  readonly name: string;
  readonly skin: number;
}

/** The ending's tally, worded from the receipt that carried it. */
export function endingResult(receipt: TripReceipt, survivor: Survivor, isNewBest: boolean): RunResult {
  const { score, kills, hordes, seconds, difficulty, level } = receipt;
  const stats: GameOverStats = {
    outcome: 'victory',
    difficulty,
    level,
    wave: hordes,
    durationSec: seconds,
    players: [{ ...survivor, kills, score }],
  };
  return { stats, localId: survivor.id, score, kills, isNewBest };
}
