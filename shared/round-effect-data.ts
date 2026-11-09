import type { BuildingKind } from './protocol.ts';

/** What a gun's rounds do besides hit. A gun holds one at most, apart from its upgrade slots. */
export type GunEffect = 'incendiary' | 'acid' | 'piercing' | 'tranq';
export type KitCounts = Record<GunEffect, number>;

export const EFFECT_ORDER: readonly GunEffect[] = ['incendiary', 'acid', 'piercing', 'tranq'];

/** Loot for the workbench. Fitting one uses it up. */
export type RoundKitId = 'incendiary_kit' | 'acid_kit' | 'piercing_kit' | 'tranq_kit';

export const KIT_ORDER: readonly RoundKitId[] = ['incendiary_kit', 'acid_kit', 'piercing_kit', 'tranq_kit'];

/** Most of any one kit a player can carry; the next one stays on the floor. */
export const KIT_CARRY_CAP = 2;

// Flame rounds. Burns refresh and never stack, so a fast gun lights nothing hotter than a slow one.
export const BURN_SEC = 3;
export const BURN_PULSE_SEC = 0.5;
/** Six of these to a burn: 18 damage, about a third of a walker. */
export const BURN_PULSE_DAMAGE = 3;
/** Fire carries further than a search and not as far as a pistol, and a suppressor does nothing for it. */
export const BURN_NOISE_RADIUS = 200;
export const BURN_NOISE_SEC = 1;
/** Bodies this far apart at the skin count as touching, which is about where a crowd's shoving leaves them. */
export const BURN_TOUCH_GAP = 3;

// Acid rounds. Only acid rounds and burns feel it, so no plain gun is lifted past the power cap by a teammate's acid.
// A blast is one hit, however many pellets land, and adds one stack.
export const CORROSION_MAX_STACKS = 3;
export const CORROSION_SEC = 5;
export const CORROSION_PER_STACK = 0.1;
/** Acid eats armour, so a brute softens faster than the rest. */
export const CORROSION_BRUTE_PER_STACK = 0.15;

// Piercing rounds.
/** What a bullet has left for the body behind its first. */
export const PIERCE_DAMAGE_SCALE = 0.5;

// Tranq rounds.
export const TRANQ_SEC = 3;
/** Share of its speed a tranquillised zombie keeps. */
export const TRANQ_SPEED = 0.4;
/** There is a lot more brute for a dart to get through. */
export const TRANQ_BRUTE_SPEED = 0.7;

export interface EffectDef {
  readonly label: string;
  readonly note: string;
  readonly kit: RoundKitId;
  /** Multiplies the gun's direct damage. */
  readonly damage?: number;
  /** What the effect is worth on top of a shot, as a share of it. The gun's direct damage gives way to keep the two under the cap. */
  readonly power: number;
}

export const GUN_EFFECTS: Readonly<Record<GunEffect, EffectDef>> = {
  incendiary: { label: 'Flame rounds', note: 'Sets zombies alight, and fire draws a crowd', kit: 'incendiary_kit', power: 0.15 },
  // Worth all it can add: on a fully corroded body this gun still does no more than the cap.
  acid: { label: 'Acid rounds', note: 'Corrosion stacks and softens up what it hits', kit: 'acid_kit', power: CORROSION_MAX_STACKS * CORROSION_PER_STACK },
  // A second body is only behind the first some of the time.
  piercing: { label: 'Piercing rounds', note: 'Goes through one zombie into the next', kit: 'piercing_kit', power: 0.2 },
  tranq: { label: 'Tranq rounds', note: 'Slows what it hits, and hits lighter', kit: 'tranq_kit', damage: 0.7, power: 0 },
};

/** Every town has three kits. Later towns lean towards a fourth, gently. */
export const KITS_PER_TOWN = 3;
export const KIT_EXTRA_ODDS_PER_LEVEL = 0.03;
/** Share of kits shut away in a container rather than lying on a floor. */
export const KIT_CONTAINER_SHARE = 0.2;

/** Who keeps what, with relative odds. */
export const KIT_SOURCES: Partial<Record<BuildingKind, Partial<KitCounts>>> = {
  gun_shop: { incendiary: 2, acid: 1, piercing: 3, tranq: 1 },
  police: { piercing: 2, tranq: 2 },
  garage: { incendiary: 3, acid: 2 },
  warehouse: { incendiary: 2, acid: 2, piercing: 1 },
  clinic: { tranq: 3, acid: 1 },
  hospital: { tranq: 4, acid: 1 },
  // The science lab.
  school: { acid: 2 },
  pharmacy: { tranq: 3, acid: 1 },
};
