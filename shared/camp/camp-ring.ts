// The camp's fence ring: where it stands at each camp size, and its sections in order. Pure geometry, shared by the map, the breach and the renderer.
// The east side never moves, so the gate, the van and everything inside the smallest ring stay put while the camp grows west, north and south.

import { PROP_DEFS, TILE_SIZE } from '../map-protocol.ts';

export const CAMP_COLS = 72;
export const CAMP_ROWS = 48;
/** The first tile column outside the east fence, at every size. */
export const CAMP_EAST_COL = 56;
/** The ring is centred on the top edge of this tile row. */
export const CAMP_MID_ROW = 24;

export type CampSize = 1 | 2 | 3 | 4 | 5;
export const CAMP_SIZES: readonly CampSize[] = [1, 2, 3, 4, 5];

/** The fenced ground in tiles at each size. Every width and height is even, so 32 px sections tile the north, south and west sides exactly. */
export const CAMP_RING_TILES: Readonly<Record<CampSize, { readonly w: number; readonly h: number }>> = {
  1: { w: 24, h: 14 },
  2: { w: 28, h: 16 },
  3: { w: 32, h: 18 },
  4: { w: 36, h: 22 },
  5: { w: 40, h: 26 },
};

/** The gate's tile rows, top and bottom inclusive: the same at every size. */
export const GATE_ROWS = { top: 22, bottom: 25 } as const;

/** A size from anything: not a number, or below 1, is the smallest camp; above 5 is the largest. */
export function clampCampSize(n: number): CampSize {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(5, Math.floor(n))) as CampSize;
}

/** A size off the wire: anything that is not a number is the smallest camp. */
export function readCampSize(value: unknown): CampSize {
  return typeof value === 'number' ? clampCampSize(value) : 1;
}

/** What a welcome or snapshot says about the camp: its size past the smallest, and nothing at all in a town or the smallest camp. */
export function campSizeField(map: { readonly camp?: { readonly size: number } }): { campSize?: number } {
  const size = map.camp?.size ?? 1;
  return size > 1 ? { campSize: size } : {};
}

/** Inclusive tile bounds. */
export interface TileRect {
  readonly col0: number;
  readonly row0: number;
  readonly col1: number;
  readonly row1: number;
}

/** The fenced ground at a size: every tile inside the fence. */
export function ringRect(size: CampSize): TileRect {
  const { w, h } = CAMP_RING_TILES[size];
  return { col0: CAMP_EAST_COL - w, row0: CAMP_MID_ROW - h / 2, col1: CAMP_EAST_COL - 1, row1: CAMP_MID_ROW + h / 2 - 1 };
}

export type FenceSide = 'n' | 'e' | 's' | 'w';
export type FenceKind = 'camp_fence_h' | 'camp_fence_v' | 'camp_gate' | 'camp_post';

export interface FenceSection {
  /** Its place in the ring, clockwise from the north-west corner. Stable for a size. */
  readonly index: number;
  readonly side: FenceSide;
  readonly kind: FenceKind;
  /** The prop's anchor: the bottom centre of its footprint. */
  readonly x: number;
  readonly y: number;
  /** Whether the horde may bring it down: never the gate, a stub, or the first or last piece of a side. */
  readonly breachable: boolean;
  /** Unit vector pointing away from the camp. */
  readonly out: { readonly x: number; readonly y: number };
}

type Piece = Pick<FenceSection, 'kind' | 'x' | 'y'>;

const SECTION = PROP_DEFS.camp_fence_h.w;
const DEPTH = PROP_DEFS.camp_fence_h.h;
const SECTION_TILES = SECTION / TILE_SIZE;
const OUT: Record<FenceSide, { x: number; y: number }> = { n: { x: 0, y: -1 }, e: { x: 1, y: 0 }, s: { x: 0, y: 1 }, w: { x: -1, y: 0 } };

/** West to east along a horizontal fence line whose footprint's bottom edge is `y`. */
function runH(rect: TileRect, y: number): Piece[] {
  const count = (rect.col1 - rect.col0 + 1) / SECTION_TILES;
  return Array.from({ length: count }, (_, i) => ({ kind: 'camp_fence_h' as const, x: rect.col0 * TILE_SIZE + SECTION / 2 + i * SECTION, y }));
}

/** North to south from tile row `top` for `tiles` rows, with the odd tile, if any, as a stub at the `stubAt` end. */
function runV(x: number, top: number, tiles: number, stubAt: 'north' | 'south' | null): Piece[] {
  const hasStub = tiles % SECTION_TILES === 1;
  const stubTiles = hasStub ? 1 : 0;
  const firstRow = top + (hasStub && stubAt === 'north' ? 1 : 0);
  const sections = Array.from({ length: (tiles - stubTiles) / SECTION_TILES }, (_, i): Piece => ({ kind: 'camp_fence_v', x, y: (firstRow + (i + 1) * SECTION_TILES) * TILE_SIZE }));
  if (!hasStub) return sections;
  const stub: Piece = { kind: 'camp_post', x, y: (stubAt === 'north' ? top + 1 : top + tiles) * TILE_SIZE };
  return stubAt === 'north' ? [stub, ...sections] : [...sections, stub];
}

/** The east side, north to south: fence tiled outward from the gate, so any odd tile lands beside a corner. */
function eastSide(rect: TileRect): Piece[] {
  const x = (rect.col1 + 1) * TILE_SIZE + DEPTH / 2;
  const above = runV(x, rect.row0, GATE_ROWS.top - rect.row0, 'north');
  const gate: Piece = { kind: 'camp_gate', x, y: (GATE_ROWS.bottom + 1) * TILE_SIZE };
  const below = runV(x, GATE_ROWS.bottom + 1, rect.row1 - GATE_ROWS.bottom, 'south');
  return [...above, gate, ...below];
}

/** Every piece of the fence at a size, clockwise from the north-west corner. The footprints close the ring. */
export function fenceSections(size: CampSize): readonly FenceSection[] {
  const rect = ringRect(size);
  const rows = rect.row1 - rect.row0 + 1;
  const sides: [FenceSide, Piece[]][] = [
    ['n', runH(rect, rect.row0 * TILE_SIZE)],
    ['e', eastSide(rect)],
    ['s', runH(rect, (rect.row1 + 1) * TILE_SIZE + DEPTH).reverse()],
    ['w', runV(rect.col0 * TILE_SIZE - DEPTH / 2, rect.row0, rows, null).reverse()],
  ];
  const pieces = sides.flatMap(([side, run]) =>
    run.map((piece, i) => {
      const isFence = piece.kind === 'camp_fence_h' || piece.kind === 'camp_fence_v';
      const isEnd = i === 0 || i === run.length - 1;
      return { ...piece, side, breachable: isFence && !isEnd, out: OUT[side] };
    }),
  );
  return pieces.map((piece, index) => ({ index, ...piece }));
}

/** A box in world pixels. */
export interface PixelBox {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** The ground a section stands on, which is open once it falls. */
export function gapGround(section: FenceSection): PixelBox {
  const def = PROP_DEFS[section.kind];
  return { x0: section.x - def.w / 2, y0: section.y - def.h, x1: section.x + def.w / 2, y1: section.y };
}
