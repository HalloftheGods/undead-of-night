/**
 * The container's grid in game is not drawn as a grid: the container's own drawing is the board. A cell only shows
 * when it has something to say: the search head is on it (with a short fading trail behind), the pointer is over it,
 * or an item is in hand and could go there. The search head passes over voids like any cell; otherwise a void
 * never shows, though a held item over one still marks it invalid.
 */

const AMBER = '#e8a33d';
const BONE = '#e4dcc3';
const INK = '#0b0c10';

/** How many cells behind the search head still glow as it moves on. */
export const SWEEP_TRAIL = 4;

export interface BareCellInput {
  /** Where the cell falls in the sweep, or null when no search is under way. */
  readonly rank: number | null;
  readonly open: number;
  /** 0..1 through the search. */
  readonly sweep: number;
  readonly hovered: boolean;
  readonly holding: boolean;
  readonly blocked: boolean;
}

export interface BareCellLook {
  readonly color: string;
  readonly alpha: number;
}

function sweepLook(rank: number, open: number, sweep: number): BareCellLook | null {
  if (open <= 0 || sweep >= 1) return null;
  const head = Math.min(open - 1, Math.floor(Math.max(0, sweep) * open));
  const behind = head - rank;
  if (behind === 0) return { color: AMBER, alpha: 0.8 };
  const inTrail = behind > 0 && behind <= SWEEP_TRAIL;
  return inTrail ? { color: AMBER, alpha: 0.45 * (1 - behind / (SWEEP_TRAIL + 1)) } : null;
}

/** What a bare cell paints, or null for nothing: the container's art shows through untouched. */
export function bareCellLook(cell: BareCellInput): BareCellLook | null {
  // The search reads the whole grid, voids included: the head passes over every cell of the drawing.
  if (cell.rank !== null) return sweepLook(cell.rank, cell.open, cell.sweep);
  if (cell.blocked) return null;
  if (cell.holding) return { color: INK, alpha: 0.35 };
  if (cell.hovered) return { color: BONE, alpha: 0.18 };
  return null;
}

export function drawBareCell(ctx: CanvasRenderingContext2D, look: BareCellLook, x: number, y: number, size: number): void {
  const before = ctx.globalAlpha;
  ctx.globalAlpha = look.alpha;
  ctx.fillStyle = look.color;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  ctx.globalAlpha = before;
}
