// What the player can do with the item in hand: the verb for its use button, and whether it can be used or dropped.

import { isAmmoBoxType, isDroppableBagItem } from '../../../shared/bag.ts';
import { isCandyId } from '../../../shared/candy.ts';
import type { GridItem } from '../../../shared/grid-inventory.ts';
import { isSupplyType } from '../../../shared/supply-types.ts';

export type HeldActionKind = 'use' | 'drop';

export interface HeldAction {
  readonly kind: HeldActionKind;
  readonly label: string;
}

/** A box of rounds is loaded, not eaten, and it stays in the bag until the gun has used the rounds. */
export function isLoadable(item: GridItem): boolean {
  return isAmmoBoxType(item.type);
}

/** LOAD for a box of rounds, EAT for food and sweets, DRINK, APPLY, TAKE, HEAL, else USE. */
export function heldActionVerb(type: string): string {
  if (isAmmoBoxType(type)) return 'LOAD';
  if (isCandyId(type) || type === 'canned_food') return 'EAT';
  if (type === 'water_bottle' || type === 'bottle') return 'DRINK';
  if (type === 'bandage' || type === 'disinfectant') return 'APPLY';
  if (type === 'antibiotics') return 'TAKE';
  if (type === 'medkit') return 'HEAL';
  return 'USE';
}

/** The buttons the held item gets, in order: use first, then drop. */
export function heldActions(item: GridItem): readonly HeldAction[] {
  const actions: HeldAction[] = [];
  if (isAmmoBoxType(item.type) || isSupplyType(item.type) || isCandyId(item.type) || item.type === 'medkit') actions.push({ kind: 'use', label: heldActionVerb(item.type) });
  if (isDroppableBagItem(item.type) || isCandyId(item.type)) actions.push({ kind: 'drop', label: 'DROP' });
  return actions;
}
