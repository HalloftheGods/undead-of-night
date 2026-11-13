// The interface lane. The art lives in fx/icons.ts and fx/logo.ts.

import type { UiArt } from './types.ts';
import { buildBottle, buildCandy, buildFountain, buildFireworks, buildCrosshair, buildCrosshairHead, buildHeart, buildPickupIcons, buildSilverIcon, buildSkull, buildTownMap, buildWeaponIcons, buildZombieHead } from './fx/icons.ts';
import { buildCandyArt } from './fx/candies.ts';
import { buildEmoteIcons } from './fx/emotes.ts';
import { buildDifficultyCards } from './difficulty-cards.ts';
import { buildLevelCards } from './level-cards.ts';
import { buildModeCards } from './mode-cards.ts';
import { buildStationCards } from './station-cards.ts';
import { buildStyleCards } from './style-cards.ts';
import { buildLogoFrames } from './fx/logo.ts';
import { buildLongIcons } from './fx/long-icons.ts';
import { buildMoodleIcons } from './fx/moodles.ts';
import { buildVanSide } from './fx/van-side.ts';
import { buildBookCovers } from './book-covers.ts';

/** Frames in the title logo's loop. Frame 0 is the still logo. */
export const LOGO_FRAME_COUNT = 8;

export function buildUi(): UiArt {
  const logoFrames = buildLogoFrames(LOGO_FRAME_COUNT);
  return {
    crosshair: buildCrosshair(),
    crosshairHead: buildCrosshairHead(),
    weaponIcons: buildWeaponIcons(),
    pickupIcons: buildPickupIcons(),
    longIcons: buildLongIcons(),
    silverIcon: buildSilverIcon(),
    heart: buildHeart(),
    bottle: buildBottle(),
    fireworks: buildFireworks(),
    fountain: buildFountain(),
    candy: buildCandy(),
    candies: buildCandyArt(),
    townMap: buildTownMap(),
    skull: buildSkull(),
    zombieHead: buildZombieHead(),
    emotes: buildEmoteIcons(),
    logo: logoFrames[0],
    logoFrames,
    difficulty: buildDifficultyCards(),
    mode: buildModeCards(),
    style: buildStyleCards(),
    levelScenes: buildLevelCards(),
    stations: buildStationCards(),
    bookCovers: buildBookCovers(),
    vanSide: buildVanSide(),
    moodles: buildMoodleIcons(),
  };
}
