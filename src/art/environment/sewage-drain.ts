// Pixel art for the municipal sewage drain station: concrete pad, heavy pump housing,
// drainage intake grating, conduit manifold, and emergency manual release wheel.

import { PROP_DEFS } from '../../../shared/protocol.ts';
import type { PixelSprite } from '../types.ts';
import { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import { bake, groundShadow } from './common.ts';

const { acid, concrete, fire, ink, metal, olive } = RAMPS;

const MARGIN = 4;
const SHADOW_DEPTH = 3;
const PUMP_RISE = 12;

/** Builds the standalone pixel art sprite for the sewage drain station. */
export function buildSewageDrain(): PixelSprite {
  const { w, h } = PROP_DEFS.sewage_drain;
  const canvasW = w + MARGIN * 2;
  const canvasH = h + PUMP_RISE + MARGIN * 2;
  const ground = canvasH - MARGIN;
  const left = MARGIN;

  const c = new PixelCanvas(canvasW, canvasH);
  groundShadow(c, left + 1, ground - 1, w, SHADOW_DEPTH);

  // 1. Concrete foundation pad
  c.rect(left + 1, ground - h + 2, w - 2, h - 2, concrete[1]);
  c.rect(left + 1, ground - h + 2, w - 2, 1, concrete[2]);
  c.rect(left, ground - 1, w, 1, concrete[0]);

  // 2. Iron drainage grate (right half of footprint)
  const grateX = left + 16;
  const grateY = ground - h + 4;
  const grateW = 13;
  const grateH = h - 6;
  c.rect(grateX, grateY, grateW, grateH, ink[0]);
  c.rect(grateX, grateY, grateW, 1, metal[1]);
  c.rect(grateX, grateY + grateH - 1, grateW, 1, metal[0]);
  for (let gx = grateX + 2; gx < grateX + grateW - 1; gx += 2) {
    c.rect(gx, grateY + 1, 1, grateH - 2, metal[2]);
    c.px(gx, grateY + Math.floor(grateH / 2), acid[1]);
  }

  // 3. Heavy pump and turbine casing (left half)
  const pumpX = left + 3;
  const pumpY = ground - h - 6;
  const pumpW = 12;
  const pumpH = 14;
  c.rect(pumpX, pumpY, pumpW, pumpH, metal[1]);
  c.rect(pumpX, pumpY, pumpW, 1, metal[2]);
  c.rect(pumpX + pumpW - 1, pumpY, 1, pumpH, metal[0]);
  // Motor cooling ribs
  for (let ry = pumpY + 3; ry <= pumpY + 9; ry += 2) {
    c.rect(pumpX + 2, ry, pumpW - 4, 1, ink[0]);
  }

  // 4. Manifold pipe connecting pump to grate
  c.rect(pumpX + pumpW, pumpY + 6, 4, 4, olive[1]);
  c.rect(pumpX + pumpW, pumpY + 6, 4, 1, olive[2]);

  // 5. Emergency manual valve wheel (on top of pump)
  const wheelX = pumpX + 4;
  const wheelY = pumpY - 5;
  c.rect(wheelX + 1, wheelY + 3, 2, 3, metal[2]);
  // Yellow release valve wheel
  c.rect(wheelX, wheelY, 4, 3, fire[2]);
  c.px(wheelX + 1, wheelY + 1, fire[3]);
  c.px(wheelX + 2, wheelY + 1, ink[0]);

  return bake(c, 0, canvasW, canvasH);
}
