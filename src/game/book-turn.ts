// Turning the pages of a printed book on the title screens: two leaves at a time on a wide screen, one on a tall one.
// Works on leaf numbers alone, so the Record Book and the changelog share it.

export type BookMode = 'spread' | 'single';

/** Screen query for mobile devices and narrow/tall viewports reading one page at a time. */
export const BOOK_MOBILE_QUERY = '(max-aspect-ratio: 1/1), (max-width: 768px), ((pointer: coarse) and (max-height: 540px))';

/** The first leaf showing: a spread always opens on an even leaf, so its pair sits together. */
export function firstShown(index: number, mode: BookMode): number {
  return mode === 'spread' ? index - (index % 2) : index;
}

/** The leaves open in front of the reader. */
export function openOf<T>(leaves: readonly T[], index: number, mode: BookMode): readonly T[] {
  const first = firstShown(index, mode);
  return leaves.slice(first, first + (mode === 'spread' ? 2 : 1));
}

export interface OpenLeaves<T> {
  readonly left: T | null;
  readonly right: T | null;
  readonly solo: T | null;
}

export function openLeavesOf<T>(leaves: readonly T[], index: number, mode: BookMode): OpenLeaves<T> {
  const first = firstShown(index, mode);
  if (mode === 'single') {
    return { left: null, right: null, solo: leaves[first] ?? null };
  }
  return {
    left: leaves[first] ?? null,
    right: leaves[first + 1] ?? null,
    solo: null,
  };
}

/**
 * One visible page turn. `under` is what shows beneath the moving leaf. A leaf on the left or right swings across the
 * gutter with a page on each face. A whole-book leaf swings away or back on the left edge, with one face.
 */
export interface BookTurn<T> {
  readonly direction: 'forward' | 'back';
  readonly leaf: 'left' | 'right' | 'whole';
  readonly under: OpenLeaves<T>;
  readonly front: T;
  readonly back: T | null;
}

export function planBookTurn<T>(from: OpenLeaves<T>, to: OpenLeaves<T>, forward: boolean): BookTurn<T> | null {
  const direction = forward ? 'forward' : 'back';
  const { left: fromLeft, right: fromRight } = from;
  const { left: toLeft, right: toRight } = to;
  const acrossGutter = fromLeft !== null && fromRight !== null && toLeft !== null && toRight !== null;
  if (acrossGutter) {
    return forward
      ? { direction, leaf: 'right', under: { left: fromLeft, right: toRight, solo: null }, front: fromRight, back: toLeft }
      : { direction, leaf: 'left', under: { left: toLeft, right: fromRight, solo: null }, front: fromLeft, back: toRight };
  }
  const swinging = forward ? from : to;
  const face = swinging.solo ?? swinging.right ?? swinging.left;
  const under = forward ? to : from;
  return face ? { direction, leaf: 'whole', under, front: face, back: null } : null;
}

/** The leaf a turn lands on, held inside a book of `count` leaves. */
export function turnWithin(count: number, index: number, by: number, mode: BookMode): number {
  const step = mode === 'spread' ? 2 : 1;
  const target = firstShown(index, mode) + by * step;
  return target < 0 || target >= count ? firstShown(index, mode) : target;
}

/** "Pages 1-2 of 4", or "Page 3 of 4" one at a time. */
export function pagesLabel(count: number, index: number, mode: BookMode): string {
  const first = firstShown(index, mode) + 1;
  const last = Math.min(count, first + (mode === 'spread' ? 1 : 0));
  const pages = last > first ? `Pages ${first}-${last}` : `Page ${first}`;
  return `${pages} of ${count}`;
}
