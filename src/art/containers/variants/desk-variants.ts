// Four more desks on the stock desk's footprint, each its own piece of furniture with a shut and a
// searched look: a clerk's pedestal desk under a reading lamp, a kneehole typing desk behind its
// modesty panel, a bare plank table with a shelf slung under it, and a teacher's desk with a
// drawer stack at either side. Every one is drawn by hand: what sits on top, how the drawers are
// hung and what was in them differ from one to the next, as no two desks get left alike.

import { finish, startPiece } from '../../environment/furniture.ts';
import type { Piece } from '../../environment/furniture.ts';
import type { PixelCanvas } from '../../kit.ts';
import { RAMPS } from '../../palette.ts';
import type { Color } from '../../palette.ts';
import type { PixelSprite } from '../../types.ts';
import { bakeStage, over, paper, stage, tipped } from '../stage.ts';
import type { ContainerArt } from '../stage.ts';

const { ink, metal, wood, bone, denim, teal, blood, olive, fire, brick } = RAMPS;

const RISE = 7;

/** The bare slab every desk starts from: a lit top with its grain seams. */
function slab(p: Piece, seams: readonly (readonly [number, number, number, number])[]): void {
  const { c, left, right, top, w } = p;
  c.rect(left, top, w, 14, wood[2]);
  c.rect(left, top, w, 1, wood[3]).rect(left, top, 1, 14, wood[3]).rect(right, top, 1, 14, wood[1]);
  for (const [x, y, sw, sh] of seams) c.rect(left + x, top + y, sw, sh, wood[1]);
}

function book(c: PixelCanvas, x: number, y: number, w: number, h: number, color: Color): void {
  c.rect(x, y, w, h, color).rect(x, y, w, 1, bone[2]);
}

function pull(c: PixelCanvas, x: number, y: number): void {
  c.rect(x, y, 2, 1, metal[3]);
}

/** Bakes the open-state piece, then widens the canvas so drawers and spills land past its edges. */
function searched(piece: Piece, extra: (layer: PixelCanvas, left: number, ground: number) => void): PixelSprite {
  const s = stage('table', finish(piece), 2, 7);
  over(s.c, (layer) => extra(layer, s.left, s.ground));
  return bakeStage(s);
}

// --- A clerk's desk: one pedestal of drawers on the right, a kneehole on the left, a lamp ---

function clerk(open: boolean): Piece {
  const p = startPiece('table', RISE);
  const { c, left: L, ground: G, front: F, top: T } = p;
  slab(p, [[1, 8, 22, 1], [11, 1, 1, 7], [6, 9, 1, 4]]);
  // Front: apron over a leg and a kneehole, the pedestal holding the drawers.
  c.rect(L, F, 24, 2, wood[1]).rect(L, F + 2, 24, 1, ink[1]);
  c.rect(L + 1, F + 2, 3, G - F - 2, wood[0]).rect(L + 1, F + 2, 1, G - F - 2, wood[1]);
  c.rect(L + 4, F + 3, 9, G - F - 3, ink[1]);
  c.rect(L + 13, F + 2, 11, G - F - 2, wood[1]).rect(L + 13, F + 2, 1, G - F - 2, wood[2]);
  if (open) {
    c.rect(L + 14, F + 3, 9, 2, ink[0]);
  } else {
    c.rect(L + 14, F + 3, 9, 2, wood[2]).rect(L + 14, F + 3, 9, 1, wood[3]);
    c.px(L + 18, F + 4, ink[0]);
  }
  c.rect(L + 14, F + 5, 9, 1, wood[0]);
  if (!open) pull(c, L + 17, F + 4);
  pull(c, L + 17, F + 6);
  if (!open) {
    // Reading lamp at the back, a blotter in front of the chair, a pad of paper at the corner.
    c.rect(L + 3, T + 6, 11, 7, olive[0]).rect(L + 3, T + 6, 11, 1, olive[1]).px(L + 3, T + 12, bone[1]).px(L + 13, T + 6, bone[1]);
    c.rect(L + 16, T + 10, 5, 2, metal[1]).rect(L + 16, T + 10, 5, 1, metal[2]);
    c.line(L + 18, T + 10, L + 16, T + 5, metal[2]);
    c.poly([[L + 13, T + 2], [L + 19, T + 2], [L + 21, T + 6], [L + 15, T + 6]], fire[2]);
    c.line(L + 13, T + 2, L + 19, T + 2, fire[3]);
    c.rect(L + 3, T + 1, 6, 4, bone[2]).rect(L + 4, T + 2, 6, 3, bone[3]).rect(L + 5, T + 3, 3, 1, bone[1]);
    c.px(L + 11, T + 8, denim[1]).px(L + 12, T + 8, denim[2]);
  } else {
    // The blotter hauled askew, the lamp gone, one sheet still on it.
    c.poly([[L + 6, T + 5], [L + 16, T + 7], [L + 15, T + 13], [L + 5, T + 11]], olive[0]);
    c.line(L + 6, T + 5, L + 16, T + 7, olive[1]);
    c.rect(L + 8, T + 8, 4, 2, bone[2]).px(L + 8, T + 8, bone[3]);
    c.rect(L + 18, T + 1, 5, 2, ink[1]);
  }
  return p;
}

