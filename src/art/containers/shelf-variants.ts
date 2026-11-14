// Three more shelves on the stock shelf's footprint. Each is composed by hand: a pantry run of jars
// and folded cloth, a near-empty wire rack with a few big cartons, a garage rack crowded with cans,
// a toolbox and a coil of rope. Their boards sit at different heights and what stands, leans, stacks
// or is missing differs, so a town of shelving does not read as one sprite stamped down again.

import { finish, startPiece } from '../environment/furniture.ts';
import type { Piece } from '../environment/furniture.ts';
import { RAMPS } from '../palette.ts';
import type { PixelCanvas } from '../kit.ts';
import type { Color } from '../palette.ts';
import type { PixelSprite } from '../types.ts';
import { bakeStage, glints, over, paper, stage, tipped, upright } from './stage.ts';
import type { ContainerArt } from './stage.ts';

const { ink, metal, wood, bone, denim, teal, blood, olive, fire, brick } = RAMPS;

/** A bottle: a narrow neck over a wider body. */
function bottle(c: PixelCanvas, x: number, base: number, h: number, body: Color, cap: Color): void {
  c.rect(x, base - (h - 3), 3, h - 3, body).rect(x + 1, base - h, 1, 3, body).px(x + 1, base - h, cap).px(x, base - (h - 3), bone[3]);
}

/** A squat jar with a lid. */
function jar(c: PixelCanvas, x: number, base: number, w: number, h: number, body: Color, lid: Color): void {
  c.rect(x, base - h, w, h, body).rect(x, base - h, w, 1, lid).px(x, base - h + 1, bone[3]);
}

/** A carton with a strip of tape down the lid. */
function carton(c: PixelCanvas, x: number, base: number, w: number, h: number, body: Color, edge: Color, tape: Color): void {
  c.rect(x, base - h, w, h, body).rect(x, base - h, w, 1, edge).rect(x + Math.floor(w / 2) - 1, base - h, 2, h, tape);
}

/** A paint tin: lid ring on top and a coloured band round the middle. */
function can(c: PixelCanvas, x: number, base: number, w: number, h: number, body: Color, band: Color): void {
  c.rect(x, base - h, w, h, body).rect(x, base - h, w, 1, metal[3]);
  if (h > 2) c.rect(x, base - Math.ceil(h / 2), w, 1, band);
}

/** A coil of rope or hose seen from the front: a round of loops with the middle left open. */
function coil(c: PixelCanvas, x: number, y: number, w: number, h: number, color: Color): void {
  c.rect(x + 1, y, w - 2, h, color).rect(x, y + 1, w, h - 2, color);
  c.rect(x + 2, y + 1, w - 4, h - 2, ink[1]).px(x + 1, y + 1, bone[3]);
  c.px(x + 2, y + h - 1, wood[1]).px(x + w - 3, y, wood[1]);
}

// ---------------------------------------------------------------------------------------------
// Pantry shelf: painted timber, two long shelves, a drawer-height plinth, tall glass above.

function pantryFrame(): Piece {
  const p = startPiece('shelf', 16);
  const { c, left: L, right: R, front: F, top: T, w } = p;
  c.rect(L, T, w, 10, wood[1]).rect(L, T, w, 1, wood[3]).rect(L, T, 1, 10, wood[2]).rect(R, T, 1, 10, wood[0]);
  c.rect(L + 1, T + 4, w - 2, 1, wood[0]).rect(L + 1, T + 7, w - 2, 1, wood[0]);
  c.px(L + 9, T + 5, wood[1]).px(L + 20, T + 8, wood[1]).px(L + 14, T + 2, wood[2]);
  c.rect(L, F, w, 16, wood[0]);
  c.rect(L, F, w, 1, wood[3]).rect(L + 1, F + 1, w - 2, 1, wood[2]);
  c.rect(L, F + 1, 2, 15, wood[2]).rect(R - 1, F + 1, 2, 15, wood[1]).rect(L, F + 1, 1, 15, wood[3]);
  c.px(L + 1, F + 5, wood[1]).px(L + 1, F + 11, wood[1]);
  return p;
}

