// Four more lockers on the stock locker's footprint, each drawn by hand as its own shut and searched
// pair: a gym locker with one tall door, a two-door cabinet with unequal doors, a rusted row of three
// narrow doors, and a steel cabinet split into a top door and a bottom one. What sits on the lid in
// the shut look is what has fallen off, or been dragged down, in the searched one.

import { finish, startPiece } from '../../environment/furniture.ts';
import type { Piece } from '../../environment/furniture.ts';
import { RAMPS } from '../../palette.ts';
import type { Color } from '../../palette.ts';
import type { PixelCanvas } from '../../kit.ts';
import type { PixelSprite } from '../../types.ts';
import { bakeStage, over, paper, stage, tipped, upright } from '../stage.ts';
import type { ContainerArt } from '../stage.ts';

const { ink, metal, wood, bone, denim, teal, blood, olive, fire, ash, brick } = RAMPS;

const RISE = 22;

/** The bare tall box: a lid you look down on and a front face, nothing on it yet. */
function shell(lid: Color, lidEdge: Color, face: Color, faceEdge: Color): Piece {
  const p = startPiece('locker', RISE);
  const { c, left, ground, front, top, w } = p;
  c.rect(left, top, w, 8, lid).rect(left, top, w, 1, lidEdge).rect(left, top, 1, 8, lidEdge);
  c.rect(left, front, w, RISE, face).rect(left, front, w, 1, faceEdge).rect(left, front, 1, RISE, faceEdge);
  c.rect(left, ground - 1, w, 1, ink[1]);
  return p;
}

/** A door swung out on its hinge, seen edge on: its outer face and the rim that catches the light. */
function swung(layer: PixelCanvas, hinge: number, dir: 1 | -1, y: number, len: number, face: Color, rim: Color): void {
  const far = hinge + dir * 4;
  layer.poly([[hinge, y], [far, y + 2], [far, y + len + 2], [hinge, y + len - 1]], face);
  layer.line(hinge, y, far, y + 2, rim);
}

/** Clothes slumped in a heap: a lit top edge and a darker fold. */
function heap(c: PixelCanvas, x: number, y: number, w: number, h: number, cloth: Color, fold: Color): void {
  c.rect(x, y, w, h, cloth).rect(x, y, w, 1, fold).rect(x + 1, y + 1, 1, h - 1, fold);
}

// ---------------------------------------------------------------------------------------------
// 1. Gym locker: one tall door, a name card, slots low down and a padlock through the hasp.

function gymShell(): Piece {
  const p = shell(denim[2], bone[2], denim[1], denim[2]);
  const { c, left, front, top } = p;
  c.rect(left + 15, front, 1, RISE, denim[0]);
  // Boxes shoved up on the lid, the top one pushed back.
  c.rect(left + 1, top + 3, 7, 5, wood[2]).rect(left + 1, top + 3, 7, 1, wood[3]).rect(left + 4, top + 3, 1, 5, bone[1]);
  c.rect(left + 2, top, 5, 4, wood[3]).rect(left + 2, top, 5, 1, bone[2]).rect(left + 2, top + 3, 5, 1, wood[1]);
  // A mug left on the right with its handle turned out.
  c.rect(left + 11, top + 3, 3, 3, bone[2]).rect(left + 11, top + 3, 3, 1, bone[3]).px(left + 14, top + 4, bone[1]);
  return p;
}

function gymClosed(): PixelSprite {
  const p = gymShell();
  const { c, left, front } = p;
  c.frame(left + 1, front + 1, 14, 19, denim[0]);
  // The name card in its holder, scribbled on.
  c.rect(left + 5, front + 3, 6, 4, bone[3]).frame(left + 5, front + 3, 6, 4, metal[2]);
  c.line(left + 6, front + 5, left + 9, front + 5, ink[1]).px(left + 6, front + 4, ink[1]).px(left + 8, front + 4, ink[1]);
  // A band sticker and a smaller star peeled half off.
  c.rect(left + 2, front + 9, 3, 2, blood[2]).px(left + 3, front + 9, bone[3]).px(left + 4, front + 11, blood[1]);
  // A long recessed pull with a hasp and a padlock hanging from it.
  c.rect(left + 12, front + 8, 2, 6, ink[1]).rect(left + 12, front + 8, 1, 6, metal[3]);
  c.rect(left + 11, front + 15, 4, 1, metal[2]).rect(left + 12, front + 16, 2, 2, fire[2]).px(left + 12, front + 16, fire[3]);
  c.px(left + 13, front + 15, ink[1]);
  // A dent low on the left where something was kicked.
  c.line(left + 2, front + 13, left + 5, front + 15, denim[0]).line(left + 3, front + 13, left + 6, front + 15, denim[2]);
  // Slots, low and wide.
  for (const y of [front + 17, front + 19]) c.rect(left + 2, y, 9, 1, ink[1]);
  return finish(p);
}

