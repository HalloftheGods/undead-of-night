import { describe, expect, it } from 'vitest';
import { CARD_H, CARD_W, cardOf } from '../src/art/difficulty-card.ts';
import type { CardDef } from '../src/art/difficulty-card.ts';
import { inPalette } from '../src/art/palette.ts';
import { ARCADE_CARD } from '../src/art/styles/arcade.ts';
import { CAMPAIGN_CARD } from '../src/art/styles/campaign.ts';
import { buildStyleCards } from '../src/art/style-cards.ts';
import type { PixelSprite } from '../src/art/types.ts';

const CARDS: ReadonlyArray<readonly [string, CardDef]> = [
  ['campaign', CAMPAIGN_CARD],
  ['arcade', ARCADE_CARD],
];

function colourAt(sprite: PixelSprite, x: number, y: number): string {
  const at = (y * sprite.w + x) * 4;
  return `${sprite.rgba[at]},${sprite.rgba[at + 1]},${sprite.rgba[at + 2]},${sprite.rgba[at + 3]}`;
}

describe('play style card pictures (#7225)', () => {
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
            if (alpha === 255) {
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

  it('keys the built cards campaign, arcade then daily', () => {
    expect(Object.keys(buildStyleCards())).toEqual(['campaign', 'arcade', 'daily']);
  });

  it('draws the two scenes at least 40% differently', () => {
    const { campaign, arcade } = buildStyleCards();
    let diff = 0;
    for (let y = 0; y < CARD_H; y++) {
      for (let x = 0; x < CARD_W; x++) if (colourAt(campaign, x, y) !== colourAt(arcade, x, y)) diff++;
    }
    expect(diff / (CARD_W * CARD_H)).toBeGreaterThanOrEqual(0.4);
  });
});
