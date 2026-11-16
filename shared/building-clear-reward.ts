import type { Container, ContainerKind } from './containers.ts';
import type { BuildingInstance, EntityId, WorldMap } from './protocol.ts';
import { SEWERS_OF } from './map-protocol.ts';

/**
 * Base XP awarded per container type when a building is 100% cleared.
 * Longer search times give more XP, keeping combat kills as the primary XP earner.
 */
export const CONTAINER_CLEAR_XP: Readonly<Record<ContainerKind, number>> = {
  drawer: 4,
  bowl: 4,
  desk: 4,
  cabinet: 5,
  shelf: 5,
  box: 5,
  fridge: 6,
  booth: 6,
  dumpster: 6,
  locker: 8,
  car: 8,
};

export interface PlayerClearShare {
  readonly playerId: EntityId;
  readonly points: number;
  readonly containers: number;
}

/**
 * Calculates the total XP for knocking over a building from its containers.
 */
export function buildingTotalClearXp(containers: readonly Container[]): number {
  let sum = 0;
  for (const c of containers) {
    sum += CONTAINER_CLEAR_XP[c.kind] ?? 4;
  }
  return sum;
}

/**
 * Splits building clear XP proportionally by the number of containers searched by each player.
 * Sum of shares equals total points.
 */
export function splitBuildingClearXp(
  totalXp: number,
  containerSearchers: readonly EntityId[],
): readonly PlayerClearShare[] {
  const hasNoSearchers = containerSearchers.length === 0;
  if (hasNoSearchers) return [];

  const counts = new Map<EntityId, number>();
  for (const id of containerSearchers) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const total = containerSearchers.length;
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const shares: PlayerClearShare[] = [];
  let allocated = 0;

  for (let i = 0; i < entries.length; i++) {
    const [playerId, count] = entries[i];
    const isLast = i === entries.length - 1;
    const points = isLast ? Math.max(0, totalXp - allocated) : Math.round((totalXp * count) / total);
    allocated += points;
    shares.push({ playerId, points, containers: count });
  }

  return shares;
}

/**
 * Resolves a building instance to its root surface building ID (for storeys).
 */
export function rootBuildingIdOf(building: Pick<BuildingInstance, 'id' | 'of'>): string {
  const isStoreyOfHouse = building.of !== undefined && building.of !== SEWERS_OF;
  return isStoreyOfHouse ? building.of! : building.id;
}

/**
 * Builds a map from root building ID to all containers inside it, including storeys.
 */
export function mapRootBuildingContainers(
  map: WorldMap,
  containers: readonly Container[],
): ReadonlyMap<string, readonly Container[]> {
  const buildingById = new Map<string, BuildingInstance>();
  for (const b of map.buildings) {
    buildingById.set(b.id, b);
  }

  const grouped = new Map<string, Container[]>();
  for (const c of containers) {
    const buildingId = c.building;
    const hasBuilding = buildingId !== undefined;
    if (!hasBuilding) continue;

    const building = buildingById.get(buildingId);
    const rootId = building ? rootBuildingIdOf(building) : buildingId;

    const list = grouped.get(rootId);
    if (list) {
      list.push(c);
    } else {
      grouped.set(rootId, [c]);
    }
  }

  return grouped;
}
