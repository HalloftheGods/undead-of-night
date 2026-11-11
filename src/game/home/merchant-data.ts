// The four merchants: what each sells, for how much, and how often it is on the shelf. Starting numbers, tuned by the spending soak.

import type { AmmoPickup } from '../../../shared/constants.ts';
import type { PartId } from '../../../shared/gun-upgrade-data.ts';
import type { MerchantId } from '../../../shared/home-protocol.ts';
import type { WeaponId } from '../../../shared/protocol.ts';
import type { GunEffect } from '../../../shared/round-effect-data.ts';
import type { SupplyType } from '../../../shared/supply-types.ts';

/** What buying an item puts in the locker. */
export type ItemGrant =
  | { kind: 'gun'; weapon: WeaponId }
  | { kind: 'ammo'; ammo: AmmoPickup }
  | { kind: 'part'; part: PartId }
  | { kind: 'kit'; effect: GunEffect }
  | { kind: 'supply'; supply: SupplyType }
  | { kind: 'medkit' }
  | { kind: 'knife' }
  | { kind: 'bottle' };

/** How many are on the shelf after a roll. */
export type StockRule =
  | { kind: 'always' }
  | { kind: 'fixed'; count: number }
  /** One in `oneIn` rolls puts a single one out. */
  | { kind: 'chance'; oneIn: number }
  /** Shares a draw with the other items of the pool. */
  | { kind: 'pool'; pool: string };

export interface ItemDef {
  id: string;
  label: string;
  price: number;
  grant: ItemGrant;
  stock: StockRule;
  /** Offered once the player's own highest level reaches this. */
  gate?: number;
}

export interface MerchantDef {
  id: MerchantId;
  name: string;
  role: string;
  greetings: readonly string[];
  items: readonly ItemDef[];
  /** How many draws each pool makes per roll, each landing on one of its items. */
  pools: Readonly<Record<string, number>>;
}

const GUNSMITH: MerchantDef = {
  id: 'gunsmith',
  name: 'Mags',
  role: 'Gunsmith',
  greetings: ['Bring me something with a barrel.', 'Everything here has been fired once, by me.', 'Mind the oil.'],
  pools: { parts: 2 },
  items: [
    { id: 'pistol', label: 'Pistol', price: 50, grant: { kind: 'gun', weapon: 'pistol' }, stock: { kind: 'always' } },
    { id: 'carbine', label: 'Carbine', price: 300, grant: { kind: 'gun', weapon: 'carbine' }, stock: { kind: 'always' }, gate: 2 },
    { id: 'shotgun', label: 'Shotgun', price: 400, grant: { kind: 'gun', weapon: 'shotgun' }, stock: { kind: 'always' }, gate: 3 },
    { id: 'barrel', label: 'Barrel', price: 120, grant: { kind: 'part', part: 'barrel' }, stock: { kind: 'pool', pool: 'parts' } },
    { id: 'grip', label: 'Grip', price: 120, grant: { kind: 'part', part: 'grip' }, stock: { kind: 'pool', pool: 'parts' } },
    { id: 'magazine', label: 'Magazine', price: 120, grant: { kind: 'part', part: 'magazine' }, stock: { kind: 'pool', pool: 'parts' } },
    { id: 'suppressor', label: 'Suppressor', price: 200, grant: { kind: 'part', part: 'suppressor' }, stock: { kind: 'chance', oneIn: 2 }, gate: 4 },
    { id: 'toolkit', label: 'Toolkit', price: 150, grant: { kind: 'part', part: 'toolkit' }, stock: { kind: 'chance', oneIn: 3 } },
  ],
};

const QUARTERMASTER: MerchantDef = {
  id: 'quartermaster',
  name: 'Sarge',
  role: 'Quartermaster',
  greetings: ['Count them before you spend them.', 'Rations are tight. So is the shelf.', 'One box at a time, soldier.'],
  pools: {},
  items: [
    { id: 'pistol_ammo', label: 'Pistol ammo', price: 10, grant: { kind: 'ammo', ammo: 'pistol_ammo' }, stock: { kind: 'fixed', count: 2 } },
    { id: 'carbine_ammo', label: 'Carbine ammo', price: 20, grant: { kind: 'ammo', ammo: 'carbine_ammo' }, stock: { kind: 'fixed', count: 2 } },
    { id: 'shells', label: 'Shells', price: 20, grant: { kind: 'ammo', ammo: 'shells' }, stock: { kind: 'fixed', count: 1 } },
    { id: 'bottle', label: 'Bottle', price: 5, grant: { kind: 'bottle' }, stock: { kind: 'fixed', count: 3 } },
    { id: 'knife', label: 'Knife', price: 100, grant: { kind: 'knife' }, stock: { kind: 'fixed', count: 1 } },
  ],
};

const MEDIC: MerchantDef = {
  id: 'medic',
  name: 'Doc',
  role: 'Medic',
  greetings: ['Hold still. This will only sting a lot.', 'Nobody leaves here worse than they came.', 'Keep it clean, keep it closed.'],
  pools: {},
  items: [{ id: 'medkit', label: 'Medkit', price: 60, grant: { kind: 'medkit' }, stock: { kind: 'fixed', count: 2 } }],
};

const POWDER: MerchantDef = {
  id: 'powder',
  name: 'Cinder',
  role: 'Powder maker',
  greetings: ['Stand back from the bench.', 'Smells like trouble. That is the good stuff.', 'Do not ask what is in it.'],
  pools: { kits: 2 },
  items: [
    { id: 'tranq_kit', label: 'Tranq kit', price: 120, grant: { kind: 'kit', effect: 'tranq' }, stock: { kind: 'pool', pool: 'kits' } },
    { id: 'acid_kit', label: 'Acid kit', price: 150, grant: { kind: 'kit', effect: 'acid' }, stock: { kind: 'pool', pool: 'kits' } },
    { id: 'piercing_kit', label: 'Piercing kit', price: 150, grant: { kind: 'kit', effect: 'piercing' }, stock: { kind: 'pool', pool: 'kits' } },
    { id: 'incendiary_kit', label: 'Flame kit', price: 200, grant: { kind: 'kit', effect: 'incendiary' }, stock: { kind: 'pool', pool: 'kits' } },
  ],
};

export const MERCHANTS: Readonly<Record<MerchantId, MerchantDef>> = {
  gunsmith: GUNSMITH,
  quartermaster: QUARTERMASTER,
  medic: MEDIC,
  powder: POWDER,
};

export function itemOf(merchant: MerchantId, item: string): ItemDef | undefined {
  return MERCHANTS[merchant].items.find((each) => each.id === item);
}
