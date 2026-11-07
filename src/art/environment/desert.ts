// The dry-country props: a saguaro, a dead tree and a sagebrush tuft. Trunks, limbs and
// tufts are hand-drawn stamps placed one by one, so nothing here is generated.

import type { PixelSprite } from '../types.ts';
import { PixelCanvas } from '../kit.ts';
import type { Legend } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import { bake } from './common.ts';

const { ink, wood, olive, rot, ash, bone } = RAMPS;

// Sun-bleached green: the lit rib fades to olive, the shade stays a cold dark green.
const FLESH: Legend = { H: olive[2], g: rot[2], m: olive[1], d: rot[1], D: rot[0], s: bone[2], b: bone[1], k: ink[1] };

export function buildCactus(): PixelSprite {
  // The trunk's root row sits on y 41, so the ground line (and its shadow) is right under it.
  const c = new PixelCanvas(24, 46);
  const ground = 42;
  c.ellipse(12, ground - 1, 9, 2, ink[1]);

  // Arms first, so the trunk overlaps their roots. Left arm: out, then up.
  c.grid(1, 15, [
    '.HgD....',
    'HgsD....',
    'HgdD....',
    'HggD....',
    'HgdD....',
    'HgsD....',
    'HgdD....',
    'HggD....',
    'HgdD....',
    'HgdD....',
    'HgdD....',
    'HggD....',
    'HmdD....',
    'HHggdddd',
    'HggggdDD',
    'HgggdDD.',
    'DDDDDD..',
  ], FLESH);
  // Right arm: shorter, springing higher.
  c.grid(15, 8, [
    '....HgD.',
    '....HdD.',
    '....HdD.',
    '....HsD.',
    '....HgD.',
    '....HdD.',
    '....HdD.',
    '....HmD.',
    '....HdD.',
    '....HgD.',
    '....HdD.',
    '....HdD.',
    'gggggHgD',
    'ggggggdD',
    'dddddDD.',
  ], FLESH);

  // Ribbed trunk, eight wide: a bleached lit rib on the left, deep shade on the right.
  const top = ['..HHgg..', '.HHggdD.', '.HgggdD.', 'HHgdgddD'];
  const rows = [
    'HgggdgdD', 'HgmgdgdD', 'HggsdgdD', 'HggmdgdD', 'HgggdsdD', 'HHggdgdD', 'HgggdgdD', 'HmggdgdD',
    'HggbdgdD', 'HgggdgdD', 'HHggdgdD', 'HgsgdgdD', 'HgggdmdD', 'HgggdgdD', 'HHggdgdD', 'HgggdgdD',
    'HgggdgdD', 'HgmgdgdD', 'HggsdgdD', 'HHggdgdD', 'HgggdgdD', 'HgggbgdD', 'HHggdgdD', 'HgggdgdD',
    'HgsgdgdD', 'HgggdgdD', 'HHggdmdD', 'HgggdgdD', 'HgggdgdD', 'HmggdgdD', 'HgggdgdD', 'HHgsdgdD',
    'HgggdgdD', 'DgggdgdD',
  ];
  c.grid(8, 3, [...top, ...rows, 'DDddddDD'], FLESH);
  // A couple of long spines catching the light.
  c.px(7, 20, bone[3]).px(16, 30, bone[3]).px(7, 34, bone[2]).px(16, 5, bone[2]);
  c.outline({ selective: true });
  return bake(c, 8, 8, ground);
}

const BARK: Legend = { h: ash[2], w: wood[2], m: wood[1], d: wood[0], a: ash[1], k: ink[1] };

type Limb = readonly [number, number, number, number, number];

// x0, y0, x1, y1, thickness, trunk outwards. Every limb forks or snaps; none ends in leaves.
const LIMBS: readonly Limb[] = [
  [20, 36, 12, 26, 3],
  [12, 26, 6, 22, 2],
  [12, 26, 14, 12, 2],
  [6, 22, 2, 23, 1],
  [6, 22, 4, 13, 1],
  [14, 12, 10, 5, 1],
  [14, 12, 19, 8, 1],
  [24, 32, 32, 24, 3],
  [32, 24, 40, 20, 2],
  [32, 24, 31, 11, 2],
  [40, 20, 44, 21, 1],
  [31, 11, 27, 4, 1],
  [31, 11, 36, 6, 1],
  [22, 30, 22, 14, 2],
  [22, 14, 24, 7, 1],
];

