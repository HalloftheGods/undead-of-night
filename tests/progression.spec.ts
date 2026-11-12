import { describe, expect, it } from 'vitest';
import { GameSimulation } from '../shared/simulation.ts';
import { applyBagCommit } from '../shared/bag-sim.ts';
import {
  MAX_CHARACTER_LEVEL,
  addExperience,
  allocateEarnedAp,
  allocateStatPoint,
  applyApDecay,
  AP_DECAY_INTERVAL_MS,
  baseStatSlotFor,
  canAllocateStat,
  canRespecCharacter,
  characterBadgeName,
  characterLevel,
  checkApUpkeep,
  createInitialProgression,
  effectiveStatSlots,
  isCharacterMaxed,
  isCharacterRusty,
  loadProgression,
  loseOnePip,
  pickWinningStat,
  PROGRESSION_STORAGE_KEY,
  respecCharacter,
  saveProgression,
  totalXpForLevel,
  xpRequiredForLevel,
} from '../shared/progression.ts';
import type { ProgressionState } from '../shared/progression.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

function storeWith(saved?: unknown) {
  const memory = new Map<string, string>();
  if (saved !== undefined) memory.set(PROGRESSION_STORAGE_KEY, JSON.stringify(saved));
  let writes = 0;
  return {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, val: string) => {
      writes += 1;
      memory.set(key, val);
    },
    writes: () => writes,
  };
}

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

  it('grants AP and levels up when XP threshold is met up to Level 100', () => {
    const start = createInitialProgression();
    const reqLevel2 = xpRequiredForLevel(2);
    expect(reqLevel2).toBe(113);

    const result = addExperience(start, 150);
    expect(result.didLevelUp).toBe(true);
    expect(result.levelsGained).toBe(1);
    expect(result.apEarned).toBe(1);
    expect(result.newLevel).toBe(2);
    expect(result.state.level).toBe(2);
    expect(result.state.xp).toBe(37);
    expect(result.state.ap).toBe(1);

    // Giant XP boost caps at Level 100 with 99 AP earned
    const capped = addExperience(start, totalXpForLevel(MAX_CHARACTER_LEVEL));
    expect(capped.newLevel).toBe(MAX_CHARACTER_LEVEL);
    expect(capped.newLevel).toBe(100);
    expect(capped.state.ap).toBe(99);
  });

  it('allows spending AP to increase stat slots up to max 5', () => {
    const base = createInitialProgression();
    const leveled = addExperience(base, 113).state; // Level 2 with 1 AP
    expect(leveled.ap).toBe(1);

    // Night (skin 0) cannot allocate stealth because it is already maxed (5)
    expect(canAllocateStat(0, 'stealth', leveled)).toBe(false);

    // Night can allocate reload (starts at 0)
    expect(canAllocateStat(0, 'reload', leveled)).toBe(true);
    const allocated = allocateStatPoint(0, 'reload', leveled);
    expect(allocated.ap).toBe(0);
    expect(allocated.allocations[0].spentAp.reload).toBe(1);

    const slots = effectiveStatSlots(0, allocated.allocations[0], allocated.level);
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
    state = addExperience(state, totalXpForLevel(21)).state;
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
    state = addExperience(state, 321).state;
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
    expect(nextReqLevel2).toBe(113);

    const half = addExperience(start, 56);
    expect(half.didLevelUp).toBe(false);
    expect(half.newLevel).toBe(1);
    expect(half.state.xp / nextReqLevel2).toBeCloseTo(0.5, 2);

    const full = addExperience(half.state, 57);
    expect(full.didLevelUp).toBe(true);
    expect(full.newLevel).toBe(2);
    expect(full.levelsGained).toBe(1);
    expect(full.state.ap).toBe(1);
    expect(full.state.xp).toBe(0);

    const nextReqLevel3 = xpRequiredForLevel(3);
    expect(nextReqLevel3).toBe(208);
  });

  it('prices level L at round(40 × L^1.5) up to a cap of 100', () => {
    expect(MAX_CHARACTER_LEVEL).toBe(100);
    expect(xpRequiredForLevel(2)).toBe(113);
    expect(xpRequiredForLevel(100)).toBe(40_000);
    expect(totalXpForLevel(10)).toBe(5_667);
    expect(totalXpForLevel(21)).toBe(34_242);
    expect(totalXpForLevel(50)).toBe(289_910);
    expect(totalXpForLevel(100)).toBe(1_620_015);
  });

  it('caps a survivor level at 21 even when a save fills the specialty stat', () => {
    const start = createInitialProgression();
    const overfull = { ...start, allocations: { ...start.allocations, 0: { spentAp: { stealth: 5, reload: 5, speed: 5, strength: 5, search: 5 } } } };
    expect(characterLevel(0, overfull)).toBe(21);
  });

  it('stops XP at level 100', () => {
    const capped = addExperience(createInitialProgression(), totalXpForLevel(MAX_CHARACTER_LEVEL) + 5_000);
    expect(capped.newLevel).toBe(100);
    expect(capped.state.xp).toBe(0);
    const after = addExperience(capped.state, 500);
    expect(after.didLevelUp).toBe(false);
    expect(after.state.level).toBe(100);
    expect(after.state.xp).toBe(0);
  });
});

