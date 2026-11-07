// What's left inside the buildings. Each piece shows a top face footprint-deep and a front
// face rising above it, the same 3/4 cheat as the buildings, and all of it has been gone
// through by someone in a hurry.

import { PROP_DEFS } from '../../../shared/protocol.ts';
import type { PropKind } from '../../../shared/protocol.ts';
import type { PixelSprite } from '../types.ts';
import { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Color } from '../palette.ts';
import { bake, groundShadow } from './common.ts';

const { ink, metal, wood, bone, denim, teal, blood, olive, fire, asphalt, ash, brick, concrete } = RAMPS;

export interface Piece {
  readonly c: PixelCanvas;
  readonly left: number;
  readonly right: number;
  readonly w: number;
  /** Footprint south edge. */
  readonly ground: number;
  /** First row of the front face. */
  readonly front: number;
  /** First row of the top face. */
  readonly top: number;
}

export function startPiece(kind: PropKind, rise: number): Piece {
  const { w, h } = PROP_DEFS[kind];
  const left = 2;
  const ground = h + rise + 1;
  const c = new PixelCanvas(w + left * 2, ground + 4);
  groundShadow(c, left + 1, ground - 1, w, 3);
  return { c, left, right: left + w - 1, w, ground, front: ground - rise, top: ground - rise - h };
}

export function finish(p: Piece): PixelSprite {
  p.c.outline({ selective: true });
  return bake(p.c, p.left, p.w, p.ground);
}

const SHELF_GOODS: readonly Color[] = [teal[1], bone[1], blood[1], denim[1], fire[1], olive[2], bone[2]];

/** Rows of stock on the left, ransacked on the right: stock stops at `stockedTo`. */
function shelfRow(p: Piece, y: number, stockedTo: number, seed: number): void {
  const { c, left } = p;
  c.rect(left + 1, y, p.w - 2, 1, metal[2]).rect(left + 1, y + 1, p.w - 2, 1, ink[1]);
  for (let x = left + 2, n = seed; x < left + stockedTo; x += 3, n++) {
    const height = 3 + (n % 2);
    c.rect(x, y - height, 2, height, SHELF_GOODS[n % SHELF_GOODS.length]);
    c.px(x, y - height, bone[3]);
  }
}

export function buildShelf(): PixelSprite {
  const p = startPiece('shelf', 16);
  const { c, left, right, ground, front, top, w } = p;
  c.rect(left, top, w, 10, metal[1]);
  c.rect(left, top, w, 1, metal[3]).rect(left, top, 1, 10, metal[2]).rect(left + 3, top + 3, w - 6, 5, metal[0]);
  // Boxes left on top by whoever stocked it.
  c.rect(left + 5, top - 1, 8, 6, wood[2]).rect(left + 5, top - 1, 8, 1, wood[3]).rect(left + 8, top + 1, 2, 4, wood[1]);
  c.rect(left, front, w, 16, ink[1]);
  c.rect(left, front, 2, 16, metal[1]).rect(right - 1, front, 2, 16, metal[0]).rect(left, front, 1, 16, metal[2]);
  c.rect(left + 15, front, 1, 16, metal[0]);
  shelfRow(p, front + 5, 28, 0);
  shelfRow(p, front + 10, 15, 3);
  shelfRow(p, front + 15, 22, 5);
  // Loose packets and one board knocked off its pin.
  c.line(left + 17, front + 8, left + 29, front + 11, metal[2]);
  c.rect(left + 21, ground - 5, 3, 4, teal[0]).rect(left + 26, ground - 3, 3, 2, bone[0]);
  return finish(p);
}