function pantryBoard({ c, left: L, w }: Piece, y: number): void {
  c.rect(L + 2, y, w - 4, 1, wood[3]).rect(L + 2, y + 1, w - 4, 1, ink[1]);
  c.px(L + 3, y + 2, wood[1]).px(L + w - 4, y + 2, wood[1]);
}

function pantryClosed(): PixelSprite {
  const p = pantryFrame();
  const { c, left: L, front: F, top: T } = p;
  const upper = F + 8;
  const lower = F + 14;
  pantryBoard(p, upper);
  pantryBoard(p, lower);
  // Upper: tall glass with a gap or two, a fat jar and a short one.
  bottle(c, L + 3, upper, 6, teal[2], bone[3]);
  bottle(c, L + 8, upper, 5, olive[2], wood[3]);
  jar(c, L + 12, upper, 5, 6, fire[1], bone[2]);
  jar(c, L + 19, upper, 4, 4, blood[2], bone[1]);
  bottle(c, L + 24, upper, 6, denim[2], bone[3]);
  bottle(c, L + 27, upper, 5, teal[1], bone[2]);
  // Lower: folded cloth stacked in four unequal layers, a crock, two stray tins.
  const cloth: readonly [number, number, Color][] = [[3, 11, denim[2]], [4, 10, bone[2]], [3, 10, blood[2]], [5, 8, teal[1]]];
  cloth.forEach(([x, w, color], i) => c.rect(L + x, lower - 1 - i, w, 1, color));
  c.px(L + 5, lower - 4, bone[3]);
  c.rect(L + 17, lower - 4, 7, 4, bone[1]).rect(L + 17, lower - 4, 7, 1, wood[2]).px(L + 18, lower - 3, bone[3]);
  upright(c, L + 26, lower, olive[2], 3);
  upright(c, L + 28, lower, fire[1], 2);
  // On top: a wicker basket with a loaf, and a jar pushed to the left end.
  c.rect(L + 17, T + 1, 10, 6, wood[3]).rect(L + 17, T + 1, 10, 1, wood[2]);
  for (let x = L + 18; x < L + 26; x += 2) c.px(x, T + 3, wood[2]).px(x + 1, T + 5, wood[2]);
  c.rect(L + 19, T - 1, 6, 2, fire[1]).px(L + 19, T - 1, fire[2]);
  jar(c, L + 4, T + 7, 5, 6, olive[2], bone[2]);
  return finish(p);
}

function pantryOpened(): PixelSprite {
  const p = pantryFrame();
  const { c, left: L, right: R, front: F, top: T } = p;
  const lower = F + 14;
  // The upper board has dropped off its pin on the left, so everything left on it has slid that way.
  c.line(L + 2, F + 11, R - 2, F + 8, wood[3]).line(L + 2, F + 12, R - 2, F + 9, ink[1]);
  pantryBoard(p, lower);
  tipped(c, L + 3, F + 10, teal[2]);
  bottle(c, L + 8, F + 10, 5, olive[2], wood[3]);
  c.line(R - 3, F + 7, R - 6, F + 3, denim[2]).px(R - 6, F + 3, bone[3]);
  // Cloth hauled half off its shelf: two layers left, one dragged to the right.
  c.rect(L + 3, lower - 1, 11, 1, denim[2]).rect(L + 4, lower - 2, 10, 1, bone[2]);
  c.rect(L + 12, lower - 3, 6, 1, blood[2]).rect(L + 17, lower - 2, 4, 2, blood[1]);
  // The crock is smashed to a half ring, one tin left standing.
  c.rect(L + 22, lower - 2, 5, 2, bone[1]).px(L + 23, lower - 3, bone[1]).px(L + 26, lower - 3, bone[1]);
  upright(c, L + 28, lower, fire[1], 2);
  // The basket is gone from the top; a lone jar lies on its side and the loaf is crumbs.
  c.rect(L + 19, T + 5, 2, 1, fire[1]).px(L + 23, T + 6, fire[2]);
  c.rect(L + 4, T + 4, 6, 4, olive[2]).rect(L + 4, T + 4, 1, 4, bone[2]).px(L + 5, T + 5, bone[3]);
  const s = stage('shelf', finish(p), 4, 6);
  over(s.c, (layer) => {
    const y = s.ground;
    // The basket upside down, a bottle rolled away from it, the stack's third cloth dangling.
    layer.rect(s.left + 14, y + 1, 9, 4, wood[3]).rect(s.left + 14, y + 1, 9, 1, wood[2]);
    layer.px(s.left + 16, y + 3, wood[2]).px(s.left + 19, y + 3, wood[2]);
    tipped(layer, s.left + 3, y + 3, bone[2]);
    layer.rect(s.left + 24, y - 3, 3, 5, blood[2]).rect(s.left + 24, y + 2, 4, 1, blood[1]);
    layer.px(s.left + 1, y, teal[2]).px(s.left + 6, y + 4, olive[2]);
  });
  glints(s.c, [[s.left + 9, s.ground + 1], [s.left + 11, s.ground + 3], [s.left + 8, s.ground + 4], [s.left + 29, s.ground + 4]]);
  return bakeStage(s);
}

