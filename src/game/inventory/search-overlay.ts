import { ref } from 'vue';
import { containerLook } from '../../art/containers.ts';
import type { ContainerArt } from '../../art/containers.ts';
import type { ArtBook } from '../../art/types.ts';
import { paintedContainer } from '../../engine/car-looks.ts';
import { spriteDataUrl } from '../../engine/sprite-cache.ts';
import { CONTAINER_LABEL } from '../../../shared/containers.ts';
import type { ContainerKind } from '../../../shared/containers.ts';
import { isVerticalLook } from '../../../shared/container-flip.ts';
import type { InventoryGrid } from '../../../shared/grid-inventory.ts';
import { stageBox, stageOffset, stageSprite } from './container-stage.ts';
import { heldSweep, zoomLandedAt } from './container-zoom.ts';

export type PlacedProp = Parameters<typeof paintedContainer>[1];

/** The container the local player is searching right now, and how far through the search is. */
export interface SearchingNow {
  readonly id: number;
  readonly kind: ContainerKind;
  readonly propIndex?: number;
  /** 0..1 through the search, as the sim reports it. */
  readonly progress: number;
  /** The searcher's Loot slot, 0..STAT_SLOTS: it picks how the sweep reads the grid. */
  readonly lootSlot?: number;
}

/** How far through the search of the open container the sweep has got, 0..1, or null when no search is under way. */
export const searchSweep = ref<number | null>(null);
/** The sweep the windows draw: held at 0 while the container zooms in, then catching up with searchSweep. */
export const shownSweep = ref<number | null>(null);

let lastSearchMs = Number.NEGATIVE_INFINITY;
let target = 0;
let rate = 0;
let stamp = 0;
let frame = 0;
/** The order the sweep reads the grid in, set by the searcher's Loot slot as the search runs. */
let sweepPattern: SweepPattern = 'random';

function carry(now: number): void {
  const current = searchSweep.value;
  const isSweepIdle = current === null;
  if (isSweepIdle) return;
  searchSweep.value = Math.min(1, Math.max(current, target + rate * (now - stamp)));
  shownSweep.value = heldSweep(searchSweep.value, zoomLandedAt(now), now);
  frame = requestAnimationFrame(carry);
}

/**
 * The sim reports progress about ten times a second, so the sweep is carried forward at the rate it has been
 * moving, and never past the end. It follows the sim's own number, so it takes exactly as long as the search.
 */
export function feedSearch(progress: number | null, lootSlot = 0): void {
  lastSearchMs = performance.now();
  const isSearchOver = progress === null;
  if (isSearchOver) {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    searchSweep.value = null;
    shownSweep.value = null;
    return;
  }
  sweepPattern = sweepPatternFor(lootSlot);
  const now = performance.now();
  const isSweepNotStarted = searchSweep.value === null;
  if (isSweepNotStarted) {
    target = 0;
    rate = 0;
    stamp = now;
    searchSweep.value = 0;
    shownSweep.value = 0;
    frame = requestAnimationFrame(carry);
  }
  const dt = now - stamp;
  const isProgressAdvancing = dt > 0 && progress > target;
  if (isProgressAdvancing) rate = Math.min(0.002, (progress - target) / dt);
  target = progress;
  stamp = now;
}

export interface SweepRanks {
  /** How many cells the sweep visits: the whole grid, voids included. */
  readonly open: number;
  /** Where a cell falls in the sweep, in a random order, always set: a void is found like any other cell. */
  rankOf(col: number, row: number): number;
}

/**
 * The order a search reads the grid in. The first two Loot slots are a random defrag pass; each slot after that reads
 * the grid in a tighter, more geometric order, so a survivor who has looted a lot sweeps it in a pattern.
 */
export type SweepPattern = 'random' | 'rows' | 'columns' | 'diagonal' | 'spiral';

export function sweepPatternFor(lootSlot: number): SweepPattern {
  const isSpiralSlot = lootSlot >= 5;
  const isDiagonalSlot = lootSlot === 4;
  const isColumnsSlot = lootSlot === 3;
  const isRowsSlot = lootSlot === 2;
  if (isSpiralSlot) return 'spiral';
  if (isDiagonalSlot) return 'diagonal';
  if (isColumnsSlot) return 'columns';
  if (isRowsSlot) return 'rows';
  return 'random';
}

/** The cells of a grid in the order a geometric sweep reads them, from the top left. */
function patternCells(cols: number, rows: number, pattern: Exclude<SweepPattern, 'random'>): number[] {
  const out: number[] = [];
  const at = (col: number, row: number): number => row * cols + col;
  if (pattern === 'rows') {
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) out.push(at(col, row));
  } else if (pattern === 'columns') {
    for (let col = 0; col < cols; col++) for (let row = 0; row < rows; row++) out.push(at(col, row));
  } else if (pattern === 'diagonal') {
    // Anti-diagonal bands, each started at the top and running down to the left.
    for (let band = 0; band <= cols + rows - 2; band++) {
      for (let row = 0; row < rows; row++) {
        const col = band - row;
        const isColumnInGrid = col >= 0 && col < cols;
        if (isColumnInGrid) out.push(at(col, row));
      }
    }
  } else {
    // A spiral in from the outside edge: across the top, down the right, back along the bottom, up the left.
    let top = 0;
    let bottom = rows - 1;
    let left = 0;
    let right = cols - 1;
    while (top <= bottom && left <= right) {
      for (let col = left; col <= right; col++) out.push(at(col, top));
      top++;
      for (let row = top; row <= bottom; row++) out.push(at(right, row));
      right--;
      const hasRowsLeft = top <= bottom;
      if (hasRowsLeft) for (let col = right; col >= left; col--) out.push(at(col, bottom));
      bottom--;
      const hasColumnsLeft = left <= right;
      if (hasColumnsLeft) for (let row = bottom; row >= top; row--) out.push(at(left, row));
      left++;
    }
  }
  return out;
}

