// The camp's core structures: survival lodge buildings with handcrafted shingles,
// clapboard siding, stone/concrete foundations, porches, and distinct character.
// Drawn as every building is: roof and front wall in one shell, lit from upper-left.

import type { PixelSprite } from '../types.ts';
import { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Color } from '../palette.ts';
import { grime, windowUnit } from './facade.ts';
import type { Trim } from './facade.ts';
import { bakeShell, doorway, startShell } from './shell.ts';
import type { Shell } from './shell.ts';
import { blockText } from './signage.ts';
import { chimney, clapboard, dormer, shingles } from './house.ts';

const { ink, bone, denim, fire, metal, olive, wood, ash, concrete, grass } = RAMPS;

/** Front wall height under the eave. */
const WALL = 28;
const WHITE: Trim = [ash[0], bone[0], bone[1]];
const TIMBER: Trim = [wood[0], wood[1], wood[2]];
const STEEL: Trim = [metal[0], metal[1], metal[2]];

/** Covered porch over doorway with timber posts and roof overhang. */
function frontPorch(s: Shell, trim: Trim, floor: Color): void {
  const { c, ground, wallTop, doorL, doorR } = s;
  doorway(s, 22, 'timber', trim, floor);
  const px = doorL - 4;
  const pw = doorR - doorL + 8;
  const pTop = wallTop - 5;
  c.rect(px, pTop + 8, 2, ground - pTop - 9, trim[1]).rect(px, pTop + 8, 1, ground - pTop - 9, trim[2]);
  c.rect(px + pw - 2, pTop + 8, 2, ground - pTop - 9, trim[0]).rect(px + pw - 2, pTop + 8, 1, ground - pTop - 9, trim[1]);
  c.rect(px - 3, pTop, pw + 6, 6, trim[1]).rect(px - 3, pTop, pw + 6, 1, trim[2]).rect(px - 3, pTop + 3, pw + 6, 1, trim[0]);
  c.rect(px - 3, pTop + 6, pw + 6, 1, trim[1]).rect(px - 3, pTop + 7, pw + 6, 1, ink[1]);
}

/** Tarp draped over a roof section and held down by concrete blocks. */
function roofTarp(c: PixelCanvas, x: number, y: number, w: number, h: number): void {
  c.poly([[x, y + 2], [x + w, y], [x + w + 3, y + h - 2], [x + 2, y + h]], denim[1]);
  c.line(x, y + 2, x + w, y, denim[2]).line(x + 2, y + h, x + w + 3, y + h - 2, denim[0]);
  c.line(x + 6, y + 2, x + 8, y + h - 1, denim[0]).line(x + w - 6, y + 1, x + w - 4, y + h - 1, denim[0]);
  for (const [bx, by] of [[x - 1, y + 1], [x + w - 1, y - 1], [x + w + 2, y + h - 3], [x + 1, y + h - 1]] as const) {
    c.rect(bx, by, 3, 2, concrete[3]);
  }
}

const ROOF_TOP = 4;
const RIDGE_Y = 42;

// --- Market -----------------------------------------------------------------------------

/**
 * A grand survival trading post: cedar clapboard siding, stone foundation,
 * shingled gable roof with clerestory cupola, storefront windows with warm interior glow,
 * and a carved wooden "MARKET" sign mounted on iron brackets.
 */
