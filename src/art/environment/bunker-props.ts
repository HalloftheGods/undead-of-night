// What stands in the bunker that no town has: the forge, the table the level map lies on, and the jukebox.
// Both read as the same hand-built, lamp-lit place: bare brick, steel and old timber.

import { PROP_DEFS } from '../../../shared/protocol.ts';
import type { PropKind } from '../../../shared/protocol.ts';
import type { PixelSprite } from '../types.ts';
import { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import { bake, groundShadow } from './common.ts';
import { finish, startPiece } from './furniture.ts';

const { blood, bone, brick, concrete, denim, fire, ink, metal, teal, violet, wood } = RAMPS;

const MARGIN = 2;
const SHADOW_DEPTH = 3;
const FORGE_RISE = 20;
const CHIMNEY_ROOM = 14;
const BRICK_ROW = 5;
const MOUTH_WIDTH = 14;
const MOUTH_HEIGHT = 13;
const MAP_RISE = 9;
const JUKEBOX_RISE = 18;

/** The forge is taller than its footprint, so it gets its own canvas with room for the chimney. */
function startForge(kind: PropKind) {
  const { w, h } = PROP_DEFS[kind];
  const ground = CHIMNEY_ROOM + h + FORGE_RISE + 1;
  const c = new PixelCanvas(w + MARGIN * 2, ground + 4);
  groundShadow(c, MARGIN + 1, ground - 1, w, SHADOW_DEPTH);
  const front = ground - FORGE_RISE;
  return { c, left: MARGIN, right: MARGIN + w - 1, w, ground, front, top: front - h };
}

/** A brick furnace with a glowing mouth, a crucible on its steel top and a chimney pipe. */
export function buildForge(): PixelSprite {
  const { c, left, right, w, ground, front, top } = startForge('forge');
  // Brick face, a course every five rows with the joints stepped.
  c.rect(left, front, w, FORGE_RISE, brick[1]);
  for (let y = front + BRICK_ROW - 1; y < ground - 2; y += BRICK_ROW) c.rect(left, y, w, 1, brick[0]);
  for (let y = front, row = 0; y < ground - 2; y += BRICK_ROW, row += 1) {
    for (let x = left + (row % 2) * 4; x < right; x += 8) c.rect(x, y, 1, BRICK_ROW - 1, brick[0]);
  }
  c.rect(left, front, w, 1, brick[2]).rect(left, ground - 3, w, 3, concrete[1]).rect(left, ground - 3, w, 1, concrete[2]);
  // The mouth: a steel arch over a bed of coals.
  const mouthX = left + 6;
  const mouthY = front + 5;
  c.rect(mouthX - 2, mouthY - 2, MOUTH_WIDTH + 4, MOUTH_HEIGHT + 2, metal[1]).rect(mouthX - 2, mouthY - 2, MOUTH_WIDTH + 4, 1, metal[2]);
  c.rect(mouthX, mouthY, MOUTH_WIDTH, MOUTH_HEIGHT, ink[0]);
  c.rect(mouthX, mouthY + 7, MOUTH_WIDTH, 6, fire[0]).rect(mouthX + 1, mouthY + 5, MOUTH_WIDTH - 2, 6, fire[1]);
  c.rect(mouthX + 3, mouthY + 6, MOUTH_WIDTH - 6, 5, fire[2]).rect(mouthX + 5, mouthY + 8, MOUTH_WIDTH - 10, 3, fire[3]);
  // A draught slot beside it, still glowing.
  c.rect(left + 27, front + 10, 9, 2, fire[1]).rect(left + 28, front + 10, 7, 1, fire[2]);
  // The steel top with a crucible of molten metal.
  c.rect(left, top, w, front - top, metal[1]).rect(left, top, w, 1, metal[2]).rect(left, front - 1, w, 1, metal[0]);
  c.ellipse(left + 12, top + 6, 8, 4, metal[3]).ellipse(left + 12, top + 6, 6, 3, ink[0]).ellipse(left + 12, top + 6, 5, 2, fire[1]);
  c.ellipse(left + 11, top + 6, 3, 1, fire[3]);
  // Tongs laid across the plate.
  c.line(left + 24, top + 3, left + 31, top + 9, metal[3]).line(left + 25, top + 3, left + 32, top + 9, metal[2]);
  // The chimney runs up from the back of the top and out of sight.
  const pipeX = right - 10;
  c.rect(pipeX, 1, 8, top + 2, metal[1]).rect(pipeX, 1, 2, top + 2, metal[2]).rect(pipeX + 6, 1, 2, top + 2, metal[0]);
  c.rect(pipeX - 1, 0, 10, 2, metal[2]).rect(pipeX - 1, top, 10, 2, metal[0]);
  c.px(pipeX + 3, 7, fire[1]).px(pipeX + 4, 14, fire[0]);
  c.outline({ selective: true });
  return bake(c, left, w, ground);
}

/** A plank table with the trip map pinned flat across it: coast, road, a route and pins. */
export function buildLevelMap(): PixelSprite {
  const p = startPiece('level_map', MAP_RISE);
  const { c, left, right, ground, front, top, w } = p;
  for (const x of [left + 1, right - 3]) c.rect(x, front, 3, ground - front, wood[1]).rect(x, front, 1, ground - front, wood[2]);
  c.rect(left, top, w, front - top, wood[2]).rect(left, top, w, 1, wood[3]).rect(left, top, 1, front - top, wood[3]);
  c.rect(left, front, w, 3, wood[1]).rect(left, front + 2, w, 1, ink[1]);
  // The paper, ruled into squares.
  const paper = { x: left + 2, y: top + 2, w: w - 4, h: front - top - 4 };
  c.rect(paper.x, paper.y, paper.w, paper.h, bone[2]);
  for (let x = paper.x + 5; x < paper.x + paper.w; x += 5) c.rect(x, paper.y, 1, paper.h, bone[1]);
  for (let y = paper.y + 4; y < paper.y + paper.h; y += 4) c.rect(paper.x, y, paper.w, 1, bone[1]);
  // A river, a road and the route out.
  c.line(paper.x, paper.y + 8, paper.x + 12, paper.y + 4, denim[2]).line(paper.x + 12, paper.y + 4, right - 2, paper.y + 5, denim[2]);
  c.line(paper.x + 2, paper.y + 1, paper.x + 9, paper.y + 8, ink[1]);
  c.line(paper.x + 3, paper.y + 8, paper.x + 17, paper.y + 2, blood[2]);
  // Pins, and a lamp-warmed corner.
  for (const [x, y] of [[4, 8], [10, 5], [17, 2]] as const) c.px(paper.x + x, paper.y + y, blood[3]).px(paper.x + x, paper.y + y - 1, fire[3]);
  c.rect(right - 5, top + 1, 3, 2, fire[1]);
  return finish(p);
}

/** A classic Wurlitzer-style jukebox with glowing violet and teal neon arches, lit glass dome with vinyl record, and chrome grille. */
export function buildJukebox(): PixelSprite {
  const p = startPiece('jukebox', JUKEBOX_RISE);
  const { c, left, right, front, top, w } = p;

  // Wood cabinet with rounded shoulders
  c.rect(left + 5, top, 10, 1, wood[1]);
  c.rect(left + 3, top + 1, 14, 1, wood[2]);
  c.rect(left + 1, top + 2, 18, 1, wood[2]);
  c.rect(left, top + 3, w, front - top - 3, wood[2]);
  c.rect(left, front, w, p.ground - front, wood[1]);

  // Glowing outer neon arch (violet/magenta)
  c.rect(left + 6, top, 8, 1, violet[2]);
  c.rect(left + 4, top + 1, 3, 1, violet[2]).rect(right - 6, top + 1, 3, 1, violet[2]);
  c.rect(left + 2, top + 2, 2, 1, violet[2]).rect(right - 3, top + 2, 2, 1, violet[2]);
  c.rect(left, top + 3, 2, p.ground - top - 6, violet[2]);
  c.rect(right - 1, top + 3, 2, p.ground - top - 6, violet[2]);
  c.rect(left + 1, top + 3, 1, p.ground - top - 6, violet[1]);

  // Glowing inner neon arch (teal/cyan)
  c.rect(left + 7, top + 1, 6, 1, teal[2]);
  c.rect(left + 3, top + 2, 2, 1, teal[2]).rect(right - 4, top + 2, 2, 1, teal[2]);
  c.rect(left + 2, top + 3, 1, p.ground - top - 6, teal[2]);
  c.rect(right - 2, top + 3, 1, p.ground - top - 6, teal[2]);

  // Illuminated glass viewing dome with vinyl record on turntable
  const glass = { x: left + 4, y: top + 3, w: w - 8, h: 9 };
  c.rect(glass.x, glass.y, glass.w, glass.h, fire[0]);
  c.rect(glass.x + 1, glass.y + 1, glass.w - 2, glass.h - 2, fire[1]);
  c.rect(glass.x + 2, glass.y + 1, glass.w - 4, 2, fire[2]);
  // Turntable and vinyl record
  c.ellipse(glass.x + 5, glass.y + 5, 4, 2, ink[0]);
  c.px(glass.x + 5, glass.y + 5, blood[2]);
  // Silver tone arm
  c.line(glass.x + 9, glass.y + 3, glass.x + 6, glass.y + 5, metal[3]);
  // Glass highlight
  c.line(glass.x + 2, glass.y + 1, glass.x + 4, glass.y + 1, bone[3]);

  // Chrome song selector strip
  const barY = top + 12;
  c.rect(left + 3, barY, w - 6, 2, metal[2]);
  c.rect(left + 3, barY, w - 6, 1, metal[3]);
  for (let x = left + 4; x < right - 4; x += 2) {
    c.px(x, barY + 1, fire[2]);
  }

  // Art deco lower speaker grille
  const grilleY = top + 15;
  const grilleH = p.ground - grilleY - 3;
  c.rect(left + 3, grilleY, w - 6, grilleH, ink[0]);
  // Illuminated colored grille backdrop
  for (let y = grilleY; y < grilleY + grilleH; y += 2) {
    c.rect(left + 4, y, w - 8, 1, fire[1]);
  }
  // Vertical chrome slats
  for (let x = left + 4; x < right - 4; x += 2) {
    c.rect(x, grilleY, 1, grilleH, metal[3]);
  }

  // Heavy chrome base plinth
  c.rect(left, p.ground - 3, w, 3, metal[1]);
  c.rect(left, p.ground - 3, w, 1, metal[3]);
  c.rect(left, p.ground - 1, w, 1, ink[1]);

  c.outline({ selective: true });
  return finish(p);
}

/** A wooden candy stall counter with glass jars of colorful sweets. */
export function buildCandyShop(): PixelSprite {
  const p = startPiece('candy_shop', 12);
  const { c, left, w, ground, front, top } = p;
  c.rect(left, front, w, ground - front, wood[1]);
  c.rect(left, front, w, 1, wood[2]);
  c.rect(left, ground - 1, w, 1, wood[0]);
  c.rect(left, top, w, front - top, wood[2]);
  c.rect(left, top, w, 1, wood[3]);
  c.rect(left, front - 1, w, 1, wood[1]);
  // Colorful candy jars
  c.rect(left + 4, top + 2, 7, 7, ink[1]);
  c.rect(left + 5, top + 3, 5, 5, fire[1]);
  c.px(left + 6, top + 4, fire[2]);
  c.rect(left + 6, top + 1, 3, 1, metal[2]);

  c.rect(left + 14, top + 1, 8, 8, ink[1]);
  c.rect(left + 15, top + 2, 6, 6, violet[1]);
  c.px(left + 17, top + 4, teal[1]);
  c.rect(left + 16, top, 4, 1, metal[2]);

  c.rect(left + 25, top + 2, 7, 7, ink[1]);
  c.rect(left + 26, top + 3, 5, 5, fire[2]);
  c.px(left + 28, top + 5, denim[1]);
  c.rect(left + 27, top + 1, 3, 1, metal[2]);

  c.ellipse(left + 35, top + 5, 4, 3, metal[1]);
  c.px(left + 34, top + 4, blood[1]);
  c.px(left + 36, top + 5, fire[1]);
  return finish(p);
}
