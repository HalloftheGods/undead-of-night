// Achievements, kept as rubber stamps in the record book. They are read off the events every client already
// gets, so play is the same with them or without them, and they are kept on this device.

import { nightEventFor } from '../../shared/night-events.ts';
import type { EntityId, GameEvent } from '../../shared/protocol.ts';
import { browserStore, readJson, writeJson } from './storage.ts';
import type { Store } from './storage.ts';

export type StampId =
  | 'first_blood' | 'headhunter' | 'massacre' | 'crowd_control' | 'firestarter' | 'flare_up' | 'special_delivery'
  | 'close_shave' | 'howler_down' | 'mother_down' | 'butcher_down' | 'blood_moon' | 'into_the_fog' | 'halfway'
  | 'last_stop' | 'daily_bread' | 'three_nights';

export interface StampDef {
  readonly id: StampId;
  readonly name: string;
  /** How to earn it, shown under the empty ring before it is. */
  readonly how: string;
}

export const STAMPS: readonly StampDef[] = [
  { id: 'first_blood', name: 'First Blood', how: 'Put down your first zombie.' },
  { id: 'headhunter', name: 'Headhunter', how: 'Land 50 headshots, across every run.' },
  { id: 'massacre', name: 'Massacre', how: 'Chain five kills, each within a breath of the last.' },
  { id: 'crowd_control', name: 'Crowd Control', how: 'Kill 100 in a single run.' },
  { id: 'firestarter', name: 'Firestarter', how: 'Throw 10 molotovs, across every run.' },
  { id: 'flare_up', name: 'Flare Up', how: 'Light a flare.' },
  { id: 'special_delivery', name: 'Special Delivery', how: 'Grab something from a supply drop.' },
  { id: 'close_shave', name: 'Close Shave', how: 'Make a kill with almost no health left.' },
  { id: 'halfway', name: 'Halfway Home', how: 'Reach level 5.' },
  { id: 'howler_down', name: 'Howler Down', how: 'Kill the Howler.' },
  { id: 'mother_down', name: 'Mother Down', how: 'Kill Mother.' },
  { id: 'butcher_down', name: 'Butcher Down', how: 'Kill the Butcher.' },
  { id: 'blood_moon', name: 'Blood Moon', how: 'See off a horde under a blood moon.' },
  { id: 'into_the_fog', name: 'Into the Fog', how: 'Get out of a town in the fog.' },
  { id: 'last_stop', name: 'Last Stop', how: 'Survive all ten towns.' },
  { id: 'daily_bread', name: 'Daily Bread', how: 'Finish a Daily Night that counts.' },
  { id: 'three_nights', name: 'Three Nights', how: 'Play the Daily Night three days in a row.' },
];

const STAMPS_KEY = 'outbreak.stamps';
const HEADSHOTS_FOR_STAMP = 50;
const MOLOTOVS_FOR_STAMP = 10;
const KILLS_FOR_STAMP = 100;
const CHAIN_FOR_STAMP = 5;
const HALFWAY_LEVEL = 5;
/** Close enough to a landed drop to have taken from it. */
const DROP_REACH = 48;
const BOSS_STAMPS = { howler: 'howler_down', mother: 'mother_down', butcher: 'butcher_down' } as const;

export interface StampBook {
  /** Each earned stamp and the day it was earned (YYYY-MM-DD). */
  readonly earned: Readonly<Partial<Record<StampId, string>>>;
  /** Lifetime counts the counting stamps need. */
  readonly headshots: number;
  readonly molotovs: number;
}

const EMPTY: StampBook = { earned: {}, headshots: 0, molotovs: 0 };

export function loadStamps(store: Store | null = browserStore()): StampBook {
  const raw = readJson(store, STAMPS_KEY);
  const unreadable = typeof raw !== 'object' || raw === null;
  if (unreadable) return EMPTY;
  const r = raw as Record<string, unknown>;
  const known = new Set<string>(STAMPS.map((stamp) => stamp.id));
  const earned: Partial<Record<StampId, string>> = {};
  const entries = typeof r.earned === 'object' && r.earned !== null ? Object.entries(r.earned) : [];
  for (const [id, day] of entries) {
    const valid = known.has(id) && typeof day === 'string';
    if (valid) earned[id as StampId] = day as string;
  }
  const count = (v: unknown): number => (Number.isFinite(v) ? Number(v) : 0);
  return { earned, headshots: count(r.headshots), molotovs: count(r.molotovs) };
}

/** What a run's reader needs to know besides the events. */
export interface StampContext {
  readonly localId: EntityId | null;
  readonly level: number;
  readonly mapSeed: number;
  /** The local player's kills this run. */
  readonly kills: number;
  /** The landed supply drop, if any, for telling a grab from it. */
  readonly drop: { readonly x: number; readonly y: number } | null;
}

