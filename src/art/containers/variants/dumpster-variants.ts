// Four more dumpsters on the stock bin's footprint, each drawn by hand with its own lid, ribbing,
// wheels and load: a blue city bin with one flat lid propped up by a bag, a rust bin with its left
// flap held up by cardboard, a steel bin heaped past the brim, and a faded olive bin with a side
// hatch and a lid piled with rubbish. Searched, each is ransacked its own way, from its own load.

import { PixelCanvas } from '../../kit.ts';
import type { Legend } from '../../kit.ts';
import { bake, groundShadow } from '../../environment/common.ts';
import { RAMPS } from '../../palette.ts';
import type { Color } from '../../palette.ts';
import type { PixelSprite } from '../../types.ts';
import { bakeStage, over, stage, tipped, upright } from '../stage.ts';
import type { ContainerArt } from '../stage.ts';

const { ink, metal, wood, bone, denim, teal, blood, olive, fire, ash, brick, concrete, acid } = RAMPS;

const SIDE = 6;
const BELOW = 6;
const ABOVE = 10;
const FOOT = 30;

/** A pen that draws in bin coordinates: u across the footprint, y down the sprite. */
interface Pen {
  rect(u: number, y: number, w: number, h: number, color: Color): Pen;
  px(u: number, y: number, color: Color): Pen;
  line(u0: number, y0: number, u1: number, y1: number, color: Color): Pen;
  poly(points: readonly (readonly [number, number])[], color: Color): Pen;
  grid(u: number, y: number, rows: readonly string[], legend: Legend): Pen;
  wipe(u: number, y: number, w: number, h: number): Pen;
  tin(u: number, y: number, color: Color): Pen;
  can(u: number, y: number, color: Color, height: number): Pen;
}

function pen(c: PixelCanvas, left: number, top: number): Pen {
  const p: Pen = {
    rect: (u, y, w, h, color) => (c.rect(left + u, top + y, w, h, color), p),
    px: (u, y, color) => (c.px(left + u, top + y, color), p),
    line: (u0, y0, u1, y1, color) => (c.line(left + u0, top + y0, left + u1, top + y1, color), p),
    poly: (points, color) => (c.poly(points.map(([u, y]) => [left + u, top + y] as const), color), p),
    grid: (u, y, rows, legend) => (c.grid(left + u, top + y, rows, legend), p),
    tin: (u, y, color) => (tipped(c, left + u, top + y, color), p),
    can: (u, y, color, height) => (upright(c, left + u, top + y, color, height), p),
    wipe: (u, y, w, h) => {
      for (let j = y; j < y + h; j++) for (let i = u; i < u + w; i++) c.erase(left + i, top + j);
      return p;
    },
  };
  return p;
}

/** One wheel or caster: a dark tyre round a lit hub. */
function wheel(p: Pen, u: number, y: number, h: number): void {
  p.rect(u, y, 4, h, ink[0]).rect(u + 1, y + 1, 2, h - 2, metal[1]).px(u + 1, y + 1, metal[3]);
}

const BAG: Legend = { a: ash[1], A: ash[2], d: ash[0], k: ink[1], e: bone[2], b: denim[1], B: denim[2], w: wood[2], W: wood[3] };

/** The base a look is drawn on: the stock bin's canvas, shadow and footprint. */
function blank(base: PixelSprite): { c: PixelCanvas; p: Pen; left: number; ground: number } {
  const c = new PixelCanvas(base.w, base.h);
  const left = base.ax - FOOT / 2;
  const ground = base.ay;
  groundShadow(c, left + 1, ground - 1, FOOT - 1, 3);
  return { c, p: pen(c, left, 0), left, ground };
}

function bakeLook(c: PixelCanvas, left: number, ground: number): PixelSprite {
  c.outline({ selective: true });
  return bake(c, left, FOOT, ground);
}

