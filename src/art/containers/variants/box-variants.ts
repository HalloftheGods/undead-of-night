// Four more stacks on the stock stack's footprint, each hand-composed and each with a shut and a
// searched look: two towers of milk crates, a wide low slatted crate on a pallet, a lumpy pile of
// small cartons, and a wrapped case riding two little boxes. Searched, each is ransacked its own way.

import { PixelCanvas } from '../../kit.ts';
import { RAMPS } from '../../palette.ts';
import type { Color } from '../../palette.ts';
import type { PixelSprite } from '../../types.ts';
import { groundShadow } from '../../environment/common.ts';
import { bakeStage, glints, over, paper, stage, tipped, upright } from '../stage.ts';
import type { ContainerArt } from '../stage.ts';

const { ink, wood, bone, blood, denim, teal, olive, fire, metal } = RAMPS;

const FOOT_W = 20;
const GROUND = 30;
const LEFT = 2;

/** One look drawn at footprint column x and ground row g. */
type Draw = (c: PixelCanvas, x: number, g: number) => void;

function bottle(c: PixelCanvas, x: number, y: number, h: number, glass: Color): void {
  c.rect(x, y + 2, 3, h - 2, glass).rect(x + 1, y, 1, 3, glass).px(x, y + 2, bone[3]).px(x + 1, y, bone[3]);
}

function tin(c: PixelCanvas, x: number, y: number, color: Color): void {
  c.rect(x, y, 3, 3, color).px(x, y, bone[3]).px(x + 2, y + 2, ink[1]);
}

/** A plastic crate seen from the front: slotted sides, a rim and a foot. */
function milkCrate(c: PixelCanvas, x: number, y: number, w: number, h: number, body: Color, rim: Color): void {
  c.rect(x, y, w, h, body).rect(x, y, w, 2, rim).rect(x, y + h - 1, w, 1, rim);
  for (let sx = x + 1; sx < x + w - 1; sx += 2) c.rect(sx, y + 3, 1, h - 5, ink[0]);
  c.rect(x + Math.floor(w / 2) - 1, y, 3, 1, ink[0]);
}

function shadowBase(): PixelCanvas {
  const c = new PixelCanvas(FOOT_W + 4, 34);
  groundShadow(c, LEFT + 1, GROUND - 1, FOOT_W, 3);
  return c;
}

function closedFrom(base: PixelSprite, draw: Draw): PixelSprite {
  const c = shadowBase();
  draw(c, LEFT, GROUND);
  c.outline({ selective: true });
  return c.toSprite(base.w, base.h, base.ax, base.ay);
}

function openedFrom(base: PixelSprite, draw: Draw): PixelSprite {
  const c = shadowBase();
  c.outline({ selective: true });
  const s = stage('crate_stack', c.toSprite(base.w, base.h, base.ax, base.ay), 4, 6);
  over(s.c, (layer) => draw(layer, s.left, s.ground));
  return bakeStage(s);
}

// 1. Milk crates: a tall tower of three with bottles in the top, a short one of two under a board.

const milkClosed: Draw = (c, x, g) => {
  bottle(c, x + 1, g - 28, 6, olive[2]);
  bottle(c, x + 4, g - 30, 8, denim[2]);
  bottle(c, x + 6, g - 27, 5, bone[1]);
  milkCrate(c, x, g - 8, 9, 8, blood[2], blood[3]);
  milkCrate(c, x + 1, g - 16, 9, 8, denim[1], denim[2]);
  milkCrate(c, x, g - 24, 9, 8, teal[1], teal[2]);
  milkCrate(c, x + 11, g - 8, 9, 8, fire[1], fire[2]);
  milkCrate(c, x + 11, g - 16, 9, 8, blood[2], blood[3]);
  c.rect(x + 10, g - 20, 10, 4, bone[1]).rect(x + 10, g - 20, 10, 1, bone[3]).rect(x + 14, g - 20, 2, 4, wood[3]);
  c.px(x + 12, g - 18, ink[1]).px(x + 18, g - 17, ink[1]);
  c.rect(x + 12, g - 22, 6, 2, bone[2]);
};

