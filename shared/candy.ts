// Halloween candy: short boosts found in town. Each lasts about a horde. The bag has no bottom, so a
// night is as much trick-or-treating as shooting, and the survivor picks which candy to eat out of it.
// Eating one that is already working adds its time to the boost: the boost lasts longer, never grows stronger.
// Where it is hidden comes off the town's seed on a generator of its own, so every other roll stays put
// and a Daily Night hides the same candy in the same places for everyone.

import { TICK_DT } from './constants.ts';
import type { Container } from './containers.ts';
import type { CandyBag, CandyId, EntityId } from './protocol.ts';
import { hasKeepsake, TREAT_BAG_TIME } from './keepsakes.ts';
import { createRng, pickWeighted } from './rng.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { emit } from './sim-state.ts';

export type { CandyBag, CandyId } from './protocol.ts';

export interface CandyDef {
  readonly id: CandyId;
  readonly name: string;
  /** The stat it boosts, in a word, for the timer over the eater's head. */
  readonly stat: string;
  /** What it does, as the banner and the how-to-play say it. */
  readonly blurb: string;
  /** How often it turns up against the rest. */
  readonly weight: number;
}

export const CANDIES: Readonly<Record<CandyId, CandyDef>> = {
  sour_skulls: { id: 'sour_skulls', name: 'Sour Skulls', stat: 'RELOAD', blurb: 'Reload twice as fast.', weight: 10 },
  fang_taffy: { id: 'fang_taffy', name: 'Fang Taffy', stat: 'MELEE', blurb: 'Your shove and knife hit twice as hard.', weight: 10 },
  ghost_gum: { id: 'ghost_gum', name: 'Ghost Gum', stat: 'QUIET', blurb: 'Sprint without a sound.', weight: 10 },
  pumpkin_fizz: { id: 'pumpkin_fizz', name: 'Pumpkin Fizz', stat: 'SPEED', blurb: 'Run a quarter faster.', weight: 10 },
  witchs_brittle: { id: 'witchs_brittle', name: "Witch's Brittle", stat: 'HEAL', blurb: 'Every kill heals 2 health.', weight: 10 },
  bat_bites: { id: 'bat_bites', name: 'Bat Bites', stat: 'PIERCE', blurb: 'Bullets go through one zombie into the next.', weight: 10 },
  corn_rush: { id: 'corn_rush', name: 'Candy Corn Rush', stat: 'CHAIN', blurb: 'Kill chains hold five times as long.', weight: 10 },
  jawbreaker: { id: 'jawbreaker', name: 'Jawbreaker', stat: 'ARMOR', blurb: 'Take half damage.', weight: 10 },
  licorice_lash: { id: 'licorice_lash', name: 'Black Licorice Lash', stat: 'AIM', blurb: 'Heads are easier to hit.', weight: 10 },
  caramel_apple: { id: 'caramel_apple', name: 'Caramel Apple', stat: 'REVIVE', blurb: 'Go down while it lasts and you get straight back up.', weight: 6 },
  popping_eyeballs: { id: 'popping_eyeballs', name: 'Popping Eyeballs', stat: 'SPARKS', blurb: 'Spinners throw sparks half as far again.', weight: 8 },
  fireballs: { id: 'fireballs', name: 'Fireballs', stat: 'FIRE', blurb: 'Every shot is a flame round: it sets zombies alight.', weight: 7 },
  full_size_bar: { id: 'full_size_bar', name: 'Full-Size Bar', stat: 'ALL', blurb: 'A little of everything, but not for long.', weight: 2 },
};

export const CANDY_ORDER = Object.keys(CANDIES) as CandyId[];

/** About a horde. */
export const CANDY_SEC = 75;
export const FULL_SIZE_SEC = 20;
/** What every other candy is worth while a Full-Size Bar works. A Caramel Apple and Fireballs need the real thing. */
export const FULL_SIZE_STRENGTH = 0.5;

// What each does at full strength.
export const SPEED_BOOST = 0.25;
export const JAWBREAKER_GUARD = 0.5;
export const BRITTLE_HEAL = 2;
export const CORN_RUSH_WINDOW = 5;
export const LICORICE_HEAD_MARGIN = 3;
/** A Caramel Apple stands you up with this share of your health. */
export const CARAMEL_HEALTH = 0.3;

/** Candy is a Halloween night's loot, so homes hide the most. */
export const CANDY_ODDS: Partial<Record<Container['buildingKind'], number>> = {
  house: 0.3,
  // Bedrooms are where a night's haul gets hidden.
  upstairs: 0.45,
  apartment_upstairs: 0.35,
  hospital_upstairs: 0.05,
  school_upstairs: 0.32,
  cellar: 0.15,
  apartment: 0.25,
  grocery: 0.18,
  discount: 0.18,
  diner: 0.15,
  pharmacy: 0.08,
  clinic: 0.05,
  hospital: 0.05,
  // Confiscated in class, stuffed in lockers: a school is second only to bedrooms.
  school: 0.32,
  police: 0.05,
  garage: 0.04,
  warehouse: 0.04,
  gun_shop: 0.03,
};
/** Halloween night: every home left a bowl out by the front door for the trick-or-treaters, and the dead don't eat candy. */
export const DOORSTEP_HOMES: ReadonlySet<Container['buildingKind']> = new Set(['house', 'apartment']);
export const BOWL_CANDY_ODDS = 1;
const CANDY_SALT = 0x43414e44;
const WEIGHTS: Partial<Record<CandyId, number>> = Object.fromEntries(CANDY_ORDER.map((id) => [id, CANDIES[id].weight]));

