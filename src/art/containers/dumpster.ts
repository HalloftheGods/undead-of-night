// The alley dumpster once it has been gone through: both lids thrown back, the heap dug down to the
// floor of the bin, and what was not worth taking left on the ground in front of it.

import { RAMPS } from '../palette.ts';
import type { Legend } from '../kit.ts';
import type { PixelSprite } from '../types.ts';
import type { ContainerArt } from './stage.ts';
import { bakeStage, over, paper, stage, tipped } from './stage.ts';

const { ash, blood, bone, concrete, grass, ink, metal } = RAMPS;

const SIDE = 3;
const ABOVE = 6;
const BELOW = 6;

const BAG: Legend = { a: ash[1], A: ash[2], d: ash[0], k: ink[1], e: bone[2] };

/** A bag hauled out and split along one side. */
const SPLIT_BAG = [
  '..aaa....',
  '.aAAaad..',
  'aAAaaddee',
  '.ddkddde.',
];

/** What is left in the bottom of a bay. */
const DREGS = [
  '....aa.....',
  '.dd.aAad.dd',
  'ddddaadkddd',
];

function dumpsterOpened(closed: PixelSprite): PixelSprite {
  const s = stage('dumpster', closed, SIDE, BELOW, ABOVE);
  const { c, left, ground } = s;
  // The closed art's own rows, moved down by the room left above it.
  const rim = ABOVE + 3;
  const bay = rim + 1;
  // Both bays open on the dark, the rim put back where the heap stood over it.
  c.rect(left + 1, bay, 28, 8, ink[0]);
  c.rect(left, rim, 30, 1, grass[1]);
  c.grid(left + 2, bay + 5, DREGS, BAG).grid(left + 17, bay + 5, DREGS, BAG);
  c.px(left + 8, bay + 6, bone[1]).px(left + 24, bay + 5, metal[2]);
  // A bag caught on the front edge on its way out.
  c.rect(left + 17, bay + 7, 4, 4, ash[1]).rect(left + 17, bay + 7, 4, 1, ash[2]).rect(left + 18, bay + 11, 2, 2, ash[0]);
  over(c, (layer) => {
    // The near lid, thrown back beside the far one.
    layer.rect(left, rim - 2, 14, 2, concrete[1]).rect(left, rim - 2, 14, 1, concrete[2]);
    layer.grid(left + 1, ground, SPLIT_BAG, BAG);
    paper(layer, left + 12, ground + 3);
    tipped(layer, left + 18, ground + 1, metal[2]);
    tipped(layer, left + 24, ground + 3, blood[1]);
    layer.px(left + 16, ground + 4, bone[1]).px(left + 22, ground + 1, bone[0]);
  });
  return bakeStage(s);
}

export function buildDumpsterArt(closed: PixelSprite): ContainerArt {
  return { closed, opened: dumpsterOpened(closed) };
}
