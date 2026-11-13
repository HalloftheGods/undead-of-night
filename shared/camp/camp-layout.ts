// Where everything in the camp stands. All of it is inside the smallest fence ring, so nothing moves when the camp grows.
// Pixels. A station's place is the bottom centre of its prop; its customers stand `CUSTOMER_GAP` below that.

import type { MerchantId, StationId } from '../home-protocol.ts';
import { TILE_SIZE } from '../map-protocol.ts';
import type { BuildingInstance } from '../map-protocol.ts';
import type { CampSize } from './camp-ring.ts';
import { ringRect } from './camp-ring.ts';

/** Customers stand this far below the bottom edge of what they are served from. */
export const CUSTOMER_GAP = 20;
export const STATION_RADIUS = 28;

/** The three big tents: the market along the north side, the workshop and the quarters side by side to the south. Top-left corners, on the tile grid. */
export const CAMP_BUILDINGS: readonly BuildingInstance[] = [
  { id: 'camp-market', kind: 'camp_market', x: 528, y: 288, variant: 0 },
  { id: 'camp-workshop', kind: 'camp_workshop', x: 528, y: 400, variant: 0 },
  { id: 'camp-quarters', kind: 'camp_quarters', x: 672, y: 400, variant: 0 },
];

/**
 * The candy shop in the market, the bench and the press in the workshop, the locker and the jukebox in the quarters.
 * The map board and the chest stand outside by the gate. The press keeps its place for when its screen lands.
 */
export const STATION_PLACES: Readonly<Record<Exclude<StationId, MerchantId>, { readonly x: number; readonly y: number }>> = {
  candy_shop: { x: 608, y: 320 },
  bench: { x: 560, y: 424 },
  press: { x: 624, y: 424 },
  locker: { x: 704, y: 424 },
  jukebox: { x: 768, y: 424 },
  chest: { x: 848, y: 456 },
  level_map: { x: 848, y: 312 },
};

/** Kept clear beside the map board for the Roster station (camp project 2). */
export const ROSTER_PLACE = { x: 784, y: 312 } as const;

/** Where each merchant stands when the camp is raised: in the market's four corners, clear of the candy shop's circle. */
export const MERCHANT_STANDS: Readonly<Record<MerchantId, { readonly x: number; readonly y: number }>> = {
  gunsmith: { x: 552, y: 304 },
  quartermaster: { x: 664, y: 304 },
  medic: { x: 552, y: 344 },
  powder: { x: 664, y: 344 },
};

/** In the open ground east of the market, between the tents and the gate. */
export const CAMPFIRE_PLACE = { x: 728, y: 348 } as const;
export const SPAWN_PLACE = { x: 736, y: 384 } as const;
/** The van, parked just inside the gate. */
export const VAN_PLACE = { x: 848, y: 400 } as const;

export const DISTRICT_PLACES = [
  { name: 'Market', x: 608, y: 344 },
  { name: 'Workshop', x: 592, y: 456 },
  { name: 'Quarters', x: 736, y: 456 },
  { name: 'Gate', x: 808, y: 384 },
] as const;

export interface FloorBox {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** The market tent's floor, where the merchants spend most of their time. */
const MARKET_STRIP: FloorBox = { x0: 542, y0: 300, x1: 674, y1: 356 };
/** The east edge of where a merchant wanders, short of the van. */
const ROAM_EAST = 800;

/** Where the merchants wander at a camp size: the market three times over, then the whole yard west of the van, two tiles in from the fence. */
export function merchantRoam(size: CampSize): readonly FloorBox[] {
  const rect = ringRect(size);
  const yard: FloorBox = { x0: (rect.col0 + 2) * TILE_SIZE, y0: (rect.row0 + 2) * TILE_SIZE, x1: ROAM_EAST, y1: (rect.row1 - 1) * TILE_SIZE };
  return [MARKET_STRIP, MARKET_STRIP, MARKET_STRIP, yard];
}
