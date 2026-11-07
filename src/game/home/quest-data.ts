// The merchants' quests: what each asks for and pays. A plain table beside merchant-data.ts. Every number is a starting value for the soak.

import type { MerchantId, StationId } from '../../../shared/home-protocol.ts';
import type { WeaponId, ZombieType } from '../../../shared/protocol.ts';

/** What the client counts during a trip, by name. The tally reducer fills each one. */
export const TALLY_COUNTERS = [
  'kills', 'headshots', 'shoves', 'finds', 'noisy', 'bottles', 'medkits', 'damage', 'suppressed', 'burning', 'bandages',
] as const;
export type TallyCounter = (typeof TALLY_COUNTERS)[number];

/** Narrows an objective to the trips and play it counts. Each field left off means anyone, anywhere. */
export interface QuestFilter {
  /** The trip's level, at least this. */
  minLevel?: number;
  /** A character id from shared/characters.ts, never an index. */
  survivor?: string;
  /** Counts only kills of this kind. */
  zombie?: ZombieType;
  /** Counts only trips with at least this many in the party. */
  minParty?: number;
}

export type Objective =
  | { kind: 'visit'; station: StationId }
  | { kind: 'bank'; count: number }
  /** Banked trips in a row. A death on a trip the filter counts resets it, unless it is already finished. */
  | { kind: 'streak'; count: number }
  | { kind: 'receipt_total'; field: 'hordes' | 'kills'; count: number }
  /** One banked trip at or under this many seconds. */
  | { kind: 'fast'; seconds: number }
  | { kind: 'bring_home'; what: 'gun' | 'medkit' | 'jewel' | WeaponId; count: number }
  /** `scope: 'trip'` counts inside one banked trip and is lost on a death; `total` adds up across banked trips. */
  | { kind: 'tally'; counter: TallyCounter; count: number; scope: 'trip' | 'total'; atMost?: { counter: TallyCounter; count: number } }
  | { kind: 'smelt'; count: number };

export type QuestReward =
  | { kind: 'silver'; amount: number }
  /** A merchant's own item, so its icon, facts and price come for free. */
  | { kind: 'item'; merchant: MerchantId; item: string; count: number };

export interface QuestDef {
  /** Never renamed once shipped: a save names it. */
  id: string;
  giver: MerchantId;
  title: string;
  brief: string;
  objective: Objective;
  filter?: QuestFilter;
  reward: readonly QuestReward[];
  /** A job comes back after it is turned in; a one-time quest does not. */
  repeat: 'once' | 'job';
  /** Accepted on a new save. */
  starter?: boolean;
  /** Offered only once all of these are done. */
  after?: readonly string[];
  /** Offered once the player's own highest level reaches this. */
  gate?: number;
  /** Offered only to a player who owns this gun. */
  owns?: WeaponId;
  /** Job silver by level band, in place of a silver reward. */
  jobSilver?: number;
}

const silver = (amount: number): QuestReward => ({ kind: 'silver', amount });
const item = (merchant: MerchantId, id: string, count = 1): QuestReward => ({ kind: 'item', merchant, item: id, count });

