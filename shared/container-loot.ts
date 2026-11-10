import type { ContainerLoot, ContainerState } from './containers.ts';
import { townContainers } from './containers.ts';
import { AMMO_PICKUPS } from './constants.ts';
import { BOOTH_FIREWORKS, isBooth } from './fireworks-booth.ts';
import { scaleRounds } from './difficulty.ts';
import type { DifficultyId } from './difficulty.ts';
import { isAmmoPickup } from './pickups.ts';
import type { BuildingInstance, BuildingKind, PickupType } from './protocol.ts';
import { pick, pickWeighted, shuffle } from './rng.ts';
import type { Rng } from './rng.ts';
import type { SimState } from './sim-state.ts';

interface ContainerLootRule {
  /** Chance a container here holds anything at all. */
  readonly odds: number;
  /** Relative odds of what it holds. */
  readonly table: Partial<Record<PickupType, number>>;
}

/** What a home that came up empty is left with instead. */
const HOME_KEEPSAKES: ContainerLootRule['table'] = { bandage: 2, knife: 0.15 };
/** Homes are where the extra ammo went: a box in a drawer is why it is worth going in. */
const HOME: ContainerLootRule = { odds: 0.24, table: { ...HOME_KEEPSAKES, pistol_ammo: 3, shells: 0.25 } };

/** The sewers have nothing in them to search (no containers are ever placed there), so this rule is never rolled; it only keeps the table complete. */
const NOTHING_UNDERGROUND: ContainerLootRule = { odds: 0.1, table: { bandage: 1 } };

export const CONTAINER_LOOT: Record<BuildingKind | 'outdoors', ContainerLootRule> = {
  house: HOME,
  apartment: HOME,
  upstairs: { odds: 0.3, table: HOME_KEEPSAKES },
  apartment_upstairs: { odds: 0.3, table: HOME_KEEPSAKES },
  hospital_upstairs: { odds: 0.3, table: { bandage: 3, medkit: 2 } },
  school_upstairs: { odds: 0.2, table: { bandage: 3, knife: 1 } },
  sewer_junction: NOTHING_UNDERGROUND,
  sewer_tunnel_h: NOTHING_UNDERGROUND,
  sewer_tunnel_v: NOTHING_UNDERGROUND,
  sewer_pump_station: NOTHING_UNDERGROUND,
  cellar: { odds: 0.35, table: { bandage: 2, medkit: 1, knife: 0.6 } },
  diner: { odds: 0.4, table: { bandage: 3, pistol_ammo: 1, knife: 1.5 } },
  garage: { odds: 0.25, table: { pistol_ammo: 1.2, shells: 0.6, bandage: 2, knife: 1.5 } },
  warehouse: { odds: 0.18, table: { bandage: 2, pistol_ammo: 1, shells: 0.5 } },
  grocery: { odds: 0.2, table: { bandage: 4, pistol_ammo: 0.5 } },
  discount: { odds: 0.22, table: { bandage: 3, pistol_ammo: 0.8, knife: 1, shells: 0.2 } },
  pharmacy: { odds: 0.35, table: { bandage: 3, medkit: 2 } },
  clinic: { odds: 0.35, table: { bandage: 3, medkit: 2 } },
  hospital: { odds: 0.3, table: { bandage: 3, medkit: 2.5 } },
  school: { odds: 0.18, table: { bandage: 3, knife: 1, pistol_ammo: 0.6 } },
  police: { odds: 0.3, table: { pistol_ammo: 3, carbine_ammo: 3, shells: 1 } },
  gun_shop: { odds: 0.3, table: { pistol_ammo: 2, shells: 2, carbine_ammo: 1 } },
  outdoors: { odds: 0.14, table: { bandage: 3, pistol_ammo: 1, knife: 1, shells: 0.2 } },
};

/** Nobody leaves a full box in a drawer: everything put away here is half used. */
function roundsPutAway(type: PickupType, difficulty: DifficultyId): number {
  return isAmmoPickup(type) ? scaleRounds(Math.ceil(AMMO_PICKUPS[type].rounds / 2), difficulty) : 0;
}