const milkOpened: Draw = (c, x, g) => {
  milkCrate(c, x, g - 8, 9, 8, blood[2], blood[3]);
  milkCrate(c, x + 2, g - 16, 9, 8, denim[1], denim[2]);
  c.rect(x + 2, g - 18, 9, 2, ink[0]).px(x + 4, g - 19, olive[2]).px(x + 4, g - 20, olive[2]);
  milkCrate(c, x + 11, g - 8, 9, 8, fire[1], fire[2]);
  c.rect(x + 11, g - 10, 9, 2, ink[0]).rect(x + 15, g - 13, 3, 4, denim[2]).px(x + 15, g - 13, bone[3]);
  // The top crates, tipped onto their sides in front, mouths to the room.
  c.rect(x + 3, g + 1, 10, 6, teal[1]).rect(x + 4, g + 2, 8, 4, ink[0]).rect(x + 3, g + 1, 10, 1, teal[2]);
  c.rect(x + 5, g + 4, 3, 2, bone[2]);
  c.rect(x + 14, g + 3, 6, 4, blood[2]).rect(x + 15, g + 4, 4, 2, ink[0]).rect(x + 14, g + 3, 6, 1, blood[3]);
  // Bottles rolled out of them.
  c.rect(x - 2, g + 2, 5, 3, olive[2]).rect(x - 4, g + 3, 2, 1, olive[2]).px(x - 2, g + 2, bone[3]);
  c.rect(x + 11, g - 1, 5, 3, denim[2]).rect(x + 16, g, 2, 1, denim[2]).px(x + 11, g - 1, bone[3]);
  upright(c, x + 18, g - 1, bone[1], 4);
  tipped(c, x + 1, g - 10 + 12, fire[1]);
  glints(c, [[x + 8, g + 7], [x - 1, g + 6], [x + 18, g + 5]]);
};

// 2. A wide, low slatted crate roped down on a pallet, a small box and a bunched tarp on its lid.

const pallet = (c: PixelCanvas, x: number, g: number): void => {
  for (const [fx, fw] of [[1, 3], [8, 4], [16, 3]] as const) c.rect(x + fx, g - 3, fw, 3, wood[1]);
  c.rect(x, g - 5, 20, 2, wood[2]).rect(x, g - 5, 20, 1, wood[3]);
  c.px(x + 6, g - 4, wood[1]).px(x + 13, g - 4, wood[1]);
};

const slatClosed: Draw = (c, x, g) => {
  pallet(c, x, g);
  c.rect(x, g - 15, 20, 10, wood[2]);
  c.rect(x, g - 12, 20, 1, wood[1]).rect(x, g - 8, 20, 1, wood[1]);
  c.rect(x, g - 15, 2, 10, wood[3]).rect(x + 18, g - 15, 2, 10, wood[1]);
  c.line(x + 2, g - 6, x + 8, g - 14, wood[3]).line(x + 3, g - 6, x + 9, g - 14, wood[1]);
  for (const ny of [g - 14, g - 10, g - 6]) c.px(x + 1, ny, bone[2]).px(x + 18, ny + 1, bone[1]);
  c.rect(x + 11, g - 11, 6, 1, blood[2]).rect(x + 12, g - 9, 4, 1, ink[1]);
  c.rect(x - 1, g - 17, 22, 2, wood[3]).rect(x - 1, g - 17, 22, 1, bone[1]);
  c.rect(x + 9, g - 17, 2, 12, bone[1]).rect(x + 9, g - 17, 1, 12, bone[2]).rect(x + 8, g - 12, 4, 2, bone[3]).px(x + 9, g - 11, wood[1]);
  c.rect(x + 2, g - 24, 8, 7, wood[2]).rect(x + 2, g - 24, 8, 2, wood[3]).rect(x + 5, g - 24, 2, 7, bone[3]);
  c.rect(x + 3, g - 20, 3, 2, bone[2]).px(x + 8, g - 18, wood[1]);
  c.poly([[x + 11, g - 17], [x + 12, g - 21], [x + 15, g - 23], [x + 18, g - 21], [x + 20, g - 17]], olive[1]);
  c.line(x + 12, g - 20, x + 15, g - 22, olive[2]).line(x + 16, g - 21, x + 18, g - 19, olive[0]);
  c.px(x + 14, g - 19, olive[2]);
};

