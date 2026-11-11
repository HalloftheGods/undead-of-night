import { TILE_KINDS, TILE_SIZE } from './protocol.ts';
import type { PropKind, TileKind, WorldMap } from './protocol.ts';

/** What the ground underfoot does to anyone crossing it. */
export interface GroundEffect {
  /** Share of walking speed kept. */
  readonly speed: number;
  /** Scales how far a footstep carries to zombies' ears. */
  readonly noise: number;
}

const NEUTRAL: GroundEffect = { speed: 1, noise: 1 };

/** Walking through thick shrubs and rubble slows survivors and zombies down. */
export const WALKABLE_SLOWDOWN_SPEED = 0.75;
export const WALKABLE_SLOWDOWN_NOISE = 1.2;

/** Walkable scenery props that drag at the feet. */
export const SLOW_PROP_BOUNDS: Partial<Record<PropKind, { readonly hw: number; readonly top: number; readonly bottom: number }>> = {
  rubble: { hw: 15, top: 14, bottom: 2 },
  bush: { hw: 14, top: 16, bottom: 2 },
  scrub: { hw: 11, top: 14, bottom: 2 },
};

interface PropBox {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

interface SlowIndex {
  readonly buckets: readonly (readonly PropBox[])[];
}

const NO_BOXES: readonly PropBox[] = [];
const slowIndexes = new WeakMap<WorldMap, SlowIndex>();

function slowIndex(map: WorldMap): SlowIndex {
  const cached = slowIndexes.get(map);
  if (cached) return cached;

  const buckets = new Array<readonly PropBox[]>(map.cols * map.rows).fill(NO_BOXES);
  for (const prop of map.props) {
    const bounds = SLOW_PROP_BOUNDS[prop.kind];
    if (!bounds) continue;
    const box: PropBox = {
      x0: prop.x - bounds.hw,
      y0: prop.y - bounds.top,
      x1: prop.x + bounds.hw,
      y1: prop.y + bounds.bottom,
    };
    const minCol = Math.max(0, Math.floor(box.x0 / TILE_SIZE));
    const maxCol = Math.min(map.cols - 1, Math.floor(box.x1 / TILE_SIZE));
    const minRow = Math.max(0, Math.floor(box.y0 / TILE_SIZE));
    const maxRow = Math.min(map.rows - 1, Math.floor(box.y1 / TILE_SIZE));
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const index = r * map.cols + c;
        buckets[index] = buckets[index] === NO_BOXES ? [box] : [...buckets[index], box];
      }
    }
  }

  const index = { buckets };
  slowIndexes.set(map, index);
  return index;
}

export function hasSlowPropAt(map: WorldMap, x: number, y: number): boolean {
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  const isOffGrid = col < 0 || row < 0 || col >= map.cols || row >= map.rows;
  if (isOffGrid) return false;
  const boxes = slowIndex(map).buckets[row * map.cols + col];
  for (const box of boxes) {
    const inside = x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;
    if (inside) return true;
  }
  return false;
}

/** Only the ground a biome lays over the town does anything; the rest is plain going. */
export const GROUND_EFFECTS: Readonly<Partial<Record<TileKind, GroundEffect>>> = {
  /** Wading: slow, and every step splashes. */
  water: { speed: 0.7, noise: 1.5 },
  /** Drifts drag at the legs and swallow the sound. */
  snow: { speed: 0.88, noise: 0.7 },
  /** Sucking mud that sounds like it. */
  sludge: { speed: 0.65, noise: 1.2 },
  /** The sewer's canal: the same sludge, between stone lips. */
  floor_sewer_channel: { speed: 0.65, noise: 1.2 },
  floor_sewer_channel_v: { speed: 0.65, noise: 1.2 },
  /** Soft and loose, hardly worth noting. */
  ash: { speed: 0.95, noise: 0.9 },
};

export function groundAt(map: WorldMap, x: number, y: number): TileKind | null {
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  const onMap = col >= 0 && row >= 0 && col < map.cols && row < map.rows;
  return onMap ? TILE_KINDS[map.tiles[row * map.cols + col]] : null;
}

export function groundEffect(map: WorldMap, x: number, y: number): GroundEffect {
  const kind = groundAt(map, x, y);
  const base = (kind && GROUND_EFFECTS[kind]) || NEUTRAL;
  const inSlowProp = hasSlowPropAt(map, x, y);
  if (!inSlowProp) return base;
  return {
    speed: Math.min(base.speed, WALKABLE_SLOWDOWN_SPEED),
    noise: Math.max(base.noise, WALKABLE_SLOWDOWN_NOISE),
  };
}
