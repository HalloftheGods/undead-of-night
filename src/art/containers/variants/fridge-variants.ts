// Four kitchen fridges, each drawn by hand on the stock fridge's footprint. No two share a door split, a
// handle, a fridge-door clutter layout or an inside: a mint single door, a stainless bottom freezer, a
// white side-by-side and an avocado one with a small freezer flap. Searched, each hangs open its own way.

import { finish, startPiece } from '../../environment/furniture.ts';
import type { Piece } from '../../environment/furniture.ts';
import type { PixelCanvas } from '../../kit.ts';
import { RAMPS } from '../../palette.ts';
import type { Color } from '../../palette.ts';
import type { PixelSprite } from '../../types.ts';
import { bakeStage, over, stage, tipped, upright } from '../stage.ts';
import type { ContainerArt } from '../stage.ts';

const { ink, metal, wood, bone, denim, teal, blood, olive, fire, acid, brick } = RAMPS;

const RISE = 22;

/** The bare cabinet: a lid, a face, a lit left edge and the dark line it stands on. Everything else is the look's own. */
function cabinet(face: Color, lit: Color, lid: Color, lidEdge: Color, shade: Color): Piece {
  const p = startPiece('fridge', RISE);
  const { c, left, right, ground, front, top, w } = p;
  c.rect(left, top, w, 8, lid).rect(left, top, w, 1, lidEdge).rect(left, top, 1, 8, lidEdge);
  c.rect(left, front, w, RISE, face).rect(left, front, w, 1, lit).rect(left, front, 1, RISE, lit);
  c.rect(right, front, 1, RISE, shade);
  c.rect(left, ground - 1, w, 1, ink[1]);
  return p;
}

/** A round-shouldered glass jar with a lid, for the fridge-door racks and shelves. */
function jar(c: PixelCanvas, x: number, y: number, h: number, body: Color, lid: Color): void {
  c.rect(x, y - h, 2, h, body).px(x, y - h, bone[3]).rect(x, y - h - 1, 2, 1, lid);
}

// ---------------------------------------------------------------------------------------------
// 1. Mint single door: one tall door, handle on the right, kid's drawing, books and a plant on top.
// ---------------------------------------------------------------------------------------------

function mintClosed(): PixelSprite {
  const p = cabinet(teal[2], bone[3], bone[2], bone[3], teal[1]);
  const { c, left, ground, front } = p;
  c.rect(left + 6, front + 2, 4, 1, metal[3]);
  c.rect(left + 12, front + 4, 1, 9, metal[3]).rect(left + 13, front + 4, 1, 9, metal[1]);
  c.px(left + 1, front + 3, metal[2]).px(left + 1, front + 18, metal[2]);
  // A crayon sun and a stick person on a pinned page, a magnet on each corner.
  c.rect(left + 3, front + 7, 6, 5, bone[3]);
  c.px(left + 4, front + 8, fire[2]).line(left + 5, front + 11, left + 8, front + 9, blood[2]);
  c.rect(left + 7, front + 8, 1, 3, denim[2]).px(left + 3, front + 7, blood[2]).px(left + 8, front + 11, denim[2]);
  // A yellow note with a smear of writing, stuck low.
  c.rect(left + 3, front + 14, 3, 3, fire[3]).px(left + 4, front + 15, ink[1]).px(left + 5, front + 16, ink[1]);
  c.rect(left + 1, front + 19, 14, 1, teal[1]);
  c.rect(left + 2, ground - 3, 12, 2, ink[1]);
  // Cookbooks fallen against each other, and a pot plant that has outgrown its corner.
  c.rect(left + 1, 3, 8, 2, blood[2]).rect(left + 1, 3, 8, 1, bone[3]);
  c.rect(left + 2, 5, 7, 2, denim[2]).rect(left + 2, 5, 7, 1, bone[2]);
  c.rect(left + 1, 7, 5, 1, olive[2]);
  c.rect(left + 11, 5, 3, 3, wood[2]).rect(left + 11, 5, 3, 1, wood[3]);
  c.line(left + 12, 4, left + 10, 1, acid[1]).line(left + 12, 4, left + 13, 0, acid[1]).line(left + 12, 4, left + 14, 2, olive[2]);
  c.px(left + 10, 7, acid[1]).px(left + 9, 8, olive[2]);
  return finish(p);
}

