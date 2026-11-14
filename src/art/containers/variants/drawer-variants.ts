// Four more beds on the stock bed's footprint, each with a made look and a searched look, each
// laid out by hand: a tight hospital-cornered bed over one wide drawer, an unmade tangle with a
// pillow hanging off the foot, a bare ticking mattress on a metal frame with a duffel stowed under
// it, and a patchwork throw with a stuffed bear over a drawer and a cubby. Searched, every one is
// ransacked from its own contents: the drawers come out to different lengths, the mattress is shoved.

import { finish, startPiece } from '../../environment/furniture.ts';
import type { Piece } from '../../environment/furniture.ts';
import { RAMPS } from '../../palette.ts';
import type { PixelSprite } from '../../types.ts';
import { bakeStage, over, stage } from '../stage.ts';
import type { ContainerArt, Stage } from '../stage.ts';

const { ink, metal, wood, bone, denim, teal, violet, blood, olive, fire, ash, brick } = RAMPS;

const RISE = 6;

/** The bed's own sprite, drawn by one look's `draw`, then given room to be ransacked in. */
function shell(draw: (p: Piece) => void): PixelSprite {
  const p = startPiece('bed', RISE);
  draw(p);
  return finish(p);
}

function room(bed: PixelSprite): Stage {
  return stage('bed', bed, 5, 9);
}

// ---- A: made tight, one wide drawer ----

function madeClosed(): PixelSprite {
  return shell(({ c, left: L, right: R, top: T, front: F, ground: G }) => {
    c.rect(L - 1, T - 5, 26, 7, wood[1]).rect(L - 1, T - 5, 26, 1, wood[3]).rect(L - 1, T - 5, 1, 7, wood[2]);
    c.rect(L, T + 2, 24, 30, bone[2]).rect(L, T + 2, 1, 30, bone[3]).rect(R, T + 2, 1, 30, bone[1]);
    c.rect(L + 3, T + 3, 18, 7, bone[3]).rect(L + 3, T + 9, 18, 1, bone[1]).rect(L + 9, T + 5, 6, 1, bone[2]);
    c.rect(L, T + 11, 24, 3, bone[3]).rect(L, T + 14, 24, 1, bone[1]);
    c.rect(L, T + 15, 24, 17, teal[1]).rect(L, T + 15, 24, 1, teal[2]);
    c.rect(L, T + 16, 1, 16, teal[0]).rect(R, T + 16, 1, 16, teal[0]);
    c.poly([[L, F - 6], [L + 5, F - 1], [L, F - 1]], teal[0]).poly([[R, F - 6], [R - 5, F - 1], [R, F - 1]], teal[0]);
    c.rect(L + 11, T + 17, 2, 9, teal[2]).rect(L + 6, T + 27, 12, 1, teal[0]);
    c.rect(L, F, 24, 6, wood[1]).rect(L, F, 24, 1, wood[3]).rect(L, G - 1, 24, 1, wood[0]);
    c.rect(L + 3, F + 2, 18, 3, wood[2]).rect(L + 3, F + 2, 18, 1, wood[3]).rect(L + 10, F + 3, 4, 1, metal[3]);
  });
}

