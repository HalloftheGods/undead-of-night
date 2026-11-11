import { bagWanted, roomFor, syncBag } from './bag.ts';
import type { BagItemType } from './bag.ts';
import { BOTTLE_CARRY } from './bottles.ts';
import { isCandyId, takeCandy } from './candy.ts';
import { PICKUP_TYPES } from './events.ts';
import type { GridItem } from './grid-inventory.ts';
import { applyPickup } from './pickups.ts';
import type { PickupType } from './protocol.ts';
import type { PickupState, PlayerState } from './sim-state.ts';
import { FIREWORK_CARRY, FOUNTAIN_CARRY } from './throwables.ts';

/** Most of each counter-only item a survivor carries. These have no ground pickup, so `takeItem` never sees them. */
const COUNTER_CAP: Partial<Record<BagItemType, number>> = { firework: FIREWORK_CARRY, fountain: FOUNTAIN_CARRY, bottle: BOTTLE_CARRY };

const isPickupType = (type: string): type is PickupType => (PICKUP_TYPES as readonly string[]).includes(type);

function counterOf(p: PlayerState, type: BagItemType): number {
  return bagWanted(p)[type];
}

/** One more on its counter, as a walked-over find would: under the cap, and with a slot in the bag. */
function takeCounter(p: PlayerState, type: 'firework' | 'fountain' | 'bottle'): boolean {
  const cap = COUNTER_CAP[type] ?? 0;
  const isAtCap = counterOf(p, type) >= cap;
  const hasNoSlot = !roomFor(p, type);
  const isRefused = isAtCap || hasNoSlot;
  if (isRefused) return false;
  const isFirework = type === 'firework';
  const isFountain = type === 'fountain';
  if (isFirework) p.fireworks += 1;
  if (isFountain) p.fountains += 1;
  if (!isFirework && !isFountain) p.bottles += 1;
  syncBag(p.inventory, bagWanted(p));
  return true;
}

/**
 * Takes one item out of a searched container, by the rules of finding it on the ground. Returns what stays behind:
 * the item itself when it was refused (full counter, no slot, a type nothing here knows), the same item with fewer
 * rounds when only some fitted, and null when the player took all of it.
 */
export function takeFromContainer(p: PlayerState, item: GridItem): GridItem | null {
  const { type } = item;
  const isCandy = isCandyId(type);
  if (isCandy) return takeCandy(p, type) !== null ? null : item;
  const isCounterItem = type === 'firework' || type === 'fountain' || type === 'bottle';
  if (isCounterItem) return takeCounter(p, type) ? null : item;
  const isKnown = isPickupType(type);
  if (!isKnown) return item;
  const found: PickupState = { id: '0', type, rounds: item.ammo ?? item.count ?? 0, x: p.x, y: p.y, ttl: null };
  const isTaken = applyPickup(p, found);
  if (!isTaken) return item;
  const isAmmoLeft = found.rounds > 0;
  return isAmmoLeft ? { ...item, ammo: found.rounds } : null;
}