/** Opened sprite: the lid and load above the line `front` are cleared and drawn again. */
function ransack(closed: PixelSprite, front: number, draw: (p: Pen, ground: number) => void): PixelSprite {
  const s = stage('dumpster', closed, SIDE, BELOW, ABOVE);
  const p = pen(s.c, s.left, ABOVE);
  p.wipe(-3, -ABOVE, FOOT + 6, front + ABOVE);
  over(s.c, (layer) => draw(pen(layer, s.left, ABOVE), s.ground - ABOVE));
  return bakeStage(s);
}

// ---------------------------------------------------------------------------------------------
// 1. Blue city bin: one flat lid, propped up at the right end by a bag, rows of corrugation.

const BLUE_BAG = ['..aa...', '.aAAa..', 'aAAAaad', '.ddadd.'];
const LETTER_X = ['b.b', 'b.b', '.b.', 'b.b', 'b.b'];
const LETTER_P = ['bb.', 'b.b', 'bb.', 'b..', 'b..'];

function blueBin(base: PixelSprite): PixelSprite {
  const { c, p, left, ground } = blank(base);
  p.rect(0, 8, 30, 17, denim[1]).rect(0, 22, 30, 3, denim[0]).rect(0, 8, 1, 14, denim[2]).rect(29, 9, 1, 15, denim[0]);
  p.rect(0, 8, 30, 1, metal[2]).rect(0, 9, 30, 1, denim[0]);
  // Lid, hinged at the left and lifted at the right.
  p.poly([[0, 6], [29, 2], [29, 5], [0, 9]], denim[2]).line(0, 9, 29, 5, denim[0]).line(0, 6, 29, 2, metal[3]);
  p.rect(20, 5, 9, 3, ink[0]);
  p.grid(21, 3, BLUE_BAG, BAG).rect(26, 6, 4, 2, wood[2]).px(29, 6, wood[3]);
  // The letters "XP" stencilled on the smooth half, ribs only on the right.
  p.rect(2, 11, 10, 8, denim[0]).grid(3, 12, LETTER_X, { b: bone[2] }).grid(7, 12, LETTER_P, { b: bone[2] });
  p.rect(3, 18, 8, 1, fire[1]);
  [11, 14, 17, 20].forEach((y) => p.rect(14, y, 15, 1, denim[0]).rect(14, y + 1, 15, 1, denim[2]));
  p.rect(18, 22, 5, 2, denim[0]);
  wheel(p, 1, 22, 5);
  wheel(p, 25, 22, 5);
  return bakeLook(c, left, ground);
}

function blueBinOpened(closed: PixelSprite): PixelSprite {
  return ransack(closed, 10, (p, ground) => {
    // The lid thrown right back, standing over the bin.
    p.poly([[1, -5], [28, -6], [29, 0], [0, 1]], denim[2]).line(0, 1, 29, 0, denim[0]).rect(11, -3, 7, 1, ink[0]);
    p.rect(1, 2, 28, 6, ink[0]);
    p.grid(2, 4, ['.aa..', 'aAAad'], BAG).px(9, 6, bone[1]).rect(18, 6, 3, 2, metal[2]);
    p.rect(0, 8, 30, 1, metal[2]).rect(0, 9, 30, 1, denim[0]);
    // The bag that was propped on the lid, split on the ground, and its cans rolled out.
    p.grid(21, ground + 1, ['..aaa..aa', '.aAAAaaAAd', 'aAAAaddadk', '.ddkdddd..'], BAG);
    p.rect(19, ground + 4, 3, 1, bone[2]).px(27, ground + 4, bone[1]);
    p.tin(3, ground, metal[2]).rect(9, ground + 2, 4, 2, teal[1]).px(9, ground + 2, bone[3]);
    p.rect(14, ground + 1, 6, 2, wood[2]).rect(14, ground + 1, 6, 1, wood[3]);
  });
}

// ---------------------------------------------------------------------------------------------
// 2. Rust bin: two flaps, the left held up by flattened cardboard, the right sagging under a bag.

