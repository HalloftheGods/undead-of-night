/** Which pair of colors the game uses for harm and for help. */
export type PaletteId = 'classic' | 'clear';

/** The colors on the canvas that say "this hurts" and "this helps". */
export interface HitPalette {
  /** Zombie health, HELP calls, the way to danger. */
  readonly danger: string;
  /** Headshot callouts. */
  readonly strike: string;
  /** Your health, revives, pickups, the way out. */
  readonly safe: string;
}

/**
 * Classic is red against green. Clear swaps them for magenta against sky blue, which
 * stay apart for red-green colorblind players (and for most others) and keep clear of amber.
 */
export const HIT_PALETTES: Readonly<Record<PaletteId, HitPalette>> = {
  classic: { danger: '#c8332a', strike: '#ff5a3c', safe: '#8fbf3a' },
  clear: { danger: '#e0368c', strike: '#ff4fa8', safe: '#5aaef0' },
};

let current: HitPalette = HIT_PALETTES.classic;

/** The palette the renderers draw with this frame. */
export function hitPalette(): HitPalette {
  return current;
}

export function setHitPalette(id: PaletteId): void {
  current = HIT_PALETTES[id] ?? HIT_PALETTES.classic;
}