function mintOpened(): PixelSprite {
  const p = cabinet(teal[2], bone[3], bone[2], bone[3], teal[1]);
  const { c, left, right, ground, front } = p;
  c.rect(left + 1, front + 1, 14, RISE - 2, bone[3]);
  c.rect(left + 9, front + 1, 5, 1, fire[3]);
  c.rect(right - 1, front + 1, 1, RISE - 2, bone[1]);
  // Top shelf: a milk carton fallen against a jar, a bottle standing alone at the back.
  c.rect(left + 2, front + 6, 12, 1, teal[2]);
  c.poly([[left + 3, front + 5], [left + 5, front + 2], [left + 7, front + 3], [left + 6, front + 6]], denim[2]);
  c.px(left + 5, front + 2, bone[3]);
  jar(c, left + 9, front + 6, 3, blood[1], bone[2]);
  c.rect(left + 12, front + 2, 1, 4, olive[2]);
  // Middle: an egg box with half the eggs gone, and a bowl still under its film.
  c.rect(left + 2, front + 12, 12, 1, teal[2]);
  c.rect(left + 2, front + 10, 6, 2, bone[1]).px(left + 3, front + 9, bone[3]).px(left + 6, front + 9, bone[3]);
  c.rect(left + 10, front + 10, 4, 2, metal[2]).rect(left + 10, front + 10, 4, 1, bone[3]);
  // Crisper: one drawer, something green and long past it.
  c.rect(left + 2, front + 15, 12, 4, denim[1]).rect(left + 2, front + 15, 12, 1, denim[2]);
  c.rect(left + 4, front + 16, 3, 2, acid[0]).px(left + 5, front + 16, acid[1]);
  c.rect(left + 2, ground - 2, 12, 1, ink[1]);
  const s = stage('fridge', finish(p), 7, 5);
  over(s.c, (layer) => {
    // The door has swung out to the left, its racks still full of sauce bottles.
    const hinge = s.left - 1;
    const y = s.ground - RISE;
    layer.poly([[hinge, y], [hinge - 4, y + 2], [hinge - 4, y + RISE + 2], [hinge, y + RISE - 1]], teal[2]);
    layer.line(hinge, y, hinge - 4, y + 2, bone[3]);
    layer.rect(hinge - 3, y + 7, 3, 1, teal[1]).rect(hinge - 3, y + 13, 3, 1, teal[1]).rect(hinge - 3, y + 18, 3, 1, teal[1]);
    layer.px(hinge - 2, y + 5, blood[2]).px(hinge - 2, y + 6, blood[2]).px(hinge - 1, y + 11, fire[2]).px(hinge - 1, y + 12, fire[2]);
    // Everything that came off the shelves went to the right: a split jar, a rolling bottle, a lettuce.
    layer.rect(s.left + 12, s.ground + 2, 3, 2, blood[2]).px(s.left + 14, s.ground + 1, blood[1]).px(s.left + 11, s.ground + 3, blood[1]);
    tipped(layer, s.left + 4, s.ground + 3, olive[2]);
    layer.ellipse(s.left + 9.5, s.ground + 2.5, 2.5, 1.5, acid[1]).px(s.left + 9, s.ground + 2, acid[2]);
    layer.rect(s.right + 2, s.ground + 1, 2, 2, bone[1]);
  });
  return bakeStage(s);
}

// ---------------------------------------------------------------------------------------------
// 2. Stainless bottom freezer: tall door above a pull-out drawer, panel and calendar, bins on top.
// ---------------------------------------------------------------------------------------------

