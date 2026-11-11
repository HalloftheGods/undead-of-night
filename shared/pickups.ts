import { bagTypeOf, bagWanted, roomFor, syncBag } from './bag.ts';
import { ammoCapOf } from './keepsakes.ts';
import { characterOf } from './characters.ts';
import {
  AMMO_PICKUPS,
  KILL_DROP_CHANCE,
  KILL_DROP_ROUNDS,
  KILL_DROP_TTL_SEC,
  MEDKIT_MAX,
  PICKUP_RADIUS,
  TICK_DT,
  WEAPONS,
} from './constants.ts';
import type { AmmoPickup } from './constants.ts';
import { foundGunFit, isPartPickup, takePart } from './gun-upgrades.ts';
import { WEAPON_ORDER } from './protocol.ts';
import type { PickupType, WeaponId } from './protocol.ts';
import { isKitPickup, takeKit } from './round-effects.ts';
import { emptySupplies, isSupplyType } from './supply-types.ts';
import { createEmptyFortificationInventory, isFortificationItem, takeFortificationItem } from './fortifications.ts';
import type { PickupState, PlayerState, SimState } from './sim-state.ts';
import { emit, entityId } from './sim-state.ts';
import { spawnSalvage, takeSalvage } from './salvage.ts';
import { isSalvagePickup } from './salvage-data.ts';
import { isTreasurePickup, spawnTreasure, takeTreasure } from './treasure.ts';
import { syncGun } from './weapons.ts';

/** Share of kill drops that are a bandage rather than a few rounds. */
const KILL_DROP_BANDAGE_ODDS = 0.4;

export const isAmmoPickup = (type: PickupType): type is AmmoPickup => type in AMMO_PICKUPS;

export function spawnPickup(sim: SimState, type: PickupType, x: number, y: number, rounds = 0, ttl: number | null = null): void {
  // Treasure is numbered on its own counter, so it never moves `sim.nextEntity`.
  const isHomeTreasure = isTreasurePickup(type) && sim.homeRun;
  if (isHomeTreasure) return spawnTreasure(sim, type, x, y, rounds);
  const isHomeSalvage = isSalvagePickup(type) && sim.homeRun;
  if (isHomeSalvage) return spawnSalvage(sim, type, x, y, rounds);
  sim.pickups.push({ id: entityId(sim, 'i'), type, x, y, ttl, rounds });
}

/** Rarely, something small falls off a body. It does not last. */
export function maybeDropOnKill(sim: SimState, x: number, y: number, killer?: PlayerState): void {
  const odds = killer ? characterOf(killer.skin).dropOdds : 1;
  const isNoDrop = sim.rng() >= KILL_DROP_CHANCE * odds;
  if (isNoDrop) return;
  const dropsBandage = sim.rng() < KILL_DROP_BANDAGE_ODDS;
  if (dropsBandage) spawnPickup(sim, 'bandage', x, y, 0, KILL_DROP_TTL_SEC);
  else spawnPickup(sim, 'pistol_ammo', x, y, KILL_DROP_ROUNDS, KILL_DROP_TTL_SEC);
}

/** Banks as much as fits, gun or no gun, and leaves the rest of the box lying there. */
function takeAmmo(p: PlayerState, item: PickupState, type: AmmoPickup): boolean {
  const { weapon } = AMMO_PICKUPS[type];
  const room = ammoCapOf(p, weapon) - p.ammoBag[weapon];
  const taken = Math.min(room, item.rounds);
  const hasNoRoom = taken <= 0;
  if (hasNoRoom) return false;
  p.ammoBag[weapon] += taken;
  item.rounds -= taken;
  return true;
}

