// Gear in hand, as a Loadout and back, and what the locker does with what comes home.

import { BOTTLE_CARRY } from './bottles.ts';
import { MEDKIT_MAX, START_SPARE_ROUNDS, WEAPONS } from './constants.ts';
import { reserveCapForTier, type BackpackTier } from './backpack.ts';
import { GUN_SLOTS, PART_CARRY_CAP, PART_ORDER, QUIRK_ORDER, UPGRADE_ORDER, UPGRADES } from './gun-upgrade-data.ts';
import type { GunQuirk, GunUpgrade, PartCounts, PartId } from './gun-upgrade-data.ts';
import { effectOf, gunStats, noParts, rankOf, slotsUsed } from './gun-upgrades.ts';
import type { GunFit } from './gun-upgrades.ts';
import type { Loadout } from './home-protocol.ts';
import { WEAPON_ORDER } from './protocol.ts';
import type { PlayerEntity, WeaponId } from './protocol.ts';
import { EFFECT_ORDER, KIT_CARRY_CAP } from './round-effect-data.ts';
import type { GunEffect, KitCounts } from './round-effect-data.ts';
import { noKits } from './round-effects.ts';
import type { GunState, PlayerState } from './sim-state.ts';
import { syncGun } from './weapons.ts';

export function emptyLoadout(): Loadout {
  return { guns: {}, ammoBag: { pistol: 0, carbine: 0, shotgun: 0 }, parts: noParts(), kits: noKits(), medkits: 0, knife: false, bottles: 0 };
}

const reserveCapOf = (weapon: WeaponId, tier?: BackpackTier): number =>
  tier ? reserveCapForTier(weapon, tier) : WEAPONS[weapon].reserveCap;

/** What a magazine holds goes back in with the rounds, and anything over the reserve cap is lost. */
function roundsOf(bag: Record<WeaponId, number>, mags: Readonly<Partial<Record<WeaponId, number>>>, tier?: BackpackTier): Record<WeaponId, number> {
  const rounds = WEAPON_ORDER.map((weapon) => [weapon, Math.min(reserveCapOf(weapon, tier), bag[weapon] + (mags[weapon] ?? 0))]);
  return Object.fromEntries(rounds) as Record<WeaponId, number>;
}

function gunsOf(owned: readonly WeaponId[], fitOf: (weapon: WeaponId) => GunFit | undefined): Loadout['guns'] {
  const guns: Loadout['guns'] = {};
  for (const weapon of owned) {
    const fit = fitOf(weapon);
    guns[weapon] = fit ? { fit } : {};
  }
  return guns;
}

export function loadoutOf(p: PlayerState): Loadout {
  const owned = WEAPON_ORDER.filter((weapon) => p.guns[weapon]);
  const mags = Object.fromEntries(owned.map((weapon) => [weapon, (p.guns[weapon] as GunState).ammo]));
  return {
    guns: gunsOf(owned, (weapon) => p.guns[weapon]?.fit),
    ammoBag: roundsOf(p.ammoBag, mags, p.backpackTier),
    parts: { ...p.parts },
    kits: { ...p.kits },
    medkits: p.medkits,
    knife: p.knife,
    bottles: p.bottles,
  };
}

/** `loadoutOf` for a client, which holds only the entity. `gear`, `gear.kits` and `bottles` are left off the wire at none. */
export function loadoutOfEntity(entity: PlayerEntity): Loadout {
  const { gear } = entity;
  return {
    guns: gunsOf(entity.owned, (weapon) => gear?.fits[weapon]),
    ammoBag: roundsOf(entity.ammoBag, entity.mags, entity.backpackTier),
    parts: { ...(gear?.parts ?? noParts()) },
    kits: { ...(gear?.kits ?? noKits()) },
    medkits: entity.medkits,
    knife: entity.knife,
    bottles: entity.bottles ?? 0,
  };
}

