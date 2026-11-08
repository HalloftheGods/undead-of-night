import { describe, expect, it } from 'vitest';
import { DEFAULT_MENU_INFO, loadMenuInfo, saveMenuInfo } from '../src/game/menu-info-pref.ts';

function memoryStore(): Pick<Storage, 'getItem' | 'setItem'> {
  const data = new Map<string, string>();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
}

describe('menu info setting', () => {
  it('starts off, so the menu shows labels only', () => {
    expect(DEFAULT_MENU_INFO).toBe(false);
    expect(loadMenuInfo(memoryStore())).toBe(false);
    expect(loadMenuInfo(null)).toBe(false);
  });

  it('remembers a switch either way', () => {
    const store = memoryStore();
    saveMenuInfo(true, store);
    expect(loadMenuInfo(store)).toBe(true);
    saveMenuInfo(false, store);
    expect(loadMenuInfo(store)).toBe(false);
  });

  it('falls back to off for anything unreadable, or a store that throws', () => {
    const store = memoryStore();
    store.setItem('outbreak.menuInfo', 'yes');
    expect(loadMenuInfo(store)).toBe(false);
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(loadMenuInfo(broken)).toBe(false);
    expect(() => saveMenuInfo(true, broken)).not.toThrow();
  });
});
