// Builds the four difficulty card pictures, keyed by difficulty id, as portrait cards (see difficulty-card.ts).

import type { DifficultyId } from '../../shared/difficulty.ts';
import { tallCardOf } from './difficulty-card.ts';
import type { CardReach } from './difficulty-card.ts';
import { LIGHTS_OUT_CARD } from './difficulty/lights-out.ts';
import { NIGHT_LIGHT_CARD } from './difficulty/night-light.ts';
import { STAY_CLOSE_CARD } from './difficulty/stay-close.ts';
import { UNDEAD_TIRED_CARD } from './difficulty/undead-tired.ts';
import type { PixelSprite } from './types.ts';

const NIGHT_LIGHT_REACH: CardReach = 'repeat';
const STAY_CLOSE_REACH: CardReach = { fill: 'V', dot: 'w', high: 'K' };
const LIGHTS_OUT_REACH: CardReach = { fill: 'k', dot: 'K' };
const UNDEAD_TIRED_REACH: CardReach = { fill: '1', dot: '2', high: 'K' };

export function buildDifficultyCards(): Record<DifficultyId, PixelSprite> {
  return {
    night_light: tallCardOf(NIGHT_LIGHT_CARD, NIGHT_LIGHT_REACH),
    stay_close: tallCardOf(STAY_CLOSE_CARD, STAY_CLOSE_REACH),
    lights_out: tallCardOf(LIGHTS_OUT_CARD, LIGHTS_OUT_REACH),
    undead_tired: tallCardOf(UNDEAD_TIRED_CARD, UNDEAD_TIRED_REACH),
  };
}
