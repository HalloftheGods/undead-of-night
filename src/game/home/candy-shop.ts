// Candy Shop in the bunker: pure state transitions for buying and selling candies.

import { CANDIES, CANDY_ORDER, candyBuyPrice, candySellValue, candyBagWorth, MAX_CANDY_BAG } from '../../../shared/candy.ts';
import type { CandyId } from '../../../shared/candy.ts';
import type { HomeSave } from './home-store.ts';

export interface CandyTradeItem {
  readonly id: CandyId;
  readonly name: string;
  readonly stat: string;
  readonly blurb: string;
  readonly weight: number;
  readonly sellPrice: number;
  readonly buyPrice: number;
  readonly count: number;
}

export interface CandyTierGroup {
  readonly tierName: string;
  readonly items: readonly CandyTradeItem[];
}

export function candyTradeCatalog(bag: readonly CandyId[]): readonly CandyTierGroup[] {
  const counts: Partial<Record<CandyId, number>> = {};
  for (const id of bag) counts[id] = (counts[id] ?? 0) + 1;

  const toItem = (id: CandyId): CandyTradeItem => {
    const def = CANDIES[id];
    return {
      id,
      name: def.name,
      stat: def.stat,
      blurb: def.blurb,
      weight: def.weight,
      sellPrice: candySellValue(id),
      buyPrice: candyBuyPrice(id),
      count: counts[id] ?? 0,
    };
  };

  const ultraRare: CandyTradeItem[] = [];
  const rare: CandyTradeItem[] = [];
  const uncommon: CandyTradeItem[] = [];
  const common: CandyTradeItem[] = [];

  for (const id of CANDY_ORDER) {
    const item = toItem(id);
    if (item.weight <= 2) {
      ultraRare.push(item);
    } else if (item.weight <= 6) {
      rare.push(item);
    } else if (item.weight <= 8) {
      uncommon.push(item);
    } else {
      common.push(item);
    }
  }

  return [
    { tierName: 'Ultra Rare', items: ultraRare },
    { tierName: 'Rare', items: rare },
    { tierName: 'Uncommon', items: uncommon },
    { tierName: 'Common', items: common },
  ];
}

export interface CandyTradeResult {
  readonly save: HomeSave;
  readonly bag: CandyId[];
}

/** Sells a single piece of candy from the player's bag for its tiered value. */
export function sellCandyPiece(save: HomeSave, bag: readonly CandyId[], id: CandyId): CandyTradeResult | null {
  const index = bag.indexOf(id);
  const notCarried = index < 0;
  if (notCarried) return null;

  const nextBag = [...bag];
  nextBag.splice(index, 1);

  const price = candySellValue(id);
  const currentCandy = save.candy ?? save.silver ?? 0;
  const nextCandy = currentCandy + price;

  const nextSave: HomeSave = {
    ...save,
    candy: nextCandy,
    silver: nextCandy,
  };

  return { save: nextSave, bag: nextBag };
}

/** Sells all candy currently carried in the bag, crediting the full total worth. */
export function sellAllCarriedCandy(save: HomeSave, bag: readonly CandyId[]): { readonly save: HomeSave; readonly bag: CandyId[]; readonly credited: number } {
  const totalWorth = candyBagWorth(bag);
  const currentCandy = save.candy ?? save.silver ?? 0;
  const nextCandy = currentCandy + totalWorth;

  const nextSave: HomeSave = {
    ...save,
    candy: nextCandy,
    silver: nextCandy,
  };

  return { save: nextSave, bag: [], credited: totalWorth };
}

/** Buys a single piece of candy from the bunker shop into the bag. */
export function buyCandyPiece(save: HomeSave, bag: readonly CandyId[], id: CandyId): CandyTradeResult | null {
  const isBagFull = bag.length >= MAX_CANDY_BAG;
  if (isBagFull) return null;

  const price = candyBuyPrice(id);
  const currentCandy = save.candy ?? save.silver ?? 0;
  const cannotAfford = currentCandy < price;
  if (cannotAfford) return null;

  const nextCandy = currentCandy - price;
  const nextBag = [...bag, id];

  const nextSave: HomeSave = {
    ...save,
    candy: nextCandy,
    silver: nextCandy,
  };

  return { save: nextSave, bag: nextBag };
}