/** A second gun is stripped for what fits in the bag and stays there with the rest; a new one comes loaded. */
function takeGun(p: PlayerState, item: PickupState, weapon: WeaponId): boolean {
  const stats = WEAPONS[weapon];
  // Zero means nobody has been at it yet: it still holds what it was found with.
  const loaded = item.rounds > 0 ? item.rounds : stats.foundAmmo;
  if (p.guns[weapon]) {
    const taken = Math.min(ammoCapOf(p, weapon) - p.ammoBag[weapon], loaded);
    const hasNoRoom = taken <= 0;
    if (hasNoRoom) return false;
    p.ammoBag[weapon] += taken;
    item.rounds = loaded - taken;
    return true;
  }
  p.guns[weapon] = { ammo: loaded, fit: foundGunFit(item) };
  item.rounds = 0;
  p.owned = WEAPON_ORDER.filter((id) => id === weapon || p.owned.includes(id));
  p.weapon = weapon;
  p.reloadLeft = 0;
  p.reload = 0;
  return true;
}

/** False leaves the item on the ground: it would have done nothing for this player. */
export function applyPickup(p: PlayerState, item: PickupState): boolean {
  const { type } = item;
  const bagType = bagTypeOf(type);
  // A thing for the bag stays on the ground when the bag has no slot for it, as when a count is at its cap.
  if (bagType && !roomFor(p, bagType)) return false;
  const taken = takeItem(p, item);
  if (taken && bagType) syncBag(p.inventory, bagWanted(p));
  return taken;
}

export function takeItem(p: PlayerState, item: PickupState): boolean {
  const { type } = item;
  const isSupply = isSupplyType(type);
  if (isSupply) {
    const supplies = p.supplies ?? (p.supplies = emptySupplies());
    supplies[type] += 1;
    return true;
  }
  const isMedkit = type === 'medkit';
  if (isMedkit) {
    const hasMaxMedkits = p.medkits >= MEDKIT_MAX;
    if (hasMaxMedkits) return false;
    p.medkits += 1;
    return true;
  }
  const isKnife = type === 'knife';
  if (isKnife) {
    if (p.knife) return false;
    p.knife = true;
    return true;
  }
  const isRadio = type === 'radio';
  if (isRadio) return true;
  const isFortification = isFortificationItem(type);
  if (isFortification) {
    const materials = p.materials ?? (p.materials = createEmptyFortificationInventory());
    return takeFortificationItem(materials, type, p.backpackTier);
  }
  if (isPartPickup(type)) return takePart(p, type);
  if (isKitPickup(type)) return takeKit(p, type);
  if (isTreasurePickup(type)) return takeTreasure(p, item);
  if (isSalvagePickup(type)) return takeSalvage(p, item, type);
  // Only a gun or a box of rounds is left here. Anything else, a bag counter such as a firework included, is not ours to take.
  const isGun = Object.hasOwn(WEAPONS, type);
  const used = isAmmoPickup(type) ? takeAmmo(p, item, type) : isGun && takeGun(p, item, type as WeaponId);
  if (used) syncGun(p);
  return used;
}

function collectedBy(sim: SimState, item: PickupState): PlayerState | null {
  for (const p of sim.players) {
    const touching = p.status === 'alive' && Math.hypot(p.x - item.x, p.y - item.y) <= PICKUP_RADIUS;
    // What a player dropped on purpose is theirs to pick up again only after they have stepped off it.
    if (item.leftBy === p.id) {
      if (!touching) delete item.leftBy;
      continue;
    }
    const picksUp = touching && applyPickup(p, item);
    if (picksUp) return p;
  }
  return null;
}

export function updatePickups(sim: SimState): void {
  sim.pickups = sim.pickups.filter((item) => {
    const { ttl } = item;
    const isTimed = ttl !== null;
    if (isTimed) {
      item.ttl = ttl - TICK_DT;
      const isExpired = item.ttl <= 0;
      if (isExpired) return false;
    }
    const taker = collectedBy(sim, item);
    if (!taker) return true;
    emit(sim, { type: 'pickup', playerId: taker.id, pickup: item.type, x: item.x, y: item.y });
    return item.rounds > 0;
  });
}
