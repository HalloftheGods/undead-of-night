// Vehicles, drawn nose-left (or nose-up) as hand grids with the paint as letters, so one
// body serves any colour. The near side and wheels show below the top planes.

import type { PixelSprite } from '../types.ts';
import { PixelCanvas } from '../kit.ts';
import type { Legend } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Color, Ramp } from '../palette.ts';
import { bake, groundShadow } from './common.ts';

const { ink, metal, denim, wood, bone, fire, brick, blood } = RAMPS;

export function legend(paint: Ramp, glassDark: Color = denim[0], glassLit: Color = denim[1]): Legend {
  return {
    P: paint[2], p: paint[1], d: paint[0], k: ink[1], K: ink[0],
    g: glassDark, G: glassLit, m: metal[1], M: metal[2], c: metal[3],
    L: bone[3], l: bone[1], R: blood[2], r: blood[1], s: ink[1], f: paint[0],
  };
}

export const SEDAN = [
  '...............PPPPPPPPPPPPPPPP.............',
  '.............PPPPPPPPPPPPPPPPPPPP...........',
  '............gPPPPPPPPPPPPPPPPPPPPd..........',
  '...........gGPPpppppppppppppppppddg.........',
  '...ppppp..gGGPppppppppppppppppppppdgg..ppp..',
  '.ppPPPPPp.GGgPppppppppppppppppppppdggg.pppp.',
  '.pPPPPPPpgGggPppppppppppppppppppppdgggdppppp',
  'pPPPPPPppgGggPppppppppppppppppppppdgggdppppp',
  'pPPPPPpppggggpppppppppppppppppppppdgggdppppp',
  'pPPPPppppggggdddddddddddddddddddddggggdppppp',
  'pPPPpppdgggwwwwwwwwwwwwMwwwwwwwwwwwggddppppd',
  'pPPppppdggwwGGwwwwwwwwwMwwwwwGGwwwwwgdpppppd',
  'pPpppppddwwGGwwwwwwwwwwMwwwwGGwwwwwwwdppppdd',
  'dddddddddddddddddddddddddddddddddddddddddddd',
  'MPPPPPPPPPPPPPPPPPPPPPPdPPPPPPPPPPPPPPPPPPPd',
  'LLpppppppppppppppppppppdppppppppppppppppppRRd',
  'LLpppppppppppppppppppppdppppppppppppppppppRRd',
  'mpppppppppppppMpppppppdpppppMppppppppppppppdd',
  'cppppppppppppppppppppppdppppppppppppppppppppd',
  'ccdddddddddddddddddddddddddddddddddddddddddcc',
  'mmkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkmm',
].map((row) => row.replaceAll('w', 'g'));

export const WHEEL = [
  '.KKKKKKK.',
  'KKkkkkkKK',
  'KkkmmmkkK',
  'KkmMcMmkK',
  'KkkmmmkkK',
  'KKkkkkkKK',
  '.KKKKKKK.',
];

// The wreck reuses the sedan's bones with the glass burned out and the wheels gone.
const WRECK = [
  '...............ddpPPPPddPPPPdd..............',
  '.............ddpPPPPPPddpPPPpPPd............',
  '............KpppPPppdddpppPPpppdd...........',
  '...........KKppPdKKKKddppppppppddK..........',
  '.........KKKKppddKKKKKdppppppppdKKK.........',
  '..PPP....KKKKppdKKKKKKddpppppppdKKKK...ppd..',
  '.PPPPP..KKmKKppddKKKddppppppppddKKmKKdpppd..',
  'pPPPPPPKKKKmKpppdddddppppppppppdKKKmKdppppp.',
  'pPPpppdKKmKKKdpppppppppppppppdddKKKKKdppdpp.',
  'ppddKKKKKKKKKdddddddddddddddddddKKKKKdddKdpp',
  'pdKKKppdKKKKKKKKKKKKKKKdKKKKKKKKKKKKddppdppd',
  'pdddppddKKmKKKKmKKKKKKKdKKKmKKKKKmKKdpppdppd',
  'ppppppddKKKKKKKKKKKKKKKdKKKKKKKKKKKKKdpppppd',
  'dddddddddddddddddddddddddddddddddddddddddddd.',
  'PPPPPPdPPPPPPPPPPPPPPPddPPPPPdPPPPPPPPPPPd..',
  'pppppddpppppppppppKKKppdppppddppppppppppKKd..',
  'KKpppddpppppppppppKKKppdpppddpppppppppppKKd..',
  'KKppddppppppddppppppppdpppdppppppppppppppdd..',
  '.pppdpppppddppppppppppdpppppppppppppppppppd..',
  '.ddddddddddddddddddddddddddddddddddddddddd...',
];

const BARE_RIM = [
  '..KKKKK..',
  '.KmmMmmK.',
  'KmKKKKKmK',
  'KmKmMmKmK',
  '.KKKKKKK.',
];

const SEDAN_W = 44;
/** Where a side-on car's footprint ends, and so where its wheels and shadow sit. */
export const SIDE_GROUND = 26;

/**
 * A car seen side-on from a grid of its body, with the arches cut and the wheels set in them.
 * Left unoutlined, so a livery can still be painted over it.
 */
