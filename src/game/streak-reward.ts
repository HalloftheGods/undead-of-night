// The Nightly Run streak, as the kit it earns: which night of the streak a run starts on,
// what that hands out, and what coming back tomorrow would add.

import { nextTier, tiersFor, TOP_STREAK_NIGHT } from "../../shared/streak-kit.ts";
import type { DailyLog } from "./daily-night.ts";
import { dateKeyOf, loadDailyLog, streakOf } from "./daily-night.ts";
import { browserStore } from "./storage.ts";
import type { Store } from "./storage.ts";

/**
 * The night of the streak a run started now belongs to. Today counts once its Nightly Run is played,
 * and until then a run is the night after the streak so far: come back after yesterday's and it is night 2.
 * A missed day leaves the streak at nothing, so it is night 1 again.
 */
export function streakNightOf(log: DailyLog, todayKey: string): number {
  const streak = streakOf(log, todayKey);
  return log[todayKey] ? streak : streak + 1;
}

/** Tonight's night of the streak, read off the save. */
export function tonightsStreakNight(
  now: Date = new Date(),
  store: Store | null = browserStore()
): number {
  return streakNightOf(loadDailyLog(store, now), dateKeyOf(now));
}

/** Everything the kit for this night adds, in one line, or null on a night that adds nothing. */
export function kitWords(night: number): string | null {
  const tiers = tiersFor(night);
  const hasKit = tiers.length > 0;
  if (!hasKit) return null;
  return tiers
    .map((tier, i) =>
      i === 0 ? tier.words : tier.words.charAt(0).toLowerCase() + tier.words.slice(1)
    )
    .join(", ");
}

/** The level card's line at the start of a run, or null with no kit to speak of. */
export function streakCardLine(night: number): string | null {
  const words = kitWords(night);
  return words === null ? null : `Night ${night} streak kit: ${words}`;
}

/** What the Nightly Run page says about the kit: tonight's, and the next one still to earn. */
export interface StreakRewardView {
  readonly night: number;
  /** Tonight's kit, or null on night 1. */
  readonly tonight: string | null;
  /** The next step up and the night it comes on, or null at the top. */
  readonly next: { readonly night: number; readonly words: string } | null;
  /** Whether today's Nightly Run is still to play, which is what keeps the streak going. */
  readonly todayOpen: boolean;
  readonly top: boolean;
}

export function streakReward(log: DailyLog, todayKey: string): StreakRewardView {
  const night = streakNightOf(log, todayKey);
  const next = nextTier(night);
  return {
    night,
    tonight: kitWords(night),
    next: next ? { night: next.night, words: next.words } : null,
    todayOpen: log[todayKey] === undefined,
    top: night >= TOP_STREAK_NIGHT
  };
}
