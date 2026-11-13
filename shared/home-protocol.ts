// The Home Loop's vocabulary: what crosses the sim/client boundary for the bunker, a trip and
// the van. Pure data, types and small checks, so it loads in the browser, Node and vitest alike.

import type { DifficultyId } from './difficulty.ts';
import type { SALVAGE_TYPES } from './events.ts';
import type { PartCounts } from './gun-upgrade-data.ts';
import type { GunFit } from './gun-upgrades.ts';
import type { WeaponId, WorldMap } from './protocol.ts';
import type { KitCounts } from './round-effect-data.ts';
import type { Supplies } from './supply-types.ts';

/** The bunker is a map like any other, reached by a seed no town can have. */
export const BUNKER_SEED = -1;
/** `sim.level` in the bunker, which clamps to level 1's look and triggers no town rule. */
export const BUNKER_LEVEL = 0;

/** The bunker's horde clock. Live for everyone since 2026-11-07; flip back to false to hide it (a dev build then turns it on with `?overrun`). */
export const OVERRUN_LIVE = true;

export const MERCHANT_IDS = ['gunsmith', 'quartermaster', 'medic', 'powder'] as const;
export type MerchantId = (typeof MERCHANT_IDS)[number];

/** `chest` stands only while a held overrun's chest is unopened. */
export const STATION_IDS = ['bench', 'candy_shop', 'locker', 'level_map', 'jukebox', ...MERCHANT_IDS, 'chest', 'press'] as const;
export type StationId = (typeof STATION_IDS)[number];