function limb(c: PixelCanvas, [x0, y0, x1, y1, thick]: Limb): void {
  for (let i = 0; i < thick; i++) c.line(x0 + i, y0, x1 + i, y1, i === 0 ? ash[2] : wood[2]);
  const isThickLimb = thick > 1;
  if (isThickLimb) c.line(x0 + thick - 1, y0, x1 + thick - 1, y1, wood[1]);
}

export function buildDeadTree(): PixelSprite {
  const c = new PixelCanvas(48, 66);
  const ground = 62;
  c.ellipse(24, ground - 1, 9, 2, ink[1]);
  LIMBS.forEach((part) => limb(c, part));
  // Snapped stubs, broken off short and splintered white.
  c.rect(19, 28, 1, 5, ash[2]).rect(18, 28, 1, 2, bone[2]);
  c.rect(27, 38, 4, 2, wood[2]).px(31, 37, bone[2]);
  c.rect(16, 42, 3, 2, wood[1]).px(15, 42, bone[1]);
  // Gnarled trunk, twisting and split: a knothole, a bark seam and a bare root flare.
  c.grid(18, ground - 33, [
    '....hwd.....',
    '....hwd.....',
    '...hhwmd....',
    '...hwwmd....',
    '...hwwmd....',
    '...hhwwmd...',
    '...hwwwmd...',
    '...hwwwmd...',
    '...hhwwd....',
    '...hwwwdd...',
    '...hwwwmd...',
    '..hhwkkmdd..',
    '..hwwkkmdd..',
    '..hwwwmmdd..',
    '..hhwwmdd...',
    '...hwwmddd..',
    '..hhwwwmdd..',
    '..hwwwmmdd..',
    '..hwwmmdkd..',
    '..hwwwmddd..',
    '..hhwmmddd..',
    '..hwwwmmdd..',
    '.hhwwmmdddd.',
    '.hwwwmmmddd.',
    '.hwwamdmmdd.',
    '.hwwmmdmwdd.',
    '.hhwmmdmwwdd',
    'hhwwmdd.mwdd',
    'hwwmdd..mmwd',
    'hwwdd....ddd',
    'hmdd.....dd.',
    'dd.........d',
  ], BARK);
  c.outline({ selective: true });
  return bake(c, 19, 10, ground);
}

const TUFT: Legend = { h: bone[2], s: bone[1], a: olive[2], o: olive[1], d: olive[0], w: wood[2], k: ink[1] };

export function buildScrub(): PixelSprite {
  const c = new PixelCanvas(24, 16);
  const ground = 14;
  c.ellipse(12, ground - 1, 9, 1, ink[1]);
  // Dry twigs fanning out of the root, then tufts of grey sage over them.
  c.line(12, 13, 4, 6, wood[1]).line(12, 13, 18, 4, wood[1]).line(12, 13, 12, 3, wood[1]).line(12, 13, 21, 9, wood[2]);
  c.grid(1, 5, [
    '..sa..',
    '.saao.',
    'saaood',
    '.oodd.',
  ], TUFT);
  c.grid(14, 3, [
    '..ha..',
    '.haaao',
    'saaooo',
    'aaoodd',
    '.oodd.',
  ], TUFT);
  c.grid(7, 2, [
    '..sh..',
    '.haaa.',
    'saaaoo',
    'aaoooo',
    'aooodd',
    '.oodd.',
  ], TUFT);
  c.grid(5, 8, [
    'saaaaaa..',
    'aaooooo..',
    'ooooooodd',
    '.oodddd..',
  ], TUFT);
  c.outline({ selective: true });
  return c.toSprite(c.w, c.h, 12, ground);
}