export const QUESTS: readonly QuestDef[] = [
  // Starters
  { id: 'report_in', giver: 'quartermaster', title: 'Report in', brief: 'Check in at the quartermaster.', objective: { kind: 'visit', station: 'quartermaster' }, reward: [item('quartermaster', 'bottle', 2), silver(20)], repeat: 'once', starter: true },
  { id: 'bring_iron', giver: 'gunsmith', title: 'Bring iron', brief: 'Take the van from the garage and bring a gun home. The pistol counts.', objective: { kind: 'bring_home', what: 'gun', count: 1 }, reward: [item('gunsmith', 'barrel')], repeat: 'once', starter: true },
  { id: 'pharmacy_run', giver: 'medic', title: 'Pharmacy run', brief: 'Take the van from the garage and bring home a medkit.', objective: { kind: 'bring_home', what: 'medkit', count: 1 }, reward: [silver(60)], repeat: 'once', starter: true },
  { id: 'first_smelt', giver: 'powder', title: 'First smelt', brief: 'Take the van from the garage for a jewel, then melt it at the forge.', objective: { kind: 'smelt', count: 1 }, reward: [item('powder', 'tranq_kit')], repeat: 'once', starter: true },
  // One-time
  { id: 'out_and_back', giver: 'quartermaster', title: 'Out and back', brief: 'Take the van out and bring one trip home.', objective: { kind: 'bank', count: 1 }, after: ['report_in'], reward: [silver(50), item('quartermaster', 'pistol_ammo')], repeat: 'once' },
  { id: 'evidence_locker', giver: 'gunsmith', title: 'Evidence locker', brief: 'Bring home a carbine. The police station always has one.', objective: { kind: 'bring_home', what: 'carbine', count: 1 }, after: ['bring_iron'], reward: [item('gunsmith', 'grip'), silver(60)], repeat: 'once' },
  { id: 'headhunter', giver: 'gunsmith', title: 'Headhunter', brief: 'Land 15 headshots in one trip.', objective: { kind: 'tally', counter: 'headshots', count: 15, scope: 'trip' }, gate: 2, reward: [silver(150)], repeat: 'once' },
  { id: 'ghost_walk', giver: 'gunsmith', title: 'Ghost walk', brief: 'As Night, find 8 things in a trip without one noisy search.', objective: { kind: 'tally', counter: 'finds', count: 8, scope: 'trip', atMost: { counter: 'noisy', count: 0 } }, filter: { survivor: 'night', minLevel: 3 }, gate: 4, reward: [item('gunsmith', 'suppressor')], repeat: 'once' },
  { id: 'hold_the_line', giver: 'quartermaster', title: 'Hold the line', brief: 'Survive 10 hordes across your trips.', objective: { kind: 'receipt_total', field: 'hordes', count: 10 }, after: ['out_and_back'], reward: [item('quartermaster', 'knife')], repeat: 'once' },
  { id: 'shove_and_stab', giver: 'quartermaster', title: 'Shove and stab', brief: 'As Rex, land 30 shoves in a trip.', objective: { kind: 'tally', counter: 'shoves', count: 30, scope: 'trip' }, filter: { survivor: 'rex' }, gate: 2, reward: [silver(120), item('quartermaster', 'bottle', 3)], repeat: 'once' },
  { id: 'fast_hands', giver: 'quartermaster', title: 'Fast hands', brief: 'As Bandus, make 50 kills in a trip at level 4 or higher.', objective: { kind: 'tally', counter: 'kills', count: 50, scope: 'trip' }, filter: { survivor: 'bandus', minLevel: 4 }, gate: 4, owns: 'carbine', reward: [silver(150)], repeat: 'once' },
  { id: 'patch_up', giver: 'medic', title: 'Patch up', brief: 'Use 2 medkits across your trips.', objective: { kind: 'tally', counter: 'medkits', count: 2, scope: 'total' }, after: ['pharmacy_run'], reward: [item('medic', 'medkit'), silver(40)], repeat: 'once' },
  { id: 'steady_hands', giver: 'medic', title: 'Steady hands', brief: 'Bring 3 trips home in a row at level 2 or higher.', objective: { kind: 'streak', count: 3 }, filter: { minLevel: 2 }, gate: 2, reward: [item('medic', 'medkit', 2)], repeat: 'once' },
  { id: 'run_for_it', giver: 'medic', title: 'Run for it', brief: 'As Queen, bring a level 3 or higher trip home in 8 minutes or less.', objective: { kind: 'fast', seconds: 480 }, filter: { survivor: 'satori', minLevel: 3 }, gate: 3, reward: [item('medic', 'medkit'), silver(100)], repeat: 'once' },
  { id: 'firestarter', giver: 'powder', title: 'Firestarter', brief: 'Make 10 kills by burning.', objective: { kind: 'tally', counter: 'burning', count: 10, scope: 'total' }, after: ['first_smelt'], reward: [item('powder', 'incendiary_kit'), silver(60)], repeat: 'once' },
  { id: 'big_game', giver: 'powder', title: 'Big game', brief: 'Bring down a brute in one trip.', objective: { kind: 'tally', counter: 'kills', count: 1, scope: 'trip' }, filter: { zombie: 'brute' }, gate: 5, reward: [item('powder', 'acid_kit'), silver(100)], repeat: 'once' },
  { id: 'magpie', giver: 'powder', title: 'Magpie', brief: 'As Sol, find 20 things in one trip at level 3 or higher.', objective: { kind: 'tally', counter: 'finds', count: 20, scope: 'trip' }, filter: { survivor: 'sol', minLevel: 3 }, gate: 3, reward: [item('powder', 'piercing_kit')], repeat: 'once' },
  // Jobs: one per stall, silver scaled by the player's own highest level
  { id: 'job_range_day', giver: 'gunsmith', title: 'Range day', brief: 'Make 25 kills in a trip.', objective: { kind: 'tally', counter: 'kills', count: 25, scope: 'trip' }, jobSilver: 40, reward: [], repeat: 'job' },
  { id: 'job_quiet_hands', giver: 'quartermaster', title: 'Quiet hands', brief: 'Land 15 shoves in a trip.', objective: { kind: 'tally', counter: 'shoves', count: 15, scope: 'trip' }, jobSilver: 30, reward: [], repeat: 'job' },
  { id: 'job_field_dressing', giver: 'medic', title: 'Field dressing', brief: 'Pick up 2 bandages in a trip.', objective: { kind: 'tally', counter: 'bandages', count: 2, scope: 'trip' }, jobSilver: 30, reward: [], repeat: 'job' },
  { id: 'job_shiny_things', giver: 'powder', title: 'Shiny things', brief: 'Bring home 3 jewels.', objective: { kind: 'bring_home', what: 'jewel', count: 3 }, jobSilver: 40, reward: [], repeat: 'job' },
];

/** Job silver rises with the player's own highest level. Difficulty scales nothing. */
export const JOB_BANDS: readonly { readonly upTo: number; readonly times: number }[] = [
  { upTo: 3, times: 1 },
  { upTo: 6, times: 1.5 },
  { upTo: Infinity, times: 2 },
];

export const jobTimes = (highest: number): number => (JOB_BANDS.find((band) => highest <= band.upTo) ?? JOB_BANDS[0]).times;

export function questOf(id: string): QuestDef | undefined {
  return QUESTS.find((each) => each.id === id);
}

export const questsOf = (giver: MerchantId): QuestDef[] => QUESTS.filter((each) => each.giver === giver);

export const startersOf = (): QuestDef[] => QUESTS.filter((each) => each.starter);

/** How much of the objective is a full bar. */
export function targetOf(objective: Objective): number {
  const isVisit = objective.kind === 'visit';
  if (isVisit) return 1;
  const isFast = objective.kind === 'fast';
  if (isFast) return 1;
  return objective.count;
}
