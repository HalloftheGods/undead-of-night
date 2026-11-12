// Doors shut, boarded and broken in. A shell's own art shows its door standing open; these are drawn
// over that opening when the sim says otherwise. Every canvas is DOOR_LAP wider each side than the
// opening, so a board can lap onto the frame it is nailed to.

import { DOOR_WIDTH, WALL_THICKNESS } from '../../../shared/protocol.ts';
import type { PixelSprite } from '../types.ts';
import { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Ramp } from '../palette.ts';
import { glass } from './facade.ts';
import type { OpeningFacing } from '../../../shared/fortifications.ts';
import type { DoorKind, DoorSpec } from './shell.ts';

const { bone, denim, fire, ink, metal, wood } = RAMPS;

export const DOOR_LAP = 2;
/** How far boards nailed across a door, seen from inside the room, reach onto the floor. */
export const BOARD_SPILL = 5;

const W = DOOR_WIDTH + DOOR_LAP * 2;
const LEAF = DOOR_WIDTH / 2;
const BOARD_H = 3;

const toneOf = (kind: DoorKind): Ramp => (kind === 'timber' ? wood : metal);

function bakeTopLeft(c: PixelCanvas): PixelSprite {
  return c.toSprite(c.w, c.h, 0, 0);
}

/** One board with a nail at each end, its far half a pixel off true: nailed up in a hurry. */
function board(c: PixelCanvas, y: number, tone: number, tilt: number): void {
  const half = W / 2;
  for (const [x, by] of [[0, y], [half, y + tilt]] as const) {
    c.rect(x, by, half, BOARD_H, wood[tone]).rect(x, by, half, 1, wood[tone + 1]).rect(x, by + BOARD_H - 1, half, 1, wood[tone - 1]);
  }
  c.px(2, y + 1, bone[1]).px(W - 3, y + 1 + tilt, bone[1]);
}

/** A brace from the bottom of one jamb to the top of the other. */
function brace(c: PixelCanvas, h: number): void {
  const y0 = h - 3;
  const y1 = 1;
  c.line(0, y0 - 1, W - 1, y1 - 1, wood[3]).line(0, y0, W - 1, y1, wood[2]).line(0, y0 + 1, W - 1, y1 + 1, wood[1]);
  c.px(2, y0, bone[1]).px(W - 3, y1, bone[1]);
}

/** Up to four boards over a face h tall: three across, then the brace. */
function boardUp(c: PixelCanvas, h: number, planks: number): void {
  const rows = [Math.round(h * 0.3), Math.round(h * 0.62), Math.round(h * 0.06)];
  const tilts = [1, -1, 0];
  rows.slice(0, Math.min(planks, 3)).forEach((y, i) => board(c, y, i === 1 ? 1 : 2, tilts[i]));
  if (planks > 3) brace(c, h);
}

function leafPair(c: PixelCanvas, h: number, tone: Ramp): void {
  c.rect(DOOR_LAP, 0, DOOR_WIDTH, h, tone[1]);
  c.rect(DOOR_LAP, 0, DOOR_WIDTH, 1, tone[2]).rect(DOOR_LAP, h - 1, DOOR_WIDTH, 1, tone[0]);
  // The meeting stiles: one catches the light, one is in its shadow.
  c.rect(DOOR_LAP + LEAF - 1, 1, 1, h - 1, tone[0]).rect(DOOR_LAP + LEAF, 1, 1, h - 1, tone[2]);
}

const FACES: Record<DoorKind, (c: PixelCanvas, h: number) => void> = {
  glass: (c, h) => {
    leafPair(c, h, metal);
    for (const x of [DOOR_LAP + 2, DOOR_LAP + LEAF + 2]) {
      glass(c, x, 2, LEAF - 4, h - 7);
      c.rect(x, Math.round(h * 0.55), LEAF - 4, 1, metal[3]);
    }
    c.rect(DOOR_LAP, h - 3, DOOR_WIDTH, 2, metal[0]);
  },
  timber: (c, h) => {
    leafPair(c, h, wood);
    for (const x of [DOOR_LAP + 3, DOOR_LAP + LEAF + 3]) {
      c.rect(x, 3, LEAF - 6, 5, denim[0]).px(x + 1, 4, denim[2]);
      c.rect(x, 10, LEAF - 6, h - 13, wood[0]).rect(x + 1, 11, LEAF - 8, h - 15, wood[1]);
    }
    const knob = Math.round(h * 0.5);
    c.px(DOOR_LAP + LEAF - 3, knob, fire[2]).px(DOOR_LAP + LEAF + 2, knob, fire[2]);
  },
  steel: (c, h) => {
    leafPair(c, h, metal);
    for (const x of [DOOR_LAP + 3, DOOR_LAP + LEAF + 3]) c.rect(x, 3, LEAF - 6, 5, metal[0]).rect(x + 1, 4, LEAF - 8, 3, ink[1]);
    c.rect(DOOR_LAP, h - 4, DOOR_WIDTH, 3, metal[0]);
    const pull = Math.round(h * 0.5);
    c.rect(DOOR_LAP + LEAF - 3, pull, 1, 3, metal[3]).rect(DOOR_LAP + LEAF + 2, pull, 1, 3, metal[3]);
    c.rect(DOOR_LAP + 5, h - 8, 2, 3, wood[1]).px(DOOR_LAP + 25, h - 6, wood[1]);
  },
  shutter: (c, h) => {
    for (let y = 0; y < h; y++) c.rect(DOOR_LAP, y, DOOR_WIDTH, 1, [metal[2], metal[1], metal[0]][y % 3]);
    c.rect(DOOR_LAP, h - 3, DOOR_WIDTH, 3, metal[0]).rect(DOOR_LAP, h - 3, DOOR_WIDTH, 1, metal[1]);
    c.rect(DOOR_LAP + LEAF - 3, h - 2, 6, 1, metal[3]);
    c.rect(DOOR_LAP, 0, 1, h, metal[0]).rect(DOOR_LAP + DOOR_WIDTH - 1, 0, 1, h, metal[0]);
  },
};

