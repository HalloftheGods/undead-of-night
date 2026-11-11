import { describe, expect, it } from 'vitest';
import { ARMOR_LEGEND, buildArmorSprite } from '../src/art/fx/armor-art.ts';
import { inPalette } from '../src/art/palette.ts';

describe('Armor Pixel Art Compliance', () => {
  it('strictly uses colors within the master 64-color palette', () => {
    for (const color of Object.values(ARMOR_LEGEND)) {
      expect(color === null || inPalette(color)).toBe(true);
    }
  });

  it('renders valid sprites for all armor tiers with positive dimensions', () => {
    const light = buildArmorSprite('light');
    expect(light.w).toBeGreaterThan(0);
    expect(light.h).toBeGreaterThan(0);

    const medium = buildArmorSprite('medium');
    expect(medium.w).toBeGreaterThan(0);
    expect(medium.h).toBeGreaterThan(0);

    const heavy = buildArmorSprite('heavy');
    expect(heavy.w).toBeGreaterThan(0);
    expect(heavy.h).toBeGreaterThan(0);
  });
});
