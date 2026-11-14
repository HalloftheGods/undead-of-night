// Four more kitchen counters on the stock counter's footprint, each with a shut and a searched look,
// and each composed on its own: a butcher-block with a bank of drawers, a sink unit behind a curtain,
// an open-shelf prep table and a glass-fronted dresser base. What sits on top, what is behind the
// front and what has been dragged out differs in every one, not just the paint.

import { finish, startPiece } from '../../environment/furniture.ts';
import { PixelCanvas } from '../../kit.ts';
import { RAMPS } from '../../palette.ts';
import type { PixelSprite } from '../../types.ts';
import { bakeStage, over, stage } from '../stage.ts';
import type { ContainerArt } from '../stage.ts';

const { ink, metal, wood, bone, denim, teal, blood, olive, fire, ash, concrete } = RAMPS;

const W = 48;

/** Where the counter sits on a canvas: its left column, top-face row, front-face row and ground row. */
interface Spot {
  readonly c: PixelCanvas;
  readonly L: number;
  readonly T: number;
  readonly F: number;
  readonly G: number;
}
type Draw = (s: Spot, ransacked: boolean) => void;

const spot = (c: PixelCanvas, L: number, G: number): Spot => ({ c, L, T: G - 24, F: G - 12, G });

function closedOf(top: Draw, front: Draw): PixelSprite {
  const p = startPiece('counter', 12);
  const s = spot(p.c, p.left, p.ground);
  top(s, false);
  front(s, false);
  return finish(p);
}

function openedOf(base: PixelSprite, top: Draw, front: Draw): PixelSprite {
  const st = stage('counter', new PixelCanvas(base.w, base.h).toSprite(base.w, base.h, base.ax, base.ay), 2, 7);
  over(st.c, (layer) => {
    for (let row = 0; row < 3; row++) layer.rect(st.left + 1 + row, st.ground - 1 + row, W - row, 1, ink[1]);
    const s = spot(layer, st.left, st.ground);
    top(s, true);
    front(s, true);
  });
  return bakeStage(st);
}

function knob(c: PixelCanvas, x: number, y: number): void {
  c.rect(x, y, 2, 2, metal[3]).px(x + 1, y + 1, metal[1]);
}

function tin(c: PixelCanvas, x: number, y: number, w: number, h: number, col: number): void {
  c.rect(x, y, w, h, col).px(x, y, bone[3]);
}

function kick(c: PixelCanvas, L: number, G: number): void {
  c.rect(L, G - 2, W, 2, ink[1]);
}

// ---------------------------------------------------------------------------------------------
// Butcher block, drawers all the way down.

const topBlock: Draw = ({ c, L, T }, hit) => {
  c.rect(L, T, W, 12, wood[3]).rect(L, T, W, 1, bone[2]).rect(L + 47, T, 1, 12, wood[2]);
  for (const x of [9, 17, 25, 33, 41]) c.rect(L + x, T + 1, 1, 10, wood[2]);
  c.px(L + 12, T + 6, wood[2]).px(L + 28, T + 4, wood[2]).px(L + 29, T + 4, wood[2]);
  if (!hit) {
    c.rect(L + 2, T + 3, 1, 4, ink[1]).rect(L + 3, T + 3, 7, 6, metal[2]).rect(L + 4, T + 4, 1, 4, metal[3]);
    c.rect(L + 3, T + 8, 7, 1, metal[1]).rect(L + 4, T + 2, 5, 1, metal[3]).px(L + 6, T + 1, ink[1]);
    c.rect(L + 10, T + 5, 2, 1, metal[2]).px(L + 11, T + 4, metal[2]);
    c.rect(L + 31, T + 2, 12, 7, bone[2]).rect(L + 31, T + 2, 12, 2, bone[3]).rect(L + 31, T + 8, 12, 1, bone[1]);
    c.rect(L + 34, T + 5, 6, 1, blood[1]);
    c.rect(L + 19, T + 6, 3, 3, denim[1]).px(L + 22, T + 7, denim[2]).px(L + 19, T + 6, denim[2]);
    c.rect(L + 24, T + 8, 3, 3, blood[1]).px(L + 27, T + 9, blood[2]);
    c.line(L + 13, T + 10, L + 18, T + 9, metal[3]);
    return;
  }
  // The kettle knocked on its side, water running to the lip, the bin open and its lid skewed.
  c.rect(L + 5, T + 7, 7, 4, metal[2]).rect(L + 5, T + 7, 7, 1, metal[3]).rect(L + 3, T + 8, 2, 1, metal[2]);
  c.rect(L + 12, T + 7, 2, 3, ink[1]).rect(L + 8, T + 11, 6, 1, denim[2]);
  c.rect(L + 31, T + 4, 12, 5, bone[2]).rect(L + 32, T + 4, 10, 2, ink[0]).rect(L + 31, T + 8, 12, 1, bone[1]);
  c.rect(L + 38, T + 3, 5, 2, fire[1]).px(L + 41, T + 3, fire[2]);
  c.poly([[L + 29, T + 9], [L + 36, T + 8], [L + 37, T + 10], [L + 30, T + 11]], bone[3]);
  c.rect(L + 22, T + 9, 4, 3, denim[1]).px(L + 22, T + 9, denim[2]).px(L + 25, T + 10, ink[1]);
  c.px(L + 17, T + 5, fire[1]).px(L + 20, T + 7, fire[1]);
};

