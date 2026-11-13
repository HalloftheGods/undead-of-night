import { describe, expect, it } from 'vitest';
import { loadSetupLevel, saveSetupLevel, setupLevelRequest } from '../src/game/setup-level-pref.ts';

/** An in-memory stand-in for localStorage. */
function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe('the town each style\'s Level card sets', () => {
  it('has nothing saved until a town is set, for both styles', () => {
    expect(loadSetupLevel('arcade', memoryStore())).toBeNull();
    expect(loadSetupLevel('campaign', memoryStore())).toBeNull();
  });

  it('remembers the town per style, so Arcade and Campaign keep their own', () => {
    const store = memoryStore();
    saveSetupLevel('arcade', 4, store);
    saveSetupLevel('campaign', 2, store);
    expect(loadSetupLevel('arcade', store)).toBe(4);
    expect(loadSetupLevel('campaign', store)).toBe(2);
  });

  it('ignores a saved value that is not a real town', () => {
    expect(loadSetupLevel('arcade', memoryStore({ 'outbreak.setupLevel': 'banana' }))).toBeNull();
    expect(loadSetupLevel('campaign', memoryStore({ 'outbreak.setupLevel.campaign': '999' }))).toBeNull();
  });

  it('falls back to nothing set when storage throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSetupLevel('arcade', broken)).toBeNull();
    expect(() => saveSetupLevel('arcade', 3, broken)).not.toThrow();
  });

  it('only Arcade starts at the set town, and the first town is no jump', () => {
    expect(setupLevelRequest(4, 'arcade')).toBe(4);
    expect(setupLevelRequest(4, 'campaign')).toBeNull();
    expect(setupLevelRequest(1, 'arcade')).toBeNull();
    expect(setupLevelRequest(null, 'arcade')).toBeNull();
  });
});
