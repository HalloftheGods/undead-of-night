import { describe, expect, it } from 'vitest';
import { CARD_H, CARD_W, cardOf, TALL_H, tallRows } from '../src/art/difficulty-card.ts';
import type { CardDef } from '../src/art/difficulty-card.ts';
import { buildModeCards } from '../src/art/mode-cards.ts';
import { MULTI_CARD } from '../src/art/modes/multi.ts';
import { SOLO_CARD } from '../src/art/modes/solo.ts';
import { inPalette } from '../src/art/palette.ts';
import type { PixelSprite } from '../src/art/types.ts';

const CARDS: ReadonlyArray<readonly [string, CardDef]> = [
  ['solo', SOLO_CARD],
  ['multi', MULTI_CARD],
];

function colourAt(sprite: PixelSprite, x: number, y: number): string {
  const at = (y * sprite.w + x) * 4;
  return `${sprite.rgba[at]},${sprite.rgba[at + 1]},${sprite.rgba[at + 2]},${sprite.rgba[at + 3]}`;
}

describe('play mode card pictures (#7198)', () => {
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
            const alpha = sprite.rgba[(y * sprite.w + x) * 4 + 3];
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

  it('keys the built cards solo then multi', () => {
    expect(Object.keys(buildModeCards())).toEqual(['solo', 'multi']);
  });

  it('draws the two scenes at least 40% differently', () => {
    const { solo, multi } = buildModeCards();
    let diff = 0;
    for (let y = TALL_H - CARD_H; y < TALL_H; y++) {
      for (let x = 0; x < CARD_W; x++) {
        const differs = colourAt(solo, x, y) !== colourAt(multi, x, y);
        if (differs) diff++;
      }
    }
    expect(diff / (CARD_W * CARD_H)).toBeGreaterThanOrEqual(0.4);
  });

  it('builds portrait cards, the scene kept whole under added sky', () => {
    for (const sprite of Object.values(buildModeCards())) expect([sprite.w, sprite.h]).toEqual([CARD_W, TALL_H]);
    const rows = tallRows(SOLO_CARD, { fill: 'V', dot: 'w', high: 'K' });
    expect(rows).toHaveLength(TALL_H);
    expect(rows.slice(TALL_H - CARD_H)).toEqual(SOLO_CARD.rows);
    expect(rows.every((row) => row.length === CARD_W)).toBe(true);
  });

  it('extends a scene that starts on a wall by repeating its top row', () => {
    const rows = tallRows(MULTI_CARD, 'repeat');
    expect(rows.slice(0, TALL_H - CARD_H).every((row) => row === MULTI_CARD.rows[0])).toBe(true);
  });
});