function steelClosed(): PixelSprite {
  const p = cabinet(metal[2], metal[3], metal[1], metal[3], metal[1]);
  const { c, left, ground, front } = p;
  c.rect(left, front + 14, p.w, 1, metal[0]);
  c.rect(left + 3, front + 16, 10, 1, metal[3]).rect(left + 3, front + 17, 10, 1, metal[0]);
  c.rect(left + 12, front + 3, 1, 8, metal[3]).rect(left + 13, front + 3, 1, 8, metal[0]);
  // A small readout in the corner of the door.
  c.rect(left + 2, front + 2, 4, 3, ink[1]).px(left + 3, front + 3, teal[2]).px(left + 5, front + 3, fire[2]);
  // Magnet letters strung across at different heights, and a wall calendar with its red banner.
  c.px(left + 3, front + 7, blood[2]).px(left + 5, front + 6, fire[2]).px(left + 6, front + 8, denim[2]).px(left + 8, front + 7, olive[2]);
  c.rect(left + 3, front + 10, 5, 4, bone[3]).rect(left + 3, front + 10, 5, 1, blood[2]).px(left + 5, front + 12, ink[1]);
  c.rect(left + 4, front + 19, 8, 1, ink[1]);
  c.rect(left + 2, ground - 2, 12, 1, ink[1]);
  // A cardboard box shoved to the back, a folded blanket in front of it.
  c.rect(left + 9, 1, 6, 6, wood[2]).rect(left + 9, 1, 6, 1, wood[3]).rect(left + 11, 1, 2, 6, bone[1]);
  c.rect(left + 1, 4, 7, 3, denim[1]).rect(left + 1, 4, 7, 1, denim[2]).rect(left + 1, 7, 8, 1, denim[0]);
  return finish(p);
}

function steelOpened(): PixelSprite {
  const p = cabinet(metal[2], metal[3], metal[1], metal[3], metal[1]);
  const { c, left, ground, front } = p;
  c.rect(left + 1, front + 1, 14, 12, bone[3]).rect(left + 1, front + 1, 14, 1, fire[3]);
  c.rect(left + 1, front + 1, 1, 12, bone[1]);
  // Three glass shelves, spaced by whoever last packed it: tall at the top, cramped under it.
  c.rect(left + 2, front + 5, 12, 1, teal[2]).rect(left + 2, front + 9, 12, 1, teal[2]);
  c.rect(left + 3, front + 1, 2, 4, olive[2]).rect(left + 3, front + 1, 2, 1, bone[3]);
  c.rect(left + 6, front + 3, 2, 2, bone[2]);
  c.rect(left + 11, front + 2, 3, 3, fire[1]).px(left + 11, front + 2, bone[3]);
  // Takeaway boxes stacked and sliding over the middle board; one jar behind them.
  c.rect(left + 3, front + 7, 5, 2, wood[3]).rect(left + 4, front + 5, 4, 2, bone[2]).rect(left + 5, front + 3, 3, 2, bone[3]);
  jar(c, left + 12, front + 9, 3, blood[1], bone[2]);
  // Below, the freezer drawer is out: its dark cavity left empty, the runners showing.
  c.rect(left + 1, front + 13, 14, 7, ink[0]);
  c.rect(left + 1, front + 13, 14, 1, metal[1]).line(left + 2, front + 15, left + 13, front + 15, metal[0]);
  c.rect(left + 2, ground - 2, 12, 1, ink[1]);
  const s = stage('fridge', finish(p), 7, 5);
  over(s.c, (layer) => {
    // The upper door is wide open to the right, edge-on: a tall slab with its racks facing us.
    const hinge = s.right + 1;
    const y = s.ground - RISE;
    layer.poly([[hinge, y + 1], [hinge + 5, y - 0], [hinge + 5, y + 13], [hinge, y + 14]], metal[2]);
    layer.rect(hinge + 1, y + 1, 4, 1, metal[3]);
    layer.rect(hinge + 1, y + 5, 3, 1, metal[0]).rect(hinge + 1, y + 10, 3, 1, metal[0]);
    layer.px(hinge + 2, y + 3, blood[2]).px(hinge + 2, y + 4, blood[2]);
    // The freezer drawer slid out onto the floor, its frost-white pile of bags thawing.
    layer.rect(s.left + 1, s.ground, 13, 3, metal[2]).rect(s.left + 1, s.ground, 13, 1, metal[3]);
    layer.rect(s.left + 2, s.ground + 1, 11, 2, bone[3]);
    layer.rect(s.left + 3, s.ground + 1, 3, 2, teal[2]).rect(s.left + 8, s.ground, 4, 2, denim[2]);
    layer.rect(s.left + 15, s.ground + 2, 4, 2, bone[3]).px(s.left + 18, s.ground + 1, bone[2]);
    layer.px(s.left - 3, s.ground + 2, bone[3]).px(s.left - 2, s.ground + 4, bone[3]).px(s.left - 1, s.ground + 3, teal[2]);
  });
  return bakeStage(s);
}