function madeOpened(): PixelSprite {
  const bed = shell(({ c, left: L, right: R, top: T, front: F, ground: G }) => {
    c.rect(L - 1, T - 5, 26, 7, wood[1]).rect(L - 1, T - 5, 26, 1, wood[3]).rect(L - 1, T - 5, 1, 7, wood[2]);
    c.rect(L, T + 2, 24, 30, bone[2]).rect(L, T + 2, 1, 30, bone[3]).rect(R, T + 2, 1, 30, bone[1]);
    // The pillow's dent, and the sheet pulled out of its tuck on the right.
    c.rect(L + 3, T + 3, 18, 7, bone[1]).rect(L + 3, T + 3, 18, 1, bone[2]).rect(L + 8, T + 6, 8, 1, bone[0]);
    c.line(R - 2, T + 12, R - 9, T + 20, bone[1]).line(R - 1, T + 18, R - 6, T + 28, bone[1]).rect(R - 7, T + 22, 1, 3, bone[3]);
    // The blanket dragged down to the foot and off the left side.
    c.poly([[L, T + 14], [L + 15, T + 20], [L + 13, F - 1], [L, F - 1]], teal[1]);
    c.line(L, T + 14, L + 15, T + 20, teal[2]).line(L + 5, T + 18, L + 4, F - 2, teal[0]).line(L + 10, T + 20, L + 9, F - 2, teal[0]);
    c.rect(L, F, 24, 6, wood[1]).rect(L, F, 24, 1, wood[3]).rect(L, G - 1, 24, 1, wood[0]);
    c.rect(L + 3, F + 2, 18, 3, ink[0]);
  });
  const s = room(bed);
  const { c, left: L, ground: G } = s;
  const F = G - RISE;
  over(c, (layer) => {
    // Out on its runners as far as it goes, the linen still folded in it.
    layer.rect(L + 3, F + 1, 18, 13, wood[2]).rect(L + 4, F + 1, 16, 9, ink[0]).rect(L + 3, F + 10, 18, 4, wood[3]);
    layer.rect(L + 9, F + 12, 6, 1, metal[3]);
    layer.rect(L + 5, F + 6, 7, 3, bone[2]).rect(L + 5, F + 6, 7, 1, bone[3]).rect(L + 6, F + 4, 6, 2, teal[1]);
    layer.rect(L + 13, F + 5, 5, 4, bone[1]).rect(L + 14, F + 4, 4, 1, bone[3]);
    // A sheet spilling over the lip, the pillow flung across the floor.
    layer.poly([[L + 14, F + 8], [L + 20, F + 11], [L + 19, F + 16], [L + 12, F + 14]], bone[3]);
    layer.rect(L + 19, G + 3, 11, 5, bone[3]).rect(L + 19, G + 7, 11, 1, bone[1]).rect(L + 22, G + 4, 4, 1, bone[2]);
    layer.rect(L - 3, G + 1, 5, 2, olive[2]).px(L - 3, G + 1, bone[3]);
  });
  return bakeStage(s);
}

// ---- B: unmade, pillow hanging off the foot ----

function tangleClosed(): PixelSprite {
  return shell(({ c, left: L, right: R, top: T, front: F, ground: G }) => {
    c.rect(L - 1, T - 5, 26, 7, wood[0]).rect(L - 1, T - 5, 26, 1, wood[2]).rect(L - 1, T - 5, 1, 7, wood[1]);
    for (const x of [L + 3, L + 8, L + 13, L + 18]) c.rect(x, T, 2, 2, ink[0]);
    c.rect(L, T + 2, 24, 30, bone[1]).rect(L, T + 2, 1, 30, bone[2]).rect(R, T + 2, 1, 30, ash[0]);
    c.line(L + 2, T + 5, L + 9, T + 8, bone[0]).line(L + 13, T + 4, R - 2, T + 9, bone[0]).line(L + 4, T + 10, L + 6, T + 14, bone[2]);
    c.rect(L + 3, T + 3, 6, 4, bone[3]);
    // The duvet in two humps, one kicked off the left edge.
    c.ellipse(L + 11, T + 17, 9, 4, fire[1]).ellipse(L + 13, T + 23, 8, 5, fire[1]);
    c.line(L + 4, T + 15, L + 14, T + 13, fire[2]).line(L + 8, T + 21, L + 17, T + 19, fire[2]);
    c.line(L + 10, T + 18, L + 12, T + 22, fire[0]).line(L + 15, T + 24, L + 19, T + 26, fire[0]).line(L + 5, T + 20, L + 7, T + 24, fire[0]);
    c.poly([[L - 1, T + 20], [L + 4, T + 21], [L + 5, T + 30], [L - 1, T + 31]], fire[1]);
    c.line(L - 1, T + 20, L + 4, T + 21, fire[2]).line(L + 1, T + 24, L + 2, T + 30, fire[0]);
    c.rect(L, F, 24, 6, wood[0]).rect(L, F, 24, 1, wood[2]).rect(L, G - 1, 24, 1, ink[1]);
    // One drawer left sitting out a notch, a narrower one beside it.
    c.rect(L + 2, F + 1, 11, 1, ink[0]).rect(L + 2, F + 2, 11, 4, wood[1]).rect(L + 2, F + 2, 11, 1, wood[2]).px(L + 7, F + 4, metal[3]);
    c.rect(L + 15, F + 2, 7, 3, wood[1]).rect(L + 15, F + 2, 7, 1, wood[2]).px(L + 18, F + 3, metal[3]);
    // The pillow hanging off the foot, over the rail.
    c.poly([[R - 12, F - 6], [R - 1, F - 8], [R + 1, F + 2], [R - 11, F + 3]], bone[3]);
    c.line(R - 12, F - 6, R - 1, F - 8, bone[3]).rect(R - 11, F + 1, 12, 2, bone[1]).line(R - 8, F - 4, R - 3, F - 5, bone[2]);
  });
}

