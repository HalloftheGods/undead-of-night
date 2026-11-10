// What a player keeps between trips, and the one way to write it.

import type { DifficultyId } from '../../../shared/difficulty.ts';
import type { Jewels, Loadout, MerchantId } from '../../../shared/home-protocol.ts';
import { emptyLoadout } from '../../../shared/loadout.ts';
import { QUEST_SALT, starterQuests } from './quest-state.ts';
import type { QuestState } from './quest-state.ts';
import { emptyShop } from './shop.ts';
import type { ShopState } from './shop.ts';

export type SaveResult = { kind: 'saved'; version: number } | { kind: 'conflict' } | { kind: 'failed'; reason: string };

/** Every write goes through `save()`, so a version check can catch a second tab. */
export interface HomeStore {
  load(): Promise<HomeSave>;
  save(next: HomeSave): Promise<SaveResult>;
}

export interface HomeSave {
  version: number;
  candy: number;
  silver: number;
  rawJewels: Jewels;
  locker: Loadout;
  /** Taken out of the locker and still safe, until a trip opens. */
  hands: Loadout;
  openTrip: OpenTrip | null;
  /** `${simId}:${serial}` of every receipt credited, written in the same save as the credit. */
  appliedReceipts: readonly string[];
  ledger: readonly TripRecord[];
  shop: ShopState;
  quests: QuestState;
  /** Every overrun that ended for this player, apart from `ledger` so that stays a list of trips. */
  overruns: readonly OverrunRecord[];
  /** Written when a breach is first seen. Still here on load, it is an overrun died in. */
  openOverrun: OpenOverrun | null;
}

/** Written before a player counts as ready. Still here on load, it is a trip that never came home. */
export interface OpenTrip {
  level: number;
  mode: 'solo' | 'coop';
  /** A trip that never came home has no receipt, so its ledger row reads this instead. */
  difficulty: DifficultyId;
  startedAt: number;
}

export interface TripRecord {
  level: number;
  outcome: 'banked' | 'died';
  difficulty: DifficultyId;
  silver: number;
  jewels: Jewels;
  candy?: number;
  replay: boolean;
  at: number;
}

export interface OverrunRecord {
  outcome: 'held' | 'fled' | 'died';
  share: number;
  /** The room's highest level then, which sized the horde. */
  highest: number;
  difficulty: DifficultyId;
  kills: number;
  /** The merchants a flight cost. */
  merchantsLost: readonly MerchantId[];
  silver: number;
  candy?: number;
  at: number;
}

export interface OpenOverrun {
  /** The wire does not carry the sim's id before a receipt, so this may be empty. Nothing matches on it. */
  simId: string;
  mode: 'solo' | 'coop';
  startedAt: number;
  /** What the record of a death in this breach reads. Absent from an older save, which reads 0 and the baseline. */
  highest?: number;
  difficulty?: DifficultyId;
}

/** A first save with nothing in it, before `rollStock` has filled the shops. */
export function emptySave(shopSeed: number): HomeSave {
  return {
    version: 0,
    candy: 0,
    silver: 0,
    rawJewels: { small: 0, large: 0 },
    locker: emptyLoadout(),
    hands: emptyLoadout(),
    openTrip: null,
    appliedReceipts: [],
    ledger: [],
    shop: emptyShop(shopSeed),
    quests: starterQuests(shopSeed ^ QUEST_SALT),
    overruns: [],
    openOverrun: null,
  };
}
