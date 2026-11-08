// Builds the two play-mode card pictures (Solo, Multiplayer) for the Play page's first pick.
// They share the difficulty cards' format and grow the same way into portrait cards (see difficulty-card.ts).

import { tallCardOf } from './difficulty-card.ts';
import type { CardReach } from './difficulty-card.ts';
import { MULTI_CARD } from './modes/multi.ts';
import { SOLO_CARD } from './modes/solo.ts';
import type { PixelSprite } from './types.ts';

export type ModeCardId = 'solo' | 'multi';

const SOLO_REACH: CardReach = { fill: 'V', dot: 'w', high: 'K' };
const MULTI_REACH: CardReach = { fill: 'K', dot: 'w' };

export function buildModeCards(): Record<ModeCardId, PixelSprite> {
  return { solo: tallCardOf(SOLO_CARD, SOLO_REACH), multi: tallCardOf(MULTI_CARD, MULTI_REACH) };
}
