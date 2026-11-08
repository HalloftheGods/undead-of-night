// The interface lane. The art lives in fx/icons.ts and fx/logo.ts.

import type { UiArt } from './types.ts';
import { buildBottle, buildCandy, buildFlare, buildFireworks, buildCrosshair, buildCrosshairHead, buildHeart, buildPickupIcons, buildSilverIcon, buildSkull, buildTownMap, buildWeaponIcons, buildZombieHead } from './fx/icons.ts';
import { buildEmoteIcons } from './fx/emotes.ts';
import { buildDifficultyCards } from './difficulty-cards.ts';
import { buildLevelCards } from './level-cards.ts';
import { buildModeCards } from './mode-cards.ts';
import { buildStationCards } from './station-cards.ts';
import { buildStyleCards } from './style-cards.ts';
import { buildLogo } from './fx/logo.ts';
import { buildVanSide } from './fx/van-side.ts';

export function buildUi(): UiArt {
  return {
    crosshair: buildCrosshair(),
    crosshairHead: buildCrosshairHead(),
    weaponIcons: buildWeaponIcons(),
    pickupIcons: buildPickupIcons(),
    silverIcon: buildSilverIcon(),
    heart: buildHeart(),
    bottle: buildBottle(),
    fireworks: buildFireworks(),
    flare: buildFlare(),
    candy: buildCandy(),
    townMap: buildTownMap(),
    skull: buildSkull(),
    zombieHead: buildZombieHead(),
    emotes: buildEmoteIcons(),
    logo: buildLogo(),
    difficulty: buildDifficultyCards(),
    mode: buildModeCards(),
    style: buildStyleCards(),
    levelScenes: buildLevelCards(),
    stations: buildStationCards(),
    vanSide: buildVanSide(),
  };
}
