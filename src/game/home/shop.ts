// The merchants' stock and sales, as pure steps over a save.

import { AMMO_PICKUPS, MEDKIT_MAX, WEAPONS } from '../../../shared/constants.ts';
import { scaleRounds } from '../../../shared/difficulty.ts';
import type { DifficultyId } from '../../../shared/difficulty.ts';
import { PART_CARRY_CAP } from '../../../shared/gun-upgrade-data.ts';
import { MERCHANT_IDS } from '../../../shared/home-protocol.ts';
import type { Loadout, MerchantId, StationId } from '../../../shared/home-protocol.ts';
import { BOTTLE_CARRY } from '../../../shared/bottles.ts';
import { createRng, pick } from '../../../shared/rng.ts';
import type { Rng } from '../../../shared/rng.ts';
import { KIT_CARRY_CAP } from '../../../shared/round-effect-data.ts';
import type { WeaponId } from '../../../shared/protocol.ts';
import type { HomeSave } from './home-store.ts';
import { MERCHANTS, itemOf } from './merchant-data.ts';
import type { ItemDef, MerchantDef } from './merchant-data.ts';

export interface MerchantStock {
  /** How many of each item are left, by item id. Items that are always on the shelf are not listed. */
  items: Record<string, number>;
  /** Banked trips until a stall the overrun emptied opens again with a full roll. Left off for 0, an open stall. */
  closedTrips?: number;
  /** Banked trips until a stall the overrun thinned rolls full counts again. Left off for 0. */
  thinTrips?: number;
}

export interface ShopState {
  /** A random value kept in the save, so saves differ and reloading cannot reroll. */
  seed: number;
  /** Rolls so far, mixed with the seed. */
  rolls: number;
  merchants: Record<MerchantId, MerchantStock>;
}

/** What a sale depends on beyond the save. */
export interface ShopContext {
  /** The player's own highest level, which the level gates read. */
  highest: number;
  /** Buying is refused unless this is the merchant. */
  station: StationId | null;
  /** Boxes scale with it. */
  difficulty: DifficultyId;
}

/** One line on a merchant's screen. */
export interface ShopRow {
  item: string;
  price: number;
  /** How many are left. Infinity for what is always on the shelf. */
  stock: number;
}

const ROLL_STRIDE = 0x9e3779b1;

/** The stalls the overrun emptied, which have no merchant at them until they reopen. */
export function closedStalls(shop: ShopState): MerchantId[] {
  return MERCHANT_IDS.filter((id) => stallClosed(shop, id));
}

const stallClosed = (shop: ShopState, merchant: MerchantId): boolean => (shop.merchants[merchant].closedTrips ?? 0) > 0;

/** The shop's rng for the roll it is on. Casualties and the next stock draw from it, so a reload picks the same ones. */
export const shopRng = (shop: ShopState): Rng => createRng(shop.seed ^ Math.imul(shop.rolls + 1, ROLL_STRIDE));

export function emptyShop(seed: number): ShopState {
  const merchants = Object.fromEntries(MERCHANT_IDS.map((id) => [id, { items: {} }])) as Record<MerchantId, MerchantStock>;
  return { seed, rolls: 0, merchants };
}

function rollMerchant(def: MerchantDef, rng: Rng): MerchantStock {
  const items: Record<string, number> = {};
  const add = (id: string, count: number) => {
    items[id] = (items[id] ?? 0) + count;
  };
  for (const { id, stock } of def.items) {
    const isFixedStock = stock.kind === 'fixed';
    if (isFixedStock) add(id, stock.count);
    const isLuckyRoll = stock.kind === 'chance' && rng() * stock.oneIn < 1;
    if (isLuckyRoll) add(id, 1);
  }
  for (const [pool, draws] of Object.entries(def.pools)) {
    const members = def.items.filter(({ stock }) => stock.kind === 'pool' && stock.pool === pool);
    for (let draw = 0; draw < draws; draw++) add(pick(rng, members).id, 1);
  }
  return { items };
}

