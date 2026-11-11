// Round kits: workbench loot on the floor and in the icons. Letters are the pickup legend.
// Three rounds standing in a low tin, told apart by the colour of the tips and the band on the tin.

import type { RoundKitId } from '../../../shared/round-effect-data.ts';
import type { Grid } from './shared.ts';

/** Three rounds in a tin: `tip` and `dark` colour the bullets and the band. */
const tin = (tip: string, dark: string): Grid => [
  '..T...T...T..',
  '.TTD.TTD.TTD.',
  '.TTD.TTD.TTD.',
  '.YYB.YYB.YYB.',
  '.YYB.YYB.YYB.',
  'nppppppppppon',
  'noooooooooonm',
  'noTTTTTTTDonm',
  '.mmmmmmmmmmm.',
].map((row) => row.replace(/T/g, tip).replace(/D/g, dark));

/** Each kit's grid, and where its glint sits relative to the item. */
export const KIT_ART: Readonly<Record<RoundKitId, { readonly rows: Grid; readonly glint: readonly [number, number] }>> = {
  incendiary_kit: { rows: tin('C', 'D'), glint: [2, 1] },
  acid_kit: { rows: tin('c', 'b'), glint: [2, 1] },
  piercing_kit: { rows: tin('e', 'g'), glint: [2, 1] },
  tranq_kit: { rows: tin('t', 'r'), glint: [2, 1] },
};

/** The lid mark is five pixels wide and three tall, set in a field of tin. */
const lid = (mark: readonly [string, string, string]): Grid => mark.map((row) => `nooo${row.replace(/\./g, 'o')}ooom`);

const tinOld = (mark: readonly [string, string, string], band: string): Grid => [
  '.nnnnnnnnnnn.',
  'npppppoppppon',
  'noooooYooooom',
  ...lid(mark),
  band,
  'noooooooooonm',
  '.mmmmmmmmmmm.',
];

/** The earlier drawing of each kit, kept to switch back to. */
export const KIT_ART_OLD: Readonly<Record<RoundKitId, { readonly rows: Grid; readonly glint: readonly [number, number] }>> = {
  incendiary_kit: { rows: tinOld(['..B..', '.BCB.', '.CYC.'], 'nBBCBBBCBBCBm'), glint: [2, 1] },
  acid_kit: { rows: tinOld(['..c..', '.ccc.', '.cbc.'], 'nbcbccbcbbcbm'), glint: [2, 1] },
  piercing_kit: { rows: tinOld(['...e.', 'eeeee', '...e.'], 'nefefeefefefm'), glint: [2, 1] },
  tranq_kit: { rows: tinOld(['s.e..', '.eee.', '..e.s'], 'nsrsrrsrssrsm'), glint: [2, 1] },
};
