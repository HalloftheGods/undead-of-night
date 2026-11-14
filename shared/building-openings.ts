import { BACK_DOORS } from './building-plans.ts';
import {
  type BarricadeOpening,
  createBarricadeOpening,
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
/** How near a body must be to a window's gap, measured to the nearest point of it, to work it. A door has its zone instead. */
export const INTERACTION_REACH = 24;

/** The gap a door fills, as a box: the whole of a back door's depth, the wall's line either way for the rest. */
export function openingBox(opening: Pick<BarricadeOpening, 'x' | 'y' | 'w' | 'h' | 'facing'>): Box {
  if (opening.facing === 'north') return { x0: opening.x - opening.w / 2, y0: opening.y, x1: opening.x + opening.w / 2, y1: opening.y + opening.h };
  return { x0: opening.x - opening.w / 2, y0: opening.y - opening.h / 2, x1: opening.x + opening.w / 2, y1: opening.y + opening.h / 2 };
}

/** One row of the dotted zone around a door. */
export const DOOR_ZONE_ROW = 8;
/** A door is worked from four rows out, in front and behind, and no further. */
export const DOOR_ZONE_ROWS = 4;
/** And from two columns out to the left and right of the gap, and no further. */
export const DOOR_ZONE_COLUMNS = 2;

/**
 * The ground a door is worked from: the door's width and two columns more to its left and right, and four rows
 * out of the gap on each side of the wall, so the same on the front and the back, inside and out. Nothing past
 * those is in it. A window keeps its gap. The solid box (openingBox) is unchanged.
 */
export function interactionBox(opening: Pick<BarricadeOpening, 'type' | 'x' | 'y' | 'w' | 'h' | 'facing'>): Box {
  const gap = openingBox(opening);
  if (opening.type !== 'door') return gap;
  const depth = DOOR_ZONE_ROWS * DOOR_ZONE_ROW;
  const side = DOOR_ZONE_COLUMNS * DOOR_ZONE_ROW;
  return { x0: gap.x0 - side, x1: gap.x1 + side, y0: gap.y0 - depth, y1: gap.y1 + depth };
}

/** How far outside its interaction box a body may stand and still work an opening: a door's box is the whole zone. */
export function reachOf(opening: Pick<BarricadeOpening, 'type'>): number {
  return opening.type === 'door' ? 0 : INTERACTION_REACH;
}

/** Distance from a point to the nearest point of a box: 0 inside it. */
export function distanceToBox(box: Box, x: number, y: number): number {
  const dx = x - Math.max(box.x0, Math.min(x, box.x1));
  const dy = y - Math.max(box.y0, Math.min(y, box.y1));
  return Math.hypot(dx, dy);
}

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
  reach?: number,
  /** Whether there is a clear way from the body to this opening: no wall between them, so not through the side of a house or from another room. */
  clearTo: (opening: BarricadeOpening) => boolean = () => true,
): BarricadeOpening | null {
  let closest: BarricadeOpening | null = null;
  let closestDistSq = Infinity;

  for (const opening of openings) {
    const near = distanceToBox(interactionBox(opening), x, y);
    const distSq = near * near;
    const limit = reach ?? reachOf(opening);

    const inRange = distSq <= limit * limit && clearTo(opening);
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

  return [openingBox(opening)];
}

export {
  calculateDoorDamage,
  calculateDoorMaxHealth,
  createDoorOpening,
  damageDoorOpening,
  DOOR_BASE_HEALTH,
  DOOR_DAMAGE_PER_ZOMBIE_SEC,
  DOOR_MAX_HEALTH,
  DOOR_MAX_PLANKS,
  DOOR_SPLINTER_NOISE_RADIUS,
  toggleDoor,
  type DoorDamageResult,
} from './fortifications.ts';