const frontBlock: Draw = ({ c, L, F, G }, hit) => {
  c.rect(L, F, W, 12, wood[1]).rect(L, F, W, 1, wood[0]);
  kick(c, L, G);
  c.rect(L + 16, F + 1, 1, 9, wood[0]);
  if (!hit) {
    for (const y of [1, 4, 7]) {
      c.rect(L + 1, F + y, 15, 3, wood[2]).rect(L + 1, F + y, 15, 1, wood[3]).px(L + 8, F + y + 1, metal[3]).px(L + 9, F + y + 1, metal[3]);
    }
    c.rect(L + 17, F + 1, 30, 4, wood[2]).rect(L + 17, F + 1, 30, 1, wood[3]).rect(L + 25, F + 2, 14, 1, metal[3]);
    c.rect(L + 17, F + 6, 30, 4, wood[2]).rect(L + 17, F + 6, 30, 1, wood[3]).rect(L + 38, F + 7, 4, 2, bone[2]);
    c.rect(L + 22, F + 8, 3, 1, metal[3]);
    return;
  }
  // Top left drawer gone, the next hauled out crooked, the last pushed shut.
  c.rect(L + 1, F + 1, 15, 3, ink[0]).line(L + 11, F + 2, L + 14, F + 3, metal[3]);
  c.poly([[L + 1, F + 4], [L + 16, F + 5], [L + 16, F + 8], [L + 1, F + 7]], wood[2]);
  c.line(L + 1, F + 4, L + 16, F + 5, wood[3]);
  c.line(L + 1, F + 7, L + 16, F + 8, wood[0]);
  c.rect(L + 7, F + 5, 2, 1, metal[3]).rect(L + 1, F + 9, 15, 1, wood[2]);
  // The upper right drawer is empty with a tea towel trailing out of it, the lower one dragged forward.
  c.rect(L + 17, F + 1, 30, 4, ink[0]);
  c.rect(L + 34, F + 3, 7, 6, bone[2]).rect(L + 34, F + 5, 7, 1, blood[1]).rect(L + 34, F + 7, 7, 1, blood[1]);
  c.rect(L + 17, F + 6, 30, 2, ink[1]).rect(L + 20, F + 6, 9, 1, wood[3]).line(L + 31, F + 6, L + 36, F + 7, metal[2]);
  c.rect(L + 16, F + 8, 32, 3, wood[2]).rect(L + 16, F + 8, 32, 1, wood[3]).rect(L + 25, F + 9, 12, 1, metal[3]);
  // On the floor: the first drawer upside down and its cutlery scattered.
  c.poly([[L + 0, G + 2], [L + 13, G + 1], [L + 15, G + 5], [L + 2, G + 6]], wood[3]);
  c.line(L + 0, G + 2, L + 13, G + 1, wood[2]);
  c.line(L + 17, G + 3, L + 22, G + 2, metal[3]).line(L + 18, G + 5, L + 23, G + 6, metal[2]).line(L + 26, G + 3, L + 29, G + 5, metal[3]);
  tin(c, L + 34, G + 3, 4, 2, olive[2]);
  c.rect(L + 41, G + 2, 6, 2, fire[1]).px(L + 46, G + 2, fire[2]);
};