/** Folds one snapshot's events into the book, and says which stamps it newly earned. */
export function readStamps(book: StampBook, events: readonly GameEvent[], ctx: StampContext, today: string): { book: StampBook; earned: StampId[] } {
  const earned: StampId[] = [];
  const has = new Set(Object.keys(book.earned));
  const earn = (id: StampId): void => {
    if (has.has(id)) return;
    has.add(id);
    earned.push(id);
  };
  let { headshots, molotovs } = book;
  const mine = (id: EntityId | null): boolean => id !== null && id === ctx.localId;
  const event = nightEventFor(ctx.mapSeed, ctx.level)?.id ?? null;
  const bloodMoon = event === 'blood_moon';
  const foggy = event === 'fog';
  for (const e of events) {
    switch (e.type) {
      case 'zombie_die': {
        const myKill = mine(e.killerId);
        const myChain = myKill && (e.chain ?? 1) >= CHAIN_FOR_STAMP;
        if (myKill) earn('first_blood');
        if (myChain) earn('massacre');
        break;
      }
      case 'headshot': {
        const isMyHeadshot = mine(e.playerId);
        if (isMyHeadshot) headshots += 1;
        break;
      }
      case 'molotov_burst': {
        const isMyMolotov = mine(e.playerId);
        if (isMyMolotov) molotovs += 1;
        break;
      }
      case 'flare_lit': {
        const isMyFlare = mine(e.playerId);
        if (isMyFlare) earn('flare_up');
        break;
      }
      case 'pickup': {
        const fromDrop = mine(e.playerId) && ctx.drop !== null && Math.hypot(e.x - ctx.drop.x, e.y - ctx.drop.y) <= DROP_REACH;
        if (fromDrop) earn('special_delivery');
        break;
      }
      case 'boss_down':
        earn(BOSS_STAMPS[e.boss]);
        break;
      case 'wave_clear':
        if (bloodMoon) earn('blood_moon');
        break;
      case 'level_complete':
        if (foggy) earn('into_the_fog');
        break;
      case 'level_start': {
        const isPastHalfway = e.level >= HALFWAY_LEVEL;
        if (isPastHalfway) earn('halfway');
        break;
      }
      case 'game_over': {
        const isVictory = e.stats.outcome === 'victory';
        if (isVictory) earn('last_stop');
        break;
      }
      default:
        break;
    }
  }
  const isHeadhunter = headshots >= HEADSHOTS_FOR_STAMP;
  if (isHeadhunter) earn('headhunter');
  const isFirestarter = molotovs >= MOLOTOVS_FOR_STAMP;
  if (isFirestarter) earn('firestarter');
  const isCrowdControl = ctx.kills >= KILLS_FOR_STAMP;
  if (isCrowdControl) earn('crowd_control');
  const stamped = Object.fromEntries(earned.map((id) => [id, today]));
  return { book: { earned: { ...book.earned, ...stamped }, headshots, molotovs }, earned };
}

/** Stamps given outright, off a moment rather than an event: a close call, a Daily Night counted, a streak. */
export function giveStamps(book: StampBook, ids: readonly StampId[], today: string): { book: StampBook; earned: StampId[] } {
  const earned = ids.filter((id, i) => book.earned[id] === undefined && ids.indexOf(id) === i);
  const stamped = Object.fromEntries(earned.map((id) => [id, today]));
  return { book: { ...book, earned: { ...book.earned, ...stamped } }, earned };
}

/**
 * Keeps the book in memory through a run, so a snapshot costs no storage read, and saves it when it
 * changes. Every stamp goes through one keeper, so nothing written elsewhere is overwritten.
 */
export class StampKeeper {
  private book: StampBook;

  constructor(private readonly store: Store | null = browserStore()) {
    this.book = loadStamps(store);
  }

  /** Picks up the book again, as a run starts. */
  reload(): void {
    this.book = loadStamps(this.store);
  }

  /** Folds a snapshot's events in. Returns the stamps it newly earned, for the callout. */
  read(events: readonly GameEvent[], ctx: StampContext, today: string): StampId[] {
    return this.keep(readStamps(this.book, events, ctx, today));
  }

  give(ids: readonly StampId[], today: string): StampId[] {
    return this.keep(giveStamps(this.book, ids, today));
  }

  private keep(next: { book: StampBook; earned: StampId[] }): StampId[] {
    const before = this.book;
    this.book = next.book;
    const changed = next.earned.length > 0 || next.book.headshots !== before.headshots || next.book.molotovs !== before.molotovs;
    if (changed) writeJson(this.store, STAMPS_KEY, next.book);
    return next.earned;
  }
}

export const stampName = (id: StampId): string => STAMPS.find((stamp) => stamp.id === id)?.name ?? id;