const slatOpened: Draw = (c, x, g) => {
  pallet(c, x, g);
  c.rect(x, g - 15, 20, 10, wood[2]).rect(x, g - 15, 2, 10, wood[3]).rect(x + 18, g - 15, 2, 10, wood[1]);
  c.rect(x + 2, g - 15, 16, 7, ink[0]);
  c.rect(x + 2, g - 8, 16, 3, wood[2]).rect(x + 2, g - 8, 16, 1, wood[1]);
  c.poly([[x + 2, g - 15], [x + 6, g - 15], [x + 4, g - 12], [x + 2, g - 10]], wood[3]);
  c.poly([[x + 12, g - 8], [x + 18, g - 8], [x + 18, g - 11], [x + 15, g - 9]], wood[3]);
  // Straw packing and the tarp, dragged half out over the lip.
  c.line(x + 4, g - 11, x + 9, g - 13, fire[1]).line(x + 6, g - 9, x + 13, g - 12, bone[1]).line(x + 10, g - 14, x + 16, g - 11, fire[1]);
  c.poly([[x + 9, g - 14], [x + 16, g - 13], [x + 18, g - 6], [x + 20, g + 2], [x + 12, g + 1], [x + 10, g - 5]], olive[1]);
  c.line(x + 11, g - 11, x + 14, g - 1, olive[2]).line(x + 15, g - 12, x + 17, g - 2, olive[0]);
  // The lid pried off and thrown face up, loose slats and the cut rope.
  c.poly([[x - 4, g + 1], [x + 9, g], [x + 10, g + 3], [x - 3, g + 5]], wood[3]);
  c.line(x - 3, g + 2, x + 8, g + 1, bone[1]).px(x - 1, g + 3, bone[2]).px(x + 7, g + 2, bone[2]);
  c.rect(x + 10, g + 5, 10, 2, wood[2]).px(x + 19, g + 5, bone[2]);
  c.rect(x + 17, g + 2, 8, 2, wood[1]);
  c.line(x + 9, g - 3, x + 5, g + 3, bone[1]);
  c.rect(x + 2, g - 4, 6, 3, wood[3]).rect(x + 2, g - 4, 6, 1, bone[3]).rect(x + 4, g - 4, 2, 3, bone[2]);
  paper(c, x + 12, g + 3);
  tipped(c, x + 21, g, blood[2]);
};

// 3. A lumpy pile of small cartons of different heights, one taped red, one with a label.

const pileClosed: Draw = (c, x, g) => {
  c.rect(x, g - 9, 7, 9, wood[2]).rect(x, g - 9, 7, 2, wood[3]).rect(x + 6, g - 9, 1, 9, wood[1]);
  c.rect(x + 3, g - 9, 1, 9, blood[2]).rect(x, g - 5, 7, 1, blood[2]).px(x + 3, g - 5, blood[3]);
  c.rect(x + 7, g - 9, 6, 9, wood[2]).rect(x + 7, g - 9, 6, 2, wood[3]).rect(x + 12, g - 9, 1, 9, wood[1]);
  c.rect(x + 8, g - 6, 4, 4, bone[3]).rect(x + 9, g - 5, 2, 1, ink[1]).rect(x + 9, g - 3, 2, 1, ink[1]);
  c.rect(x + 13, g - 6, 7, 6, wood[3]).rect(x + 13, g - 6, 7, 1, bone[2]).rect(x + 19, g - 6, 1, 6, wood[2]);
  c.rect(x + 13, g - 3, 7, 1, bone[3]).rect(x + 15, g - 5, 3, 1, wood[1]);
  c.rect(x + 1, g - 17, 11, 8, wood[2]).rect(x + 1, g - 17, 11, 2, wood[3]).rect(x + 11, g - 17, 1, 8, wood[1]);
  c.rect(x + 5, g - 17, 2, 8, bone[3]).rect(x + 3, g - 12, 5, 2, ink[1]).rect(x + 2, g - 10, 3, 1, wood[1]);
  c.rect(x + 13, g - 12, 7, 6, wood[2]).rect(x + 13, g - 12, 7, 2, wood[3]).rect(x + 19, g - 12, 1, 6, wood[1]);
  c.rect(x + 15, g - 12, 2, 6, bone[3]).rect(x + 14, g - 8, 2, 2, blood[2]);
  c.rect(x + 3, g - 22, 6, 5, wood[3]).rect(x + 3, g - 22, 6, 1, bone[2]).rect(x + 8, g - 22, 1, 5, wood[2]);
  c.rect(x + 5, g - 22, 1, 5, bone[3]).px(x + 3, g - 20, blood[2]);
  c.rect(x + 14, g - 14, 5, 2, bone[2]).rect(x + 14, g - 14, 2, 1, bone[3]);
};