function tangleOpened(): PixelSprite {
  const bed = shell(({ c, left: L, right: R, top: T, front: F, ground: G }) => {
    c.rect(L - 1, T - 5, 26, 7, wood[0]).rect(L - 1, T - 5, 26, 1, wood[2]).rect(L - 1, T - 5, 1, 7, wood[1]);
    for (const x of [L + 3, L + 8, L + 13, L + 18]) c.rect(x, T, 2, 2, ink[0]);
    // The mattress shoved askew off its base: a dark wedge down the right.
    c.rect(L, T + 2, 24, 30, ink[0]);
    c.poly([[L, T + 2], [R - 6, T + 2], [R - 1, F - 1], [L, F - 1]], bone[1]);
    c.line(R - 6, T + 2, R - 1, F - 1, bone[2]).rect(L, T + 2, 1, 30, bone[2]);
    c.rect(R - 5, T + 8, 5, 1, wood[0]).rect(R - 4, T + 16, 4, 1, wood[0]).rect(R - 3, T + 24, 3, 1, wood[0]);
    // The sheet scrunched to the head in a ball.
    c.ellipse(L + 8, T + 8, 6, 4, bone[2]).line(L + 4, T + 7, L + 11, T + 10, bone[0]).line(L + 7, T + 5, L + 12, T + 6, bone[3]);
    c.rect(L, F, 24, 6, wood[0]).rect(L, F, 24, 1, wood[2]).rect(L, G - 1, 24, 1, ink[1]);
    c.rect(L + 2, F + 1, 11, 5, ink[0]).rect(L + 15, F + 1, 7, 5, ink[0]);
  });
  const s = room(bed);
  const { c, left: L, ground: G } = s;
  const F = G - RISE;
  over(c, (layer) => {
    // The wide drawer barely out with its socks; the narrow one all the way, tipped.
    layer.rect(L + 2, F + 1, 11, 5, wood[2]).rect(L + 3, F + 1, 9, 2, ink[0]).rect(L + 2, F + 5, 11, 2, wood[3]);
    layer.rect(L + 4, F + 1, 3, 2, blood[2]).rect(L + 8, F + 1, 3, 2, denim[2]);
    layer.poly([[L + 15, F + 1], [L + 22, F + 2], [L + 23, F + 10], [L + 16, F + 11]], wood[2]);
    layer.poly([[L + 16, F + 2], [L + 22, F + 3], [L + 22, F + 7], [L + 17, F + 8]], ink[0]).line(L + 16, F + 10, L + 23, F + 9, wood[3]);
    layer.rect(L + 20, F + 10, 3, 2, blood[1]).rect(L + 24, F + 12, 3, 2, denim[1]).px(L + 24, F + 12, bone[3]);
    // The duvet in a heap on the floor beside the bed, the pillow dropped on it.
    layer.ellipse(L - 1, G + 4, 6, 4, fire[1]).line(L - 5, G + 3, L + 2, G + 1, fire[2]).line(L - 2, G + 4, L + 1, G + 7, fire[0]);
    layer.rect(L - 4, G + 1, 7, 3, bone[3]).rect(L - 4, G + 3, 7, 1, bone[1]);
    layer.rect(L + 11, G + 8, 4, 1, bone[2]);
  });
  return bakeStage(s);
}

// ---- C: bare ticking mattress on a metal frame, a duffel stowed under it ----

