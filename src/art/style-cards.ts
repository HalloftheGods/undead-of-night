// Builds the two game-style card pictures (Campaign, Arcade) for the Play page's first step.
// They share the difficulty and mode cards' size and format (see difficulty-card.ts).

import type { GameStyle } from '../../shared/game-style.ts';
import { cardOf } from './difficulty-card.ts';
import { ARCADE_CARD } from './styles/arcade.ts';
import { CAMPAIGN_CARD } from './styles/campaign.ts';
import type { PixelSprite } from './types.ts';

export function buildStyleCards(): Record<GameStyle, PixelSprite> {
  const arcade = cardOf(ARCADE_CARD);
  return { campaign: cardOf(CAMPAIGN_CARD), arcade, daily: arcade };
}