function gymOpened(): PixelSprite {
  const p = gymShell();
  const { c, left, ground, front, top } = p;
  // Mug and the top box gone from the lid; the one box left is skewed.
  c.rect(left + 1, top, 14, 8, denim[2]).rect(left, top, 1, 8, bone[2]).rect(left, top, 16, 1, bone[2]);
  c.poly([[left + 1, top + 4], [left + 7, top + 2], [left + 8, top + 7], [left + 2, top + 8]], wood[2]);
  c.line(left + 1, top + 4, left + 7, top + 2, wood[3]);
  // Door off to the left: a hook rail, a jacket still hung from it, a shelf on the right.
  c.rect(left + 1, front + 1, 14, 20, ink[0]);
  c.rect(left + 2, front + 2, 12, 1, metal[2]).px(left + 3, front + 3, metal[2]).px(left + 9, front + 3, metal[2]);
  c.rect(left + 8, front + 3, 4, 9, olive[1]).rect(left + 8, front + 3, 4, 1, olive[2]).px(left + 10, front + 12, olive[1]);
  c.rect(left + 8, front + 14, 7, 1, metal[1]).rect(left + 9, front + 11, 2, 3, bone[2]).px(left + 9, front + 11, bone[3]);
  // The floor of it: a heap of clothes and a boot.
  heap(c, left + 2, ground - 7, 5, 6, blood[1], blood[2]);
  c.rect(left + 8, ground - 4, 4, 3, wood[2]).rect(left + 8, ground - 4, 2, 1, wood[3]);
  const s = stage('locker', finish(p), 7, 5);
  over(s.c, (layer) => {
    swung(layer, s.left - 1, -1, s.ground - RISE, RISE, denim[1], denim[2]);
    layer.rect(s.left - 4, s.ground - RISE + 6, 2, 3, bone[3]);
    // The padlock on the floor, and a mug rolled away, a few sleeves flopped out.
    layer.rect(s.left + 11, s.ground + 2, 2, 2, fire[2]);
    layer.rect(s.left + 14, s.ground + 3, 3, 3, bone[2]).px(s.left + 17, s.ground + 4, bone[1]);
    tipped(layer, s.left + 4, s.ground + 1, denim[2]);
    paper(layer, s.left + 8, s.ground + 3);
  });
  return bakeStage(s);
}

// ---------------------------------------------------------------------------------------------
// 2. Two doors, one wide and one narrow: a louvred window, a mesh grille, a stencilled number.

function twinShell(): Piece {
  const p = shell(olive[2], bone[1], olive[1], olive[2]);
  const { c, left, front, top } = p;
  c.rect(left + 15, front, 1, RISE, olive[0]);
  c.rect(left + 10, front, 1, RISE, olive[0]);
  // A blanket rolled up along the back of the lid, three cans stood in front of the narrow end.
  c.rect(left + 1, top + 1, 9, 3, bone[1]).rect(left + 1, top + 1, 9, 1, bone[2]).rect(left + 1, top + 3, 9, 1, bone[0]);
  c.rect(left + 1, top + 1, 1, 3, bone[3]).px(left + 9, top + 2, bone[0]);
  return p;
}

function twinClosed(): PixelSprite {
  const p = twinShell();
  const { c, left, front, top } = p;
  upright(c, left + 11, top + 6, teal[2], 4);
  upright(c, left + 13, top + 5, blood[2], 3);
  upright(c, left + 14, top + 7, fire[1], 3);
  // A louvred window in the wide door.
  c.rect(left + 2, front + 2, 6, 8, ink[0]);
  for (const y of [front + 3, front + 5, front + 7, front + 9]) c.rect(left + 2, y, 6, 1, metal[1]);
  // Mesh across the head of the narrow one.
  c.rect(left + 12, front + 2, 3, 4, ink[1]);
  for (const [x, y] of [[12, 2], [14, 2], [13, 3], [12, 4], [14, 4], [13, 5]] as const) c.px(left + x, front + y, metal[2]);
  // Pulls: a tall bar on the wide door's edge, a short knob on the other, a hasp across the gap.
  c.rect(left + 8, front + 12, 1, 4, metal[3]).rect(left + 12, front + 11, 1, 2, metal[3]);
  c.rect(left + 8, front + 17, 5, 1, metal[2]).rect(left + 11, front + 18, 2, 2, fire[2]).px(left + 11, front + 18, fire[3]);
  // A bay number stencilled low on the wide door: a 0 and a 7.
  c.frame(left + 2, front + 14, 2, 4, bone[2]).rect(left + 5, front + 14, 2, 1, bone[2]).line(left + 6, front + 15, left + 5, front + 17, bone[2]);
  // A dent in the narrow door, low.
  c.line(left + 12, front + 18, left + 14, front + 16, olive[0]);
  return finish(p);
}