describe('Saves', () => {
  it('migrates a version-less level-21 save: keeps level, AP and pips, zeroes xp and owed AP, starts a fresh timer', () => {
    const pips = { stealth: 0, reload: 5, speed: 5, strength: 5, search: 3 };
    const store = storeWith({ level: 21, xp: 3000, ap: 2, gp: 40, allocations: { 0: { spentAp: pips } }, lastApEarnedAt: NOW - 30 * DAY_MS, rustySkins: [] });
    const loaded = loadProgression(store, NOW);
    expect(loaded).toMatchObject({ version: 2, level: 21, xp: 0, ap: 2, gp: 40, owedAp: 0, lastApEarnedAt: NOW });
    expect(loaded.allocations[0].spentAp).toEqual(pips);
  });

  it('clamps a lastApEarnedAt later than now to now', () => {
    const store = storeWith({ ...createInitialProgression(NOW), lastApEarnedAt: NOW + 5 * DAY_MS });
    expect(loadProgression(store, NOW).lastApEarnedAt).toBe(NOW);
  });

  it('round-trips owedAp, xp and the version', () => {
    const store = storeWith({ ...createInitialProgression(NOW), xp: 70, owedAp: 3 });
    expect(loadProgression(store, NOW)).toMatchObject({ version: 2, xp: 70, owedAp: 3 });
  });

  it('reads a save from a later version as it stands, without wiping its XP', () => {
    const store = storeWith({ ...createInitialProgression(NOW), version: 3, xp: 70 });
    expect(loadProgression(store, NOW)).toMatchObject({ version: 2, xp: 70 });
  });

  it('starts version 2 with nothing owed', () => {
    expect(createInitialProgression(NOW)).toMatchObject({ version: 2, owedAp: 0 });
  });
});

describe('The upkeep check', () => {
  it('loads an idle save without decaying or writing it', () => {
    const store = storeWith({ ...createInitialProgression(NOW - 21 * DAY_MS), level: 5, ap: 1 });
    expect(loadProgression(store, NOW)).toMatchObject({ ap: 1, owedAp: 0 });
    expect(store.writes()).toBe(0);
  });

  it('checkApUpkeep decays the save and writes it back', () => {
    const store = storeWith({ ...createInitialProgression(NOW - 21 * DAY_MS), level: 5, ap: 1 });
    expect(checkApUpkeep(store, NOW).decayedAp).toBe(1);
    expect(loadProgression(store, NOW)).toMatchObject({ level: 5, ap: 0, owedAp: 1, lastApEarnedAt: NOW });
  });

  it('checkApUpkeep writes a migrated save once, so its grace week starts at the first check', () => {
    const store = storeWith({ level: 21, xp: 3000, ap: 2, gp: 0, allocations: {}, lastApEarnedAt: NOW - 30 * DAY_MS, rustySkins: [] });
    checkApUpkeep(store, NOW);
    expect(loadProgression(store, NOW + 3 * DAY_MS)).toMatchObject({ version: 2, level: 21, xp: 0, ap: 2, lastApEarnedAt: NOW });
  });
});

/** Level 12 with one AP banked and pips on three survivors, last levelled at NOW. */
function idleSave(): ProgressionState {
  const start = createInitialProgression(NOW);
  return {
    ...start,
    level: 12,
    ap: 1,
    allocations: {
      ...start.allocations,
      0: { spentAp: { stealth: 0, reload: 2, speed: 3, strength: 0, search: 0 } },
      1: { spentAp: { stealth: 3, reload: 0, speed: 0, strength: 0, search: 2 } },
      2: { spentAp: { stealth: 1, reload: 0, speed: 0, strength: 0, search: 0 } },
    },
  };
}

