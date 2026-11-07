// Ground pickups. Each one hovers over the shadow the renderer draws at its anchor,
// bobbing on a four frame cycle. Every second cycle a glint runs across its lit corner.

import type { PickupType } from '../../../shared/protocol.ts';
import type { Clip } from '../types.ts';
import { makeClip, PixelCanvas } from '../kit.ts';
import type { Legend } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import { KIT_ART } from './kits.ts';
import { PART_ART } from './parts.ts';
import { JEWEL_LARGE, JEWEL_SMALL, TREASURE_LEGEND } from './treasure.ts';
import type { Grid } from './shared.ts';

const { blood, bone, fire, ink, metal, olive, wood } = RAMPS;

const CELL_W = 32;
const CELL_H = 26;
const ANCHOR_X = 16;
const ANCHOR_Y = 25;
/** The gap between the shadow and the item at the bottom of its bob. */
const HOVER = 4;
const FPS = 7;

const BOB = [0, 1, 2, 1, 0, 1, 2, 1];
const GLINT_SIZE = [0, 0, 1, 2, 1, 0, 0, 0];

const ITEM: Legend = {
  k: ink[0], K: ink[1],
  e: bone[3], f: bone[2], g: bone[1], h: bone[0],
  r: blood[0], s: blood[1], t: blood[2], u: blood[3],
  m: metal[0], n: metal[1], o: metal[2], p: metal[3],
  a: olive[0], b: olive[1], c: olive[2],
  w: wood[0], x: wood[1], y: wood[2], z: wood[3],
  Y: fire[3], B: fire[2], C: fire[1], D: fire[0],
  ...TREASURE_LEGEND,
};

const GLINTS: readonly Grid[] = [
  ['.Y.', 'YeY', '.Y.'],
  ['..e..', '..e..', 'eeeee', '..e..', '..e..'],
];

const MEDKIT: Grid = [
  '....nooooon....',
  '....n.....n....',
  '.feeeeeeeeeeff.',
  'feeeeeuttseeeff',
  'feeeeeuttseeeff',
  'feuuuuttttttseg',
  'fetttttttttsseg',
  'feeeeeuttseeefg',
  'feeeeeutsseeefg',
  'fffffffffffffgg',
  'ggggggoppogggggh',
  'tttttoppoottttss',
  'hhhhhhhhhhhhhhh',
];

/** Rolled gauze, end on, with a tan tape tail. */
export const BANDAGE: Grid = [
  '..eeeeee....',
  '.effffffg...',
  'efgggggghg..',
  'efg.kk.ghhzz',
  'efg.kk.ghzzz',
  'efgggggghg.z',
  '.fhhhhhhh...',
  '..hhhhhh....',
];

/** Small tan box, brass bullet tips showing. Wide and low. */
export const PISTOL_AMMO: Grid = [
  '.YB.YB.YB.',
  '.BzBBzBBz.',
  'zzzzzzzzzz',
  'yeeeeyyyyx',
  'yeeeeyyyyx',
  'yyyyyyyyyx',
  'xxxxxxxxxx',
];

/** Olive rifle magazine standing upright. Tall and narrow. */
export const CARBINE_AMMO: Grid = [
  '.YBYB...',
  '.ommmo..',
  '.cccccb.',
  '.cfcccb.',
  '.cbbbbb.',
  '.cccccb.',
  '.cccccb.',
  '..cbbbb.',
  '..cccbb.',
  '..bbbba.',
  '..mnnnm.',
  '..oppo..',
];

/** Red shell box: round hull tops over brass bases. */
export const SHELLS: Grid = [
  '.ss.ss.ss.ss.',
  '.ut.ut.ut.ut.',
  '.tt.tt.tt.tt.',
  '.BY.BY.BY.BY.',
  'rrrrrrrrrrrrr',
  'rtttttttttttt',
  'rteeetttttttt',
  'rtttttttttttt',
  'ssssssssssss.',
];