export interface Station {
  readonly id: StationId;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** A merchant walking the bunker, as the snapshot carries them. Their id is their entity id too: no player or zombie id looks like one. */
export interface MerchantEntity {
  readonly id: MerchantId;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly moving: boolean;
  /** Downed by the horde, up again once it is over. */
  readonly status: 'alive' | 'downed';
  readonly health: number;
  readonly maxHealth: number;
  readonly weapon: WeaponId;
  /** 0 when not reloading, else 0..1 through the reload, as a player's. */
  readonly reload: number;
}

export interface Jewels {
  small: number;
  large: number;
}

/** A kind of salvage, which the press turns into round kits. */
export type SalvageId = (typeof SALVAGE_TYPES)[number];
export type SalvageCounts = Record<SalvageId, number>;

/** Gear as it leaves one side for the other: taken out of the locker, or brought home by the van. */
export interface Loadout {
  guns: Partial<Record<WeaponId, { fit?: GunFit }>>;
  ammoBag: Record<WeaponId, number>;
  parts: PartCounts;
  kits: KitCounts;
  medkits: number;
  knife: boolean;
  bottles: number;
  /** Bandages and survival items stored (`shared/supply-types.ts`). */
  supplies?: Supplies;
}

/** What a player brings to the room. The server checks it is legal, and cannot prove it was earned. */
export interface JoinHome {
  loadout: Loadout;
  highest: number;
  /** Has seen the ending, so clearing the last level is a normal trip. Left off for no. */
  finished?: boolean;
  /** Has found a radio, so The Radio works for them. Left off for no. */
  radio?: boolean;
}

export type HomeAction =
  | { kind: 'pick_level'; level: number }
  | { kind: 'equip'; loadout: Loadout }
  | { kind: 'ready'; ready: boolean }
  | { kind: 'leave_station' }
  | { kind: 'highest'; highest: number }
  | { kind: 'jukebox'; track: string | null };

/** The primary input device used during the run, for separate leaderboards. */
export type Platform = 'desktop' | 'touch' | 'gamepad';

/** How a trip ended for one player. State, not an event, so a slow client cannot lose it. */
export interface TripReceipt {
  simId: string;
  serial: number;
  outcome: 'banked' | 'died';
  level: number;
  /** `sim.difficulty`, which the ledger records. */
  difficulty: DifficultyId;
  /** Banked: what to credit. Died: what was lost, for the summary and the ledger, and never credited. */
  silver: number;
  /** As `silver`. */
  jewels: Jewels;
  /** Banked candy credit worth and bag contents. */
  candy?: number;
  candyBag?: Partial<Record<string, number>>;
  /** A level below the highest anyone in the room has reached. */
  replay: boolean;
  score: number;
  kills: number;
  hordes: number;
  seconds: number;
  /** The first clear of the last level: the ending plays. */
  ending: boolean;
  /** What came home, or null when nothing did. */
  gear: Loadout | null;
  /** The primary input device used, for separate leaderboards. Left off for older runs. */
  platform?: Platform;
  /** As `silver`. Left off by a server from before salvage, and read as none. */
  salvage?: SalvageCounts;
  /** The level each radio was found on, for any receipt of a player who was in the room. Left off for none. */
  radioLevels?: number[];
}

/** Counting down to the breach, guns free near the end, the horde in, then the room held or fallen. */
export const OVERRUN_PHASES = ['counting', 'armed', 'breached', 'held', 'lost'] as const;
export type OverrunPhase = (typeof OVERRUN_PHASES)[number];

/** How an overrun ended for the room: the horde killed, or nobody standing. A flight is the van leaving, not an end. */
export type OverrunEnd = Extract<OverrunPhase, 'held' | 'lost'>;

/** The room's overrun as every client draws it, on RoomHomeView. */
export interface OverrunView {
  phase: OverrunPhase;
  /** The clock's full length in seconds, which the difficulty sets. A view from a build without it is read as `OVERRUN_CLOCK_SEC`. */
  spanSec?: number;
  /** Seconds on the clock to the breach, which pass at the menu rate while the room is in menus. 0 once breached. */
  left: number;
  /** The clock ran at the menu rate on the last tick. */
  slowed: boolean;
  /** Horde zombies still to come through the door or standing. 0 before the breach. */
  hostiles: number;
  /** The breach's roster size. 0 before the breach. */
  total: number;
  /** The fence sections that give, by their place in the camp's ring: rattling while armed, down from the breach on. Left off before the clock arms. */
  gaps?: number[];
}

/** How an overrun ended for one player. State, not an event, as a trip receipt is. */
export interface OverrunReceipt {
  simId: string;
  /** From `run.nextReceipt`, so `${simId}:${serial}` never matches a trip receipt's. */
  serial: number;
  outcome: 'held' | 'fled' | 'died';
  /** Fled: the share of the horde still to come or standing when the van left, 0..1. Otherwise 0. */
  share: number;
  /** Held: the chest's gear, for the locker. Null otherwise. */
  chest: Loadout | null;
  /** Held: the chest's silver, for the bank. */
  silver: number;
  /** Held: the chest's jewel, for the bank. */
  jewels: Jewels;
  /** Held: candy credited from the chest. */
  candy?: number;
  /** Died: the gear in hand that went down with the body. Null otherwise. */
  lost: Loadout | null;
  kills: number;
  seconds: number;
  /** Held: the died receipt of a body that fell in the horde and then opened its chest, so the death still reaches the save. Left off otherwise. */
  died?: OverrunReceipt;
}

/** One player's side of the bunker and the trip, on PlayerEntity. */
export interface HomeView {
  /** Carried on this trip. The bank lives in the browser and never goes on the wire. */
  silver: number;
  jewels: Jewels;
  candy?: number;
  /** Carried on this trip, as jewels are. Left off by a server from before salvage. */
  salvage?: SalvageCounts;
  station: StationId | null;
  /** 0..1 through the hold on E. */
  stationHold: number;
  ready: boolean;
  receipt: TripReceipt | null;
  /** The last overrun's receipt, until the next arrival in the bunker. Left off by a server from before the overrun. */
  overrun?: OverrunReceipt | null;
  /** This player's chest from a held overrun is waiting unopened. Left off otherwise, and off every other player's body. */
  chest?: true;
  /** This player has a radio, so The Radio works for them. Left off for none. */
  radio?: true;
}

/** The room's side, on SnapshotPacket. */
export interface RoomHomeView {
  pickedLevel: number | null;
  roomHighest: number;
  /** Left off while there is no overrun. */
  overrun?: OverrunView;
  /** Mood track chosen at the bunker's jukebox, heard by everyone in the room. */
  jukeboxTrack?: string | null;
}

export const isBunkerSeed = (seed: number): boolean => seed === BUNKER_SEED;

export const isBunkerMap = (map: WorldMap): boolean => isBunkerSeed(map.seed);

export const isMerchantId = (station: StationId): station is MerchantId => MERCHANT_IDS.includes(station as MerchantId);
