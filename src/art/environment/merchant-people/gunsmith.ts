// Mags the Gunsmith on the survivor rig, matching her shop bust: a leather work cap with welding
// goggles pushed up on it, amber lenses; a black jaw-length bob; a smear of gun oil on her cheek
// and a lopsided smirk. A leather apron with brass rivets over a metal-grey work coat, dark work
// trousers and leather boots.
//
// Cap and apron are wood h/i/j/l, goggles metal m with fire F/G lenses (G also the rivets), hair
// K, the oil smear ash w. Coat t/u/v is metal, lit from the upper left like the survivors.

import { RAMPS } from '../../palette.ts';
import type { Person } from '../../survivors/rig.ts';
import { facingFront } from './front.ts';

const { ash, denim, fire, ink, metal, skin, wood } = RAMPS;

const legend = {
  k: ink[0], K: ink[1],
  a: skin[0], b: skin[1], c: skin[2], d: skin[3],
  h: wood[0], i: wood[1], j: wood[2], l: wood[3],
  m: metal[2], F: fire[1], G: fire[2], w: ash[1],
  t: metal[0], u: metal[1], v: metal[2],
  r: denim[2], q: denim[1], p: denim[0], R: denim[2], Q: denim[1], P: denim[0],
  g: wood[2], f: wood[1], e: wood[0],
};

export const GUNSMITH: Person = {
  legend,
  spread: 0,
  farLegend: { ...legend, r: denim[1], q: denim[0], p: denim[0], R: denim[1], Q: denim[0], P: denim[0], g: wood[1], f: wood[0], e: wood[0] },
  sleeve: [metal[0], metal[1], metal[2]],
  cuff: [metal[0], metal[1], metal[2]],
  hand: [skin[1], skin[2], skin[3]],
  heads: facingFront({ rows: [
    '...hiiiih...',
    '..hjjjiiih..',
    '.hjjliiiiih.',
    '.hmFGmmGFmh.',
    '.KKcddddcbK.',
    '.KKdkcdkcbK.',
    '.KKwcccccbK.',
    '.KKccccabbK.',
    '.KK.cbbbb.K.',
  ] }, { rows: [
    '...hiiiih...',
    '..hjjjiiih..',
    '.hjjiiiiiih.',
    '.hmmmmmmmmh.',
    '.KKKKKKKKKK.',
    '.KKKKKKKKKK.',
    '.KKKKKKKKKK.',
    '.KKKKKKKKKK.',
    '..KKbbbbKK..',
  ] }),
  torsos: facingFront({ rows: [
    '..vvuuuu..',
    '.vvlGjjGut',
    'vvuljjjiut',
    'vvuljjjiut',
    'uuuljjjitt',
    'uuuljjjitt',
    'uuljjjjiit',
    '.ljjjjjii.',
  ] }, { rows: [
    '..vvuuuu..',
    '.vvluuuult',
    'vvuluuulut',
    'vvuulluuut',
    'uuuulluutt',
    'uuuGjjGutt',
    'uuuuuuuttt',
    '.uuuuuuut.',
  ] }),
};
