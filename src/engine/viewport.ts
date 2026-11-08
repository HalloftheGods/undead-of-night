import { COOP_VIEW_REACH } from '../../shared/view-reach.ts';

export const TARGET_VIEW_W = 480;
export const TARGET_VIEW_H = 270;

export interface Viewport {
  /** Device pixels per art pixel. Always a whole number. */
  readonly scale: number;
  /** The back buffer, in art pixels. */
  readonly bufferW: number;
  readonly bufferH: number;
  /** CSS size of the canvas: the buffer at scale, a touch past the window edge when ceil rounded up. */
  readonly cssW: number;
  readonly cssH: number;
  /** Where the canvas sits in the window: 0, or the bar left by a capped view. */
  readonly left: number;
  readonly top: number;
  readonly dpr: number;
}

/**
 * A tall window turns the target view on its side, so a phone sees the same town held either
 * way round: more height and less width. `reach`, in art pixels from the middle, stops the view
 * growing past it along either axis; the window keeps a bar of night around it.
 */
export function computeViewport(cssW: number, cssH: number, dpr: number, reach: number | null = null): Viewport {
  const tall = cssH > cssW;
  const fitW = tall ? TARGET_VIEW_H : TARGET_VIEW_W;
  const fitH = tall ? TARGET_VIEW_W : TARGET_VIEW_H;
  const scale = Math.max(1, Math.round(Math.min(cssW / fitW, cssH / fitH) * dpr));
  const most = reach === null ? Infinity : reach * 2;
  const bufferW = Math.max(1, Math.min(most, Math.ceil((cssW * dpr) / scale)));
  const bufferH = Math.max(1, Math.min(most, Math.ceil((cssH * dpr) / scale)));
  const shownW = (bufferW * scale) / dpr;
  const shownH = (bufferH * scale) / dpr;
  const left = Math.max(0, Math.floor((cssW - shownW) / 2));
  const top = Math.max(0, Math.floor((cssH - shownH) / 2));
  return { scale, bufferW, bufferH, cssW: shownW, cssH: shownH, left, top, dpr };
}

/** Co-op holds a touch screen or a tall window to the same reach. A desktop's wide window keeps its whole view. */
export function viewReachCap(coop: boolean, touch: boolean, cssW: number, cssH: number): number | null {
  const held = coop && (touch || cssH > cssW);
  return held ? COOP_VIEW_REACH : null;
}

/**
 * Buffer pixels back to CSS pixels in the window: the inverse of the pointer mapping, so the
 * Vue overlay can hang something off a spot in the drawn world. `edge` is the canvas's own left or top.
 */
export function clientFromBuffer(buffer: number, edge: number, scale: number, dpr: number): number {
  return edge + (buffer * scale) / dpr;
}

/** CSS pixels per UI unit, so the Vue overlay grows in step with the game. */
export function uiUnit(cssW: number, cssH: number): number {
  return Math.max(1.5, Math.round(Math.min(cssW / TARGET_VIEW_W, cssH / TARGET_VIEW_H)) / 2);
}

/** The window a title page is laid out for, in UI units: the logo and menu with room to breathe. */
const TITLE_VIEW_W = 400;
const TITLE_VIEW_H = 360;

/** The title has the whole window, where the HUD hugs its edges, so it can stand larger. Steps by half a unit. */
export function titleUnit(cssW: number, cssH: number): number {
  return Math.max(1.5, Math.floor(Math.min(cssW / TITLE_VIEW_W, cssH / TITLE_VIEW_H) * 2) / 2);
}
