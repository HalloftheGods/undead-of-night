// Accepting, abandoning and turning in quests, as pure steps over a save in the style of shop.ts:
// each returns a new save, or null when the step is refused. The save in is never touched.

import type { DifficultyId } from '../../../shared/difficulty.ts';
import type { MerchantId, StationId } from '../../../shared/home-protocol.ts';
import { itemOf } from './merchant-data.ts';
import { jobTimes, questOf, questsOf, targetOf } from './quest-data.ts';
import type { QuestDef, QuestReward } from './quest-data.ts';
import { isReady } from './quest-progress.ts';
import type { HomeSave } from './home-store.ts';
import { stow } from './shop.ts';

/** What a quest step depends on beyond the save. */
export interface QuestContext {
  /** The step is refused unless this is the quest's giver. */
  station: StationId | null;
  /** The player's own highest level, which gates and job silver read. */
  highest: number;
  difficulty: DifficultyId;
  /** The time to write on an accepted quest. */
  now: number;
}

/** One line on a merchant's work list. */
export interface QuestRow {
  id: string;
  /** `busy`: another quest of theirs is still open, so this waits. */
  state: 'ready' | 'active' | 'offered' | 'busy';
  progress: number;
  target: number;
}

const rowOf = (def: QuestDef, state: QuestRow['state'], progress = 0): QuestRow => ({ id: def.id, state, progress, target: targetOf(def.objective) });

function unlocked(save: HomeSave, def: QuestDef, highest: number): boolean {
  const isDoneForGood = def.repeat === 'once' && save.quests.done.includes(def.id);
  if (isDoneForGood) return false;
  const isGated = highest < (def.gate ?? 0);
  if (isGated) return false;
  if (!(def.after ?? []).every((id) => save.quests.done.includes(id))) return false;
  const gun = def.owns;
  return gun === undefined || gun in save.locker.guns || gun in save.hands.guns;
}

/** The next one-time quest this merchant has on offer, in table order. */
function nextOnce(save: HomeSave, merchant: MerchantId, highest: number): QuestDef | undefined {
  const accepted = save.quests.active[merchant]?.id;
  return questsOf(merchant).find((def) => def.repeat === 'once' && def.id !== accepted && unlocked(save, def, highest));
}

/** What the merchant's work list shows: the open quest, then the next one-time quest and the job on offer. */
export function questRows(save: HomeSave, merchant: MerchantId, highest: number): QuestRow[] {
  const open = save.quests.active[merchant];
  const openDef = open && questOf(open.id);
  const rows: QuestRow[] = [];
  const waiting = openDef ? 'busy' : 'offered';
  const hasOpenQuest = open && openDef;
  if (hasOpenQuest) rows.push(rowOf(openDef, isReady(openDef, open.progress) ? 'ready' : 'active', open.progress));
  const next = nextOnce(save, merchant, highest);
  if (next) rows.push(rowOf(next, waiting));
  const jobId = save.quests.jobs[merchant];
  const job = jobId ? questOf(jobId) : undefined;
  const hasOtherJob = job && job.id !== open?.id;
  if (hasOtherJob) rows.push(rowOf(job, waiting));
  return rows;
}

function isOnOffer(save: HomeSave, merchant: MerchantId, id: string, highest: number): boolean {
  const def = questOf(id);
  const isNotTheirs = !def || def.giver !== merchant;
  if (isNotTheirs) return false;
  const isJob = def.repeat === 'job';
  if (isJob) return save.quests.jobs[merchant] === id;
  return unlocked(save, def, highest);
}

const atCounter = (save: HomeSave, merchant: MerchantId, context: QuestContext): boolean => context.station === merchant && !save.openTrip;

/** Takes the quest on, one at a time per merchant. */
export function accept(save: HomeSave, merchant: MerchantId, id: string, context: QuestContext): HomeSave | null {
  const cannotAccept = !atCounter(save, merchant, context) || save.quests.active[merchant];
  if (cannotAccept) return null;
  if (!isOnOffer(save, merchant, id, context.highest)) return null;
  const { quests } = save;
  const jobs = questOf(id)?.repeat === 'job' ? { ...quests.jobs, [merchant]: null } : quests.jobs;
  const active = { ...quests.active, [merchant]: { id, progress: 0, acceptedAt: context.now } };
  return { ...save, quests: { ...quests, active, jobs } };
}

/** A finished quest is never given up: it waits to be turned in, so its progress cannot be thrown away by a stray press. */
const mayAbandon = (def: QuestDef | undefined, progress: number): boolean => def !== undefined && !isReady(def, progress);

/** Gives an unfinished quest up. Its progress is lost, a one-time quest goes back on offer, and a job goes back on the counter as the same job. */
export function abandon(save: HomeSave, merchant: MerchantId, context: QuestContext): HomeSave | null {
  const open = save.quests.active[merchant];
  const def = open && questOf(open.id);
  const cannotAbandon = !atCounter(save, merchant, context) || !open || !mayAbandon(def, open.progress);
  if (cannotAbandon) return null;
  const active = { ...save.quests.active };
  delete active[merchant];
  const isJob = def?.repeat === 'job';
  const jobs = isJob ? { ...save.quests.jobs, [merchant]: open.id } : save.quests.jobs;
  return { ...save, quests: { ...save.quests, active, jobs } };
}

/** What a reward comes to in silver: a silver reward, or a job's silver by the player's level. */
export function silverOf(def: QuestDef, highest: number): number {
  const base = def.reward.reduce((sum, reward) => sum + (reward.kind === 'silver' ? reward.amount : 0), 0);
  return base + Math.round((def.jobSilver ?? 0) * jobTimes(highest));
}

/** One item into the locker, or its shop price in silver when it will not fit. */
function payItem(save: HomeSave, reward: Extract<QuestReward, { kind: 'item' }>, difficulty: DifficultyId): HomeSave {
  const def = itemOf(reward.merchant, reward.item);
  if (!def) return save;
  let next = save;
  for (let unit = 0; unit < reward.count; unit++) {
    const stowed = stow(next, def, difficulty);
    next = stowed ?? { ...next, silver: next.silver + def.price };
  }
  return next;
}

/** How many of a quest's reward units will not fit and are paid in silver instead, for the chip on the screen. */
export function paidAsSilver(save: HomeSave, def: QuestDef, difficulty: DifficultyId): number {
  const paid = def.reward.reduce<HomeSave>((so, reward) => (reward.kind === 'item' ? payItem(so, reward, difficulty) : so), save);
  return paid.silver - save.silver;
}

/** Pays the quest and clears it. Refused unless it is ready, at its giver's counter, with no trip open. */
export function turnIn(save: HomeSave, merchant: MerchantId, context: QuestContext): HomeSave | null {
  const isAwayFromCounter = !atCounter(save, merchant, context);
  if (isAwayFromCounter) return null;
  const open = save.quests.active[merchant];
  const def = open && questOf(open.id);
  const cannotTurnIn = !open || !def || !isReady(def, open.progress);
  if (cannotTurnIn) return null;
  const items = def.reward.reduce<HomeSave>((so, reward) => (reward.kind === 'item' ? payItem(so, reward, context.difficulty) : so), save);
  const active = { ...save.quests.active };
  delete active[merchant];
  const done = def.repeat === 'once' ? [...save.quests.done, def.id] : save.quests.done;
  return { ...items, silver: items.silver + silverOf(def, context.highest), quests: { ...save.quests, active, done } };
}