const CARBINE: Grid = [
  '.......oooooo...........',
  'nn....opppppppcccccc.o..',
  'onnnnnopooooooccbcbbnppp',
  'on.nnnnnnnnnnnbbbbbbannn',
  'onn...mnmmmnnm..........',
  'nn....mnm.nom...........',
  '......mm..nom...........',
  '...........nm...........',
];

const SHOTGUN: Grid = [
  '.........oooo..............',
  'zy......ppppppppppppppppppp',
  'zyyxx.xnoooooooooooooooooon',
  'yyyyxxxxnnnnzzzzyyyynnnnnnn',
  'yyxxxxw.nmm.yyxxxxw........',
  'xxxw....mm.................',
];

/** A kitchen knife lying flat: wood grip, steel guard, and the blade running to a point. */
const KNIFE: Grid = [
  '.......nnooopp..',
  'zyyyyxmnpppppppp',
  'xxxxxwmnoooooo..',
  '.......n........',
];

/** A pocket radio: olive case, a speaker grille, a lit dial with a red needle, two knobs and a bent aerial. */
const RADIO: Grid = [
  '...........p....',
  '..........p.....',
  '.........p......',
  '.cccccccccccccc.',
  'cbbbbbbbbbbbbbba',
  'cbmnmnmbeeeeeeba',
  'cbnmnmnbefffrfba',
  'cbmnmnmbeeeeeeba',
  'cbnmnmnbbbbbbbba',
  'cbmnmnmbbpbbpbba',
  'cbbbbbbbbbbbbbba',
  'aaaaaaaaaaaaaaaa',
];

interface ItemSpec {
  readonly rows: Grid;
  /** Where the glint sits, relative to the item. */
  readonly glint: readonly [number, number];
}

const ITEMS: Record<PickupType, ItemSpec> = {
  medkit: { rows: MEDKIT, glint: [2, 2] },
  bandage: { rows: BANDAGE, glint: [3, 1] },
  pistol_ammo: { rows: PISTOL_AMMO, glint: [2, 1] },
  carbine_ammo: { rows: CARBINE_AMMO, glint: [2, 2] },
  shells: { rows: SHELLS, glint: [3, 1] },
  carbine: { rows: CARBINE, glint: [8, 1] },
  shotgun: { rows: SHOTGUN, glint: [10, 1] },
  knife: { rows: KNIFE, glint: [11, 1] },
  radio: { rows: RADIO, glint: [2, 3] },
  ...PART_ART,
  ...KIT_ART,
  jewel_small: { rows: JEWEL_SMALL, glint: [1, 1] },
  jewel_large: { rows: JEWEL_LARGE, glint: [3, 1] },
};

function frame({ rows, glint }: ItemSpec, index: number): PixelCanvas {
  const w = Math.max(...rows.map((row) => row.length));
  const x = ANCHOR_X - Math.floor(w / 2);
  const y = ANCHOR_Y - HOVER - rows.length - BOB[index];
  const canvas = new PixelCanvas(CELL_W, CELL_H).grid(x, y, rows, ITEM).outline({ color: ink[0] });
  const size = GLINT_SIZE[index];
  const hasGlint = size > 0;
  if (hasGlint) {
    const stamp = GLINTS[size - 1];
    canvas.grid(x + glint[0] - size, y + glint[1] - size, stamp, ITEM);
  }
  return canvas;
}

function clip(spec: ItemSpec): Clip {
  const frames = BOB.map((_, i) => frame(spec, i).toSprite(CELL_W, CELL_H, ANCHOR_X, ANCHOR_Y));
  return makeClip(frames, FPS, true);
}

export function buildPickupClips(): Record<PickupType, Clip> {
  const clips = {} as Record<PickupType, Clip>;
  for (const type of Object.keys(ITEMS) as PickupType[]) clips[type] = clip(ITEMS[type]);
  return clips;
}
