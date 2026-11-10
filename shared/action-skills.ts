export type ActionSkillKey = 'marksmanship' | 'reloading' | 'endurance' | 'scavenging' | 'strength';

export interface ActionSkillState {
  readonly counts: Record<ActionSkillKey, number>;
}

export const MAX_SKILL_RANK = 5;

const ACTIONS_PER_RANK: Readonly<Record<ActionSkillKey, readonly number[]>> = {
  marksmanship: [25, 75, 150, 300, 500],
  reloading: [20, 60, 120, 240, 400],
  endurance: [100, 300, 600, 1200, 2000],
  scavenging: [15, 45, 90, 180, 300],
  strength: [20, 50, 100, 200, 350],
};

export function createInitialActionSkills(): ActionSkillState {
  return {
    counts: {
      marksmanship: 0,
      reloading: 0,
      endurance: 0,
      scavenging: 0,
      strength: 0,
    },
  };
}

export function rankForSkill(key: ActionSkillKey, count: number): number {
  const thresholds = ACTIONS_PER_RANK[key];
  for (let rank = thresholds.length; rank > 0; rank--) {
    const threshold = thresholds[rank - 1];
    const isRankReached = count >= threshold;
    if (isRankReached) return rank;
  }
  return 0;
}

export function progressToNextRank(key: ActionSkillKey, count: number): { current: number; next: number; ratio: number } {
  const currentRank = rankForSkill(key, count);
  const thresholds = ACTIONS_PER_RANK[key];
  const isMaxRank = currentRank >= MAX_SKILL_RANK;

  if (isMaxRank) {
    const topThreshold = thresholds[MAX_SKILL_RANK - 1];
    return { current: topThreshold, next: topThreshold, ratio: 1.0 };
  }

  const prevThreshold = currentRank === 0 ? 0 : thresholds[currentRank - 1];
  const nextThreshold = thresholds[currentRank];
  const span = nextThreshold - prevThreshold;
  const progressInTier = Math.max(0, count - prevThreshold);
  const ratio = Math.min(1.0, progressInTier / span);

  return { current: count, next: nextThreshold, ratio };
}

export function recordSkillAction(current: ActionSkillState, key: ActionSkillKey, delta = 1): ActionSkillState {
  const isPositiveDelta = delta > 0;
  if (!isPositiveDelta) return current;

  const currentCount = current.counts[key] ?? 0;
  return {
    counts: {
      ...current.counts,
      [key]: currentCount + delta,
    },
  };
}

export function spreadReductionFactor(marksmanshipCount: number): number {
  const rank = rankForSkill('marksmanship', marksmanshipCount);
  return 1 - (rank * 0.08);
}

export function headshotMarginBonus(marksmanshipCount: number): number {
  const rank = rankForSkill('marksmanship', marksmanshipCount);
  return rank * 0.4;
}

export function reloadSpeedFactor(reloadingCount: number): number {
  const rank = rankForSkill('reloading', reloadingCount);
  return 1 - (rank * 0.03);
}

export function maxStaminaBonusFactor(enduranceCount: number): number {
  const rank = rankForSkill('endurance', enduranceCount);
  return 1 + (rank * 0.05);
}

export function searchSpeedFactor(scavengingCount: number): number {
  const rank = rankForSkill('scavenging', scavengingCount);
  return 1 + (rank * 0.06);
}

export function shoveForceBonusFactor(strengthCount: number): number {
  const rank = rankForSkill('strength', strengthCount);
  return 1 + (rank * 0.08);
}
