import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInventoryGrid } from '../shared/grid-inventory.ts';
import { cellPhase, feedSearch, itemHidden, revealProgress, searchSweep, shownSweep, startReveal, sweepRanks } from '../src/game/inventory/search-overlay.ts';
import { beginContainerZoom, CATCH_MS, noteWorldFrame, resetContainerZoom } from '../src/game/inventory/container-zoom.ts';

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

  it('reads the grid in a more geometric order as the searcher\'s Loot slot rises', () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const grid = createInventoryGrid(3, 3, []);
    // The cell indices (row * cols + col) in the order the sweep reads them.
    const orderAt = (slot: number): number[] => {
      feedSearch(0.1, slot);
      const ranks = sweepRanks(grid);
      return Array.from({ length: 9 }, (_, i) => i).sort(
        (a, b) => ranks.rankOf(a % 3, Math.floor(a / 3)) - ranks.rankOf(b % 3, Math.floor(b / 3)),
      );
    };
    expect(orderAt(0)).toHaveLength(9);
    expect(orderAt(2)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(orderAt(3)).toEqual([0, 3, 6, 1, 4, 7, 2, 5, 8]);
    expect(orderAt(4)).toEqual([0, 1, 3, 2, 4, 6, 5, 7, 8]);
    expect(orderAt(5)).toEqual([0, 1, 2, 5, 8, 7, 6, 3, 4]);
    feedSearch(null);
  });

  describe('while the container zooms in', () => {
    afterEach(() => {
      resetContainerZoom();
      vi.restoreAllMocks();
    });

    it('holds the shown sweep at 0 until it lands, then lets it catch up, never ahead of the sim', () => {
      let carry: FrameRequestCallback = () => undefined;
      vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => {
        carry = run;
        return 1;
      });
      vi.stubGlobal('cancelAnimationFrame', () => undefined);
      const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
      feedSearch(null);
      beginContainerZoom(1, 0);
      feedSearch(0);
      clock.mockReturnValue(100);
      feedSearch(0.5);
      carry(100);
      expect(searchSweep.value).toBeCloseTo(0.5);
      expect(shownSweep.value).toBe(0);
      noteWorldFrame(100, true);
      carry(100 + CATCH_MS * 0.2);
      expect(shownSweep.value).toBeCloseTo(0.2);
      expect(shownSweep.value!).toBeLessThanOrEqual(searchSweep.value!);
      carry(100 + CATCH_MS * 2);
      expect(shownSweep.value).toBe(searchSweep.value);
      feedSearch(null);
      expect(searchSweep.value).toBeNull();
      expect(shownSweep.value).toBeNull();
    });
  });
});
