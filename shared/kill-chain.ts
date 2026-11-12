// Kill chains pay: kills by one survivor in quick succession are each worth more than the last, up to double.
// The client's DOUBLE/TRIPLE callouts use the same window, so the words and the points agree.

import { TICK_DT } from './constants.ts';
import { CORN_RUSH_WINDOW, sugarById } from './candy.ts';
import type { EntityId } from './protocol.ts';
import type { SimState } from './sim-state.ts';

/** Kills this close together chain. Matches CHAIN_WINDOW_MS in src/game/kill-juice.ts. */
export const CHAIN_WINDOW_SEC = 1.4;
/** Each kill in a chain past the first adds this much to the multiplier, up to the cap. */
export const CHAIN_STEP = 0.25;
export const CHAIN_MAX_MULTIPLIER = 2;

/** Headshots this close together chain. Generous window (3.5s) to allow deliberate aim. */
export const HEADSHOT_CHAIN_WINDOW_SEC = 3.5;
/** Each consecutive headshot past the first increases the multiplier by 0.5 up to 3x. */
export const HEADSHOT_CHAIN_STEP = 0.5;
export const HEADSHOT_MAX_MULTIPLIER = 3;

export interface KillChain {
  count: number;
  /** The last tick a kill still chains on. */
  until: number;
}

/** What the nth kill in a chain multiplies its points by: 1, 1.25, 1.5, 1.75, then 2 from the fifth on. */
export function chainMultiplier(count: number): number {
  return Math.min(CHAIN_MAX_MULTIPLIER, 1 + CHAIN_STEP * Math.max(0, count - 1));
}

/** What the nth headshot in a chain multiplies its points by: 1, 1.5, 2.0, 2.5, 3.0. */
export function headshotChainMultiplier(count: number): number {
  return Math.min(HEADSHOT_MAX_MULTIPLIER, 1 + HEADSHOT_CHAIN_STEP * Math.max(0, count - 1));
}

/** Counts a kill into its killer's chain and returns the kill's place in it. */
export function chainKill(sim: SimState, killerId: EntityId): number {
  const chain = sim.killChains.get(killerId);
  const chained = chain !== undefined && sim.tick <= chain.until;
  const count = chained ? chain.count + 1 : 1;
  const chainSugar = Math.max(sugarById(sim, killerId, 'witchs_brittle'), sugarById(sim, killerId, 'corn_rush'));
  const rush = 1 + (CORN_RUSH_WINDOW - 1) * chainSugar;
  sim.killChains.set(killerId, { count, until: sim.tick + Math.round((CHAIN_WINDOW_SEC * rush) / TICK_DT) });
  return count;
}

/** Counts a headshot into its shooter's streak and returns the streak length. */
export function chainHeadshot(sim: SimState, shooterId: EntityId): number {
  const chains = sim.headshotChains ?? (sim.headshotChains = new Map());
  const chain = chains.get(shooterId);
  const chained = chain !== undefined && sim.tick <= chain.until;
  const count = chained ? chain.count + 1 : 1;
  const chainSugar = Math.max(sugarById(sim, shooterId, 'witchs_brittle'), sugarById(sim, shooterId, 'corn_rush'));
  const rush = 1 + (CORN_RUSH_WINDOW - 1) * chainSugar;
  chains.set(shooterId, { count, until: sim.tick + Math.round((HEADSHOT_CHAIN_WINDOW_SEC * rush) / TICK_DT) });
  return count;
}