const RUST_BAG = ['.aaa....', 'aAAAaad.', 'aAAAAaad', '.dkaaad.'];

function rustBin(base: PixelSprite): PixelSprite {
  const { c, p, left, ground } = blank(base);
  p.rect(0, 5, 30, 20, brick[2]).rect(0, 20, 30, 5, brick[1]).rect(0, 5, 1, 17, brick[2]).rect(29, 5, 1, 20, brick[1]);
  p.rect(0, 12, 30, 1, brick[1]).rect(0, 11, 30, 1, wood[1]);
  // Left flap standing, its underside dark, held there by sheets of board and a crushed carton.
  p.rect(1, 4, 13, 8, ink[0]).poly([[0, 1], [13, 1], [13, 3], [0, 3]], concrete[2]).rect(0, 1, 13, 1, concrete[3]);
  p.line(3, 11, 6, 0, wood[2]).line(4, 11, 7, 0, wood[3]).line(8, 11, 11, 3, wood[1]);
  p.rect(2, 8, 8, 4, wood[1]).rect(2, 8, 8, 1, wood[2]);
  // Right flap shut and bowed, a bag slumped across it.
  p.rect(15, 4, 14, 7, concrete[1]).rect(15, 4, 14, 1, concrete[2]).rect(14, 4, 1, 8, ink[0]);
  p.rect(24, 8, 4, 2, wood[1]).grid(17, 0, RUST_BAG, BAG).rect(19, 3, 9, 1, ash[0]);
  [4, 9, 20, 25].forEach((u) => p.rect(u, 14, 2, 8, brick[0]).rect(u, 14, 1, 8, brick[2]));
  // The stencilled plate between the ribs and a long dent to the right.
  p.rect(12, 14, 6, 7, bone[1]).rect(13, 16, 4, 1, brick[0]).rect(13, 18, 3, 1, brick[0]).px(15, 15, brick[0]);
  p.line(21, 15, 26, 21, brick[0]).line(22, 15, 27, 21, brick[1]);
  p.rect(11, 22, 8, 2, ink[0]);
  p.rect(7, 24, 3, 3, ink[0]).rect(20, 24, 3, 3, ink[0]).px(8, 25, metal[2]).px(21, 25, metal[2]);
  return bakeLook(c, left, ground);
}

function rustBinOpened(closed: PixelSprite): PixelSprite {
  return ransack(closed, 13, (p, ground) => {
    // Left flap upright, right flap flung over and leaning on its back.
    p.poly([[0, -6], [3, -6], [5, 4], [0, 4]], concrete[2]).line(3, -6, 5, 4, concrete[0]);
    p.poly([[14, -3], [29, -6], [29, -3], [14, 0]], concrete[1]).line(14, -3, 29, -6, concrete[3]);
    p.rect(1, 3, 28, 8, ink[0]);
    // Board slid down across what is left, one sheet stuck on the back wall.
    p.line(3, 9, 14, 5, wood[2]).line(3, 10, 14, 6, wood[1]).rect(17, 8, 8, 2, wood[1]).px(19, 8, bone[2]);
    p.rect(0, 11, 30, 1, wood[1]).rect(0, 12, 30, 1, brick[1]);
    // Boards fanned out across the ground to the left, a jug and a bottle to the right.
    p.line(0, ground + 3, 10, ground, wood[2]).line(0, ground + 4, 10, ground + 1, wood[3]);
    p.rect(2, ground + 4, 9, 1, wood[1]);
    p.rect(14, ground, 3, 4, bone[2]).rect(14, ground, 3, 1, bone[3]).px(15, ground - 1, blood[2]);
    p.grid(20, ground + 1, ['.aaaa.', 'aAAAad', 'aAAadd', '.ddd..'], BAG);
    p.rect(27, ground + 2, 3, 1, teal[2]).rect(26, ground + 3, 1, 1, bone[3]);
  });
}

// ---------------------------------------------------------------------------------------------
// 3. Steel bin: bags heaped above the brim, the lid thrown back on the right, rivets and a hazard band.

