// A save read back from storage is untrusted: each field is checked, and a bad one falls back alone.

import { isDifficultyId } from '../../../shared/difficulty.ts';
import type { InventoryGrid } from '../../../shared/grid-inventory.ts';
import type { MerchantId } from '../../../shared/home-protocol.ts';
import { MERCHANT_IDS } from '../../../shared/home-protocol.ts';
import { isJewels, isLoadout } from '../../network/home-guards.ts';
import type { CampSave, HomeSave, OpenOverrun, OpenTrip, OverrunRecord, TripRecord } from './home-store.ts';
import { reviveQuests } from './quest-revive.ts';
import type { ShopState } from './shop.ts';

type Fields = Record<string, unknown>;

const isFields = (v: unknown): v is Fields => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const wholeCount = (v: unknown): number => (isNumber(v) && v > 0 ? Math.floor(v) : 0);

function isOpenTrip(v: unknown): v is OpenTrip {
  return isFields(v)
    && isNumber(v.level)
    && isNumber(v.startedAt)
    && (v.mode === 'solo' || v.mode === 'coop')
    && isDifficultyId(v.difficulty);
}

function isTripRecord(v: unknown): v is TripRecord {
  return isFields(v)
    && isNumber(v.level)
    && isNumber(v.silver)
    && isNumber(v.at)
    && (v.outcome === 'banked' || v.outcome === 'died')
    && isDifficultyId(v.difficulty)
    && isJewels(v.jewels)
    && typeof v.replay === 'boolean';
}

function isOpenOverrun(v: unknown): v is OpenOverrun {
  return isFields(v)
    && typeof v.simId === 'string'
    && isNumber(v.startedAt)
    && (v.mode === 'solo' || v.mode === 'coop')
    && (v.highest === undefined || isNumber(v.highest))
    && (v.difficulty === undefined || isDifficultyId(v.difficulty));
}

const MERCHANTS: readonly unknown[] = MERCHANT_IDS;
const isMerchant = (v: unknown): boolean => MERCHANTS.includes(v);

function isOverrunRecord(v: unknown): v is OverrunRecord {
  return isFields(v)
    && (v.outcome === 'held' || v.outcome === 'fled' || v.outcome === 'died')
    && ['share', 'highest', 'kills', 'silver', 'at'].every((key) => isNumber((v as Fields)[key]))
    && isDifficultyId(v.difficulty)
    && Array.isArray(v.merchantsLost)
    && v.merchantsLost.every(isMerchant);
}

/** A count the overrun left on a stall: absent on an old save, which is 0. */
const isTripCount = (v: unknown): boolean => v === undefined || isNumber(v);

const isStock = (v: unknown): boolean =>
  isFields(v) && isFields(v.items) && Object.values(v.items).every(isNumber) && isTripCount(v.closedTrips) && isTripCount(v.thinTrips);

function isShopState(v: unknown): v is ShopState {
  return isFields(v)
    && isNumber(v.seed)
    && isNumber(v.rolls)
    && isFields(v.merchants)
    && MERCHANT_IDS.every((id) => isStock((v.merchants as Fields)[id]));
}

const listOf = <T>(value: unknown, keep: (item: unknown) => item is T): T[] => (Array.isArray(value) ? value.filter(keep) : []);
const isString = (v: unknown): v is string => typeof v === 'string';

const isGridItem = (v: unknown): boolean =>
  isFields(v) && isString(v.id) && isString(v.type) && isNumber(v.x) && isNumber(v.y) && typeof v.rotated === 'boolean';

/** The locker's storage grid, or nothing: a grid that does not read is left off rather than guessed at. */
const isLockerGrid = (v: unknown): v is InventoryGrid =>
  isFields(v) && isNumber(v.cols) && isNumber(v.rows) && Array.isArray(v.items) && v.items.every(isGridItem);

const merchantList = (value: unknown): MerchantId[] => listOf(value, (v): v is MerchantId => isMerchant(v));

/** Absent on an old save, which has found nothing yet; each field falls back alone. */
function reviveCamp(value: unknown): CampSave | undefined {
  if (!isFields(value)) return undefined;
  return {
    rescued: merchantList(value.rescued),
    radio: value.radio === true,
    tracks: listOf(value.tracks, isString),
    rosterUnlocked: merchantList(value.rosterUnlocked),
    character: isNumber(value.character) && value.character >= 0 ? Math.floor(value.character) : null,
  };
}

/** Null when this is no save at all. `blank` fills any field that does not read, so one bad field costs only itself. */
export function reviveSave(value: unknown, blank: HomeSave): HomeSave | null {
  if (!isFields(value)) return null;
  return {
    version: wholeCount(value.version),
    candy: isNumber(value.candy) ? wholeCount(value.candy) : wholeCount(value.silver),
    silver: wholeCount(value.silver),
    rawJewels: isJewels(value.rawJewels) ? value.rawJewels : blank.rawJewels,
    locker: isLoadout(value.locker) ? value.locker : blank.locker,
    hands: isLoadout(value.hands) ? value.hands : blank.hands,
    openTrip: isOpenTrip(value.openTrip) ? value.openTrip : null,
    appliedReceipts: listOf(value.appliedReceipts, isString),
    ledger: listOf(value.ledger, isTripRecord),
    shop: isShopState(value.shop) ? value.shop : blank.shop,
    quests: reviveQuests(value.quests, blank.quests),
    overruns: listOf(value.overruns, isOverrunRecord),
    openOverrun: isOpenOverrun(value.openOverrun) ? value.openOverrun : null,
    ...(isLockerGrid(value.lockerGrid) ? { lockerGrid: value.lockerGrid } : {}),
    ...(reviveCamp(value.camp) ? { camp: reviveCamp(value.camp) } : {}),
  };
}