export function sideOnBody(rows: readonly string[], w: number, wheelsAt: readonly number[], paint: Ramp): PixelCanvas {
  const c = new PixelCanvas(w + 2, 30);
  groundShadow(c, 2, SIDE_GROUND - 1, w - 1, 3);
  const legendFor = legend(paint);
  c.grid(1, 1, rows, legendFor);
  // Arches first, then wheels in them.
  for (const x of wheelsAt) {
    c.rect(x + 1, 16, 9, 6, ink[0]).rect(x, 18, 11, 4, ink[0]);
    c.grid(x + 1, SIDE_GROUND - 7, WHEEL, legendFor);
  }
  return c;
}

/** Outlines a finished side-on car and anchors it on its footprint. */
export function bakeSideOn(c: PixelCanvas, w: number): PixelSprite {
  c.outline({ selective: true });
  return bake(c, 1, w, SIDE_GROUND);
}

export const STEEL: Ramp = [metal[0], metal[1], metal[2]];

export function buildSedanH(paint: Ramp = STEEL): PixelSprite {
  return bakeSideOn(sideOnBody(SEDAN, SEDAN_W, [5, 30], paint), SEDAN_W);
}

export const RUST: Ramp = [brick[0], brick[1], brick[2]];

export function buildWreckH(): PixelSprite {
  const c = new PixelCanvas(SEDAN_W + 2, 30);
  const ground = SIDE_GROUND;
  groundShadow(c, 2, ground - 1, SEDAN_W - 3, 3);
  const legendFor = legend(RUST, ink[0], ink[0]);
  c.grid(1, 3, WRECK, legendFor);
  c.grid(6, ground - 5, BARE_RIM, legendFor);
  c.grid(31, ground - 5, BARE_RIM, legendFor);
  // Flaking orange where the paint burned away, soot where the fire vented.
  for (const [x, y, w] of [[19, 4, 3], [24, 7, 5], [6, 10, 3], [28, 18, 6], [8, 19, 5], [38, 20, 2]] as const) c.rect(x, y, w, 1, wood[2]);
  for (const [x, y, w] of [[15, 16, 5], [33, 7, 5], [2, 11, 3], [40, 8, 3]] as const) c.rect(x, y, w, 1, ink[1]);
  c.rect(22, 21, 4, 1, fire[0]);
  return bakeSideOn(c, SEDAN_W);
}

export const SEDAN_V_W = 20;

// Nose up, tail to the camera: hood, windscreen, roof, rear glass, boot, then the tail.
export const SEDAN_V = [
  '....LLppppppppLL....',
  '..dpPPPPPPPPpppppd..',
  '.dpPPPPPPPPPPppppdd.',
  '.dpPPPPPPPPPpppppdd.',
  'KdpPPPPPPPPppppppddK',
  'KdpPPPPPppppppppppdK',
  'KdpPPPPppppppppppddK',
  'KdpPPpppppppppppppdK',
  'KdpPppppppppppppppdK',
  'KdpPppppppppppppppdK',
  '.dppppppppppppppppd.',
  '.dpppppppppppppppdd.',
  '.dpggggggggggggggdd.',
  '.dgGGggggggggGgggdd.',
  '.dggGGggggggGGgggdd.',
  '.dgggGGggggGGggggdd.',
  '.dgggggggggggggggdd.',
  '.dgggggggggggggggdd.',
  '.dddddddddddddddddd.',
  '.dgPPPPPPPPppppppgd.',
  '.dgPPPPPPPpppppppgd.',
  '.dgPPPPPPppppppppgd.',
  '.dgPPPPpppppppppdgd.',
  '.dgPPpppppppppppdgd.',
  '.dgPppppppppppppdgd.',
  '.dgPppppppppppppdgd.',
  '.dgppppppppppppddgd.',
  '.dgppppppppppppddgd.',
  '.dgppppppppppppddgd.',
  '.ddddddddddddddddgd.',
  '.dggggggggggggggggd.',
  '.dgGGgggggggGGggggd.',
  'KdggGGgggggggGGgggdK',
  'KdgggggggggggggggddK',
  'KdddddddddddddddddrK',
  'KdpPPPPPPpppppppppdK',
  'KdpPPPPPpppppppppddK',
  'KdpPPPppppppppppppdK',
  'KdpPppppppppppppppdK',
  '.dddddddddddddddddd.',
  '.PPPPPPPPPPPPPPPPpd.',
  '.RRRppppppppppppRRd.',
  '.RRrppMMMMMMpppprRd.',
  '.pppppppppppppppppd.',
  '.McccccccccccccccMd.',
  '.KKKkkkkkkkkkkkkKKK.',
  '.KKK............KKK.',
];

/** A car nose-up from a grid of its body, unoutlined so a livery can still go on. */
export function noseUpBody(rows: readonly string[], paint: Ramp): PixelCanvas {
  const c = new PixelCanvas(SEDAN_V_W + 2, rows.length + 4);
  groundShadow(c, 2, rows.length, SEDAN_V_W - 1, 3);
  c.grid(1, 1, rows, legend(paint));
  return c;
}

export function bakeNoseUp(c: PixelCanvas, rows: readonly string[]): PixelSprite {
  c.outline({ selective: true });
  return bake(c, 1, SEDAN_V_W, rows.length + 1);
}

export function buildSedanV(paint: Ramp = RUST): PixelSprite {
  return bakeNoseUp(noseUpBody(SEDAN_V, paint), SEDAN_V);
}