/** One merchant's roll after the overrun: a closed stall counts down and stays empty until the last trip, then opens with the full roll; a thin one counts down and rolls that much of it. */
function recovered(rolled: MerchantStock, before: MerchantStock): MerchantStock {
  const closed = before.closedTrips ?? 0;
  const thin = Math.max(0, (before.thinTrips ?? 0) - 1);
  const isStillClosed = closed > 1;
  if (isStillClosed) return { items: {}, closedTrips: closed - 1 };
  const isFullyStocked = thin === 0;
  if (isFullyStocked) return rolled;
  const items = Object.fromEntries(Object.entries(rolled.items).map(([id, count]) => [id, Math.floor(count * (1 - thin / 4))]));
  return { items, thinTrips: thin };
}

/** Replaces all stock. Called for a new save and again for each banked trip, never for a death or a quit. Every merchant is rolled whatever its state, so the rng draws the same. */
export function rollStock(save: HomeSave): HomeSave {
  const { seed, rolls } = save.shop;
  const rng = shopRng(save.shop);
  const rolled = Object.fromEntries(MERCHANT_IDS.map((id) => [id, recovered(rollMerchant(MERCHANTS[id], rng), save.shop.merchants[id])])) as Record<MerchantId, MerchantStock>;
  return { ...save, shop: { seed, rolls: rolls + 1, merchants: rolled } };
}

/** Rounds in one box at this difficulty, as town pickups scale. */
export const boxRounds = (item: ItemDef, difficulty: DifficultyId): number =>
  item.grant.kind === 'ammo' ? scaleRounds(AMMO_PICKUPS[item.grant.ammo].rounds, difficulty) : 0;

const ownsGun = (save: HomeSave, weapon: WeaponId): boolean => weapon in save.locker.guns || weapon in save.hands.guns;

/** Locker and gear in hand together, which is how caps and "own" are counted. */
function held(save: HomeSave, item: ItemDef): number {
  const { locker, hands } = save;
  const { grant } = item;
  const isAmmo = grant.kind === 'ammo';
  if (isAmmo) {
    const { weapon } = AMMO_PICKUPS[grant.ammo];
    return locker.ammoBag[weapon] + hands.ammoBag[weapon];
  }
  const isPart = grant.kind === 'part';
  if (isPart) return locker.parts[grant.part] + hands.parts[grant.part];
  const isKit = grant.kind === 'kit';
  if (isKit) return locker.kits[grant.effect] + hands.kits[grant.effect];
  const isMedkit = grant.kind === 'medkit';
  if (isMedkit) return locker.medkits + hands.medkits;
  const isBottle = grant.kind === 'bottle';
  if (isBottle) return locker.bottles + hands.bottles;
  const isKnife = grant.kind === 'knife';
  if (isKnife) return Number(locker.knife || hands.knife);
  return Number(ownsGun(save, grant.weapon));
}

/** How many of the item fit in a pocket, counting the box as one unit. */
function carryLimit(item: ItemDef): number {
  const { grant } = item;
  const isAmmo = grant.kind === 'ammo';
  if (isAmmo) return WEAPONS[AMMO_PICKUPS[grant.ammo].weapon].reserveCap;
  const isPart = grant.kind === 'part';
  if (isPart) return PART_CARRY_CAP;
  const isKit = grant.kind === 'kit';
  if (isKit) return KIT_CARRY_CAP;
  const isMedkit = grant.kind === 'medkit';
  if (isMedkit) return MEDKIT_MAX;
  const isBottle = grant.kind === 'bottle';
  if (isBottle) return BOTTLE_CARRY;
  return 1;
}

/** Shown on the screen at all: past its gate, and of use to what the player owns. */
function offered(save: HomeSave, item: ItemDef, context: ShopContext): boolean {
  const isGated = context.highest < (item.gate ?? 0);
  if (isGated) return false;
  const { grant } = item;
  const isGun = grant.kind === 'gun';
  if (isGun) return !ownsGun(save, grant.weapon);
  const isAmmo = grant.kind === 'ammo';
  if (isAmmo) return ownsGun(save, AMMO_PICKUPS[grant.ammo].weapon);
  return true;
}

