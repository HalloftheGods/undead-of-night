// How a trip's end reaches the save: a receipt from the sim, or a trip that never came home.

import type { Jewels, TripReceipt } from '../../../shared/home-protocol.ts';
import { emptyLoadout, mergeHome } from '../../../shared/loadout.ts';
import { mergeGridLocker } from './bunker-locker-grid.ts';
import { lockedTracksOf } from '../../audio/playlists.ts';
import { emptyCamp } from './home-store.ts';
import type { HomeSave, OpenTrip, TripRecord } from './home-store.ts';
import { rollStock } from './shop.ts';

const NO_JEWELS: Jewels = { small: 0, large: 0 };

export const receiptKey = (receipt: TripReceipt): string => `${receipt.simId}:${receipt.serial}`;

function recordOf({ level, outcome, difficulty, silver, jewels, replay, candy }: TripReceipt): TripRecord {
  return { level, outcome, difficulty, silver, jewels, candy, replay, at: Date.now() };
}

/** Gear taken out went with the trip. What survived it comes back on a receipt, into the locker. */
function closed(save: HomeSave, record: TripRecord): HomeSave {
  return { ...save, hands: emptyLoadout(), openTrip: null, ledger: [...save.ledger, record] };
}

function banked(save: HomeSave, receipt: TripReceipt): HomeSave {
  const { silver, jewels, gear, candy } = receipt;
  const candyCredits = candy ?? silver ?? 0;
  const currentCandy = Math.max(save.candy ?? 0, save.silver ?? 0);
  const nextCandy = currentCandy + candyCredits;
  const rawJewels = save.rawJewels ?? { small: 0, large: 0 };
  const nextJewels = jewels ? { small: rawJewels.small + jewels.small, large: rawJewels.large + jewels.large } : rawJewels;
  return rollStock({
    ...save,
    candy: nextCandy,
    silver: save.silver + silver,
    rawJewels: nextJewels,
    locker: gear ? mergeHome(save.locker, gear) : save.locker,
    lockerGrid: gear && save.lockerGrid ? mergeGridLocker(save.lockerGrid, gear) : save.lockerGrid,
  });
}

/** Each radio found sets the flag and gives up the next locked track of the level it was found on, in the existing order. */
function withRadios(save: HomeSave, levels: readonly number[]): HomeSave {
  if (levels.length === 0) return save;
  const camp = { ...(save.camp ?? emptyCamp()), radio: true };
  const tracks = [...camp.tracks];
  for (const level of levels) {
    const [next] = lockedTracksOf(level, new Set(tracks), 'campaign');
    if (next) tracks.push(next);
  }
  return { ...save, camp: { ...camp, tracks } };
}

/**
 * Applies a trip's result, once. The key goes in the same save as the credit, so a refresh either finds
 * both or neither. A died receipt's amounts are what was lost: the ledger keeps them and nothing is credited.
 */
export function applyReceipt(save: HomeSave, receipt: TripReceipt): HomeSave {
  const key = receiptKey(receipt);
  const alreadyApplied = save.appliedReceipts.includes(key);
  if (alreadyApplied) return save;
  const credited = receipt.outcome === 'banked' ? banked(save, receipt) : save;
  const found = withRadios(credited, receipt.radioLevels ?? []);
  return { ...closed(found, recordOf(receipt)), appliedReceipts: [...save.appliedReceipts, key] };
}

function neverCameHome(trip: OpenTrip): TripRecord {
  return { level: trip.level, outcome: 'died', difficulty: trip.difficulty, silver: 0, jewels: NO_JEWELS, replay: false, at: Date.now() };
}

/**
 * Settles a trip found open on load. Solo has no body to go back to, so it is a death.
 * In co-op `resumed` is the server's answer: true keeps the trip, false is a death, null is not yet known.
 */
export function resolveOpenTrip(save: HomeSave, resumed: boolean | null): HomeSave {
  const trip = save.openTrip;
  if (!trip) return save;
  const mayStillBeOut = trip.mode === 'coop' && resumed !== false;
  return mayStillBeOut ? save : closed(save, neverCameHome(trip));
}
