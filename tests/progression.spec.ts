import { describe, expect, it } from 'vitest';
import { GameSimulation } from '../shared/simulation.ts';
import { applyBagCommit } from '../shared/bag-sim.ts';
import {
  MAX_CHARACTER_LEVEL,
  addExperience,
  allocateEarnedAp,
  allocateStatPoint,
  applyApDecay,
  AP_DECAY_INACTIVITY_MS,
  AP_DECAY_INTERVAL_MS,
  baseStatSlotFor,
  canAllocateStat,
  canRespecCharacter,
  characterBadgeName,
  characterLevel,
  createInitialProgression,
  effectiveStatSlots,
  isCharacterMaxed,
  isCharacterRusty,
  loadProgression,
  pickWinningStat,
  respecCharacter,
  saveProgression,
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

  it('calculates baseline slots: 5 for specialty, 0 for other stats', () => {
    // Night: specialty is stealth
    expect(baseStatSlotFor(0, 'stealth')).toBe(5);
    expect(baseStatSlotFor(0, 'reload')).toBe(0);
    expect(baseStatSlotFor(0, 'speed')).toBe(0);

    // Bear: specialty is reload
    expect(baseStatSlotFor(1, 'reload')).toBe(5);
    expect(baseStatSlotFor(1, 'stealth')).toBe(0);

    // Kat: specialty is speed
    expect(baseStatSlotFor(2, 'speed')).toBe(5);

    // Rex: specialty is strength
    expect(baseStatSlotFor(3, 'strength')).toBe(5);

    // Kai: specialty is search
    expect(baseStatSlotFor(4, 'search')).toBe(5);
  });

  it('grants AP and levels up when XP threshold is met up to Level 21', () => {
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

    // Giant XP boost caps at Level 21 with 20 AP earned
    const capped = addExperience(start, 999999);
    expect(capped.newLevel).toBe(MAX_CHARACTER_LEVEL);
    expect(capped.newLevel).toBe(21);
    expect(capped.state.ap).toBe(20);
  });

  it('allows spending AP to increase stat slots up to max 5', () => {
    const base = createInitialProgression();
    const leveled = addExperience(base, 100).state; // Level 2 with 1 AP
    expect(leveled.ap).toBe(1);

    // Night (skin 0) cannot allocate stealth because it is already maxed (5)
    expect(canAllocateStat(0, 'stealth', leveled)).toBe(false);

    // Night can allocate reload (starts at 0)
    expect(canAllocateStat(0, 'reload', leveled)).toBe(true);
    const allocated = allocateStatPoint(0, 'reload', leveled);
    expect(allocated.ap).toBe(0);
    expect(allocated.allocations[0].spentAp.reload).toBe(1);

    const slots = effectiveStatSlots(0, allocated.allocations[0]);
    expect(slots.stealth).toBe(5);
    expect(slots.reload).toBe(1);
    expect(slots.speed).toBe(0);
  });

  it('recognizes maxed out survivor and crowns them with OP badge', () => {
    let state = createInitialProgression();
    expect(isCharacterMaxed(0, state)).toBe(false);
    expect(characterLevel(0, state)).toBe(1);
    expect(characterBadgeName(0, 'Night', state)).toBe('Night');

    // Night needs 20 AP to max out the 4 non-specialty stats (reload, speed, strength, search)
    state = addExperience(state, 999999).state;
    expect(state.ap).toBe(20);

    for (let i = 0; i < 5; i++) state = allocateStatPoint(0, 'reload', state);
    for (let i = 0; i < 5; i++) state = allocateStatPoint(0, 'speed', state);
    for (let i = 0; i < 5; i++) state = allocateStatPoint(0, 'strength', state);
    for (let i = 0; i < 5; i++) state = allocateStatPoint(0, 'search', state);

    expect(state.ap).toBe(0);
    expect(isCharacterMaxed(0, state)).toBe(true);
    expect(characterLevel(0, state)).toBe(21);
    expect(characterBadgeName(0, 'Night', state)).toBe('OP Night');
    expect(characterBadgeName(4, 'Rich', state)).toBe('Rich');
    expect(characterLevel(4, state)).toBe(1);
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

  it('persists and reloads progression state correctly from storage', () => {
    const memory = new Map<string, string>();
    const mockStore = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, val: string) => memory.set(key, val),
    };

    // Defaults when empty
    const initial = loadProgression(mockStore);
    expect(initial.level).toBe(1);
    expect(initial.xp).toBe(0);

    // Save mutated state
    let state = addExperience(initial, 300).state;
    state = allocateStatPoint(1, 'speed', state);
    state = { ...state, gp: 120 };
    saveProgression(state, mockStore);

    const reloaded = loadProgression(mockStore);
    expect(reloaded.level).toBe(state.level);
    expect(reloaded.xp).toBe(state.xp);
    expect(reloaded.ap).toBe(state.ap);
    expect(reloaded.gp).toBe(120);
    expect(reloaded.allocations[1].spentAp.speed).toBe(1);
  });

  it('calculates level up and fractional progress toward the next level', () => {
    const start = createInitialProgression();
    const nextReqLevel2 = xpRequiredForLevel(2);
    expect(nextReqLevel2).toBe(100);

    const half = addExperience(start, 50);
    expect(half.didLevelUp).toBe(false);
    expect(half.newLevel).toBe(1);
    expect(half.state.xp / nextReqLevel2).toBeCloseTo(0.5, 2);

    const full = addExperience(half.state, 50);
    expect(full.didLevelUp).toBe(true);
    expect(full.newLevel).toBe(2);
    expect(full.levelsGained).toBe(1);
    expect(full.state.ap).toBe(1);
    expect(full.state.xp).toBe(0);

    const nextReqLevel3 = xpRequiredForLevel(3);
    expect(nextReqLevel3).toBe(115);
  });
});

