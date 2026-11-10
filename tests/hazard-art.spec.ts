import { describe, expect, it } from 'vitest';
import {
  ALARM_CLOCK_GRID,
  buildAlarmClockSprite,
  buildCharredGroundSprite,
  buildCorpseFliesSprite,
  buildFireSprite,
  CHARRED_GROUND_GRID,
  CORPSE_FLIES_GRID,
  FIRE_FLAME_FRAME_1,
  FIRE_FLAME_FRAME_2,
  HAZARD_LEGEND,
} from '../src/art/fx/hazard-art.ts';

describe('Environmental Hazard Pixel Art Sprites', () => {
  it('builds alarm clock sprite with 16x16 dimensions', () => {
    const clock = buildAlarmClockSprite();
    expect(clock.w).toBe(16);
    expect(clock.h).toBe(16);
  });

  it('builds animated fire flame frames with 16x16 dimensions', () => {
    const frame1 = buildFireSprite(0);
    expect(frame1.w).toBe(16);
    expect(frame1.h).toBe(16);

    const frame2 = buildFireSprite(1);
    expect(frame2.w).toBe(16);
    expect(frame2.h).toBe(16);
  });

  it('builds charred ground decal and corpse flies cluster with 16x16 dimensions', () => {
    const charred = buildCharredGroundSprite();
    expect(charred.w).toBe(16);
    expect(charred.h).toBe(16);

    const flies = buildCorpseFliesSprite();
    expect(flies.w).toBe(16);
    expect(flies.h).toBe(16);
  });

  it('verifies that all grid characters map cleanly to HAZARD_LEGEND', () => {
    const grids = [
      ALARM_CLOCK_GRID,
      FIRE_FLAME_FRAME_1,
      FIRE_FLAME_FRAME_2,
      CHARRED_GROUND_GRID,
      CORPSE_FLIES_GRID,
    ];

    for (const grid of grids) {
      for (const row of grid) {
        for (const char of row) {
          const isTransparent = char === '.';
          if (isTransparent) continue;
          expect(HAZARD_LEGEND[char]).toBeDefined();
        }
      }
    }
  });
});
