import type { ArtBook } from '../art/types.ts';
import type { FocusId, SetupHit, SetupModel } from '../engine/setup-ui.ts';

/**
 * The setup screen as the frame should draw it, when it is drawn on the game canvas. The canvas-setup controller
 * sets and clears it; the renderer reads it each draw (engine/setup-ui-draw.ts). Plain state, not reactive, like loot-view.
 */
export interface SetupWindow {
  model: SetupModel;
  readonly art: ArtBook | null;
  /** What the pointer is over. */
  hover: SetupHit | null;
  /** What the keyboard is on, or null until a key has been used. */
  focus: FocusId | null;
  /** The option pointed at or focused in the open list: its card shows it. */
  previewed: string | null;
  /** The facing of the previewed survivor, from the spinner. */
  facing: number;
  /** True while the callsign is being typed in, so it shows a caret. */
  editing: boolean;
  /** When the screen opened (performance.now()), so its cards deal in one after another; -Infinity shows it settled. */
  shownAt: number;
  /** When the open list opened, so its options deal in the same way. */
  listShownAt: number;
}

let current: SetupWindow | null = null;

export function setSetupWindow(window: SetupWindow | null): void {
  current = window;
}

export function setupWindow(): SetupWindow | null {
  return current;
}