/** The HUD's mirror of the held gun, which `syncGun` leaves alone when there is none. */
function syncHands(p: PlayerState): void {
  p.reserve = p.ammoBag[p.weapon];
  const emptyHanded = !p.guns[p.weapon];
  if (emptyHanded) {
    p.ammo = 0;
    p.magSize = 0;
  }
  syncGun(p);
}

/** Puts this gear in the player's hands in place of what they held, each gun loaded from its own rounds. */
export function applyLoadout(p: PlayerState, loadout: Loadout): void {
  const ammoBag = { ...loadout.ammoBag };
  const guns: PlayerState['guns'] = {};
  const owned = WEAPON_ORDER.filter((weapon) => loadout.guns[weapon]);
  for (const weapon of owned) {
    const fit = loadout.guns[weapon]?.fit;
    const ammo = Math.min(gunStats(weapon, fit).magSize, ammoBag[weapon]);
    ammoBag[weapon] -= ammo;
    guns[weapon] = fit ? { ammo, fit } : { ammo };
  }
  p.guns = guns;
  p.ammoBag = ammoBag;
  p.owned = owned;
  p.weapon = owned.includes(p.weapon) ? p.weapon : (owned[0] ?? 'pistol');
  p.parts = { ...loadout.parts };
  p.kits = { ...loadout.kits };
  p.medkits = loadout.medkits;
  p.knife = loadout.knife;
  p.bottles = loadout.bottles;
  p.reload = 0;
  p.reloadLeft = 0;
  p.weaponQueued = null;
  syncHands(p);
}

/** Nobody is ever stuck: anyone with no gun in hand gets a loaded pistol and spare rounds, and keeps the rest of what they hold. */
export function issueFreePistol(p: PlayerState): void {
  const hasAGun = WEAPON_ORDER.some((weapon) => p.guns[weapon]);
  if (hasAGun) return;
  p.guns = { pistol: { ammo: WEAPONS.pistol.magSize } };
  p.ammoBag = { ...p.ammoBag, pistol: Math.min(reserveCapOf('pistol'), p.ammoBag.pistol + START_SPARE_ROUNDS) };
  p.owned = ['pistol'];
  p.weapon = 'pistol';
  syncHands(p);
}

export const modsOn = (fit: GunFit | undefined): number => slotsUsed(fit) + (effectOf(fit) ? 1 : 0);

function refundParts(parts: PartCounts, fit: GunFit | undefined): void {
  for (const upgrade of UPGRADE_ORDER) {
    const costs = Object.entries(UPGRADES[upgrade].cost) as [PartId, number][];
    for (const [part, count] of costs) parts[part] += rankOf(fit, upgrade) * count;
  }
}

function refundKit(kits: KitCounts, fit: GunFit | undefined): void {
  const effect = effectOf(fit);
  if (effect) kits[effect] += 1;
}

const heldTo = <K extends string>(counts: Record<K, number>, cap: number): Record<K, number> => {
  const held = (Object.entries(counts) as [K, number][]).map(([id, count]) => [id, Math.min(cap, count)]);
  return Object.fromEntries(held) as Record<K, number>;
};

