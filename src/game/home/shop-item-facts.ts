// What the shop's big column says about the item in focus. Every number is read off the game's own tables.

import { BOTTLE_CARRY, BOTTLE_NOISE_RADIUS, BOTTLE_RANGE } from '../../../shared/bottles.ts';
import { STAT_SLOTS } from '../../../shared/character-stats.ts';
import { AMMO_PICKUPS, BANDAGE_HEAL, MEDKIT_HEAL, MEDKIT_MAX, MELEE_DAMAGE, PLAYER_MAX_HEALTH, WEAPONS } from '../../../shared/constants.ts';
import type { WeaponStats } from '../../../shared/constants.ts';
import { scaleRounds } from '../../../shared/difficulty.ts';
import type { DifficultyId } from '../../../shared/difficulty.ts';
import { PART_CARRY_CAP, PART_LABELS, UPGRADE_ORDER, UPGRADES } from '../../../shared/gun-upgrade-data.ts';
import type { GunUpgrade, PartId } from '../../../shared/gun-upgrade-data.ts';
import { KNIFE_DAMAGE } from '../../../shared/melee.ts';
import { TILE_SIZE, WEAPON_ORDER } from '../../../shared/protocol.ts';
import type { WeaponId } from '../../../shared/protocol.ts';
import {
  BURN_NOISE_RADIUS,
  BURN_PULSE_DAMAGE,
  BURN_PULSE_SEC,
  BURN_SEC,
  CORROSION_MAX_STACKS,
  CORROSION_PER_STACK,
  CORROSION_SEC,
  GUN_EFFECTS,
  KIT_CARRY_CAP,
  PIERCE_DAMAGE_SCALE,
  TRANQ_SEC,
  TRANQ_SPEED,
} from '../../../shared/round-effect-data.ts';
import type { GunEffect } from '../../../shared/round-effect-data.ts';
import type { SupplyType } from '../../../shared/supply-types.ts';
import type { ItemGrant } from './merchant-data.ts';

/** Cells in a gun's bars, as many as a survivor's. */
export const ITEM_SLOTS = STAT_SLOTS;
/** Rows the column always keeps room for, the most any item has. */
export const ITEM_ROWS = 4;

export interface ItemFact {
  readonly label: string;
  readonly value: string;
  /** Lit cells out of ITEM_SLOTS where the number compares across the guns; null for a plain fact. */
  readonly filled: number | null;
}

export interface ItemFacts {
  /** One sentence on what it does. */
  readonly note: string;
  readonly rows: readonly ItemFact[];
}

const fact = (label: string, value: string): ItemFact => ({ label, value, filled: null });
const tiles = (px: number): string => `${Math.round(px / TILE_SIZE)} tiles`;
const percent = (share: number): number => Math.round(share * 100);
const carry = (most: number): ItemFact => fact('Carry', `${most} most`);

// Guns: four bars, each scaled against the best gun at it.

const perShot = (gun: WeaponStats): number => gun.damage * gun.pellets;
const perSecond = (gun: WeaponStats): number => 1000 / gun.fireIntervalMs;

const GUN_BARS: readonly { label: string; of: (gun: WeaponStats) => number; text: (gun: WeaponStats) => string }[] = [
  { label: 'Damage', of: perShot, text: (gun) => (gun.pellets > 1 ? `${gun.damage}x${gun.pellets}` : `${gun.damage}`) },
  { label: 'Fire rate', of: perSecond, text: (gun) => `${perSecond(gun).toFixed(1)}/s` },
  { label: 'Magazine', of: (gun) => gun.magSize, text: (gun) => `${gun.magSize}` },
  { label: 'Range', of: (gun) => gun.range, text: (gun) => tiles(gun.range) },
];

function gunFacts(weapon: WeaponId): ItemFacts {
  const gun = WEAPONS[weapon];
  const rows = GUN_BARS.map(({ label, of, text }) => {
    const best = Math.max(...WEAPON_ORDER.map((each) => of(WEAPONS[each])));
    return { label, value: text(gun), filled: Math.max(1, Math.round((of(gun) / best) * ITEM_SLOTS)) };
  });
  const shot = gun.pellets > 1 ? `${gun.pellets} pellets a shot` : 'One round a shot';
  return { note: `${shot}, ${gun.reloadMs / 1000}s to reload.`, rows };
}

// Parts: the upgrades each one goes into at the workbench.

/** Reload time and noise are taken off; the rest are added. */
const GAIN_SIGN: Readonly<Record<GunUpgrade, string>> = { damage: '+', fireRate: '+', magazine: '+', reload: '-', suppressor: '-' };
const GAIN_WORD: Readonly<Record<GunUpgrade, string>> = { damage: '', fireRate: '', magazine: '', reload: ' time', suppressor: ' noise' };

function upgradeRow(upgrade: GunUpgrade): ItemFact {
  const { label, gain, maxRank } = UPGRADES[upgrade];
  const ranks = maxRank > 1 ? `, ${maxRank} ranks` : '';
  return fact(label, `${GAIN_SIGN[upgrade]}${percent(gain)}%${GAIN_WORD[upgrade]}${ranks}`);
}

