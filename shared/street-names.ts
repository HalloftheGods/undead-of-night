import { TILE_SIZE } from './protocol.ts';
import { GRID_CENTRE_COL, GRID_CENTRE_ROW, GRID_PITCH_COLS, GRID_PITCH_ROWS, MAP_TILES, WALK_TILES, gridSpans } from './town-plan.ts';

/**
 * Utah-style street names over the town's fixed grid. The avenues are Main St (north-south) and
 * Center St (east-west), the zero lines. Each grid step out is another 100: north-south streets
 * west of Main are '100 W', '200 W', east of it '100 E', '200 E'; east-west streets north of
 * Center are '100 N', '200 N', south of it '100 S', '200 S'.
 */
export const MAIN_STREET = 'Main St';
export const CENTER_STREET = 'Center St';
const BLOCK_NUMBER = 100;

export interface GridStreet {
  readonly name: string;
  /** Grid steps from the avenue: negative is west or north. */
  readonly step: number;
  /** The street's tile span across its axis, [from, to), pavements not included. */
  readonly from: number;
  readonly to: number;
}

/** The sign a survivor reads: the street underfoot, and the one that crosses it. */
export interface StreetSpot {
  readonly road: string;
  /** The nearest street crossing this one; at a junction, the other street of the two. */
  readonly cross: string;
  readonly junction: boolean;
}

export const columnName = (step: number): string => (step === 0 ? MAIN_STREET : `${Math.abs(step) * BLOCK_NUMBER} ${step < 0 ? 'W' : 'E'}`);
export const rowName = (step: number): string => (step === 0 ? CENTER_STREET : `${Math.abs(step) * BLOCK_NUMBER} ${step < 0 ? 'N' : 'S'}`);

const named = (spans: ReturnType<typeof gridSpans>, nameOf: (step: number) => string): GridStreet[] =>
  spans.map(({ step, from, to }) => ({ name: nameOf(step), step, from, to }));

/** North-south streets, named by how far east or west they are; they sit at fixed columns. */
export const NORTH_SOUTH_STREETS: readonly GridStreet[] = named(gridSpans(GRID_CENTRE_COL, GRID_PITCH_COLS), columnName);
/** East-west streets, named by how far north or south; they sit at fixed rows. */
export const EAST_WEST_STREETS: readonly GridStreet[] = named(gridSpans(GRID_CENTRE_ROW, GRID_PITCH_ROWS), rowName);

const within = (street: GridStreet, tile: number): boolean => tile >= street.from - WALK_TILES && tile < street.to + WALK_TILES;

function nearest(streets: readonly GridStreet[], tile: number): GridStreet {
  let best = streets[0];
  for (const street of streets) {
    const centre = (street.from + street.to) / 2;
    if (Math.abs(centre - tile) < Math.abs((best.from + best.to) / 2 - tile)) best = street;
  }
  return best;
}

/**
 * Which street a world position is on, pavement included, or null off the streets, outside the
 * town (the annex under it: cellars, upper floors, sewers) or past the fence.
 */
export function streetAt(x: number, y: number): StreetSpot | null {
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  const inTown = col >= 0 && row >= 0 && col < MAP_TILES && row < MAP_TILES;
  if (!inTown) return null;
  const down = NORTH_SOUTH_STREETS.find((street) => within(street, col));
  const across = EAST_WEST_STREETS.find((street) => within(street, row));
  if (down && across) return { road: across.name, cross: down.name, junction: true };
  if (down) return { road: down.name, cross: nearest(EAST_WEST_STREETS, row + 0.5).name, junction: false };
  if (across) return { road: across.name, cross: nearest(NORTH_SOUTH_STREETS, col + 0.5).name, junction: false };
  return null;
}