function clerkOpened(): PixelSprite {
  return searched(clerk(true), (layer, L, G) => {
    // Top drawer yanked clean out and dropped, the lower one dragged half out and emptied.
    layer.rect(L + 12, G - 3, 12, 5, wood[2]).rect(L + 13, G - 3, 10, 3, ink[0]).rect(L + 12, G + 1, 12, 2, wood[3]);
    pull(layer, L + 17, G + 1);
    layer.rect(L + 14, G - 1, 4, 1, bone[2]);
    layer.rect(L + 14, G - 6, 9, 2, wood[2]).rect(L + 14, G - 6, 9, 1, wood[3]);
    // The lamp is down on the floor, shade rolled off.
    layer.rect(L - 1, G + 4, 6, 2, metal[1]).line(L + 5, G + 4, L + 9, G + 2, metal[2]);
    layer.poly([[L + 9, G + 1], [L + 13, G + 3], [L + 12, G + 6], [L + 8, G + 5]], fire[2]);
    paper(layer, L + 16, G + 5);
    paper(layer, L + 20, G + 7);
    tipped(layer, L + 2, G + 7, denim[1]);
  });
}

// --- A kneehole typing desk: modesty panel across the front, a typewriter on top ---

function typist(open: boolean): Piece {
  const p = startPiece('table', RISE);
  const { c, left: L, right: R, front: F, top: T } = p;
  slab(p, [[1, 4, 22, 1], [1, 10, 22, 1], [16, 5, 1, 5]]);
  // Front: a panel the full width with a raised inset, a shallow pencil drawer along the top.
  c.rect(L, F, 24, 7, wood[1]).rect(L, F, 24, 1, wood[2]).rect(L, F, 1, 7, wood[2]).rect(R, F, 1, 7, wood[0]);
  c.rect(L + 3, F + 3, 18, 3, wood[0]).rect(L + 4, F + 3, 16, 1, wood[2]);
  c.rect(L + 9, F + 4, 6, 1, wood[1]);
  if (open) {
    c.rect(L + 6, F + 1, 12, 2, ink[0]);
  } else {
    c.rect(L + 6, F + 1, 12, 2, wood[2]).rect(L + 6, F + 1, 12, 1, wood[3]);
    pull(c, L + 11, F + 2);
  }
  // On top: a typewriter with a sheet in it, a cup of pencils, a library book.
  if (!open) {
    c.rect(L + 6, T + 2, 8, 6, bone[3]).rect(L + 7, T + 3, 6, 1, bone[1]).rect(L + 7, T + 5, 5, 1, bone[1]);
    c.rect(L + 4, T + 7, 12, 1, metal[3]).rect(L + 4, T + 8, 12, 5, metal[1]).rect(L + 4, T + 8, 12, 1, metal[2]);
    for (const x of [6, 8, 10, 12]) c.px(L + x, T + 10, bone[3]);
    c.rect(L + 5, T + 12, 10, 1, metal[0]);
    c.rect(L + 18, T + 3, 3, 4, brick[1]).rect(L + 18, T + 3, 3, 1, bone[2]).px(L + 19, T + 2, fire[2]).px(L + 20, T + 1, denim[2]);
    book(c, L + 17, T + 9, 6, 3, denim[1]);
    c.px(L + 20, T + 10, bone[3]);
  } else {
    // Machine shoved to one end and cocked, the sheet torn out of it.
    c.poly([[L + 11, T + 5], [L + 22, T + 4], [L + 23, T + 10], [L + 12, T + 11]], metal[1]);
    c.line(L + 11, T + 5, L + 22, T + 4, metal[3]);
    for (const [x, y] of [[14, 8], [16, 8], [18, 7], [20, 7]] as const) c.px(L + x, T + y, bone[3]);
    c.rect(L + 3, T + 2, 2, 1, ink[1]);
  }
  return p;
}

