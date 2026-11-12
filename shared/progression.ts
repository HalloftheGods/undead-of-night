import { STATS, STAT_SLOTS, type StatKey } from './character-stats.ts';

export const BASE_STAT_SLOT = 0;
export const MAX_STAT_SLOT = STAT_SLOTS;
export const MAX_CHARACTER_LEVEL = 100;
export const AP_PER_LEVEL = 1;
export const TOTAL_PIPS_TO_FILL = 20;
export const RESPEC_COST_GP = 50;
export const AP_DECAY_INACTIVITY_MS = 7 * 24 * 60 * 60 * 1000;
export const AP_DECAY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export const SPECIALTY_STAT_BY_SKIN: Readonly<Record<number, StatKey>> = {
  0: 'stealth',
  1: 'reload',
  2: 'speed',
  3: 'strength',
  4: 'search',
};

export interface CharacterAllocation {
  readonly spentAp: Record<StatKey, number>;
}

export interface ProgressionState {
  readonly level: number;
  readonly xp: number;
  readonly ap: number;
  readonly gp: number;
  readonly allocations: Record<number, CharacterAllocation>;
  readonly lastApEarnedAt: number;
  readonly rustySkins: readonly number[];
}

export function defaultCharacterAllocation(): CharacterAllocation {
  return {
    spentAp: {
      stealth: 0,
      reload: 0,
      speed: 0,
      strength: 0,
      search: 0,
    },
  };
}

export function createInitialProgression(now = Date.now()): ProgressionState {
  return {
    level: 1,
    xp: 0,
    ap: 0,
    gp: 0,
    allocations: {
      0: defaultCharacterAllocation(),
      1: defaultCharacterAllocation(),
      2: defaultCharacterAllocation(),
      3: defaultCharacterAllocation(),
      4: defaultCharacterAllocation(),
    },
    lastApEarnedAt: now,
    rustySkins: [],
  };
}

export const PROGRESSION_STORAGE_KEY = 'outbreak.progression';

