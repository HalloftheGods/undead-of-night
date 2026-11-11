// Gun parts: workbench loot on the floor and in the icons. Letters are the pickup legend.

import type { PartId } from '../../../shared/gun-upgrade-data.ts';
import type { Grid } from './shared.ts';

/** A bare steel barrel with a front sight and a threaded muzzle. */
const BARREL: Grid = [
  '...........p.',
  'ooo.....nnnpn',
  'opppppppppmpm',
  'onooooooonmom',
  'mnnnnnnnnnmnm',
  'mmm.....mmmmm',
];

/** The earlier drawing of BARREL, kept to switch back to. */
export const BARREL_OLD: Grid = [
  '..........p..',
  'oopppppppppoo',
  'onnnooooonnon',
  'mnnnnnnnnnnmn',
  '.mmmmmmmmmmm.',
];

/** A checkered wooden pistol grip, cut off at the frame. */
const GRIP: Grid = [
  '.nnnnnnn.',
  '.xyzyzyz.',
  '.xzyzyzy.',
  '.xyzyzyy.',
  'xzyzyzy..',
  'xyzyzyy..',
  'xzyzyy...',
  'wxyyy....',
  '.wwx.....',
];

/** A steel box magazine with brass showing at the lips. */
const MAGAZINE: Grid = [
  '.YBYBY..',
  '.oppppn.',
  '.opoonn.',
  '.onnnnm.',
  '.ommmnm.',
  '.onnnnm.',
  '..onnnnm',
  '..ommmnm',
  '..onnnnm',
  '..mmmmmm',
];

/** The earlier drawing of MAGAZINE, kept to switch back to. */
export const MAGAZINE_OLD: Grid = [
  '.YBYB..',
  '.ooooo.',
  '.opppn.',
  '.onnnn.',
  '.onmnn.',
  '.onnnn.',
  '..onmnn',
  '..onnnn',
  '..mmmmm',
];

/** A dark ribbed can with a bright thread at one end. */
const SUPPRESSOR: Grid = [
  '..KKKKKKKKKKK.',
  'pnmKmKmKmKmKmK',
  'onmKmKmKmKmKmK',
  'pnmKmKmKmKmKmK',
  '..KKKKKKKKKKK.',
];

/** A dented red toolbox with a steel handle and a brass catch. */
const TOOLKIT: Grid = [
  '....ooooo....',
  '....o...o....',
  '.rrrrrrrrrrr.',
  'rtttttttttsss',
  'rttuttttttsss',
  'rrrrrYBrrrrrr',
  'rtttttttttsss',
  'rtttttttttsss',
  '.sssssssssss.',
];

/** Each part's grid, and where its glint sits relative to the item. */
export const PART_ART: Readonly<Record<PartId, { readonly rows: Grid; readonly glint: readonly [number, number] }>> = {
  barrel: { rows: BARREL, glint: [4, 1] },
  grip: { rows: GRIP, glint: [3, 2] },
  magazine: { rows: MAGAZINE, glint: [2, 2] },
  suppressor: { rows: SUPPRESSOR, glint: [1, 1] },
  toolkit: { rows: TOOLKIT, glint: [3, 3] },
};
