// The locker screen's plain parts: a tile for each kind of gear on either side, the rows of what is in hand, and the icon for each.

import { BOTTLE_CARRY } from '../../../shared/bottles.ts';
import { AMMO_PICKUPS, MEDKIT_MAX, WEAPONS } from '../../../shared/constants.ts';
import type { AmmoPickup } from '../../../shared/constants.ts';
import { PART_CARRY_CAP, PART_ORDER } from '../../../shared/gun-upgrade-data.ts';
import type { PartId } from '../../../shared/gun-upgrade-data.ts';
import { WEAPON_ORDER } from '../../../shared/protocol.ts';
import type { WeaponId } from '../../../shared/protocol.ts';
import { EFFECT_ORDER, KIT_CARRY_CAP } from '../../../shared/round-effect-data.ts';
import type { GunEffect } from '../../../shared/round-effect-data.ts';
import { isSupplyType, SUPPLY_TYPES } from '../../../shared/supply-types.ts';
import type { PixelSprite } from '../../art/types.ts';
import { loadoutRows } from '../home-screens.ts';
import type { LockerDraft, LockerRow } from '../home-screens.ts';
import type { ItemGrant } from './merchant-data.ts';
import { itemSprite } from './shop-item-art.ts';
import type { ShopIcons } from './shop-item-art.ts';
import { ITEM_SLOTS } from './shop-item-facts.ts';

/** One kind of gear, and how much of it is on each side. */
export interface LockerTile {
  readonly key: string;
  readonly label: string;
  readonly locker: number;
  readonly hand: number;
}

/** One kind of gear in hand: what is carried, against the most a player may carry. */
export interface HandRow {
  readonly label: string;
  readonly items: readonly LockerRow[];
  readonly held: number;
  readonly cap: number;
  /** Lit cells out of ITEM_SLOTS: held against cap, at least one when anything is held. */
  readonly filled: number;
}

/** Every key loadoutRows can give, in the order it gives them. */
const KEY_ORDER: readonly string[] = [
  ...WEAPON_ORDER.map((weapon) => `gun:${weapon}`),
  ...WEAPON_ORDER.map((weapon) => `ammo:${weapon}`),
  ...PART_ORDER.map((part) => `part:${part}`),
  ...EFFECT_ORDER.map((effect) => `kit:${effect}`),
  ...SUPPLY_TYPES.map((type) => `supply:${type}`),
  'medkit',
  'bottle',
  'knife',
];

/** A tile for every kind of gear on either side. Moving gear never adds or drops a tile, so the strip holds still. */
export function lockerTiles(draft: LockerDraft): readonly LockerTile[] {
  const locker = new Map(loadoutRows(draft.locker).map((row) => [row.key, row]));
  const hands = new Map(loadoutRows(draft.hands).map((row) => [row.key, row]));
  return KEY_ORDER.flatMap((key) => {
    const row = locker.get(key) ?? hands.get(key);
    if (!row) return [];
    return [{ key, label: row.label, locker: locker.get(key)?.count ?? 0, hand: hands.get(key)?.count ?? 0 }];
  });
}

const sum = (counts: readonly number[]): number => counts.reduce((total, count) => total + count, 0);

/** The groups the column lists, each with the carry caps the server checks a loadout against (validateLoadout). */
const HAND_GROUPS: ReadonlyArray<{ readonly label: string; readonly kind: string; readonly cap: number }> = [
  { label: 'Guns', kind: 'gun', cap: WEAPON_ORDER.length },
  { label: 'Ammo', kind: 'ammo', cap: sum(WEAPON_ORDER.map((weapon) => WEAPONS[weapon].reserveCap)) },
  { label: 'Parts', kind: 'part', cap: PART_ORDER.length * PART_CARRY_CAP },
  { label: 'Kits', kind: 'kit', cap: EFFECT_ORDER.length * KIT_CARRY_CAP },
  { label: 'Supplies', kind: 'supply', cap: 20 },
  { label: 'Medkits', kind: 'medkit', cap: MEDKIT_MAX },
  { label: 'Bottles', kind: 'bottle', cap: BOTTLE_CARRY },
  { label: 'Knife', kind: 'knife', cap: 1 },
];

/** How many rows the column always lists. */
export const HAND_ROW_COUNT = HAND_GROUPS.length;

const kindOf = (key: string): string => key.split(':')[0];

/** What is in hand, a row per group in a fixed order, so an empty group keeps its place. */
export function handRows(draft: LockerDraft): readonly HandRow[] {
  const rows = loadoutRows(draft.hands);
  return HAND_GROUPS.map(({ label, kind, cap }) => {
    const items = rows.filter((row) => kindOf(row.key) === kind);
    const held = sum(items.map((row) => row.count));
    const filled = held > 0 ? Math.min(ITEM_SLOTS, Math.max(1, Math.round((held / cap) * ITEM_SLOTS))) : 0;
    return { label, items, held, cap, filled };
  });
}

const AMMO_FOR = Object.fromEntries(Object.entries(AMMO_PICKUPS).map(([ammo, { weapon }]) => [weapon, ammo])) as Record<WeaponId, AmmoPickup>;
const isWeapon = (id: string): id is WeaponId => (WEAPON_ORDER as readonly string[]).includes(id);
const isPart = (id: string): id is PartId => (PART_ORDER as readonly string[]).includes(id);
const isEffect = (id: string): id is GunEffect => (EFFECT_ORDER as readonly string[]).includes(id);

/** Each kind of locker key as the grant a shop line carries, null for an id the tables do not know. */
const GRANT_OF: Partial<Record<string, (id: string) => ItemGrant | null>> = {
  gun: (id) => (isWeapon(id) ? { kind: 'gun', weapon: id } : null),
  ammo: (id) => (isWeapon(id) ? { kind: 'ammo', ammo: AMMO_FOR[id] } : null),
  part: (id) => (isPart(id) ? { kind: 'part', part: id } : null),
  kit: (id) => (isEffect(id) ? { kind: 'kit', effect: id } : null),
  supply: (id) => (isSupplyType(id) ? { kind: 'supply', supply: id } : null),
  medkit: () => ({ kind: 'medkit' }),
  knife: () => ({ kind: 'knife' }),
  bottle: () => ({ kind: 'bottle' }),
};

/** The shop's grant for a locker key, so the locker draws each thing with the icon the shelf and the HUD use. */
export function lockerGrant(key: string): ItemGrant | null {
  const [kind, id = ''] = key.split(':');
  return GRANT_OF[kind]?.(id) ?? null;
}

/** The in-game icon for a locker key, or null when the key names nothing the art book draws. */
export function lockerSprite(icons: ShopIcons, key: string): PixelSprite | null {
  const grant = lockerGrant(key);
  return grant ? itemSprite(icons, grant) : null;
}

/** The largest icon among these keys, so one strip or column draws every icon at one scale. */
export function lockerArtSize(icons: ShopIcons, keys: readonly string[]): { w: number; h: number } {
  const sprites = keys.flatMap((key) => lockerSprite(icons, key) ?? []);
  return { w: Math.max(1, ...sprites.map((each) => each.w)), h: Math.max(1, ...sprites.map((each) => each.h)) };
}
