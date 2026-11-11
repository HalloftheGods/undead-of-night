import { BOTTLE_CARRY } from './bottles.ts';
import { MEDKIT_MAX, WEAPONS } from './constants.ts';
import type { WeaponId } from './protocol.ts';

export type BackpackTier = 'satchel' | 'duffel' | 'alice';

export interface BackpackDef {
  readonly tier: BackpackTier;
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly ammoMultiplier: number;
  readonly medkitMax: number;
  readonly bottleMax: number;
  readonly throwableMax: number;
  readonly plankMax: number;
  readonly cols: number;
  readonly rows: number;
}

export const BACKPACK_TIERS: Record<BackpackTier, BackpackDef> = {
  satchel: {
    tier: 'satchel',
    name: 'Canvas Satchel',
    label: 'TIER I: SATCHEL',
    description: 'Standard starter shoulder pack. Baseline carrying capacity.',
    ammoMultiplier: 1.0,
    medkitMax: MEDKIT_MAX,
    bottleMax: BOTTLE_CARRY,
    throwableMax: 2,
    plankMax: 2,
    cols: 5,
    rows: 4,
  },
  duffel: {
    tier: 'duffel',
    name: 'Heavy Duffel Bag',
    label: 'TIER II: DUFFEL',
    description: 'Rugged oversized duffel bag. 50% more ammo reserves and extra supplies.',
    ammoMultiplier: 1.5,
    medkitMax: 4,
    bottleMax: 5,
    throwableMax: 4,
    plankMax: 4,
    cols: 6,
    rows: 5,
  },
  alice: {
    tier: 'alice',
    name: 'Military ALICE Pack',
    label: 'TIER III: ALICE PACK',
    description: 'Reinforced tactical rucksack. Doubles ammo reserves with heavy supply webbing.',
    ammoMultiplier: 2.0,
    medkitMax: 6,
    bottleMax: 8,
    throwableMax: 6,
    plankMax: 8,
    cols: 8,
    rows: 6,
  },
};

export const BACKPACK_ORDER: readonly BackpackTier[] = ['satchel', 'duffel', 'alice'];

export function backpackDef(tier: BackpackTier): BackpackDef {
  return BACKPACK_TIERS[tier] ?? BACKPACK_TIERS.satchel;
}

export function reserveCapForTier(weapon: WeaponId, tier: BackpackTier): number {
  const baseCap = WEAPONS[weapon].reserveCap;
  const multiplier = backpackDef(tier).ammoMultiplier;
  return Math.round(baseCap * multiplier);
}

export function medkitCapForTier(tier: BackpackTier): number {
  return backpackDef(tier).medkitMax;
}

export function bottleCapForTier(tier: BackpackTier): number {
  return backpackDef(tier).bottleMax;
}

export function throwableCapForTier(tier: BackpackTier): number {
  return backpackDef(tier).throwableMax;
}

export function plankCapForTier(tier: BackpackTier): number {
  return backpackDef(tier).plankMax;
}

export function isBetterBackpack(current: BackpackTier, candidate: BackpackTier): boolean {
  const currentIndex = BACKPACK_ORDER.indexOf(current);
  const candidateIndex = BACKPACK_ORDER.indexOf(candidate);
  return candidateIndex > currentIndex;
}
