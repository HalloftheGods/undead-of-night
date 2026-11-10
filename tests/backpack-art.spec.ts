import { describe, expect, it } from 'vitest';
import { BACKPACK_LEGEND, buildBackpackSprite } from '../src/art/fx/backpack-art.ts';
import { inPalette } from '../src/art/palette.ts';

describe('Backpack Pixel Art Compliance', () => {
  it('strictly uses colors within the master 64-color palette', () => {
    for (const color of Object.values(BACKPACK_LEGEND)) {
      expect(inPalette(color)).toBe(true);
    }
  });

  it('renders valid sprites for all three tiers with non-empty bounds', () => {
    const satchel = buildBackpackSprite('satchel');
    expect(satchel.w).toBeGreaterThan(0);
    expect(satchel.h).toBeGreaterThan(0);

    const duffel = buildBackpackSprite('duffel');
    expect(duffel.w).toBeGreaterThan(0);
    expect(duffel.h).toBeGreaterThan(0);

    const alice = buildBackpackSprite('alice');
    expect(alice.w).toBeGreaterThan(0);
    expect(alice.h).toBeGreaterThan(0);
  });
});
