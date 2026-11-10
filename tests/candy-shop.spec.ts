import { describe, expect, it } from 'vitest';
import { candyBuyPrice, candySellValue, candyBagWorth } from '../shared/candy.ts';
import type { CandyId } from '../shared/candy.ts';
import { buyCandyPiece, candyTradeCatalog, sellAllCarriedCandy, sellCandyPiece } from '../src/game/home/candy-shop.ts';
import { emptySave } from '../src/game/home/home-store.ts';

describe('Candy Shop', () => {
  it('tiers prices according to rarity', () => {
    // Ultra Rare (weight 2)
    expect(candySellValue('full_size_bar')).toBe(150);
    expect(candyBuyPrice('full_size_bar')).toBe(300);

    // Rare (weight 6)
    expect(candySellValue('caramel_apple')).toBe(60);
    expect(candyBuyPrice('caramel_apple')).toBe(120);

    // Uncommon (weight 7-8)
    expect(candySellValue('fireballs')).toBe(25);
    expect(candyBuyPrice('fireballs')).toBe(50);

    // Common (weight 10)
    expect(candySellValue('sour_skulls')).toBe(10);
    expect(candyBuyPrice('sour_skulls')).toBe(20);
  });

  it('calculates total bag worth accurately', () => {
    const bag = ['sour_skulls', 'fireballs', 'caramel_apple', 'full_size_bar'] as const;
    const expected = 10 + 25 + 60 + 150;
    expect(candyBagWorth(bag)).toBe(expected);
  });

  it('sells a single piece of candy from the bag', () => {
    const save = { ...emptySave(1), candy: 50 };
    const bag: CandyId[] = ['sour_skulls', 'fireballs'];

    const result = sellCandyPiece(save, bag, 'fireballs');
    expect(result).not.toBeNull();
    expect(result!.bag).toEqual(['sour_skulls']);
    expect(result!.save.candy).toBe(75);
  });

  it('sells all carried candy and credits the full balance', () => {
    const save = { ...emptySave(1), candy: 100 };
    const bag: CandyId[] = ['sour_skulls', 'sour_skulls', 'caramel_apple'];

    const result = sellAllCarriedCandy(save, bag);
    expect(result.bag).toEqual([]);
    expect(result.credited).toBe(80);
    expect(result.save.candy).toBe(180);
  });

  it('buys a candy piece if the player has enough credits', () => {
    const save = { ...emptySave(1), candy: 150 };
    const bag: CandyId[] = ['sour_skulls'];

    const result = buyCandyPiece(save, bag, 'caramel_apple');
    expect(result).not.toBeNull();
    expect(result!.bag).toEqual(['sour_skulls', 'caramel_apple']);
    expect(result!.save.candy).toBe(30); // 150 - 120
  });

  it('refuses to buy if player cannot afford it', () => {
    const save = { ...emptySave(1), candy: 10 };
    const bag: CandyId[] = ['sour_skulls'];

    const result = buyCandyPiece(save, bag, 'caramel_apple');
    expect(result).toBeNull();
  });

  it('provides a catalog grouped into 4 rarity tiers', () => {
    const catalog = candyTradeCatalog(['sour_skulls', 'full_size_bar'] as CandyId[]);
    expect(catalog).toHaveLength(4);
    expect(catalog[0].tierName).toBe('Ultra Rare');
    expect(catalog[3].tierName).toBe('Common');
  });
});