const pileOpened: Draw = (c, x, g) => {
  c.rect(x, g - 9, 7, 9, wood[2]).rect(x + 6, g - 9, 1, 9, wood[1]);
  c.rect(x + 1, g - 10, 5, 2, ink[0]);
  c.poly([[x, g - 9], [x - 4, g - 7], [x - 4, g - 4], [x, g - 6]], wood[3]);
  c.poly([[x + 6, g - 9], [x + 9, g - 12], [x + 11, g - 11], [x + 7, g - 8]], wood[3]);
  c.rect(x + 2, g - 12, 3, 2, bone[1]);
  // Slumped and stamped flat, the label one next to it.
  c.poly([[x + 7, g - 4], [x + 11, g - 5], [x + 13, g - 3], [x + 14, g - 6], [x + 15, g], [x + 7, g]], wood[2]);
  c.line(x + 7, g - 4, x + 11, g - 5, wood[1]).line(x + 13, g - 3, x + 14, g - 6, wood[0]);
  c.rect(x + 9, g - 3, 3, 3, bone[3]).rect(x + 9, g - 3, 3, 1, blood[2]);
  // The top boxes shoved off, one face down, one gutted on its side, one split.
  c.poly([[x + 4, g + 1], [x + 14, g + 1], [x + 15, g + 6], [x + 3, g + 6]], wood[2]);
  c.rect(x + 4, g + 1, 10, 2, wood[3]).rect(x + 8, g + 1, 2, 5, bone[3]);
  c.rect(x + 16, g - 5, 7, 6, wood[3]).rect(x + 17, g - 4, 5, 4, ink[0]).rect(x + 16, g - 5, 7, 1, bone[2]);
  c.px(x + 18, g - 2, bone[2]).px(x + 20, g - 3, bone[3]);
  c.rect(x - 4, g + 1, 5, 4, wood[3]).rect(x - 4, g + 1, 5, 1, bone[2]).px(x - 3, g + 3, blood[2]);
  for (const [px, py] of [[16, 4], [19, 6], [13, 7], [22, 3], [1, 7], [-2, 6]] as const) c.px(x + px, g + py, bone[3]);
  c.px(x + 17, g + 5, bone[2]).px(x + 21, g + 5, bone[2]).px(x + 11, g + 8, bone[2]);
  paper(c, x + 17, g + 7);
  tin(c, x + 19, g + 1, fire[1]);
  tin(c, x + 22, g + 4, olive[2]);
};

// 4. A shrink-wrapped case on two little boxes, a gap of daylight between them, strapped.

