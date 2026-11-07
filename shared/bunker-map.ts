// The bunker's map: a market hall on the north side, a workshop and quarters below it, and the garage along the east wall.
// A tile plan carved out of solid rock, so the walls, the wall tiles and the rooms all come from the same few rectangles.

import { BUNKER_SEED, MERCHANT_IDS, STATION_IDS, isMerchantId } from './home-protocol.ts';
import type { Station, StationId } from './home-protocol.ts';
import { TILE_KINDS, TILE_SIZE } from './protocol.ts';
import type { PropInstance, PropKind, WorldMap } from './protocol.ts';
import type { Box } from './world-query.ts';

const COLS = 40;
const ROWS = 24;
const WIDTH = COLS * TILE_SIZE;
const HEIGHT = ROWS * TILE_SIZE;

const FLOOR = TILE_KINDS.indexOf('floor_concrete');
const MARKET_FLOOR = TILE_KINDS.indexOf('floor_tile');
const WALL = TILE_KINDS.indexOf('bunker_wall');

/** Inclusive tile bounds. */
interface TileArea {
  readonly col0: number;
  readonly row0: number;
  readonly col1: number;
  readonly row1: number;
}

interface Room extends TileArea {
  readonly name: string;
}

const HALL: Room = { name: 'Market hall', col0: 1, row0: 1, col1: 24, row1: 10 };
const WORKSHOP: Room = { name: 'Workshop', col0: 1, row0: 12, col1: 11, row1: 22 };
const QUARTERS: Room = { name: 'Quarters', col0: 13, row0: 12, col1: 24, row1: 22 };
const GARAGE: Room = { name: 'Garage', col0: 26, row0: 1, col1: 38, row1: 22 };
const ROOMS: readonly Room[] = [HALL, WORKSHOP, QUARTERS, GARAGE];

/** Three or four tiles wide, so a pair of survivors passes each other in a doorway. */
const DOORS: readonly TileArea[] = [
  { col0: 5, row0: 11, col1: 7, row1: 11 },
  { col0: 17, row0: 11, col1: 19, row1: 11 },
  { col0: 12, row0: 16, col1: 12, row1: 18 },
  { col0: 25, row0: 4, col1: 25, row1: 7 },
  { col0: 25, row0: 16, col1: 25, row1: 18 },
];

const STATION_PROPS: Record<StationId, PropKind> = {
  bench: 'workbench',
  forge: 'forge',
  locker: 'locker',
  level_map: 'level_map',
  jukebox: 'jukebox',
  gunsmith: 'gunsmith',
  quartermaster: 'quartermaster',
  medic: 'medic',
  powder: 'powder',
  chest: 'chest',
};

/** The overrun's door, in the hall's west wall (tile column 0, rows 4 to 6), as far from the garage as the hall goes. */
const BLAST_DOOR: PropInstance = { kind: 'blast_door', x: TILE_SIZE / 2, y: 7 * TILE_SIZE };
/** Where the horde comes in: hall floor just inside the blast door. */
export const BLAST_DOOR_SPOT = { x: 2 * TILE_SIZE, y: 5.5 * TILE_SIZE } as const;
/** Where a held overrun's chest stands, in the hall's south-west corner, clear of every station's circle. */
export const CHEST_SPOT = { x: 40, y: 144 } as const;

/** Where each station's prop stands: the bottom centre of its footprint. A merchant stands behind a counter just south of it. */
const STATION_PLACES: Record<StationId, { x: number; y: number }> = {
  bench: { x: 48, y: 224 },
  forge: { x: 144, y: 224 },
  locker: { x: 240, y: 224 },
  level_map: { x: 528, y: 48 },
  jukebox: { x: 336, y: 224 },
  gunsmith: { x: 80, y: 40 },
  quartermaster: { x: 176, y: 40 },
  medic: { x: 272, y: 40 },
  powder: { x: 368, y: 40 },
  chest: CHEST_SPOT,
};

const COUNTER_Y = 56;
/** Customers stand this far below the bottom edge of what they are served from. */
const CUSTOMER_GAP = 20;
const STATION_RADIUS = 28;
const WARM_LAMP = '#ffb066';
const LAMP_RADIUS = 200;
const EXIT_SPOT = { x: 560, y: 350 };
const SPAWN_SPOT = { x: 304, y: 280 };

