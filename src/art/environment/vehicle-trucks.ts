// The cars cut from the sedan's nose-up hand that are not the sedan: the pickup with its open bed,
// then the panel van and the ambulance, drawn top-down with the same outline and ramps.

import type { PixelSprite } from '../types.ts';
import { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Ramp } from '../palette.ts';
import { bake, groundShadow } from './common.ts';
import { bakeNoseUp, noseUpBody, SEDAN_V } from './vehicles.ts';
import type { VanLivery } from './van.ts';

const { ink, metal, denim, bone, blood, ash } = RAMPS;

const V = SEDAN_V;
const bare = (row: string): string => row.replace(/^K/, '.').replace(/K$/, '.');
const front = (row: string): string => row.replaceAll('R', 'L').replaceAll('r', 'l');
const tailLamps = '....RRppppppppRR....';
const DIVIDER = bare(V[34]).replace('r', 'd');

/** One row of the bed seen from above: rails, their inner faces, the floor; wheel stubs where the axle is. */
const bedRow = (stub: boolean, floor = 'dddddddddd'): string => `${stub ? 'K' : '.'}dpPd${floor}dpp${stub ? 'K' : 'd'}`.slice(0, 20);
const BED = [
  bedRow(false, 'kkkkkkkkkk'), bedRow(false), bedRow(true), bedRow(true, 'dddkkkkddd'), bedRow(true, 'dddkKKkddd'),
  bedRow(true, 'dddkkkkddd'), bedRow(true), bedRow(true), bedRow(false, 'kkkkkkkkkk'), bedRow(false),
];

const HOOD_FAR = [...V.slice(2, 10), V[1].replaceAll('P', 'p')];
const WINDSCREEN = V.slice(12, 18);
const CAB_ROOF = [...V.slice(19, 23), V[29]];

/** Nose up: hood, windscreen, a short cab roof, rear glass, then the open bed down to the tailgate. */
export const PICKUP_V = [...V.slice(0, 10), ...WINDSCREEN, V[18], ...CAB_ROOF, ...V.slice(30, 34).map(bare), DIVIDER, ...BED, ...V.slice(39)];

/** Nose down: the tailgate edge and the bed first, then the cab, then the hood and the grille. */
export const PICKUP_S = [
  tailLamps, ...BED, DIVIDER, ...V.slice(30, 34).map(bare), V[18], ...CAB_ROOF, ...WINDSCREEN.map(bare), V[18],
  ...HOOD_FAR, ...V.slice(39).map(front),
];

export const pickupN = (paint: Ramp): PixelSprite => bakeNoseUp(noseUpBody(PICKUP_V, paint), PICKUP_V);
export const pickupS = (paint: Ramp): PixelSprite => bakeNoseUp(noseUpBody(PICKUP_S, paint), PICKUP_S);

export const VAN_NW = 24;
/** The footprint's bottom edge on the van canvas, and the canvas height. */
export const VAN_NGROUND = 55;
export const VAN_NH = 58;

const BONNET = 8;
const SCREEN = 7;
const ROOF = 28;
const FACE = 11;

/** The bonnet's rounded nose, its lit edge and the stubs of the front wheels. */
function bonnet(c: PixelCanvas, y: number, livery: VanLivery, noseAtTop: boolean): void {
  const { roof, side } = livery;
  c.rect(1, y, VAN_NW, BONNET, roof[1]).rect(2, y, 1, BONNET, roof[2]).rect(VAN_NW - 1, y, 1, BONNET, roof[0]);
  c.rect(1, y, 1, BONNET, side[0]).rect(VAN_NW, y, 1, BONNET, side[0]);
  const nose = noseAtTop ? y : y + BONNET - 1;
  c.rect(1, nose, VAN_NW, 1, roof[0]);
  c.rect(3, y + (noseAtTop ? 1 : 2), 8, 2, roof[2]);
  c.rect(1, y + 2, 2, 6, ink[0]).rect(VAN_NW - 1, y + 2, 2, 6, ink[0]);
}

function windscreen(c: PixelCanvas, y: number, roof: Ramp): void {
  c.rect(2, y, VAN_NW - 2, SCREEN, denim[0]).rect(2, y, VAN_NW - 2, 1, ink[1]);
  c.rect(1, y, 1, SCREEN, roof[0]).rect(VAN_NW, y, 1, SCREEN, roof[0]);
  for (let i = 0; i < 3; i++) c.rect(5 + i * 2, y + 5 - i, 2, 1, denim[1]).rect(14 + i * 2, y + 5 - i, 2, 1, denim[1]);
  c.rect(12, y, 2, SCREEN, roof[0]);
}