function partFacts(part: PartId): ItemFacts {
  const feeds = UPGRADE_ORDER.filter((upgrade) => (UPGRADES[upgrade].cost[part] ?? 0) > 0);
  const fitsNoUpgrade = feeds.length === 0;
  if (fitsNoUpgrade) return { note: 'Moves an upgrade or a round effect from one gun to another.', rows: [fact('Spent', 'one a move'), carry(PART_CARRY_CAP)] };
  const shared = feeds.flatMap((upgrade) => {
    const others = Object.keys(UPGRADES[upgrade].cost).filter((other) => other !== part) as PartId[];
    return others.map((other) => ` ${UPGRADES[upgrade].label} also takes a ${PART_LABELS[other]}.`);
  });
  return { note: `Fitted to a gun at the workbench.${shared.join('')}`, rows: [...feeds.map(upgradeRow), carry(PART_CARRY_CAP)] };
}

// Round kits: what the rounds do, from the effect's own numbers.

const EFFECT_ROWS: Readonly<Record<GunEffect, () => readonly ItemFact[]>> = {
  incendiary: () => [fact('Burn', `${(BURN_PULSE_DAMAGE * BURN_SEC) / BURN_PULSE_SEC} in ${BURN_SEC}s`), fact('Heard at', tiles(BURN_NOISE_RADIUS))],
  acid: () => [fact('Per stack', `+${percent(CORROSION_PER_STACK)}% damage`), fact('Stacks', `${CORROSION_MAX_STACKS} most`), fact('Lasts', `${CORROSION_SEC}s`)],
  piercing: () => [fact('Next body', `${percent(PIERCE_DAMAGE_SCALE)}% damage`)],
  tranq: () => [fact('Slows to', `${percent(TRANQ_SPEED)}% speed`), fact('Lasts', `${TRANQ_SEC}s`), fact('Damage', `${percent(GUN_EFFECTS.tranq.damage ?? 1)}%`)],
};

const kitFacts = (effect: GunEffect): ItemFacts => ({ note: `${GUN_EFFECTS[effect].note}.`, rows: [...EFFECT_ROWS[effect](), carry(KIT_CARRY_CAP)] });

function ammoFacts(ammo: keyof typeof AMMO_PICKUPS, difficulty: DifficultyId): ItemFacts {
  const { weapon, rounds } = AMMO_PICKUPS[ammo];
  const gun = WEAPONS[weapon];
  const rows = [fact('Box', `${scaleRounds(rounds, difficulty)} rounds`), fact('Feeds', gun.label), fact('Magazine', `${gun.magSize}`), carry(gun.reserveCap)];
  return { note: `Spare rounds for the ${gun.label}, counted at this difficulty.`, rows };
}

const SUPPLY_FACTS: Readonly<Record<SupplyType, () => ItemFacts>> = {
  bandage: () => ({
    note: 'Stops bleeding and binds minor wounds.',
    rows: [fact('Heals', `${BANDAGE_HEAL} health`), fact('Effect', 'Stops bleed'), carry(20)],
  }),
  canned_food: () => ({
    note: 'Preserved rations that stave off hunger.',
    rows: [fact('Hunger', '-45'), fact('Heals', '8 health'), carry(20)],
  }),
  water_bottle: () => ({
    note: 'Clean drinking water to stay hydrated.',
    rows: [fact('Thirst', '-55'), fact('Fatigue', '-10'), carry(20)],
  }),
  disinfectant: () => ({
    note: 'Medical antiseptic to cleanse open wounds.',
    rows: [fact('Effect', 'Cleans wounds'), fact('Treats', 'Infection'), carry(20)],
  }),
  antibiotics: () => ({
    note: 'Potent medicine to combat advanced infection.',
    rows: [fact('Effect', 'Fights fever'), fact('Treats', 'Deep infection'), carry(20)],
  }),
};

type GrantOf<K extends ItemGrant['kind']> = Extract<ItemGrant, { kind: K }>;
type FactPicks = { readonly [K in ItemGrant['kind']]: (grant: GrantOf<K>, difficulty: DifficultyId) => ItemFacts };

const FACTS_OF: FactPicks = {
  gun: ({ weapon }) => gunFacts(weapon),
  ammo: ({ ammo }, difficulty) => ammoFacts(ammo, difficulty),
  part: ({ part }) => partFacts(part),
  kit: ({ effect }) => kitFacts(effect),
  supply: ({ supply }) => SUPPLY_FACTS[supply](),
  medkit: () => ({ note: 'Patches you up out on a run.', rows: [fact('Heals', `${MEDKIT_HEAL} of ${PLAYER_MAX_HEALTH}`), carry(MEDKIT_MAX)] }),
  knife: () => ({ note: 'Your shove goes in point first, just as silent.', rows: [fact('Shove', `${KNIFE_DAMAGE} damage`), fact('Bare hands', `${MELEE_DAMAGE} damage`), carry(1)] }),
  bottle: () => ({
    note: 'Throw it and everything in earshot goes to where it broke.',
    rows: [fact('Throw', tiles(BOTTLE_RANGE)), fact('Heard at', tiles(BOTTLE_NOISE_RADIUS)), carry(BOTTLE_CARRY)],
  }),
};

/** The note and up to ITEM_ROWS rows for one thing on the shelf; ammo counts its box at the run's difficulty. */
export function itemFacts(grant: ItemGrant, difficulty: DifficultyId): ItemFacts {
  const pickFacts = FACTS_OF[grant.kind] as (grant: ItemGrant, difficulty: DifficultyId) => ItemFacts;
  return pickFacts(grant, difficulty);
}
