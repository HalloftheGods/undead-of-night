import { describe, expect, it } from 'vitest';
import {
  BARRICADE_TIER_1_GRID,
  BARRICADE_TIER_2_GRID,
  BARRICADE_TIER_3_GRID,
  BARRICADE_TIER_4_GRID,
  buildBarricadeSprite,
  buildCurtainSprite,
  buildGlassShardsSprite,
  CURTAIN_CLOSED_GRID,
  CURTAIN_OPEN_GRID,
  FORTIFICATION_LEGEND,
  GLASS_SHARDS_GRID,
} from '../src/art/fx/fortification-art.ts';

describe('Fortification Pixel Art Sprites', () => {
  it('builds barricade sprites for all 4 tiers with 32x16 dimensions', () => {
    const tier1 = buildBarricadeSprite(1);
    expect(tier1.w).toBe(32);
    expect(tier1.h).toBe(16);

    const tier2 = buildBarricadeSprite(2);
    expect(tier2.w).toBe(32);
    expect(tier2.h).toBe(16);

    const tier3 = buildBarricadeSprite(3);
    expect(tier3.w).toBe(32);
    expect(tier3.h).toBe(16);

    const tier4 = buildBarricadeSprite(4);
    expect(tier4.w).toBe(32);
    expect(tier4.h).toBe(16);
  });

  it('builds open and closed curtain sprites with 16x16 dimensions', () => {
    const openCurtain = buildCurtainSprite(false);
    expect(openCurtain.w).toBe(16);
    expect(openCurtain.h).toBe(16);

    const closedCurtain = buildCurtainSprite(true);
    expect(closedCurtain.w).toBe(16);
    expect(closedCurtain.h).toBe(16);
  });

  it('builds glass shards ground decal with 16x16 dimensions', () => {
    const shards = buildGlassShardsSprite();
    expect(shards.w).toBe(16);
    expect(shards.h).toBe(16);
  });

  it('verifies that all grid characters map cleanly to FORTIFICATION_LEGEND', () => {
    const grids = [
      BARRICADE_TIER_1_GRID,
      BARRICADE_TIER_2_GRID,
      BARRICADE_TIER_3_GRID,
      BARRICADE_TIER_4_GRID,
      CURTAIN_OPEN_GRID,
      CURTAIN_CLOSED_GRID,
      GLASS_SHARDS_GRID,
    ];

    for (const grid of grids) {
      for (const row of grid) {
        for (const char of row) {
          const isTransparent = char === '.';
          if (isTransparent) continue;
          expect(FORTIFICATION_LEGEND[char]).toBeDefined();
        }
      }
    }
  });
});
