import { isSewerBuilding } from '../../shared/map-protocol.ts';
import { BUILDING_DEFS, DOOR_WIDTH, NORTH_WALL_DEPTH, PROP_DEFS, TILE_KINDS, TILE_SIZE, WALL_THICKNESS } from '../../shared/protocol.ts';
import type { BuildingInstance, PropKind, WorldMap } from '../../shared/protocol.ts';
import type { PlacedDoor } from '../../shared/door-view.ts';
import { wallBoxes } from '../../shared/world-map.ts';
import { RISE } from '../art/environment/shell.ts';

const CELL = 4;

const OPEN = 0;
const PROP = 1;
const WALL = 2;
const ROOM = 3;
/** The roof where it rises past the footprint's north edge: solid to light from outdoors, which cannot reach a roof that high. */
const ROOF = 4;
/** How far south of a hit to look for open air, which says the ray met the building's south face and not its side. */
const FACE_PROBE = 3;
/** The shallowest climb a facade glow is stretched for, so a grazing ray does not run the length of the front. */
const MIN_CLIMB = 0.3;

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
  /** Over a building's footprint, how tall its front wall stands; 0 where unknown or outdoors. Light on the street reaches no higher. */
  private readonly fronts: Uint8Array;

  /** 1 over the gap of every door that is shut, which stops light like the wall around it. Changes as doors open and close. */
  private readonly shut: Uint8Array;
  private shutDoors: readonly PlacedDoor[] | null = null;

  /** `frontOf` says how tall a building's front wall stands, so the glow on it stops where the roof begins. */
  constructor(map: WorldMap, frontOf?: (building: BuildingInstance) => number | undefined) {
    this.cols = Math.ceil(map.width / CELL);
    this.rows = Math.ceil(map.height / CELL);
    this.cells = new Uint8Array(this.cols * this.rows);
    this.fronts = new Uint8Array(this.cols * this.rows);
    this.shut = new Uint8Array(this.cols * this.rows);
    // The sewers' own walls are the brick and rock tiles below, not a roof over the whole maze.
    const shells = map.buildings.filter((building) => !isSewerBuilding(building));
    // Roofs first, so one building's overhang never paints over the room of its neighbour.
    for (const building of shells) {
      const { w } = BUILDING_DEFS[building.kind];
      this.fill(building.x, building.y - RISE, building.x + w, building.y, ROOF);
    }
    for (const building of shells) {
      const { w, h } = BUILDING_DEFS[building.kind];
      this.fill(building.x, building.y, building.x + w, building.y + h, ROOM);
      const front = Math.min(255, Math.round(frontOf?.(building) ?? 0));
      if (front > 0) this.fill(building.x, building.y, building.x + w, building.y + h, front, this.fronts);
    }
    this.fillSewerRock(map);
    for (const wall of wallBoxes(map)) this.fill(wall.x0, wall.y0, wall.x1, wall.y1, WALL);
    for (const prop of map.props) {
      if (!BLOCKS_LIGHT.has(prop.kind)) continue;
      const { w, h } = PROP_DEFS[prop.kind];
      this.fill(prop.x - w / 2, prop.y - h, prop.x + w / 2, prop.y, PROP);
    }
  }

  /**
   * The doors in the snapshot that are shut or broken. A shut door stops a beam from either side; a broken one
   * is a gap. The same list as last time costs nothing.
   */
  setDoors(doors: readonly PlacedDoor[]): void {
    if (doors === this.shutDoors) return;
    this.shutDoors = doors;
    this.shut.fill(0);
    for (const door of doors) {
      if (door.broken) continue;
      const north = door.facing === 'north';
      const y0 = north ? door.y : door.y - WALL_THICKNESS;
      const y1 = north ? door.y + NORTH_WALL_DEPTH : door.y;
      // The cell value is the door's depth, so the beam that stops at it still lights the leaf it meets.
      this.fill(door.x - DOOR_WIDTH / 2, y0, door.x + DOOR_WIDTH / 2, y1, y1 - y0, this.shut);
    }
  }

  /** The depth of the shut door over this point, or 0 where there is none. */
  private shutDepth(x: number, y: number): number {
    const col = Math.floor(x / CELL);
    const row = Math.floor(y / CELL);
    const inField = col >= 0 && row >= 0 && col < this.cols && row < this.rows;
    return inField ? this.shut[row * this.cols + col] : 0;
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

  private fill(x0: number, y0: number, x1: number, y1: number, cell: number, into: Uint8Array = this.cells): void {
    const c0 = Math.max(0, Math.floor(x0 / CELL));
    const c1 = Math.min(this.cols - 1, Math.floor((x1 - 1) / CELL));
    const r0 = Math.max(0, Math.floor(y0 / CELL));
    const r1 = Math.min(this.rows - 1, Math.floor((y1 - 1) / CELL));
    for (let row = r0; row <= r1; row += 1) {
      into.fill(cell, row * this.cols + c0, row * this.cols + c1 + 1);
    }
  }

  private cellAt(x: number, y: number): number {
    const col = Math.floor(x / CELL);
    const row = Math.floor(y / CELL);
    const offMap = col < 0 || row < 0 || col >= this.cols || row >= this.rows;
    return offMap ? OPEN : this.cells[row * this.cols + col];
  }

  /**
   * How far past the hit the glow runs: only a ray that meets the south face lights it, and only as high as the
   * front wall stands, so the side of a building and its roof stay dark however the beam grazes them.
   * Without the front's height on record, `bleed` stands.
   */
  private frontGlow(x: number, y: number, sinAngle: number, bleed: number): number {
    const onSouthFace = this.cellAt(x, y + FACE_PROBE) === OPEN;
    if (!onSouthFace) return 0;
    const col = Math.floor(x / CELL);
    const row = Math.floor(y / CELL);
    const front = col < 0 || row < 0 || col >= this.cols || row >= this.rows ? 0 : this.fronts[row * this.cols + col];
    if (front === 0) return bleed;
    // The ray climbs only |sin| of every pixel it travels, so a slant needs a longer run to reach the same height.
    return front / Math.max(MIN_CLIMB, Math.abs(sinAngle));
  }

  /**
   * Distance along the ray to the first thing that stops it, or maxDist. A ray from
   * outdoors stops at a building's whole footprint, door included, since the roof
   * covers what is behind it; a ray from inside a room only stops at walls.
   * The bleeds carry light up a face that rises over its footprint. A building shows
   * its face to the south only, so facadeBleed is for rays heading north from outside.
   */
  cast(x: number, y: number, angle: number, maxDist: number, propBleed = 0, facadeBleed = 0): number {
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);
    const dx = cosAngle * CELL;
    const dy = sinAngle * CELL;
    const startCell = this.cellAt(x, y);
    const fromRoom = startCell === ROOM || startCell === WALL;
    // Someone standing under the overhang is outdoors, but is not stopped by the roof over their own head.
    const underRoof = startCell === ROOF;
    const wallBleed = !fromRoom && dy < 0 ? facadeBleed : 0;
    let px = x;
    let py = y;
    for (let dist = 0; dist < maxDist; dist += CELL) {
      const cell = this.cellAt(px, py);
      const hitsProp = cell === PROP;
      const hitsRoof = cell === ROOF && !fromRoom && !underRoof;
      const doorDepth = this.shutDepth(px, py);
      const hitsDoor = doorDepth > 0;
      const hitsBuilding = cell === WALL || (cell === ROOM && !fromRoom) || hitsRoof || hitsDoor;
      if (hitsProp || hitsBuilding) {
        // A beam stopped by a shut door still lights the door itself, through its depth and no further.
        // Seen from the street a door is part of the front, lit like the wall around it: only a beam from inside stops at the leaf.
        const isDoorOnly = hitsDoor && fromRoom && cell !== WALL && !hitsRoof;
        const doorGlow = doorDepth / Math.max(MIN_CLIMB, Math.abs(sinAngle));
        const buildingBleed = isDoorOnly ? doorGlow : wallBleed;
        const solidBleed = hitsRoof ? 0 : buildingBleed;
        const bleed = hitsProp ? propBleed : solidBleed;
        let fineDist = Math.max(0, dist - CELL);
        let fx = x + cosAngle * fineDist;
        let fy = y + sinAngle * fineDist;
        while (fineDist < dist) {
          const fineCell = this.cellAt(fx, fy);
          const fineHit = hitsProp ? fineCell === PROP : fineCell === WALL || (fineCell === ROOM && !fromRoom) || (fineCell === ROOF && hitsRoof) || this.shutDepth(fx, fy) > 0;
          if (fineHit) break;
          fineDist += 1;
          fx += cosAngle;
          fy += sinAngle;
        }
        const glow = bleed > 0 && !hitsProp && !isDoorOnly ? this.frontGlow(fx, fy, sinAngle, bleed) : bleed;
        return Math.min(maxDist, fineDist + glow);
      }
      px += dx;
      py += dy;
    }
    return maxDist;
  }
}
