// What a flight from the horde costs the merchants: some die, the rest are thinned. Pure steps over a save.

import { MERCHANT_IDS } from '../../../shared/home-protocol.ts';
import type { MerchantId } from '../../../shared/home-protocol.ts';
import { OVERRUN_MAX_KILLED, OVERRUN_RECOVERY_TRIPS } from '../../../shared/overrun.ts';
import { createRng, pick } from '../../../shared/rng.ts';
import type { Rng } from '../../../shared/rng.ts';
import type { HomeSave } from './home-store.ts';
import { shopRng } from './shop.ts';
import type { MerchantStock } from './shop.ts';

/** Stock counts drop to this share, rounded down. */
const THIN_SHARE = 1 / 4;

/** Keeps a receipt's casualty stream apart from every stock roll's `shopRng` stream. */
const CASUALTY_SALT = 0x0c45a17e;

/** FNV-1a over the receipt's key: the same text always gives the same number. */
function hashOf(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return hash >>> 0;
}

/**
 * The stream for one flight. With the receipt's key it depends on the shop's seed and that key alone, never on the roll count, so a
 * retry or a reload picks the same merchants, and the picks do not walk the stream the next `rollStock` draws from. Without a key it is `shopRng`.
 */
function casualtyRng(save: HomeSave, key: string | undefined): Rng {
  return key === undefined ? shopRng(save.shop) : createRng(save.shop.seed ^ CASUALTY_SALT ^ hashOf(key));
}

/** `ceil(share * OVERRUN_MAX_KILLED)` merchants, less any that would leave no stall standing. */
function toKill(share: number, living: number): number {
  const wanted = Math.ceil(Math.min(1, share) * OVERRUN_MAX_KILLED);
  return Math.min(wanted, Math.max(0, living - 1));
}

/** The stall's counts at a quarter, and thin for as many banked trips as it takes to recover. */
function thinned(stock: MerchantStock): MerchantStock {
  const items = Object.fromEntries(Object.entries(stock.items).map(([id, count]) => [id, Math.floor(count * THIN_SHARE)]));
  return { items, thinTrips: OVERRUN_RECOVERY_TRIPS };
}

/**
 * The cost of running from a horde that was still `share` of its size (0..1). Killed merchants are picked from the living by a stream
 * of the receipt's own (`key`), so reloading cannot reroll them. A killed stall empties and closes for `OVERRUN_RECOVERY_TRIPS`
 * banked trips; the survivors thin. A share of 0 costs nothing. Returns the new save and who died; the save in is untouched.
 */
export function fleeCasualties(save: HomeSave, share: number, key?: string): { save: HomeSave; killed: MerchantId[] } {
  const nothingLost = !(share > 0);
  if (nothingLost) return { save, killed: [] };
  const inCamp = (id: (typeof MERCHANT_IDS)[number]): boolean => save.camp === undefined || save.camp.rescued.includes(id);
  const pool = MERCHANT_IDS.filter((id) => inCamp(id) && (save.shop.merchants[id].closedTrips ?? 0) === 0);
  const count = toKill(share, pool.length);
  const rng = casualtyRng(save, key);
  const killed: MerchantId[] = [];
  for (let n = 0; n < count; n++) {
    const [dead] = pool.splice(pool.indexOf(pick(rng, pool)), 1);
    killed.push(dead);
  }
  const merchants = { ...save.shop.merchants };
  for (const id of pool) merchants[id] = thinned(merchants[id]);
  for (const id of killed) merchants[id] = { items: {}, closedTrips: OVERRUN_RECOVERY_TRIPS };
  return { save: { ...save, shop: { ...save.shop, merchants } }, killed };
}
