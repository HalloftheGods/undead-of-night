// What the team walked out on: supplies still lying in a building somebody has been inside. The server
// keeps the list, because the pickups far from a player never reach their client, so the whole team's
// map can mark the same houses.

import { AMMO_PICKUPS } from './constants.ts';
import type { BuildingInstance, PickupType, WorldMap } from './protocol.ts';
import type { PickupState, SimState } from './sim-state.ts';
import { buildingAt } from './world-query.ts';

/** How the map sorts what was left: the first three are what a player comes back for. */
export const SUPPLY_KINDS = ['med', 'ammo', 'weapon', 'gear'] as const;
export type SupplyKind = (typeof SUPPLY_KINDS)[number];

/** One building with something still in it, and how many of each kind. A kind with none is left off. */
export interface LeftoverView {
  readonly building: string;
  readonly supplies: Partial<Record<SupplyKind, number>>;
}

const MED_PICKUPS: ReadonlySet<PickupType> = new Set(['bandage', 'medkit']);
const WEAPON_PICKUPS: ReadonlySet<PickupType> = new Set(['carbine', 'shotgun', 'knife']);

export function supplyKindOf(type: PickupType): SupplyKind {
  const isMed = MED_PICKUPS.has(type);
  if (isMed) return 'med';
  const isAmmo = type in AMMO_PICKUPS;
  if (isAmmo) return 'ammo';
  const isWeapon = WEAPON_PICKUPS.has(type);
  return isWeapon ? 'weapon' : 'gear';
}

/** The town building a floor above or below belongs to, or the building itself. */
export function groundBuildingId(building: BuildingInstance): string {
  return building.of ?? building.id;
}

/** Notes the building each player stands in, by its ground floor. Cleared with the town. */
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

export function leftoversOf(map: WorldMap, pickups: readonly PickupState[], entered: ReadonlySet<string>): LeftoverView[] {
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
  return [...byBuilding].map(([building, supplies]) => ({ building, supplies }));
}

/** Left off while nothing is left behind, so a snapshot then is what it always was. */
export function leftoversField(sim: SimState): { leftovers?: LeftoverView[] } {
  const hasNoVisits = sim.entered.size === 0;
  if (hasNoVisits) return {};
  const leftovers = leftoversOf(sim.map, sim.pickups, sim.entered);
  return leftovers.length > 0 ? { leftovers } : {};
}