/** What a beating leaves: glass stars, everything else dents and splits. */
function wear(c: PixelCanvas, h: number, kind: DoorKind): void {
  const mid = Math.round(h * 0.45);
  const mark = kind === 'glass' ? bone[3] : ink[0];
  const x = DOOR_LAP + 8;
  c.line(x - 4, mid - 4, x + 4, mid + 4, mark).line(x + 4, mid - 3, x - 3, mid + 4, mark).line(x - 5, mid, x + 5, mid + 1, mark);
  const far = DOOR_LAP + 24;
  c.line(far, 2, far - 2, Math.round(h * 0.4), mark).line(far - 2, Math.round(h * 0.4), far + 2, Math.round(h * 0.7), mark);
  c.px(far + 3, h - 5, mark).px(far + 4, h - 4, mark);
}

/** A shut door face on: the shell's front door from the street, or a back door from inside its room. */
export function shutDoorFace(spec: DoorSpec, planks: number, worn: boolean): PixelSprite {
  const h = spec.height - 1;
  const c = new PixelCanvas(W, h);
  FACES[spec.kind](c, h);
  if (worn) wear(c, h, spec.kind);
  boardUp(c, h, planks);
  return bakeTopLeft(c);
}

/**
 * A shut door from inside its room: the leaf seen edge on in the gap of the wall, any boards across it reaching onto the floor.
 * A south door's boards spill north into the room; a north door's spill south.
 */
export function shutDoorFromAbove(kind: DoorKind, planks: number, facing: OpeningFacing = 'south'): PixelSprite {
  const wall = WALL_THICKNESS;
  const h = BOARD_SPILL + wall;
  const c = new PixelCanvas(W, h);
  const tone = toneOf(kind);
  const north = facing === 'north';
  const leaf = north ? 0 : BOARD_SPILL;
  c.rect(DOOR_LAP, leaf, DOOR_WIDTH, wall, ink[0]);
  c.rect(DOOR_LAP, leaf + 1, DOOR_WIDTH, wall - 2, tone[1]).rect(DOOR_LAP, leaf + 1, DOOR_WIDTH, 1, tone[2]);
  c.rect(DOOR_LAP + LEAF - 1, leaf + 1, 2, wall - 2, tone[0]);
  const rows = north ? [wall - BOARD_H + 2, wall - BOARD_H + 5, wall - BOARD_H - 2] : [BOARD_SPILL - 2, 0, BOARD_SPILL + 2];
  rows.slice(0, Math.min(planks, 3)).forEach((y, i) => board(c, y, i === 1 ? 1 : 2, 0));
  if (planks > 3) brace(c, h);
  return bakeTopLeft(c);
}

/** A door broken in: what is left of it, on the ground where it fell. */
export function doorDebris(kind: DoorKind): PixelSprite {
  const c = new PixelCanvas(W, 8);
  const tone = toneOf(kind);
  c.line(3, 5, 12, 2, tone[1]).line(3, 6, 12, 3, tone[0]);
  c.line(16, 1, 27, 5, tone[2]).line(16, 2, 27, 6, tone[1]).line(17, 3, 26, 6, tone[0]);
  c.rect(29, 2, 4, 2, wood[2]).rect(29, 3, 4, 1, wood[1]).px(30, 2, bone[1]);
  c.px(1, 2, tone[2]).px(14, 6, tone[1]).px(22, 0, tone[2]).px(33, 6, tone[0]).px(9, 0, wood[2]).px(10, 7, wood[1]);
  if (kind === 'glass') c.px(6, 1, denim[2]).px(20, 7, denim[2]).px(13, 4, denim[1]).px(25, 2, denim[2]).px(31, 5, denim[1]);
  c.outline({ color: ink[0] });
  return bakeTopLeft(c);
}
