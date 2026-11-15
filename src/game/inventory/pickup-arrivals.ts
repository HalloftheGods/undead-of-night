// Items that reach the bag while the inventory is open. A pickup in the world is noted where it happened; when the
// open grid takes in the new item (local-bag.ts `absorb`), the item is matched to that spot and "arrives": it flies
// from the world into its cell (FLY_MS), then pops in with a flash (POP_MS). Both loot windows read this: the canvas
// one (engine/loot-ui.ts) draws it, the page one (use-item-arrivals.ts) animates its own elements.

import { ref } from 'vue';

export const FLY_MS = 420;
export const POP_MS = 520;
/** A pickup older than this is not what put the item in the bag. */
const MATCH_MS = 1500;

export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

export interface Arrival {
  readonly id: string;
  readonly type: string;
  /** performance.now() when it was taken in. */
  readonly at: number;
  /** Where in the world it was picked up; null when no pickup was seen (it only pops in). */
  readonly from: WorldPoint | null;
  /** Moved across the window by a double click: the cell it left, in each window's own pixels. It flies from there. */
  readonly origin?: CellOrigin | null;
}

export interface ScreenRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The canvas window knows its cells in buffer pixels, the page window in client pixels: each gives its own. */
export interface CellOrigin {
  readonly buffer?: ScreenRect;
  readonly client?: ScreenRect;
}

export type ArrivalPhase = { readonly phase: 'fly' | 'pop'; readonly t: number; readonly arrival: Arrival };

/** Turns a world point into the canvas buffer's pixels and the page's, set by the renderer each frame. */
export interface ArrivalCamera {
  /** Reduced motion: nothing flies, it only pops in. */
  readonly still: boolean;
  toBuffer(point: WorldPoint): WorldPoint;
  toClient(point: WorldPoint): WorldPoint;
}

let pickups: { point: WorldPoint; at: number }[] = [];
const arrivals = new Map<string, Arrival>();
let camera: ArrivalCamera | null = null;

/** Bumped whenever new items arrive, so the page's loot window knows to redraw its grids. */
export const arrivalTick = ref(0);

export function nowMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

/** The local survivor picked something up here. */
export function notePickup(point: WorldPoint, at = nowMs()): void {
  pickups = pickups.filter((entry) => at - entry.at < MATCH_MS);
  pickups.push({ point, at });
}

/** New items in the open grid: each takes the oldest pickup not yet matched, if one is recent. */
export function noteArrivals(items: readonly { id: string; type: string }[], at = nowMs()): readonly Arrival[] {
  pickups = pickups.filter((entry) => at - entry.at < MATCH_MS);
  const added = items.map((item) => {
    const spot = pickups.shift()?.point ?? null;
    const arrival: Arrival = { id: item.id, type: item.type, at, from: camera?.still ? null : spot };
    arrivals.set(item.id, arrival);
    return arrival;
  });
  if (added.length > 0) arrivalTick.value += 1;
  return added;
}

/** A double click sent this item across the window: it flies from the cell it left, then pops. */
export function noteMove(item: { id: string; type: string }, origin: CellOrigin, at = nowMs()): void {
  arrivals.set(item.id, { id: item.id, type: item.type, at, from: null, origin: camera?.still ? null : origin });
  arrivalTick.value += 1;
}

/** The player set this item down by hand (a drag or a click): no flight, just the landing. */
export function notePlaced(item: { id: string; type: string }, at = nowMs()): void {
  arrivals.set(item.id, { id: item.id, type: item.type, at, from: null });
  arrivalTick.value += 1;
}

/** Where an item is in its arrival, or null when it is just sitting in its cell. */
export function arrivalPhase(id: string, at = nowMs()): ArrivalPhase | null {
  const arrival = arrivals.get(id);
  if (!arrival) return null;
  const flies = arrival.from !== null || (arrival.origin ?? null) !== null;
  const age = at - arrival.at;
  const flyFor = flies ? FLY_MS : 0;
  if (age < flyFor) return { phase: 'fly', t: age / FLY_MS, arrival };
  if (age < flyFor + POP_MS) return { phase: 'pop', t: (age - flyFor) / POP_MS, arrival };
  arrivals.delete(id);
  return null;
}

export function setArrivalCamera(next: ArrivalCamera | null): void {
  camera = next;
}

export function arrivalCamera(): ArrivalCamera | null {
  return camera;
}

/** Everything forgotten: the inventory closed. */
export function clearArrivals(): void {
  arrivals.clear();
}

/** A hop: 0 at both ends, 1 at the top. The flight rises this curve as it goes. */
export function hop(t: number): number {
  return 4 * t * (1 - t);
}

/** Fast out, soft landing. */
export function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}