function twinOpened(): PixelSprite {
  const p = twinShell();
  const { c, left, ground, front, top } = p;
  // The cans and the end of the blanket have gone: only the loose roll's end is left, dragged half off.
  c.rect(left + 1, top + 1, 9, 3, olive[2]).rect(left + 11, top + 1, 4, 6, olive[2]);
  c.rect(left + 1, top + 4, 8, 3, bone[1]).rect(left + 1, top + 4, 8, 1, bone[2]).rect(left + 8, top + 5, 2, 3, bone[0]);
  // Both bays open: two hollows split by the post.
  c.rect(left + 1, front + 1, 9, 20, ink[0]).rect(left + 11, front + 1, 4, 20, ink[0]);
  // Wide bay: a board high up with folded things, wire hangers below it, one still on the rail.
  c.rect(left + 1, front + 6, 9, 1, metal[2]).rect(left + 2, front + 3, 4, 3, teal[1]).rect(left + 2, front + 3, 4, 1, teal[2]);
  c.rect(left + 6, front + 4, 3, 2, bone[1]);
  c.line(left + 3, front + 9, left + 6, front + 12, metal[2]).line(left + 6, front + 12, left + 4, front + 13, metal[2]);
  c.rect(left + 5, front + 14, 4, 6, denim[1]).rect(left + 5, front + 14, 4, 1, denim[2]);
  // Narrow bay: empty, a boot lying in the bottom of it.
  c.rect(left + 11, front + 13, 1, 1, metal[2]).rect(left + 12, ground - 4, 3, 3, wood[2]).rect(left + 12, ground - 4, 3, 1, wood[3]);
  const s = stage('locker', finish(p), 7, 5);
  over(s.c, (layer) => {
    // The wide door half open, hanging from its lower hinge so it droops.
    const hinge = s.left + 1;
    const y = s.ground - RISE;
    layer.poly([[hinge, y + 2], [hinge - 4, y + 5], [hinge - 5, y + RISE + 1], [hinge, y + RISE - 1]], olive[1]);
    layer.line(hinge, y + 2, hinge - 4, y + 5, olive[2]);
    layer.rect(hinge - 4, y + 8, 3, 4, ink[1]).line(hinge - 4, y + 8, hinge - 2, y + 8, metal[2]);
    // The narrow door wrenched off and slung against the front, its mesh facing out.
    layer.poly([[s.right - 4, s.ground + 4], [s.right + 1, s.ground + 2], [s.right + 2, s.ground + 5], [s.right - 3, s.ground + 7]], olive[1]);
    layer.px(s.right - 1, s.ground + 4, metal[2]).px(s.right, s.ground + 5, metal[2]);
    // Cans that rolled down, one stood up.
    tipped(layer, s.left + 1, s.ground + 2, blood[2]);
    upright(layer, s.left + 8, s.ground + 5, teal[2], 4);
    tipped(layer, s.left + 11, s.ground + 4, fire[1]);
  });
  return bakeStage(s);
}

// ---------------------------------------------------------------------------------------------
// 3. A rusted row: three narrow doors, each with its own slits and pull, a bay plate in the middle.

function rowShell(): Piece {
  const p = shell(brick[2], fire[1], fire[0], fire[1]);
  const { c, left, front, top } = p;
  c.rect(left + 5, front, 1, RISE, brick[0]).rect(left + 10, front, 1, RISE, brick[0]);
  c.rect(left + 15, front, 1, RISE, brick[1]);
  // A hard hat left at the left end of the lid, with a stack of papers fanned beside it.
  c.rect(left + 2, top + 3, 5, 3, fire[2]).rect(left + 3, top + 2, 3, 1, fire[2]).rect(left + 2, top + 3, 5, 1, fire[3]);
  c.rect(left + 1, top + 5, 7, 1, fire[1]);
  return p;
}