function bareClosed(): PixelSprite {
  return shell(({ c, left: L, right: R, top: T, front: F, ground: G }) => {
    c.rect(L - 1, T - 5, 26, 7, metal[1]).rect(L - 1, T - 5, 26, 1, metal[3]).rect(L - 1, T - 5, 1, 7, metal[2]);
    for (const x of [L + 2, L + 6, L + 10, L + 14, L + 18, L + 22]) c.rect(x, T - 4, 1, 6, metal[0]);
    c.rect(L, T + 2, 24, 30, bone[2]).rect(L, T + 2, 1, 30, bone[3]).rect(R, T + 2, 1, 30, bone[1]);
    c.rect(L + 3, T + 2, 1, 30, denim[1]).rect(L + 7, T + 2, 2, 30, denim[1]).rect(L + 15, T + 2, 1, 30, denim[1]).rect(L + 19, T + 2, 2, 30, denim[1]);
    c.rect(L + 1, T + 4, 22, 1, bone[1]).rect(L + 1, T + 29, 22, 1, bone[1]);
    c.ellipse(R - 6, T + 11, 3, 2.5, brick[1]).rect(R - 8, T + 11, 4, 1, brick[2]);
    c.px(L + 6, T + 9, ink[1]).px(L + 12, T + 9, ink[1]).px(L + 6, T + 19, ink[1]).px(L + 12, T + 19, ink[1]);
    // The blanket folded in a stack at the foot.
    c.rect(L + 2, F - 9, 20, 4, olive[1]).rect(L + 2, F - 9, 20, 1, olive[2]).rect(L + 2, F - 6, 20, 1, olive[0]);
    c.rect(L + 5, F - 13, 14, 4, fire[1]).rect(L + 5, F - 13, 14, 1, fire[2]).rect(L + 5, F - 10, 14, 1, fire[0]);
    // Bare frame: rail and legs, the dark under it holding a duffel and a box.
    c.rect(L, F, 24, 2, metal[1]).rect(L, F, 24, 1, metal[3]);
    c.rect(L + 2, F + 2, 20, 4, ink[0]).rect(L, F + 2, 2, 4, metal[1]).rect(R - 1, F + 2, 2, 4, metal[1]);
    c.rect(L + 4, F + 3, 9, 3, brick[1]).rect(L + 4, F + 3, 9, 1, brick[2]).rect(L + 8, F + 4, 1, 2, ash[2]);
    c.rect(L + 15, F + 2, 6, 4, bone[0]).rect(L + 15, F + 2, 6, 1, bone[1]);
    c.rect(L, G - 1, 24, 1, ink[1]);
  });
}

function bareOpened(): PixelSprite {
  const bed = shell(({ c, left: L, right: R, top: T, front: F, ground: G }) => {
    c.rect(L - 1, T - 5, 26, 7, metal[1]).rect(L - 1, T - 5, 26, 1, metal[3]).rect(L - 1, T - 5, 1, 7, metal[2]);
    for (const x of [L + 2, L + 6, L + 10, L + 14, L + 18, L + 22]) c.rect(x, T - 4, 1, 6, metal[0]);
    // The springs showing along the right, the mattress heaved over to the left and up the frame.
    c.rect(L, T + 2, 24, 30, metal[0]);
    for (const y of [T + 6, T + 12, T + 18, T + 24, T + 30]) c.rect(R - 8, y, 9, 1, metal[2]);
    c.poly([[L, T + 2], [R - 8, T + 5], [R - 10, F - 1], [L, F - 1]], bone[2]);
    c.rect(L, T + 2, 1, 30, bone[3]).line(R - 8, T + 5, R - 10, F - 1, bone[1]);
    c.rect(L + 3, T + 5, 1, 26, denim[1]).rect(L + 8, T + 4, 2, 26, denim[1]).rect(L + 15, T + 5, 1, 25, denim[1]);
    c.ellipse(L + 11, T + 14, 3, 2.5, brick[1]);
    c.rect(L, F, 24, 2, metal[1]).rect(L, F, 24, 1, metal[3]);
    c.rect(L + 2, F + 2, 20, 4, ink[0]).rect(L, F + 2, 2, 4, metal[1]).rect(R - 1, F + 2, 2, 4, metal[1]);
    c.rect(L, G - 1, 24, 1, ink[1]);
  });
  const s = room(bed);
  const { c, left: L, ground: G } = s;
  const F = G - RISE;
  over(c, (layer) => {
    // The blanket sliding off the foot, unfolded, one end trailing across the floor.
    layer.poly([[L + 11, F - 8], [L + 23, F - 5], [L + 25, G + 5], [L + 14, G + 3]], olive[1]);
    layer.line(L + 12, F - 8, L + 23, F - 5, olive[2]).line(L + 14, F - 2, L + 24, G + 3, olive[0]);
    layer.poly([[L + 20, G + 4], [L + 31, G + 2], [L + 33, G + 6], [L + 22, G + 8]], fire[1]);
    layer.line(L + 20, G + 4, L + 31, G + 2, fire[2]);
    // The duffel hauled out and gaped, its clothes strewn from it; the box lid kicked aside.
    layer.rect(L + 1, G + 2, 13, 6, brick[1]).rect(L + 1, G + 2, 13, 1, brick[2]).rect(L + 4, G + 3, 6, 2, ink[0]);
    layer.rect(L + 4, G + 1, 4, 2, denim[2]).rect(L + 8, G, 3, 2, blood[2]).line(L + 11, G + 6, L + 15, G + 8, bone[2]);
    layer.rect(L - 3, G - 4, 4, 7, brick[0]);
    layer.rect(L + 14, F + 2, 6, 4, bone[0]).rect(L + 14, F + 2, 6, 1, ink[0]);
  });
  return bakeStage(s);
}

