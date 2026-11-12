// What the team walked out on: supplies still lying in a building somebody has been inside. The server
// keeps the list, because the pickups far from a player never reach their client, so the whole team's
// map can mark the same houses.

import { AMMO_PICKUPS } from './constants.ts';
import { townContainers } from './containers.ts';
import type { ContainerState } from './containers.ts';
import { FORTIFICATION_TYPES } from './events.ts';
import { BUILDING_DEFS } from './protocol.ts';
import type { BuildingInstance, WorldMap } from './protocol.ts';
import type { PickupState, SimState } from './sim-state.ts';
import { buildingAt } from './world-query.ts';

/** How the map sorts what was left: the first three are what a player comes back for. */
export const SUPPLY_KINDS = ['med', 'ammo', 'weapon', 'build', 'food', 'gear'] as const;
export type SupplyKind = (typeof SUPPLY_KINDS)[number];

/**
 * One place with something still in it, and how many of each kind. A kind with none is left off. A place is a
 * building, or for a container out in the open (a car, a dumpster) the spot `at` where it stands.
 */
export interface LeftoverView {
  readonly building?: string;
  readonly at?: { readonly x: number; readonly y: number };
  readonly supplies: Partial<Record<SupplyKind, number>>;
  readonly clue?: boolean;
  readonly clueItem?: string;
  readonly clueAt?: { readonly x: number; readonly y: number };
}

const MED_PICKUPS: ReadonlySet<string> = new Set(['bandage', 'medkit', 'disinfectant', 'antibiotics']);
const WEAPON_PICKUPS: ReadonlySet<string> = new Set(['carbine', 'shotgun', 'knife']);
const BUILD_PICKUPS: ReadonlySet<string> = new Set(FORTIFICATION_TYPES);
const FOOD_PICKUPS: ReadonlySet<string> = new Set(['canned_food', 'water_bottle', 'bottle', 'firework', 'fountain']);

/** Sorts a pickup or a container find; a name nothing here knows is gear. */
export function supplyKindOf(type: string): SupplyKind {
  const isBuild = BUILD_PICKUPS.has(type);
  if (isBuild) return 'build';
  const isFood = FOOD_PICKUPS.has(type);
  if (isFood) return 'food';
  const isMed = MED_PICKUPS.has(type);
  if (isMed) return 'med';
  const isAmmo = Object.hasOwn(AMMO_PICKUPS, type);
  if (isAmmo) return 'ammo';
  const isWeapon = WEAPON_PICKUPS.has(type);
  return isWeapon ? 'weapon' : 'gear';
}

/** The town building a groundId above or below belongs to, or the building itself. */
export function groundBuildingId(building: BuildingInstance): string {
  return building.of ?? building.id;
}

/** Notes the building each player stands in, by its ground groundId. Cleared with the town. */
export function noteEntered(sim: SimState): void {
  for (const p of sim.players) {
    const isOutside = p.indoors === null || p.status === 'dead';
    if (isOutside) continue;
    const building = sim.map.buildings.find((candidate) => candidate.id === p.indoors);
    if (building) sim.entered.add(groundBuildingId(building));
  }
}

/** Something that rots away, such as a kill drop, is not worth a trip back. */
const isLasting = (item: PickupState): boolean => item.ttl === null;

/** What each searched container still holds: a building's go on its entry, an open-air one's at its own spot. */
function containerLeftovers(
  map: WorldMap,
  containers: readonly ContainerState[],
  byBuilding: Map<string, Partial<Record<SupplyKind, number>>>,
): LeftoverView[] {
  const outdoors: LeftoverView[] = [];
  for (const [id, container] of townContainers(map).entries()) {
    const items = containers[id]?.opened ? containers[id].items ?? [] : [];
    if (items.length === 0) continue;
    const supplies: Partial<Record<SupplyKind, number>> = {};
    for (const item of items) {
      const kind = supplyKindOf(item.type);
      supplies[kind] = (supplies[kind] ?? 0) + 1;
    }
    const home = container.building ? map.buildings.find((candidate) => candidate.id === container.building) : undefined;
    if (!home) {
      outdoors.push({ at: { x: Math.round(container.x), y: Math.round(container.y) }, supplies });
      continue;
    }
    const groundId = groundBuildingId(home);
    const sum = byBuilding.get(groundId) ?? {};
    for (const [kind, count] of Object.entries(supplies) as [SupplyKind, number][]) sum[kind] = (sum[kind] ?? 0) + count;
    byBuilding.set(groundId, sum);
  }
  return outdoors;
}

