import { describe, expect, it, vi } from 'vitest';
import { createInventoryGrid } from '../shared/grid-inventory.ts';
import { cellPhase, feedSearch, itemHidden, revealProgress, startReveal, sweepRanks } from '../src/game/inventory/search-overlay.ts';

describe('the search sweep reads the open cells like a defrag pass', () => {
  it('visits every cell once in a random order, voids included', () => {
    const grid = createInventoryGrid(3, 2, [{ x: 1, y: 0 }]);
    const ranks = sweepRanks(grid);
    expect(ranks.open).toBe(6);
    const seen = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]].map(([c, r]) => ranks.rankOf(c, r));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(sweepRanks(grid)).toBe(ranks);
  });

  it('starts at the first cell, walks every cell once and finishes with the search', () => {
    const open = 10;
    expect(cellPhase(0, open, 0)).toBe('head');
    expect(cellPhase(1, open, 0)).toBe('waiting');
    expect(cellPhase(0, open, 0.15)).toBe('read');
    expect(cellPhase(1, open, 0.15)).toBe('head');
    expect(cellPhase(9, open, 0.99)).toBe('head');
    expect(cellPhase(9, open, 1)).toBe('read');
    for (let p = 0; p <= 1; p += 0.01) {
      const heads = Array.from({ length: open }, (_, r) => cellPhase(r, open, p)).filter((x) => x === 'head').length;
      expect(heads).toBeLessThanOrEqual(1);
    }
  });

  it('hides found items as a "?" only for the loot of a search that has just ended', () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    startReveal([{ id: 'a' }]);
    expect(revealProgress.value).toBeNull();
    expect(itemHidden('a')).toBe(false);
    feedSearch(0.5);
    feedSearch(null);
    startReveal([{ id: 'a' }, { id: 'b' }]);
    expect(revealProgress.value).toBe(0);
    expect(itemHidden('a')).toBe(true);
    expect(itemHidden('b')).toBe(true);
    expect(itemHidden('other')).toBe(false);
  });
});
