// A diner is a kitchen, so its fridges often hold a knife. Picked from the town's seed alone, on a generator of
// its own and only into fridges left empty, so the simulation's rolls and the town's ammo stay as they were.

import { townContainers } from './containers.ts';
import type { BuildingKind } from './protocol.ts';
import { createRng } from './rng.ts';
import type { SimState } from './sim-state.ts';

/** Odds an empty container in a kitchen gets a knife. */
export const KITCHEN_KNIFE_ODDS = 0.5;
/** Where the kitchens are. */
export const KITCHENS: ReadonlySet<BuildingKind | 'outdoors'> = new Set(['diner']);
const KNIFE_SALT = 0x4b4e4946;

export function placeKitchenKnives(sim: SimState): void {
  const rng = createRng(sim.map.seed ^ KNIFE_SALT);
  for (const container of townContainers(sim.map).filter((each) => KITCHENS.has(each.buildingKind))) {
    const lucky = rng() < KITCHEN_KNIFE_ODDS;
    const state = sim.containers[container.id];
    const isFree = lucky && state.loot === null;
    if (isFree) state.loot = { type: 'knife', rounds: 0 };
  }
}
