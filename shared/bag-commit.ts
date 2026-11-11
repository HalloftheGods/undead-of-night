import { isBagItemType } from './bag.ts';
import type { BagCommit, BagDrop, BagLayoutRow } from './bag.ts';

/** Most rows a commit may carry. A bigger one is not from this game and is ignored. */
export const MAX_COMMIT_LAYOUT = 64;
export const MAX_COMMIT_DROPS = 16;

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRow(value: unknown): BagLayoutRow | null {
  if (!isFields(value)) return null;
  const { id, grid, x, y, rotated } = value;
  const named = typeof id === 'string' && id.length > 0 && id.length <= 40;
  const placed = Number.isInteger(x) && Number.isInteger(y);
  const grids = grid === 'pack' || grid === 'pockets';
  return named && placed && grids && typeof rotated === 'boolean'
    ? { id, grid, x: x as number, y: y as number, rotated }
    : null;
}

function parseDrop(value: unknown): BagDrop | null {
  if (!isFields(value)) return null;
  const { type, count } = value;
  return isBagItemType(type) && Number.isInteger(count) && (count as number) >= 1 && (count as number) <= 1000
    ? { type, count: count as number }
    : null;
}

/** A commit off the wire: null if it is not one or is over the row caps, so it is dropped before the sim sees it. */
export function parseBagCommit(value: unknown): BagCommit | null {
  if (!isFields(value) || !Array.isArray(value.layout) || !Array.isArray(value.drop)) return null;
  if (value.layout.length > MAX_COMMIT_LAYOUT || value.drop.length > MAX_COMMIT_DROPS) return null;
  const layout = value.layout.map(parseRow);
  const drop = value.drop.map(parseDrop);
  if (layout.includes(null) || drop.includes(null)) return null;
  return { layout: layout as BagLayoutRow[], drop: drop as BagDrop[] };
}