const wrappedClosed: Draw = (c, x, g) => {
  for (const sx of [x, x + 13]) {
    c.rect(sx, g - 8, 7, 8, olive[1]).rect(sx, g - 8, 7, 2, olive[2]).rect(sx + 6, g - 8, 1, 8, olive[0]);
    c.rect(sx + 1, g - 4, 3, 1, bone[2]).rect(sx + 1, g - 2, 5, 1, bone[1]);
  }
  c.rect(x - 1, g - 21, 22, 13, denim[1]).rect(x - 1, g - 21, 22, 4, denim[2]).rect(x - 1, g - 9, 22, 1, denim[0]);
  c.rect(x - 1, g - 21, 1, 13, bone[3]).rect(x + 20, g - 21, 1, 13, bone[2]);
  c.line(x + 1, g - 9, x + 5, g - 16, bone[3]).line(x + 8, g - 9, x + 11, g - 14, bone[2]).line(x + 15, g - 12, x + 19, g - 18, bone[3]);
  c.rect(x + 4, g - 21, 2, 13, fire[2]).rect(x + 14, g - 21, 2, 13, fire[2]).rect(x + 4, g - 15, 2, 3, fire[3]);
  c.px(x + 15, g - 14, ink[1]).px(x + 15, g - 15, ink[1]);
  c.rect(x + 8, g - 13, 4, 1, bone[3]).rect(x + 9, g - 11, 2, 1, bone[1]);
  c.rect(x + 2, g - 27, 4, 6, blood[2]).rect(x + 3, g - 29, 2, 2, blood[3]).px(x + 2, g - 26, bone[3]);
  c.rect(x + 9, g - 24, 8, 3, bone[2]).rect(x + 9, g - 24, 8, 1, bone[3]).rect(x + 12, g - 24, 1, 3, wood[2]);
  c.rect(x + 17, g - 24, 3, 3, fire[1]).px(x + 17, g - 24, bone[3]);
};

const wrappedOpened: Draw = (c, x, g) => {
  c.rect(x, g - 8, 7, 8, olive[1]).rect(x, g - 8, 7, 2, olive[2]).rect(x + 6, g - 8, 1, 8, olive[0]);
  c.rect(x + 1, g - 4, 3, 1, bone[2]);
  // The right-hand box knocked onto its side, lid sprung.
  c.rect(x + 14, g + 1, 8, 6, olive[1]).rect(x + 15, g + 2, 6, 4, ink[0]).rect(x + 14, g + 1, 8, 1, olive[2]);
  c.poly([[x + 14, g + 1], [x + 12, g - 2], [x + 17, g - 2], [x + 18, g + 1]], olive[2]);
  // The case slid off, one end on the floor, the lid open at the high end.
  c.poly([[x - 1, g - 17], [x + 19, g - 8], [x + 19, g], [x - 1, g - 8]], denim[1]);
  c.poly([[x - 1, g - 17], [x + 19, g - 8], [x + 19, g - 5], [x - 1, g - 14]], denim[2]);
  c.poly([[x - 1, g - 17], [x + 19, g - 8], [x + 19, g - 6], [x - 1, g - 15]], ink[0]);
  c.px(x + 3, g - 15, fire[1]).px(x + 4, g - 15, fire[1]).px(x + 9, g - 12, bone[3]).px(x + 14, g - 9, olive[2]);
  c.poly([[x - 5, g + 2], [x + 8, g + 1], [x + 9, g + 5], [x - 4, g + 7]], denim[2]);
  c.line(x - 4, g + 3, x + 8, g + 2, bone[3]).line(x - 4, g + 7, x + 9, g + 5, denim[0]);
  c.line(x + 4, g - 8, x + 12, g - 6, bone[3]).line(x + 1, g - 10, x + 5, g - 9, bone[2]);
  c.rect(x + 8, g - 12, 2, 7, fire[2]).rect(x + 9, g - 5, 2, 5, fire[2]);
  // The wrap slit and hanging in strips, the other strap snapped.
  c.poly([[x + 12, g - 11], [x + 15, g - 7], [x + 14, g + 1], [x + 12, g + 1], [x + 13, g - 5]], bone[3]);
  c.line(x + 15, g - 7, x + 16, g - 1, bone[2]);
  // What was inside, strewn past the broken end.
  tin(c, x + 21, g - 2, fire[1]);
  tipped(c, x + 20, g + 3, olive[2]);
  tipped(c, x + 9, g + 4, blood[2]);
  paper(c, x + 10, g + 8);
  upright(c, x + 17, g + 8, bone[1], 4);
  c.px(x + 19, g + 5, metal[3]).px(x + 6, g + 2, metal[2]);
};

export function buildCrateVariants(base: PixelSprite): readonly ContainerArt[] {
  const looks: readonly (readonly [Draw, Draw])[] = [
    [milkClosed, milkOpened],
    [slatClosed, slatOpened],
    [pileClosed, pileOpened],
    [wrappedClosed, wrappedOpened],
  ];
  return looks.map(([shut, searched]) => ({ closed: closedFrom(base, shut), opened: openedFrom(base, searched) }));
}
