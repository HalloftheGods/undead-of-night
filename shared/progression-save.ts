// The progression save: reading it out of browser storage (and migrating an old one), writing it back,
// and the between-runs upkeep check that does both. The rules themselves are in progression.ts.

import {
  applyApDecay,
  createInitialProgression,
  MAX_CHARACTER_LEVEL,
  PROGRESSION_VERSION,
  type ApDecayResult,
  type CharacterAllocation,
  type ProgressionState,
} from './progression.ts';

export const PROGRESSION_STORAGE_KEY = 'outbreak.progression';

export type ProgressStorage = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): ProgressStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Reads the save as it stands: migrates an old one and clamps its clock, but never decays and never writes. */
export function loadProgression(store: ProgressStorage | null = browserStorage(), now = Date.now()): ProgressionState {
  try {
    const raw = store?.getItem(PROGRESSION_STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    const isObject = typeof value === 'object' && value !== null;
    if (!isObject) return createInitialProgression(now);

    const saved = value as Partial<Omit<ProgressionState, 'version'>> & { version?: unknown };
    const initial = createInitialProgression(now);
    // The old curve's XP means nothing on the new one, and the old timer would cost a returning player pips at once.
    const isOldCurveSave = saved.version === undefined;
    const level = typeof saved.level === 'number' ? Math.min(MAX_CHARACTER_LEVEL, Math.max(1, Math.floor(saved.level))) : initial.level;
    const savedXp = typeof saved.xp === 'number' ? Math.max(0, Math.floor(saved.xp)) : initial.xp;
    const xp = isOldCurveSave ? 0 : savedXp;
    const savedOwed = typeof saved.owedAp === 'number' && Number.isFinite(saved.owedAp) ? Math.max(0, Math.floor(saved.owedAp)) : 0;
    const owedAp = isOldCurveSave ? 0 : savedOwed;
    const ap = typeof saved.ap === 'number' ? Math.max(0, Math.floor(saved.ap)) : initial.ap;
    const gp = typeof saved.gp === 'number' ? Math.max(0, Math.floor(saved.gp)) : initial.gp;
    const allocations = { ...initial.allocations };

    if (saved.allocations && typeof saved.allocations === 'object') {
      for (const [skinStr, alloc] of Object.entries(saved.allocations)) {
        const skin = Number(skinStr);
        if (Number.isInteger(skin) && skin >= 0 && skin < 5 && alloc && typeof alloc === 'object') {
          const spent = (alloc as CharacterAllocation).spentAp ?? {};
          allocations[skin] = {
            spentAp: {
              stealth: Math.max(0, Math.min(5, Math.floor(spent.stealth ?? 0))),
              reload: Math.max(0, Math.min(5, Math.floor(spent.reload ?? 0))),
              speed: Math.max(0, Math.min(5, Math.floor(spent.speed ?? 0))),
              strength: Math.max(0, Math.min(5, Math.floor(spent.strength ?? 0))),
              search: Math.max(0, Math.min(5, Math.floor(spent.search ?? 0))),
            },
          };
        }
      }
    }

    const hasSavedTimer = typeof saved.lastApEarnedAt === 'number' && Number.isFinite(saved.lastApEarnedAt);
    // A clock set forward and back again must not buy a timer that never runs out.
    const savedTimer = hasSavedTimer ? Math.min(now, saved.lastApEarnedAt as number) : now;
    const lastApEarnedAt = isOldCurveSave ? now : savedTimer;
    const rustySkins = Array.isArray(saved.rustySkins)
      ? saved.rustySkins.filter((s): s is number => Number.isInteger(s) && s >= 0 && s < 5)
      : [];

    const baseState: ProgressionState = { version: PROGRESSION_VERSION, level, xp, ap, owedAp, gp, allocations, lastApEarnedAt, rustySkins };
    return baseState;
  } catch {
    return createInitialProgression(now);
  }
}

/**
 * Charges the weeks missed since the last level-up and saves the result. Called where a player
 * is between runs (title, setup, run start), never on a kill, so pips do not vanish mid-run.
 * It always saves, which is also what writes a migrated save back.
 */
export function checkApUpkeep(store: ProgressStorage | null = browserStorage(), now = Date.now()): ApDecayResult {
  const result = applyApDecay(loadProgression(store, now), now);
  saveProgression(result.state, store);
  return result;
}

export function saveProgression(state: ProgressionState, store: ProgressStorage | null = browserStorage()): void {
  try {
    store?.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota or disabled storage errors
  }
}