// ---------------------------------------------------------------------------------------------
// Sink unit: basin and tap on the left, draining board and dish rack on the right, a curtain below.

const topSink: Draw = ({ c, L, T }, hit) => {
  c.rect(L, T, W, 12, ash[2]).rect(L, T, W, 1, bone[1]).rect(L + 47, T, 1, 12, ash[1]);
  c.px(L + 2, T + 7, ash[1]).px(L + 27, T + 6, ash[1]).px(L + 45, T + 10, ash[1]);
  c.rect(L + 3, T + 2, 24, 8, metal[3]).rect(L + 4, T + 3, 22, 6, metal[1]).rect(L + 4, T + 3, 22, 1, metal[0]);
  c.rect(L + 14, T + 6, 3, 1, ink[0]).line(L + 7, T + 8, L + 11, T + 8, metal[2]);
  c.rect(L + 14, T, 1, 3, metal[3]).rect(L + 14, T, 4, 1, metal[2]).rect(L + 17, T + 1, 1, 2, metal[2]);
  c.px(L + 11, T + 1, blood[2]).px(L + 20, T + 1, denim[2]);
  c.rect(L + 28, T + 2, 19, 9, metal[2]).rect(L + 28, T + 2, 19, 1, metal[3]).rect(L + 28, T + 2, 1, 9, metal[3]);
  for (const y of [4, 6, 8]) c.rect(L + 30, T + y, 15, 1, metal[1]);
  if (!hit) {
    c.rect(L + 31, T + 7, 13, 2, metal[3]);
    for (const [x, h] of [[32, 5], [35, 5], [38, 4]] as const) c.rect(L + x, T + 7 - h, 2, h, bone[2]).rect(L + x, T + 7 - h, 1, h, bone[3]);
    c.rect(L + 41, T + 4, 3, 3, fire[1]).px(L + 44, T + 5, fire[2]);
    c.px(L + 8, T + 5, bone[3]).px(L + 20, T + 7, bone[3]);
    return;
  }
  // The rack folded over, one plate left in it and the rest gone off the edge; dirty water standing in the basin.
  c.rect(L + 5, T + 5, 20, 3, denim[1]).rect(L + 8, T + 5, 6, 1, denim[2]);
  c.line(L + 31, T + 9, L + 43, T + 7, metal[3]).line(L + 31, T + 10, L + 43, T + 8, metal[3]);
  c.rect(L + 36, T + 5, 5, 2, bone[2]).px(L + 36, T + 5, bone[3]);
  c.rect(L + 32, T + 10, 2, 1, bone[3]).rect(L + 44, T + 9, 2, 1, fire[1]);
};

