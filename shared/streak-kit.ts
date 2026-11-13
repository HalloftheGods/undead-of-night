// The streak kit: come back night after night and every run starts a little better armed.
// Tiers stack, each one adding to the last, and stop growing at the top night.

import { MEDKIT_MAX, WEAPONS } from "./constants.ts";
import type { CandyId, WeaponId } from "./protocol.ts";
import type { PlayerState } from "./sim-state.ts";
import { syncGun } from "./weapons.ts";

/** One night's step up: what it adds on top of every night before it. */
export interface StreakTier {
  /** The night of the streak this tier starts on; night 1 is a fresh start and adds nothing. */
  readonly night: number;
  /** What it adds, in the words the level card and the Nightly Run page use. */
  readonly words: string;
  readonly medkits?: number;
  readonly pistolRounds?: number;
  readonly knife?: boolean;
  /** A gun handed over loaded, with this many spare rounds for it. */
  readonly gun?: { readonly weapon: WeaponId; readonly spare: number };
  readonly candy?: CandyId;
}

export const STREAK_TIERS: readonly StreakTier[] = [
  { night: 2, words: "A medkit and 12 pistol rounds", medkits: 1, pistolRounds: 12 },
  { night: 3, words: "A knife", knife: true },
  { night: 4, words: "A loaded shotgun and 6 shells", gun: { weapon: "shotgun", spare: 6 } },
  { night: 5, words: "A Jawbreaker to eat", candy: "jawbreaker" },
  {
    night: 7,
    words: "A loaded carbine, 30 rounds and another medkit",
    medkits: 1,
    gun: { weapon: "carbine", spare: 30 }
  }
];

/** The night the kit stops growing. */
export const TOP_STREAK_NIGHT = STREAK_TIERS[STREAK_TIERS.length - 1].night;

/** Every tier earned by this night of a streak, first to last. */
export function tiersFor(night: number): readonly StreakTier[] {
  return STREAK_TIERS.filter((tier) => tier.night <= night);
}

/** The next tier still to earn after this night, or null at the top. */
export function nextTier(night: number): StreakTier | null {
  return STREAK_TIERS.find((tier) => tier.night > night) ?? null;
}

function giveGun(p: PlayerState, weapon: WeaponId, spare: number): void {
  const isOwned = p.owned.includes(weapon);
  if (!isOwned) p.owned = [...p.owned, weapon];
  p.guns[weapon] = { ...p.guns[weapon], ammo: WEAPONS[weapon].magSize };
  p.ammoBag[weapon] = Math.min(WEAPONS[weapon].reserveCap, p.ammoBag[weapon] + spare);
  // The best gun goes in hand: the tiers come in order, so the last one given is it.
  p.weapon = weapon;
}

function giveTier(p: PlayerState, tier: StreakTier): void {
  p.medkits = Math.min(MEDKIT_MAX, p.medkits + (tier.medkits ?? 0));
  p.ammoBag.pistol = Math.min(
    WEAPONS.pistol.reserveCap,
    p.ammoBag.pistol + (tier.pistolRounds ?? 0)
  );
  if (tier.knife) p.knife = true;
  if (tier.gun) giveGun(p, tier.gun.weapon, tier.gun.spare);
  if (tier.candy) p.candy = [...p.candy, tier.candy];
}

/** Adds the kit for this night of a streak to whatever the run already handed out. */
export function giveStreakKit(p: PlayerState, night: number): void {
  const tiers = tiersFor(night);
  for (const tier of tiers) giveTier(p, tier);
  const gaveAnything = tiers.length > 0;
  if (gaveAnything) syncGun(p);
}
