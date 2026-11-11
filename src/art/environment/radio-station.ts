// The radio station: concrete broadcast studio, flat gravel roof with transmitter
// conduits, satellite dishes, AC chillers, studio windows, and an illuminated ON AIR sign.

import type { PixelSprite } from '../types.ts';
import { RAMPS } from '../palette.ts';
import { bars, glass, grime, streak } from './facade.ts';
import type { Trim } from './facade.ts';
import { acUnit, roofVent, tarPatch, turbineVent } from './roof-kit.ts';
import { bakeShell, caseLamp, doorway, startShell } from './shell.ts';
import type { Shell } from './shell.ts';
import { GREY_PARAPET, parapetRoof, puddle, rollSeams } from './shop.ts';
import { blockText, signBoard, smallText } from './signage.ts';

const { asphalt, blood, bone, concrete, fire, ink, metal, teal } = RAMPS;

const WALL = 32;
const ROOF_TOP = 4;
const CHROME: Trim = [metal[0], metal[1], metal[2]];

function roof(s: Shell): void {
  const { c, left, right, wallTop } = s;
  const shade = asphalt[1];
  const box = parapetRoof(s, ROOF_TOP, {
    ...GREY_PARAPET,
    field: asphalt[2],
    shade,
    lit: concrete[2],
    top: concrete[1],
    face: concrete[0],
    low: ink[1],
  });

  rollSeams(c, box, [36, 72, 108], asphalt[1]);
  tarPatch(c, left + 14, 60, [[2, 10], [0, 16], [0, 18], [3, 14]]);
  tarPatch(c, left + 90, 48, [[3, 12], [1, 16], [0, 18], [2, 14]]);
  puddle(c, left + 110, 80, 22);

  // Studio air handling & transmitter cooling units
  acUnit(c, left + 20, 14, 20, shade);
  acUnit(c, left + 46, 14, 20, shade);
  turbineVent(c, left + 76, 20, shade);
  roofVent(c, left + 98, 22, shade);

  // Roof Satellite Dish on mount
  const dishX = left + 128;
  const dishY = 32;
  c.rect(dishX - 1, dishY + 6, 3, 5, metal[1]);
  c.rect(dishX - 8, dishY - 2, 16, 8, metal[2]);
  c.rect(dishX - 6, dishY - 4, 12, 11, bone[2]);
  c.px(dishX, dishY + 1, metal[3]); // Center horn

  // Transmitter cable conduit running along the roof to the right edge (towards the tower yard)
  c.rect(left + 80, wallTop - 8, right - (left + 80), 2, ink[0]);
  c.rect(left + 80, wallTop - 9, right - (left + 80), 1, metal[1]);
}

function front(s: Shell): void {
  const { c, left, right, footW, ground, wallTop, doorL, doorR } = s;

  // Concrete studio wall
  c.rect(left, wallTop, footW, WALL, concrete[1]);
  c.rect(left, wallTop, 1, WALL, concrete[2]);
  c.rect(right, wallTop, 1, WALL, concrete[0]);
  c.rect(left, ground - 3, footW, 3, concrete[0]);
  c.rect(left, ground - 3, footW, 1, concrete[2]);

  // Main station signage board
  signBoard(c, left + 6, wallTop + 2, footW - 12, 11, ink[1], metal[2]);
  blockText(c, left + 12, wallTop + 4, 'RADIO', fire[2], ink[0]);
  smallText(c, left + 52, wallTop + 5, 'BROADCAST', bone[2]);

  // Glowing "ON AIR" indicator box
  const onAirX = right - 36;
  const onAirY = wallTop + 3;
  c.rect(onAirX, onAirY, 28, 9, blood[0]);
  c.rect(onAirX, onAirY, 28, 1, blood[2]);
  c.rect(onAirX, onAirY, 1, 9, blood[2]);
  smallText(c, onAirX + 3, onAirY + 2, 'ON AIR', blood[3]);

  // Studio double windows (left of door)
  const winTop = wallTop + 16;
  c.rect(left + 12, winTop, 44, 12, ink[0]);
  c.rect(left + 12, winTop, 44, 1, metal[2]);
  c.rect(left + 12, winTop, 1, 12, metal[2]);
  glass(c, left + 14, winTop + 2, 40, 8, teal[2]);
  bars(c, left + 14, winTop + 2, 40, 8);

  // Production room window (right of door)
  c.rect(doorR + 10, winTop, 44, 12, ink[0]);
  c.rect(doorR + 10, winTop, 44, 1, metal[2]);
  c.rect(doorR + 10, winTop, 1, 12, metal[2]);
  glass(c, doorR + 12, winTop + 2, 40, 8, teal[2]);
  bars(c, doorR + 12, winTop + 2, 40, 8);

  // Steel entrance doorway with awning
  doorway(s, 19, 'steel', CHROME, concrete[0]);
  caseLamp(c, doorL - 4, ground - 18);
  caseLamp(c, doorR + 4, ground - 18);

  // Wall weathering
  streak(c, left + 28, wallTop + 13, [3, 5, 2], concrete[0]);
  streak(c, right - 22, wallTop + 13, [2, 4, 1], concrete[0]);
  grime(c, left, ground - 3, 24, [1, 3, 2], concrete[0]);
  grime(c, right - 24, ground - 3, 24, [2, 1, 3], concrete[0]);

  // Heavy conduit pipe dropping down on right wall corner to ground
  c.rect(right - 2, wallTop, 2, WALL, ink[0]);
  c.px(right - 1, wallTop, metal[2]);
}

/** Builds the standalone pixel art shell sprite for the Radio Station. */
export function buildRadioStation(): PixelSprite {
  const s = startShell('radio_station', WALL);
  roof(s);
  front(s);
  return bakeShell(s);
}
