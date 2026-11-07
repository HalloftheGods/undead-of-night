// What a merchant's work list and the HUD tracker show, from the home state alone (the way merchant-view.ts does).

import { STAT_SLOTS } from '../../../shared/character-stats.ts';
import { MERCHANT_IDS } from '../../../shared/home-protocol.ts';
import type { MerchantId } from '../../../shared/home-protocol.ts';
import { shopContext } from '../home-hud.ts';
import type { HomeUi } from '../home-hud.ts';
import type { HomeSave } from './home-store.ts';
import { itemOf } from './merchant-data.ts';
import { questOf, targetOf } from './quest-data.ts';
import type { QuestDef, QuestReward, TallyCounter } from './quest-data.ts';
import { isReady } from './quest-progress.ts';
import { abandon, accept, paidAsSilver, questRows, silverOf, turnIn } from './quests.ts';
import type { QuestContext, QuestRow } from './quests.ts';

/** One bar on a quest: lit cells out of `slots`, and the number it comes to. */
export interface ObjectiveBar {
  /** Names the second bar of an `atMost` limit; null for the objective itself. */
  label: string | null;
  filled: number;
  slots: number;
  /** "11 / 25". */
  value: string;
  /** The limit on this bar has been passed. */
  failed: boolean;
}

export interface RewardChip {
  kind: 'silver' | 'item';
  label: string;
  /** "Paid as 60 silver" when the item will not fit, before turn-in; null otherwise. */
  note: string | null;
}

/** What the player can do with a quest from this card. */
export type QuestAction = 'accept' | 'turn_in' | 'none';

export interface QuestPanel {
  id: string;
  title: string;
  brief: string;
  state: QuestRow['state'];
  bars: ObjectiveBar[];
  rewards: RewardChip[];
  action: QuestAction;
  /** The action would go through right now. */
  canAct: boolean;
  /** Why it would not, for the line under the button; null when it would. */
  refusal: string | null;
  canAbandon: boolean;
  /** Part of this quest's progress is only the live trip's and goes if the player dies. */
  lostIfDie: boolean;
}

export interface TrackerLine {
  merchant: MerchantId;
  id: string;
  title: string;
  bar: ObjectiveBar;
  /** Finished and waiting at the counter. */
  ready: boolean;
  /** Part of this line's count is only the live trip's and goes if the player dies. */
  atRisk: boolean;
}

export interface QuestTracker {
  lines: TrackerLine[];
  /** One shared "Lost if you die" under the lines when any line is at risk, or null. */
  warning: string | null;
  /** The phone's one line: "Work: 1 of 3 ready" out of the quests open, or "No work" when none is. */
  summary: string;
}

const COUNTER_LABELS: Record<TallyCounter, string> = {
  kills: 'Kills', headshots: 'Headshots', shoves: 'Shoves', finds: 'Finds', noisy: 'Noisy searches', bottles: 'Bottles',
  medkits: 'Medkits used', damage: 'Damage taken', suppressed: 'Suppressed shots', burning: 'Burning kills', bandages: 'Bandages',
};

const ACTIONS: Record<QuestRow['state'], QuestAction> = { ready: 'turn_in', offered: 'accept', active: 'none', busy: 'none' };

/** Cells lit for a value: one per unit up to STAT_SLOTS, proportional above, and full only when the bar is. */
export function barCells(value: number, target: number): number {
  const held = Math.max(0, Math.min(value, target));
  const fitsSlots = target <= STAT_SLOTS;
  if (fitsSlots) return held;
  const isFull = held >= target;
  if (isFull) return STAT_SLOTS;
  return Math.max(held > 0 ? 1 : 0, Math.min(STAT_SLOTS - 1, Math.round((held / target) * STAT_SLOTS)));
}

const barOf = (label: string | null, value: number, target: number, failed = false): ObjectiveBar => ({
  label, filled: barCells(value, target), slots: STAT_SLOTS, value: `${Math.min(value, target)} / ${target}`, failed,
});

/** Progress with this trip's live count merged in, while out on a trip. Never lower than what is banked. */
export function liveProgress(def: QuestDef, saved: number, home: HomeUi): number {
  if (home.inBunker) return saved;
  const { objective, filter } = def;
  const target = targetOf(objective);
  const isJewelHaul = objective.kind === 'bring_home' && objective.what === 'jewel';
  if (isJewelHaul) {
    const { small, large } = home.carried.jewels;
    return Math.max(saved, Math.min(target, small + large));
  }
  const isNotTally = objective.kind !== 'tally';
  if (isNotTally) return saved;
  const { tally } = home.quests;
  const isBelowLevel = filter?.minLevel !== undefined && (home.pickedLevel ?? 0) < filter.minLevel;
  if (isBelowLevel) return saved;
  const isWrongSurvivor = filter?.survivor !== undefined && tally.survivor !== filter.survivor;
  if (isWrongSurvivor) return saved;
  const isPartyTooSmall = filter?.minParty !== undefined && tally.party < filter.minParty;
  if (isPartyTooSmall) return saved;
  const value = objective.counter === 'kills' && filter?.zombie ? tally.killsBy[filter.zombie] : tally.counts[objective.counter];
  const limit = objective.atMost;
  const isOverLimit = limit && tally.counts[limit.counter] > limit.count;
  if (isOverLimit) return saved;
  return objective.scope === 'total' ? Math.min(target, saved + value) : Math.max(saved, Math.min(target, value));
}

