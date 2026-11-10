// The home side of a server frame. As with the rest of the guards, one bad field drops the frame.

import { isDifficultyId } from '../../shared/difficulty.ts';
import { SALVAGE_TYPES } from '../../shared/events.ts';
import { PART_ORDER } from '../../shared/gun-upgrade-data.ts';
import { OVERRUN_PHASES, STATION_IDS } from '../../shared/home-protocol.ts';
import type { HomeView, Jewels, Loadout, OverrunReceipt, OverrunView, RoomHomeView, SalvageCounts, TripReceipt } from '../../shared/home-protocol.ts';
import { WEAPON_ORDER } from '../../shared/protocol.ts';
import type { WeaponId } from '../../shared/protocol.ts';
import { EFFECT_ORDER } from '../../shared/round-effect-data.ts';
import { isGunFit } from './bench-guards.ts';

type Fields = Record<string, unknown>;

const STATIONS: readonly unknown[] = STATION_IDS;
const OUTCOMES: readonly unknown[] = ['banked', 'died'];
const OVERRUN_OUTCOMES: readonly unknown[] = ['held', 'fled', 'died'];
const PHASES: readonly unknown[] = OVERRUN_PHASES;

const isFields = (v: unknown): v is Fields => typeof v === 'object' && v !== null;
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function hasNumbers(v: unknown, keys: readonly string[]): boolean {
  return isFields(v) && keys.every((key) => isNumber(v[key]));
}

export const isJewels = (v: unknown): v is Jewels => hasNumbers(v, ['small', 'large']);

export const isSalvageCounts = (v: unknown): v is SalvageCounts => hasNumbers(v, SALVAGE_TYPES);

/** Left off by a server from before salvage. */
const isOptionalSalvage = (v: unknown): boolean => v === undefined || isSalvageCounts(v);

const isGunEntry = ([weapon, gun]: [string, unknown]): boolean =>
  WEAPON_ORDER.includes(weapon as WeaponId) && isFields(gun) && (gun.fit === undefined || isGunFit(gun.fit));

export function isLoadout(v: unknown): v is Loadout {
  return isFields(v)
    && isFields(v.guns)
    && Object.entries(v.guns).every(isGunEntry)
    && hasNumbers(v.ammoBag, WEAPON_ORDER)
    && hasNumbers(v.parts, PART_ORDER)
    && hasNumbers(v.kits, EFFECT_ORDER)
    && isNumber(v.medkits)
    && typeof v.knife === 'boolean'
    && isNumber(v.bottles);
}

export function isTripReceipt(v: unknown): v is TripReceipt {
  return isFields(v)
    && typeof v.simId === 'string'
    && OUTCOMES.includes(v.outcome)
    && isDifficultyId(v.difficulty)
    && hasNumbers(v, ['serial', 'level', 'silver', 'score', 'kills', 'hordes', 'seconds'])
    && isJewels(v.jewels)
    && typeof v.replay === 'boolean'
    && typeof v.ending === 'boolean'
    && (v.gear === null || isLoadout(v.gear))
    && isOptionalSalvage(v.salvage);
}

function hasOverrunFacts(v: Fields): boolean {
  return typeof v.simId === 'string'
    && OVERRUN_OUTCOMES.includes(v.outcome)
    && hasNumbers(v, ['serial', 'share', 'silver', 'kills', 'seconds'])
    && isJewels(v.jewels)
    && (v.chest === null || isLoadout(v.chest))
    && (v.lost === null || isLoadout(v.lost));
}

/** A died receipt carried inside a held one: one level deep, never another held. */
const isCarriedDeath = (v: unknown): boolean => isFields(v) && v.outcome === 'died' && v.died === undefined && hasOverrunFacts(v);

export function isOverrunReceipt(v: unknown): v is OverrunReceipt {
  return isFields(v)
    && hasOverrunFacts(v)
    && (v.died === undefined || (v.outcome === 'held' && isCarriedDeath(v.died)));
}

export function isOverrunView(v: unknown): v is OverrunView {
  return isFields(v)
    && PHASES.includes(v.phase)
    && hasNumbers(v, ['left', 'hostiles', 'total'])
    && (v.spanSec === undefined || isNumber(v.spanSec))
    && typeof v.slowed === 'boolean';
}

export function isHomeView(v: unknown): v is HomeView {
  return isFields(v)
    && hasNumbers(v, ['silver', 'stationHold'])
    && isJewels(v.jewels)
    && isOptionalSalvage(v.salvage)
    && (v.station === null || STATIONS.includes(v.station))
    && typeof v.ready === 'boolean'
    && (v.receipt === null || isTripReceipt(v.receipt))
    && (v.overrun === undefined || v.overrun === null || isOverrunReceipt(v.overrun))
    && (v.chest === undefined || v.chest === true);
}

export function isRoomHomeView(v: unknown): v is RoomHomeView {
  return isFields(v)
    && isNumber(v.roomHighest)
    && (v.pickedLevel === null || isNumber(v.pickedLevel))
    && (v.overrun === undefined || isOverrunView(v.overrun));
}
