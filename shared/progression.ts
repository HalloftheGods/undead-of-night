import { STATS, STAT_SLOTS, type StatKey } from './character-stats.ts';

export const BASE_STAT_SLOT = 0;
export const MAX_STAT_SLOT = STAT_SLOTS;
export const MAX_CHARACTER_LEVEL = 100;
export const AP_PER_LEVEL = 1;
export const TOTAL_PIPS_TO_FILL = 20;
export const RESPEC_COST_GP = 50;
/** Saves without a version were written on the 21-level curve and are migrated once on load. */
export const PROGRESSION_VERSION = 2;
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
  readonly version: typeof PROGRESSION_VERSION;
  readonly level: number;
  readonly xp: number;
  readonly ap: number;
  /** Pips lost to upkeep and not yet earned back. A level-up repays one. */
  readonly owedAp: number;
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
    version: PROGRESSION_VERSION,
    level: 1,
    xp: 0,
    ap: 0,
    owedAp: 0,
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

export interface ApDecayResult {
  readonly state: ProgressionState;
  readonly decayedAp: number;
  readonly newlyRustySkins: readonly number[];
}

export function isCharacterRusty(skin: number, current?: ProgressionState): boolean {
  if (!current?.rustySkins) return false;
  // Level 100 keeps every survivor at their best for good.
  const isAtCap = current.level >= MAX_CHARACTER_LEVEL;
  if (isAtCap) return false;
  return current.rustySkins.includes(skin);
}

const investedPips = (allocation: CharacterAllocation): number =>
  Object.values(allocation.spentAp).reduce((sum, pips) => sum + pips, 0);

/**
 * Takes one pip for a missed week and owes it back. Banked AP goes first; after that the
 * survivor with the most invested pips loses one from their fullest stat and goes Rusty.
 * Ties go to the lowest skin, then the order of STATS. Returns `current` itself when nothing is left to lose.
 */
export function loseOnePip(current: ProgressionState): ProgressionState {
  const hasBankedAp = current.ap > 0;
  if (hasBankedAp) return { ...current, ap: current.ap - 1, owedAp: current.owedAp + 1 };

  let skin = -1;
  let most = 0;
  const skins = Object.keys(current.allocations).map(Number).sort((a, b) => a - b);
  for (const candidate of skins) {
    const invested = investedPips(current.allocations[candidate]);
    const isFuller = invested > most;
    if (isFuller) {
      most = invested;
      skin = candidate;
    }
  }
  const nothingInvested = skin < 0;
  if (nothingInvested) return current;

  const spent = current.allocations[skin].spentAp;
  let stat: StatKey = STATS[0].key;
  for (const { key } of STATS) {
    const isFuller = (spent[key] ?? 0) > (spent[stat] ?? 0);
    if (isFuller) stat = key;
  }

  const alreadyRusty = current.rustySkins.includes(skin);
  return {
    ...current,
    owedAp: current.owedAp + 1,
    rustySkins: alreadyRusty ? current.rustySkins : [...current.rustySkins, skin],
    allocations: { ...current.allocations, [skin]: { spentAp: { ...spent, [stat]: spent[stat] - 1 } } },
  };
}

/** Upkeep: one pip is lost for each full week since the last level-up. The level never drops, and level 100 is exempt. */
export function applyApDecay(current: ProgressionState, now = Date.now()): ApDecayResult {
  const untouched: ApDecayResult = { state: current, decayedAp: 0, newlyRustySkins: [] };
  const isAtCap = current.level >= MAX_CHARACTER_LEVEL;
  if (isAtCap) return untouched;

  const elapsedMs = now - (current.lastApEarnedAt ?? now);
  const weeks = Math.floor(elapsedMs / AP_DECAY_INTERVAL_MS);
  const withinTheWeek = weeks < 1;
  if (withinTheWeek) return untouched;

  let state = current;
  let decayedAp = 0;
  const newlyRustySkins: number[] = [];
  for (let week = 0; week < weeks; week++) {
    const next = loseOnePip(state);
    const nothingLeft = next === state;
    if (nothingLeft) break;
    const wentRusty = next.rustySkins.find((skin) => !state.rustySkins.includes(skin));
    if (wentRusty !== undefined) newlyRustySkins.push(wentRusty);
    decayedAp += 1;
    state = next;
  }

  // The timer moves on by whole weeks even with nothing left to take, so the same moment is never charged twice.
  const lastApEarnedAt = current.lastApEarnedAt + weeks * AP_DECAY_INTERVAL_MS;
  return { state: { ...state, lastApEarnedAt }, decayedAp, newlyRustySkins };
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
  /** AP paid by this gain: one per level, plus one owed AP repaid per level while any is owed. */
  readonly apEarned: number;
  readonly newLevel: number;
  readonly didLevelUp: boolean;
}

export function addExperience(current: ProgressionState, gainedXp: number, now = Date.now()): XpGainResult {
  const isPositiveGain = gainedXp > 0;
  if (!isPositiveGain) {
    return { state: current, levelsGained: 0, apEarned: 0, newLevel: current.level, didLevelUp: false };
  }

  let level = current.level;
  let xp = current.xp + gainedXp;
  let earnedAp = 0;
  let owedAp = current.owedAp;

  while (level < MAX_CHARACTER_LEVEL) {
    const nextRequirement = xpRequiredForLevel(level + 1);
    const hasEnoughXp = xp >= nextRequirement;
    if (!hasEnoughXp) break;

    xp -= nextRequirement;
    level += 1;
    earnedAp += AP_PER_LEVEL;
    const repays = owedAp > 0;
    if (repays) {
      owedAp -= 1;
      earnedAp += 1;
    }
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
    owedAp,
    lastApEarnedAt: nextLastEarned,
  };

  return { state: nextState, levelsGained, apEarned: earnedAp, newLevel: level, didLevelUp };
}

export function baseStatSlotFor(skin: number, stat: StatKey): number {
  const specialty = SPECIALTY_STAT_BY_SKIN[skin] ?? 'stealth';
  const isSpecialty = stat === specialty;
  return isSpecialty ? MAX_STAT_SLOT : BASE_STAT_SLOT;
}

/** The bars a survivor shows. At level 100 every bar is full whatever the save holds: 99 AP cannot buy all 100 pips. */
export function effectiveStatSlots(skin: number, allocation: CharacterAllocation | undefined, level: number): Record<StatKey, number> {
  const isAtCap = level >= MAX_CHARACTER_LEVEL;
  if (!isAtCap) return investedStatSlots(skin, allocation);
  const full = {} as Record<StatKey, number>;
  for (const { key } of STATS) full[key] = MAX_STAT_SLOT;
  return full;
}

/** The innate specialty plus the pips the save holds, which is what earned AP is spent against. */
function investedStatSlots(skin: number, allocation?: CharacterAllocation): Record<StatKey, number> {
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
  const isAtCap = current.level >= MAX_CHARACTER_LEVEL;
  if (isAtCap) return false;

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
  const slots = investedStatSlots(skin, allocation);
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
  const currentSlots = investedStatSlots(skin, currentAllocation);
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
  const slots = effectiveStatSlots(skin, current.allocations[skin], current.level);
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
  const isAtCap = current.level >= MAX_CHARACTER_LEVEL;
  if (isAtCap) return 1 + TOTAL_PIPS_TO_FILL;
  const spent = current.allocations[skin]?.spentAp;
  if (!spent) return 1;
  const invested = Object.values(spent).reduce((sum, count) => sum + count, 0);
  return Math.min(1 + TOTAL_PIPS_TO_FILL, 1 + invested);
}
