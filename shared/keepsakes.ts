import { WEAPONS } from './constants.ts';
// Keepsakes: the slow, permanent side of the perks. After every second town each survivor is offered three
// they do not have yet and keeps one for the rest of the run. Each is a small edge, so the survivor picked at
// the start still sets how a run plays. The offer is drawn on a generator of its own, so no other roll moves.

import type { EntityId, KeepsakeId, WeaponId } from './protocol.ts';
import { createRng, shuffle } from './rng.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { emit } from './sim-state.ts';

export type { KeepsakeId } from './protocol.ts';

export interface KeepsakeDef {
  readonly id: KeepsakeId;
  readonly name: string;
  readonly blurb: string;
}

export const KEEPSAKES: Readonly<Record<KeepsakeId, KeepsakeDef>> = {
  rabbit_foot: { id: 'rabbit_foot', name: "Lucky Rabbit's Foot", blurb: 'Empty furniture turns something up more often.' },
  sneakers: { id: 'sneakers', name: 'Worn Sneakers', blurb: 'Sprint a fifth longer.' },
  bandolier: { id: 'bandolier', name: 'Bandolier', blurb: 'Carry a quarter more spare ammo.' },
  rosary: { id: 'rosary', name: 'Rosary', blurb: 'Downed, you hold on half as long again.' },
  lighter: { id: 'lighter', name: 'Pocket Lighter', blurb: 'Spinners whirl half as long again.' },
  old_watch: { id: 'old_watch', name: 'Old Watch', blurb: 'Reload a tenth faster, every gun.' },
  treat_bag: { id: 'treat_bag', name: 'Trick-or-Treat Bag', blurb: 'Carry three candies instead of two.' },
  dog_tags: { id: 'dog_tags', name: 'Dog Tags', blurb: 'Revive a downed teammate twice as fast.' },
};

export const KEEPSAKE_ORDER = Object.keys(KEEPSAKES) as KeepsakeId[];

/** Three to choose from, after every second town: entering towns 3, 5, 7 and 9. */
export const OFFER_SIZE = 3;
const OFFER_EVERY = 2;
const FIRST_OFFER_LEVEL = 3;
const KEEPSAKE_SALT = 0x4b454550;

// What each does.
export const RABBIT_LUCK = 0.15;
export const SNEAKER_STAMINA = 1.2;
export const BANDOLIER_AMMO = 1.25;
export const ROSARY_BLEEDOUT = 1.5;
export const LIGHTER_SPIN = 1.5;
export const WATCH_RELOAD = 1.1;
export const TREAT_BAG_CANDY = 3;
export const DOG_TAG_REVIVE = 2;

/** Spare rounds a survivor can carry for a gun. Shared with the client's "no room" note. */
export function ammoCapOf(p: { readonly keepsakes?: readonly KeepsakeId[] }, weapon: WeaponId): number {
  const strapped = p.keepsakes?.includes('bandolier') === true;
  return Math.round(WEAPONS[weapon].reserveCap * (strapped ? BANDOLIER_AMMO : 1));
}

export const isKeepsakeId = (value: unknown): value is KeepsakeId => typeof value === 'string' && value in KEEPSAKES;

export const hasKeepsake = (p: Pick<PlayerState, 'keepsakes'>, id: KeepsakeId): boolean => p.keepsakes.includes(id);

/** Whether arriving in this town brings an offer. */
export function offerDue(level: number): boolean {
  const reached = level >= FIRST_OFFER_LEVEL;
  return reached && (level - FIRST_OFFER_LEVEL) % OFFER_EVERY === 0;
}

function seedOf(id: EntityId): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 0x01000193);
  return hash >>> 0;
}

/** Three the survivor does not have, the same for the same town and survivor. Fewer once nearly all are kept. */
export function offerFor(mapSeed: number, p: Pick<PlayerState, 'id' | 'keepsakes'>): KeepsakeId[] {
  const rng = createRng((mapSeed ^ KEEPSAKE_SALT ^ seedOf(p.id)) >>> 0);
  const open = KEEPSAKE_ORDER.filter((id) => !p.keepsakes.includes(id));
  return shuffle(rng, open).slice(0, OFFER_SIZE);
}

/** On arriving in a town: anyone due an offer is made one. An offer not taken in the last town is replaced. */
export function offerKeepsakes(sim: SimState, players: Iterable<PlayerState>): void {
  const due = offerDue(sim.level);
  for (const p of players) {
    const offer = due ? offerFor(sim.map.seed, p) : [];
    p.keepsakeOffer = offer.length > 0 ? offer : null;
  }
}

/** Takes one of the three on offer. Anything not on offer is ignored. */
export function takeKeepsake(sim: SimState, p: PlayerState, pick: KeepsakeId): void {
  const offered = p.keepsakeOffer?.includes(pick) === true;
  if (!offered) return;
  p.keepsakes.push(pick);
  p.keepsakeOffer = null;
  emit(sim, { type: 'keepsake_taken', playerId: p.id, keepsake: pick });
}
