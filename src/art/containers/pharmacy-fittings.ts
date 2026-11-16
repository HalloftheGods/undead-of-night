// The pharmacy's own furniture: a glass display counter over the till, and clean white shelving with the
// boxed stock lined up square. Each keeps the footprint of the stock piece it replaces, so a shut one fills
// the same space and only the searched one spills out.

import { finish, startPiece } from '../environment/furniture.ts';
import type { Piece } from '../environment/furniture.ts';
import { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Color } from '../palette.ts';
import type { PixelSprite } from '../types.ts';
import { bakeStage, glints, over, paper, stage, tipped, upright } from './stage.ts';
import type { ContainerArt } from './stage.ts';

const { ink, metal, bone, teal, blood, denim, fire } = RAMPS;

const COUNTER_RISE = 12;
const SHELF_RISE = 16;

/** A pill box or carton, square to the board, with a stripe down the front. */
function box(c: PixelCanvas, x: number, base: number, w: number, h: number, body: Color, stripe: Color): void {
  c.rect(x, base - h, w, h, body).rect(x, base - h, w, 1, bone[3]).rect(x + Math.floor(w / 2), base - h + 1, 1, h - 1, stripe);
}

// ---- Glass counter ----

function glassCounterClosed(): PixelSprite {
  const p: Piece = startPiece('counter', COUNTER_RISE);
  const { c, left, right, front, top, w, ground } = p;
  // Brushed frame round a glass top, with the till shut at the back.
  c.rect(left, top, w, 12, metal[1]);
  c.rect(left, top, w, 1, metal[3]).rect(left, top, 1, 12, metal[2]).rect(right, top, 1, 12, metal[0]);
  c.rect(left + 2, top + 2, w - 4, 6, teal[2]).rect(left + 2, top + 2, w - 4, 1, bone[3]);
  c.rect(left + 6, top - 2, 13, 5, metal[2]).rect(left + 8, top - 1, 9, 2, ink[1]);
  // Glass front, panelled, lit from within.
  c.rect(left, front, w, COUNTER_RISE, teal[2]);
  c.rect(left, front, w, 1, metal[3]).rect(left, front + COUNTER_RISE - 1, w, 1, metal[0]);
  for (const x of [0, 16, 32]) c.rect(left + x, front + 1, 1, COUNTER_RISE - 2, metal[2]);
  for (const x of [3, 19, 35]) c.rect(left + x, front + 2, 2, 1, bone[3]).rect(left + x, front + 3, 1, 1, bone[2]);
  c.rect(left, ground - 2, w, 2, ink[1]);
  return finish(p);
}

function glassCounterOpened(counter: PixelSprite): PixelSprite {
  const s = stage('counter', counter, 2, 7);
  const { c, left, ground } = s;
  const y = ground - COUNTER_RISE + 1;
  // The glass front has been smashed out of two panels.
  c.rect(left + 1, y, 14, 9, ink[0]).rect(left + 33, y, 14, 9, ink[0]);
  over(c, (layer) => {
    // Shards and a split pane lying across the floor.
    layer.poly([[left + 4, ground + 2], [left + 14, ground], [left + 17, ground + 4], [left + 7, ground + 6]], teal[1]);
    layer.line(left + 4, ground + 2, left + 14, ground, bone[3]);
    tipped(layer, left + 24, ground + 2, bone[2]);
    box(layer, left + 27, ground + 4, 4, 3, bone[1], denim[2]);
    paper(layer, left + 34, ground + 3);
    layer.rect(left + 9, ground + 1, 2, 1, blood[2]);
  });
  glints(c, [[left + 12, ground + 3], [left + 16, ground + 5], [left + 20, ground + 1]]);
  return bakeStage(s);
}

export function buildGlassCounterArt(counter: PixelSprite): ContainerArt {
  return { closed: glassCounterClosed(), opened: glassCounterOpened(counter) };
}

// ---- Clean pharmacy shelving ----

function pharmacyFrame(): Piece {
  const p = startPiece('shelf', SHELF_RISE);
  const { c, left, right, front, top, w } = p;
  // White-enamelled steel with a bright top rail.
  c.rect(left, top, w, 10, bone[2]);
  c.rect(left, top, w, 1, bone[3]).rect(left, top, 1, 10, bone[1]).rect(right, top, 1, 10, bone[0]);
  c.rect(left, front, w, 16, metal[2]);
  c.rect(left, front, 1, 16, metal[3]).rect(right, front, 1, 16, metal[0]);
  return p;
}

function pharmacyBoard({ c, left, w }: Piece, y: number): void {
  c.rect(left + 1, y, w - 2, 1, bone[1]).rect(left + 1, y + 1, w - 2, 1, metal[0]);
}

/** Cartons standing in an even row on each board, all facing out and the same height. */
function pharmacyShelfClosed(): PixelSprite {
  const p = pharmacyFrame();
  const { c, left, front, top } = p;
  [front + 5, front + 11].forEach((y, row) => {
    pharmacyBoard(p, y);
    for (let x = 2; x < 28; x += 5) box(c, left + x, y, 4, 4, row === 0 ? teal[2] : denim[2], bone[3]);
  });
  // A neat stack of boxed stock along the top, square to the rail.
  for (const x of [left + 4, left + 13, left + 22]) box(c, x, top, 7, 4, bone[1], teal[1]);
  return finish(p);
}

function pharmacyShelfOpened(): PixelSprite {
  const p = pharmacyFrame();
  const { c, left, right, front } = p;
  pharmacyBoard(p, front + 5);
  pharmacyBoard(p, front + 11);
  // The lower board has come away at one end and tipped the stock.
  c.line(left + 2, front + 11, left + 14, front + 11, metal[0]).line(left + 16, front + 11, right - 2, front + 15, metal[0]);
  box(c, left + 3, front + 5, 4, 4, teal[2], bone[3]);
  tipped(c, left + 8, front + 3, bone[2]);
  upright(c, left + 22, front + 5, denim[2], 4);
  tipped(c, left + 24, front + 9, teal[2]);
  const s = stage('shelf', finish(p), 4, 6);
  over(s.c, (layer) => {
    const y = s.ground;
    tipped(layer, s.left + 2, y + 1, teal[2]);
    box(layer, s.left + 12, y + 3, 5, 3, bone[1], denim[2]);
    tipped(layer, s.left + 22, y + 1, blood[2]);
    upright(layer, s.left + 8, y + 3, fire[1], 3);
    paper(layer, s.left + 17, y);
  });
  return bakeStage(s);
}

export function buildPharmacyShelfArt(): ContainerArt {
  return { closed: pharmacyShelfClosed(), opened: pharmacyShelfOpened() };
}
