import { TILE_SIZE } from './protocol.ts';
import type { District } from './protocol.ts';
import { randInt, shuffle } from './rng.ts';
import type { Rng } from './rng.ts';
import type { Box } from './world-query.ts';

export const MAP_TILES = 200;
/** Sidewalk on each side of every road. */
export const WALK_TILES = 2;
/** Open verge between the outermost blocks and the fence. */
export const EDGE_TILES = 6;
export const AVENUE_TILES = 7;
/** Every street but the two avenues. */
export const STREET_TILES = 5;
/**
 * The town sits on a fixed grid, like a Utah city. The avenues cross at the middle tile; a street
 * runs every pitch from there, so crossings always share their X and Y. East-west streets are
 * 1 grid step apart in rows, north-south ones in columns. One step is a "100" in street names.
 */
export const GRID_CENTRE_COL = 100;
export const GRID_CENTRE_ROW = 100;
export const GRID_PITCH_COLS = 36;
export const GRID_PITCH_ROWS = 32;
/** Grid steps out from the avenues that carry a street: 100 and 200, either side. */
export const GRID_STEPS = 2;

export interface TileRect {
  readonly c0: number;
  readonly r0: number;
  /** Exclusive, like r1. */
  readonly c1: number;
  readonly r1: number;
}

export interface Road extends TileRect {
  readonly horizontal: boolean;
}

export type TownStyle = 'downtown' | 'old_town' | 'riverside' | 'industrial';

export interface Block extends TileRect {
  readonly style: TownStyle;
}

export interface TownPlan {
  readonly roads: Road[];
  readonly blocks: Block[];
  readonly park: TileRect;
  readonly districts: District[];
  readonly spawn: { readonly x: number; readonly y: number };
}

const DISTRICT_NAMES: Record<TownStyle, string> = {
  downtown: 'Downtown',
  old_town: 'Old Town',
  riverside: 'Riverside',
  industrial: 'Industrial Yard',
};

export function rectBox(rect: TileRect): Box {
  return { x0: rect.c0 * TILE_SIZE, y0: rect.r0 * TILE_SIZE, x1: rect.c1 * TILE_SIZE, y1: rect.r1 * TILE_SIZE };
}

function rectCentre(rect: TileRect): { x: number; y: number } {
  return { x: ((rect.c0 + rect.c1) / 2) * TILE_SIZE, y: ((rect.r0 + rect.r1) / 2) * TILE_SIZE };
}

/** The streets as [first, one past last) tile spans across one axis, in order, with the avenue's step at 0. */
export function gridSpans(centre: number, pitch: number): { step: number; from: number; to: number }[] {
  const spans: { step: number; from: number; to: number }[] = [];
  for (let step = -GRID_STEPS; step <= GRID_STEPS; step++) {
    const width = step === 0 ? AVENUE_TILES : STREET_TILES;
    const from = centre + step * pitch - (width >> 1);
    spans.push({ step, from, to: from + width });
  }
  return spans;
}

/** The open ground between neighbouring streets (and the fence verge), pavements already taken off. */
function gaps(spans: readonly { from: number; to: number }[]): { lo: number; hi: number }[] {
  const edges = [{ lo: EDGE_TILES, hi: spans[0].from - WALK_TILES }];
  for (let i = 1; i < spans.length; i++) edges.push({ lo: spans[i - 1].to + WALK_TILES, hi: spans[i].from - WALK_TILES });
  edges.push({ lo: spans[spans.length - 1].to + WALK_TILES, hi: MAP_TILES - EDGE_TILES });
  return edges;
}

/** The town at tile level: where the roads, the blocks and the park go. Always the same grid; the seed picks districts. */
export function planTown(rng: Rng): TownPlan {
  const colSpans = gridSpans(GRID_CENTRE_COL, GRID_PITCH_COLS);
  const rowSpans = gridSpans(GRID_CENTRE_ROW, GRID_PITCH_ROWS);
  const roads: Road[] = [
    ...colSpans.map(({ from, to }): Road => ({ c0: from, c1: to, r0: 1, r1: MAP_TILES - 1, horizontal: false })),
    ...rowSpans.map(({ from, to }): Road => ({ r0: from, r1: to, c0: 1, c1: MAP_TILES - 1, horizontal: true })),
  ];
  // The two avenues lead, so the wall pass (which skips the first two roads) leaves them alone.
  const avenues = roads.filter((road) => (road.horizontal ? road.r1 - road.r0 : road.c1 - road.c0) === AVENUE_TILES);
  roads.splice(0, roads.length, ...avenues, ...roads.filter((road) => !avenues.includes(road)));

  const colGaps = gaps(colSpans);
  const rowGaps = gaps(rowSpans);
  /** Gaps before the avenue are west/north of it: with two streets a side that is gaps 0 to 2. */
  const firstEast = GRID_STEPS + 1;
  const quadrantOf = (gapCol: number, gapRow: number): number => (gapCol < firstEast ? 0 : 1) + (gapRow < firstEast ? 0 : 2);
  const quadrantRect = (index: number): TileRect => {
    const west = index % 2 === 0;
    const north = index < 2;
    return {
      c0: west ? EDGE_TILES : colSpans[GRID_STEPS].to + WALK_TILES,
      c1: west ? colSpans[GRID_STEPS].from - WALK_TILES : MAP_TILES - EDGE_TILES,
      r0: north ? EDGE_TILES : rowSpans[GRID_STEPS].to + WALK_TILES,
      r1: north ? rowSpans[GRID_STEPS].from - WALK_TILES : MAP_TILES - EDGE_TILES,
    };
  };

  // Old Town and the park share a quadrant, with Downtown across the crossing from them.
  const home = randInt(rng, 0, 3);
  const flanks = shuffle<TownStyle>(rng, ['riverside', 'industrial']);
  const styles: TownStyle[] = [];
  styles[home] = 'old_town';
  styles[3 - home] = 'downtown';
  const flankIndices = [0, 1, 2, 3].filter((index) => index !== home && index !== 3 - home);
  flankIndices.forEach((index, order) => {
    styles[index] = flanks[order];
  });

  // The park is the block of the home quadrant that touches the main crossing.
  const parkGapCol = home % 2 === 0 ? firstEast - 1 : firstEast;
  const parkGapRow = home < 2 ? firstEast - 1 : firstEast;
  const parkCol = colGaps[parkGapCol];
  const parkRow = rowGaps[parkGapRow];
  const park: TileRect = { c0: parkCol.lo, c1: parkCol.hi, r0: parkRow.lo, r1: parkRow.hi };

  const blocks: Block[] = [];
  colGaps.forEach((colGap, gapCol) => {
    rowGaps.forEach((rowGap, gapRow) => {
      const isPark = colGap === parkCol && rowGap === parkRow;
      if (isPark) return;
      blocks.push({ c0: colGap.lo, c1: colGap.hi, r0: rowGap.lo, r1: rowGap.hi, style: styles[quadrantOf(gapCol, gapRow)] });
    });
  });
  const districts: District[] = [];
  styles.forEach((style, index) => districts.push({ name: DISTRICT_NAMES[style], ...rectCentre(quadrantRect(index)) }));
  const spawn = rectCentre(park);
  districts.push({ name: 'Park', ...spawn });
  return { roads, blocks, park, districts, spawn };
}