// ---------------------------------------------------------------------------------------------
// 3. White side-by-side: two doors split off-centre, an ice dispenser and a gallery of family pages.
// ---------------------------------------------------------------------------------------------

function whiteClosed(): PixelSprite {
  const p = cabinet(bone[3], bone[2], bone[2], bone[3], bone[2]);
  const { c, left, ground, front } = p;
  c.rect(left + 6, front, 1, RISE, bone[0]);
  c.rect(left + 5, front + 4, 1, 9, metal[2]).rect(left + 8, front + 4, 1, 9, metal[2]);
  // Ice and water dispenser sunk into the freezer door.
  c.rect(left + 1, front + 6, 4, 6, ink[1]).rect(left + 2, front + 11, 2, 1, metal[3]).px(left + 2, front + 7, teal[2]).px(left + 3, front + 7, denim[2]);
  // Fridge door: one big landscape pinned up, and two small pages bunched under it with a menu list.
  c.rect(left + 9, front + 2, 5, 4, bone[1]).rect(left + 9, front + 2, 5, 2, denim[2]).rect(left + 9, front + 4, 5, 1, olive[2]);
  c.px(left + 12, front + 3, fire[3]).px(left + 9, front + 2, blood[2]);
  c.rect(left + 9, front + 15, 4, 3, bone[2]).px(left + 10, front + 16, ink[1]).px(left + 12, front + 17, ink[1]);
  c.rect(left + 12, front + 10, 3, 3, fire[3]).px(left + 12, front + 10, brick[1]);
  c.rect(left + 1, front + 14, 4, 1, bone[1]);
  // Kick grille: one long slot, not a row of vents.
  c.rect(left + 1, front + 19, 14, 1, bone[0]).rect(left + 2, ground - 3, 12, 1, ink[1]);
  // Bottles and the day's mail up top, one envelope fanned over the edge.
  c.rect(left + 3, 1, 2, 5, olive[2]).px(left + 3, 1, bone[3]).rect(left + 6, 2, 2, 4, teal[2]).px(left + 6, 2, bone[3]);
  c.rect(left + 9, 4, 5, 3, bone[3]).rect(left + 9, 4, 5, 1, bone[1]);
  c.poly([[left + 10, 6], [left + 14, 5], [left + 14, 8], [left + 11, 8]], bone[2]);
  return finish(p);
}

