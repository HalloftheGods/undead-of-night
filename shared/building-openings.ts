import { BACK_DOORS } from './building-plans.ts';
import {
  type BarricadeOpening,
  createBarricadeOpening,
  type OpeningFacing,
} from './fortifications.ts';
import {
  BUILDING_DEFS,
  type BuildingInstance,
  DOOR_WIDTH,
  type WorldMap,
} from './map-protocol.ts';
import { isStorey } from './storeys.ts';

import type { Box } from './world-query.ts';

const WINDOW_SIZE = 16;
const INTERACTION_REACH = 28;

export function getBuildingOpenings(building: BuildingInstance): BarricadeOpening[] {
  const isUpstairsOrCellar = isStorey(building);
  if (isUpstairsOrCellar) return [];

  const def = BUILDING_DEFS[building.kind];
  const openings: BarricadeOpening[] = [];

  // 1. South Front Door
  const doorCenterX = building.x + def.doorX;
  const doorY = building.y + def.h;
  openings.push(
    createBarricadeOpening(
      `${building.id}_door_front`,
      building.id,
      'door',
      doorCenterX,
      doorY,
      DOOR_WIDTH,
      16,
      'south'
    )
  );

  // 2. North Back Door (if defined)
  const backDoorOffset = BACK_DOORS[building.kind];
  const hasBackDoor = backDoorOffset !== undefined;
  if (hasBackDoor) {
    const backDoorCenterX = building.x + backDoorOffset;
    const backDoorY = building.y;
    openings.push(
      createBarricadeOpening(
        `${building.id}_door_back`,
        building.id,
        'door',
        backDoorCenterX,
        backDoorY,
        DOOR_WIDTH,
        16,
        'north'
      )
    );
  }

  // 3. South Wall Windows (flanking front door)
  const leftWindowX = building.x + Math.max(16, def.doorX - 32);
  openings.push(
    createBarricadeOpening(
      `${building.id}_win_s_left`,
      building.id,
      'window',
      leftWindowX,
      doorY,
      WINDOW_SIZE,
      16,
      'south'
    )
  );

  const rightWindowX = building.x + Math.min(def.w - 16, def.doorX + 32);
  openings.push(
    createBarricadeOpening(
      `${building.id}_win_s_right`,
      building.id,
      'window',
      rightWindowX,
      doorY,
      WINDOW_SIZE,
      16,
      'south'
    )
  );

  // 4. North Wall Window (opposite back door)
  const northWindowOffset = hasBackDoor && backDoorOffset < def.w / 2 ? def.w - 32 : 32;
  openings.push(
    createBarricadeOpening(
      `${building.id}_win_n`,
      building.id,
      'window',
      building.x + northWindowOffset,
      building.y,
      WINDOW_SIZE,
      16,
      'north'
    )
  );

  return openings;
}

export function deriveMapOpenings(map: WorldMap): BarricadeOpening[] {
  const result: BarricadeOpening[] = [];
  for (const building of map.buildings) {
    const openings = getBuildingOpenings(building);
    result.push(...openings);
  }
  return result;
}

export function findNearbyOpening(
  openings: readonly BarricadeOpening[],
  x: number,
  y: number,
  reach: number = INTERACTION_REACH
): BarricadeOpening | null {
  const maxDistSq = reach * reach;
  let closest: BarricadeOpening | null = null;
  let closestDistSq = Infinity;

  for (const opening of openings) {
    const dx = opening.x - x;
    const dy = opening.y - y;
    const distSq = dx * dx + dy * dy;

    const inRange = distSq <= maxDistSq;
    const isCloser = distSq < closestDistSq;
    const isEligible = inRange && isCloser;

    if (isEligible) {
      closestDistSq = distSq;
      closest = opening;
    }
  }

  return closest;
}

export function getOpeningSolidBoxes(opening: BarricadeOpening): Box[] {
  const hasPlanks = opening.planks > 0;
  const isIntactWindow = opening.type === 'window' && !opening.isBroken;
  const isSolid = hasPlanks || isIntactWindow;

  if (!isSolid) return [];

  const halfW = opening.w / 2;
  const halfH = opening.h / 2;
  return [
    {
      x0: opening.x - halfW,
      y0: opening.y - halfH,
      x1: opening.x + halfW,
      y1: opening.y + halfH,
    },
  ];
}
