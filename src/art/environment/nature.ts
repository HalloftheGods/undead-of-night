// Things that are not square: the dead tree, scrub and rubble. Clumps and chunks are
// hand-drawn stamps placed one by one, so nothing here is a generated blob.

import type { PixelSprite } from '../types.ts';
import { PixelCanvas } from '../kit.ts';
import type { Legend } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import { bake } from './common.ts';

const { ink, wood, olive, grass, concrete, brick, metal, asphalt } = RAMPS;

const LEAVES: Legend = { h: olive[1], a: grass[2], d: grass[1], s: grass[0], w: wood[2] };

const CLUMP_L = [
  '....ha.h....',
  '..hhaaha.a..',
  '.hhaaaahaaa.',
  'haahaaaaaadd',
  'haaaaaaadddd',
  '.aaadaddddds',
  '..addddsdss.',
  '...d.ds.s...',
];

const CLUMP_M = [
  '..ha.h..',
  '.hhaaaa.',
  'haahaadd',
  'aaaaddds',
  '.addsds.',
  '..d..s..',
];

const CLUMP_S = [
  '.ha.',
  'haad',
  'adds',
  '.s..',
];

type Limb = readonly [number, number, number, number, number];

// x0, y0, x1, y1, thickness, from the trunk outwards.
const LIMBS: readonly Limb[] = [
  [26, 44, 16, 30, 3],
  [16, 30, 8, 25, 2],
  [16, 30, 13, 18, 2],
  [8, 25, 2, 26, 1],
  [8, 25, 5, 17, 1],
  [13, 18, 9, 10, 1],
  [13, 18, 19, 11, 1],
  [28, 40, 36, 26, 3],
  [36, 26, 44, 20, 2],
  [36, 26, 34, 13, 2],
  [44, 20, 50, 21, 1],
  [44, 20, 47, 12, 1],
  [34, 13, 29, 6, 1],
  [34, 13, 39, 5, 1],
  [27, 38, 25, 20, 2],
  [25, 20, 22, 8, 1],
  [25, 20, 28, 12, 1],
];

function limb(c: PixelCanvas, [x0, y0, x1, y1, thick]: Limb): void {
  for (let i = 0; i < thick; i++) c.line(x0 + i, y0, x1 + i, y1, i === 0 ? wood[2] : wood[1]);
  const isThickLimb = thick > 1;
  if (isThickLimb) c.line(x0 + thick - 1, y0, x1 + thick - 1, y1, wood[0]);
}

export function buildTree(): PixelSprite {
  const c = new PixelCanvas(56, 72);
  const ground = 68;
  const trunkX = 22;
  // Root shadow, kept tight round the footprint.
  c.ellipse(29, ground - 1, 11, 3, ink[1]);
  c.grid(trunkX - 3, ground - 31, [
    '.....hwwwwd.....',
    '.....hwwwwd.....',
    '.....hwwwdd.....',
    '.....hhwwdd.....',
    '.....hwwwdd.....',
    '.....hwwwwd.....',
    '....hhwwwwdd....',
    '....hhwwkwdd....',
    '....hwwwkkdd....',
    '....hwwwkkdd....',
    '....hwwwwkdd....',
    '....hhwwwwdd....',
    '....hhwwwwdd....',
    '....hwwwwwdd....',
    '....hwwdwwdd....',
    '....hwwdwwdd....',
    '....hwwddwdd....',
    '....hwwwdwdd....',
    '....hhwwwwdd....',
    '....hhwwwwdd....',
    '....hwwwwwwdd...',
    '...hhwwwdwwdd...',
    '...hwwwwdwwwdd..',
    '...hwwwwddwwdd..',
    '..hhwwwdwddwwdd.',
    '..hwwwdwwwdwwdd.',
    '.hhwwdwwwwdwwwdd',
    'hhwwwdwwwwwdwwwd',
    'hwwwdd.wwd.ddwdd',
    'ddd.....d.....dd',
  ], { h: wood[2], w: wood[1], d: wood[0], k: ink[1] });

  // Three crown masses with air between them, so the limbs still show as a dying tree.
  const behind: readonly (readonly [number, number])[] = [[2, 20], [38, 12], [14, 8], [5, 11], [12, 16], [24, 7], [33, 4], [32, 14], [41, 19]];
  for (const [x, y] of behind) c.grid(x, y, y < 12 ? CLUMP_L : CLUMP_M, LEAVES);
  LIMBS.forEach((part) => limb(c, part));
  c.grid(2, 14, CLUMP_L, LEAVES);
  c.grid(36, 22, CLUMP_L, LEAVES);
  c.grid(23, 2, CLUMP_L, LEAVES);
  c.grid(42, 12, CLUMP_M, LEAVES);
  c.grid(11, 24, CLUMP_M, LEAVES);
  c.grid(9, 9, CLUMP_M, LEAVES);
  c.grid(30, 16, CLUMP_S, LEAVES);
  c.grid(7, 6, CLUMP_S, LEAVES);
  c.grid(48, 18, CLUMP_S, LEAVES);
  c.outline({ selective: true });
  return bake(c, 23, 12, ground);
}

export function buildBush(): PixelSprite {
  const c = new PixelCanvas(30, 20);
  const ground = 18;
  c.ellipse(15, ground - 1, 12, 2, ink[1]);
  c.grid(2, 8, CLUMP_L, LEAVES);
  c.grid(16, 7, CLUMP_L, LEAVES);
  c.grid(8, 3, CLUMP_L, LEAVES);
  c.grid(11, 11, CLUMP_M, LEAVES);
  // Bare twigs breaking the crown.
  c.line(6, 7, 4, 4, wood[1]).line(24, 6, 27, 3, wood[1]).line(15, 3, 16, 1, wood[1]);
  c.outline({ selective: true });
  return c.toSprite(c.w, c.h, 15, ground);
}

const CHUNK: Legend = { h: concrete[2], a: concrete[1], b: concrete[0], c: asphalt[2], k: ink[1], r: brick[2], R: brick[1], q: brick[0], s: metal[1] };

// Broken slabs with flat tops and raw edges, half-bricks and a twist of rebar.
const RUBBLE = [
  '.........s....................',
  '..........s.....s.............',
  '..........s....s......hhh.....',
  '.......hhhhh..s.....hhaaah....',
  '.....hhaaaaah.s...hhaaaaaah...',
  '...hhaaaaaaaah...haaaaaaaah...',
  '..haaaaaaaaaabb..baaaaaaabb.r.',
  '..bbaaaaaabbbcc..cbbaaabbcc.Rq',
  '...cbbbbbcccck..rcccbbbcck..qq',
  '.rr.ccccckk.....Rq.kccck.hha..',
  'rRRq.kkk...hhha.qq......haaab.',
  'qRqq.....hhaaabbk.rr....bbbcc.',
  '.qq......bbbbccck.RRq....ccck.',
  '..........kkkkk...qq.....kkk..',
];

export function buildRubble(): PixelSprite {
  const c = new PixelCanvas(32, 16);
  c.grid(1, 1, RUBBLE, CHUNK);
  c.outline({ selective: true });
  return c.toSprite(c.w, c.h, 16, 15);
}