export interface SugarState {
  readonly id: CandyId;
  left: number;
  /** Seconds it had when last eaten, stacked time and all. */
  total: number;
}

/** Most picks one survivor can have waiting for the next tick: a client cannot queue up a flood. */
const EAT_QUEUE_MAX = 8;

export const isCandyId = (value: unknown): value is CandyId => typeof value === 'string' && Object.hasOwn(CANDIES, value);

/** The candy a container hides, if any. Cars never hold candy; a bowl by a door always does. */
export function candyIn(seed: number, container: Container): CandyId | null {
  const isCar = container.kind === 'car';
  if (isCar) return null;
  const rng = createRng((seed ^ CANDY_SALT ^ Math.imul(container.id + 1, 0x85ebca6b)) >>> 0);
  const isBowl = container.kind === 'bowl';
  const odds = isBowl ? BOWL_CANDY_ODDS : CANDY_ODDS[container.buildingKind] ?? 0;
  const found = rng() < odds;
  return found ? pickWeighted(rng, WEIGHTS) : null;
}

/** Maximum candy pieces one survivor can carry in their bag. */
export const MAX_CANDY_BAG = 100;

/** Into the bag, capped at MAX_CANDY_BAG (100 pieces). */
export function takeCandy(p: PlayerState, candy: CandyId | null): CandyId | null {
  const foundNone = candy === null;
  if (foundNone) return null;
  const isBagFull = p.candy.length >= MAX_CANDY_BAG;
  if (isBagFull) return null;
  p.candy.push(candy);
  return candy;
}

/** The bag counted by kind, in the order kinds are listed, for snapshots. */
export function bagOf(candy: readonly CandyId[]): CandyBag {
  const bag: CandyBag = {};
  for (const id of candy) bag[id] = (bag[id] ?? 0) + 1;
  return bag;
}

/** How strongly a candy works on this survivor now: 1 eaten, a half under a Full-Size Bar, 0 otherwise. */
export function sugarOf(p: Pick<PlayerState, 'sugar'>, id: CandyId): number {
  let strength = 0;
  for (const sugar of p.sugar) {
    const isAlreadyBuzzing = sugar.id === id;
    if (isAlreadyBuzzing) return 1;
    const isFullSizeBar = sugar.id === 'full_size_bar';
    if (isFullSizeBar) strength = FULL_SIZE_STRENGTH;
  }
  return strength;
}

export function sugarById(sim: Pick<SimState, 'players'>, id: EntityId, candy: CandyId): number {
  const p = sim.players.find((each) => each.id === id);
  return p ? sugarOf(p, candy) : 0;
}

/** What a survivor's speed is multiplied by. Shared with the client's prediction. */
export function candySpeed(p: Pick<PlayerState, 'sugar'>): number {
  return 1 + SPEED_BOOST * sugarOf(p, 'pumpkin_fizz');
}

/** A pick off the bag, from an input packet, waits for the next tick. */
export function queueEat(p: PlayerState, pick: true | CandyId | undefined): void {
  const hasRoom = pick !== undefined && p.eatQueued.length < EAT_QUEUE_MAX;
  if (hasRoom) p.eatQueued.push(pick);
}

/** How long a candy works once eaten: a Trick-or-Treat Bag makes every one last half as long again. */
export function candySeconds(id: CandyId, p?: Pick<PlayerState, 'keepsakes'>): number {
  const base = id === 'full_size_bar' ? FULL_SIZE_SEC : CANDY_SEC;
  const bagged = p !== undefined && hasKeepsake(p, 'treat_bag');
  return bagged ? base * TREAT_BAG_TIME : base;
}

/** Eats one candy out of the bag, if it is there. A candy already working gets the new one's time on top. */
function eat(sim: SimState, p: PlayerState, pick: true | CandyId): void {
  const index = pick === true ? 0 : p.candy.indexOf(pick);
  const notInBag = index < 0 || index >= p.candy.length;
  if (notInBag) return;
  const [id] = p.candy.splice(index, 1);
  const seconds = candySeconds(id, p);
  const working = p.sugar.find((sugar) => sugar.id === id);
  if (working) {
    working.left += seconds;
    working.total = working.left;
  } else {
    p.sugar.push({ id, left: seconds, total: seconds });
  }
  emit(sim, { type: 'candy_eaten', playerId: p.id, candy: id, x: p.x, y: p.y, ...(working ? { stacked: true } : {}) });
}

/** Once a tick: eats whatever was picked out of the bag, and wears the rest down. */
export function updateCandy(sim: SimState, p: PlayerState): void {
  const picks = p.eatQueued;
  p.eatQueued = [];
  for (const sugar of p.sugar) sugar.left -= TICK_DT;
  p.sugar = p.sugar.filter((sugar) => sugar.left > 1e-9);
  const canEat = p.status === 'alive';
  if (!canEat) return;
  for (const pick of picks) eat(sim, p, pick);
}

/** A Caramel Apple catches a survivor about to go down, and is spent doing it. True if it did. */
export function caramelCatch(sim: SimState, p: PlayerState): boolean {
  const apple = p.sugar.findIndex((sugar) => sugar.id === 'caramel_apple');
  const hasNoCaramelApple = apple < 0;
  if (hasNoCaramelApple) return false;
  p.sugar.splice(apple, 1);
  p.health = Math.ceil(p.maxHealth * CARAMEL_HEALTH);
  emit(sim, { type: 'candy_eaten', playerId: p.id, candy: 'caramel_apple', x: p.x, y: p.y, saved: true });
  return true;
}