export function buildCounter(): PixelSprite {
  const p = startPiece('counter', 12);
  const { c, left, right, ground, front, top, w } = p;
  c.rect(left, top, w, 12, wood[2]);
  c.rect(left, top, w, 1, wood[3]).rect(left, top, 1, 12, wood[3]).rect(right, top, 1, 12, wood[1]);
  for (const [x, y, len] of [[8, 3, 12], [24, 7, 9], [38, 4, 7]] as const) c.rect(left + x, top + y, len, 1, wood[1]);
  // The till, drawer hanging open and empty.
  c.rect(left + 6, top - 2, 13, 8, metal[1]).rect(left + 6, top - 2, 13, 1, metal[3]).rect(left + 8, top, 9, 3, ink[1]);
  c.rect(left + 9, top + 1, 4, 1, teal[1]);
  c.rect(left + 6, top + 6, 13, 3, metal[0]).rect(left + 8, top + 7, 9, 2, ink[0]);
  // Spilled paper.
  c.rect(left + 28, top + 5, 6, 4, bone[1]).rect(left + 28, top + 5, 6, 1, bone[2]).rect(left + 36, top + 8, 5, 3, bone[0]);
  c.rect(left, front, w, 12, wood[1]);
  c.rect(left, front, w, 1, wood[0]);
  for (const x of [left + 12, left + 24, left + 36]) c.rect(x, front + 1, 1, 9, wood[0]);
  c.rect(left, ground - 2, w, 2, ink[1]);
  c.rect(left + 28, front + 4, 3, 3, ink[1]).px(left + 27, front + 3, wood[2]);
  return finish(p);
}

export function buildTable(): PixelSprite {
  const p = startPiece('table', 7);
  const { c, left, right, ground, front, top, w } = p;
  for (const x of [left + 1, right - 2]) c.rect(x, front, 3, ground - front, wood[0]).rect(x, front, 1, ground - front, wood[1]);
  c.rect(left, top, w, 14, wood[2]);
  c.rect(left, top, w, 1, wood[3]).rect(left, top, 1, 14, wood[3]).rect(right, top, 1, 14, wood[1]);
  c.rect(left + 1, top + 6, w - 2, 1, wood[1]).rect(left + 9, top + 1, 1, 5, wood[1]).rect(left + 15, top + 7, 1, 6, wood[1]);
  c.rect(left, front, w, 2, wood[1]).rect(left, front + 2, w, 1, ink[1]);
  // A plate and a mug, left mid-meal.
  c.ellipse(left + 7, top + 9, 4, 3, bone[1]).ellipse(left + 7, top + 9, 2, 1, bone[0]);
  c.rect(left + 15, top + 2, 4, 4, bone[2]).rect(left + 16, top + 3, 2, 2, wood[0]).rect(left + 19, top + 3, 1, 2, bone[1]);
  return finish(p);
}

export function buildSofa(): PixelSprite {
  const p = startPiece('sofa', 10);
  const { c, left, right, ground, top, w } = p;
  const [dark, mid, lit] = [olive[0], olive[1], olive[2]];
  const seat = top + 5;
  const skirt = ground - 7;
  // The back rests against the wall, in shade; its top roll catches the light.
  c.rect(left + 1, top - 5, w - 2, 10, dark);
  c.rect(left + 1, top - 5, w - 2, 3, mid).rect(left + 2, top - 5, w - 4, 1, lit);
  c.rect(left + 12, top - 2, 1, 7, ink[1]).rect(left + 23, top - 2, 1, 7, ink[1]);
  // Seat cushions face the ceiling, so they are the brightest thing on it.
  for (const x of [left + 5, left + 18]) {
    c.rect(x, seat, 13, skirt - seat, mid).rect(x, seat, 13, 1, lit).rect(x, seat, 1, skirt - seat, lit);
    c.rect(x, skirt - 1, 13, 1, dark).rect(x + 12, seat, 1, skirt - seat, dark);
  }
  c.rect(left + 5, skirt, w - 10, ground - skirt, dark).rect(left + 5, skirt, w - 10, 1, ink[1]);
  // Rolled arms: lit top, then the front face.
  for (const x of [left, right - 4]) {
    c.rect(x, top - 1, 5, ground - top + 1, mid);
    c.rect(x, top - 1, 5, 2, lit).rect(x, top - 1, 1, ground - top + 1, lit);
    c.rect(x + 4, top + 1, 1, ground - top - 1, dark);
    c.rect(x, skirt, 5, ground - skirt, dark).rect(x + 1, skirt, 3, 1, mid);
  }
  // Slashed open, with the stuffing coming out.
  c.rect(left + 21, seat + 2, 8, 3, ink[1]).rect(left + 22, seat + 2, 6, 2, bone[1]).rect(left + 24, seat + 1, 3, 1, bone[2]);
  c.px(left + 20, seat + 5, bone[0]).px(left + 27, seat + 6, bone[0]);
  return finish(p);
}

