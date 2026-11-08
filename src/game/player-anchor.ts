// Where the survivor stands in the window, published as CSS variables.
//
// The HUD's own state is rebuilt a few times a second (run-hud.ts), far too slowly for anything
// to sit on the survivor while they walk. So the run's frame writes the spot straight onto
// <html> as `--player-x` and `--player-y`, and the overlay follows it in CSS with no Vue work
// per frame. Anything reading them wants a fallback for the frames before the first write:
// `var(--player-x, 50%)`.

/** A spot in the window, in CSS pixels. */
export interface Anchor {
  readonly x: number;
  readonly y: number;
}

const X_VAR = '--player-x';
const Y_VAR = '--player-y';

/** Half a CSS pixel, as the rest of the overlay rounds to (run-frame.ts), so the ring never shimmers. */
function snap(value: number): number {
  return Math.round(value * 2) / 2;
}

/** A spot worth writing: off-screen or not-a-number means the survivor is nowhere to hang anything off. */
function isUsable(at: Anchor): boolean {
  return Number.isFinite(at.x) && Number.isFinite(at.y);
}

/**
 * Writes the anchor onto the document root, skipping frames that would write the same two numbers.
 * One instance per run frame: it remembers what it last wrote.
 */
export class PlayerAnchor {
  private lastX: number | null = null;
  private lastY: number | null = null;

  /** Null clears the variables, so a stale spot never outlives the run that made it. */
  write(at: Anchor | null, root: HTMLElement = document.documentElement): void {
    const gone = at === null || !isUsable(at);
    if (gone) {
      this.clear(root);
      return;
    }
    const x = snap(at.x);
    const y = snap(at.y);
    const same = x === this.lastX && y === this.lastY;
    if (same) return;
    this.lastX = x;
    this.lastY = y;
    root.style.setProperty(X_VAR, `${x}px`);
    root.style.setProperty(Y_VAR, `${y}px`);
  }

  clear(root: HTMLElement = document.documentElement): void {
    const alreadyClear = this.lastX === null && this.lastY === null;
    if (alreadyClear) return;
    this.lastX = null;
    this.lastY = null;
    root.style.removeProperty(X_VAR);
    root.style.removeProperty(Y_VAR);
  }
}