const frontSink: Draw = ({ c, L, F, G }, hit) => {
  c.rect(L, F, W, 12, teal[1]).rect(L, F, W, 1, teal[0]);
  kick(c, L, G);
  c.rect(L + 29, F + 1, 1, 9, teal[0]);
  if (!hit) {
    c.rect(L + 1, F + 1, 28, 1, metal[3]).rect(L + 1, F + 2, 28, 8, denim[1]);
    for (const x of [4, 9, 13, 19, 24]) c.rect(L + x, F + 2, 1, 8, denim[2]);
    for (const x of [6, 16, 22]) c.rect(L + x, F + 2, 1, 8, denim[0]);
    for (const [x, y] of [[2, 4], [7, 6], [11, 3], [15, 7], [21, 5], [26, 4], [12, 8], [26, 8]] as const) c.px(L + x, F + y, bone[2]);
    c.rect(L + 1, F + 9, 28, 1, denim[0]);
    c.rect(L + 30, F + 1, 17, 9, teal[2]).rect(L + 31, F + 2, 15, 7, teal[1]).px(L + 31, F + 5, bone[3]).px(L + 31, F + 6, bone[3]);
    return;
  }
  // The curtain torn off its rod and dragged into a heap, the pipes and a bucket showing, the door sagging.
  c.rect(L + 8, F + 1, 21, 9, ink[0]);
  c.line(L + 1, F + 1, L + 28, F + 3, metal[3]);
  c.poly([[L + 1, F + 2], [L + 8, F + 2], [L + 6, F + 9], [L + 1, F + 10]], denim[1]);
  c.rect(L + 3, F + 3, 1, 6, denim[2]).rect(L + 5, F + 3, 1, 5, denim[0]).px(L + 2, F + 6, bone[2]).px(L + 6, F + 4, bone[2]);
  c.rect(L + 24, F + 3, 4, 4, denim[1]).px(L + 25, F + 7, denim[1]).rect(L + 26, F + 4, 1, 3, denim[2]);
  c.rect(L + 14, F + 2, 2, 5, metal[2]).rect(L + 21, F + 2, 2, 5, metal[2]).rect(L + 14, F + 7, 9, 1, metal[2]).rect(L + 15, F + 6, 7, 1, ink[1]);
  c.rect(L + 9, F + 5, 3, 5, bone[3]).rect(L + 9, F + 4, 3, 1, blood[2]);
  c.poly([[L + 46, F + 1], [L + 50, F + 3], [L + 50, F + 11], [L + 46, F + 9]], teal[2]);
  c.rect(L + 31, F + 1, 15, 9, ink[1]).rect(L + 33, F + 3, 8, 6, ash[1]).rect(L + 34, F + 2, 3, 2, ash[2]).rect(L + 40, F + 3, 3, 3, ash[2]);
  // Spilled: bleach, a sponge, the bucket on its side and a pool of suds.
  c.rect(L + 3, G + 2, 6, 2, bone[3]).rect(L + 8, G + 2, 2, 2, blood[2]).rect(L + 10, G + 3, 12, 2, denim[2]);
  c.rect(L + 22, G + 4, 4, 2, fire[2]).rect(L + 30, G + 1, 6, 4, teal[2]).rect(L + 31, G + 2, 4, 2, ink[0]);
  c.rect(L + 38, G + 3, 5, 1, ash[2]).rect(L + 40, G + 2, 1, 4, ash[1]);
};

// ---------------------------------------------------------------------------------------------
// Prep table: enamel top, a drawer across the front and open bays under it.

const topPrep: Draw = ({ c, L, T }, hit) => {
  c.rect(L, T, W, 12, bone[2]).rect(L, T, W, 1, bone[3]).rect(L, T, 1, 12, bone[3]).rect(L + 47, T, 1, 12, bone[1]);
  c.rect(L, T + 10, W, 2, wood[2]).rect(L, T + 10, W, 1, wood[3]);
  c.px(L + 17, T + 4, bone[1]).px(L + 26, T + 7, bone[1]);
  if (!hit) {
    c.rect(L + 4, T + 6, 10, 3, blood[1]).rect(L + 4, T + 6, 10, 1, bone[3]).rect(L + 5, T + 4, 9, 2, denim[1]).rect(L + 3, T + 2, 8, 2, olive[2]);
    c.rect(L + 3, T + 2, 8, 1, olive[1]).px(L + 7, T + 1, blood[3]).px(L + 8, T + 1, blood[2]);
    c.rect(L + 30, T + 3, 9, 6, denim[2]).rect(L + 30, T + 5, 9, 1, bone[3]).rect(L + 30, T + 7, 9, 1, bone[3]).rect(L + 30, T + 8, 9, 1, denim[1]);
    c.rect(L + 23, T + 7, 8, 2, wood[2]).rect(L + 23, T + 7, 8, 1, wood[3]).px(L + 22, T + 8, wood[1]);
    return;
  }
  // The books slid apart and one shoved off the end, the cloth pulled away, the pin on the floor.
  c.rect(L + 8, T + 5, 9, 2, olive[2]).rect(L + 11, T + 7, 10, 3, blood[1]).rect(L + 11, T + 7, 10, 1, bone[3]);
  c.poly([[L + 2, T + 6], [L + 8, T + 4], [L + 9, T + 6], [L + 3, T + 8]], denim[1]);
  c.px(L + 24, T + 3, blood[3]).px(L + 25, T + 3, blood[2]);
  c.rect(L + 34, T + 5, 5, 1, denim[2]).rect(L + 36, T + 6, 3, 1, bone[3]);
};