type ProgressStorage = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): ProgressStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadProgression(store: ProgressStorage | null = browserStorage()): ProgressionState {
  try {
    const raw = store?.getItem(PROGRESSION_STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    const isObject = typeof value === 'object' && value !== null;
    if (!isObject) return createInitialProgression();

    const saved = value as Partial<ProgressionState>;
    const initial = createInitialProgression();
    const level = typeof saved.level === 'number' ? Math.min(MAX_CHARACTER_LEVEL, Math.max(1, Math.floor(saved.level))) : initial.level;
    const xp = typeof saved.xp === 'number' ? Math.max(0, Math.floor(saved.xp)) : initial.xp;
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

    const lastApEarnedAt = typeof saved.lastApEarnedAt === 'number' && Number.isFinite(saved.lastApEarnedAt)
      ? saved.lastApEarnedAt
      : Date.now();
    const rustySkins = Array.isArray(saved.rustySkins)
      ? saved.rustySkins.filter((s): s is number => Number.isInteger(s) && s >= 0 && s < 5)
      : [];

    const baseState: ProgressionState = { level, xp, ap, gp, allocations, lastApEarnedAt, rustySkins };
    const decayResult = applyApDecay(baseState);
    if (decayResult.decayedAp > 0) {
      saveProgression(decayResult.state, store);
    }
    return decayResult.state;
  } catch {
    return createInitialProgression();
  }
}

export interface ApDecayResult {
  readonly state: ProgressionState;
  readonly decayedAp: number;
  readonly newlyRustySkins: readonly number[];
}

export function isCharacterRusty(skin: number, current?: ProgressionState): boolean {
  if (!current?.rustySkins) return false;
  return current.rustySkins.includes(skin);
}

export function applyApDecay(current: ProgressionState, now = Date.now()): ApDecayResult {
  const lastEarned = current.lastApEarnedAt ?? now;
  const elapsedMs = now - lastEarned;
  const isInactive = elapsedMs >= AP_DECAY_INACTIVITY_MS;
  if (!isInactive) {
    return { state: current, decayedAp: 0, newlyRustySkins: [] };
  }

  const periods = Math.floor(elapsedMs / AP_DECAY_INTERVAL_MS);
  const apToDecayRaw = Math.max(1, periods);

  let totalInvestedAp = 0;
  for (const alloc of Object.values(current.allocations)) {
    const spent = Object.values(alloc.spentAp).reduce((sum, v) => sum + v, 0);
    totalInvestedAp += spent;
  }

  const totalPool = current.ap + totalInvestedAp;
  const actualDecay = Math.min(apToDecayRaw, totalPool);
  if (actualDecay <= 0) {
    return { state: current, decayedAp: 0, newlyRustySkins: [] };
  }

  const newlyRustySkins: number[] = [];
  const nextAllocations = { ...current.allocations };
  let refundedAp = 0;

  for (const [skinStr, alloc] of Object.entries(current.allocations)) {
    const skin = Number(skinStr);
    const invested = Object.values(alloc.spentAp).reduce((sum, v) => sum + v, 0);
    const hasInvestedPips = invested > 0;
    if (hasInvestedPips) {
      refundedAp += invested;
      newlyRustySkins.push(skin);
      nextAllocations[skin] = defaultCharacterAllocation();
    }
  }

  const combinedAp = current.ap + refundedAp;
  const finalAp = Math.max(0, combinedAp - actualDecay);
  const finalLevel = Math.max(1, current.level - actualDecay);
  const nextTimestamp = now - (elapsedMs % AP_DECAY_INTERVAL_MS);

  const mergedRusty = Array.from(new Set([...(current.rustySkins ?? []), ...newlyRustySkins]));

  const nextState: ProgressionState = {
    ...current,
    level: finalLevel,
    ap: finalAp,
    lastApEarnedAt: nextTimestamp,
    rustySkins: mergedRusty,
    allocations: nextAllocations,
  };

  return { state: nextState, decayedAp: actualDecay, newlyRustySkins };
}

export function saveProgression(state: ProgressionState, store: ProgressStorage | null = browserStorage()): void {
  try {
    store?.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota or disabled storage errors
  }
}

export function xpRequiredForLevel(targetLevel: number): number {
  const isFirstLevel = targetLevel <= 1;
  if (isFirstLevel) return 0;
  return Math.round(40 * targetLevel ** 1.5);
}

export function totalXpForLevel(level: number): number {
  let accumulated = 0;
  for (let current = 2; current <= level; current++) {
    accumulated += xpRequiredForLevel(current);
  }
  return accumulated;
}

export interface XpGainResult {
  readonly state: ProgressionState;
  readonly levelsGained: number;
  readonly newLevel: number;
  readonly didLevelUp: boolean;
}

export function addExperience(current: ProgressionState, gainedXp: number, now = Date.now()): XpGainResult {
  const isPositiveGain = gainedXp > 0;
  if (!isPositiveGain) {
    return { state: current, levelsGained: 0, newLevel: current.level, didLevelUp: false };
  }

  let level = current.level;
  let xp = current.xp + gainedXp;
  let earnedAp = 0;

  while (level < MAX_CHARACTER_LEVEL) {
    const nextRequirement = xpRequiredForLevel(level + 1);
    const hasEnoughXp = xp >= nextRequirement;
    if (!hasEnoughXp) break;

    xp -= nextRequirement;
    level += 1;
    earnedAp += AP_PER_LEVEL;
  }

  // Nothing is left to buy at the cap, so XP does not pile up there.
  const isAtCap = level >= MAX_CHARACTER_LEVEL;
  if (isAtCap) xp = 0;

  const levelsGained = level - current.level;
  const didLevelUp = levelsGained > 0;
  const nextLastEarned = didLevelUp ? now : (current.lastApEarnedAt ?? now);

  const nextState: ProgressionState = {
    ...current,
    level,
    xp,
    ap: current.ap + earnedAp,
    lastApEarnedAt: nextLastEarned,
  };

  return { state: nextState, levelsGained, newLevel: level, didLevelUp };
}

export function baseStatSlotFor(skin: number, stat: StatKey): number {
  const specialty = SPECIALTY_STAT_BY_SKIN[skin] ?? 'stealth';
  const isSpecialty = stat === specialty;
  return isSpecialty ? MAX_STAT_SLOT : BASE_STAT_SLOT;
}

export function effectiveStatSlots(skin: number, allocation?: CharacterAllocation): Record<StatKey, number> {
  const spent = allocation?.spentAp ?? defaultCharacterAllocation().spentAp;
  const result = {} as Record<StatKey, number>;

  for (const { key } of STATS) {
    const base = baseStatSlotFor(skin, key);
    const invested = spent[key] ?? 0;
    result[key] = Math.min(MAX_STAT_SLOT, base + invested);
  }

  return result;
}

export function canAllocateStat(skin: number, stat: StatKey, current: ProgressionState): boolean {
  const hasAvailableAp = current.ap > 0;
  if (!hasAvailableAp) return false;

  const allocation = current.allocations[skin] ?? defaultCharacterAllocation();
  const currentSlot = baseStatSlotFor(skin, stat) + (allocation.spentAp[stat] ?? 0);
  return currentSlot < MAX_STAT_SLOT;
}

export function allocateStatPoint(skin: number, stat: StatKey, current: ProgressionState): ProgressionState {
  const allowed = canAllocateStat(skin, stat, current);
  if (!allowed) return current;

  const currentAllocation = current.allocations[skin] ?? defaultCharacterAllocation();
  const updatedSpent = {
    ...currentAllocation.spentAp,
    [stat]: (currentAllocation.spentAp[stat] ?? 0) + 1,
  };

  const nextRusty = (current.rustySkins ?? []).filter((s) => s !== skin);

  return {
    ...current,
    ap: current.ap - 1,
    rustySkins: nextRusty,
    allocations: {
      ...current.allocations,
      [skin]: { spentAp: updatedSpent },
    },
  };
}

export type ActionScores = Partial<Record<StatKey, number>>;

/**
 * Chooses the non-maxed stat with the highest action score.
 * Stats already at MAX_STAT_SLOT (like the innate specialty starting at 5) are excluded.
 */
export function pickWinningStat(
  scores: ActionScores,
  skin: number,
  allocation?: CharacterAllocation,
): StatKey | null {
  const slots = effectiveStatSlots(skin, allocation);
  const candidates = STATS.map((s) => s.key).filter((key) => (slots[key] ?? 0) < MAX_STAT_SLOT);
  const hasNoCandidates = candidates.length === 0;
  if (hasNoCandidates) return null;

  let bestStat = candidates[0];
  let bestScore = -1;

  for (const stat of candidates) {
    const score = scores[stat] ?? 0;
    const isHigherScore = score > bestScore;
    if (isHigherScore) {
      bestScore = score;
      bestStat = stat;
    }
  }

  return bestStat;
}

/**
 * Allocates earned AP directly to a survivor's stat up to the pip cap.
 */
export function allocateEarnedAp(
  current: ProgressionState,
  skin: number,
  stat: StatKey,
  amount = 1,
): ProgressionState {
  const isPositive = amount > 0;
  if (!isPositive) return current;

  const currentAllocation = current.allocations[skin] ?? defaultCharacterAllocation();
  const currentSlots = effectiveStatSlots(skin, currentAllocation);
  const currentLevel = currentSlots[stat] ?? 0;
  const availableSpace = Math.max(0, MAX_STAT_SLOT - currentLevel);
  const pointsToApply = Math.min(amount, availableSpace);
  const hasNoPointsToApply = pointsToApply <= 0;
  if (hasNoPointsToApply) return current;

  const updatedSpent = {
    ...currentAllocation.spentAp,
    [stat]: (currentAllocation.spentAp[stat] ?? 0) + pointsToApply,
  };

  const nextRusty = (current.rustySkins ?? []).filter((s) => s !== skin);

  return {
    ...current,
    ap: Math.max(0, current.ap - pointsToApply),
    rustySkins: nextRusty,
    allocations: {
      ...current.allocations,
      [skin]: { spentAp: updatedSpent },
    },
  };
}

export function canRespecCharacter(skin: number, current: ProgressionState): boolean {
  const hasSufficientGp = current.gp >= RESPEC_COST_GP;
  if (!hasSufficientGp) return false;

  const allocation = current.allocations[skin];
  const hasNoAllocation = allocation === undefined;
  if (hasNoAllocation) return false;

  const totalInvested = Object.values(allocation.spentAp).reduce((sum, spent) => sum + spent, 0);
  return totalInvested > 0;
}

export function respecCharacter(skin: number, current: ProgressionState): ProgressionState {
  const allowed = canRespecCharacter(skin, current);
  if (!allowed) return current;

  const allocation = current.allocations[skin] ?? defaultCharacterAllocation();
  const refundedAp = Object.values(allocation.spentAp).reduce((sum, spent) => sum + spent, 0);

  return {
    ...current,
    ap: current.ap + refundedAp,
    gp: current.gp - RESPEC_COST_GP,
    allocations: {
      ...current.allocations,
      [skin]: defaultCharacterAllocation(),
    },
  };
}

export function addGummyPoints(current: ProgressionState, amount: number): ProgressionState {
  const isPositive = amount > 0;
  if (!isPositive) return current;
  return { ...current, gp: current.gp + amount };
}

export function isCharacterMaxed(skin: number, current?: ProgressionState): boolean {
  if (!current) return false;
  const slots = effectiveStatSlots(skin, current.allocations[skin]);
  return STATS.every(({ key }) => (slots[key] ?? 0) >= MAX_STAT_SLOT);
}

export function characterBadgeName(skin: number, baseName: string, current?: ProgressionState): string {
  const isRusty = isCharacterRusty(skin, current);
  if (isRusty) return `Rusty ${baseName}`;
  const isMaxed = isCharacterMaxed(skin, current);
  return isMaxed ? `OP ${baseName}` : baseName;
}

export function characterLevel(skin: number, current?: ProgressionState): number {
  if (!current) return 1;
  const spent = current.allocations[skin]?.spentAp;
  if (!spent) return 1;
  const invested = Object.values(spent).reduce((sum, count) => sum + count, 0);
  return Math.min(1 + TOTAL_PIPS_TO_FILL, 1 + invested);
}
