import { TILE_SIZE } from './protocol.ts';
import type { WorldMap } from './protocol.ts';
import { flightsOf } from './storeys.ts';
import { blockedTiles, segmentHitsSolid } from './world-query.ts';

const UNREACHED = 0xffff;
/** Daylight kept between a wide body and a wall it is walking past. */
const WALL_MARGIN = 1.5;
const NEIGHBOURS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
] as const;

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Breadth-first distance to the nearest seed over free tiles. Allocates nothing after construction. */
export class FlowField {
  private readonly map: WorldMap;
  private readonly cols: number;
  private readonly rows: number;
  private readonly blocked: Uint8Array;
  private readonly distance: Uint16Array;
  private readonly queue: Int32Array;
  /** Where each tile's stairs lead, or -1: one step, like walking to the next tile. */
  private readonly stairs: Int32Array;
  private computed = false;

  constructor(map: WorldMap) {
    this.map = map;
    this.cols = map.cols;
    this.rows = map.rows;
    this.blocked = blockedTiles(map);
    this.distance = new Uint16Array(map.cols * map.rows);
    this.queue = new Int32Array(map.cols * map.rows);
    this.stairs = new Int32Array(map.cols * map.rows).fill(-1);
    for (const flight of flightsOf(map).values()) this.stairs[flight.fromIndex] = flight.toIndex;
  }

  get ready(): boolean {
    return this.computed;
  }

  invalidate(): void {
    this.computed = false;
  }

  /** True if a straight line from the point reaches this tile, so a wall's far side does not count. */
  private inSight(point: Point, col: number, row: number): boolean {
    return !segmentHitsSolid(this.map, point.x, point.y, (col + 0.5) * TILE_SIZE, (row + 0.5) * TILE_SIZE);
  }

  /** A seed standing in a part-blocked tile spreads to the nearest free ring on its own side of the wall. */
  private seed(point: Point, tail: number): number {
    const col = Math.floor(point.x / TILE_SIZE);
    const row = Math.floor(point.y / TILE_SIZE);
    let queued = tail;
    let found = false;
    for (let ring = 0; ring <= 3 && !found; ring++) {
      for (let dr = -ring; dr <= ring; dr++) {
        for (let dc = -ring; dc <= ring; dc++) {
          const isOffRing = Math.max(Math.abs(dr), Math.abs(dc)) !== ring;
          if (isOffRing) continue;
          const c = col + dc;
          const r = row + dr;
          const isOffGrid = c < 0 || r < 0 || c >= this.cols || r >= this.rows;
          if (isOffGrid) continue;
          const index = r * this.cols + c;
          const isUnusableSeed = this.blocked[index] || !this.inSight(point, c, r);
          if (isUnusableSeed) continue;
          // A tile another seed already took still ends the search, or a crowd in one corner would spread a ring per player.
          found = true;
          const alreadySeeded = this.distance[index] === 0;
          if (alreadySeeded) continue;
          this.distance[index] = 0;
          this.queue[queued++] = index;
        }
      }
    }
    return queued;
  }

  /** Spreads `reach` tiles from the seeds; anything farther stays unreached. */
  recompute(seeds: readonly Point[], reach: number = UNREACHED - 1): void {
    const { cols, rows, blocked, distance, queue, stairs } = this;
    distance.fill(UNREACHED);
    let head = 0;
    let tail = 0;
    for (const seed of seeds) tail = this.seed(seed, tail);

    while (head < tail) {
      const index = queue[head++];
      const next = distance[index] + 1;
      const isBeyondReach = next > reach;
      if (isBeyondReach) break;
      const col = index % cols;
      const row = (index - col) / cols;
      const canStepWest = col > 0 && !blocked[index - 1] && distance[index - 1] > next;
      if (canStepWest) {
        distance[index - 1] = next;
        queue[tail++] = index - 1;
      }
      const canStepEast = col < cols - 1 && !blocked[index + 1] && distance[index + 1] > next;
      if (canStepEast) {
        distance[index + 1] = next;
        queue[tail++] = index + 1;
      }
      const canStepNorth = row > 0 && !blocked[index - cols] && distance[index - cols] > next;
      if (canStepNorth) {
        distance[index - cols] = next;
        queue[tail++] = index - cols;
      }
      const canStepSouth = row < rows - 1 && !blocked[index + cols] && distance[index + cols] > next;
      if (canStepSouth) {
        distance[index + cols] = next;
        queue[tail++] = index + cols;
      }
      const upOrDown = stairs[index];
      const nearerByStairs = upOrDown >= 0 && distance[upOrDown] > next;
      if (nearerByStairs) {
        distance[upOrDown] = next;
        queue[tail++] = upOrDown;
      }
    }
    this.computed = true;
  }

