// The one source of item motion in both loot windows. Every move becomes a motion: an item flying in from the world
// or from the cell it left (`fly`), set down by hand (`land`, a pop only), flown back to its source when the host
// refused it (`back`), gone from a container because a teammate took it (`puff`), or thrown to the ground (`toss`).
// The canvas window (engine/loot-ui.ts) and the page window (components/use-item-arrivals.ts) only read it.

import { ref } from 'vue';
import type { EntityId } from '../../../shared/protocol.ts';
import type { MoveGridId } from '../../../shared/item-move.ts';

export const FLY_MS = 420;
export const POP_MS = 520;
/** A puff of dust where a teammate's take left the cell empty. */
export const PUFF_MS = 300;
/** A refused target cell shakes this long. */
export const SHAKE_MS = 240;

export interface WorldPoint {
  readonly x: number;
  readonly y: number;
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

/** Turns a world point into the canvas buffer's pixels and the page's, set by the renderer each frame. */
export interface ArrivalCamera {
  /** Reduced motion: nothing flies, it only pops in. */
  readonly still: boolean;
  toBuffer(point: WorldPoint): WorldPoint;
  toClient(point: WorldPoint): WorldPoint;
}

export type MotionKind = 'fly' | 'land' | 'back' | 'puff' | 'toss';
export type MotionEnd = { readonly world: WorldPoint } | { readonly cell: CellOrigin } | { readonly hand: true } | { readonly player: EntityId };

export interface Motion {
  readonly itemId: string;
  readonly itemType: string;
  readonly kind: MotionKind;
  /** Where it sets off; null when it only pops in where it now sits. */
  readonly from: MotionEnd | null;
  /** Where it ends; null for its own cell. */
  readonly to: MotionEnd | null;
  /** performance.now() when it was noted. */
  readonly at: number;
}

export type MotionPhase = { readonly kind: MotionKind; readonly phase: 'fly' | 'pop' | 'puff'; readonly t: number; readonly motion: Motion };

const motions = new Map<string, Motion>();
const shakes = new Map<string, number>();
let camera: ArrivalCamera | null = null;

/** Bumped whenever a motion is noted or the grids change under the windows, so the page window redraws. */
export const motionTick = ref(0);

export function nowMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

const isTravel = (kind: MotionKind): boolean => kind === 'fly' || kind === 'back' || kind === 'toss';

/** A new motion for an item, replacing the one it had. Reduced motion turns every flight into a landing. */
export function noteMotion(m: Omit<Motion, 'at'>, at = nowMs()): void {
  const still = camera?.still === true && isTravel(m.kind);
  const motion: Motion = still ? { ...m, kind: 'land', from: null, at } : { ...m, at };
  motions.set(m.itemId, motion);
  motionTick.value += 1;
}

/** The item is the same one under a new id (the host's for a find): its motion carries on under that id. */
export function renameMotion(from: string, to: string): void {
  const motion = motions.get(from);
  if (!motion || motions.has(to)) return;
  motions.delete(from);
  motions.set(to, { ...motion, itemId: to });
}

/** The key a cell's shake is kept under: the grid (as moves name it) and the cell, in the window's own layout. */
export function cellKey(grid: MoveGridId, x: number, y: number): string {
  return `${grid}:${x},${y}`;
}

/** The cell a refused move was aimed at shakes. */
export function noteShake(key: string, at = nowMs()): void {
  shakes.set(key, at);
  motionTick.value += 1;
}

/** How far the cell is through its shake (0 to 1), or null when it is still. */
export function shakeOf(key: string, at = nowMs()): number | null {
  const start = shakes.get(key);
  if (start === undefined) return null;
  const age = at - start;
  if (age < SHAKE_MS) return age / SHAKE_MS;
  shakes.delete(key);
  return null;
}

/** Where an item is in its motion, or null when it is just sitting in its cell. */
export function motionOf(itemId: string, at = nowMs()): MotionPhase | null {
  const motion = motions.get(itemId);
  if (!motion) return null;
  const age = at - motion.at;
  if (motion.kind === 'puff') {
    if (age < PUFF_MS) return { kind: 'puff', phase: 'puff', t: age / PUFF_MS, motion };
    motions.delete(itemId);
    return null;
  }
  const flies = isTravel(motion.kind) && motion.from !== null;
  const flyFor = flies ? FLY_MS : 0;
  if (age < flyFor) return { kind: motion.kind, phase: 'fly', t: age / FLY_MS, motion };
  if (age < flyFor + POP_MS) return { kind: motion.kind, phase: 'pop', t: (age - flyFor) / POP_MS, motion };
  motions.delete(itemId);
  return null;
}

/** Every puff still in the air: the item is gone from its grid, so the windows draw these from the cell it left. */
export function activePuffs(at = nowMs()): readonly { readonly origin: CellOrigin; readonly t: number }[] {
  const puffs: { origin: CellOrigin; t: number }[] = [];
  for (const motion of [...motions.values()]) {
    if (motion.kind !== 'puff') continue;
    const phase = motionOf(motion.itemId, at);
    const from = motion.from;
    if (phase && from && 'cell' in from) puffs.push({ origin: from.cell, t: phase.t });
  }
  return puffs;
}

export function setArrivalCamera(next: ArrivalCamera | null): void {
  camera = next;
}

export function arrivalCamera(): ArrivalCamera | null {
  return camera;
}

/** Everything forgotten: the inventory closed. */
export function clearMotions(): void {
  motions.clear();
  shakes.clear();
}

/** A hop: 0 at both ends, 1 at the top. The flight rises this curve as it goes. */
export function hop(t: number): number {
  return 4 * t * (1 - t);
}

/** Fast out, soft landing. */
export function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}