export function buildCampMarket(): PixelSprite {
  const s = startShell('camp_market', WALL);
  const { c, left, right, footW, ground, wallTop, doorL } = s;
  const eaveL = left - 1;
  const eaveR = right + 1;

  // Dual slope shingled roof: lit upper slope and shaded lower slope.
  shingles(c, {
    points: [[eaveL, ROOF_TOP], [eaveR, ROOF_TOP], [eaveR, RIDGE_Y], [eaveL, RIDGE_Y]],
    base: wood[2],
    course: wood[1],
  });
  shingles(c, {
    points: [[eaveL, RIDGE_Y], [eaveR, RIDGE_Y], [eaveR, wallTop - 1], [eaveL, wallTop - 1]],
    base: wood[1],
    course: wood[0],
  });

  // Ridge cap and eave lines with highlights.
  c.rect(eaveL, RIDGE_Y, footW + 2, 1, wood[3]).rect(eaveL, RIDGE_Y + 1, footW + 2, 1, wood[0]);
  c.rect(eaveL, ROOF_TOP, footW + 2, 1, wood[3]).rect(eaveL, ROOF_TOP, 1, wallTop - ROOF_TOP, wood[2]);
  c.rect(eaveR, ROOF_TOP, 1, wallTop - ROOF_TOP, wood[0]);

  // Raised cupola / monitor roof vent in the centre of the upper ridge.
  const cupolaX = left + Math.floor(footW / 2) - 16;
  const cupolaY = ROOF_TOP + 6;
  c.rect(cupolaX + 2, cupolaY + 8, 32, 2, wood[0]);
  c.rect(cupolaX, cupolaY, 32, 8, wood[1]).rect(cupolaX, cupolaY, 32, 1, wood[3]);
  for (let lx = cupolaX + 3; lx < cupolaX + 29; lx += 4) {
    c.rect(lx, cupolaY + 2, 2, 4, ink[1]).px(lx, cupolaY + 2, wood[2]);
  }
  c.rect(cupolaX - 1, cupolaY - 2, 34, 2, wood[2]).rect(cupolaX - 1, cupolaY - 2, 34, 1, wood[3]);

  // Corrugated tin patch on the right slope with rust streaks.
  const patchX = left + footW - 38;
  const patchY = RIDGE_Y + 4;
  c.rect(patchX, patchY, 20, 10, metal[1]).rect(patchX, patchY, 20, 1, metal[3]);
  for (let px = patchX + 2; px < patchX + 19; px += 3) c.rect(px, patchY + 1, 1, 8, metal[2]);
  c.px(patchX + 3, patchY + 8, fire[0]).px(patchX + 16, patchY + 2, fire[0]);

  // Wall: clapboard in earthy olive ranger tones with sturdy corner posts.
  clapboard(s, { face: olive[1], joint: metal[0], lit: olive[2] });

  // Stone foundation skirting.
  c.rect(left, ground - 4, footW, 4, concrete[1]).rect(left, ground - 4, footW, 1, concrete[2]);

  // Storefront display windows on both sides of entrance.
  windowUnit(c, left + 14, wallTop + 6, 18, 13, 'lit', TIMBER);
  windowUnit(c, left + 128, wallTop + 6, 18, 13, 'lit', TIMBER);

  // Wooden window shutters on outer sides.
  c.rect(left + 8, wallTop + 6, 5, 13, wood[1]).rect(left + 8, wallTop + 6, 1, 13, wood[2]);
  c.rect(left + 147, wallTop + 6, 5, 13, wood[0]).rect(left + 151, wallTop + 6, 1, 13, wood[1]);

  // Porch over entrance with hanging lanterns.
  frontPorch(s, TIMBER, wood[2]);
  c.px(doorL - 6, wallTop + 4, fire[2]).px(doorL - 6, wallTop + 5, fire[1]);
  c.px(doorL + 28, wallTop + 4, fire[2]).px(doorL + 28, wallTop + 5, fire[1]);

  // Prominent carved wooden sign mounted on iron brackets above entrance.
  const signX = doorL - 10;
  const signY = wallTop - 15;
  c.rect(signX, signY, 52, 12, wood[1]).rect(signX, signY, 52, 1, wood[3]).rect(signX, signY + 11, 52, 1, ink[1]);
  blockText(c, signX + 7, signY + 3, 'MARKET', bone[3], wood[0]);
  c.rect(signX + 4, signY + 12, 2, 4, metal[0]).rect(signX + 46, signY + 12, 2, 4, metal[0]);

  // Stack of trade goods / crates beside west wall.
  c.rect(left + 2, ground - 9, 8, 6, wood[1]).rect(left + 2, ground - 9, 8, 1, wood[3]);

  // Grime and weathering along foundation.
  grime(c, left, ground - 4, 28, [2, 3, 1, 3], metal[0]);
  grime(c, right - 24, ground - 4, 24, [3, 2, 4], metal[0]);

  return bakeShell(s);
}

// --- Workshop ---------------------------------------------------------------------------

/**
 * Heavy industrial survival forge & armory:
 * Corrugated tin roofing with rust blooms, heavy timber framing, bolted steel tie-plates,
 * tall industrial forge stovepipe with rain cap and soot staining, reinforced steel door,
 * and an overhead work floodlight.
 */
