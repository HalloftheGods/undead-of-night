const BAYER_4X4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const BAYER_CELLS = Uint8Array.from(BAYER_4X4);

/** Steps from black to full light, squeezed toward the dark where the eye sees them most. */
const LIGHT_LEVELS = 32;
const LEVEL_CURVE = 1.9;
/** Dither steps a band is divided into, one per Bayer cell. */
export const DITHER_STEPS = 16;

/**
 * Brightness steps, 0..255 ascending. Each anchor replaces the nearest step, so
 * ground lit only by that anchor lands on a level and stays flat, with no pattern.
 */
export function lightLevels(anchors: readonly number[] = []): number[] {
  const levels: number[] = [];
  for (let i = 0; i < LIGHT_LEVELS; i += 1) {
    levels.push(Math.round(255 * (i / (LIGHT_LEVELS - 1)) ** LEVEL_CURVE));
  }
  for (const anchor of anchors) {
    let nearest = 1;
    for (let i = 1; i < levels.length - 1; i += 1) {
      const closer = Math.abs(levels[i] - anchor) < Math.abs(levels[nearest] - anchor);
      if (closer) nearest = i;
    }
    levels[nearest] = anchor;
  }
  return [...new Set(levels)].sort((a, b) => a - b);
}

export interface LightBands {
  /** Indexed by floor(brightness): the levels either side of it. */
  readonly low: Uint8Array;
  readonly high: Uint8Array;
}

export function buildLightBands(levels: readonly number[]): LightBands {
  const low = new Uint8Array(256);
  const high = new Uint8Array(256);
  let band = 0;
  for (let value = 0; value < 256; value += 1) {
    while (band < levels.length - 2 && value >= levels[band + 1]) band += 1;
    low[value] = levels[band];
    high[value] = levels[band + 1];
  }
  return { low, high };
}

export function bayerThreshold(x: number, y: number): number {
  return (BAYER_4X4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
}
