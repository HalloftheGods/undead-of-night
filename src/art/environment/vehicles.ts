// Vehicles, drawn nose-left (or nose-up) as hand grids with the paint as letters, so one
// body serves any colour. The near side and wheels show below the top planes.

import type { Clip, PixelSprite } from '../types.ts';
import { makeClip, PixelCanvas } from '../kit.ts';
import type { Legend } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Color, Ramp } from '../palette.ts';
import { bake, groundShadow } from './common.ts';

const { ink, metal, denim, wood, bone, fire, brick, blood, ash } = RAMPS;

function legend(paint: Ramp, glassDark: Color = denim[0], glassLit: Color = denim[1]): Legend {
  return {
    P: paint[2], p: paint[1], d: paint[0], k: ink[1], K: ink[0],
    g: glassDark, G: glassLit, m: metal[1], M: metal[2], c: metal[3],
    L: bone[3], l: bone[1], R: blood[2], r: blood[1], s: ink[1],
  };
}

const SEDAN = [
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

const WHEEL = [
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

function sedanBody(paint: Ramp): PixelCanvas {
  const c = new PixelCanvas(SEDAN_W + 2, 30);
  const ground = 26;
  groundShadow(c, 2, ground - 1, SEDAN_W - 1, 3);
  const legendFor = legend(paint);
  c.grid(1, 1, SEDAN, legendFor);
  // Arches first, then wheels in them.
  for (const x of [5, 30]) {
    c.rect(x + 1, 16, 9, 6, ink[0]).rect(x, 18, 11, 4, ink[0]);
    c.grid(x + 1, ground - 7, WHEEL, legendFor);
  }
  return c;
}

export function buildSedanH(): PixelSprite {
  const c = sedanBody([metal[0], metal[1], metal[2]]);
  c.outline({ selective: true });
  return bake(c, 1, SEDAN_W, 26);
}

const RUST: Ramp = [brick[0], brick[1], brick[2]];

export function buildWreckH(): PixelSprite {
  const c = new PixelCanvas(SEDAN_W + 2, 30);
  const ground = 26;
  groundShadow(c, 2, ground - 1, SEDAN_W - 3, 3);
  const legendFor = legend(RUST, ink[0], ink[0]);
  c.grid(1, 3, WRECK, legendFor);
  c.grid(6, ground - 5, BARE_RIM, legendFor);
  c.grid(31, ground - 5, BARE_RIM, legendFor);
  // Flaking orange where the paint burned away, soot where the fire vented.
  for (const [x, y, w] of [[19, 4, 3], [24, 7, 5], [6, 10, 3], [28, 18, 6], [8, 19, 5], [38, 20, 2]] as const) c.rect(x, y, w, 1, wood[2]);
  for (const [x, y, w] of [[15, 16, 5], [33, 7, 5], [2, 11, 3], [40, 8, 3]] as const) c.rect(x, y, w, 1, ink[1]);
  c.rect(22, 21, 4, 1, fire[0]);
  c.outline({ selective: true });
  return bake(c, 1, SEDAN_W, 26);
}

const SEDAN_V_W = 20;

// Nose up, tail to the camera: hood, windscreen, roof, rear glass, boot, then the tail.
const SEDAN_V = [
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

export function buildSedanV(): PixelSprite {
  const c = new PixelCanvas(SEDAN_V_W + 2, SEDAN_V.length + 4);
  const ground = SEDAN_V.length + 1;
  groundShadow(c, 2, ground - 1, SEDAN_V_W - 1, 3);
  c.grid(1, 1, SEDAN_V, legend(RUST));
  c.outline({ selective: true });
  return bake(c, 1, SEDAN_V_W, ground);
}

const VAN_W = 52;

export function buildVan(): PixelSprite {
  const c = new PixelCanvas(VAN_W + 2, 42);
  const ground = 38;
  const side = 15;
  const sill = 31;
  groundShadow(c, 2, ground - 1, VAN_W - 1, 3);

  // Roof: one flat slab, with ribs and a roof vent.
  c.poly([[15, 1], [52, 1], [52, side - 1], [11, side - 1]], ash[1]);
  c.rect(15, 1, 38, 1, ash[2]);
  c.line(14, 2, 12, side - 2, ash[2]);
  for (const x of [24, 33, 42]) c.rect(x, 2, 1, side - 3, ash[0]);
  c.rect(44, 4, 6, 6, metal[1]).rect(44, 4, 6, 1, metal[2]).rect(45, 5, 4, 1, metal[0]);
  c.rect(11, side - 1, 42, 1, ink[1]);

  // Screen, then the stub of a bonnet.
  c.poly([[15, 1], [11, side - 1], [5, side + 3], [8, 7]], denim[0]);
  c.line(14, 3, 9, 10, denim[1]).line(13, 3, 8, 10, denim[1]).line(12, 7, 8, 13, denim[1]);
  c.line(15, 1, 8, 7, ash[1]).line(8, 7, 5, side + 3, ash[1]);
  c.poly([[1, 15], [7, 9], [5, side + 3], [1, side + 4]], ash[1]);
  c.line(1, 15, 7, 9, ash[2]);

  // The slab side, a tone down from the roof that faces the light.
  c.rect(1, side, VAN_W, sill - side, metal[1]);
  c.rect(1, side, VAN_W, 1, ash[1]);
  // Cab door and window.
  c.rect(8, side + 1, 13, 7, denim[0]).rect(8, side + 1, 13, 1, ink[1]);
  c.line(11, side + 7, 15, side + 2, denim[1]).line(12, side + 7, 16, side + 2, denim[1]);
  c.rect(7, side, 1, sill - side, ash[0]).rect(21, side, 1, sill - side, ash[0]);
  c.rect(16, side + 9, 3, 1, metal[3]);
  // Cargo: sliding door rail, a faded band and an invented mark.
  c.rect(22, side + 3, 31, 1, ash[0]);
  c.rect(36, side + 1, 1, sill - side - 1, ash[0]);
  c.rect(22, side + 8, 31, 3, blood[1]).rect(22, side + 8, 31, 1, blood[2]);
  c.rect(26, side + 4, 6, 3, ash[1]).rect(27, side + 5, 4, 1, ash[0]);
  c.rect(30, side + 12, 4, 1, wood[2]).rect(29, side + 13, 6, 1, wood[1]);
  c.rect(45, side + 11, 2, 4, wood[1]);
  // Lamps and bumper.
  c.rect(1, side + 3, 3, 3, bone[3]).rect(1, side + 5, 3, 1, bone[1]);
  c.rect(VAN_W - 1, side + 2, 2, 5, blood[2]);
  c.rect(1, sill, VAN_W, 2, ash[0]);
  c.rect(1, sill + 1, 7, 2, metal[2]).rect(VAN_W - 4, sill + 1, 5, 2, metal[2]);

  const wheels = legend(ash);
  for (const x of [8, 39]) {
    c.rect(x, sill - 4, 11, 6, ink[0]);
    c.grid(x + 1, ground - 7, WHEEL, wheels);
  }
  // Dirt thrown up over the sills.
  for (const [x, y, w] of [[2, 30, 5], [20, 30, 18], [23, 29, 4], [31, 29, 3], [50, 30, 3]] as const) c.rect(x, y, w, 1, ash[0]);
  c.outline({ selective: true });
  return bake(c, 1, VAN_W, ground);
}

/** Hazard lights over the escape van, blinking so it can be picked out of the dark. */
export function buildEscapeVanLights(): Clip {
  const frame = (lit: boolean): PixelSprite => {
    const c = new PixelCanvas(VAN_W + 2, 42);
    const lamp = lit ? fire[3] : fire[0];
    c.rect(3, 22, 3, 3, lamp).rect(VAN_W - 4, 22, 3, 3, lamp);
    return bake(c, 1, VAN_W, 38);
  };
  return makeClip([frame(true), frame(false)], 2);
}