export function leftoversOf(
  map: WorldMap,
  pickups: readonly PickupState[],
  entered: ReadonlySet<string>,
  clues?: ReadonlyMap<string, string> | ReadonlySet<string>,
  containers: readonly ContainerState[] = [],
): LeftoverView[] {
  const byBuilding = new Map<string, Partial<Record<SupplyKind, number>>>();
  for (const item of pickups) {
    if (!isLasting(item)) continue;
    const building = buildingAt(map, item.x, item.y);
    if (!building) continue;
    const id = groundBuildingId(building);
    const isUnvisited = !entered.has(id);
    if (isUnvisited) continue;
    const supplies = byBuilding.get(id) ?? {};
    const kind = supplyKindOf(item.type);
    supplies[kind] = (supplies[kind] ?? 0) + 1;
    byBuilding.set(id, supplies);
  }
  const outdoors = containerLeftovers(map, containers, byBuilding);

  if (clues) {
    const clueBuildingIds = clues instanceof Map ? clues.keys() : clues;
    for (const buildingId of clueBuildingIds) {
      const alreadyTracked = byBuilding.has(buildingId);
      if (!alreadyTracked) byBuilding.set(buildingId, {});
    }
  }

  const indoors = [...byBuilding].flatMap(([building, supplies]) => {
    const hasClue = clues?.has(building) ?? false;
    const clueItem = clues instanceof Map ? clues.get(building) : undefined;
    if (!hasClue) {
      const hasSupplies = Object.keys(supplies).length > 0;
      return hasSupplies ? [{ building, supplies }] : [];
    }

    const matchesBuildingPickup = (p: PickupState): boolean => {
      if (!isLasting(p)) return false;
      const b = buildingAt(map, p.x, p.y);
      return b !== null && groundBuildingId(b) === building;
    };
    const buildingPickups = pickups.filter(matchesBuildingPickup);
    const buildingContainers = townContainers(map).filter((c) => {
      const home = c.building ? map.buildings.find((b) => b.id === c.building) : undefined;
      return home !== undefined && groundBuildingId(home) === building;
    });
    const populatedContainers = buildingContainers.flatMap((c) => {
      const state = containers[c.id];
      if (!state) return [];
      const itemTypes = state.opened
        ? (state.items ?? []).map((it) => it.type)
        : (state.loot ? [state.loot.type] : []);
      return itemTypes.map((type) => ({
        x: Math.round(c.x),
        y: Math.round(c.y),
        type,
        kind: supplyKindOf(type),
      }));
    });

    interface RevealedObject {
      x: number;
      y: number;
      type: string;
      kind: SupplyKind;
    }
    const objects: RevealedObject[] = [
      ...buildingPickups.map((p) => ({
        x: Math.round(p.x),
        y: Math.round(p.y),
        type: p.type,
        kind: supplyKindOf(p.type),
      })),
      ...populatedContainers,
    ];

    const hasNoObjects = objects.length === 0;
    if (hasNoObjects) {
      if (clues instanceof Map) (clues as Map<string, string>).delete(building);
      else if (clues instanceof Set) (clues as Set<string>).delete(building);
      const hasSupplies = Object.keys(supplies).length > 0;
      return hasSupplies ? [{ building, supplies }] : [];
    }

    const clueSupplies: Partial<Record<SupplyKind, number>> = {};
    for (const obj of objects) {
      clueSupplies[obj.kind] = (clueSupplies[obj.kind] ?? 0) + 1;
    }

    const primary = (clueItem ? objects.find((o) => o.type === clueItem) : undefined) ?? objects[0];
    const others = objects.filter((o) => o !== primary);

    const primaryView: LeftoverView = {
      building,
      supplies: clueSupplies,
      clue: true,
      ...(clueItem !== undefined || clues instanceof Map ? { clueItem: primary.type } : {}),
      clueAt: { x: primary.x, y: primary.y },
    };

    const otherViews: LeftoverView[] = others.map((o) => ({
      building,
      at: { x: o.x, y: o.y },
      supplies: { [o.kind]: 1 },
      clue: true,
      clueItem: o.type,
      clueAt: { x: o.x, y: o.y },
    }));

    return [primaryView, ...otherViews];
  });
  return [...indoors, ...outdoors];
}

/** Left off while nothing is left behind, so a snapshot then is what it always was. */
export function leftoversField(sim: SimState): { leftovers?: LeftoverView[] } {
  const hasNoVisits = sim.entered.size === 0 && !sim.containers.some((state) => state.opened) && (sim.clues?.size ?? 0) === 0;
  if (hasNoVisits) return {};
  const leftovers = leftoversOf(sim.map, sim.pickups, sim.entered, sim.clues, sim.containers);
  return leftovers.length > 0 ? { leftovers } : {};
}
