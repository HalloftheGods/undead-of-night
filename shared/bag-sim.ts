import { ammoBoxRounds, ammoBoxWeapon, bagWanted, isAmmoBoxType, isDroppableBagItem, retierBag, stampAmmoBoxes, syncBag } from './bag.ts';
import type { AmmoBoxType, BagItemType, BagWanted, DroppableBagItem } from './bag.ts';
import { FORTIFICATION_ITEMS } from './fortifications.ts';
import { spawnPickup } from './pickups.ts';
import type { CandyId } from './candy.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { isSupplyType } from './supply-types.ts';

/** Takes up to `count` units of a type off the counters and returns how many it took. */
export function take(p: PlayerState, type: BagItemType, count: number): number {
  const held = bagWanted(p)[type];
  const taken = Math.min(held, count);
  if (taken <= 0) return 0;
  const m = p.materials;
  if (isSupplyType(type) && p.supplies) p.supplies[type] -= taken;
  else if (type === 'medkit') p.medkits -= taken;
  else if (type === 'bottle') p.bottles -= taken;
  else if (type === 'firework') p.fireworks -= taken;
  else if (type === 'fountain') p.fountains -= taken;
  else if (type === 'knife') p.knife = false;
  else if (m && type === 'plank') m.planks -= taken;
  else if (m && type === 'nails') m.nails -= taken;
  else if (m && type === 'sheet_curtain') m.sheets -= taken;
  else if (m && type === 'hammer_tool') m.hasHammer = false;
  else if (m && type === 'crowbar') m.hasCrowbar = false;
  return taken;
}

/** Puts what was taken on the ground at the player's feet. A box of nails goes down as whole finds. */
export function leaveOnGround(sim: SimState, p: PlayerState, type: DroppableBagItem, count: number): void {
  if (isAmmoBoxType(type)) return leaveAmmoOnGround(sim, p, type, count);
  const per = type === 'nails' ? FORTIFICATION_ITEMS.nails.unitsPerFind : 1;
  const pieces = Math.floor(count / per);
  const taken = take(p, type, pieces * per);
  for (let i = 0; i < taken / per; i += 1) {
    spawnPickup(sim, type, p.x, p.y);
    sim.pickups[sim.pickups.length - 1]!.leftBy = p.id;
  }
}

/** Each box goes down holding a full box of spare rounds, or what is left. The gun's loaded rounds stay in the gun. */
function leaveAmmoOnGround(sim: SimState, p: PlayerState, type: AmmoBoxType, boxes: number): void {
  const weapon = ammoBoxWeapon(type);
  for (let i = 0; i < boxes; i += 1) {
    const rounds = Math.min(p.ammoBag[weapon], ammoBoxRounds(type));
    if (rounds <= 0) return;
    p.ammoBag[weapon] -= rounds;
    spawnPickup(sim, type, p.x, p.y, rounds);
    sim.pickups[sim.pickups.length - 1]!.leftBy = p.id;
  }
}

export function leaveCandyOnGround(sim: SimState, p: PlayerState, id: CandyId, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const candyIndex = p.candy.indexOf(id);
    const hasCandy = candyIndex >= 0;
    if (hasCandy) p.candy.splice(candyIndex, 1);
    spawnPickup(sim, 'candy', p.x, p.y, 0, null, id);
    const lastPickup = sim.pickups[sim.pickups.length - 1];
    if (lastPickup) lastPickup.leftBy = p.id;
  }
}

/**
 * Makes the bag agree with the counters after anything changed them: a pickup, an item used, a purchase, a new pack.
 * What has no room is put on the ground where it can be, and is gone where it cannot.
 */
export function reconcileBag(sim: SimState, p: PlayerState): void {
  const evicted = retierBag(p.inventory, p.backpackTier);
  const overflow: Partial<BagWanted> = syncBag(p.inventory, bagWanted(p));
  for (const item of evicted) overflow[item.type as BagItemType] = (overflow[item.type as BagItemType] ?? 0) + (item.count ?? 1);
  for (const [type, count] of Object.entries(overflow) as [BagItemType, number][]) {
    // Rounds with no slot to show stay counted: the bag only limits what a pickup may add (takeAmmo).
    if (isAmmoBoxType(type)) continue;
    if (isDroppableBagItem(type)) leaveOnGround(sim, p, type, count);
    else take(p, type, count);
  }
  if (Object.keys(overflow).length > 0) syncBag(p.inventory, bagWanted(p));
  stampAmmoBoxes(p.inventory, p.ammoBag);
}