// ---- D: patchwork throw, a stuffed bear, a drawer and a cubby ----

function bear(c: Piece['c'], x: number, y: number): void {
  c.ellipse(x, y + 5, 3, 3, wood[3]).rect(x - 3, y + 7, 2, 3, wood[2]).rect(x + 1, y + 7, 2, 3, wood[2]);
  c.ellipse(x, y, 3, 2.5, wood[3]).px(x - 3, y - 2, wood[2]).px(x + 2, y - 2, wood[2]).rect(x - 1, y + 1, 2, 1, bone[2]);
  c.px(x - 2, y - 1, ink[0]).px(x + 1, y - 1, ink[0]);
}

function toyClosed(): PixelSprite {
  return shell(({ c, left: L, right: R, top: T, front: F, ground: G }) => {
    c.rect(L - 1, T - 5, 26, 7, wood[2]).rect(L - 1, T - 5, 26, 1, wood[3]).rect(L - 1, T - 5, 1, 7, wood[3]);
    c.rect(L - 1, T - 5, 3, 7, wood[1]).rect(R - 1, T - 5, 3, 7, wood[1]).px(L, T - 5, wood[3]).px(R, T - 5, wood[3]);
    c.rect(L, T + 2, 24, 30, bone[3]).rect(L, T + 2, 1, 30, bone[3]).rect(R, T + 2, 1, 30, bone[2]);
    // The pillow thumped crooked against the left, the bear propped on the right.
    c.poly([[L + 2, T + 5], [L + 15, T + 3], [L + 16, T + 11], [L + 3, T + 12]], violet[2]);
    c.line(L + 2, T + 5, L + 15, T + 3, bone[3]).line(L + 3, T + 12, L + 16, T + 11, violet[1]).rect(L + 6, T + 7, 5, 1, violet[1]);
    bear(c, R - 5, T + 6);
    // The throw laid corner to corner across the foot, hand-pieced.
    c.poly([[L + 3, F - 1], [L + 8, T + 17], [R, T + 12], [R, F - 1]], denim[1]);
    c.rect(L + 9, T + 18, 5, 5, fire[1]).rect(L + 15, T + 15, 6, 4, blood[1]).rect(L + 6, T + 24, 6, 4, olive[2]);
    c.rect(L + 14, T + 21, 4, 4, violet[1]).rect(R - 5, T + 20, 5, 6, fire[2]).rect(L + 13, T + 27, 7, 3, teal[1]);
    c.line(L + 8, T + 17, R, T + 12, denim[2]).line(L + 3, F - 1, R, F - 1, denim[0]);
    for (const x of [L + 4, L + 6, L + 9, L + 12, L + 15, L + 17, L + 20]) c.px(x, F, denim[0]);
    // Footboard: a deep drawer on the left, an open cubby on the right holding two books.
    c.rect(L, F, 24, 6, wood[1]).rect(L, F, 24, 1, wood[3]).rect(L, G - 1, 24, 1, wood[0]);
    c.rect(L + 1, F + 2, 12, 4, wood[2]).rect(L + 1, F + 2, 12, 1, wood[3]).rect(L + 6, F + 3, 2, 2, metal[3]);
    c.rect(L + 15, F + 2, 8, 4, ink[0]).rect(L + 16, F + 4, 6, 2, blood[1]).rect(L + 17, F + 3, 5, 1, denim[1]).px(L + 16, F + 4, bone[3]);
  });
}