export function buildCampWorkshop(): PixelSprite {
  const s = startShell('camp_workshop', WALL);
  const { c, left, right, footW, ground, wallTop, doorL } = s;
  const eaveL = left - 1;
  const eaveR = right + 1;

  // Corrugated metal roofing: vertical alternating ribs.
  for (let x = eaveL; x <= eaveR; x++) {
    const isLit = (x - eaveL) % 3 === 0;
    const tone = isLit ? metal[2] : (x - eaveL) % 3 === 1 ? metal[1] : metal[0];
    c.rect(x, ROOF_TOP, 1, wallTop - ROOF_TOP, tone);
  }

  // Steel ridge cap with bolt heads.
  c.rect(eaveL, RIDGE_Y, footW + 2, 2, metal[2]).rect(eaveL, RIDGE_Y, footW + 2, 1, metal[3]);
  for (let bx = eaveL + 4; bx < eaveR - 4; bx += 8) c.px(bx, RIDGE_Y + 1, ink[0]);
  c.rect(eaveL, ROOF_TOP, footW + 2, 1, metal[3]).rect(eaveL, ROOF_TOP, 1, wallTop - ROOF_TOP, metal[2]);
  c.rect(eaveR, ROOF_TOP, 1, wallTop - ROOF_TOP, metal[0]);

  // Rust streaks running down roof panels.
  c.rect(left + 16, RIDGE_Y - 6, 2, 14, wood[1]).px(left + 16, RIDGE_Y + 8, fire[0]);
  c.rect(left + 48, RIDGE_Y + 2, 2, 12, wood[1]).px(left + 48, RIDGE_Y + 14, fire[0]);
  c.rect(left + 82, RIDGE_Y - 8, 3, 18, wood[1]).px(left + 83, RIDGE_Y + 10, fire[0]);

  // Protective blue canvas tarp tied over part of the north slope.
  roofTarp(c, left + 14, ROOF_TOP + 4, 24, 16);

  // Tall forge chimney / stovepipe with exhaust rain cap and soot staining.
  const pipeX = left + footW - 28;
  // Soot on roof behind pipe.
  c.rect(pipeX - 5, ROOF_TOP + 4, 16, 26, ink[1]);
  // Stovepipe column.
  c.rect(pipeX, ROOF_TOP - 2, 6, 22, metal[1])
    .rect(pipeX, ROOF_TOP - 2, 1, 22, metal[3])
    .rect(pipeX + 5, ROOF_TOP - 2, 1, 22, metal[0]);
  // Rain cap.
  c.rect(pipeX - 3, ROOF_TOP - 4, 12, 3, metal[2])
    .rect(pipeX - 3, ROOF_TOP - 4, 12, 1, metal[3])
    .rect(pipeX - 1, ROOF_TOP - 5, 8, 1, metal[3]);
  c.rect(pipeX - 2, ROOF_TOP + 18, 10, 3, metal[0]);

  // Wall: industrial corrugated steel siding with dark timber posts.
  for (let x = left; x <= right; x++) {
    const isRib = (x - left) % 3 === 0;
    c.rect(x, wallTop, 1, WALL, isRib ? metal[1] : metal[0]);
  }
  // Heavy timber corner posts.
  c.rect(left, wallTop, 3, WALL, wood[1]).rect(left, wallTop, 1, WALL, wood[2]);
  c.rect(right - 2, wallTop, 3, WALL, wood[0]);

  // Horizontal bolted steel reinforcement straps.
  c.rect(left, wallTop + 6, footW, 2, metal[2]).rect(left, wallTop + 6, footW, 1, metal[3]);
  c.rect(left, wallTop + 16, footW, 2, metal[2]).rect(left, wallTop + 16, footW, 1, metal[3]);
  for (let rx = left + 8; rx < right - 8; rx += 14) {
    c.px(rx, wallTop + 7, ink[0]).px(rx, wallTop + 17, ink[0]);
  }

  // Eave shadow and heavy stained foundation.
  c.rect(left, wallTop, footW, 3, ink[1]);
  c.rect(left, ground - 4, footW, 4, concrete[0]).rect(left, ground - 4, footW, 1, concrete[1]);
  c.rect(left + 20, ground - 3, 16, 2, ink[1]);

  // Barred workshop windows on both sides of door.
  windowUnit(c, left + 14, wallTop + 6, 14, 12, 'blind', STEEL);
  windowUnit(c, left + 96, wallTop + 6, 14, 12, 'boarded', STEEL);

  // Heavy steel reinforced doorway.
  doorway(s, 22, 'steel', STEEL, concrete[1]);

  // Overhead angled industrial work floodlight with glowing beam.
  const lightX = doorL + 10;
  const lightY = wallTop - 4;
  c.rect(lightX - 2, lightY, 6, 3, metal[2]).rect(lightX - 1, lightY + 3, 4, 2, fire[2]);
  c.px(lightX, lightY + 5, fire[1]).px(lightX + 1, lightY + 5, fire[1]);

  // Grime and soot stains along ground.
  grime(c, left, ground - 4, 32, [3, 2, 4, 2], ink[1]);
  grime(c, right - 24, ground - 4, 24, [2, 4, 1], ink[1]);

  return bakeShell(s);
}