export function buildWoodShelfArt(): ContainerArt {
  return { closed: pantryClosed(), opened: pantryOpened() };
}

// ---------------------------------------------------------------------------------------------
// Wire rack: bare chrome posts and mesh, two boards, and almost nothing on it but big cartons.

function wireFrame(): Piece {
  const p = startPiece('shelf', 16);
  const { c, left: L, right: R, front: F, top: T, w } = p;
  c.rect(L, T, w, 10, metal[1]).rect(L, T, w, 1, metal[3]).rect(R, T, 1, 10, metal[0]);
  for (let y = T + 2; y < T + 10; y++) for (let x = L + 1 + (y % 2); x < R; x += 2) c.px(x, y, metal[0]);
  c.rect(L, F, w, 16, ink[0]);
  c.rect(L, F, 1, 16, metal[3]).rect(L + 1, F, 1, 16, metal[1]).rect(R - 1, F, 1, 16, metal[2]).rect(R, F, 1, 16, metal[0]);
  c.rect(L, F + 15, 3, 1, metal[2]).rect(R - 2, F + 15, 3, 1, metal[2]);
  for (let y = F + 2; y < F + 15; y += 4) c.rect(L + 2, y, w - 4, 1, ink[1]);
  return p;
}

function wireBoard({ c, left: L, w }: Piece, y: number): void {
  c.rect(L + 2, y, w - 4, 1, metal[3]);
  for (let x = L + 3; x < L + w - 3; x += 3) c.px(x, y + 1, metal[2]);
}

function wireClosed(): PixelSprite {
  const p = wireFrame();
  const { c, left: L, front: F, top: T } = p;
  wireBoard(p, F + 6);
  wireBoard(p, F + 12);
  // Top bay: one flat carton propped on a small tin, the other half of the board bare.
  carton(c, L + 15, F + 6, 13, 5, bone[2], bone[3], wood[3]);
  c.rect(L + 4, F + 4, 3, 2, olive[2]).px(L + 4, F + 4, bone[3]);
  // Middle bay: a big square box on the left, a gap, one flat lid-down carton and a thin one over it.
  carton(c, L + 3, F + 12, 9, 6, wood[2], wood[3], bone[1]);
  carton(c, L + 19, F + 12, 8, 3, wood[3], bone[3], wood[1]);
  carton(c, L + 20, F + 9, 6, 2, bone[1], bone[2], wood[2]);
  // Bottom: one long flat carton on the floor of the rack, a hand's width from the post.
  carton(c, L + 9, F + 15, 14, 3, bone[2], bone[3], olive[1]);
  // On top: a single huge carton, set slightly back and turned toward the left.
  c.rect(L + 8, T, 17, 7, wood[2]).rect(L + 8, T, 17, 1, wood[3]).rect(L + 8, T + 6, 17, 1, wood[1]);
  c.rect(L + 15, T + 1, 3, 6, bone[1]).rect(L + 10, T + 3, 3, 2, bone[2]).px(L + 11, T + 3, bone[3]);
  return finish(p);
}

