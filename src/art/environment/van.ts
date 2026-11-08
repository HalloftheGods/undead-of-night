// The panel van, side-on and nose-left: the escape van, the vans left on the roads, and the
// ambulance, which is a van in a different coat. The livery says what goes where.

import type { Clip, PixelSprite } from '../types.ts';
import { makeClip, PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Color, Ramp } from '../palette.ts';
import { bake, groundShadow } from './common.ts';
import { legend, WHEEL } from './vehicles.ts';

const { ink, metal, denim, wood, bone, fire, blood, ash } = RAMPS;

export const VAN_W = 52;
export const VAN_GROUND = 38;
/** Where the van's roof meets its side, and where the side meets the sill. */
export const VAN_SIDE = 15;
const SILL = 31;

export interface VanLivery {
  /** Dark rib, roof, lit edge. */
  readonly roof: Ramp;
  /** Seam, panel, lit top edge. */
  readonly side: Ramp;
  /** The band along the cargo side, dark and lit, or null for a plain side. */
  readonly band: readonly [Color, Color] | null;
}

export const WORK_VAN: VanLivery = { roof: ash, side: [ash[0], metal[1], ash[1]], band: [blood[1], blood[2]] };
export const CREAM_VAN: VanLivery = { roof: [bone[0], bone[1], bone[2]], side: [bone[0], bone[1], bone[2]], band: [wood[1], wood[2]] };
export const OLIVE_VAN: VanLivery = { roof: [ash[0], RAMPS.olive[2], ash[2]], side: [RAMPS.olive[0], RAMPS.olive[1], RAMPS.olive[2]], band: null };
export const TEAL_VAN: VanLivery = { roof: ash, side: [RAMPS.teal[0], RAMPS.teal[1], RAMPS.teal[2]], band: [bone[2], bone[3]] };
/** Every coat a van is found in; the work van first. */
export const VAN_LIVERIES: readonly VanLivery[] = [WORK_VAN, CREAM_VAN, OLIVE_VAN, TEAL_VAN];

/** The roof slab, ribbed, with its vent. */
function vanRoof(c: PixelCanvas, roof: Ramp): void {
  c.poly([[15, 1], [52, 1], [52, VAN_SIDE - 1], [11, VAN_SIDE - 1]], roof[1]);
  c.rect(15, 1, 38, 1, roof[2]);
  c.line(14, 2, 12, VAN_SIDE - 2, roof[2]);
  for (const x of [24, 33, 42]) c.rect(x, 2, 1, VAN_SIDE - 3, roof[0]);
  c.rect(44, 4, 6, 6, metal[1]).rect(44, 4, 6, 1, metal[2]).rect(45, 5, 4, 1, metal[0]);
  c.rect(11, VAN_SIDE - 1, 42, 1, ink[1]);
}

/** Screen, then the stub of a bonnet. */
function vanNose(c: PixelCanvas, roof: Ramp): void {
  c.poly([[15, 1], [11, VAN_SIDE - 1], [5, VAN_SIDE + 3], [8, 7]], denim[0]);
  c.line(14, 3, 9, 10, denim[1]).line(13, 3, 8, 10, denim[1]).line(12, 7, 8, 13, denim[1]);
  c.line(15, 1, 8, 7, roof[1]).line(8, 7, 5, VAN_SIDE + 3, roof[1]);
  c.poly([[1, 15], [7, 9], [5, VAN_SIDE + 3], [1, VAN_SIDE + 4]], roof[1]);
  c.line(1, 15, 7, 9, roof[2]);
}

/** The slab side, a tone down from the roof that faces the light, with the cab door and the cargo bay. */
function vanSide(c: PixelCanvas, { side, band }: VanLivery): void {
  const top = VAN_SIDE;
  c.rect(1, top, VAN_W, SILL - top, side[1]);
  c.rect(1, top, VAN_W, 1, side[2]);
  c.rect(8, top + 1, 13, 7, denim[0]).rect(8, top + 1, 13, 1, ink[1]);
  c.line(11, top + 7, 15, top + 2, denim[1]).line(12, top + 7, 16, top + 2, denim[1]);
  c.rect(7, top, 1, SILL - top, side[0]).rect(21, top, 1, SILL - top, side[0]);
  c.rect(16, top + 9, 3, 1, metal[3]);
  // Sliding door rail and the seam of the door itself.
  c.rect(22, top + 3, 31, 1, side[0]);
  c.rect(36, top + 1, 1, SILL - top - 1, side[0]);
  if (band) c.rect(22, top + 8, 31, 3, band[0]).rect(22, top + 8, 31, 1, band[1]);
}

/** Lamps, bumper, wheels and the dirt thrown up over the sills. */
function vanUnderside(c: PixelCanvas, roof: Ramp): void {
  const top = VAN_SIDE;
  c.rect(1, top + 3, 3, 3, bone[3]).rect(1, top + 5, 3, 1, bone[1]);
  c.rect(VAN_W - 1, top + 2, 2, 5, blood[2]);
  c.rect(1, SILL, VAN_W, 2, ash[0]);
  c.rect(1, SILL + 1, 7, 2, metal[2]).rect(VAN_W - 4, SILL + 1, 5, 2, metal[2]);
  const wheels = legend(roof);
  for (const x of [8, 39]) {
    c.rect(x, SILL - 4, 11, 6, ink[0]);
    c.grid(x + 1, VAN_GROUND - 7, WHEEL, wheels);
  }
  for (const [x, y, w] of [[2, 30, 5], [20, 30, 18], [23, 29, 4], [31, 29, 3], [50, 30, 3]] as const) c.rect(x, y, w, 1, ash[0]);
}

/** A van in its livery, unoutlined so markings can still go on. */
export function vanBody(livery: VanLivery): PixelCanvas {
  const c = new PixelCanvas(VAN_W + 2, 42);
  groundShadow(c, 2, VAN_GROUND - 1, VAN_W - 1, 3);
  vanRoof(c, livery.roof);
  vanNose(c, livery.roof);
  vanSide(c, livery);
  vanUnderside(c, livery.roof);
  return c;
}

export function bakeVan(c: PixelCanvas): PixelSprite {
  c.outline({ selective: true });
  return bake(c, 1, VAN_W, VAN_GROUND);
}

/** The work van, with an invented mark on its cargo side. */
export function buildVan(livery: VanLivery = WORK_VAN): PixelSprite {
  const c = vanBody(livery);
  const top = VAN_SIDE;
  c.rect(26, top + 4, 6, 3, livery.side[2]).rect(27, top + 5, 4, 1, livery.side[0]);
  c.rect(30, top + 12, 4, 1, wood[2]).rect(29, top + 13, 6, 1, wood[1]);
  c.rect(45, top + 11, 2, 4, wood[1]);
  return bakeVan(c);
}

/** Hazard lights over the escape van, blinking so it can be picked out of the dark. */
export function buildEscapeVanLights(): Clip {
  const frame = (lit: boolean): PixelSprite => {
    const c = new PixelCanvas(VAN_W + 2, 42);
    const lamp = lit ? fire[3] : fire[0];
    c.rect(3, 22, 3, 3, lamp).rect(VAN_W - 4, 22, 3, 3, lamp);
    return bake(c, 1, VAN_W, VAN_GROUND);
  };
  return makeClip([frame(true), frame(false)], 2);
}
