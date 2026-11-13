import { getItemFootprint, type GridItem, type GridPoint } from './grid-inventory.ts';

/**
 * A car parked nose up (north to south) is drawn standing on end, so its grid stands on end too: columns and rows
 * swap. The host still keeps the horizontal grid (8 by 4), so everything is flipped for the window and flipped
 * back before it is read.
 */

/** Props drawn standing on end carry a `_v` on their kind: car_sedan_v, police_v. Art looks do too: car_v. */
export function isVerticalLook(name?: string | null): boolean {
  return typeof name === 'string' && name.endsWith('_v');
}

export interface FlippableDimensions {
  readonly cols: number;
  readonly rows: number;
  readonly blocked?: readonly GridPoint[];
}

export function flipPoint(point: GridPoint): GridPoint {
  return { x: point.y, y: point.x };
}

/** The same grid on its side: its columns are the old rows. Flipping twice gives the original back. */
export function flipDimensions<T extends FlippableDimensions>(dims: T): { cols: number; rows: number; blocked?: GridPoint[] } {
  const flipped: { cols: number; rows: number; blocked?: GridPoint[] } = { cols: dims.rows, rows: dims.cols };
  if (dims.blocked && dims.blocked.length > 0) flipped.blocked = dims.blocked.map(flipPoint);
  return flipped;
}

/** An item moved to where it lies in the flipped grid. A long item turns with it, so it covers the same cells mirrored. */
export function flipItem(item: GridItem): GridItem {
  const footprint = getItemFootprint(item.type, false);
  const isSquare = footprint.width === footprint.height;
  return { ...item, x: item.y, y: item.x, rotated: isSquare ? item.rotated : !item.rotated };
}
