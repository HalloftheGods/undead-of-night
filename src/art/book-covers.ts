// The Books section portrait covers. Hand-placed 56x72 pixel art matching the arcade and campaign cards.

import { CARD_W, TALL_H } from './difficulty-card.ts';
import type { PixelSprite } from './types.ts';
import { buildCandyCover } from './books/candy-card.ts';
import { buildGuideCover } from './books/guide-card.ts';
import { buildHowToCover } from './books/howto-card.ts';
import { buildPaperCover } from './books/paper-card.ts';
import { buildRecordsCover } from './books/records-card.ts';

export const BOOK_CARD_W = CARD_W;
export const BOOK_CARD_H = TALL_H;

export function buildBookCovers(): Record<string, PixelSprite> {
  return {
    changelog: buildPaperCover(),
    howto: buildHowToCover(),
    candy: buildCandyCover(),
    guide: buildGuideCover(),
    records: buildRecordsCover(),
  };
}