const frontPrep: Draw = ({ c, L, F, G }, hit) => {
  c.rect(L, F, W, 12, wood[1]).rect(L, F, W, 1, wood[0]);
  kick(c, L, G);
  c.rect(L + 1, F + 4, 46, 6, ink[1]).rect(L + 22, F + 4, 2, 6, wood[2]).rect(L + 22, F + 4, 1, 6, wood[3]);
  if (!hit) {
    c.rect(L + 1, F + 1, 46, 3, wood[2]).rect(L + 1, F + 1, 46, 1, wood[3]);
    knob(c, L + 11, F + 2);
    knob(c, L + 35, F + 2);
    c.rect(L + 1, F + 9, 21, 1, wood[3]).rect(L + 24, F + 9, 23, 1, wood[3]);
    c.rect(L + 2, F + 8, 10, 1, bone[3]).rect(L + 2, F + 7, 10, 1, bone[2]).rect(L + 3, F + 6, 8, 1, bone[3]).rect(L + 4, F + 5, 6, 1, bone[2]);
    c.rect(L + 13, F + 5, 7, 4, metal[1]).rect(L + 13, F + 5, 7, 1, metal[3]).px(L + 16, F + 4, metal[3]).rect(L + 20, F + 6, 2, 1, ink[0]);
    c.rect(L + 25, F + 6, 9, 3, wood[3]).px(L + 27, F + 7, wood[2]).px(L + 30, F + 7, wood[2]).px(L + 32, F + 6, wood[2]);
    c.rect(L + 36, F + 4, 4, 5, teal[1]).rect(L + 36, F + 4, 4, 1, metal[3]).px(L + 37, F + 6, bone[3]);
    c.rect(L + 41, F + 6, 5, 3, fire[1]).px(L + 41, F + 6, bone[3]).rect(L + 42, F + 4, 2, 2, olive[2]);
    return;
  }
  // The drawer hurled out to the right, the shelf board dropped at one end, the shelves picked clean.
  c.rect(L + 1, F + 1, 46, 3, ink[0]).rect(L + 5, F + 3, 5, 3, bone[2]).rect(L + 5, F + 3, 5, 1, bone[3]);
  c.poly([[L + 1, F + 9], [L + 21, F + 6], [L + 21, F + 7], [L + 1, F + 10]], wood[3]);
  c.rect(L + 12, F + 8, 3, 1, bone[1]).rect(L + 8, F + 5, 1, 1, bone[3]);
  c.rect(L + 24, F + 9, 23, 1, wood[3]).rect(L + 38, F + 5, 4, 4, teal[1]).rect(L + 38, F + 5, 4, 1, metal[3]);
  c.rect(L + 25, F + 7, 5, 2, fire[0]);
  // Plate shards, the pot on its side with its lid rolling away, the basket upended, and the drawer.
  c.rect(L + 2, G + 2, 8, 1, bone[2]).px(L + 5, G + 3, bone[3]).px(L + 8, G + 4, bone[3]).px(L + 3, G + 5, bone[2]);
  c.rect(L + 12, G + 2, 8, 4, metal[1]).rect(L + 12, G + 2, 8, 1, metal[3]).rect(L + 12, G + 3, 1, 2, ink[0]);
  c.ellipse(L + 24, G + 5, 3, 1, metal[2]);
  c.rect(L + 27, G + 2, 7, 3, wood[3]).px(L + 29, G + 3, wood[2]).px(L + 32, G + 2, wood[2]);
  c.poly([[L + 35, G + 1], [L + 47, G + 2], [L + 46, G + 6], [L + 36, G + 6]], wood[2]);
  c.line(L + 35, G + 1, L + 47, G + 2, wood[3]);
  c.rect(L + 38, G + 3, 6, 2, ink[0]).line(L + 38, G + 4, L + 43, G + 3, metal[3]);
  c.px(L + 24, G + 1, fire[2]).px(L + 26, G + 6, blood[2]);
};