function rowClosed(): PixelSprite {
  const p = rowShell();
  const { c, left, front, top } = p;
  paper(c, left + 9, top + 2);
  paper(c, left + 11, top + 4);
  paper(c, left + 10, top + 6);
  // Left door: two short slits high, a pull low on the hinge side.
  c.rect(left + 1, front + 2, 3, 1, ink[1]).rect(left + 1, front + 4, 3, 1, ink[1]).rect(left + 3, front + 12, 1, 3, metal[3]);
  // Middle door: a plate with its number, a keyhole, a hasp near the foot.
  c.rect(left + 7, front + 2, 2, 3, bone[2]).px(left + 7, front + 3, ink[1]).px(left + 8, front + 4, ink[1]);
  c.px(left + 7, front + 10, ink[0]).rect(left + 6, front + 14, 4, 1, metal[2]).rect(left + 7, front + 15, 2, 2, bone[1]);
  // Right door: slits low down, a pull at the shoulder.
  for (const y of [front + 15, front + 17, front + 19]) c.rect(left + 12, y, 3, 1, ink[1]);
  c.rect(left + 11, front + 7, 1, 3, metal[3]);
  // Rust runs down from every slit, and the foot of each door is eaten.
  for (const x of [left + 2, left + 13]) c.line(x, front + 5, x, front + 9, brick[1]);
  c.px(left + 8, front + 5, brick[1]).px(left + 8, front + 6, brick[1]).px(left + 12, front + 20, brick[1]).px(left + 3, front + 20, brick[0]);
  return finish(p);
}

function rowOpened(): PixelSprite {
  const p = rowShell();
  const { c, left, ground, front, top } = p;
  // The hat is still there, the papers have been pulled off the right end.
  c.rect(left + 9, top, 6, 8, brick[2]);
  c.line(left + 11, top + 3, left + 13, top + 6, bone[2]);
  // Middle door removed entirely: a deep bay with boots stacked and a drift of paper.
  c.rect(left + 6, front + 1, 4, 20, ink[0]);
  c.rect(left + 6, front + 9, 4, 1, metal[1]);
  c.rect(left + 6, front + 5, 3, 4, wood[2]).rect(left + 6, front + 5, 3, 1, wood[3]).px(left + 9, front + 7, wood[1]);
  c.rect(left + 6, front + 12, 4, 2, bone[1]).rect(left + 7, front + 14, 3, 2, bone[2]).rect(left + 6, ground - 3, 4, 2, wood[2]);
  // Left door hangs shut but sprung: dark gap down its far side, one slit left, the pull wrenched.
  c.rect(left + 4, front + 1, 1, 20, ink[0]).line(left + 4, front + 1, left + 5, front + 4, ink[1]);
  c.rect(left + 1, front + 2, 3, 1, ink[1]);
  // Right door bent where a bar went in, hinge side torn out and propped crooked.
  c.rect(left + 11, front + 1, 4, 20, ink[0]);
  c.poly([[left + 12, front + 1], [left + 14, front + 1], [left + 14, front + 12], [left + 11, front + 13]], fire[0]);
  c.line(left + 12, front + 1, left + 11, front + 13, brick[0]);
  c.rect(left + 12, front + 4, 2, 1, ink[1]);
  c.rect(left + 11, front + 15, 4, 5, olive[1]).rect(left + 11, front + 15, 4, 1, olive[2]);
  const s = stage('locker', finish(p), 7, 5);
  over(s.c, (layer) => {
    // Papers fanned over the floor in front, a boot dragged out and the hat knocked off.
    paper(layer, s.left + 1, s.ground + 1);
    paper(layer, s.left + 4, s.ground + 3);
    paper(layer, s.left + 12, s.ground + 4);
    layer.rect(s.left + 8, s.ground + 2, 4, 3, wood[2]).rect(s.left + 8, s.ground + 2, 4, 1, wood[3]);
    layer.rect(s.left + 14, s.ground + 1, 4, 3, fire[2]).px(s.left + 14, s.ground + 1, fire[3]);
    // The sprung right door's edge kicked out past the frame.
    layer.poly([[s.right + 1, s.ground - RISE + 1], [s.right + 3, s.ground - RISE + 2], [s.right + 3, s.ground - 8], [s.right + 1, s.ground - 8]], fire[1]);
  });
  return bakeStage(s);
}

// ---------------------------------------------------------------------------------------------
// 4. Steel cabinet: a tall door over a short one, vertical slots, a hazard strip along the foot.

