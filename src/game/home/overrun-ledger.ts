// How an overrun's end reaches the save: a receipt from the sim, or a breach that was never seen through.
// Pure steps over a save. Each receipt is applied once: its key goes in the same save as its credit.

import { BASELINE_DIFFICULTY } from '../../../shared/difficulty.ts';
import type { DifficultyId } from '../../../shared/difficulty.ts';
import type { MerchantId, OverrunPhase, OverrunReceipt } from '../../../shared/home-protocol.ts';
import { emptyLoadout, mergeHome } from '../../../shared/loadout.ts';
import type { HomeSave, OpenOverrun, OverrunRecord } from './home-store.ts';
import { fleeCasualties } from './overrun-merchants.ts';

/** What the receipt does not say: how far the room had got and how hard it was, which sized the horde. */
export interface OverrunContext {
  readonly highest: number;
  readonly difficulty: DifficultyId;
}

const NO_MERCHANTS: readonly MerchantId[] = [];

/** `${simId}:${serial}`, the same shape as a trip receipt's key and never equal to one, since both draw serials from the room's one counter. */
export const overrunKey = (receipt: OverrunReceipt): string => `${receipt.simId}:${receipt.serial}`;

function recordOf(receipt: OverrunReceipt, context: OverrunContext, merchantsLost: readonly MerchantId[], at: number): OverrunRecord {
  const { outcome, share, kills, silver } = receipt;
  return { outcome, share, highest: context.highest, difficulty: context.difficulty, kills, merchantsLost, silver, at };
}

/** The chest into the locker (the carry caps hold), silver and jewels to the bank. */
function opened(save: HomeSave, receipt: OverrunReceipt): HomeSave {
  const { chest, silver, jewels } = receipt;
  return {
    ...save,
    silver: save.silver + silver,
    rawJewels: { small: save.rawJewels.small + jewels.small, large: save.rawJewels.large + jewels.large },
    locker: chest ? mergeHome(save.locker, chest) : save.locker,
  };
}

/** The gear in hand went down with the body, and the trip it was for with it. The locker, the bank and the stock are untouched. */
const lostInHand = (save: HomeSave): HomeSave => ({ ...save, hands: emptyLoadout(), openTrip: null });

/**
 * Applies an overrun's result, once. Held credits the chest, fled costs merchants (picked by a stream of this receipt's own, so reloading
 * or a retry cannot reroll them), died empties the hands. Every outcome closes the open overrun and adds a record. A held receipt that
 * carries the death before it applies that first, under its own key, so a chest opened before the death landed loses neither.
 */
export function applyOverrunReceipt(save: HomeSave, receipt: OverrunReceipt, context: OverrunContext, at: number = Date.now()): HomeSave {
  const key = overrunKey(receipt);
  if (save.appliedReceipts.includes(key)) return save;
  const before = receipt.died ? applyOverrunReceipt(save, receipt.died, context, at) : save;
  let next = before;
  let merchantsLost = NO_MERCHANTS;
  switch (receipt.outcome) {
    case 'held':
      next = opened(before, receipt);
      break;
    case 'fled': {
      const flight = fleeCasualties(before, receipt.share, key);
      next = flight.save;
      merchantsLost = flight.killed;
      break;
    }
    case 'died':
      next = lostInHand(before);
      break;
  }
  return {
    ...next,
    openOverrun: null,
    overruns: [...next.overruns, recordOf(receipt, context, merchantsLost, at)],
    appliedReceipts: [...next.appliedReceipts, key],
  };
}

/** The breach is seen: from here until a receipt or a trip start, quitting counts as dying in it. Already open is left as it is. */
export function openOverrunOf(save: HomeSave, open: OpenOverrun): HomeSave {
  return save.openOverrun ? save : { ...save, openOverrun: open };
}

/** The trip starts, so the breach is behind this player. The receipt of a flight, if any, is applied on its own. */
export const clearOpenOverrun = (save: HomeSave): HomeSave => (save.openOverrun ? { ...save, openOverrun: null } : save);

export type BreachWatch = 'open' | 'survived' | 'died' | 'none';

/**
 * What a bunker snapshot means for the breach on file. `phase` is the room's, or undefined with no overrun; `hasReceipt` is whether this player
 * holds an overrun receipt, which settles things on its own. A first sight of `breached` opens it; `held` is survived (quitting is safe again);
 * anything else with one still on file means the breach ended without this player, so it counts as a death.
 */
export function watchBreach(save: HomeSave, phase: OverrunPhase | undefined, hasReceipt: boolean): BreachWatch {
  if (hasReceipt) return 'none';
  const onFile = save.openOverrun !== null;
  const isBreached = phase === 'breached';
  if (isBreached) return onFile ? 'none' : 'open';
  if (!onFile) return 'none';
  return phase === 'held' ? 'survived' : 'died';
}

/** A breach found over without a receipt for this player: the gear in hand is gone, as if they had quit in it. */
export const diedUnseen = (save: HomeSave, at: number = Date.now()): HomeSave => (save.openOverrun ? diedOpen(save, save.openOverrun, at) : save);

function diedOpen(save: HomeSave, open: OpenOverrun, at: number): HomeSave {
  const { highest = 0, difficulty = BASELINE_DIFFICULTY } = open;
  const record: OverrunRecord = { outcome: 'died', share: 0, highest, difficulty, kills: 0, merchantsLost: NO_MERCHANTS, silver: 0, at };
  return { ...lostInHand(save), openOverrun: null, overruns: [...save.overruns, record] };
}

/**
 * Settles a breach found open on load, as a trip found open is: solo has no body to go back to, so it is a death of what was in hand.
 * In co-op `resumed` is the server's answer: true keeps it, false is a death, null is not yet known.
 */
export function resolveOpenOverrun(save: HomeSave, resumed: boolean | null, at: number = Date.now()): HomeSave {
  const open = save.openOverrun;
  if (!open) return save;
  const mayStillBeIn = open.mode === 'coop' && resumed !== false;
  return mayStillBeIn ? save : diedOpen(save, open, at);
}