// ---------------------------------------------------------------------------------------------
// Glass-front dresser base: canisters and a knife block on a slate top, crockery behind the doors.

const topGlass: Draw = ({ c, L, T }, hit) => {
  c.rect(L, T, W, 12, concrete[3]).rect(L, T, W, 1, bone[1]).rect(L + 47, T, 1, 12, concrete[2]);
  c.px(L + 11, T + 8, concrete[2]).px(L + 20, T + 5, concrete[2]).px(L + 33, T + 10, concrete[2]).px(L + 44, T + 3, concrete[2]);
  if (!hit) {
    for (const [x, h, col] of [[2, 8, teal[1]], [7, 6, fire[1]], [12, 7, olive[2]]] as const) {
      c.rect(L + x, T + 9 - h, 4, h, col).rect(L + x, T + 9 - h, 4, 1, bone[3]).rect(L + x + 1, T + 7, 2, 1, bone[2]);
    }
    c.rect(L + 25, T + 4, 5, 6, wood[1]).rect(L + 25, T + 4, 5, 1, wood[2]);
    for (const x of [25, 27, 29]) c.rect(L + x, T + 2, 1, 2, ink[1]);
    c.ellipse(L + 39, T + 7, 6, 2, metal[2]).rect(L + 34, T + 6, 11, 1, metal[3]);
    c.rect(L + 36, T + 4, 2, 2, blood[2]).rect(L + 39, T + 3, 2, 2, fire[2]).rect(L + 41, T + 5, 2, 2, olive[2]);
    c.rect(L + 17, T + 8, 4, 1, bone[3]).rect(L + 18, T + 7, 2, 1, fire[2]);
    return;
  }
  // Canisters rolled and emptied, flour dusting the slate, the block over, the bowl face down.
  c.rect(L + 3, T + 7, 8, 4, teal[1]).rect(L + 3, T + 7, 8, 1, bone[3]).rect(L + 11, T + 8, 1, 2, bone[2]);
  c.rect(L + 7, T + 2, 4, 5, fire[1]).rect(L + 7, T + 2, 4, 1, bone[3]);
  c.rect(L + 13, T + 6, 4, 1, bone[3]).rect(L + 14, T + 4, 2, 1, bone[3]).px(L + 12, T + 8, bone[3]).px(L + 16, T + 9, bone[2]);
  c.rect(L + 19, T + 5, 3, 3, olive[2]);
  c.rect(L + 24, T + 7, 6, 4, wood[1]).line(L + 24, T + 8, L + 21, T + 10, ink[1]).line(L + 25, T + 9, L + 22, T + 11, ink[1]);
  c.ellipse(L + 38, T + 7, 5, 2, metal[2]).rect(L + 33, T + 7, 11, 1, metal[1]);
  c.rect(L + 44, T + 4, 2, 2, blood[2]).rect(L + 33, T + 3, 2, 2, fire[2]);
};