const HEAP = [
  '.........aaa....bb....',
  '...aa...aAAAaa.bBBbb..',
  '..aAAaaaAAAAad.BBBbbd.',
  '.aAAAAaaAAAAadbBBBbbdd',
  'aAAAAAaddAAadddbbbbbdd',
  'adAAkddddddakddddkdddd',
  '.dddd.ddkddddd.kddd.dd',
];

function steelBin(base: PixelSprite): PixelSprite {
  const { c, p, left, ground } = blank(base);
  p.rect(0, 8, 30, 17, metal[1]).rect(0, 22, 30, 3, metal[0]).rect(0, 8, 30, 1, metal[2]).rect(0, 8, 1, 15, metal[2]);
  p.rect(29, 9, 1, 15, metal[0]);
  p.rect(24, 1, 5, 9, concrete[2]).rect(24, 1, 5, 1, concrete[3]).rect(28, 2, 1, 8, concrete[0]);
  p.grid(2, 2, HEAP, BAG).rect(1, 9, 24, 1, ink[0]);
  // Bolted along the top and bottom, braced across the left half.
  for (let u = 2; u < 28; u += 3) p.px(u, 11, metal[3]).px(u, 23, metal[3]);
  p.rect(2, 13, 12, 9, metal[0]).rect(3, 14, 10, 7, metal[1]).line(3, 14, 12, 20, metal[3]).line(12, 14, 3, 20, metal[0]);
  p.rect(16, 13, 13, 3, fire[1]);
  [16, 20, 24, 28].forEach((u) => p.px(u, 13, ink[0]).px(u + 1, 14, ink[0]).px(u + 2, 15, ink[0]));
  p.rect(15, 18, 12, 3, metal[2]).rect(15, 21, 12, 1, metal[0]);
  wheel(p, 0, 21, 6);
  wheel(p, 26, 21, 6);
  return bakeLook(c, left, ground);
}

function steelBinOpened(closed: PixelSprite): PixelSprite {
  return ransack(closed, 10, (p, ground) => {
    // The lid stood on end at the right, the back of the bin open to the dark.
    p.poly([[25, -6], [29, -6], [29, 6], [26, 6]], concrete[2]).line(25, -6, 26, 6, concrete[3]).rect(28, -6, 1, 12, concrete[0]);
    p.rect(1, 2, 24, 7, ink[0]).rect(0, 8, 25, 1, metal[2]).rect(1, 9, 24, 1, ink[0]);
    p.rect(26, 7, 4, 3, ink[0]);
    // One bag half out over the front, slit, and still hanging.
    p.grid(7, 3, ['..aaaa...', '.aAAAAad.', 'aAAAAAAdd', 'aAAAAddkd', 'adAAddd.d', '.dAkdd..d', '..ddd.d..', '..dd..dd.', '...d...d.'], BAG);
    // What fell out of it, strewn right and away from the bin.
    p.rect(15, ground + 1, 5, 3, wood[2]).rect(15, ground + 1, 5, 1, wood[3]).rect(19, ground + 2, 2, 2, wood[1]);
    p.rect(8, ground + 2, 3, 3, ash[1]).px(8, ground + 2, bone[3]);
    p.rect(22, ground, 1, 4, teal[2]).rect(23, ground + 4, 3, 1, teal[1]);
    p.tin(25, ground + 1, blood[1]).rect(27, ground + 4, 3, 1, bone[1]);
    p.rect(3, ground + 3, 4, 1, bone[2]).px(2, ground + 4, ink[1]);
  });
}

// ---------------------------------------------------------------------------------------------
// 4. Olive bin: sloped lid carrying a carton and a heap, a side hatch, tight ribs and a scrawl.

const LID_HEAP = ['..aa.....', '.aAAad.aa', 'aAAAAdaAAd', 'ddAAddddAd'];

