import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../shared/difficulty.ts';
import { CARD_H, CARD_W, cardOf, TALL_H } from '../src/art/difficulty-card.ts';
import type { CardDef } from '../src/art/difficulty-card.ts';
import { buildDifficultyCards } from '../src/art/difficulty-cards.ts';
import { LIGHTS_OUT_CARD } from '../src/art/difficulty/lights-out.ts';
import { NIGHT_LIGHT_CARD } from '../src/art/difficulty/night-light.ts';
import { STAY_CLOSE_CARD } from '../src/art/difficulty/stay-close.ts';
import { UNDEAD_TIRED_CARD } from '../src/art/difficulty/undead-tired.ts';
import { inPalette } from '../src/art/palette.ts';
import type { PixelSprite } from '../src/art/types.ts';

const CARDS: ReadonlyArray<readonly [string, CardDef]> = [
  ['night_light', NIGHT_LIGHT_CARD],
  ['stay_close', STAY_CLOSE_CARD],
  ['lights_out', LIGHTS_OUT_CARD],
  ['undead_tired', UNDEAD_TIRED_CARD],
];

function alphaAt(sprite: PixelSprite, x: number, y: number): number {
  return sprite.rgba[(y * sprite.w + x) * 4 + 3];
}

function colourAt(sprite: PixelSprite, x: number, y: number): string {
  const at = (y * sprite.w + x) * 4;
  return `${sprite.rgba[at]},${sprite.rgba[at + 1]},${sprite.rgba[at + 2]},${sprite.rgba[at + 3]}`;
}

/** Fraction of the scene's pixels (under the added sky) that differ between two portrait cards. */
function differing(a: PixelSprite, b: PixelSprite): number {
  let diff = 0;
  for (let y = TALL_H - CARD_H; y < TALL_H; y++) {
    for (let x = 0; x < CARD_W; x++) {
      const differs = colourAt(a, x, y) !== colourAt(b, x, y);
      if (differs) diff++;
    }
  }
  return diff / (CARD_W * CARD_H);
}

describe('difficulty card pictures (#7192)', () => {
  for (const [id, def] of CARDS) {
    describe(id, () => {
      it('is a CARD_H by CARD_W grid', () => {
        expect(def.rows).toHaveLength(CARD_H);
        expect(def.rows.map((row) => row.length)).toEqual(def.rows.map(() => CARD_W));
      });

      it('has every grid letter in its legend and every colour in the palette', () => {
        const letters = new Set(def.rows.join('').replaceAll('.', ''));
        const missing = [...letters].filter((letter) => !(letter in def.legend));
        expect(missing).toEqual([]);
        const off = Object.values(def.legend).filter((colour) => colour !== null && !inPalette(colour));
        expect(off).toEqual([]);
      });

      it('builds a full-scene, hard-edged card', () => {
        const sprite = cardOf(def);
        expect([sprite.w, sprite.h]).toEqual([CARD_W, CARD_H]);

        let opaque = 0;
        const colours = new Set<string>();
        for (let y = 0; y < CARD_H; y++) {
          for (let x = 0; x < CARD_W; x++) {
            const alpha = alphaAt(sprite, x, y);
            expect([0, 255]).toContain(alpha);
            const isOpaque = alpha === 255;
            if (isOpaque) {
              opaque++;
              colours.add(colourAt(sprite, x, y));
            }
          }
        }
        expect(opaque / (CARD_W * CARD_H)).toBeGreaterThanOrEqual(0.92);
        expect(colours.size).toBeLessThanOrEqual(28);
      });
    });
  }

  it('keys the built cards by difficulty id, in order', () => {
    expect(Object.keys(buildDifficultyCards())).toEqual(DIFFICULTIES.map((each) => each.id));
  });

  it('builds every card as a portrait', () => {
    for (const sprite of Object.values(buildDifficultyCards())) expect([sprite.w, sprite.h]).toEqual([CARD_W, TALL_H]);
  });

  it('draws every pair of scenes at least 40% differently', () => {
    const built = buildDifficultyCards();
    const ids = Object.keys(built) as Array<keyof typeof built>;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        expect(differing(built[ids[i]], built[ids[j]]), `${ids[i]} vs ${ids[j]}`).toBeGreaterThanOrEqual(0.4);
      }
    }
  });
});
