// Treasure in the sim: placed, taken and dropped.
// It keeps its own generator and id counter, off `entityId()`, `sim.rng` and the ammo budget.

import { townContainers } from './containers.ts';
import type { Container } from './containers.ts';
import { TREASURE_TYPES } from './events.ts';
import type { Jewels } from './home-protocol.ts';
import { FINAL_LEVEL, FIRST_LEVEL } from './levels.ts';
import type { PickupType } from './protocol.ts';
import { createRng, shuffle } from './rng.ts';
import type { PickupState, PlayerState, SimState } from './sim-state.ts';

const SILVER_PER_GOLD = 100;

/** Keeps the treasure rolls apart from the town's own use of its seed. */
const TREASURE_SALT = 0x54524541;

export const SMALL_JEWEL_SILVER = 40;
export const LARGE_JEWEL_SILVER = 200;

export type TreasurePickup = (typeof TREASURE_TYPES)[number];

export const isTreasurePickup = (type: PickupType): type is TreasurePickup => TREASURE_TYPES.includes(type as TreasurePickup);

/** Money is stored as whole silver and shown as gold and silver. */
export function silverToCoins(silver: number): { gold: number; silver: number } {
  return { gold: Math.floor(silver / SILVER_PER_GOLD), silver: silver % SILVER_PER_GOLD };
}

/** Money as a player reads it: "2 gold 80 silver", "3 gold" or "80 silver". */
export function coinText(silver: number): string {
  const coins = silverToCoins(silver);
  const hasNoGold = coins.gold === 0;
  if (hasNoGold) return `${coins.silver} silver`;
  return coins.silver === 0 ? `${coins.gold} gold` : `${coins.gold} gold ${coins.silver} silver`;
}

/** What jewels come to once the forge has smelted them. */
export function jewelWorth(jewels: Jewels): number {
  return jewels.small * SMALL_JEWEL_SILVER + jewels.large * LARGE_JEWEL_SILVER;
}

/**
 * The jewels a town holds at each level, first to last. Towns hold no coin: silver comes from the forge.
 * Each level is worth what it held when towns also had silver stacks, within 5% (760 at level 1, 1,480 at level 10).
 * Large jewels take a bigger share as levels rise, so a full town smelts in under a minute at 3 seconds a jewel.
 */
export const TOWN_JEWELS: readonly Jewels[] = [
  { small: 9, large: 2 },
  { small: 10, large: 2 },
  { small: 11, large: 2 },
  { small: 7, large: 4 },
  { small: 8, large: 4 },
  { small: 9, large: 4 },
  { small: 10, large: 4 },
  { small: 10, large: 5 },
  { small: 11, large: 5 },
  { small: 12, large: 5 },
];

/** A replay of a level the room has already got past holds half as many of each, rounded down. */
export function treasureCounts(level: number, replay: boolean): Jewels {
  const full = TOWN_JEWELS[Math.min(FINAL_LEVEL, Math.max(FIRST_LEVEL, level)) - FIRST_LEVEL];
  if (!replay) return { ...full };
  return { small: Math.floor(full.small / 2), large: Math.floor(full.large / 2) };
}

/** What a town's jewels come to in silver once smelted. */
export const townWorth = (level: number, replay: boolean): number => jewelWorth(treasureCounts(level, replay));

/** Jewels live in people's homes, and most of all in the bedroom furniture. */
const BEDROOM_FURNITURE: ReadonlySet<Container['kind']> = new Set(['drawer', 'cabinet']);
const HOME_BUILDINGS: ReadonlySet<Container['buildingKind']> = new Set(['house', 'apartment']);

function jewelRank(container: Container): number {
  const inAHome = HOME_BUILDINGS.has(container.buildingKind);
  if (!inAHome) return 2;
  return BEDROOM_FURNITURE.has(container.kind) ? 0 : 1;
}

/** Treasure's own ids, off `entityId()`, because zombie sense timing reads `sim.nextEntity`. */
export function spawnTreasure(sim: SimState, type: TreasurePickup, x: number, y: number, rounds: number): void {
  const serial = sim.homeRun?.nextTreasure ?? 0;
  if (sim.homeRun) sim.homeRun.nextTreasure = serial + 1;
  sim.pickups.push({ id: `t${serial}`, type, x, y, ttl: null, rounds });
}

/** Takes the first `count` containers off the list and puts one jewel in each. */
function putAway(sim: SimState, places: Container[], type: TreasurePickup, count: number, worth: number): void {
  for (const container of places.splice(0, count)) sim.containers[container.id].loot = { type, rounds: worth };
}

/** Leaves jewels in town containers that were empty, picked from the town's seed alone. Does nothing outside a home room. */
export function placeTownTreasure(sim: SimState): void {
  const run = sim.homeRun;
  if (!run) return;
  const rng = createRng(sim.map.seed ^ TREASURE_SALT);
  const counts = treasureCounts(sim.level, sim.level < run.roomHighest);
  const empty = townContainers(sim.map).filter((container) => sim.containers[container.id].loot === null);
  const byJewelRank = shuffle(rng, [...empty]).sort((a, b) => jewelRank(a) - jewelRank(b));
  putAway(sim, byJewelRank, 'jewel_large', counts.large, LARGE_JEWEL_SILVER);
  putAway(sim, byJewelRank, 'jewel_small', counts.small, SMALL_JEWEL_SILVER);
}

/** Whoever touches it carries it. False leaves the item on the ground. */
export function takeTreasure(p: PlayerState, item: PickupState): boolean {
  const { home } = p;
  if (!home) return false;
  const isSmallJewel = item.type === 'jewel_small';
  if (isSmallJewel) home.jewels.small += 1;
  const isLargeJewel = item.type === 'jewel_large';
  if (isLargeJewel) home.jewels.large += 1;
  // Zero rounds is how the pickup loop knows it is spent.
  item.rounds = 0;
  return true;
}

/**
 * Every jewel carried falls where they stood, and everything carried is written down in `p.home.lost`. Runs on every death.
 * Towns hold no coin, so `home.silver` stays 0 on a trip; the receipt keeps the slot, and anything in it is lost, not dropped.
 */
export function dropCarried(sim: SimState, p: PlayerState): void {
  const { home } = p;
  const hasNothingCarried = !sim.homeRun || !home;
  if (hasNothingCarried) return;
  const { silver, jewels } = home;
  for (let n = 0; n < jewels.small; n++) spawnTreasure(sim, 'jewel_small', p.x, p.y, SMALL_JEWEL_SILVER);
  for (let n = 0; n < jewels.large; n++) spawnTreasure(sim, 'jewel_large', p.x, p.y, LARGE_JEWEL_SILVER);
  home.lost = { silver: home.lost.silver + silver, jewels: { small: home.lost.jewels.small + jewels.small, large: home.lost.jewels.large + jewels.large } };
  home.silver = 0;
  home.jewels = { small: 0, large: 0 };
}
