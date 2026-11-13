// What a save remembers about quests, and the rolls that set one job on each stall.

import { MERCHANT_IDS } from '../../../shared/home-protocol.ts';
import type { MerchantId } from '../../../shared/home-protocol.ts';
import { createRng, pick } from '../../../shared/rng.ts';
import { QUESTS, startersOf } from './quest-data.ts';
import type { QuestDef } from './quest-data.ts';

export interface ActiveQuest {
  id: string;
  /** Counted only from acceptance, and never read back from the ledger. */
  progress: number;
  acceptedAt: number;
}

export interface QuestState {
  /** Its own random value, so job rolls never move the shop's stock rolls. */
  seed: number;
  /** Rolls so far, mixed with the seed. */
  rolls: number;
  /** At most one per merchant. */
  active: Partial<Record<MerchantId, ActiveQuest>>;
  /** One-time quests turned in. */
  done: readonly string[];
  /** The job each stall offers, or null when it has none out. */
  jobs: Record<MerchantId, string | null>;
}

const ROLL_STRIDE = 0x85ebca6b;
/** Mixed into the shop's seed, so the quest rolls have a stream of their own. */
export const QUEST_SALT = 0x51ed270b;

const noJobs = (): Record<MerchantId, string | null> => Object.fromEntries(MERCHANT_IDS.map((id) => [id, null])) as Record<MerchantId, string | null>;

/** Nothing accepted, nothing done and no jobs out. A save that cannot read its quests falls back to this. */
export const blankQuests = (seed: number): QuestState => ({ seed, rolls: 0, active: {}, done: [], jobs: noJobs() });

/** A new save: one starter accepted at each stall, and a job on offer at each. */
export function starterQuests(seed: number, now = 0): QuestState {
  const active: QuestState['active'] = {};
  for (const def of startersOf()) active[def.giver] = { id: def.id, progress: 0, acceptedAt: now };
  return rollJobs({ ...blankQuests(seed), active }, 1);
}

/** A person brought home takes up their starter, unless it is done or they already hold a quest. */
export function acceptStarter(quests: QuestState, giver: MerchantId, now: number): QuestState {
  const def = startersOf().find((d) => d.giver === giver);
  const nothingToTake = !def || quests.active[giver] || quests.done.includes(def.id);
  if (nothingToTake) return quests;
  return { ...quests, active: { ...quests.active, [giver]: { id: def.id, progress: 0, acceptedAt: now } } };
}

const jobsFor = (giver: MerchantId, highest: number): QuestDef[] => QUESTS.filter((def) => def.repeat === 'job' && def.giver === giver && (def.gate ?? 0) <= highest);

/** Puts a fresh job on every stall that has none accepted. An accepted job is left alone. Called for a banked trip, never a death. */
export function rollJobs(quests: QuestState, highest: number): QuestState {
  const rng = createRng(quests.seed ^ Math.imul(quests.rolls + 1, ROLL_STRIDE));
  const jobs = noJobs();
  for (const giver of MERCHANT_IDS) {
    const pool = jobsFor(giver, highest);
    const taken = quests.active[giver]?.id;
    const open = pool.filter((def) => def.id !== taken);
    jobs[giver] = open.length > 0 ? pick(rng, open).id : null;
  }
  return { ...quests, rolls: quests.rolls + 1, jobs };
}