function typistOpened(): PixelSprite {
  return searched(typist(true), (layer, L, G) => {
    // The pencil drawer is only tugged out a hand's width, the rest of it dropped beside it.
    layer.rect(L + 6, G - 6, 12, 1, wood[3]);
    layer.rect(L + 5, G - 5, 14, 2, wood[2]);
    layer.rect(L + 19, G + 3, 8, 4, wood[2]).rect(L + 20, G + 3, 6, 2, ink[0]).rect(L + 19, G + 6, 8, 1, wood[3]);
    layer.line(L + 2, G + 2, L + 7, G + 4, bone[2]);
    layer.line(L + 3, G + 5, L + 8, G + 6, metal[3]);
    layer.rect(L + 11, G + 6, 4, 3, denim[1]).rect(L + 11, G + 6, 4, 1, bone[2]);
    paper(layer, L - 2, G + 8);
    paper(layer, L + 7, G + 9);
    layer.px(L + 15, G + 2, teal[2]);
  });
}

// --- A bare plank table: four thin legs, a shelf slung between them, nothing on the top ---

function plank(open: boolean): Piece {
  const p = startPiece('table', RISE);
  const { c, left: L, right: R, ground: G, front: F, top: T } = p;
  slab(p, [[1, 5, 22, 1], [1, 9, 22, 1], [7, 1, 1, 4], [17, 6, 1, 3], [4, 10, 1, 4]]);
  c.rect(L + 3, T + 6, 3, 1, ink[1]).px(L + 14, T + 2, blood[1]).px(L + 15, T + 3, blood[1]).rect(L + 10, T + 11, 6, 1, wood[3]);
  // Front: two plain legs and, between them, a board hung low with the stock stacked on it.
  c.rect(L, F, 24, 2, wood[1]).rect(L, F + 2, 24, 1, ink[1]);
  for (const x of [L + 1, R - 1]) c.rect(x, F + 2, 2, G - F - 2, wood[0]).px(x, F + 2, wood[1]);
  c.rect(L + 3, F + 5, 18, 1, wood[2]).rect(L + 3, F + 6, 18, 1, ink[1]);
  if (open) {
    c.rect(L + 4, F + 4, 3, 1, bone[1]);
  } else {
    book(c, L + 4, F + 2, 3, 3, denim[1]);
    book(c, L + 7, F + 3, 2, 2, brick[2]);
    c.rect(L + 11, F + 2, 6, 3, wood[3]).rect(L + 11, F + 2, 6, 1, wood[2]).rect(L + 13, F + 3, 2, 1, ink[1]);
    c.rect(L + 18, F + 3, 2, 2, teal[2]).px(L + 18, F + 3, bone[3]);
    c.line(L + 9, F + 4, L + 10, F + 2, olive[2]);
  }
  return p;
}

function plankOpened(): PixelSprite {
  return searched(plank(true), (layer, L, G) => {
    // Everything off the shelf and onto the floor: the crate on its face, books strewn.
    layer.poly([[L + 9, G + 1], [L + 19, G + 3], [L + 18, G + 8], [L + 8, G + 6]], wood[3]);
    layer.line(L + 9, G + 1, L + 19, G + 3, bone[1]);
    layer.rect(L + 11, G + 4, 5, 1, ink[1]);
    layer.rect(L - 2, G + 3, 3, 5, denim[1]).rect(L - 2, G + 3, 3, 1, bone[2]);
    layer.rect(L + 3, G + 8, 5, 2, brick[2]).rect(L + 3, G + 8, 5, 1, bone[2]);
    layer.rect(L + 22, G + 5, 2, 3, teal[2]).px(L + 22, G + 5, bone[3]);
    layer.line(L + 20, G + 9, L + 25, G + 8, olive[2]);
    paper(layer, L + 21, G + 1);
  });
}

// --- A teacher's desk: a stack of drawers either side of the kneehole, the day's marking on top ---