function stockOf(save: HomeSave, merchant: MerchantId, item: ItemDef): number {
  const isAlwaysStocked = item.stock.kind === 'always';
  if (isAlwaysStocked) return Infinity;
  return save.shop.merchants[merchant].items[item.id] ?? 0;
}

function fits(save: HomeSave, item: ItemDef, context: ShopContext): boolean {
  const amount = item.grant.kind === 'ammo' ? boxRounds(item, context.difficulty) : 1;
  return held(save, item) + amount <= carryLimit(item);
}

function granted(locker: Loadout, item: ItemDef, context: ShopContext): Loadout {
  const next: Loadout = { ...locker, guns: { ...locker.guns }, ammoBag: { ...locker.ammoBag }, parts: { ...locker.parts }, kits: { ...locker.kits } };
  const { grant } = item;
  const isGun = grant.kind === 'gun';
  if (isGun) next.guns[grant.weapon] = {};
  const isAmmo = grant.kind === 'ammo';
  if (isAmmo) next.ammoBag[AMMO_PICKUPS[grant.ammo].weapon] += boxRounds(item, context.difficulty);
  const isPart = grant.kind === 'part';
  if (isPart) next.parts[grant.part] += 1;
  const isKit = grant.kind === 'kit';
  if (isKit) next.kits[grant.effect] += 1;
  const isMedkit = grant.kind === 'medkit';
  if (isMedkit) next.medkits += 1;
  const isBottle = grant.kind === 'bottle';
  if (isBottle) next.bottles += 1;
  const isKnife = grant.kind === 'knife';
  if (isKnife) next.knife = true;
  return next;
}

/** The money, the stock and the locker in one new save, or null if the sale is refused. The save in is untouched. */
export function buy(save: HomeSave, merchant: MerchantId, item: string, context: ShopContext): HomeSave | null {
  const nothingToBuyFrom = context.station !== merchant || save.openTrip || stallClosed(save.shop, merchant);
  if (nothingToBuyFrom) return null;
  const def = itemOf(merchant, item);
  const isNotOnShelf = !def || !offered(save, def, context);
  if (isNotOnShelf) return null;
  const cannotAfford = save.silver < def.price || stockOf(save, merchant, def) < 1 || !fits(save, def, context);
  if (cannotAfford) return null;
  const shelf = save.shop.merchants[merchant];
  const items = def.stock.kind === 'always' ? shelf.items : { ...shelf.items, [def.id]: stockOf(save, merchant, def) - 1 };
  const merchants = { ...save.shop.merchants, [merchant]: { ...shelf, items } };
  return { ...save, silver: save.silver - def.price, locker: granted(save.locker, def, context), shop: { ...save.shop, merchants } };
}

/** One unit of an item into the locker as a reward, or null when it does not fit. A quest pays silver at the shop price instead. */
export function stow(save: HomeSave, item: ItemDef, difficulty: DifficultyId): HomeSave | null {
  const context: ShopContext = { highest: 0, station: null, difficulty };
  const doesNotFit = !fits(save, item, context);
  if (doesNotFit) return null;
  return { ...save, locker: granted(save.locker, item, context) };
}

/** What the screen lists: what is on the shelf this trip and of use to the player. Sold-out lines drop off. */
export function shopRows(save: HomeSave, merchant: MerchantId, context: ShopContext): ShopRow[] {
  const shuttered = stallClosed(save.shop, merchant);
  return MERCHANTS[merchant].items
    .filter(() => !shuttered)
    .filter((item) => offered(save, item, context) && stockOf(save, merchant, item) > 0)
    .map((item) => ({ item: item.id, price: item.price, stock: stockOf(save, merchant, item) }));
}
