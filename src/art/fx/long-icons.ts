// Long items drawn end to end, for a bag slot more than one cell tall. A bag cell is 17 art pixels
// with a pixel of air each side, so a sprite n cells tall is 15 wide and 17n - 2 high, standing upright.
// The bag turns it on its side when the item is.

import type { PickupType } from '../../../shared/protocol.ts';
import type { PixelSprite } from '../types.ts';
import { PixelCanvas } from '../kit.ts';
import type { Legend } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Grid } from './shared.ts';

const { blood, ink, metal, wood } = RAMPS;

const W = 15;
const CELL = 17;

const STEEL: Legend = {
  m: metal[0], n: metal[1], o: metal[2], p: metal[3],
  s: blood[1], t: blood[2], u: blood[3],
};

/** The gooseneck and its claw, bare steel. */
const CROWBAR_HOOK: Grid = [
  '....pooo.....',
  '...pooonnn...',
  '..poo..onm...',
  '..po...onm...',
  '..p....onm...',
];

/** The chisel end, kicked over and ground flat. */
const CROWBAR_TIP: Grid = [
  '.......onm...',
  '.......onm...',
  '......onm....',
  '.....oonm....',
  '.....pppn....',
];

const SHAFT = '.......uts...';

function sprite(canvas: PixelCanvas): PixelSprite {
  canvas.outline({ color: ink[0] });
  return canvas.toSprite(canvas.w, canvas.h, Math.floor(canvas.w / 2), Math.floor(canvas.h / 2));
}

/** A red wrecking bar standing on its chisel, three cells tall. */
function crowbar(): PixelSprite {
  const h = CELL * 3 - 2;
  const inner = h - 2;
  const shaft = Array.from({ length: inner - CROWBAR_HOOK.length - CROWBAR_TIP.length }, () => SHAFT);
  return sprite(new PixelCanvas(W, h).grid(1, 1, [...CROWBAR_HOOK, ...shaft, ...CROWBAR_TIP], STEEL));
}

/** A sawn board, four cells tall: grain, a knot, a split at one end and the nails still in it. */
function plank(): PixelSprite {
  const h = CELL * 4 - 2;
  const top = 1;
  const len = h - 2;
  const bottom = top + len - 1;
  const c = new PixelCanvas(W, h);
  c.rect(2, top, 11, len, wood[2]);
  c.rect(2, top, 1, len, wood[3]).rect(11, top, 1, len, wood[1]).rect(12, top, 1, len, wood[0]);
  // Grain: long streaks that never run the whole board.
  c.rect(5, top + 7, 1, 17, wood[1]).rect(9, top + 3, 1, 9, wood[1]);
  c.rect(8, top + 29, 1, 22, wood[1]).rect(4, top + 38, 1, 19, wood[1]).rect(6, top + 52, 1, 9, wood[3]);
  c.rect(4, top + 12, 1, 8, wood[3]).rect(10, top + 20, 1, 12, wood[3]);
  // The knot, and the grain bending round it.
  c.rect(6, top + 24, 3, 4, wood[1]).rect(7, top + 25, 1, 2, wood[0]);
  c.px(5, top + 25, wood[3]).px(5, top + 26, wood[3]).px(9, top + 25, wood[1]).px(9, top + 26, wood[1]);
  // Sawn ends: a lit top edge, a dark foot, a chipped corner and a split.
  c.rect(3, top, 9, 1, wood[3]).rect(2, bottom, 11, 1, wood[0]);
  c.erase(12, top).erase(2, bottom).erase(3, bottom);
  c.rect(7, bottom - 5, 1, 5, wood[0]);
  // Nails, two at each end, each with its shadow.
  for (const y of [top + 4, bottom - 9]) {
    for (const x of [4, 9]) c.px(x, y, metal[3]).px(x, y + 1, wood[0]);
  }
  return sprite(c);
}

export function buildLongIcons(): Readonly<Partial<Record<PickupType, PixelSprite>>> {
  return { crowbar: crowbar(), plank: plank() };
}
