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

export type PlacedProp = Parameters<typeof paintedContainer>[1];

/** The container the local player is searching right now, and how far through the search is. */
export interface SearchingNow {
  readonly id: number;
  readonly kind: ContainerKind;
  readonly propIndex?: number;
  /** 0..1 through the search, as the sim reports it. */
  readonly progress: number;
}

/** How far through the search of the open container the sweep has got, 0..1, or null when no search is under way. */
export const searchSweep = ref<number | null>(null);

let lastSearchMs = Number.NEGATIVE_INFINITY;
let target = 0;
let rate = 0;
let stamp = 0;
let frame = 0;

function carry(now: number): void {
  const current = searchSweep.value;
  if (current === null) return;
  searchSweep.value = Math.min(1, Math.max(current, target + rate * (now - stamp)));
  frame = requestAnimationFrame(carry);
}

/**
 * The sim reports progress about ten times a second, so the sweep is carried forward at the rate it has been
 * moving, and never past the end. It follows the sim's own number, so it takes exactly as long as the search.
 */
export function feedSearch(progress: number | null): void {
  lastSearchMs = performance.now();
  if (progress === null) {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    searchSweep.value = null;
    return;
  }
  const now = performance.now();
  if (searchSweep.value === null) {
    target = 0;
    rate = 0;
    stamp = now;
    searchSweep.value = 0;
    frame = requestAnimationFrame(carry);
  }
  const dt = now - stamp;
  if (dt > 0 && progress > target) rate = Math.min(0.002, (progress - target) / dt);
  target = progress;
  stamp = now;
}

export interface SweepRanks {
  /** How many cells the sweep visits: the whole grid, voids included. */
  readonly open: number;
  /** Where a cell falls in the sweep, in a random order, always set: a void is found like any other cell. */
  rankOf(col: number, row: number): number;
}

const ranked = new WeakMap<InventoryGrid, SweepRanks>();

export function sweepRanks(grid: InventoryGrid): SweepRanks {
  const known = ranked.get(grid);
  if (known) return known;
  const cells: number[] = [];
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
  const ranks = new Map<number, number>(cells.map((cell, rank) => [cell, rank]));
  const open = cells.length;
  const made: SweepRanks = { open, rankOf: (col, row) => ranks.get(row * grid.cols + col) ?? 0 };
  ranked.set(grid, made);
  return made;
}

export type CellPhase = 'waiting' | 'head' | 'read';

/**
 * A defrag-style read: the head lands on the open cells in a random order, and every cell it has left is done. It reaches the last cell as the search ends, so the sweep takes exactly as long as the search does.
 */
export function cellPhase(rank: number, open: number, progress: number): CellPhase {
  if (open <= 0) return 'read';
  if (progress >= 1) return 'read';
  const head = Math.min(open - 1, Math.floor(Math.max(0, progress) * open));
  if (rank < head) return 'read';
  return rank === head ? 'head' : 'waiting';
}

/** The art a searched container is drawn with: its own painted car, or the look for its kind. */
export function searchArtFor(art: ArtBook, kind: ContainerKind, prop: PlacedProp | undefined, propIndex?: number): ContainerArt | null {
  if (!prop) return art.containers[kind] ?? null;
  return paintedContainer(art, prop) ?? art.containers[containerLook({ kind, prop: prop.kind, propIndex })] ?? null;
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
  if (!box || !sprite) return null;
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
  const done = (now - revealStart) / REVEAL_MS;
  if (done >= 1) {
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
  if (!fresh || items.length === 0) return;
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
  if (progress === null) return false;
  const rank = revealRanks.get(id);
  return rank !== undefined && progress * revealRanks.size <= rank;
}
