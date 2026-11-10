import { describe, expect, it } from 'vitest';
import {
  createInitialActionSkills,
  headshotMarginBonus,
  maxStaminaBonusFactor,
  progressToNextRank,
  rankForSkill,
  recordSkillAction,
  reloadSpeedFactor,
  searchSpeedFactor,
  shoveForceBonusFactor,
  spreadReductionFactor,
} from '../shared/action-skills.ts';

describe('Action-Based Skill Proficiencies', () => {
  it('initializes all skill action counts at zero and rank 0', () => {
    const skills = createInitialActionSkills();
    expect(skills.counts.marksmanship).toBe(0);
    expect(skills.counts.reloading).toBe(0);
    expect(skills.counts.endurance).toBe(0);
    expect(rankForSkill('marksmanship', 0)).toBe(0);
  });

  it('advances rank according to action thresholds', () => {
    expect(rankForSkill('marksmanship', 10)).toBe(0);
    expect(rankForSkill('marksmanship', 25)).toBe(1);
    expect(rankForSkill('marksmanship', 75)).toBe(2);
    expect(rankForSkill('marksmanship', 150)).toBe(3);
    expect(rankForSkill('marksmanship', 300)).toBe(4);
    expect(rankForSkill('marksmanship', 500)).toBe(5);
    expect(rankForSkill('marksmanship', 1000)).toBe(5);
  });

  it('calculates progress ratios towards the next tier', () => {
    // 0 to 25
    const zeroProgress = progressToNextRank('marksmanship', 0);
    expect(zeroProgress.current).toBe(0);
    expect(zeroProgress.next).toBe(25);
    expect(zeroProgress.ratio).toBe(0);

    const halfProgress = progressToNextRank('marksmanship', 12);
    expect(halfProgress.ratio).toBeCloseTo(0.48, 2);

    const maxProgress = progressToNextRank('marksmanship', 600);
    expect(maxProgress.ratio).toBe(1.0);
  });

  it('calculates proficiency benefit factors', () => {
    // Marksmanship rank 5: 1 - (5 * 0.08) = 0.60 (40% spread reduction)
    expect(spreadReductionFactor(500)).toBeCloseTo(0.60, 2);
    expect(headshotMarginBonus(500)).toBeCloseTo(2.0, 2);

    // Reloading rank 5: 1 - (5 * 0.03) = 0.85 (15% faster reload)
    expect(reloadSpeedFactor(400)).toBeCloseTo(0.85, 2);

    // Endurance rank 5: 1 + (5 * 0.05) = 1.25 (25% more stamina)
    expect(maxStaminaBonusFactor(2000)).toBeCloseTo(1.25, 2);

    // Scavenging rank 5: 1 + (5 * 0.06) = 1.30 (30% faster search)
    expect(searchSpeedFactor(300)).toBeCloseTo(1.30, 2);

    // Strength rank 5: 1 + (5 * 0.08) = 1.40 (40% more shove force)
    expect(shoveForceBonusFactor(350)).toBeCloseTo(1.40, 2);
  });

  it('records actions immutably', () => {
    const initial = createInitialActionSkills();
    const updated = recordSkillAction(initial, 'marksmanship', 5);
    expect(updated.counts.marksmanship).toBe(5);
    expect(initial.counts.marksmanship).toBe(0);
  });
});
