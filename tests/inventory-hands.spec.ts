import { afterEach, describe, expect, it, vi } from 'vitest';
import { setHeld } from '../src/game/held-cursor.ts';
import type { HeldInfo } from '../src/game/held-cursor.ts';
import {
  elementOwnsPoint,
  inventoryChoosing,
  inventoryHolding,
  inventoryOwnsPointer,
  inventoryPadShared,
  inventoryUp,
  setInventoryHands,
} from '../src/game/inventory/inventory-hands.ts';

const IN_HAND: HeldInfo = { sprite: null, name: 'Water', hint: '', actions: [], type: 'water', itemId: 'held-1' };

describe('the inventory hands', () => {
  afterEach(() => {
    setInventoryHands(null);
    setHeld(null);
    vi.unstubAllGlobals();
  });

  it('owns nothing with no inventory up, even with a hand left over from a close', () => {
    setHeld(IN_HAND);
    expect(inventoryUp()).toBe(false);
    expect(inventoryHolding()).toBe(false);
    expect(inventoryChoosing(10, 10)).toBe(false);
    expect(inventoryOwnsPointer(10, 10)).toBe(false);
  });

  it('chooses where the window says the point is its own, and owns every point while holding', () => {
    setInventoryHands({ ownsPoint: (x) => x < 100 });
    expect(inventoryUp()).toBe(true);
    expect(inventoryChoosing(50, 0)).toBe(true);
    expect(inventoryChoosing(200, 0)).toBe(false);
    expect(inventoryOwnsPointer(200, 0)).toBe(false);
    setHeld(IN_HAND);
    expect(inventoryHolding()).toBe(true);
    expect(inventoryOwnsPointer(200, 0)).toBe(true);
  });

  it('shares the pad with an open window, but not with a search window or with none', () => {
    expect(inventoryPadShared()).toBe(false);
    setInventoryHands({ ownsPoint: () => false });
    expect(inventoryPadShared()).toBe(true);
    let searching = true;
    setInventoryHands({ ownsPoint: () => false, sharesPad: () => !searching });
    expect(inventoryUp()).toBe(true);
    expect(inventoryPadShared()).toBe(false);
    searching = false;
    expect(inventoryPadShared()).toBe(true);
  });

  describe('elementOwnsPoint', () => {
    const inside = { name: 'panel' };
    const canvas = { name: 'canvas' };
    const root = { contains: (el: unknown) => el === inside } as unknown as Element;

    it('owns nothing with no root, or where the page cannot say what is under the point', () => {
      vi.stubGlobal('document', { elementFromPoint: () => inside });
      expect(elementOwnsPoint(null, 0, 0)).toBe(false);
      vi.stubGlobal('document', {});
      expect(elementOwnsPoint(root, 0, 0)).toBe(false);
    });

    it('owns a point over an element inside the root, and not one over the game canvas', () => {
      let under: unknown = inside;
      vi.stubGlobal('document', { elementFromPoint: () => under });
      expect(elementOwnsPoint(root, 5, 5)).toBe(true);
      under = canvas;
      expect(elementOwnsPoint(root, 5, 5)).toBe(false);
      under = null;
      expect(elementOwnsPoint(root, 5, 5)).toBe(false);
    });
  });
});