describe('Rolling Timestamp AP Decay & Rusty Survivors', () => {
  it('does not decay AP when active within the 7-day grace period', () => {
    const baseTime = 1_700_000_000_000;
    const start = createInitialProgression(baseTime);
    const leveled = addExperience(start, 1676, baseTime).state;
    expect(leveled.ap).toBe(5);

    const threeDaysLater = baseTime + 3 * 24 * 60 * 60 * 1000;
    const result = applyApDecay(leveled, threeDaysLater);
    expect(result.decayedAp).toBe(0);
    expect(result.state.ap).toBe(5);
    expect(result.newlyRustySkins).toEqual([]);
  });

  it('six days idle loses nothing', () => {
    const save = idleSave();
    const result = applyApDecay(save, NOW + 6 * DAY_MS);
    expect(result.decayedAp).toBe(0);
    expect(result.state).toBe(save);
  });

  it("three weeks idle loses banked AP, then the fullest survivor's fullest stat, and no levels", () => {
    const result = applyApDecay(idleSave(), NOW + 21 * DAY_MS + 60_000);
    expect(result.decayedAp).toBe(3);
    expect(result.state).toMatchObject({ level: 12, ap: 0, owedAp: 3, lastApEarnedAt: NOW + 21 * DAY_MS });
    expect(result.state.allocations[0].spentAp).toEqual({ stealth: 0, reload: 2, speed: 2, strength: 0, search: 0 });
    expect(result.state.allocations[1].spentAp).toEqual({ stealth: 2, reload: 0, speed: 0, strength: 0, search: 2 });
    expect(result.state.allocations[2].spentAp).toEqual({ stealth: 1, reload: 0, speed: 0, strength: 0, search: 0 });
    expect(result.newlyRustySkins).toEqual([0, 1]);
    expect(result.state.rustySkins).toEqual([0, 1]);
  });

  it('a survivor who lost a pip is Rusty until they gain one', () => {
    const decayed = applyApDecay(idleSave(), NOW + 21 * DAY_MS).state;
    expect(characterBadgeName(1, 'Bear', decayed)).toBe('Rusty Bear');
    const regained = allocateStatPoint(0, 'speed', { ...decayed, ap: 1 });
    expect(isCharacterRusty(0, regained)).toBe(false);
    expect(isCharacterRusty(1, regained)).toBe(true);
  });

  it('takes the pip from the first stat in STATS order when two stats tie', () => {
    const start = createInitialProgression(NOW);
    const tied = { ...start, allocations: { ...start.allocations, 3: { spentAp: { stealth: 2, reload: 2, speed: 0, strength: 0, search: 2 } } } };
    const after = loseOnePip(tied);
    expect(after.allocations[3].spentAp).toEqual({ stealth: 1, reload: 2, speed: 0, strength: 0, search: 2 });
    expect(after.owedAp).toBe(1);
    expect(after.rustySkins).toEqual([3]);
  });

  it('lists a survivor who lost several pips once', () => {
    const start = createInitialProgression(NOW);
    const one = { ...start, allocations: { ...start.allocations, 0: { spentAp: { stealth: 0, reload: 4, speed: 0, strength: 0, search: 0 } } } };
    const result = applyApDecay(one, NOW + 28 * DAY_MS);
    expect(result.decayedAp).toBe(4);
    expect(result.newlyRustySkins).toEqual([0]);
    expect(result.state.rustySkins).toEqual([0]);
  });

  it('loses nothing when there is nothing to lose, but still moves the timer a whole week', () => {
    const fresh = createInitialProgression(NOW);
    expect(loseOnePip(fresh)).toBe(fresh);
    const result = applyApDecay(fresh, NOW + 8 * DAY_MS);
    expect(result.decayedAp).toBe(0);
    expect(result.state).toMatchObject({ owedAp: 0, lastApEarnedAt: NOW + 7 * DAY_MS });
    expect(applyApDecay(result.state, NOW + 8 * DAY_MS).state).toBe(result.state);
  });

  it('reports every survivor maxed and none Rusty at level 100, from the level alone', () => {
    const save100 = { ...createInitialProgression(NOW), level: MAX_CHARACTER_LEVEL, ap: 3, rustySkins: [0] };
    const kept = applyApDecay(save100, NOW + 365 * DAY_MS).state;
    for (const skin of [0, 1, 2, 3, 4]) {
      expect(isCharacterMaxed(skin, kept)).toBe(true);
      expect(Object.values(effectiveStatSlots(skin, kept.allocations[skin], kept.level))).toEqual([5, 5, 5, 5, 5]);
      expect(canAllocateStat(skin, 'reload', kept)).toBe(false);
    }
    expect(isCharacterRusty(0, kept)).toBe(false);
    expect(characterBadgeName(0, 'Night', kept)).toBe('OP Night');
    expect(characterLevel(3, kept)).toBe(21);
    expect(effectiveStatSlots(0, undefined, 99)).toEqual({ stealth: 5, reload: 0, speed: 0, strength: 0, search: 0 });
  });

  it('two level-ups after three idle weeks pay four AP', () => {
    const decayed = applyApDecay(idleSave(), NOW + 21 * DAY_MS).state;
    const gain = addExperience(decayed, xpRequiredForLevel(13) + xpRequiredForLevel(14), NOW + 22 * DAY_MS);
    expect(gain.levelsGained).toBe(2);
    expect(gain.apEarned).toBe(4);
    expect(gain.state).toMatchObject({ level: 14, ap: 4, owedAp: 1 });
  });

  it('a level-100 save idle for a year loses nothing', () => {
    const save100 = { ...createInitialProgression(NOW), level: MAX_CHARACTER_LEVEL, ap: 2 };
    const result = applyApDecay(save100, NOW + 365 * DAY_MS);
    expect(result.decayedAp).toBe(0);
    expect(result.state).toBe(save100);
  });

  it('decays from unallocated AP without marking survivors rusty if no pips were invested', () => {
    const baseTime = 1_700_000_000_000;
    const start = createInitialProgression(baseTime);
    const leveled = addExperience(start, 321, baseTime).state;
    expect(leveled.ap).toBe(2);

    const sevenDaysLater = baseTime + AP_DECAY_INTERVAL_MS + 1000;
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