/** The slab of the roof, ribbed, with its vent; the same either way up. */
function roofSlab(c: PixelCanvas, y: number, livery: VanLivery, vent: number): void {
  const { roof, side } = livery;
  c.rect(1, y, VAN_NW, ROOF, roof[1]).rect(2, y, 1, ROOF, roof[2]).rect(VAN_NW - 1, y, 1, ROOF, roof[0]);
  c.rect(1, y, 1, ROOF, side[0]).rect(VAN_NW, y, 1, ROOF, side[0]);
  for (const r of [7, 16, 25]) c.rect(3, y + r, VAN_NW - 4, 1, roof[0]);
  c.rect(8, y + vent, 8, 6, metal[1]).rect(8, y + vent, 8, 1, metal[2]).rect(9, y + vent + 5, 6, 1, metal[0]);
  c.rect(1, y + 20, 2, 7, ink[0]).rect(VAN_NW - 1, y + 20, 2, 7, ink[0]);
}

/** The back doors, seen from behind and above, with lamps, glass and the bumper. */
function tailFace(c: PixelCanvas, y: number, livery: VanLivery): void {
  const { side } = livery;
  c.rect(1, y, VAN_NW, FACE, side[1]).rect(1, y, VAN_NW, 1, side[2]).rect(12, y + 1, 1, FACE - 4, side[0]);
  c.rect(4, y + 2, 6, 4, denim[0]).rect(15, y + 2, 6, 4, denim[0]).rect(5, y + 2, 2, 1, denim[1]).rect(16, y + 2, 2, 1, denim[1]);
  c.rect(1, y + 6, 3, 3, blood[2]).rect(VAN_NW - 2, y + 6, 3, 3, blood[2]);
  c.rect(10, y + 7, 1, 2, metal[3]).rect(14, y + 7, 1, 2, metal[3]);
  c.rect(1, y + FACE - 3, VAN_NW, 1, ash[0]).rect(2, y + FACE - 2, VAN_NW - 2, 1, metal[3]);
  c.rect(1, y + FACE - 1, 4, 1, ink[0]).rect(VAN_NW - 3, y + FACE - 1, 4, 1, ink[0]);
}

/** The front face: lamps, the grille and the bumper above the wheel tips. */
function frontFace(c: PixelCanvas, y: number, livery: VanLivery): void {
  const { side } = livery;
  c.rect(1, y, VAN_NW, FACE, side[1]).rect(1, y, VAN_NW, 1, side[2]);
  c.rect(2, y + 2, 5, 3, bone[3]).rect(2, y + 4, 5, 1, bone[1]).rect(VAN_NW - 5, y + 2, 5, 3, bone[3]).rect(VAN_NW - 5, y + 4, 5, 1, bone[1]);
  c.rect(8, y + 2, 8, 4, ash[0]).rect(8, y + 3, 8, 1, ink[1]).rect(8, y + 5, 8, 1, ink[1]);
  c.rect(11, y + 7, 3, 1, metal[3]);
  c.rect(1, y + FACE - 3, VAN_NW, 1, ash[0]).rect(2, y + FACE - 2, VAN_NW - 2, 1, metal[3]);
  c.rect(1, y + FACE - 1, 4, 1, ink[0]).rect(VAN_NW - 3, y + FACE - 1, 4, 1, ink[0]);
}

/** A van nose-up or nose-down, unoutlined so markings can still go on. */
export function vanBodyN(livery: VanLivery, noseUp: boolean): PixelCanvas {
  const c = new PixelCanvas(VAN_NW + 2, VAN_NH);
  groundShadow(c, 2, VAN_NGROUND - 1, VAN_NW - 1, 3);
  if (noseUp) {
    bonnet(c, 1, livery, true);
    windscreen(c, 1 + BONNET, livery.roof);
    roofSlab(c, 1 + BONNET + SCREEN, livery, 14);
    tailFace(c, 1 + BONNET + SCREEN + ROOF, livery);
  } else {
    roofSlab(c, 1, livery, 5);
    windscreen(c, 1 + ROOF, livery.roof);
    bonnet(c, 1 + ROOF + SCREEN, livery, false);
    frontFace(c, 1 + ROOF + SCREEN + BONNET, livery);
    c.rect(2, 1, 3, 2, blood[2]).rect(VAN_NW - 3, 1, 3, 2, blood[2]);
  }
  return c;
}

export function bakeVanN(c: PixelCanvas): PixelSprite {
  c.outline({ selective: true });
  return bake(c, 1, VAN_NW, VAN_NGROUND);
}

/** The work van's cargo roof carries a patch of its own paint, like the side-on one. */
export function vanN(livery: VanLivery, noseUp: boolean): PixelSprite {
  const c = vanBodyN(livery, noseUp);
  const y = noseUp ? 1 + BONNET + SCREEN : 1;
  c.rect(15, y + 18, 5, 3, livery.side[2]).rect(16, y + 19, 3, 1, livery.side[0]);
  return bakeVanN(c);
}
