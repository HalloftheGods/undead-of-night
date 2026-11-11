// Pixel art for the enlarged emergency radio tower: heavy concrete pad, generator
// and civil defense siren console, 110px lattice mast with aviation warning bands,
// microwave dishes, maintenance platform, and spire beacon.

import { PROP_DEFS } from '../../../shared/protocol.ts';
import type { PixelSprite } from '../types.ts';
import { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import { bake, groundShadow } from './common.ts';

const { blood, bone, concrete, fire, ink, metal } = RAMPS;

const MARGIN = 4;
const SHADOW_DEPTH = 4;
const TOWER_RISE = 110;

/** Builds the standalone pixel art sprite for the enlarged emergency radio tower. */
export function buildRadioTower(): PixelSprite {
  const { w, h } = PROP_DEFS.radio_tower;
  const canvasW = w + MARGIN * 2;
  const canvasH = h + TOWER_RISE + MARGIN * 2;
  const ground = canvasH - MARGIN;
  const left = MARGIN;
  const midX = left + Math.round(w / 2);

  const c = new PixelCanvas(canvasW, canvasH);
  groundShadow(c, left + 1, ground - 1, w, SHADOW_DEPTH);

  // 1. Heavy Concrete Ground Pad
  c.rect(left + 2, ground - h + 2, w - 4, h - 2, concrete[1]);
  c.rect(left + 2, ground - h + 2, w - 4, 1, concrete[2]);
  c.rect(left + 1, ground - 1, w - 2, 1, concrete[0]);
  // Corner mounting anchor plates
  for (const dx of [-16, 16]) {
    c.rect(midX + dx - 2, ground - h + 3, 5, 3, metal[1]);
    c.px(midX + dx, ground - h + 4, metal[3]);
  }

  // 2. Equipment Console, Generator & Siren Unit (on left half of pad)
  const boxX = left + 3;
  const boxY = ground - 18;
  const boxW = 14;
  const boxH = 16;
  c.rect(boxX, boxY, boxW, boxH, metal[1]);
  c.rect(boxX, boxY, boxW, 1, metal[2]);
  c.rect(boxX + boxW - 1, boxY, 1, boxH, metal[0]);
  // Cooling louvers / generator vents
  for (let vy = boxY + 3; vy <= boxY + 7; vy += 2) {
    c.rect(boxX + 2, vy, 5, 1, ink[0]);
  }
  // Hazard stripe indicator on alarm door
  c.rect(boxX + 8, boxY + 3, 5, 2, fire[2]);
  c.px(boxX + 10, boxY + 3, ink[0]);
  // Status dials and big emergency pull button
  c.rect(boxX + 8, boxY + 9, 4, 4, blood[2]);
  c.px(boxX + 9, boxY + 10, blood[3]);
  c.px(boxX + 11, boxY + 11, metal[3]);

  // Dual Horn Civil Defense Sirens on console top
  c.rect(boxX + 4, boxY - 5, 6, 4, fire[1]);
  c.rect(boxX + 3, boxY - 6, 8, 2, fire[2]);
  c.rect(boxX + 1, boxY - 7, 3, 3, fire[3]); // Left horn flare
  c.rect(boxX + 10, boxY - 7, 3, 3, fire[3]); // Right horn flare
  c.rect(boxX + 5, boxY - 1, 4, 2, metal[2]);

  // 3. Lattice Mast with Alternating Hazard Bands
  const topY = ground - TOWER_RISE;
  const mastHeight = ground - 6 - topY;

  // Four structural leg struts
  for (let y = ground - 6; y >= topY; y--) {
    const progress = (ground - 6 - y) / mastHeight;
    const halfWidth = Math.round(14 - progress * 9); // Tapers from 14 down to 5
    // Aviation warning paint: alternating bands of orange and white every 18px
    const bandIdx = Math.floor((ground - y) / 18) % 2;
    const strutColor = bandIdx === 0 ? fire[2] : bone[2];
    const shadowColor = bandIdx === 0 ? fire[1] : bone[1];

    c.px(midX - halfWidth, y, strutColor);
    c.px(midX + halfWidth, y, shadowColor);
    // Center ladder uprights
    c.px(midX - 1, y, metal[1]);
    c.px(midX + 1, y, metal[2]);
  }

  // Cross-bracing lattice & ladder rungs
  for (let tierY = ground - 10; tierY >= topY + 4; tierY -= 8) {
    const progress = (ground - 6 - tierY) / mastHeight;
    const halfWidth = Math.round(14 - progress * 9);
    const bandIdx = Math.floor((ground - tierY) / 18) % 2;
    const tieColor = bandIdx === 0 ? fire[1] : bone[1];

    c.rect(midX - halfWidth, tierY, halfWidth * 2 + 1, 1, tieColor);
    // Ladder rung in center
    c.rect(midX - 1, tierY + 4, 3, 1, metal[3]);
    // Diagonal cross struts
    for (let d = 0; d < halfWidth; d++) {
      c.px(midX - halfWidth + d, tierY - d, metal[1]);
      c.px(midX + halfWidth - d, tierY - d, metal[0]);
    }
  }

  // 4. Mid-Mast Maintenance Platform (at y = ground - 50)
  const platY = ground - 50;
  c.rect(midX - 11, platY, 23, 2, metal[3]);
  c.rect(midX - 11, platY - 4, 23, 1, metal[2]); // Safety handrail
  c.px(midX - 11, platY - 3, metal[1]);
  c.px(midX + 11, platY - 3, metal[1]);
  // Mid-mast red obstruction marker light
  c.px(midX + 11, platY - 5, blood[2]);

  // 5. Parabolic Microwave Dishes
  // Large dish facing left
  const dishY = ground - 64;
  c.rect(midX - 13, dishY - 5, 3, 11, metal[2]);
  c.rect(midX - 12, dishY - 6, 2, 13, bone[2]);
  c.rect(midX - 9, dishY - 2, 5, 5, metal[1]);
  c.px(midX - 14, dishY, metal[3]); // Feed horn tip

  // Secondary dish facing right
  const dish2Y = ground - 88;
  c.rect(midX + 9, dish2Y - 3, 3, 7, metal[2]);
  c.rect(midX + 8, dish2Y - 4, 2, 9, bone[2]);
  c.rect(midX + 6, dish2Y - 1, 3, 3, metal[1]);

  // 6. Top Spire & High-Intensity Beacon
  const spireTopY = topY - 12;
  for (let y = topY; y >= spireTopY; y--) {
    c.px(midX, y, metal[2]);
  }
  // Cross antenna dipole rods
  c.rect(midX - 4, topY - 4, 9, 1, metal[3]);
  c.rect(midX - 3, topY - 8, 7, 1, metal[3]);

  // Aviation Beacon Bulb & Protective Cage
  c.rect(midX - 2, spireTopY - 3, 5, 4, blood[2]);
  c.px(midX, spireTopY - 2, blood[3]);
  c.px(midX - 1, spireTopY - 2, blood[3]);
  c.px(midX, spireTopY - 4, metal[3]); // Lightning arrestor needle tip

  return bake(c, left, w, ground);
}
