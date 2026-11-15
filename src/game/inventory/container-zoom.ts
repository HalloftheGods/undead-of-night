// A searched container flies out of the world into its loot window. Opening it starts a zoom keyed by its id;
// the world renderer reports where the prop stands each frame, and both loot windows read one shared clock from
// here, so a remount of the page window (it remounts on every use or drop) picks up where the zoom is instead of
// replaying it. Plain module state, like pickup-arrivals.ts: nothing here needs to be reactive.

import type { ContainerArt } from '../../art/containers.ts';
import type { StageBox } from './container-stage.ts';
import { easeOut, nowMs } from './pickup-arrivals.ts';
import type { ArrivalCamera, ScreenRect, WorldPoint } from './pickup-arrivals.ts';

export const ZOOM_MS = 400;
export const FADE_MS = 180;
/** Once landed, the sweep catches up with the sim's progress at this pace (a whole search in this long). */
export const CATCH_MS = 450;
/** A close and reopen of the same container this quickly is a rebuild, not a new search: the zoom resumes. */
export const REJOIN_MS = 300;
/** No world frame this soon after opening: the prop cannot be found, so the window fades in instead. */
export const WAIT_MS = 120;
export const BACK_MS = 180;
/** The loot window's amber, so the outline reads as the same thing the window is showing. */
export const SEARCH_OUTLINE = '#e8a33d';

export type ZoomMode = 'zoom' | 'fade' | 'still';
export type ZoomSpace = 'buffer' | 'client';

export interface ZoomFrame {
  readonly kind: 'none' | 'wait' | ZoomMode;
  readonly t: number;
  readonly eased: number;
  readonly landed: boolean;
  /** Where the prop's stage box stood in the world, in world pixels, when the zoom began. */
  readonly from: ScreenRect | null;
}

export interface BackFlight {
  readonly from: ScreenRect;
  readonly to: ScreenRect;
  readonly space: ZoomSpace;
  readonly art: ContainerArt | null;
  /** Which drawing flies back: the open one once searched, the shut one when closed mid-search. */
  readonly searched: boolean;
  readonly t: number;
  readonly eased: number;
}

interface ZoomSource {
  readonly id: number;
  readonly openedAt: number;
  world: ScreenRect | null;
  art: ContainerArt | null;
  drawn: boolean;
  mode: ZoomMode | null;
  startedAt: number | null;
  from: ScreenRect | null;
}

let source: ZoomSource | null = null;
let last: { source: ZoomSource; endedAt: number } | null = null;
let back: { from: ScreenRect; to: ScreenRect; space: ZoomSpace; art: ContainerArt | null; searched: boolean; at: number } | null = null;
let stage: { rect: ScreenRect; space: ZoomSpace; searched: boolean } | null = null;

export function beginContainerZoom(id: number, at = nowMs()): void {
  if (source?.id === id) return;
  const rejoins = last !== null && last.source.id === id && at - last.endedAt < REJOIN_MS;
  source = rejoins && last ? last.source : { id, openedAt: at, world: null, art: null, drawn: false, mode: null, startedAt: null, from: null };
  back = null;
  last = null;
}

export function endContainerZoom(at = nowMs()): void {
  if (source) {
    last = { source, endedAt: at };
    const landed = zoomFrame(at).landed;
    const canFlyBack = landed && source.world !== null && stage !== null;
    back = canFlyBack && source.world && stage ? { from: source.world, to: stage.rect, space: stage.space, art: source.art, searched: stage.searched, at } : null;
  }
  source = null;
  stage = null;
}

/** The container whose window is open, so the world can outline its prop. */
export function searchedContainer(): number | null {
  return source?.id ?? null;
}

/** The world drew this container's prop this frame, with its stage box here in world pixels. */
export function noteContainerDrawn(id: number, world: ScreenRect, art: ContainerArt): void {
  if (source?.id !== id) return;
  source.world = world;
  source.art = art;
  source.drawn = true;
}

/** Once a world frame: the first one after opening picks how the container arrives. */
export function noteWorldFrame(at: number, still: boolean): void {
  if (!source) return;
  if (source.mode === null) {
    const wasDrawn = source.drawn && source.world !== null;
    const flies: ZoomMode = wasDrawn ? 'zoom' : 'fade';
    source.mode = still ? 'still' : flies;
    source.from = source.world;
    source.startedAt = at;
  }
  source.drawn = false;
}

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

export function zoomFrame(at = nowMs()): ZoomFrame {
  if (!source) return { kind: 'none', t: 1, eased: 1, landed: true, from: null };
  const waiting = source.mode === null && at - source.openedAt < WAIT_MS;
  if (waiting) return { kind: 'wait', t: 0, eased: 0, landed: false, from: null };
  const mode = source.mode ?? 'fade';
  if (mode === 'still') return { kind: 'still', t: 1, eased: 1, landed: true, from: null };
  const startedAt = source.startedAt ?? source.openedAt + WAIT_MS;
  const t = clamp01((at - startedAt) / (mode === 'zoom' ? ZOOM_MS : FADE_MS));
  return { kind: mode, t, eased: easeOut(t), landed: t >= 1, from: mode === 'zoom' ? source.from : null };
}

/** -Infinity with no zoom (nothing to wait for), Infinity until it lands, then the time it landed. */
export function zoomLandedAt(at = nowMs()): number {
  if (!source) return Number.NEGATIVE_INFINITY;
  if (!zoomFrame(at).landed) return Number.POSITIVE_INFINITY;
  const mode = source.mode ?? 'fade';
  const startedAt = source.startedAt ?? source.openedAt + WAIT_MS;
  if (mode === 'still') return startedAt;
  return startedAt + (mode === 'zoom' ? ZOOM_MS : FADE_MS);
}

/** The sweep shown: held at nothing until the zoom lands, then catching up with the sim, never ahead of it. */
export function heldSweep(raw: number, landedAt: number, at: number): number {
  return Math.min(raw, Math.max(0, (at - landedAt) / CATCH_MS));
}

export function lerpRect(a: ScreenRect, b: ScreenRect, t: number): ScreenRect {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t };
}

/** The stage box placed by the prop's anchor, in world pixels. */
export function stageWorldRect(anchor: WorldPoint, box: StageBox): ScreenRect {
  return { x: anchor.x + box.minX, y: anchor.y + box.minY, w: box.width, h: box.height };
}

/** A world rect in the canvas buffer's pixels or the page's, through both corners so the zoom scales it. */
export function toSpace(rect: ScreenRect, camera: ArrivalCamera, space: ZoomSpace): ScreenRect {
  const map = (point: WorldPoint): WorldPoint => (space === 'buffer' ? camera.toBuffer(point) : camera.toClient(point));
  const a = map({ x: rect.x, y: rect.y });
  const b = map({ x: rect.x + rect.w, y: rect.y + rect.h });
  return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
}

/** Where the window last drew its stage, so a close can fly the art back from there. */
export function noteStageRect(space: ZoomSpace, rect: ScreenRect, searched = true): void {
  if (source) stage = { rect, space, searched };
}

export function backFlight(at = nowMs()): BackFlight | null {
  if (!back) return null;
  const t = (at - back.at) / BACK_MS;
  const isOver = t >= 1 || t < 0;
  if (isOver) {
    back = null;
    return null;
  }
  return { from: back.from, to: back.to, space: back.space, art: back.art, searched: back.searched, t, eased: easeOut(t) };
}

/** Everything forgotten, for tests. */
export function resetContainerZoom(): void {
  source = null;
  last = null;
  back = null;
  stage = null;
}
