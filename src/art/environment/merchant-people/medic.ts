// Doc the Medic on the survivor rig, matching her shop bust: dark hair swept across from a side
// part, tired kind eyes, a small closed smile and a bandage on the lit cheek. A pale bone-white
// coat with a red cross on the breast and a stethoscope round the neck, teal scrubs underneath
// and pale clogs.
//
// Hair wood W/w/h, coat bone y/z/Y, cross blood x, stethoscope metal m, scrubs teal n/o/s, the
// bandage bone Z. The leg letters (r q p R Q P g f e) are the scrubs and clogs.

import { RAMPS } from '../../palette.ts';
import type { Person } from '../../survivors/rig.ts';
import { facingFront } from './front.ts';

const { blood, bone, ink, metal, skin, teal, wood } = RAMPS;

const legend = {
  k: ink[0], K: ink[1],
  a: skin[0], b: skin[1], c: skin[2], d: skin[3],
  W: wood[0], w: wood[1], h: wood[2],
  y: bone[1], z: bone[2], Y: bone[3], Z: bone[3],
  x: blood[2], m: metal[1], n: teal[0], o: teal[1],
  r: teal[2], q: teal[1], p: teal[0], R: teal[2], Q: teal[1], P: teal[0],
  g: bone[2], f: bone[1], e: bone[0],
};

export const MEDIC: Person = {
  legend,
  spread: -1,
  farLegend: { ...legend, r: teal[1], q: teal[0], p: teal[0], R: teal[1], Q: teal[0], P: teal[0], g: bone[1], f: bone[0], e: bone[0] },
  sleeve: [bone[1], bone[2], bone[3]],
  cuff: [bone[1], bone[2], bone[3]],
  hand: [skin[1], skin[2], skin[3]],
  heads: facingFront({ rows: [
    '...WWWWW...',
    '..WwhhwwW..',
    '.WwhhwwwwW.',
    '.WhhwwWccW.',
    '.WwcddcccbW',
    '.WWckdcdkbW',
    '..WdZcccbW.',
    '...ccccacb.',
    '....cbbbb..',
  ] }, { rows: [
    '...WWWWW...',
    '..WwhhwwW..',
    '.WwhhwwwwW.',
    '.WhwwwwwhW.',
    '.WwwhwwwwWW',
    '.WWwwwwwhWW',
    '..WWwwwwWW.',
    '...WWbbWW..',
    '....bbbb...',
  ] }),
  torsos: facingFront({ rows: [
    '..YYoozz..',
    '.YYmooomzy',
    'YYzmoomxzy',
    'YYzzmmxxxy',
    'YzzzzmzxzY',
    'zzzzzzzzyy',
    'zzzzzzzyyy',
    '.yyyyyyyy.',
  ] }, { rows: [
    '..YYoooz..',
    '.YYzzzzzzy',
    'YYzzzzzzzy',
    'YYzzzzzzzy',
    'YzzzzzzzzY',
    'zzzzyzzzyy',
    'zzzzyzzyyy',
    '.yyyyyyyy.',
  ] }),
};