function whiteOpened(): PixelSprite {
  const p = cabinet(bone[3], bone[2], bone[2], bone[3], bone[2]);
  const { c, left, ground, front } = p;
  c.rect(left + 1, front + 1, 14, RISE - 2, bone[3]);
  c.rect(left + 6, front + 1, 2, RISE - 2, bone[1]);
  // The narrow freezer side: frosted wire baskets, a pizza box leaning out of the top one.
  c.rect(left + 1, front + 1, 5, RISE - 2, denim[2]).rect(left + 2, front + 2, 3, RISE - 4, bone[3]);
  c.rect(left + 2, front + 8, 3, 1, metal[2]).rect(left + 2, front + 14, 3, 1, metal[2]);
  c.poly([[left + 2, front + 8], [left + 3, front + 3], [left + 5, front + 4], [left + 5, front + 8]], bone[1]);
  c.px(left + 3, front + 5, blood[2]).px(left + 3, front + 11, teal[2]).px(left + 4, front + 12, teal[2]);
  // The wide fridge side: four shelves, bare on the right where the food was grabbed.
  c.rect(left + 8, front + 1, 6, 2, fire[3]);
  for (const row of [5, 10, 15]) c.rect(left + 8, front + row, 6, 1, teal[2]);
  c.rect(left + 8, front + 1, 6, 1, fire[3]);
  upright(c, left + 8, front + 5, blood[2], 3);
  c.rect(left + 11, front + 3, 1, 2, olive[2]);
  c.rect(left + 9, front + 8, 3, 2, bone[1]);
  c.rect(left + 8, front + 17, 5, 2, denim[2]).px(left + 12, front + 17, bone[3]);
  c.rect(left + 2, ground - 2, 12, 1, ink[1]);
  const s = stage('fridge', finish(p), 7, 5);
  over(s.c, (layer) => {
    // Both doors open, a thin slab on each side. The freezer door is slung wide; the other barely off the latch.
    const y = s.ground - RISE;
    const lh = s.left - 1;
    layer.poly([[lh, y], [lh - 2, y + 1], [lh - 2, y + RISE + 1], [lh, y + RISE - 1]], bone[2]);
    layer.line(lh, y, lh - 2, y + 1, bone[3]);
    layer.rect(lh - 1, y + 10, 1, 1, ink[1]);
    const rh = s.right + 1;
    layer.poly([[rh, y], [rh + 5, y + 2], [rh + 5, y + RISE + 2], [rh, y + RISE - 1]], bone[1]);
    layer.poly([[rh, y], [rh + 5, y + 2], [rh + 5, y + 6], [rh, y + 5]], bone[3]);
    layer.rect(rh + 1, y + 9, 4, 1, metal[1]).rect(rh + 1, y + 14, 4, 1, metal[1]);
    layer.px(rh + 2, y + 11, olive[2]).px(rh + 3, y + 12, olive[2]);
    // Thawed ice cubes scattered in a wide fan, and a puddle in front.
    layer.ellipse(s.left + 7.5, s.ground + 3, 6, 1.5, denim[2]);
    for (const [dx, dy] of [[1, 1], [4, 0], [10, 1], [14, 2], [-2, 3], [17, 3], [8, 4], [0, 4]] as const) layer.px(s.left + dx, s.ground + dy, bone[3]);
    layer.rect(s.left + 3, s.ground + 1, 3, 1, bone[3]);
  });
  return bakeStage(s);
}

// ---------------------------------------------------------------------------------------------
// 4. Avocado fridge: a small freezer flap over a big door, chrome latch, a radio on top.
// ---------------------------------------------------------------------------------------------

function avocadoClosed(): PixelSprite {
  const p = cabinet(olive[2], bone[2], olive[1], bone[2], olive[1]);
  const { c, left, ground, front } = p;
  c.rect(left, front + 5, p.w, 1, olive[0]);
  c.rect(left + 11, front + 2, 3, 1, metal[3]).px(left + 13, front + 3, metal[1]);
  c.rect(left + 12, front + 9, 2, 7, metal[3]).rect(left + 14, front + 9, 1, 7, metal[1]).px(left + 12, front + 8, metal[2]);
  c.line(left + 1, front + 6, left + 1, front + 19, metal[3]);
  c.px(left + 3, front + 2, bone[3]).px(left + 4, front + 3, bone[3]).px(left + 5, front + 2, bone[3]).px(left + 6, front + 3, bone[3]);
  // Patched with silver tape where the door got hit, and a rust bloom beneath the handle.
  c.rect(left + 3, front + 9, 5, 1, metal[2]).rect(left + 4, front + 8, 1, 4, metal[2]);
  c.px(left + 10, front + 17, brick[2]).px(left + 11, front + 18, brick[1]).px(left + 9, front + 18, brick[1]);
  // One grocery list and a single pizza magnet, nothing else.
  c.rect(left + 3, front + 13, 4, 5, bone[3]).px(left + 4, front + 14, ink[1]).px(left + 5, front + 16, ink[1]).px(left + 4, front + 17, ink[1]);
  c.px(left + 5, front + 13, fire[2]);
  c.rect(left + 3, ground - 3, 11, 2, ink[1]);
  // A table radio with a stub aerial, ticked half off the lid.
  c.rect(left + 2, 3, 9, 5, wood[2]).rect(left + 2, 3, 9, 1, wood[3]);
  c.rect(left + 3, 5, 3, 2, ink[1]).px(left + 8, 5, fire[2]).px(left + 8, 6, metal[3]);
  c.line(left + 9, 3, left + 12, 0, metal[3]);
  c.rect(left + 12, 6, 2, 2, bone[2]);
  return finish(p);
}