const frontGlass: Draw = ({ c, L, F, G }, hit) => {
  c.rect(L, F, W, 12, ash[2]).rect(L, F, W, 1, ash[1]);
  kick(c, L, G);
  c.rect(L + 23, F + 1, 2, 9, ash[1]);
  if (!hit) {
    for (const x of [1, 25]) {
      c.rect(L + x, F + 1, 22, 9, bone[2]).rect(L + x + 2, F + 2, 18, 7, ink[1]).rect(L + x + 2, F + 6, 18, 1, wood[2]);
    }
    c.rect(L + 12, F + 2, 1, 7, bone[2]);
    for (const x of [5, 7, 9, 11, 15, 17]) c.rect(L + x, F + 3, 1, 3, bone[3]);
    c.rect(L + 14, F + 4, 1, 2, bone[1]).rect(L + 4, F + 7, 3, 2, bone[2]).rect(L + 8, F + 7, 3, 2, denim[2]).rect(L + 14, F + 7, 4, 2, bone[2]);
    for (const x of [29, 32, 36, 41]) c.px(L + x, F + 3, bone[3]).px(L + x, F + 4, bone[1]);
    c.rect(L + 33, F + 4, 6, 3, fire[1]).rect(L + 34, F + 3, 4, 1, fire[2]).rect(L + 39, F + 5, 2, 1, fire[1]).rect(L + 28, F + 7, 4, 2, teal[2]);
    c.line(L + 28, F + 3, L + 31, F + 2, teal[2]).line(L + 5, F + 2, L + 8, F + 2, bone[3]);
    c.rect(L + 21, F + 4, 1, 3, metal[3]).rect(L + 26, F + 4, 1, 3, metal[3]);
    return;
  }
  // Left door torn off and lying cracked on the floor, the right swung toward us, the shelves bare but for a few chips.
  c.rect(L + 1, F + 1, 22, 9, ink[0]).rect(L + 2, F + 6, 20, 1, wood[2]).rect(L + 2, F + 2, 20, 1, wood[1]);
  c.rect(L + 1, F + 1, 1, 9, ash[1]).rect(L + 22, F + 1, 1, 9, ash[1]);
  c.poly([[L + 2, F + 1], [L + 5, F + 1], [L + 3, F + 4]], bone[3]).poly([[L + 20, F + 9], [L + 22, F + 9], [L + 21, F + 6]], metal[3]);
  c.rect(L + 8, F + 4, 3, 2, bone[2]).rect(L + 15, F + 4, 2, 2, denim[2]).line(L + 14, F + 7, L + 19, F + 5, bone[1]);
  c.rect(L + 25, F + 1, 22, 9, ink[0]).rect(L + 26, F + 6, 20, 1, wood[2]);
  c.rect(L + 40, F + 4, 4, 2, bone[3]).rect(L + 30, F + 5, 3, 1, bone[2]);
  c.poly([[L + 25, F + 1], [L + 19, F + 3], [L + 19, F + 11], [L + 25, F + 9]], bone[2]);
  c.poly([[L + 24, F + 3], [L + 21, F + 4], [L + 21, F + 9], [L + 24, F + 8]], teal[1]).line(L + 21, F + 5, L + 24, F + 7, bone[3]);
  c.poly([[L + 22, G + 1], [L + 41, G + 1], [L + 43, G + 5], [L + 24, G + 6]], bone[2]);
  c.poly([[L + 25, G + 2], [L + 40, G + 2], [L + 41, G + 4], [L + 26, G + 5]], teal[1]).line(L + 28, G + 2, L + 33, G + 5, bone[3]);
  c.px(L + 3, G + 2, bone[3]).px(L + 7, G + 4, metal[3]).px(L + 10, G + 2, bone[2]).px(L + 15, G + 5, bone[3]).px(L + 19, G + 3, metal[3]);
  c.rect(L + 45, G + 2, 3, 2, denim[2]).px(L + 45, G + 2, bone[3]);
};

// ---------------------------------------------------------------------------------------------

export function buildCabinetVariants(base: PixelSprite): readonly ContainerArt[] {
  const looks: readonly (readonly [Draw, Draw])[] = [
    [topBlock, frontBlock],
    [topSink, frontSink],
    [topPrep, frontPrep],
    [topGlass, frontGlass],
  ];
  return looks.map(([top, front]) => ({ closed: closedOf(top, front), opened: openedOf(base, top, front) }));
}
