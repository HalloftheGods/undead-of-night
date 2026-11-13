// Where everything in the camp stands. All of it is inside the smallest fence ring, so nothing moves when the camp grows.
// Pixels. A station's place is the bottom centre of its prop; its customers stand `CUSTOMER_GAP` below that.

import type { MerchantId, StationId } from '../home-protocol.ts';
import { TILE_SIZE } from '../map-protocol.ts';
import type { CampSize } from './camp-ring.ts';
import { ringRect } from './camp-ring.ts';

/** Customers stand this far below the bottom edge of what they are served from. */
export const CUSTOMER_GAP = 20;
export const STATION_RADIUS = 28;

/** The workshop down the west side, the long south row, and the map board by the gate. The press keeps a place for when its screen lands. */
export const STATION_PLACES: Readonly<Record<Exclude<StationId, MerchantId>, { readonly x: number; readonly y: number }>> = {
  bench: { x: 548, y: 370 },
  press: { x: 624, y: 370 },
  candy_shop: { x: 548, y: 450 },
  locker: { x: 624, y: 450 },
  jukebox: { x: 700, y: 450 },
  chest: { x: 776, y: 450 },
  level_map: { x: 848, y: 312 },
};

/** Kept clear beside the map board for the Roster station (camp project 2). */
export const ROSTER_PLACE = { x: 784, y: 312 } as const;

/** Where each merchant stands when the camp is raised: a line under the market awning on the north side. */
export const MERCHANT_STANDS: Readonly<Record<MerchantId, { readonly x: number; readonly y: number }>> = {
  gunsmith: { x: 552, y: 304 },
  quartermaster: { x: 616, y: 304 },
  medic: { x: 680, y: 304 },
  powder: { x: 744, y: 304 },
};

export const CAMPFIRE_PLACE = { x: 704, y: 388 } as const;
export const SPAWN_PLACE = { x: 668, y: 404 } as const;
/** The van, parked just inside the gate. */
export const VAN_PLACE = { x: 848, y: 400 } as const;

export const DISTRICT_PLACES = [
  { name: 'Market', x: 648, y: 304 },
  { name: 'Workshop', x: 560, y: 400 },
  { name: 'Quarters', x: 704, y: 420 },
  { name: 'Gate', x: 848, y: 368 },
] as const;

export interface FloorBox {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** The strip under the awning, where the merchants spend most of their time. */
const MARKET_STRIP: FloorBox = { x0: 528, y0: 292, x1: 800, y1: 336 };
/** The east edge of where a merchant wanders, short of the van. */
const ROAM_EAST = 800;

/** Where the merchants wander at a camp size: the market three times over, then the whole yard west of the van, two tiles in from the fence. */
export function merchantRoam(size: CampSize): readonly FloorBox[] {
  const rect = ringRect(size);
  const yard: FloorBox = { x0: (rect.col0 + 2) * TILE_SIZE, y0: (rect.row0 + 2) * TILE_SIZE, x1: ROAM_EAST, y1: (rect.row1 - 1) * TILE_SIZE };
  return [MARKET_STRIP, MARKET_STRIP, MARKET_STRIP, yard];
}