const ranked = new WeakMap<InventoryGrid, { pattern: SweepPattern; ranks: SweepRanks }>();

export function sweepRanks(grid: InventoryGrid): SweepRanks {
  const pattern = sweepPattern;
  const known = ranked.get(grid);
  const isKnownForPattern = known !== undefined && known.pattern === pattern;
  if (isKnownForPattern) return known.ranks;
  let cells: number[];
  const isRandomPattern = pattern === 'random';
  if (isRandomPattern) {
    cells = [];
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        cells.push(row * grid.cols + col);
      }
    }
    // Fisher-Yates: the cells light in a random order, fixed for this grid so the sweep does not reshuffle mid-search.
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
  } else {
    cells = patternCells(grid.cols, grid.rows, pattern);
  }
  const ranks = new Map<number, number>(cells.map((cell, rank) => [cell, rank]));
  const open = cells.length;
  const made: SweepRanks = { open, rankOf: (col, row) => ranks.get(row * grid.cols + col) ?? 0 };
  ranked.set(grid, { pattern, ranks: made });
  return made;
}

export type CellPhase = 'waiting' | 'head' | 'read';

/**
 * A defrag-style read: the head lands on the open cells in a random order, and every cell it has left is done. It reaches the last cell as the search ends, so the sweep takes exactly as long as the search does.
 */
export function cellPhase(rank: number, open: number, progress: number): CellPhase {
  const hasNoCells = open <= 0;
  if (hasNoCells) return 'read';
  const isSearchDone = progress >= 1;
  if (isSearchDone) return 'read';
  const head = Math.min(open - 1, Math.floor(Math.max(0, progress) * open));
  const isBehindHead = rank < head;
  if (isBehindHead) return 'read';
  return rank === head ? 'head' : 'waiting';
}

/** The art a searched container is drawn with: its own painted car, or the look for its kind. */
export function searchArtFor(art: ArtBook, kind: ContainerKind, prop: PlacedProp | undefined, propIndex?: number): ContainerArt | null {
  if (!prop) return art.containers[kind] ?? null;
  return paintedContainer(art, prop) ?? art.containers[containerLook({ kind, prop: prop.kind, propIndex, look: prop.look })] ?? null;
}

export function searchTitle(kind: ContainerKind): string {
  return CONTAINER_LABEL[kind];
}

/** A car parked nose up is drawn standing on end, so its grid stands on end too. */
export function searchFlipped(prop: { readonly kind?: string } | undefined): boolean {
  return isVerticalLook(prop?.kind);
}

/** A container's drawing placed by its anchor in the box that holds both, as an SVG image: shut while searching, open once searched. */
export function stageView(art: ContainerArt, searched: boolean): { url: string; viewBox: string; x: number; y: number; w: number; h: number } | null {
  const box = stageBox(art);
  const sprite = stageSprite(art, searched);
  const isStageMissing = !box || !sprite;
  if (isStageMissing) return null;
  const at = stageOffset(box, sprite);
  return { url: spriteDataUrl(sprite), viewBox: `0 0 ${box.width} ${box.height}`, x: at.x, y: at.y, w: sprite.w, h: sprite.h };
}

/** After the search ends, every item sits as a "?" and flips to what it is in random order over this long. */
export const REVEAL_MS = 700;
/** A search that ended this recently is the one whose loot has just arrived. */
const REVEAL_WINDOW_MS = 1500;

/** How far through the reveal, 0..1, or null when nothing is hiding. */
export const revealProgress = ref<number | null>(null);
let revealRanks = new Map<string, number>();
let revealStart = 0;
let revealFrame = 0;

function runReveal(now: number): void {
  // The '?' reveal waits for the container to land, whichever order the search end and the reopen ran in.
  const isZoomPending = zoomLandedAt(now) === Number.POSITIVE_INFINITY;
  if (isZoomPending) {
    revealStart = now;
    revealProgress.value = 0;
    revealFrame = requestAnimationFrame(runReveal);
    return;
  }
  const done = (now - revealStart) / REVEAL_MS;
  const isRevealDone = done >= 1;
  if (isRevealDone) {
    revealProgress.value = null;
    revealFrame = 0;
    return;
  }
  revealProgress.value = done;
  revealFrame = requestAnimationFrame(runReveal);
}

/** Loot that arrives with the end of a search starts hidden. Loot from a reopened container is shown as it is. */
export function startReveal(items: readonly { readonly id: string }[]): void {
  const fresh = performance.now() - lastSearchMs < REVEAL_WINDOW_MS;
  const hasNoFreshLoot = !fresh || items.length === 0;
  if (hasNoFreshLoot) return;
  const order = items.map((item) => item.id);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  revealRanks = new Map(order.map((id, rank) => [id, rank]));
  revealStart = performance.now();
  if (revealFrame) cancelAnimationFrame(revealFrame);
  revealProgress.value = 0;
  revealFrame = requestAnimationFrame(runReveal);
}

/** True while this item still shows as a "?". */
export function itemHidden(id: string): boolean {
  const progress = revealProgress.value;
  const isNothingHiding = progress === null;
  if (isNothingHiding) return false;
  const rank = revealRanks.get(id);
  return rank !== undefined && progress * revealRanks.size <= rank;
}
