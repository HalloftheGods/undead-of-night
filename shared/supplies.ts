// Using what is carried. A supply is used three ways: from the bag by hand (the USE button, sent with the bag's
// one commit), from a pocket by itself when the need is plain, and never just by being picked up.

import { BANDAGE_HEAL } from './constants.ts';
import type { PlayerState } from './sim-state.ts';
import { emptySupplies, isSupplyType, SUPPLY_TYPES } from './supply-types.ts';
import type { SupplyType } from './supply-types.ts';
import { bandageWound, consumeSurvivalItem } from './survival-needs.ts';
import type { SurvivalNeeds } from './survival-needs.ts';

/** A pocketed tin or bottle is opened once hunger or thirst has climbed this far (0 is sated, 100 is the worst). */
export const POCKET_EAT_AT = 60;
export const POCKET_DRINK_AT = 60;
/** A pocketed bandage goes on by itself at or under this share of health, and at once on a bleed. */
export const POCKET_BANDAGE_SHARE = 0.5;
/** A pocketed course of antibiotics is taken once the infection is far enough along to use all of it. */
export const POCKET_ANTIBIOTICS_AT = 35;

type Patient = Pick<PlayerState, 'health' | 'maxHealth' | 'needs'>;

/** Does what one of `type` does to its user. False, and nothing changed, when it would do nothing. */
export function applySupply(p: Patient, type: SupplyType): boolean {
  const needs = p.needs;
  if (type === 'bandage') {
    const isBleeding = needs?.bleeding === true;
    const canTreat = p.health < p.maxHealth || isBleeding;
    if (!canTreat) return false;
    if (isBleeding) bandageWound(needs!);
    p.health = Math.min(p.maxHealth, p.health + BANDAGE_HEAL);
    return true;
  }
  return needs !== undefined && consumeSurvivalItem(needs, p, type);
}

const POCKET_WANTS: Record<SupplyType, (p: Patient, needs: SurvivalNeeds | undefined) => boolean> = {
  bandage: (p, needs) => needs?.bleeding === true || p.health <= p.maxHealth * POCKET_BANDAGE_SHARE,
  canned_food: (_, needs) => needs !== undefined && needs.hunger >= POCKET_EAT_AT,
  water_bottle: (_, needs) => needs !== undefined && needs.thirst >= POCKET_DRINK_AT,
  disinfectant: (_, needs) => needs !== undefined && needs.isInfected && (needs.wound === 'scratch' || needs.wound === 'laceration'),
  antibiotics: (_, needs) => needs !== undefined && needs.infection >= POCKET_ANTIBIOTICS_AT,
};

/** True when a pocketed one of `type` should be used now, without being asked. */
export function pocketWants(p: Patient, type: SupplyType): boolean {
  return POCKET_WANTS[type](p, p.needs);
}

/** Uses one carried `type` by hand. False when none is carried or it would do nothing; the count only drops on a use. */
export function useSupply(p: PlayerState, type: SupplyType): boolean {
  const supplies = p.supplies ?? (p.supplies = emptySupplies());
  const usable = p.status === 'alive' && supplies[type] > 0 && applySupply(p, type);
  if (usable) supplies[type] -= 1;
  return usable;
}

/**
 * Once a tick: whatever sits in the pockets and is plainly needed is used, one of each kind at most. The bag's own
 * sync then takes the item out, pockets first, as it does on the client. Returns what was used, for the feed.
 */
export function usePocketSupplies(p: PlayerState): SupplyType[] {
  const pocketed = new Set(p.inventory.pockets.items.map((item) => item.type).filter(isSupplyType));
  if (pocketed.size === 0 || p.status !== 'alive') return [];
  return SUPPLY_TYPES.filter((type) => pocketed.has(type) && pocketWants(p, type) && useSupply(p, type));
}
