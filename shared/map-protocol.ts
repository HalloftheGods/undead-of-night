// The world map half of the protocol: tiles, props, buildings and the map every client is sent.
// Pure data and types only, like protocol.ts, which re-exports all of it.

import type { Point } from './flow-field.ts';
import type { Station } from './home-protocol.ts';
import type { Box } from './world-query.ts';

export const TILE_SIZE = 16;

export const TILE_KINDS = [
  'asphalt',
  'asphalt_cracked',
  'lane_h',
  'lane_v',
  'crosswalk_h',
  'crosswalk_v',
  'parking_line',
  'sidewalk',
  'curb_n',
  'curb_s',
  'curb_e',
  'curb_w',
  'grass',
  'dirt',
  /** Shallow flood water, drifted snow, cinders and toxic sludge: ground a biome lays over grass, dirt and road. All walkable. */
  'water',
  'snow',
  'ash',
  'sludge',
  'floor_wood',
  'floor_tile',
  'floor_concrete',
  'floor_carpet',
  'bunker_wall',
  /** The dark between the floors above and below the town, where nobody goes. */
  'void',
] as const;
export type TileKind = (typeof TILE_KINDS)[number];

/**
 * Footprints in world pixels. A prop instance's x,y is the centre of the bottom
 * edge of its footprint, so the solid box is [x-w/2, y-h, x+w/2, y]. Art may rise
 * above the footprint (building fronts, tree crowns) and is y-sorted on prop.y.
 * Footprint h of 0 means walk-through scenery.
 */
export const PROP_DEFS = {
  car_sedan_h: { w: 44, h: 18 },
  car_sedan_v: { w: 20, h: 40 },
  car_wreck_h: { w: 44, h: 18 },
  van_h: { w: 52, h: 22 },
  dumpster: { w: 30, h: 14 },
  crate_stack: { w: 20, h: 14 },
  barrier: { w: 32, h: 8 },
  sandbags: { w: 36, h: 10 },
  tree: { w: 12, h: 8 },
  fire_barrel: { w: 12, h: 8 },
  street_lamp: { w: 6, h: 4 },
  hydrant: { w: 6, h: 4 },
  /** Evergreen: a narrow trunk under a dark spire. */
  pine: { w: 10, h: 6 },
  /** Saguaro: solid, but thin enough to walk round. */
  cactus: { w: 8, h: 6 },
  dead_tree: { w: 10, h: 6 },
  bush: { w: 0, h: 0 },
  /** Dry scrub and tumbleweed: walk-through, like bush. */
  scrub: { w: 0, h: 0 },
  /** Marsh reeds and cattails: walk-through. */
  reeds: { w: 0, h: 0 },
  /** A giant fungus: solid, for the blighted and infested towns. */
  fungus: { w: 10, h: 6 },
  rubble: { w: 0, h: 0 },
  fence_h: { w: 32, h: 6 },
  fence_v: { w: 6, h: 32 },
  gas_pump: { w: 12, h: 8 },
  shelf: { w: 32, h: 10 },
  counter: { w: 48, h: 12 },
  table: { w: 24, h: 14 },
  sofa: { w: 36, h: 14 },
  bed: { w: 24, h: 32 },
  locker: { w: 16, h: 8 },
  fridge: { w: 16, h: 8 },
  workbench: { w: 40, h: 12 },
  forge: { w: 40, h: 12 },
  level_map: { w: 24, h: 14 },
  jukebox: { w: 20, h: 8 },
  gunsmith: { w: 12, h: 8 },
  quartermaster: { w: 12, h: 8 },
  medic: { w: 12, h: 8 },
  powder: { w: 12, h: 8 },
  /** Set into the hall's west wall, its footprint all rock, so nothing walks differently for it. */
  blast_door: { w: 16, h: 48 },
  chest: { w: 16, h: 10 },
} as const;
export type PropKind = keyof typeof PROP_DEFS;
export const PROP_KINDS = Object.keys(PROP_DEFS) as PropKind[];