function barsOf(def: QuestDef, progress: number, home: HomeUi): ObjectiveBar[] {
  const bars = [barOf(null, progress, targetOf(def.objective))];
  const limit = def.objective.kind === 'tally' ? def.objective.atMost : undefined;
  if (limit) {
    const used = home.inBunker ? 0 : home.quests.tally.counts[limit.counter];
    bars.push({ ...barOf(COUNTER_LABELS[limit.counter], used, Math.max(limit.count, 1), used > limit.count), value: `${used} of ${limit.count} allowed` });
  }
  return bars;
}

function chipOf(home: HomeUi, def: QuestDef, reward: Extract<QuestReward, { kind: 'item' }>): RewardChip {
  const item = itemOf(reward.merchant, reward.item);
  const label = `${item?.label ?? 'Unknown'}${reward.count > 1 ? ` x${reward.count}` : ''}`;
  const lone: QuestDef = { ...def, reward: [reward], jobSilver: undefined };
  const silver = home.save ? paidAsSilver(home.save, lone, home.difficulty) : 0;
  return { kind: 'item', label, note: silver > 0 ? `Paid as ${silver} silver` : null };
}

function rewardsOf(home: HomeUi, def: QuestDef): RewardChip[] {
  const silver = silverOf(def, home.highest);
  const chips: RewardChip[] = silver > 0 ? [{ kind: 'silver', label: `${silver} silver`, note: null }] : [];
  for (const reward of def.reward) {
    const isItemReward = reward.kind === 'item';
    if (isItemReward) chips.push(chipOf(home, def, reward));
  }
  return chips;
}

const contextOf = (home: HomeUi): QuestContext => ({ ...shopContext(home), now: 0 });

/** Says why a step at the counter was turned down, in the words the shop uses. */
function refusalOf(home: HomeUi, merchant: MerchantId): string | null {
  if (home.save?.openTrip) return 'Not while out on a trip';
  const isAwayFromCounter = home.station !== merchant;
  if (isAwayFromCounter) return 'Step up to the counter';
  return null;
}

/** The save the row's action would give, or null when it is refused or there is none. */
function attempt(save: HomeSave, merchant: MerchantId, row: QuestRow, context: QuestContext): HomeSave | null {
  const isOffered = row.state === 'offered';
  if (isOffered) return accept(save, merchant, row.id, context);
  const isReadyRow = row.state === 'ready';
  if (isReadyRow) return turnIn(save, merchant, context);
  return null;
}

function panelOf(home: HomeUi, merchant: MerchantId, row: QuestRow): QuestPanel | null {
  const { save } = home;
  const def = questOf(row.id);
  const hasNoQuest = !save || !def;
  if (hasNoQuest) return null;
  const context = contextOf(home);
  const open = row.state === 'ready' || row.state === 'active';
  const progress = open ? liveProgress(def, row.progress, home) : 0;
  const action = ACTIONS[row.state];
  const canAct = attempt(save, merchant, row, context) !== null;
  const waiting = row.state === 'busy' ? 'Finish my last job first' : null;
  const refusal = action === 'none' || canAct ? waiting : refusalOf(home, merchant);
  return {
    id: def.id, title: def.title, brief: def.brief, state: row.state, bars: barsOf(def, progress, home), rewards: rewardsOf(home, def),
    action, canAct, refusal, canAbandon: open && abandon(save, merchant, context) !== null, lostIfDie: open && progress > row.progress,
  };
}

/** The merchant's work list: the open quest first, then what they offer next. Empty until the save loads. */
export function questPanels(home: HomeUi, merchant: MerchantId): QuestPanel[] {
  const { save } = home;
  if (!save) return [];
  return questRows(save, merchant, home.highest).flatMap((row) => panelOf(home, merchant, row) ?? []);
}

/** One line per open quest for the HUD, with live trip tallies in town. */
export function questTracker(home: HomeUi): QuestTracker {
  const lines: TrackerLine[] = [];
  const active = home.save?.quests.active;
  for (const merchant of MERCHANT_IDS) {
    const open = active?.[merchant];
    const def = open && questOf(open.id);
    const hasNoQuest = !open || !def;
    if (hasNoQuest) continue;
    const progress = liveProgress(def, open.progress, home);
    lines.push({
      merchant, id: def.id, title: def.title, bar: barOf(null, progress, targetOf(def.objective)), ready: isReady(def, open.progress),
      atRisk: progress > open.progress,
    });
  }
  const ready = lines.filter((line) => line.ready).length;
  const warning = lines.some((line) => line.atRisk) ? 'Lost if you die' : null;
  return { lines, warning, summary: lines.length > 0 ? `Work: ${ready} of ${lines.length} ready` : 'No work' };
}