// --- Quarters ---------------------------------------------------------------------------

/**
 * Cozy survivor bunkhouse & lodge:
 * Pitched cedar shingle roof with brick chimney, cute roof dormer, moss along the eaves,
 * denim-stained weatherboard siding with crisp white trim, welcoming porch with railing,
 * curtained glowing windows, and warm festive string lights along the front eaves.
 */
export function buildCampQuarters(): PixelSprite {
  const s = startShell('camp_quarters', WALL);
  const { c, left, right, footW, ground, wallTop, doorL } = s;
  const eaveL = left - 1;
  const eaveR = right + 1;

  // Handcrafted shingle courses: lit upper slope and shadowed lower slope.
  shingles(c, {
    points: [[eaveL, ROOF_TOP], [eaveR, ROOF_TOP], [eaveR, RIDGE_Y], [eaveL, RIDGE_Y]],
    base: wood[2],
    course: wood[1],
  });
  shingles(c, {
    points: [[eaveL, RIDGE_Y], [eaveR, RIDGE_Y], [eaveR, wallTop - 1], [eaveL, wallTop - 1]],
    base: wood[1],
    course: wood[0],
  });

  // Ridge cap and eave gutters.
  c.rect(eaveL, RIDGE_Y, footW + 2, 1, wood[3]).rect(eaveL, RIDGE_Y + 1, footW + 2, 1, wood[0]);
  c.rect(eaveL, ROOF_TOP, footW + 2, 1, wood[3]).rect(eaveL, ROOF_TOP, 1, wallTop - ROOF_TOP, wood[2]);
  c.rect(eaveR, ROOF_TOP, 1, wallTop - ROOF_TOP, wood[0]);

  // Brick/stone chimney on the west side of the roof.
  chimney(c, left + 14, ROOF_TOP + 4);

  // Roof dormer on the east side of the roof.
  dormer(c, left + 76, ROOF_TOP + 10);

  // Moss and lichen patches on the wet end of the shingles.
  for (const [mx, my, mw] of [[left + 44, wallTop - 6, 8], [left + 46, wallTop - 5, 5], [left + 104, wallTop - 7, 7]] as const) {
    c.rect(mx, my, mw, 1, olive[1]).px(mx + 1, my - 1, grass[1]);
  }

  // Wall: rich denim weatherboard clapboard siding with white trim.
  clapboard(s, { face: denim[0], joint: metal[0], lit: denim[1] });

  // Stone foundation ledge.
  c.rect(left, ground - 4, footW, 4, concrete[1]).rect(left, ground - 4, footW, 1, concrete[2]);

  // Cozy cabin windows with warm amber glowing interior lights.
  windowUnit(c, left + 14, wallTop + 6, 14, 12, 'lit', WHITE);
  windowUnit(c, left + 96, wallTop + 6, 14, 12, 'lit', WHITE);

  // Front porch with railings and welcoming doorway.
  frontPorch(s, WHITE, wood[2]);

  // Warm amber porch lantern beside the door.
  c.px(doorL - 6, wallTop + 6, fire[2]).px(doorL - 6, wallTop + 7, fire[1]);

  // String lights draped across the front eave that glow warmly.
  for (let x = left + 4; x < right - 4; x++) {
    const droop = Math.round(Math.sin(((x - left) / footW) * Math.PI * 4) * 1.5) + 2;
    c.px(x, wallTop - 5 + droop, ink[1]);
    const isBulb = (x - left) % 7 === 3;
    if (isBulb) {
      c.px(x, wallTop - 4 + droop, fire[2]);
      c.px(x, wallTop - 3 + droop, fire[1]);
    }
  }

  // Stack of neatly chopped firewood against the east wall.
  const woodX = left + footW - 20;
  const woodY = ground - 10;
  c.rect(woodX, woodY, 14, 7, wood[1]).rect(woodX, woodY, 14, 1, wood[3]);
  for (let wx = woodX + 2; wx < woodX + 13; wx += 3) {
    c.rect(wx, woodY + 1, 1, 6, wood[0]).px(wx + 1, woodY + 3, wood[2]);
  }

  // Grime and soil along the base.
  grime(c, left, ground - 4, 24, [2, 3, 1], metal[0]);
  grime(c, right - 20, ground - 4, 20, [3, 2, 3], metal[0]);

  return bakeShell(s);
}
