// Cinder the Powder maker on the survivor rig, matching the shop bust: an ink hood with a lit
// metal rim, a singed fringe with ember tips, soot across one cheek
// and a crooked smirk. A rust-orange coat with the ink scarf bunched at the throat, a leather
// bandolier of red-capped powder cartridges with a brass buckle, dark trousers and boots.
//
// Hood K with metal M rim, hair wood w/W, ember tips and fire O, soot ash H. Coat fire
// o/O over blood shade s, strap wood l/L, cartridge caps blood x, buckle fire E. The leg letters
// (r q p R Q P g f e) are the trousers and boots.

import { RAMPS } from '../../palette.ts';
import type { Person } from '../../survivors/rig.ts';
import { facingFront } from './front.ts';

const { ash, blood, fire, ink, metal, skin, wood } = RAMPS;

const legend = {
  k: ink[0], K: ink[1], M: metal[1],
  a: skin[0], b: skin[1], c: skin[2], d: skin[3],
  w: wood[1], W: wood[2], O: fire[1], E: fire[2], H: ash[0],
  o: fire[0], s: blood[1], l: wood[2], L: wood[3], x: blood[2],
  r: wood[2], q: wood[1], p: wood[0], R: wood[2], Q: wood[1], P: wood[0],
  g: metal[1], f: metal[0], e: ink[1],
};

export const POWDER: Person = {
  legend,
  spread: -1,
  farLegend: { ...legend, r: wood[1], q: wood[0], p: wood[0], R: wood[1], Q: wood[0], P: wood[0], g: metal[0], f: metal[0], e: ink[1] },
  sleeve: [blood[1], fire[0], fire[1]],
  cuff: [blood[1], fire[0], fire[1]],
  hand: [skin[1], skin[2], skin[3]],
  heads: facingFront({ rows: [
    '...KKKKKK...',
    '..KMMKKKKKK.',
    '.KMKwWOwWOKK',
    '.KMwwcddcwKK',
    '.KKcddcddcbK',
    '.KKckdcdkbKK',
    '.KKHcccccbK.',
    '.KKccccacbK.',
    '..KKcbbbbK..',
  ] }, { rows: [
    '...KKKKKK...',
    '..KMMKKKKKK.',
    '.KMKKKKKKKKK',
    '.KMKKKKKKKKK',
    '.KKKKKKKKKKK',
    '.KKKKKKKKKKK',
    '.KKKKKKKKKK.',
    '.KKKKKKKKKK.',
    '..KKKKKKKK..',
  ] }),
  torsos: facingFront({ rows: [
    '..OKKKKo..',
    '.OOlKKooos',
    'OOolxlooos',
    'Ooooolxlos',
    'oooooolEls',
    'ooooooolxl',
    'oooooooosl',
    '.ssssssss.',
  ] }, { rows: [
    '..OKKKKo..',
    '.OOoKKolos',
    'OOoooolxls',
    'Oooooolxos',
    'ooooolxoos',
    'oooolxooos',
    'ooolxoooos',
    '.ssssssss.',
  ] }),
};