function wireOpened(): PixelSprite {
  const p = wireFrame();
  const { c, left: L, right: R, front: F, top: T } = p;
  // The lower board has sagged off its clip on the right, and the upper one is empty bar a tin.
  wireBoard(p, F + 6);
  c.line(L + 2, F + 11, R - 2, F + 14, metal[3]).line(L + 3, F + 12, R - 3, F + 15, metal[2]);
  c.rect(L + 4, F + 4, 3, 2, olive[2]).px(L + 4, F + 4, bone[3]);
  // The big box has been pulled forward and gutted: lid flaps open and it sits crooked.
  c.poly([[L + 3, F + 11], [L + 12, F + 10], [L + 13, F + 5], [L + 4, F + 6]], wood[2]);
  c.line(L + 3, F + 11, L + 12, F + 10, wood[3]).line(L + 13, F + 5, L + 4, F + 6, wood[1]);
  c.rect(L + 6, F + 7, 4, 3, ink[0]);
  // The flat carton that was top-right is slumped across the upper board and hangs over the edge.
  c.poly([[L + 17, F + 6], [L + 28, F + 6], [L + 29, F + 2], [L + 19, F + 2]], bone[2]);
  c.line(L + 19, F + 2, L + 29, F + 2, bone[3]);
  c.rect(L + 20, F + 3, 7, 2, ink[1]);
  // Nothing at all on the top face now but a scrap of its flattened lid.
  c.poly([[L + 20, T + 5], [L + 29, T + 3], [L + 30, T + 6], [L + 21, T + 8]], wood[1]).px(L + 22, T + 5, bone[2]);
  const s = stage('shelf', finish(p), 4, 6);
  over(s.c, (layer) => {
    const y = s.ground;
    // The tall carton, tipped on its face over the floor, and the long flat one slid half out.
    layer.rect(s.left + 2, y, 14, 4, wood[2]).rect(s.left + 2, y, 14, 1, wood[3]).rect(s.left + 8, y, 2, 4, bone[1]);
    layer.rect(s.left + 18, y + 3, 13, 3, bone[2]).rect(s.left + 18, y + 3, 13, 1, bone[3]);
    paper(layer, s.left + 22, y + 1);
  });
  return bakeStage(s);
}

export function buildWireShelfArt(): ContainerArt {
  return { closed: wireClosed(), opened: wireOpened() };
}

// ---------------------------------------------------------------------------------------------
// Garage rack: painted uprights with punched holes, thick boards, and too much on all of them.

function rackFrame(): Piece {
  const p = startPiece('shelf', 16);
  const { c, left: L, right: R, front: F, top: T, w } = p;
  c.rect(L, T, w, 10, metal[2]).rect(L, T, w, 2, metal[3]).rect(L, T + 8, w, 2, metal[1]);
  c.rect(L + 3, T + 2, w - 6, 6, metal[0]).rect(L + 3, T + 2, w - 6, 1, ink[1]);
  c.rect(L, F, w, 16, ink[1]);
  c.rect(L, F, 3, 16, brick[2]).rect(L, F, 1, 16, fire[0]).rect(R - 2, F, 3, 16, brick[1]);
  for (let y = F + 2; y < F + 16; y += 3) c.px(L + 1, y, ink[0]).px(R - 1, y, ink[0]);
  c.rect(L + 3, F, w - 6, 1, metal[1]);
  return p;
}

function rackBoard({ c, left: L, w }: Piece, y: number): void {
  c.rect(L + 3, y, w - 6, 1, metal[3]).rect(L + 3, y + 1, w - 6, 1, metal[1]);
}

