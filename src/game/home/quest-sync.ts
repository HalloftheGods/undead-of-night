// The save steps HomeSync composes quests into: a banked trip, a smelt, a visit, and the counter actions.
// Each returns a new save, or the same object when nothing moved, so it rides in the write it belongs to.

import type { MerchantId, StationId, TripReceipt } from '../../../shared/home-protocol.ts';
import { smeltTick } from './forge.ts';
import type { HomeSave } from './home-store.ts';
import { applyDeathToQuests, applyTripToQuests, noteSmelted, noteVisit } from './quest-progress.ts';
import type { QuestState } from './quest-state.ts';
import { rollJobs } from './quest-state.ts';
import type { TripTally } from './quest-tally.ts';
import { accept, turnIn } from './quests.ts';
import type { QuestContext } from './quests.ts';
import { applyReceipt, resolveOpenTrip } from './trip-ledger.ts';

/** How a quest action ended, as a sale's does: saved, refused by the rules, lost to another tab, or not written. */
export type QuestResult = 'saved' | 'refused' | 'conflict' | 'failed';

const withQuests = (save: HomeSave, quests: QuestState): HomeSave => (quests === save.quests ? save : { ...save, quests });
const jewelsIn = (save: HomeSave): number => save.rawJewels.small + save.rawJewels.large;

/**
 * The trip's credit and its quest progress in one save, under the one `appliedReceipts` key. A banked trip also rolls new jobs
 * beside the new stock; a death never does, so boarding empty and quitting cannot re-roll the offers.
 */
export function applyReceiptWithQuests(save: HomeSave, receipt: TripReceipt, tally: TripTally, highest: number): HomeSave {
  const after = applyReceipt(save, receipt);
  const isUnchanged = after === save;
  if (isUnchanged) return save;
  const moved = applyTripToQuests(after.quests, receipt, tally);
  const banked = receipt.outcome === 'banked';
  return withQuests(after, banked ? rollJobs(moved, Math.max(highest, receipt.level)) : moved);
}

/**
 * A trip found open that did not come home is a death, so it breaks a running streak the way a died receipt does. Settling a trip
 * that is still out, or one already settled, changes nothing here.
 */
export function resolveOpenTripWithQuests(save: HomeSave, resumed: boolean | null): HomeSave {
  const trip = save.openTrip;
  const after = resolveOpenTrip(save, resumed);
  const diedOut = trip !== null && after.openTrip === null;
  return diedOut ? withQuests(after, applyDeathToQuests(after.quests, trip)) : after;
}

/** The forge's payout and the jewels it melted, counted toward any smelt quest in the same save. */
export function smeltWithQuests(save: HomeSave, seconds: number): HomeSave {
  const after = smeltTick(save, seconds);
  const isUnchanged = after === save;
  if (isUnchanged) return save;
  return withQuests(after, noteSmelted(after.quests, jewelsIn(save) - jewelsIn(after)));
}

/** A station was opened, which counts toward a visit quest for it. */
export const visited = (save: HomeSave, station: StationId): HomeSave => withQuests(save, noteVisit(save.quests, station));

/** A killed merchant's stall is shut until it recovers: no new work and no pay, and the open quest waits. */
const stallShut = (save: HomeSave, merchant: MerchantId): boolean => (save.shop.merchants[merchant].closedTrips ?? 0) > 0;

export function acceptAt(save: HomeSave, merchant: MerchantId, id: string, context: QuestContext): HomeSave | null {
  return stallShut(save, merchant) ? null : accept(save, merchant, id, context);
}

export function turnInAt(save: HomeSave, merchant: MerchantId, context: QuestContext): HomeSave | null {
  return stallShut(save, merchant) ? null : turnIn(save, merchant, context);
}