function toyOpened(): PixelSprite {
  const bed = shell(({ c, left: L, right: R, top: T, front: F, ground: G }) => {
    c.rect(L - 1, T - 5, 26, 7, wood[2]).rect(L - 1, T - 5, 26, 1, wood[3]).rect(L - 1, T - 5, 1, 7, wood[3]);
    c.rect(L - 1, T - 5, 3, 7, wood[1]).rect(R - 1, T - 5, 3, 7, wood[1]).px(L, T - 5, wood[3]).px(R, T - 5, wood[3]);
    c.rect(L, T + 2, 24, 30, bone[3]).rect(L, T + 2, 1, 30, bone[3]).rect(R, T + 2, 1, 30, bone[2]);
    // The pillow shoved to the corner and the throw heaved off to the right, leaving a bare run of sheet.
    c.poly([[R - 12, T + 3], [R - 1, T + 5], [R - 2, T + 12], [R - 13, T + 10]], violet[2]);
    c.line(R - 12, T + 3, R - 1, T + 5, bone[3]).line(R - 13, T + 10, R - 2, T + 12, violet[1]);
    c.poly([[R - 7, T + 16], [R, T + 14], [R, F - 1], [R - 4, F - 1]], denim[1]);
    c.line(L + 3, T + 14, L + 7, T + 22, bone[1]).line(L + 9, T + 16, L + 12, T + 26, bone[2]).rect(L + 4, T + 24, 6, 1, bone[1]);
    c.rect(L, F, 24, 6, wood[1]).rect(L, F, 24, 1, wood[3]).rect(L, G - 1, 24, 1, wood[0]);
    c.rect(L + 1, F + 2, 12, 4, ink[0]).rect(L + 15, F + 2, 8, 4, ink[0]);
  });
  const s = room(bed);
  const { c, left: L, ground: G } = s;
  const F = G - RISE;
  over(c, (layer) => {
    // The deep drawer a short way out, spilling toy blocks.
    layer.rect(L + 1, F + 2, 12, 6, wood[2]).rect(L + 2, F + 2, 10, 2, ink[0]).rect(L + 1, F + 7, 12, 1, wood[3]);
    layer.rect(L + 3, F + 2, 3, 2, fire[2]).rect(L + 8, F + 2, 3, 2, teal[2]).rect(L + 6, F + 8, 3, 3, denim[2]);
    layer.rect(L + 10, F + 10, 3, 3, blood[2]).rect(L + 2, F + 11, 3, 3, olive[2]);
    // The books pulled from the cubby, one splayed face down, one left leaning on the leg.
    layer.rect(L + 16, G + 3, 7, 3, blood[1]).rect(L + 16, G + 3, 7, 1, blood[2]).rect(L + 17, G + 5, 5, 1, bone[2]);
    layer.rect(L + 24, G - 4, 3, 8, denim[1]).rect(L + 24, G - 4, 3, 1, denim[2]);
    // The bear flung face down at the left, and the throw's trailing corner on the floor.
    layer.ellipse(L - 2, G + 5, 3, 3, wood[3]).rect(L, G + 4, 4, 3, wood[2]).px(L - 4, G + 3, wood[2]).px(L - 1, G + 2, wood[2]);
    layer.poly([[L + 14, G + 7], [L + 24, G + 5], [L + 27, G + 9], [L + 16, G + 11]], denim[1]);
    layer.rect(L + 18, G + 7, 3, 2, fire[1]);
  });
  return bakeStage(s);
}

export function buildDrawerVariants(_base: PixelSprite): readonly ContainerArt[] {
  return [
    { closed: madeClosed(), opened: madeOpened() },
    { closed: tangleClosed(), opened: tangleOpened() },
    { closed: bareClosed(), opened: bareOpened() },
    { closed: toyClosed(), opened: toyOpened() },
  ];
}