  /** Steps to the nearest seed, or Infinity when unreachable. */
  distanceAt(x: number, y: number): number {
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);
    const isOffGrid = col < 0 || row < 0 || col >= this.cols || row >= this.rows;
    if (isOffGrid) return Infinity;
    const value = this.distance[row * this.cols + col];
    return value === UNREACHED ? Infinity : value;
  }

  /** For a body standing on stairs, where they come out if taking them is the way down the field; otherwise null. */
  stairsDown(x: number, y: number): Point | null {
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);
    const onMap = col >= 0 && row >= 0 && col < this.cols && row < this.rows;
    const here = row * this.cols + col;
    const leadsTo = onMap ? this.stairs[here] : -1;
    const downhill = leadsTo >= 0 && this.distance[leadsTo] < this.distance[here];
    if (!downhill) return null;
    const toCol = leadsTo % this.cols;
    return { x: (toCol + 0.5) * TILE_SIZE, y: ((leadsTo - toCol) / this.cols + 0.5) * TILE_SIZE };
  }

  /** Nudges a waypoint off the walls beside its tile, far enough for the body to clear them. */
  private clearOfWalls(col: number, row: number, radius: number): Point {
    const nudge = radius + WALL_MARGIN - TILE_SIZE / 2;
    const centreX = (col + 0.5) * TILE_SIZE;
    const centreY = (row + 0.5) * TILE_SIZE;
    const hasNoNudge = nudge <= 0;
    if (hasNoNudge) return { x: centreX, y: centreY };

    let pushX = 0;
    let pushY = 0;
    for (const [dc, dr] of NEIGHBOURS) {
      const c = col + dc;
      const r = row + dr;
      const onMap = c >= 0 && r >= 0 && c < this.cols && r < this.rows;
      const isWallNeighbour = onMap && this.blocked[r * this.cols + c];
      if (isWallNeighbour) {
        pushX -= dc;
        pushY -= dr;
      }
    }
    return { x: centreX + Math.sign(pushX) * nudge, y: centreY + Math.sign(pushY) * nudge };
  }

  /** Where a body of this radius should walk next, or null at the bottom of the field. */
  nextWaypoint(x: number, y: number, radius: number): Point | null {
    const { cols, rows, blocked, distance } = this;
    const col = Math.min(cols - 1, Math.max(0, Math.floor(x / TILE_SIZE)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor(y / TILE_SIZE)));
    const here = row * cols + col;
    const trapped = blocked[here] === 1;
    let best = trapped ? UNREACHED : distance[here];
    let bestCol = -1;
    let bestRow = -1;

    for (const [dc, dr] of NEIGHBOURS) {
      const c = col + dc;
      const r = row + dr;
      const isOffGrid = c < 0 || r < 0 || c >= cols || r >= rows;
      if (isOffGrid) continue;
      const index = r * cols + c;
      const isNoCloser = blocked[index] || distance[index] >= best;
      if (isNoCloser) continue;
      // Diagonals may not clip a corner, unless we are already wedged against one.
      const clipsCorner = !trapped && dc !== 0 && dr !== 0 && (blocked[row * cols + c] || blocked[r * cols + col]);
      if (clipsCorner) continue;
      // A wall is thinner than its tile, so a wedged body must not aim through to the far side.
      const acrossWall = trapped && !this.inSight({ x, y }, c, r);
      if (acrossWall) continue;
      best = distance[index];
      bestCol = c;
      bestRow = r;
    }
    return bestCol < 0 ? null : this.clearOfWalls(bestCol, bestRow, radius);
  }
}