/** One thing of the sort this place holds. */
export function rollFind(sim: SimState, kind: BuildingKind | 'outdoors', rng: Rng = sim.rng): ContainerLoot {
  const type = pickWeighted(rng, CONTAINER_LOOT[kind].table);
  return { type, rounds: roundsPutAway(type, sim.difficulty) };
}

function fill(sim: SimState, kind: BuildingKind | 'outdoors', rng: Rng): ContainerState {
  const empty = rng() >= CONTAINER_LOOT[kind].odds;
  return { opened: false, loot: empty ? null : rollFind(sim, kind, rng) };
}

/** Shuts and fills every container in the town. Those upstairs and in cellars roll on `upOrDown`, so the town's own rolls stay put. */
export function stockContainers(sim: SimState, upOrDown: Rng = sim.rng): void {
  sim.containers = townContainers(sim.map).map((container) => {
    // A candy bowl holds its candy and nothing else, so it takes no roll.
    const isBowl = container.kind === 'bowl';
    if (isBowl) return { opened: false, loot: null };
    // The fireworks bus is stocked with fireworks alone.
    if (isBooth(container)) return { opened: false, loot: null, fireworks: BOOTH_FIREWORKS };
    return fill(sim, container.stock, container.upOrDown ? upOrDown : sim.rng);
  });
}

/** The containers in the town itself, which its ammo budget and its homes' small finds are settled over. Bowls and the bus hold their own. */
const inTown = (sim: SimState) =>
  townContainers(sim.map).filter((container) => !container.upOrDown && container.kind !== 'bowl' && !isBooth(container));

/**
 * Brings the ammo put away to what the town can spare, so a lucky roll never shows up as bare
 * floors: spare boxes come out at random, and a short town gets more wherever a box would be found.
 */
export function settleContainerAmmo(sim: SimState, budget: number, worth: (loot: ContainerLoot) => number): void {
  const isAmmo = (loot: ContainerLoot | null): loot is ContainerLoot => loot !== null && isAmmoPickup(loot.type);
  const spaces = shuffle(sim.rng, [...inTown(sim)]);
  let total = spaces.map(({ id }) => sim.containers[id].loot).filter(isAmmo).reduce((sum, loot) => sum + worth(loot), 0);
  for (const { id } of spaces) {
    const state = sim.containers[id];
    const withinBudget = total <= budget;
    if (withinBudget) break;
    if (isAmmo(state.loot)) {
      total -= worth(state.loot);
      state.loot = null;
    }
  }
  for (const { id, stock } of spaces) {
    const state = sim.containers[id];
    const find = rollFind(sim, stock);
    const fits = state.loot === null && isAmmo(find) && total + worth(find) <= budget;
    if (fits) {
      state.loot = find;
      total += worth(find);
    }
  }
}

/** Nobody goes through a home for nothing: one that came up empty is left a small find. */
export function stockEmptyHomes(sim: SimState): void {
  const town = inTown(sim);
  const stocked = new Set(town.filter(({ id }) => sim.containers[id].loot).map((c) => c.building));
  const inHomes = town.filter((c) => CONTAINER_LOOT[c.buildingKind] === HOME);
  for (const { id, building } of shuffle(sim.rng, inHomes)) {
    if (stocked.has(building)) continue;
    stocked.add(building);
    sim.containers[id].loot = { type: pickWeighted(sim.rng, HOME_KEEPSAKES), rounds: 0 };
  }
}

/** An empty, shut container in this building, or null if it has none. */
export function containerInBuilding(sim: SimState, building: BuildingInstance, rng: Rng): ContainerState | null {
  const here = townContainers(sim.map).filter((each) => each.building === building.id && sim.containers[each.id].loot === null);
  return here.length > 0 ? sim.containers[pick(rng, here).id] : null;
}

/** All that is still shut away, for adding up the town's ammo. */
export function containerLoot(sim: SimState): ContainerLoot[] {
  return sim.containers.flatMap(({ loot }) => (loot ? [loot] : []));
}
