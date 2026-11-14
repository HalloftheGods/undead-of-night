// Pixel art for the municipal electrical power substation: heavy concrete pad,
// step-down transformer housing, ceramic high-voltage insulator bushings,
// hazard-striped breaker cabinet, and grid distribution conduits.

import { PROP_DEFS } from '../../../shared/protocol.ts';
import type { PixelSprite } from '../types.ts';
import { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import { bake, groundShadow } from './common.ts';

const { acid, ash, bone, concrete, fire, ink, metal, teal } = RAMPS;

const MARGIN = 4;
const SHADOW_DEPTH = 3;
const TRANSFORMER_RISE = 14;

/** Builds the standalone pixel art sprite for the power substation. */
export function buildPowerSubstation(): PixelSprite {
  const { w, h } = PROP_DEFS.power_substation;
  const canvasW = w + MARGIN * 2;
  const canvasH = h + TRANSFORMER_RISE + MARGIN * 2;
  const ground = canvasH - MARGIN;
  const left = MARGIN;

  const c = new PixelCanvas(canvasW, canvasH);
  groundShadow(c, left + 1, ground - 1, w, SHADOW_DEPTH);

  // 1. Concrete foundation pad
  c.rect(left + 1, ground - h + 2, w - 2, h - 2, concrete[1]);
  c.rect(left + 1, ground - h + 2, w - 2, 1, concrete[2]);
  c.rect(left, ground - 1, w, 1, concrete[0]);

  // 2. Heavy transformer body (left and center)
  const bodyX = left + 2;
  const bodyY = ground - h - 8;
  const bodyW = 18;
  const bodyH = 16;
  c.rect(bodyX, bodyY, bodyW, bodyH, metal[1]);
  c.rect(bodyX, bodyY, bodyW, 1, metal[2]);
  c.rect(bodyX + bodyW - 1, bodyY, 1, bodyH, metal[0]);
  // Cooling radiator fins
  for (let rx = bodyX + 2; rx <= bodyX + bodyW - 4; rx += 3) {
    c.rect(rx, bodyY + 3, 1, bodyH - 5, metal[0]);
    c.rect(rx + 1, bodyY + 3, 1, bodyH - 5, metal[2]);
  }

  // 3. High-voltage insulator bushings on top of transformer
  const bushingPositions = [bodyX + 3, bodyX + 8, bodyX + 13];
  for (const bx of bushingPositions) {
    // Ceramic rib discs
    c.rect(bx, bodyY - 5, 3, 1, bone[2]);
    c.rect(bx - 1, bodyY - 4, 5, 1, teal[1]);
    c.rect(bx, bodyY - 3, 3, 1, bone[1]);
    c.rect(bx - 1, bodyY - 2, 5, 1, teal[2]);
    c.rect(bx, bodyY - 1, 3, 1, bone[0]);
    // Copper terminal cap
    c.px(bx + 1, bodyY - 6, fire[2]);
  }

  // 4. Control breaker cabinet (right side)
  const cabX = left + 21;
  const cabY = ground - h - 6;
  const cabW = 9;
  const cabH = 14;
  c.rect(cabX, cabY, cabW, cabH, ash[1]);
  c.rect(cabX, cabY, cabW, 1, ash[2]);
  c.rect(cabX + cabW - 1, cabY, 1, cabH, ash[0]);

  // Hazard warning chevron stripes across cabinet door
  c.rect(cabX + 1, cabY + 4, cabW - 2, 2, fire[2]);
  c.px(cabX + 2, cabY + 4, ink[0]);
  c.px(cabX + 3, cabY + 5, ink[0]);
  c.px(cabX + 5, cabY + 4, ink[0]);
  c.px(cabX + 6, cabY + 5, ink[0]);

  // Main breaker knife handle / power lever
  c.rect(cabX + 2, cabY + 8, 2, 3, metal[0]);
  c.px(cabX + 3, cabY + 7, fire[1]);
  c.px(cabX + 4, cabY + 7, fire[2]);

  // Status pilot light (red/amber standby)
  c.px(cabX + cabW - 3, cabY + 2, fire[2]);
  c.px(cabX + cabW - 3, cabY + 3, acid[1]);

  // 5. Heavy conduit pipe linking transformer to breaker cabinet
  c.rect(bodyX + bodyW, bodyY + 7, cabX - (bodyX + bodyW), 3, metal[0]);
  c.rect(bodyX + bodyW, bodyY + 7, cabX - (bodyX + bodyW), 1, metal[2]);

  return bake(c, 0, canvasW, canvasH);
}