function rackClosed(): PixelSprite {
  const p = rackFrame();
  const { c, left: L, front: F, top: T } = p;
  const a = F + 5;
  const b = F + 11;
  const c3 = F + 15;
  rackBoard(p, a);
  rackBoard(p, b);
  c.rect(L + 3, c3, p.w - 6, 1, metal[2]);
  // Top shelf: a pair of cans stacked, one fat tin alone, a little can and a brush against the post.
  can(c, L + 5, a, 5, 2, blood[2], bone[2]);
  can(c, L + 5, a - 2, 5, 2, denim[2], bone[3]);
  can(c, L + 11, a, 6, 4, olive[2], fire[1]);
  can(c, L + 19, a, 3, 3, teal[2], bone[3]);
  c.line(L + 25, a - 1, L + 27, a - 4, wood[3]).px(L + 27, a - 4, bone[3]);
  // Middle: a toolbox with a handle, a coiled rope and one wrench laid across the board.
  c.rect(L + 4, b - 4, 12, 4, blood[1]).rect(L + 4, b - 4, 12, 1, blood[3]).rect(L + 9, b - 3, 2, 1, metal[3]);
  c.rect(L + 7, b - 6, 6, 1, metal[2]).px(L + 7, b - 5, metal[2]).px(L + 12, b - 5, metal[2]);
  coil(c, L + 18, b - 6, 9, 6, wood[3]);
  c.rect(L + 26, b - 1, 4, 1, metal[3]);
  // Bottom: a rope-tied bundle on its side, a pair of tins and a scatter of nails in a jar.
  carton(c, L + 12, c3, 12, 3, wood[2], wood[3], bone[1]);
  upright(c, L + 5, c3, fire[1], 3);
  upright(c, L + 8, c3, olive[2], 2);
  jar(c, L + 26, c3, 3, 3, bone[2], metal[3]);
  // Top: one box, a coil of hose on it, shoved to the right.
  carton(c, L + 14, T + 7, 12, 6, wood[2], wood[3], bone[1]);
  coil(c, L + 5, T + 3, 8, 5, olive[2]);
  return finish(p);
}

function rackOpened(): PixelSprite {
  const p = rackFrame();
  const { c, left: L, right: R, front: F, top: T } = p;
  const a = F + 5;
  const c3 = F + 15;
  rackBoard(p, a);
  // The middle board has been yanked: it hangs from the right upright, left end down by the floor board.
  c.line(R - 3, F + 11, L + 3, F + 14, metal[3]).line(R - 3, F + 12, L + 3, F + 15, metal[1]);
  c.rect(L + 3, c3, p.w - 6, 1, metal[2]);
  // The paint is mostly gone; one can still wedged at the right.
  can(c, R - 8, a, 5, 4, olive[2], fire[1]);
  c.rect(L + 6, a - 1, 2, 1, blood[2]);
  // Toolbox open on the low end of the board, lid up, nothing in it.
  c.rect(L + 5, F + 12, 11, 3, blood[1]).rect(L + 5, F + 12, 11, 1, ink[0]).rect(L + 5, F + 9, 11, 2, blood[2]);
  c.line(L + 5, F + 11, L + 5, F + 9, blood[3]);
  // The rope is gone from the board: a loose tail hangs over the edge.
  c.line(R - 6, F + 12, R - 5, F + 14, wood[3]).px(R - 5, F + 15, wood[3]);
  // On top: only the hose, still coiled, and the box pushed to the very edge, lid gone.
  coil(c, L + 5, T + 3, 8, 5, olive[2]);
  c.rect(L + 20, T + 4, 9, 5, wood[2]).rect(L + 20, T + 4, 9, 1, ink[0]).rect(L + 20, T + 8, 9, 1, wood[1]);
  const s = stage('shelf', finish(p), 4, 6);
  over(s.c, (layer) => {
    const y = s.ground;
    // A paint can on its side with the puddle it left, a wrench, and the rope in a heap.
    layer.rect(s.left + 6, y + 1, 5, 4, blood[2]).rect(s.left + 6, y + 1, 1, 4, metal[3]);
    layer.rect(s.left + 11, y + 2, 7, 3, blood[3]).rect(s.left + 12, y + 3, 4, 1, blood[2]);
    layer.rect(s.left + 21, y + 1, 7, 1, metal[3]).rect(s.left + 27, y, 2, 3, metal[3]);
    coil(layer, s.left + 26, y + 2, 7, 4, wood[3]);
    can(layer, s.left + 1, y + 4, 4, 3, teal[2], bone[2]);
  });
  return bakeStage(s);
}

export function buildRackShelfArt(): ContainerArt {
  return { closed: rackClosed(), opened: rackOpened() };
}

