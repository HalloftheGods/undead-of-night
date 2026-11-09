// Sarge the Quartermaster on the survivor rig, matching his shop bust: a flat olive patrol cap
// with a gold badge and a stiff brim, grey temples, heavy brows, a big nose and a bushy brown
// moustache. An olive field coat over a khaki shirt and dark tie, a brass-buckled belt, olive
// trousers and black boots. A broad build with thick arms.
//
// Cap and coat are olive t/u/v, badge and buttons fire F, grey hair ash G, brows, moustache, tie
// and belt wood w/x, shirt bone s. The leg letters (r q p R Q P g f e) are the trousers and boots.

import { RAMPS } from '../../palette.ts';
import type { Person } from '../../survivors/rig.ts';
import { facingFront } from './front.ts';

const { ash, bone, fire, ink, metal, olive, skin, wood } = RAMPS;

const legend = {
  k: ink[0], K: ink[1],
  a: skin[0], b: skin[1], c: skin[2], d: skin[3],
  t: olive[0], u: olive[1], v: olive[2],
  F: fire[2], G: ash[1], w: wood[0], x: wood[1], s: bone[2],
  r: olive[2], q: olive[1], p: olive[0], R: olive[2], Q: olive[1], P: olive[0],
  g: metal[1], f: metal[0], e: ink[1],
};

export const QUARTERMASTER: Person = {
  legend,
  spread: 0,
  thick: true,
  farLegend: { ...legend, r: olive[1], q: olive[0], p: olive[0], R: olive[1], Q: olive[0], P: olive[0], g: metal[0], f: metal[0], e: ink[1] },
  sleeve: [olive[0], olive[1], olive[2]],
  cuff: [olive[0], olive[1], olive[2]],
  hand: [skin[1], skin[2], skin[3]],
  heads: facingFront({ rows: [
    '...tuuuut...',
    '..tuvvFuut..',
    '.tuvvuuuutt.',
    'tttttttttttt',
    '.GcddddccbG.',
    '.GxxcdcxxbG.',
    '.GkdcddkcbG.',
    '.GcccddccbG.',
    '..cxxxxxxb..',
    '...cbbbbb...',
  ] }, { rows: [
    '...tuuuut...',
    '..tuvvuuut..',
    '.tuvvuuuutt.',
    '.tttttttttt.',
    '.GGGGGGGGGG.',
    '.GGGGGGGGGG.',
    '.GGGGGGGGGG.',
    '.GccccccbbG.',
    '..cccccbbb..',
    '...cbbbbb...',
  ] }),
  torsos: facingFront({ rows: [
    '..vvssuu..',
    '.vvuswsuut',
    'vvvuswuuut',
    'vvuuuFuuut',
    'vuuuuuuutt',
    'uuuuuFuttt',
    'xxxxxFxxxx',
    '.tttttttt.',
  ] }, { rows: [
    '..vvuuuu..',
    '.vvuuuuuut',
    'vvvuuuuuut',
    'vvuuuuuuut',
    'vuuuuuuutt',
    'uuuuuuuttt',
    'xxxxxxxxxx',
    '.tttttttt.',
  ] }),
};
