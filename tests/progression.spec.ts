import { describe, expect, it } from 'vitest';
import {
  addExperience,
  allocateStatPoint,
  baseStatSlotFor,
  canAllocateStat,
  canRespecCharacter,
  createInitialProgression,
  effectiveStatSlots,
  respecCharacter,
  xpRequiredForLevel,
} from '../shared/progression.ts';

describe('Progression Core Logic', () => {
  it('initializes with level 1, 0 XP, 0 AP, and 0 GP', () => {
    const progression = createInitialProgression();
    expect(progression.level).toBe(1);
    expect(progression.xp).toBe(0);
    expect(progression.ap).toBe(0);
    expect(progression.gp).toBe(0);
  });

  it('calculates baseline slots: 5 for specialty, 1 for other stats', () => {
    // Night: specialty is stealth
    expect(baseStatSlotFor(0, 'stealth')).toBe(5);
    expect(baseStatSlotFor(0, 'reload')).toBe(1);
    expect(baseStatSlotFor(0, 'speed')).toBe(1);

    // Bear: specialty is reload
    expect(baseStatSlotFor(1, 'reload')).toBe(5);
    expect(baseStatSlotFor(1, 'stealth')).toBe(1);

    // Kat: specialty is speed
    expect(baseStatSlotFor(2, 'speed')).toBe(5);

    // Rex: specialty is strength
    expect(baseStatSlotFor(3, 'strength')).toBe(5);

    // Kai: specialty is search
    expect(baseStatSlotFor(4, 'search')).toBe(5);
  });

  it('grants AP and levels up when XP threshold is met', () => {
    const start = createInitialProgression();
    const reqLevel2 = xpRequiredForLevel(2);
    expect(reqLevel2).toBe(100);

    const result = addExperience(start, 150);
    expect(result.didLevelUp).toBe(true);
    expect(result.levelsGained).toBe(1);
    expect(result.newLevel).toBe(2);
    expect(result.state.level).toBe(2);
    expect(result.state.xp).toBe(50);
    expect(result.state.ap).toBe(1);
  });

  it('allows spending AP to increase stat slots up to max 5', () => {
    const base = createInitialProgression();
    const leveled = addExperience(base, 100).state; // Level 2 with 1 AP
    expect(leveled.ap).toBe(1);

    // Night (skin 0) cannot allocate stealth because it is already maxed (5)
    expect(canAllocateStat(0, 'stealth', leveled)).toBe(false);

    // Night can allocate reload (starts at 1)
    expect(canAllocateStat(0, 'reload', leveled)).toBe(true);
    const allocated = allocateStatPoint(0, 'reload', leveled);
    expect(allocated.ap).toBe(0);
    expect(allocated.allocations[0].spentAp.reload).toBe(1);

    const slots = effectiveStatSlots(0, allocated.allocations[0]);
    expect(slots.stealth).toBe(5);
    expect(slots.reload).toBe(2);
    expect(slots.speed).toBe(1);
  });

  it('handles respec with GP cost refunding AP', () => {
    let state = createInitialProgression();
    // Give 2 levels and 50 GP
    state = addExperience(state, 300).state;
    state = { ...state, gp: 50 };
    expect(state.ap).toBeGreaterThanOrEqual(2);

    const apBefore = state.ap;
    state = allocateStatPoint(0, 'reload', state);
    state = allocateStatPoint(0, 'speed', state);
    expect(state.ap).toBe(apBefore - 2);

    expect(canRespecCharacter(0, state)).toBe(true);
    const respec = respecCharacter(0, state);
    expect(respec.gp).toBe(0);
    expect(respec.ap).toBe(apBefore);
    expect(respec.allocations[0].spentAp.reload).toBe(0);
    expect(respec.allocations[0].spentAp.speed).toBe(0);
  });
});
