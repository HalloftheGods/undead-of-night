import { STATS, STAT_SLOTS, type StatKey } from './character-stats.ts';

export const BASE_STAT_SLOT = 1;
export const MAX_STAT_SLOT = STAT_SLOTS;
export const MAX_CHARACTER_LEVEL = 50;
export const AP_PER_LEVEL = 1;
export const RESPEC_COST_GP = 50;

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

export function createInitialProgression(): ProgressionState {
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
  };
}

export function xpRequiredForLevel(targetLevel: number): number {
  const isFirstLevel = targetLevel <= 1;
  if (isFirstLevel) return 0;
  return Math.floor(100 * Math.pow(1.3, targetLevel - 2));
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

export function addExperience(current: ProgressionState, gainedXp: number): XpGainResult {
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

  const levelsGained = level - current.level;
  const didLevelUp = levelsGained > 0;

  const nextState: ProgressionState = {
    ...current,
    level,
    xp,
    ap: current.ap + earnedAp,
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

  return {
    ...current,
    ap: current.ap - 1,
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
