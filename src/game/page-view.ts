import type { PageFocusId, PageHit, PageModel } from '../engine/page-ui.ts';

/**
 * A title page as the frame should draw it, when it is drawn on the game canvas. The canvas-page controller sets and
 * clears it; the renderer reads it each draw (engine/page-ui-draw.ts). Plain state, not reactive, like setup-view.
 */
export interface PageWindow {
  model: PageModel;
  hover: PageHit | null;
  /** What the keyboard is on, or null until a key has been used. */
  focus: PageFocusId | null;
  scroll: number;
}

let current: PageWindow | null = null;

export function setPageWindow(window: PageWindow | null): void {
  current = window;
}

export function pageWindow(): PageWindow | null {
  return current;
}