function teacher(open: boolean): Piece {
  const p = startPiece('table', RISE);
  const { c, left: L, right: R, ground: G, front: F, top: T } = p;
  slab(p, [[1, 6, 22, 1], [8, 7, 1, 7], [14, 1, 1, 5]]);
  c.rect(L, F, 24, 2, wood[0]).rect(L, F, 24, 1, wood[1]);
  c.rect(L + 9, F + 2, 6, G - F - 2, ink[1]);
  for (const x of [L, R - 8]) {
    c.rect(x, F + 2, 9, G - F - 2, wood[1]).rect(x, F + 2, 1, G - F - 2, wood[2]);
  }
  // Left stack: one deep drawer. Right stack: a shallow one over a deep one.
  c.rect(L + 1, F + 3, 7, 3, open ? ink[0] : wood[2]);
  if (!open) {
    c.rect(L + 1, F + 3, 7, 1, wood[3]);
    pull(c, L + 4, F + 4);
  }
  c.rect(R - 7, F + 3, 7, 1, wood[3]).rect(R - 7, F + 4, 7, 1, wood[2]).rect(R - 7, F + 5, 7, 1, wood[0]);
  if (open) c.rect(R - 7, F + 4, 7, 2, ink[0]);
  else pull(c, R - 5, F + 4);
  c.px(R - 4, F + 6, wood[3]);
  if (!open) {
    // Books stacked at the back left, an apple, the bell, a heap of marking, the register open.
    book(c, L + 2, T + 6, 8, 3, brick[2]);
    book(c, L + 3, T + 3, 7, 3, denim[1]);
    book(c, L + 3, T + 1, 6, 2, olive[2]);
    c.ellipse(L + 12, T + 11, 2, 2, blood[2]).px(L + 12, T + 9, olive[2]).px(L + 11, T + 10, bone[3]);
    c.rect(L + 17, T + 2, 5, 4, bone[2]).rect(L + 18, T + 3, 3, 1, bone[1]).rect(L + 18, T + 5, 3, 1, bone[1]);
    c.rect(L + 17, T + 7, 6, 5, bone[3]).rect(L + 17, T + 7, 6, 1, bone[1]).rect(L + 19, T + 8, 1, 4, bone[1]);
    c.rect(L + 13, T + 3, 3, 2, fire[2]).px(L + 14, T + 2, fire[3]);
  } else {
    // The stack toppled across the front, the register torn from its place.
    c.poly([[L + 3, T + 7], [L + 13, T + 9], [L + 12, T + 12], [L + 2, T + 10]], brick[2]);
    c.line(L + 3, T + 7, L + 13, T + 9, bone[2]);
    c.rect(L + 16, T + 3, 4, 2, bone[2]);
  }
  return p;
}

function teacherOpened(): PixelSprite {
  return searched(teacher(true), (layer, L, G) => {
    // Left drawer heaved right out and left lying on its back, the right one hanging by a hand.
    layer.rect(L - 3, G + 1, 10, 4, wood[2]).rect(L - 2, G + 1, 8, 2, ink[0]).rect(L - 3, G + 4, 10, 1, wood[3]);
    layer.rect(L + 17, G - 4, 7, 3, wood[2]).rect(L + 17, G - 4, 7, 1, wood[3]);
    // The teacher's chair pitched over on its side by the kneehole, its legs in the air.
    layer.rect(L + 9, G + 3, 8, 3, wood[3]).rect(L + 9, G + 3, 8, 1, bone[1]);
    layer.rect(L + 9, G + 6, 1, 4, wood[1]).rect(L + 16, G + 6, 1, 4, wood[1]).rect(L + 12, G + 6, 1, 3, wood[1]);
    layer.rect(L + 7, G + 1, 2, 6, wood[2]);
    layer.ellipse(L + 22, G + 7, 2, 2, blood[2]);
    paper(layer, L + 2, G + 7);
    paper(layer, L + 19, G + 3);
    tipped(layer, L + 12, G + 9, bone[2]);
  });
}

/** Four desks: the stock one is the fifth look, kept in the table. */
export function buildDeskVariants(_base: PixelSprite): readonly ContainerArt[] {
  return [
    { closed: finish(clerk(false)), opened: clerkOpened() },
    { closed: finish(typist(false)), opened: typistOpened() },
    { closed: finish(plank(false)), opened: plankOpened() },
    { closed: finish(teacher(false)), opened: teacherOpened() },
  ];
}
