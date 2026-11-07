// How a quest's progress moves. The save is never changed in place: each step returns a new quest state.

import type { StationId, TripReceipt } from '../../../shared/home-protocol.ts';
import { MERCHANT_IDS } from '../../../shared/home-protocol.ts';
import type { MerchantId } from '../../../shared/home-protocol.ts';
import { questOf, targetOf } from './quest-data.ts';
import type { Objective, QuestDef, QuestFilter } from './quest-data.ts';
import type { QuestState } from './quest-state.ts';
import { emptyTally } from './quest-tally.ts';
import type { TripTally } from './quest-tally.ts';

/** Does this trip count for the quest at all: the right level, the right survivor, a big enough party. */
function passes(filter: QuestFilter | undefined, receipt: Pick<TripReceipt, 'level'>, tally: TripTally): boolean {
  if (!filter) return true;
  const isBelowLevel = filter.minLevel !== undefined && receipt.level < filter.minLevel;
  if (isBelowLevel) return false;
  const isWrongSurvivor = filter.survivor !== undefined && tally.survivor !== filter.survivor;
  if (isWrongSurvivor) return false;
  const isPartyTooSmall = filter.minParty !== undefined && tally.party < filter.minParty;
  if (isPartyTooSmall) return false;
  return true;
}

function broughtHome(objective: Extract<Objective, { kind: 'bring_home' }>, receipt: TripReceipt): number {
  const gear = receipt.gear;
  const { what } = objective;
  const isJewel = what === 'jewel';
  if (isJewel) return receipt.jewels.small + receipt.jewels.large;
  if (!gear) return 0;
  const isMedkit = what === 'medkit';
  if (isMedkit) return gear.medkits;
  const isGun = what === 'gun';
  if (isGun) return Object.keys(gear.guns).length;
  return gear.guns[what] ? 1 : 0;
}

/** What one banked trip adds to a counter, honouring a zombie filter on kills. */
function counted(objective: Extract<Objective, { kind: 'tally' }>, filter: QuestFilter | undefined, tally: TripTally): number {
  const zombie = filter?.zombie;
  const isZombieKills = objective.counter === 'kills' && zombie !== undefined;
  if (isZombieKills) return tally.killsBy[zombie];
  return tally.counts[objective.counter];
}

/** Progress after one banked trip, or the same number if the trip does not move this quest. */
function afterBanked(def: QuestDef, progress: number, receipt: TripReceipt, tally: TripTally): number {
  const { objective } = def;
  const isFilteredOut = !passes(def.filter, receipt, tally);
  if (isFilteredOut) return progress;
  const target = targetOf(objective);
  const isPerTrip = objective.kind === 'bank' || objective.kind === 'streak';
  if (isPerTrip) return Math.min(target, progress + 1);
  const isReceiptTotal = objective.kind === 'receipt_total';
  if (isReceiptTotal) return Math.min(target, progress + receipt[objective.field]);
  const isFast = objective.kind === 'fast';
  if (isFast) return receipt.seconds <= objective.seconds ? 1 : progress;
  const isBringHome = objective.kind === 'bring_home';
  if (isBringHome) return Math.max(progress, Math.min(target, broughtHome(objective, receipt)));
  const isTally = objective.kind === 'tally';
  if (isTally) {
    const value = counted(objective, def.filter, tally);
    const isTotalScope = objective.scope === 'total';
    if (isTotalScope) return Math.min(target, progress + value);
    const spoiled = objective.atMost !== undefined && tally.counts[objective.atMost.counter] > objective.atMost.count;
    return spoiled ? progress : Math.max(progress, Math.min(target, value));
  }
  return progress;
}

function mapActive(quests: QuestState, step: (def: QuestDef, progress: number, merchant: MerchantId) => number): QuestState {
  let changed = false;
  const active: QuestState['active'] = { ...quests.active };
  for (const merchant of MERCHANT_IDS) {
    const slot = quests.active[merchant];
    const def = slot && questOf(slot.id);
    const isEmptySlot = !slot || !def;
    if (isEmptySlot) continue;
    const next = step(def, slot.progress, merchant);
    const isUnchanged = next === slot.progress;
    if (isUnchanged) continue;
    active[merchant] = { ...slot, progress: next };
    changed = true;
  }
  return changed ? { ...quests, active } : quests;
}

/**
 * A death moves nothing except resetting streaks that were still running. A finished streak keeps its pay (quests never fail),
 * and a trip the quest's filter would not have counted cannot break it. A trip that never came home has no tally, so a filter on
 * who wore it or how many were with them cannot be shown to fail and the streak is left alone; the level is always known.
 */
export function applyDeathToQuests(quests: QuestState, trip: Pick<TripReceipt, 'level'>, tally: TripTally = emptyTally()): QuestState {
  const breaks = (def: QuestDef, progress: number): boolean => def.objective.kind === 'streak' && !isReady(def, progress) && passes(def.filter, trip, tally);
  return mapActive(quests, (def, progress) => (breaks(def, progress) ? 0 : progress));
}

/**
 * The only path that moves trip progress. A banked trip counts what it brought and did; a death moves nothing
 * except resetting streaks. Returns the same object when nothing moved.
 */
export function applyTripToQuests(quests: QuestState, receipt: TripReceipt, tally: TripTally): QuestState {
  const hasDied = receipt.outcome === 'died';
  if (hasDied) return applyDeathToQuests(quests, receipt, tally);
  return mapActive(quests, (def, progress) => afterBanked(def, progress, receipt, tally));
}

/** Jewels melted at the forge, counted toward any active smelt quest. */
export function noteSmelted(quests: QuestState, jewels: number): QuestState {
  const hasNoJewels = jewels <= 0;
  if (hasNoJewels) return quests;
  return mapActive(quests, (def, progress) => (def.objective.kind === 'smelt' ? Math.min(targetOf(def.objective), progress + jewels) : progress));
}

/** A station was opened, counted toward any active visit quest for it. */
export function noteVisit(quests: QuestState, station: StationId): QuestState {
  return mapActive(quests, (def, progress) => (def.objective.kind === 'visit' && def.objective.station === station ? 1 : progress));
}

export const isReady = (def: QuestDef, progress: number): boolean => progress >= targetOf(def.objective);
