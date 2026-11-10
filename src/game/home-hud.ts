import { candiesIn, candyBagWorth } from '../../shared/candy.ts';
import type { CandyId } from '../../shared/candy.ts';
import { BASELINE_DIFFICULTY } from '../../shared/difficulty.ts';
import type { DifficultyId } from '../../shared/difficulty.ts';
import { isBunkerSeed, isMerchantId } from '../../shared/home-protocol.ts';
import type { Jewels, Loadout, MerchantId, OverrunView, StationId, TripReceipt } from '../../shared/home-protocol.ts';
import { FIRST_LEVEL } from '../../shared/levels.ts';
import type { PlayerEntity, SnapshotPacket } from '../../shared/protocol.ts';
import { jewelWorth } from '../../shared/treasure.ts';
import type { HomeSave } from './home/home-store.ts';
import { emptyTally } from './home/quest-tally.ts';
import type { TripTally } from './home/quest-tally.ts';
import type { QuestContext } from './home/quests.ts';
import type { ShopContext } from './home/shop.ts';

/** What a death on a trip cost, held on screen until the player wakes. */
export interface TripDeath {
  readonly receipt: TripReceipt;
  /** The gear that went with them. */
  readonly lost: Loadout;
  readonly overrun?: undefined;
}

/** What going down in the bunker's overrun cost: only the gear in hand. The locker, the bank and the stock held. */
export interface OverrunDeath {
  /** `bunkerFell`: nobody was left standing. Otherwise this body fell while the rest held. */
  readonly overrun: { readonly bunkerFell: boolean };
  /** The gear in hand that went down with them. */
  readonly lost: Loadout;
  readonly receipt?: undefined;
}

export type HomeDeath = TripDeath | OverrunDeath;

/** What the reward chest held, which is already in the locker and the bank. */
export interface ChestOpened {
  readonly gear: Loadout;
  readonly silver: number;
  readonly jewels: Jewels;
  readonly candy?: number;
}

export interface HomeUi {
  /** In the bunker, not out on a trip. */
  readonly inBunker: boolean;
  /** The station this player has open. */
  readonly station: StationId | null;
  /** 0..1 through the hold on E. */
  readonly stationHold: number;
  /** The merchant whose shop is open. Follows `station`, so it shuts the moment the station clears. */
  readonly shop: MerchantId | null;
  readonly ready: boolean;
  /** Candy and jewels in hand on this trip. Towns hold no coin. */
  readonly carried: {
    readonly jewels: Jewels;
    readonly worth: number;
    readonly candy?: number;
    readonly candyCount?: number;
    readonly candyList?: readonly CandyId[];
  };
  readonly pickedLevel: number | null;
  /** The highest level anyone in the room can pick. */
  readonly roomHighest: number;
  /** The room's overrun clock, or null while there is none. */
  readonly overrun: OverrunView | null;
  /** This player's own highest level, which the shop's gates read. */
  readonly highest: number;
  readonly difficulty: DifficultyId;
  readonly receipt: TripReceipt | null;
  /** The save as last read, or null until it has loaded. */
  readonly save: HomeSave | null;
  /** 0..1 through the jewel on the forge. */
  readonly forgeProgress: number;
  /** Why the last save did not land, or null if it did. */
  readonly saveError: string | null;
  readonly death: HomeDeath | null;
  /** The chest just opened, held on screen until the player puts it away. */
  readonly chest: ChestOpened | null;
  /** What the quest screens read beyond the save: the live count of this trip. */
  readonly quests: { readonly tally: TripTally };
}

