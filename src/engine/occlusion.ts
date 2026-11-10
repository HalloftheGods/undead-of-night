import { isSewerBuilding } from '../../shared/map-protocol.ts';
import { BUILDING_DEFS, PROP_DEFS, TILE_KINDS, TILE_SIZE } from '../../shared/protocol.ts';
import type { PropKind, WorldMap } from '../../shared/protocol.ts';
import { wallBoxes } from '../../shared/world-map.ts';

const CELL = 4;

const OPEN = 0;
const PROP = 1;
const WALL = 2;
const ROOM = 3;

/** Anything shorter than a flashlight beam at hip height does not stop it. */
const BLOCKS_LIGHT: ReadonlySet<PropKind> = new Set<PropKind>([
  'car_sedan_h',
  'car_sedan_v',
  'car_wreck_h',
  'van_h',
  'car_hatch_h',
  'car_hatch_v',
  'pickup_h',
  'police_h',
  'police_v',
  'ambulance_h',
  'fireworks_bus',
  'dumpster',
  'crate_stack',
  'shelf',
  'locker',
  'fridge',
]);

/** Coarse solid grid, so casting light rays costs array reads rather than prop tests. */
export class OcclusionGrid {
  private readonly cols: number;
  private readonly rows: number;
  private readonly cells: Uint8Array;

  constructor(map: WorldMap) {
    this.cols = Math.ceil(map.width / CELL);
    this.rows = Math.ceil(map.height / CELL);
    this.cells = new Uint8Array(this.cols * this.rows);
    for (const building of map.buildings) {
      // The sewers' own walls are the brick and rock tiles below, not a roof over the whole maze.
      if (isSewerBuilding(building)) continue;
      const { w, h } = BUILDING_DEFS[building.kind];
      this.fill(building.x, building.y, building.x + w, building.y + h, ROOM);
    }
    this.fillSewerRock(map);
    for (const wall of wallBoxes(map)) this.fill(wall.x0, wall.y0, wall.x1, wall.y1, WALL);
    for (const prop of map.props) {
      if (!BLOCKS_LIGHT.has(prop.kind)) continue;
      const { w, h } = PROP_DEFS[prop.kind];
      this.fill(prop.x - w / 2, prop.y - h, prop.x + w / 2, prop.y, PROP);
    }
  }

  /** Light stops at the sewers' brick and rock, a run of tiles at a time. */
  private fillSewerRock(map: WorldMap): void {
    if (!map.sewers) return;
    for (let row = map.sewers.top; row < map.rows; row += 1) {
      let start = -1;
      for (let col = 0; col <= map.cols; col += 1) {
        const kind = col < map.cols ? TILE_KINDS[map.tiles[row * map.cols + col]] : null;
        const isRock = kind === 'void' || kind === 'sewer_wall';
        if (isRock && start < 0) start = col;
        if (!isRock && start >= 0) {
          this.fill(start * TILE_SIZE, row * TILE_SIZE, col * TILE_SIZE, (row + 1) * TILE_SIZE, WALL);
          start = -1;
        }
      }
    }
  }

  private fill(x0: number, y0: number, x1: number, y1: number, cell: number): void {
    const c0 = Math.max(0, Math.floor(x0 / CELL));
    const c1 = Math.min(this.cols - 1, Math.floor((x1 - 1) / CELL));
    const r0 = Math.max(0, Math.floor(y0 / CELL));
    const r1 = Math.min(this.rows - 1, Math.floor((y1 - 1) / CELL));
    for (let row = r0; row <= r1; row += 1) {
      this.cells.fill(cell, row * this.cols + c0, row * this.cols + c1 + 1);
    }
  }

  private cellAt(x: number, y: number): number {
    const col = Math.floor(x / CELL);
    const row = Math.floor(y / CELL);
    const offMap = col < 0 || row < 0 || col >= this.cols || row >= this.rows;
    return offMap ? OPEN : this.cells[row * this.cols + col];
  }

  /**
   * Distance along the ray to the first thing that stops it, or maxDist. A ray from
   * outdoors stops at a building's whole footprint, door included, since the roof
   * covers what is behind it; a ray from inside a room only stops at walls.
   * The bleeds carry light up a face that rises over its footprint. A building shows
   * its face to the south only, so facadeBleed is for rays heading north from outside.
   */
  cast(x: number, y: number, angle: number, maxDist: number, propBleed = 0, facadeBleed = 0): number {
    const dx = Math.cos(angle) * CELL;
    const dy = Math.sin(angle) * CELL;
    const startCell = this.cellAt(x, y);
    const fromRoom = startCell === ROOM || startCell === WALL;
    const wallBleed = !fromRoom && dy < 0 ? facadeBleed : 0;
    let px = x;
    let py = y;
    for (let dist = 0; dist < maxDist; dist += CELL) {
      const cell = this.cellAt(px, py);
      const hitsProp = cell === PROP;
      const hitsBuilding = cell === WALL || (cell === ROOM && !fromRoom);
      if (hitsProp) return Math.min(maxDist, dist + propBleed);
      if (hitsBuilding) return Math.min(maxDist, dist + wallBleed);
      px += dx;
      py += dy;
    }
    return maxDist;
  }
}