function avocadoOpened(): PixelSprite {
  const p = cabinet(olive[2], bone[2], olive[1], bone[2], olive[1]);
  const { c, left, right, ground, front } = p;
  c.rect(left + 1, front + 1, 14, RISE - 2, bone[2]).rect(left + 1, front + 1, 14, 1, fire[3]);
  // The ice box up top is a frozen cube of its own: furred with frost, one tray left in.
  c.rect(left + 2, front + 2, 12, 4, bone[3]).rect(left + 2, front + 5, 12, 1, denim[2]);
  c.rect(left + 3, front + 3, 4, 2, denim[1]).px(left + 4, front + 3, bone[3]).px(left + 6, front + 4, bone[3]);
  c.px(left + 10, front + 2, bone[2]).px(left + 12, front + 4, bone[2]);
  // Below it a single shelf and a deep well: one bottle and a pie dish, nothing else.
  c.rect(left + 2, front + 10, 12, 1, metal[1]);
  c.rect(left + 3, front + 6, 2, 4, wood[2]).px(left + 3, front + 6, bone[3]);
  c.rect(left + 9, front + 8, 5, 2, metal[3]).px(left + 10, front + 7, fire[2]).px(left + 12, front + 7, fire[2]);
  c.rect(left + 2, front + 15, 12, 4, olive[1]).rect(left + 2, front + 15, 12, 1, olive[2]);
  c.px(left + 6, front + 13, bone[3]).px(left + 7, front + 14, bone[3]);
  c.rect(left + 3, ground - 2, 11, 1, ink[1]);
  // The door was ripped off its pins: two bare brackets on the right edge.
  c.px(right, front + 3, metal[3]).px(right, front + 17, metal[3]);
  const s = stage('fridge', finish(p), 7, 5);
  over(s.c, (layer) => {
    // The door lies face-up on the floor, foreshortened, its latch catching the light.
    const y = s.ground;
    layer.poly([[s.left + 3, y], [s.right + 6, y], [s.right + 4, y + 4], [s.left + 1, y + 4]], olive[2]);
    layer.line(s.left + 3, y, s.right + 6, y, bone[2]);
    layer.rect(s.right - 2, y + 1, 4, 1, metal[3]);
    layer.rect(s.left + 5, y + 2, 4, 1, bone[3]);
    // A milk bottle rolled free of it, and a smashed pie on its far side.
    tipped(layer, s.left - 3, s.ground + 3, bone[3]);
    layer.rect(s.left + 11, s.ground - 1, 5, 1, metal[3]);
    layer.px(s.left + 12, s.ground - 2, fire[2]).px(s.left + 14, s.ground - 2, fire[1]);
    layer.px(s.left + 1, s.ground + 5, bone[3]).px(s.left + 6, s.ground + 5, bone[3]);
  });
  return bakeStage(s);
}

export function buildFridgeVariants(_base: PixelSprite): readonly ContainerArt[] {
  return [
    { closed: mintClosed(), opened: mintOpened() },
    { closed: steelClosed(), opened: steelOpened() },
    { closed: whiteClosed(), opened: whiteOpened() },
    { closed: avocadoClosed(), opened: avocadoOpened() },
  ];
}
