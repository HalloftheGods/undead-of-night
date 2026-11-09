// The ground under the map screen's buildings: each tile's colour with a little texture worked in (speckled grass,
// lane dashes, zebra crossings, ripples), then the trees and parked cars along the streets as dots of colour.

import { TILE_KINDS, TILE_SIZE } from '../../shared/protocol.ts';
import type { PropInstance, PropKind, TileKind, WorldMap } from '../../shared/protocol.ts';
import { MAP_INK } from './map-sprite.ts';

export type Rgb = readonly [number, number, number];

const LANE: Rgb = [128, 112, 58];
const STRIPE: Rgb = [104, 104, 110];

function noise(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function lift(rgb: Rgb, by: number): Rgb {
  return [rgb[0] + by, rgb[1] + by, rgb[2] + by];
}

/** Where a map pixel sits: on the map, inside its tile, which tile, and a steady random number. */
interface Texel {
  readonly x: number;
  readonly y: number;
  readonly inX: number;
  readonly inY: number;
  readonly col: number;
  readonly row: number;
  readonly n: number;
}

type Mark = (at: Texel, base: Rgb) => Rgb;

/** Light flecks and dark ones on open ground, the same shade a sixteenth of the time each way round. */
const SPECKLE_LIFT: readonly number[] = [14, 14, -10];
const speckle: Mark = (at, base) => lift(base, SPECKLE_LIFT[at.n] ?? 0);

/** What is painted on each kind of tile. A tile not listed is its plain colour. */
const MARKS: Partial<Record<TileKind, Mark>> = {
  lane_h: (at, base) => (at.inY === 0 && at.col % 4 < 2 ? LANE : base),
  lane_v: (at, base) => (at.inX === 0 && at.row % 4 < 2 ? LANE : base),
  crosswalk_h: (at, base) => (at.x % 2 === 0 ? STRIPE : base),
  crosswalk_v: (at, base) => (at.y % 2 === 0 ? STRIPE : base),
  parking_line: (at, base) => (at.inX === 0 ? STRIPE : base),
  water: (at, base) => ((at.x + at.y * 3) % 9 === 0 || at.n === 0 ? lift(base, 22) : base),
  asphalt_cracked: (at, base) => (at.n < 2 ? lift(base, -8) : base),
  sidewalk: (at, base) => ((at.col + at.row) % 2 === 0 ? lift(base, 3) : base),
  grass: speckle,
  dirt: speckle,
  snow: speckle,
  ash: speckle,
  sludge: speckle,
};

/** The colour of one map pixel: the tile's own, or a mark painted on it. */
function texel(kind: TileKind, base: Rgb, x: number, y: number, tilePx: number): Rgb {
  const mark = MARKS[kind];
  if (!mark) return base;
  const at = { x, y, inX: x % tilePx, inY: y % tilePx, col: Math.floor(x / tilePx), row: Math.floor(y / tilePx), n: noise(x, y) % 16 };
  return mark(at, base);
}

/** The canvas's size in map pixels, its pixels per tile, and whether the ground carries texture. */
export interface GroundSize {
  readonly width: number;
  readonly height: number;
  readonly tilePx: number;
  readonly textured: boolean;
}

/** Fills the canvas with the ground, `tilePx` map pixels to a tile. Plain colour when `textured` is false. */
export function paintGround(
  ctx: CanvasRenderingContext2D,
  map: WorldMap,
  size: GroundSize,
  colorOf: (kind: TileKind) => Rgb,
): void {
  const { width, height, tilePx, textured } = size;
  const image = ctx.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    const row = Math.floor(y / tilePx) * map.cols;
    for (let x = 0; x < width; x += 1) {
      const kind = TILE_KINDS[map.tiles[row + Math.floor(x / tilePx)]];
      const [r, g, b] = textured ? texel(kind, colorOf(kind), x, y, tilePx) : colorOf(kind);
      image.data.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  ctx.putImageData(image, 0, 0);
}

type Scenery = 'leafy' | 'pine' | 'dead' | 'scrub' | 'car' | 'police' | 'ambulance' | 'wreck' | 'junk';

const SCENERY: Partial<Record<PropKind, Scenery>> = {
  tree: 'leafy',
  fungus: 'leafy',
  pine: 'pine',
  cactus: 'pine',
  dead_tree: 'dead',
  bush: 'scrub',
  scrub: 'scrub',
  reeds: 'scrub',
  car_sedan_h: 'car',
  car_sedan_v: 'car',
  car_hatch_h: 'car',
  car_hatch_v: 'car',
  pickup_h: 'car',
  van_h: 'car',
  police_h: 'police',
  police_v: 'police',
  ambulance_h: 'ambulance',
  car_wreck_h: 'wreck',
  dumpster: 'junk',
  crate_stack: 'junk',
};

/** Leaf, light; or for a vehicle, its body and roof. */
const SCENERY_COLORS: Record<Scenery, readonly [string, string]> = {
  leafy: ['#2c5a30', '#4f8a44'],
  pine: ['#1c3a2c', '#2f5a3c'],
  dead: ['#4e3432', '#7c5840'],
  scrub: ['#3c5e4a', '#3c5e4a'],
  car: ['#6c6a78', '#a8a492'],
  police: ['#2a3c66', '#e8e8f0'],
  ambulance: ['#e8e8f0', '#d84040'],
  wreck: ['#5a3428', '#7c4a30'],
  junk: ['#3c4a40', '#56645a'],
};

/** Parked cars come in a few coats, picked by where they stand. */
const CAR_COATS: readonly string[] = ['#7c3038', '#3a5288', '#6c6a78', '#a8a492', '#5c7a44', '#b0843a'];

const PROP_SIZES: Partial<Record<PropKind, { readonly w: number; readonly h: number }>> = {
  car_sedan_v: { w: 2, h: 5 },
  car_hatch_v: { w: 2, h: 4 },
  police_v: { w: 2, h: 5 },
};

function paintTree(ctx: CanvasRenderingContext2D, x: number, y: number, [leaf, light]: readonly [string, string]): void {
  ctx.fillStyle = MAP_INK;
  ctx.fillRect(x, y - 1, 2, 3);
  ctx.fillRect(x - 1, y, 4, 2);
  ctx.fillStyle = leaf;
  ctx.fillRect(x, y - 1, 2, 2);
  ctx.fillRect(x - 1, y, 3, 1);
  ctx.fillStyle = light;
  ctx.fillRect(x, y - 1, 1, 1);
}

function paintVehicle(ctx: CanvasRenderingContext2D, prop: PropInstance, scale: number, kind: Scenery): void {
  const size = PROP_SIZES[prop.kind] ?? { w: kind === 'junk' ? 3 : 5, h: 2 };
  const left = Math.round(prop.x / scale - size.w / 2);
  const top = Math.round(prop.y / scale) - size.h - 1;
  const [body, roof] = SCENERY_COLORS[kind];
  ctx.fillStyle = kind === 'car' ? CAR_COATS[noise(prop.x, prop.y) % CAR_COATS.length] : body;
  ctx.fillRect(left, top, size.w, size.h);
  ctx.fillStyle = roof;
  const isUpright = size.h > size.w;
  if (isUpright) ctx.fillRect(left, top + 1, size.w, 1);
  else ctx.fillRect(left + 1, top, 1, size.h);
}

/** Trees, parked cars and bins outside, over the ground and under the buildings. */
export function paintScenery(ctx: CanvasRenderingContext2D, props: readonly PropInstance[], tilePx: number): void {
  const scale = TILE_SIZE / tilePx;
  for (const prop of props) {
    const kind = SCENERY[prop.kind];
    if (!kind) continue;
    const x = Math.round(prop.x / scale);
    const y = Math.round(prop.y / scale);
    const isScrub = kind === 'scrub';
    if (isScrub) {
      ctx.fillStyle = SCENERY_COLORS.scrub[0];
      ctx.fillRect(x, y - 1, 1, 1);
      continue;
    }
    const isTree = kind === 'leafy' || kind === 'pine' || kind === 'dead';
    if (isTree) paintTree(ctx, x, y - 2, SCENERY_COLORS[kind]);
    else paintVehicle(ctx, prop, scale, kind);
  }
}