describe('Rolling Timestamp AP Decay & Rusty Survivors', () => {
  it('does not decay AP when active within the 7-day grace period', () => {
    const baseTime = 1_700_000_000_000;
    const start = createInitialProgression(baseTime);
    const leveled = addExperience(start, 700, baseTime).state;
    expect(leveled.ap).toBe(5);

    const threeDaysLater = baseTime + 3 * 24 * 60 * 60 * 1000;
    const result = applyApDecay(leveled, threeDaysLater);
    expect(result.decayedAp).toBe(0);
    expect(result.state.ap).toBe(5);
    expect(result.newlyRustySkins).toEqual([]);
  });

  it('decays 1 AP after 7 days of inactivity and marks survivor as rusty for pip re-allocation', () => {
    const baseTime = 1_700_000_000_000;
    const start = createInitialProgression(baseTime);
    let state = addExperience(start, 700, baseTime).state;
    state = allocateStatPoint(0, 'speed', state);
    state = allocateStatPoint(0, 'speed', state);
    state = allocateStatPoint(0, 'speed', state);
    expect(state.ap).toBe(2);
    expect(state.allocations[0].spentAp.speed).toBe(3);
    expect(characterBadgeName(0, 'Night', state)).toBe('Night');

    const eightDaysLater = baseTime + 8 * 24 * 60 * 60 * 1000;
    const result = applyApDecay(state, eightDaysLater);

    expect(result.decayedAp).toBe(1);
    expect(result.state.ap).toBe(4);
    expect(result.newlyRustySkins).toContain(0);
    expect(isCharacterRusty(0, result.state)).toBe(true);
    expect(characterBadgeName(0, 'Night', result.state)).toBe('Rusty Night');
    expect(result.state.allocations[0].spentAp.speed).toBe(0);

    const reallocated = allocateStatPoint(0, 'speed', result.state);
    expect(isCharacterRusty(0, reallocated)).toBe(false);
    expect(characterBadgeName(0, 'Night', reallocated)).toBe('Night');
    expect(reallocated.ap).toBe(3);
    expect(reallocated.allocations[0].spentAp.speed).toBe(1);
  });

  it('decays from unallocated AP without marking survivors rusty if no pips were invested', () => {
    const baseTime = 1_700_000_000_000;
    const start = createInitialProgression(baseTime);
    const leveled = addExperience(start, 300, baseTime).state;
    expect(leveled.ap).toBe(2);

    const sevenDaysLater = baseTime + AP_DECAY_INACTIVITY_MS + 1000;
    const result = applyApDecay(leveled, sevenDaysLater);

    expect(result.decayedAp).toBe(1);
    expect(result.state.ap).toBe(1);
    expect(result.newlyRustySkins).toEqual([]);
    expect(isCharacterRusty(0, result.state)).toBe(false);
  });

  describe('Weighted Action AP Allocation', () => {
    it('picks the highest scoring non-maxed stat and excludes the specialty 5-pip stat', () => {
      // Skin 0 (Night) has Stealth maxed at 5/5
      const scores = {
        stealth: 999, // Should be ignored because stealth is already 5/5
        reload: 4,
        search: 24,
        strength: 12,
        speed: 10,
      };
      const winning = pickWinningStat(scores, 0);
      expect(winning).toBe('search');
    });

    it('falls back to first available non-maxed stat on ties or zero scores', () => {
      const winning = pickWinningStat({}, 0);
      expect(winning).not.toBe('stealth');
      expect(['reload', 'speed', 'strength', 'search']).toContain(winning);
    });

    it('allocates earned AP directly to the winning stat and increases character level', () => {
      const base = createInitialProgression();
      const allocated = allocateEarnedAp(base, 0, 'search', 1);
      expect(allocated.allocations[0].spentAp.search).toBe(1);
      expect(characterLevel(0, allocated)).toBe(2);
    });

    it('allocates banked AP using allocateEarnedAp so previously earned levels reflect on character level', () => {
      let state = createInitialProgression();
      state = { ...state, level: 3, ap: 2 };
      while (state.ap > 0) {
        const winning = pickWinningStat({}, 0, state.allocations[0])!;
        state = allocateEarnedAp(state, 0, winning, 1);
      }
      expect(state.ap).toBe(0);
      const totalPips = Object.values(state.allocations[0].spentAp).reduce((a, b) => a + b, 0);
      expect(totalPips).toBe(2);
      expect(characterLevel(0, state)).toBe(3);
    });
  });

  describe('Level Up Boon Fluidity & applyBagCommit Resilience', () => {
    it('applies level up boon directly to the player without bag items or pausing', () => {
      const sim = new GameSimulation({ seed: 42 });
      sim.addPlayer('p1', 'Player 1', null, 0);
      const playerBefore = sim.snapshot().players.find((p) => p.id === 'p1')!;
      expect(playerBefore.sugar).toBeUndefined();

      sim.giveBoon('p1', 'jawbreaker');
      const playerAfter = sim.snapshot().players.find((p) => p.id === 'p1')!;
      expect(playerAfter.sugar).toBeDefined();
      expect(playerAfter.sugar!.some((s) => s.id === 'jawbreaker')).toBe(true);
    });

    it('safely handles bag commit without layout or drop without throwing errors', () => {
      const sim = new GameSimulation({ seed: 42 });
      sim.addPlayer('p1', 'Player 1', null, 0);
      const p = (sim as unknown as { sim: { players: Array<{ status: string; inventory: unknown; candy: unknown[] }> } }).sim.players[0];
      const partialCommit = { use: [{ type: 'jawbreaker', count: 1 }] } as unknown as Parameters<typeof applyBagCommit>[2];
      expect(() => applyBagCommit((sim as unknown as { sim: Parameters<typeof applyBagCommit>[0] }).sim, p as unknown as Parameters<typeof applyBagCommit>[1], partialCommit)).not.toThrow();
    });
  });
});