/** The chest stands only while a player's chest is unopened, so the map leaves it out and the overrun puts it in reach. */
const isStanding = (id: StationId): boolean => id !== 'chest';
const STANDING_IDS = STATION_IDS.filter(isStanding);

const centreOf = (room: Room): { x: number; y: number } => ({
  x: ((room.col0 + room.col1 + 1) / 2) * TILE_SIZE,
  y: ((room.row0 + room.row1 + 1) / 2) * TILE_SIZE,
});

/** Rock, then the rooms cut into it, then the doors. */
function carve(): Uint8Array {
  const tiles = new Uint8Array(COLS * ROWS).fill(WALL);
  const cut = (area: TileArea, kind: number): void => {
    for (let row = area.row0; row <= area.row1; row++) {
      for (let col = area.col0; col <= area.col1; col++) tiles[row * COLS + col] = kind;
    }
  };
  for (const room of ROOMS) cut(room, room === HALL ? MARKET_FLOOR : FLOOR);
  for (const door of DOORS) cut(door, FLOOR);
  return tiles;
}

function wallRuns(tiles: Uint8Array): Box[] {
  const runs: Box[] = [];
  for (let row = 0; row < ROWS; row++) {
    let start = -1;
    for (let col = 0; col <= COLS; col++) {
      const solid = col < COLS && tiles[row * COLS + col] === WALL;
      const startsWallRun = solid && start < 0;
      if (startsWallRun) start = col;
      const endsWallRun = !solid && start >= 0;
      if (endsWallRun) {
        runs.push({ x0: start * TILE_SIZE, y0: row * TILE_SIZE, x1: col * TILE_SIZE, y1: (row + 1) * TILE_SIZE });
        start = -1;
      }
    }
  }
  return runs;
}

/** Runs that sit directly on one another with the same width become one box. */
function stackRuns(runs: readonly Box[]): Box[] {
  const stacked: Box[] = [];
  for (const run of runs) {
    const aboveAt = stacked.findIndex((box) => box.x0 === run.x0 && box.x1 === run.x1 && box.y1 === run.y0);
    const sitsOnOne = aboveAt >= 0;
    if (sitsOnOne) stacked[aboveAt] = { ...stacked[aboveAt], y1: run.y1 };
    else stacked.push(run);
  }
  return stacked;
}

function propsOf(): PropInstance[] {
  const props = STANDING_IDS.map((id): PropInstance => ({ kind: STATION_PROPS[id], ...STATION_PLACES[id] }));
  const counters = MERCHANT_IDS.map((id): PropInstance => ({ kind: 'counter', x: STATION_PLACES[id].x, y: COUNTER_Y }));
  return [...props, ...counters, { ...BLAST_DOOR }];
}

function stationOf(id: StationId): Station {
  const servedFrom = isMerchantId(id) ? COUNTER_Y : STATION_PLACES[id].y;
  return { id, x: STATION_PLACES[id].x, y: servedFrom + CUSTOMER_GAP, radius: STATION_RADIUS };
}

/** The chest's circle, for the overrun to put in reach while a chest is unopened. */
export const CHEST_STATION: Station = stationOf('chest');

const stationsOf = (): Station[] => STANDING_IDS.map(stationOf);

export function generateBunkerMap(): WorldMap {
  const tiles = carve();
  return {
    seed: BUNKER_SEED,
    width: WIDTH,
    height: HEIGHT,
    cols: COLS,
    rows: ROWS,
    tiles,
    props: propsOf(),
    buildings: [],
    districts: ROOMS.map((room) => ({ name: room.name, ...centreOf(room) })),
    lights: ROOMS.map((room) => ({ ...centreOf(room), radius: LAMP_RADIUS, color: WARM_LAMP, flicker: false })),
    spawn: { ...SPAWN_SPOT },
    walls: stackRuns(wallRuns(tiles)),
    exit: { ...EXIT_SPOT },
    stations: stationsOf(),
  };
}
