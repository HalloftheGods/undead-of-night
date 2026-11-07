// Halloween candy: short boosts found in town. Each lasts about a horde, a survivor carries two at most,
// and a candy already working cannot be eaten again until it wears off, so boosts never stack.
// Where it is hidden comes off the town's seed on a generator of its own, so every other roll stays put
// and a Daily Night hides the same candy in the same places for everyone.

import { TICK_DT } from './constants.ts';
import type { Container } from './containers.ts';
import type { CandyId, EntityId } from './protocol.ts';
import { hasKeepsake, TREAT_BAG_CANDY } from './keepsakes.ts';
import { createRng, pickWeighted } from './rng.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { emit } from './sim-state.ts';

export type { CandyId } from './protocol.ts';

export interface CandyDef {
  readonly id: CandyId;
  readonly name: string;
  /** What it does, as the banner and the how-to-play say it. */
  readonly blurb: string;
  /** How often it turns up against the rest. */
  readonly weight: number;
}

export const CANDIES: Readonly<Record<CandyId, CandyDef>> = {
  sour_skulls: { id: 'sour_skulls', name: 'Sour Skulls', blurb: 'Reload twice as fast.', weight: 10 },
  fang_taffy: { id: 'fang_taffy', name: 'Fang Taffy', blurb: 'Your shove and knife hit twice as hard.', weight: 10 },
  ghost_gum: { id: 'ghost_gum', name: 'Ghost Gum', blurb: 'Sprint without a sound.', weight: 10 },
  pumpkin_fizz: { id: 'pumpkin_fizz', name: 'Pumpkin Fizz', blurb: 'Run a quarter faster.', weight: 10 },
  witchs_brittle: { id: 'witchs_brittle', name: "Witch's Brittle", blurb: 'Every kill heals 2 health.', weight: 10 },
  bat_bites: { id: 'bat_bites', name: 'Bat Bites', blurb: 'Bullets go through one zombie into the next.', weight: 10 },
  corn_rush: { id: 'corn_rush', name: 'Candy Corn Rush', blurb: 'Kill chains hold five times as long.', weight: 10 },
  jawbreaker: { id: 'jawbreaker', name: 'Jawbreaker', blurb: 'Take half damage.', weight: 10 },
  licorice_lash: { id: 'licorice_lash', name: 'Black Licorice Lash', blurb: 'Heads are easier to hit.', weight: 10 },
  caramel_apple: { id: 'caramel_apple', name: 'Caramel Apple', blurb: 'Go down while it lasts and you get straight back up.', weight: 6 },
  popping_eyeballs: { id: 'popping_eyeballs', name: 'Popping Eyeballs', blurb: 'Molotovs need no fuel.', weight: 8 },
  full_size_bar: { id: 'full_size_bar', name: 'Full-Size Bar', blurb: 'A little of everything, but not for long.', weight: 2 },
};

export const CANDY_ORDER = Object.keys(CANDIES) as CandyId[];

/** Most candy a survivor carries; the next one stays where it was. */
export const CANDY_CARRY = 2;
/** About a horde. */
export const CANDY_SEC = 75;
export const FULL_SIZE_SEC = 20;
/** What every other candy is worth while a Full-Size Bar works. A Caramel Apple needs the real thing. */
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
const CANDY_ODDS: Partial<Record<Container['buildingKind'], number>> = {
  house: 0.3,
  // Bedrooms are where a night's haul gets hidden.
  upstairs: 0.45,
  apartment_upstairs: 0.35,
  cellar: 0.15,
  apartment: 0.25,
  grocery: 0.18,
  discount: 0.18,
  diner: 0.15,
  pharmacy: 0.08,
  clinic: 0.05,
  police: 0.05,
  garage: 0.04,
  warehouse: 0.04,
  gun_shop: 0.03,
};
const CANDY_SALT = 0x43414e44;
const WEIGHTS: Partial<Record<CandyId, number>> = Object.fromEntries(CANDY_ORDER.map((id) => [id, CANDIES[id].weight]));

export interface SugarState {
  readonly id: CandyId;
  left: number;
}

/** The candy a container hides, if any. Cars never hold candy. */
export function candyIn(seed: number, container: Container): CandyId | null {
  const isCar = container.kind === 'car';
  if (isCar) return null;
  const rng = createRng((seed ^ CANDY_SALT ^ Math.imul(container.id + 1, 0x85ebca6b)) >>> 0);
  const odds = CANDY_ODDS[container.buildingKind] ?? 0;
  const found = rng() < odds;
  return found ? pickWeighted(rng, WEIGHTS) : null;
}

/** Two, or three with a Trick-or-Treat Bag. */
export function candyCarry(p: Pick<PlayerState, 'keepsakes'>): number {
  return hasKeepsake(p, 'treat_bag') ? TREAT_BAG_CANDY : CANDY_CARRY;
}

/** Into the bag if it has room. */
export function takeCandy(p: PlayerState, candy: CandyId | null): CandyId | null {
  const room = p.candy.length < candyCarry(p);
  const taken = candy !== null && room;
  if (!taken) return null;
  p.candy.push(candy);
  return candy;
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

/** The first candy in the bag that is not working already: eating one twice would only waste it. */
function nextToEat(p: PlayerState): number {
  return p.candy.findIndex((id) => !p.sugar.some((sugar) => sugar.id === id));
}

/** Once a tick: eats a candy if asked, and wears the rest down. */
export function updateCandy(sim: SimState, p: PlayerState): void {
  const wantsToEat = p.eatQueued;
  p.eatQueued = false;
  for (const sugar of p.sugar) sugar.left -= TICK_DT;
  p.sugar = p.sugar.filter((sugar) => sugar.left > 1e-9);
  const index = wantsToEat && p.status === 'alive' ? nextToEat(p) : -1;
  const hasNothingToEat = index < 0;
  if (hasNothingToEat) return;
  const [id] = p.candy.splice(index, 1);
  p.sugar.push({ id, left: id === 'full_size_bar' ? FULL_SIZE_SEC : CANDY_SEC });
  emit(sim, { type: 'candy_eaten', playerId: p.id, candy: id, x: p.x, y: p.y });
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