/** What the van brought home, into the locker. One of each gun, the one with more mods, with the other's work paid back, and everything held to its carry cap. */
export function mergeHome(locker: Loadout, gear: Loadout): Loadout {
  const guns = { ...locker.guns };
  const parts = Object.fromEntries(PART_ORDER.map((part) => [part, locker.parts[part] + gear.parts[part]])) as PartCounts;
  const kits = Object.fromEntries(EFFECT_ORDER.map((effect) => [effect, locker.kits[effect] + gear.kits[effect]])) as KitCounts;
  for (const weapon of WEAPON_ORDER) {
    const stored = locker.guns[weapon];
    const cameHome = gear.guns[weapon];
    const nothingCameHome = !cameHome;
    if (nothingCameHome) continue;
    const homeBetter = !stored || modsOn(cameHome.fit) > modsOn(stored.fit);
    const stripped = homeBetter ? stored : cameHome;
    if (homeBetter) guns[weapon] = cameHome;
    refundParts(parts, stripped?.fit);
    refundKit(kits, stripped?.fit);
  }
  return {
    guns,
    ammoBag: roundsOf(locker.ammoBag, gear.ammoBag),
    parts: heldTo(parts, PART_CARRY_CAP),
    kits: heldTo(kits, KIT_CARRY_CAP),
    medkits: Math.min(MEDKIT_MAX, locker.medkits + gear.medkits),
    knife: locker.knife || gear.knife,
    bottles: Math.min(BOTTLE_CARRY, locker.bottles + gear.bottles),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const isCount = (value: unknown, cap: number): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= cap;

/** Every id present and in range, and nothing else there. */
function readCounts<K extends string>(value: unknown, ids: readonly K[], capOf: (id: K) => number): Record<K, number> | null {
  if (!isRecord(value)) return null;
  const onlyKnownIds = Object.keys(value).every((id) => ids.includes(id as K));
  const inRange = ids.every((id) => isCount(value[id], capOf(id)));
  const legal = onlyKnownIds && inRange;
  return legal ? (Object.fromEntries(ids.map((id) => [id, value[id]])) as Record<K, number>) : null;
}

function readRanks(value: unknown): GunFit['ranks'] | null {
  if (!isRecord(value)) return null;
  const legal = Object.entries(value).every(([upgrade, rank]) => {
    const known = UPGRADE_ORDER.includes(upgrade as GunUpgrade);
    return known && isCount(rank, UPGRADES[upgrade as GunUpgrade].maxRank);
  });
  return legal ? (value as GunFit['ranks']) : null;
}

function readFit(value: unknown, weapon: WeaponId): GunFit | null {
  if (!isRecord(value)) return null;
  const { quirk, effect } = value;
  const ranks = readRanks(value.ranks);
  const quirkKnown = quirk === null || QUIRK_ORDER.includes(quirk as GunQuirk);
  const effectKnown = effect === undefined || EFFECT_ORDER.includes(effect as GunEffect);
  const legal = ranks !== null && quirkKnown && effectKnown;
  if (!legal) return null;
  const fit: GunFit = { ranks: { ...ranks }, quirk: quirk as GunQuirk | null, ...(effect ? { effect: effect as GunEffect } : {}) };
  return slotsUsed(fit) <= GUN_SLOTS[weapon] ? fit : null;
}

function readGuns(value: unknown): Loadout['guns'] | null {
  if (!isRecord(value)) return null;
  const guns: Loadout['guns'] = {};
  for (const [id, gun] of Object.entries(value)) {
    const weapon = id as WeaponId;
    const knownGun = WEAPON_ORDER.includes(weapon) && isRecord(gun);
    if (!knownGun) return null;
    const stock = gun.fit === undefined;
    const fit = stock ? null : readFit(gun.fit, weapon);
    const badFit = !stock && !fit;
    if (badFit) return null;
    guns[weapon] = fit ? { fit } : {};
  }
  return guns;
}

/** Legal gear as a clean copy, or null. Checks ids, slots and caps, and cannot prove the gear was earned. */
export function validateLoadout(value: unknown): Loadout | null {
  if (!isRecord(value)) return null;
  const { medkits, knife, bottles } = value;
  const guns = readGuns(value.guns);
  const ammoBag = readCounts(value.ammoBag, WEAPON_ORDER, reserveCapOf);
  const parts = readCounts(value.parts, PART_ORDER, () => PART_CARRY_CAP);
  const kits = readCounts(value.kits, EFFECT_ORDER, () => KIT_CARRY_CAP);
  const legalCarry = isCount(medkits, MEDKIT_MAX) && isCount(bottles, BOTTLE_CARRY) && typeof knife === 'boolean';
  const legal = guns && ammoBag && parts && kits && legalCarry;
  return legal ? { guns, ammoBag, parts, kits, medkits, knife, bottles } : null;
}