export function buildBed(): PixelSprite {
  const p = startPiece('bed', 6);
  const { c, left, right, ground, front, top, w } = p;
  // Head on the north side.
  c.rect(left - 1, top - 5, w + 2, 7, wood[1]).rect(left - 1, top - 5, w + 2, 1, wood[3]).rect(left - 1, top - 5, 1, 7, wood[2]);
  c.rect(left, top + 2, w, 32 - 2, bone[0]);
  c.rect(left, top + 2, 1, 30, bone[1]).rect(right, top + 2, 1, 30, ash[0]);
  c.rect(left + 3, top + 3, 18, 7, bone[2]).rect(left + 3, top + 3, 18, 1, bone[3]).rect(left + 3, top + 9, 18, 1, bone[1]);
  c.rect(left + 8, top + 5, 7, 2, bone[1]);
  // The blanket, dragged half off; a stain soaked through the sheet above it.
  c.ellipse(left + 8, top + 13, 5, 2, brick[1]).rect(left + 6, top + 13, 7, 2, blood[0]);
  c.poly([[left, top + 15], [right, top + 12], [right, front], [left, front]], denim[1]);
  c.line(left, top + 15, right, top + 12, denim[2]).line(left + 4, front - 1, left + 10, top + 15, denim[0]).line(left + 15, front - 1, left + 18, top + 14, denim[0]);
  c.rect(left, front, w, 6, wood[1]).rect(left, front, w, 1, wood[3]).rect(left, ground - 1, w, 1, wood[0]);
  c.rect(left + 3, front + 2, w - 6, 2, wood[0]);
  return finish(p);
}

export function buildWorkbench(): PixelSprite {
  const p = startPiece('workbench', 10);
  const { c, left, right, ground, front, top, w } = p;
  // Legs and the shelf under the top, then the top itself.
  for (const x of [left + 1, right - 3]) c.rect(x, front, 3, ground - front, wood[1]).rect(x, front, 1, ground - front, wood[2]);
  c.rect(left + 4, ground - 3, w - 8, 2, wood[0]).rect(left + 4, ground - 3, w - 8, 1, wood[1]);
  // A red toolbox and a tin on the bottom shelf.
  c.rect(left + 7, ground - 8, 12, 5, blood[1]).rect(left + 7, ground - 8, 12, 1, blood[2]).rect(left + 11, ground - 9, 4, 1, metal[2]);
  c.rect(left + 24, ground - 7, 6, 4, metal[1]).rect(left + 24, ground - 7, 6, 1, metal[3]);
  c.rect(left, top, w, 12, wood[2]);
  c.rect(left, top, w, 1, wood[3]).rect(left, top, 1, 12, wood[3]).rect(right, top, 1, 12, wood[1]);
  for (const [x, y, len] of [[3, 4, 10], [18, 8, 12], [28, 2, 8]] as const) c.rect(left + x, top + y, len, 1, wood[1]);
  c.rect(left, front, w, 3, wood[1]).rect(left, front + 2, w, 1, ink[1]);
  // Vice on the corner, a hammer, spanners and an oil ring.
  c.rect(right - 9, top - 2, 9, 7, metal[1]).rect(right - 9, top - 2, 9, 1, metal[3]).rect(right - 6, top + 1, 2, 4, ink[1]);
  c.rect(right - 11, top + 2, 3, 1, metal[2]);
  c.rect(left + 6, top + 6, 10, 1, wood[0]).rect(left + 3, top + 4, 4, 5, metal[1]).rect(left + 3, top + 4, 4, 1, metal[3]);
  c.line(left + 19, top + 2, left + 25, top + 5, metal[3]).line(left + 21, top + 7, left + 27, top + 8, metal[2]);
  c.ellipse(left + 18, top + 8, 2.5, 1.5, asphalt[1]);
  c.px(left + 12, top + 2, concrete[3]);
  return finish(p);
}