function oliveBin(base: PixelSprite): PixelSprite {
  const { c, p, left, ground } = blank(base);
  p.rect(0, 10, 30, 15, olive[1]).rect(0, 22, 30, 3, olive[0]).rect(0, 10, 30, 1, olive[2]).rect(0, 11, 30, 1, olive[0]);
  p.poly([[0, 9], [3, 4], [26, 4], [29, 9]], olive[2]).line(3, 4, 26, 4, acid[1]).line(0, 9, 29, 9, olive[0]);
  p.rect(12, 8, 8, 1, metal[2]);
  // A pizza box tipped on the lid and a heap behind it.
  p.poly([[3, 2], [11, 0], [12, 3], [4, 5]], bone[2]).line(3, 2, 11, 0, bone[3]).px(8, 3, blood[1]);
  p.grid(15, 0, LID_HEAP, BAG).rect(15, 4, 10, 1, ash[0]);
  // Tight ribs on the left, a scrawl over them, and a side hatch.
  [3, 6, 9, 12].forEach((u) => p.rect(u, 12, 1, 11, olive[0]).rect(u + 1, 12, 1, 11, olive[2]));
  p.line(2, 19, 5, 16, fire[1]).line(5, 16, 8, 19, fire[1]).line(8, 19, 11, 16, fire[1]);
  p.rect(17, 13, 11, 10, olive[0]).rect(18, 14, 9, 8, olive[1]).rect(18, 14, 9, 1, olive[2]).rect(24, 17, 2, 3, bone[2]);
  p.px(18, 15, metal[3]).px(18, 20, metal[3]);
  p.rect(2, 24, 6, 3, metal[1]).rect(2, 24, 6, 1, metal[2]).rect(22, 24, 6, 3, metal[1]).rect(22, 24, 6, 1, metal[2]);
  return bakeLook(c, left, ground);
}

function oliveBinOpened(closed: PixelSprite): PixelSprite {
  return ransack(closed, 12, (p, ground) => {
    // The lid flung up on a slant over the left, the carton gone with it.
    p.poly([[0, 2], [18, -6], [29, -4], [10, 5]], olive[2]).line(0, 2, 18, -6, acid[1]).line(10, 5, 29, -4, olive[0]);
    p.rect(2, 3, 26, 8, ink[0]).rect(0, 10, 30, 1, olive[2]).rect(0, 11, 30, 1, olive[0]);
    p.grid(17, 7, ['.aa.', 'aAAd', 'dddd'], BAG).rect(4, 9, 6, 2, wood[1]);
    // The hatch swung wide and what was behind it heaped out onto the ground.
    p.rect(17, 13, 11, 10, ink[0]).poly([[27, 13], [32, 15], [32, 24], [27, 22]], olive[2]).line(27, 13, 32, 15, acid[1]);
    p.grid(15, ground - 3, ['....aaaa....', '..aaAAAAad..', '.aAAAAAAAAdd', 'aAAAbbBBadkd', 'aAAAbBBBaddd', 'ddAAbbbbdddd', '.dddddddddd.'], BAG);
    p.rect(20, ground - 1, 4, 3, wood[2]).rect(20, ground - 1, 4, 1, wood[3]);
    // On the bare ground to the left: one shoe and a bottle.
    p.grid(4, ground + 1, ['wwww.', 'wWWwww', 'kkkkkk'], BAG);
    p.can(8, ground + 5, fire[2], 3);
    p.rect(11, ground + 2, 1, 3, teal[2]).rect(12, ground + 4, 3, 1, teal[1]);
  });
}

export function buildDumpsterVariants(base: PixelSprite): readonly ContainerArt[] {
  const looks: readonly [(b: PixelSprite) => PixelSprite, (c: PixelSprite) => PixelSprite][] = [
    [blueBin, blueBinOpened], [rustBin, rustBinOpened], [steelBin, steelBinOpened], [oliveBin, oliveBinOpened],
  ];
  return looks.map(([shut, ransacked]) => {
    const closed = shut(base);
    return { closed, opened: ransacked(closed) };
  });
}
