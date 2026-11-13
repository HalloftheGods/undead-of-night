// Home: an open-air camp inside a scrap fence, with wilderness round it. One map of one size; the fence ring sits further out as the camp grows.
// The fence's sections come first in `props`, in ring order, so section `i` is `props[i]` and a fallen one is lifted by that index.

import { CAMP_COLS, CAMP_EAST_COL, CAMP_ROWS, GATE_ROWS, fenceSections, ringRect } from './camp/camp-ring.ts';
import type { CampSize } from './camp/camp-ring.ts';
import { CAMPFIRE_PLACE, CUSTOMER_GAP, DISTRICT_PLACES, MERCHANT_STANDS, SPAWN_PLACE, STATION_PLACES, STATION_RADIUS, VAN_PLACE, merchantRoam } from './camp/camp-layout.ts';
import { campScenery, wilderness } from './camp/camp-scenery.ts';
import { BUNKER_SEED, STATION_IDS, isMerchantId } from './home-protocol.ts';
import type { MerchantId, Station, StationId } from './home-protocol.ts';
import { TILE_KINDS, TILE_SIZE } from './protocol.ts';
import type { MapLight, PropInstance, PropKind, WorldMap } from './protocol.ts';

export type { FloorBox } from './camp/camp-layout.ts';
export { merchantRoam };

const WIDTH = CAMP_COLS * TILE_SIZE;
const HEIGHT = CAMP_ROWS * TILE_SIZE;

const GRASS = TILE_KINDS.indexOf('grass');
const DIRT = TILE_KINDS.indexOf('dirt');

type StandingId = Exclude<StationId, MerchantId>;

const STATION_PROPS: Record<StandingId, PropKind> = {
  bench: 'workbench',
  candy_shop: 'candy_shop',
  locker: 'locker',
  level_map: 'level_map',
  jukebox: 'jukebox',
  chest: 'chest',
  press: 'press',
};

/** Where the horde comes in until the breach picks fence sections (#7547): open ground inside the smallest ring's west fence. */
export const BLAST_DOOR_SPOT = { x: 530, y: 412 } as const;
/** Where a held overrun's chest stands, on the south row, clear of every station's circle. */
export const CHEST_SPOT = STATION_PLACES.chest;

const FIRE_LIGHT = '#ffb066';
const FIRE_RADIUS = 220;
const LANTERN_LIGHT = '#ffd9a0';
const LANTERN_RADIUS = 90;

/**
 * The chest stands only while a player's chest is unopened, so the map leaves it out and the overrun puts it in reach.
 * The press stays off the map until its screen is built (#7244 lands it last). The merchants walk, so their circles go with them.
 */
const UNBUILT: ReadonlySet<StationId> = new Set<StationId>(['chest', 'press']);
const isStanding = (id: StationId): id is StandingId => !UNBUILT.has(id) && !isMerchantId(id);
const STANDING_IDS = STATION_IDS.filter(isStanding);

/** Grass everywhere, worn to dirt inside the fence and along the track from the gate to the map's east edge. */
function groundOf(size: CampSize): Uint8Array {
  const tiles = new Uint8Array(CAMP_COLS * CAMP_ROWS).fill(GRASS);
  const rect = ringRect(size);
  for (let row = rect.row0; row <= rect.row1; row++) tiles.fill(DIRT, row * CAMP_COLS + rect.col0, row * CAMP_COLS + rect.col1 + 1);
  for (let row = GATE_ROWS.top; row <= GATE_ROWS.bottom; row++) tiles.fill(DIRT, row * CAMP_COLS + CAMP_EAST_COL, (row + 1) * CAMP_COLS);
  return tiles;
}

function stationOf(id: StandingId): Station {
  return { id, x: STATION_PLACES[id].x, y: STATION_PLACES[id].y + CUSTOMER_GAP, radius: STATION_RADIUS };
}

/** How near a merchant a customer stands to open their shop: the same circle as a station's, centred on them. */
export const MERCHANT_REACH = STATION_RADIUS;

/** Where each merchant stands when the camp is first raised: a line under the market awning. */
export const MERCHANT_STARTS: Readonly<Record<MerchantId, { readonly x: number; readonly y: number }>> = MERCHANT_STANDS;

/** The chest's circle, for the overrun to put in reach while a chest is unopened. */
export const CHEST_STATION: Station = stationOf('chest');

function lightsOf(scenery: readonly PropInstance[]): MapLight[] {
  const lanterns = scenery.filter((prop) => prop.kind === 'lantern');
  return [
    { x: CAMPFIRE_PLACE.x, y: CAMPFIRE_PLACE.y - 6, radius: FIRE_RADIUS, color: FIRE_LIGHT, flicker: true },
    ...lanterns.map((lantern) => ({ x: lantern.x, y: lantern.y - 14, radius: LANTERN_RADIUS, color: LANTERN_LIGHT, flicker: false })),
  ];
}

/** The camp at a size. The same size always yields the same map, on the server and every client. */
export function generateBunkerMap(size: CampSize = 1): WorldMap {
  const sections = fenceSections(size);
  const fence = sections.map((section): PropInstance => ({ kind: section.kind, x: section.x, y: section.y }));
  const stations = STANDING_IDS.map((id): PropInstance => ({ kind: STATION_PROPS[id], ...STATION_PLACES[id] }));
  const scenery = campScenery(size);
  return {
    seed: BUNKER_SEED,
    width: WIDTH,
    height: HEIGHT,
    cols: CAMP_COLS,
    rows: CAMP_ROWS,
    tiles: groundOf(size),
    props: [...fence, ...stations, ...scenery, ...wilderness()],
    buildings: [],
    districts: DISTRICT_PLACES.map((place) => ({ ...place })),
    lights: lightsOf(scenery),
    spawn: { ...SPAWN_PLACE },
    walls: [],
    exit: { ...VAN_PLACE },
    stations: STANDING_IDS.map(stationOf),
    camp: { size, sections },
  };
}