/**
 * Enterable buildings. w,h is the footprint in world pixels (multiples of TILE_SIZE),
 * walls included. doorX is the door's centre measured from the footprint's left edge,
 * always on the south wall, and DOOR_WIDTH wide so it lines up with whole tiles.
 */
export const DOOR_WIDTH = 32;
export const WALL_THICKNESS = 6;
export const BUILDING_DEFS = {
  pharmacy: { label: 'Pharmacy', w: 160, h: 112, doorX: 80, floor: 'floor_tile' },
  clinic: { label: 'Clinic', w: 192, h: 128, doorX: 96, floor: 'floor_tile' },
  police: { label: 'Police Station', w: 224, h: 144, doorX: 112, floor: 'floor_concrete' },
  gun_shop: { label: 'Gun Shop', w: 144, h: 112, doorX: 48, floor: 'floor_wood' },
  grocery: { label: 'Grocery', w: 208, h: 128, doorX: 64, floor: 'floor_tile' },
  discount: { label: 'S.O.S. Discount', w: 176, h: 112, doorX: 64, floor: 'floor_tile' },
  diner: { label: 'Diner', w: 160, h: 96, doorX: 112, floor: 'floor_tile' },
  garage: { label: 'Auto Garage', w: 176, h: 112, doorX: 48, floor: 'floor_concrete' },
  warehouse: { label: 'Warehouse', w: 240, h: 144, doorX: 192, floor: 'floor_concrete' },
  house: { label: 'House', w: 112, h: 96, doorX: 48, floor: 'floor_wood' },
  apartment: { label: 'Apartments', w: 160, h: 128, doorX: 80, floor: 'floor_carpet' },
  // A floor above or below a house, the same size as it. Its doorX only keeps loot off the strip a door would have.
  upstairs: { label: 'Upstairs', w: 112, h: 96, doorX: 48, floor: 'floor_carpet' },
  cellar: { label: 'Cellar', w: 112, h: 96, doorX: 48, floor: 'floor_concrete' },
  // The second floor of an apartment block: two more flats off the same hall.
  apartment_upstairs: { label: 'Upstairs', w: 160, h: 128, doorX: 80, floor: 'floor_carpet' },
} as const;
export type BuildingKind = keyof typeof BUILDING_DEFS;
export const BUILDING_KINDS = Object.keys(BUILDING_DEFS) as BuildingKind[];

export interface BuildingInstance {
  readonly id: string;
  readonly kind: BuildingKind;
  /** Top-left corner of the footprint, on the tile grid. */
  readonly x: number;
  readonly y: number;
  /** Picks a facade from the art's variants. */
  readonly variant: number;
  /** For a floor above or below, the building it belongs to: its stairs come out in that building. */
  readonly of?: string;
}

/** A named part of town, for the map screen. */
export interface District {
  readonly name: string;
  readonly x: number;
  readonly y: number;
}

export interface PropInstance {
  readonly kind: PropKind;
  readonly x: number;
  readonly y: number;
}

export interface MapLight {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** CSS colour. */
  readonly color: string;
  readonly flicker: boolean;
}

export interface WorldMap {
  readonly seed: number;
  /** World size in pixels, a multiple of TILE_SIZE. */
  readonly width: number;
  readonly height: number;
  readonly cols: number;
  readonly rows: number;
  /** cols*rows indices into TILE_KINDS, row-major. */
  readonly tiles: Uint8Array;
  readonly props: readonly PropInstance[];
  readonly buildings: readonly BuildingInstance[];
  readonly districts: readonly District[];
  readonly lights: readonly MapLight[];
  /** Open ground for players to start on. */
  readonly spawn: { readonly x: number; readonly y: number };
  /** Solids that are not buildings. Set, these are every wall there is. */
  readonly walls?: readonly Box[];
  /** Where the van stands, when the map says so rather than the town's walk. */
  readonly exit?: Point;
  /** What can be walked up to and opened. */
  readonly stations?: readonly Station[];
  /** Rows of the town itself. Below them lie the floors above and below its houses, reached only by stairs. */
  readonly townRows?: number;
}
