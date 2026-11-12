// Police cruisers and ambulances, left where the night caught them with their light bars still
// going. Each body is drawn with its bar dark; the lit halves are a clip that blinks over it.

import type { Clip, PixelSprite } from '../types.ts';
import { makeClip, PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Color } from '../palette.ts';
import { BLACK, WHITE } from './car-paints.ts';
import { bake } from './common.ts';
import { bakeVan, VAN_GROUND, VAN_SIDE, VAN_W, vanBody } from './van.ts';
import type { VanLivery } from './van.ts';
import { bakeNoseUp, bakeSideOn, noseUpBody, SEDAN, SEDAN_V, SEDAN_V_W, SIDE_GROUND, sideOnBody } from './vehicles.ts';

const { ink, metal, blood, bone, denim, fire } = RAMPS;

const SEDAN_W = 44;
/** Blinks per second: each frame is one side of the bar lit. */
const BEACON_FPS = 4;

type Lamp = readonly [x: number, y: number, w: number, h: number];

export interface Bar {
  /** Lit in the first frame. */
  readonly first: readonly Lamp[];
  readonly firstColor: readonly [dim: Color, lit: Color];
  /** Lit in the second. */
  readonly second: readonly Lamp[];
  readonly secondColor: readonly [dim: Color, lit: Color];
}

export const RED: readonly [Color, Color] = [blood[1], blood[3]];
export const BLUE: readonly [Color, Color] = [denim[0], denim[2]];
export const CLEAR: readonly [Color, Color] = [bone[0], bone[3]];

export function paintBar(c: PixelCanvas, bar: Bar, litFirst: boolean | null): void {
  const shade = (pair: readonly [Color, Color], lit: boolean): Color => (lit ? pair[1] : pair[0]);
  for (const [x, y, w, h] of bar.first) c.rect(x, y, w, h, shade(bar.firstColor, litFirst === true));
  for (const [x, y, w, h] of bar.second) c.rect(x, y, w, h, shade(bar.secondColor, litFirst === false));
}

/** Two frames, each with one side of the bar lit, sized and anchored like the body under them. */
export function beacon(w: number, h: number, left: number, footprintW: number, ground: number, bar: Bar): Clip {
  const frame = (litFirst: boolean): PixelSprite => {
    const c = new PixelCanvas(w, h);
    const lamps = litFirst ? bar.first : bar.second;
    const [, lit] = litFirst ? bar.firstColor : bar.secondColor;
    for (const [x, y, lw, lh] of lamps) c.rect(x, y, lw, lh, lit);
    return bake(c, left, footprintW, ground);
  };
  return makeClip([frame(true), frame(false)], BEACON_FPS);
}

/** Across the roof, which side-on runs up the picture: the far half red, the near half blue. */
const CRUISER_BAR: Bar = { first: [[20, 3, 8, 3]], firstColor: RED, second: [[20, 6, 8, 3]], secondColor: BLUE };

/** Paints the parts of a black body white: the doors and the roof, the old two-tone. */
export function twoTone(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number): void {
  const swap = new Map<Color, Color>([[BLACK[1], WHITE[1]], [BLACK[2], WHITE[2]]]);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const next = swap.get(c.get(x, y) ?? -1);
      const isBlackPaint = next !== undefined;
      if (isBlackPaint) c.px(x, y, next);
    }
  }
}

export function buildPoliceH(): PixelSprite {
  const c = sideOnBody(SEDAN, SEDAN_W, [5, 30], BLACK);
  twoTone(c, 14, 1, 34, 10);
  twoTone(c, 10, 15, 38, 20);
  // The bar's housing, then its lamps; a gold star on the front door.
  c.rect(19, 2, 10, 8, ink[1]);
  paintBar(c, CRUISER_BAR, null);
  c.px(18, 16, fire[2]).rect(17, 17, 3, 1, fire[2]).px(18, 18, fire[2]).px(17, 18, fire[1]).px(19, 18, fire[1]);
  c.rect(30, 17, 6, 1, ink[1]);
  return bakeSideOn(c, SEDAN_W);
}

export function buildPoliceHLights(): Clip {
  return beacon(SEDAN_W + 2, 30, 1, SEDAN_W, SIDE_GROUND, CRUISER_BAR);
}

/** Nose up, the bar runs across the picture: red to the left, blue to the right. */
const CRUISER_V_BAR: Bar = { first: [[3, 24, 8, 2]], firstColor: RED, second: [[11, 24, 8, 2]], secondColor: BLUE };

export function buildPoliceV(): PixelSprite {
  const c = noseUpBody(SEDAN_V, BLACK);
  // White from the windscreen back to the rear glass, the roof the bar sits on.
  twoTone(c, 1, 12, SEDAN_V_W, 34);
  c.rect(2, 23, 18, 4, ink[1]);
  paintBar(c, CRUISER_V_BAR, null);
  return bakeNoseUp(c, SEDAN_V);
}

export function buildPoliceVLights(): Clip {
  return beacon(SEDAN_V_W + 2, SEDAN_V.length + 4, 1, SEDAN_V_W, SEDAN_V.length + 1, CRUISER_V_BAR);
}

export const AMBULANCE: VanLivery = { roof: [bone[0], bone[2], bone[3]], side: [bone[0], bone[2], bone[3]], band: [blood[1], blood[2]] };

/** A bar over the cab and a pair of lamps at the back of the roof, red and white in turn. */
const AMBULANCE_BAR: Bar = {
  first: [[16, 2, 3, 5], [48, 9, 3, 3]],
  firstColor: RED,
  second: [[16, 7, 3, 5], [48, 3, 3, 3]],
  secondColor: CLEAR,
};

export function buildAmbulance(): PixelSprite {
  const c = vanBody(AMBULANCE);
  const top = VAN_SIDE;
  c.rect(15, 1, 5, 12, ink[1]);
  paintBar(c, AMBULANCE_BAR, null);
  // An invented mark: a six-armed star on the cargo door, and a stripe of reflective tape.
  const [sx, sy] = [44, top + 13];
  c.rect(sx - 2, sy, 5, 1, blood[2]).rect(sx, sy - 2, 1, 5, blood[2]);
  c.px(sx - 1, sy - 1, blood[2]).px(sx + 1, sy + 1, blood[2]).px(sx + 1, sy - 1, blood[2]).px(sx - 1, sy + 1, blood[2]);
  c.rect(22, top + 14, 14, 1, fire[2]);
  c.rect(16, top + 9, 3, 1, metal[2]);
  return bakeVan(c);
}

export function buildAmbulanceLights(): Clip {
  return beacon(VAN_W + 2, 42, 1, VAN_W, VAN_GROUND, AMBULANCE_BAR);
}
