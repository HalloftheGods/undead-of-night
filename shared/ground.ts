import { TILE_KINDS, TILE_SIZE } from './protocol.ts';
import type { TileKind, WorldMap } from './protocol.ts';

/** What the ground underfoot does to anyone crossing it. */
export interface GroundEffect {
  /** Share of walking speed kept. */
  readonly speed: number;
  /** Scales how far a footstep carries to zombies' ears. */
  readonly noise: number;
}

const NEUTRAL: GroundEffect = { speed: 1, noise: 1 };

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
  return (kind && GROUND_EFFECTS[kind]) || NEUTRAL;
}