function stackShell(): Piece {
  const p = shell(metal[1], metal[3], metal[2], metal[3]);
  const { c, left, front, top } = p;
  c.rect(left + 15, front, 1, RISE, metal[1]);
  c.rect(left, front + 14, 16, 1, metal[0]);
  // A paint can and a short pile of tins up on the lid.
  c.rect(left + 9, top + 2, 5, 5, ash[1]).rect(left + 9, top + 2, 5, 1, bone[2]).rect(left + 9, top + 4, 5, 1, blood[2]);
  c.rect(left + 10, top + 1, 3, 1, metal[3]);
  return p;
}

function stackClosed(): PixelSprite {
  const p = stackShell();
  const { c, left, front, top } = p;
  upright(c, left + 2, top + 6, teal[2], 4);
  upright(c, left + 5, top + 6, fire[1], 3);
  upright(c, left + 3, top + 4, bone[2], 3);
  // Upper door: five tall slots up the shoulder and a bar across the middle.
  for (const x of [3, 5, 7, 9, 11]) c.rect(left + x, front + 2, 1, 3, ink[1]);
  c.rect(left + 10, front + 9, 4, 1, metal[0]).rect(left + 10, front + 8, 4, 1, bone[3]);
  c.rect(left + 2, front + 8, 3, 3, fire[2]).rect(left + 2, front + 8, 3, 1, fire[3]);
  // Lower door: a flat plate, a keyhole, the hasp on the left.
  c.rect(left + 6, front + 17, 4, 2, metal[1]).px(left + 7, front + 17, metal[3]).px(left + 8, front + 18, ink[1]);
  c.rect(left + 1, front + 16, 2, 1, metal[0]).rect(left + 1, front + 17, 2, 2, bone[1]);
  // Hazard strip along the foot.
  for (let x = 1; x < 15; x += 2) c.rect(left + x, front + 20, 1, 1, fire[2]);
  return finish(p);
}

function stackOpened(): PixelSprite {
  const p = stackShell();
  const { c, left, ground, front, top } = p;
  // The tins are gone off the lid; the can's lid is off and it has tipped back.
  c.rect(left + 1, top + 1, 7, 7, metal[1]).line(left + 1, top + 1, left + 7, top + 1, metal[3]);
  c.rect(left + 9, top + 3, 5, 3, ash[1]).rect(left + 13, top + 3, 1, 3, ink[0]).rect(left + 9, top + 3, 5, 1, bone[2]);
  // Upper bay open: a shelf, jerry cans and a toolbox, pushed to one side.
  c.rect(left + 1, front + 1, 14, 12, ink[0]);
  c.rect(left + 1, front + 7, 14, 1, metal[2]);
  c.rect(left + 9, front + 2, 5, 5, olive[2]).rect(left + 9, front + 2, 5, 1, olive[2]).px(left + 11, front + 1, olive[1]);
  c.rect(left + 1, front + 4, 5, 3, fire[1]).rect(left + 1, front + 4, 5, 1, fire[3]).rect(left + 3, front + 3, 1, 1, fire[3]);
  c.rect(left + 9, front + 8, 4, 5, teal[1]).rect(left + 9, front + 8, 4, 1, teal[2]);
  // Lower door dropped off its pin on one side, tilted across the bay.
  c.rect(left + 1, front + 15, 14, 6, ink[0]);
  c.poly([[left + 2, front + 14], [left + 15, front + 15], [left + 15, front + 17], [left + 2, front + 20]], metal[2]);
  c.line(left + 2, front + 14, left + 15, front + 15, metal[3]).rect(left + 6, front + 16, 2, 1, metal[0]);
  c.rect(left + 3, ground - 4, 8, 3, denim[1]).rect(left + 3, ground - 4, 8, 1, denim[2]);
  const s = stage('locker', finish(p), 7, 5);
  over(s.c, (layer) => {
    // The upper door lifted aside and left against the right edge.
    swung(layer, s.right + 1, 1, s.ground - RISE, 12, metal[2], metal[3]);
    layer.rect(s.right + 2, s.ground - RISE + 7, 2, 1, metal[0]);
    // Tins rolled out: two lying, one stood up, the paint dribbling.
    tipped(layer, s.left + 3, s.ground + 2, teal[2]);
    tipped(layer, s.left + 10, s.ground + 1, fire[1]);
    upright(layer, s.left + 15, s.ground + 4, bone[2], 3);
    layer.rect(s.left + 6, s.ground + 4, 4, 1, blood[2]);
  });
  return bakeStage(s);
}

export function buildLockerVariants(_base: PixelSprite): readonly ContainerArt[] {
  return [
    { closed: gymClosed(), opened: gymOpened() },
    { closed: twinClosed(), opened: twinOpened() },
    { closed: rowClosed(), opened: rowOpened() },
    { closed: stackClosed(), opened: stackOpened() },
  ];
}