/** What the home screens can ask for. Results come back through `UiState.home`. */
export interface HomeActions {
  pickLevel(level: number): void;
  equip(loadout: Loadout): void;
  closeStation(): void;
  /** A screen with something still to settle says how to close it, so Esc does what its Close button does. Null when it goes. */
  closeWith(closer: (() => void) | null): void;
  smelt(): void;
  buyCandy(id: string): void;
  sellCandy(id: string): void;
  sellAllCandy(): void;
  /** Builds its `ShopContext` from `UiState.home` with `shopContext`, so a screen never has to. */
  buy(merchant: MerchantId, item: string): void;
  /** Like `buy`, the context is built from `UiState.home` with `questContext`. A screen reads the outcome from the refreshed save. */
  acceptQuest(merchant: MerchantId, id: string): void;
  turnInQuest(merchant: MerchantId): void;
  abandonQuest(merchant: MerchantId): void;
  wake(): void;
  /** Puts the opened chest's card away. */
  closeChest(): void;
  continueFromEnding(): void;
}

/** Outside a home session there is nothing to ask. */
export const NO_HOME_ACTIONS: HomeActions = {
  pickLevel() {},
  equip() {},
  closeStation() {},
  closeWith() {},
  smelt() {},
  buyCandy() {},
  sellCandy() {},
  sellAllCandy() {},
  buy() {},
  acceptQuest() {},
  turnInQuest() {},
  abandonQuest() {},
  wake() {},
  closeChest() {},
  continueFromEnding() {},
};

/** What this client knows that no snapshot carries: from the store, its level progress and the welcome. */
export interface HomeFacts {
  readonly save: HomeSave | null;
  readonly highest: number;
  readonly difficulty: DifficultyId;
  /** 0..1 through the jewel on the forge. Left off for none. */
  readonly forgeProgress?: number;
  /** Why the last save did not land. Left off for none. */
  readonly saveError?: string | null;
  /** A death waiting to be read. Left off for none. */
  readonly death?: HomeDeath | null;
  /** The chest just opened. Left off for none. */
  readonly chest?: ChestOpened | null;
  /** The running count of this trip's events. Left off for none. */
  readonly tally?: TripTally;
}

/** Outside a home session there is nothing to know. */
const NO_HOME_FACTS: HomeFacts = { save: null, highest: FIRST_LEVEL, difficulty: BASELINE_DIFFICULTY };

export function shopContext(home: HomeUi): ShopContext {
  const { highest, station, difficulty } = home;
  return { highest, station, difficulty };
}

/** What a quest step needs beyond the save, read from the screen's own state. */
export function questContext(home: HomeUi): QuestContext {
  const { highest, station, difficulty } = home;
  return { highest, station, difficulty, now: Date.now() };
}

/** Null outside home mode, which is how every screen tells the two games apart once a run is on. */
export function homeUi(snapshot: SnapshotPacket, local: PlayerEntity, facts: HomeFacts = NO_HOME_FACTS): HomeUi | null {
  const { home } = local;
  if (!home) return null;
  const { station } = home;
  const atStall = station !== null && isMerchantId(station);
  return {
    inBunker: isBunkerSeed(snapshot.mapSeed),
    station,
    stationHold: home.stationHold,
    shop: atStall ? station : null,
    ready: home.ready,
    carried: {
      jewels: home.jewels,
      worth: jewelWorth(home.jewels),
      candy: candyBagWorth(local.candy ?? local.bag ?? {}),
      candyCount: local.candy?.length ?? Object.values(local.bag ?? {}).reduce((sum, n) => sum + (n ?? 0), 0),
      candyList: local.candy ?? candiesIn(local.bag),
    },
    pickedLevel: snapshot.home?.pickedLevel ?? null,
    roomHighest: snapshot.home?.roomHighest ?? FIRST_LEVEL,
    overrun: snapshot.home?.overrun ?? null,
    highest: facts.highest,
    difficulty: facts.difficulty,
    receipt: home.receipt,
    save: facts.save,
    forgeProgress: facts.forgeProgress ?? 0,
    saveError: facts.saveError ?? null,
    death: facts.death ?? null,
    chest: facts.chest ?? null,
    quests: { tally: facts.tally ?? emptyTally() },
  };
}
