// Kai's costumes, default first. See ../costume.ts.
// Each is a kid's dress-up of a game-hero archetype, drawn as an original outfit with no
// letters, logos or emblems. Every costume keeps Kai's round glasses as the default draws
// them: his heads' K, k, l and m letters stay at the same cell pixels with the same
// colours in every facing (tests/costumes-sol.spec.ts checks it). Each keeps his small
// build and changes only what sits above the glasses and the clothes.

import type { Legend } from '../../kit.ts';
import { RAMPS } from '../../palette.ts';
import type { Costume } from '../costume.ts';
import type { Part, Person } from '../rig.ts';
import { SOL } from '../sol.ts';

const { acid, blood, bone, denim, fire, metal, wood } = RAMPS;

/** Kai's legend with the clothes letters replaced; the face and glasses letters stay his. */
function dressed(clothes: Legend): Legend {
  return { ...SOL.legend, ...clothes };
}

// Plumber: a puffy red cap with a plain front and a red visor, a red long-sleeved shirt
// under blue overalls with two yellow buttons, and brown shoes. No pack.
const plumberLegend = dressed({
  V: blood[2],
  v: blood[3], u: blood[2], t: blood[1],
  o: denim[2], n: denim[1],
  y: fire[2],
  r: denim[2], q: denim[1], p: denim[0], R: denim[2], Q: denim[1], P: denim[0],
  g: wood[2], f: wood[1], e: wood[0],
});

const PLUMBER_BACK: Part = { rows: [
  '...vuuuu..',
  '.uonuuont.',
  'vuonuuontt',
  'vuonuuontt',
  'onnnnnnnmt',
  'onnnnnnnmm',
  'onnnmmnnmm',
] };

const PLUMBER: Person = {
  ...SOL,
  legend: plumberLegend,
  farLegend: {
    ...plumberLegend,
    r: denim[1], q: denim[0], p: denim[0], R: denim[1], Q: denim[0], P: denim[0],
    g: wood[1], f: wood[0], e: wood[0],
  },
  sleeve: [blood[1], blood[2], blood[3]],
  cuff: [blood[1], blood[2], blood[3]],
  packs: undefined,
  heads: {
    0: { dx: 1, rows: [
      '..HGGGGH..',
      '.HGGGGGGH.',
      'HGGGGGGGGH',
      'HGGGGGGJJH',
      'hHHHHHVVVV',
      'hhbcccKKcc',
      'hhbcKKlkmd',
      '.hbcccmmcc',
      '..bbccccc.',
      '...abbbb..',
    ] },
    1: { rows: [
      '..HGGGGGH.',
      '.HGGGGGGGH',
      'HGGGGGGGJH',
      'HGGGGGGJJH',
      'hHHHVVVVVV',
      'hhbKKccKKc',
      'hhKlkmKlkm',
      '.hbmmccmmc',
      '..bbccccc.',
      '...abbbb..',
    ] },
    2: { rows: [
      '..HGGGGH..',
      '.HGGGGGGH.',
      'HGGGGGGGJH',
      'HGGGGGGJJH',
      'VVVVVVVVVV',
      'bcKKddKKca',
      'bKlkmKlkma',
      'bcmmccmmca',
      '.ccccbcbb.',
      '..cbbbbb..',
    ] },
    // From behind, his own cap grids; the plumber legend turns the visor in facing 7 red.
    6: SOL.heads[6],
    7: SOL.heads[7],
  },
  torsos: {
    0: { rows: [
      '..vvuuu..',
      '.vuuonuut',
      '.vuuonuut',
      '.vuuyynnm',
      '.onnnnnnm',
      '.onnnnnmm',
      '.onnnnnmm',
    ] },
    1: { rows: [
      '...vvuuu..',
      '.uonuuuont',
      'vuonuuuont',
      'vuyynnnyyt',
      'onnnnnnnmt',
      'onnnnnnnmm',
      'onnnnnnnmm',
    ] },
    2: { rows: [
      '...vuuuu..',
      '.uonuuont.',
      'vuonuuontt',
      'vuyynnyytt',
      'onnnnnnnmt',
      'onnnnnnnmm',
      'onnnmmnnmm',
    ] },
    6: PLUMBER_BACK,
    7: PLUMBER_BACK,
  },
};

// Adventurer: a green pointed cap whose tip droops behind, a green tunic with a brown
// belt, pale leggings and brown boots, and a small plain round shield on his back in
// place of the backpack. No sword: the rig puts his gun in his hands.
const adventurerLegend = dressed({
  G: acid[1], J: acid[2], H: acid[0],
  v: acid[2], u: acid[1], t: acid[0],
  B: wood[2], C: wood[1],
  S: metal[3], T: metal[2], U: metal[1], W: metal[3], X: metal[2],
  r: bone[3], q: bone[2], p: bone[1], R: bone[3], Q: bone[2], P: bone[1],
  g: wood[2], f: wood[1], e: wood[0],
});

const TUNIC: Part = { rows: [
  '...vvuuu..',
  '.uuuuuuut.',
  'uuuuuuuutt',
  'uuuuuuuutt',
  'BBBBBBBBCC',
  'uuuuuuuutt',
  'uuuuuuuutt',
] };

/** Wood inside a metal rim with a boss, lit from the upper left. */
const SHIELD: Part = { dy: -1, rows: [
  '.SSTT.',
  'SDDEET',
  'SDWXET',
  'SEXXFU',
  'SEEFFU',
  '.TTUU.',
] };

const ADVENTURER: Person = {
  ...SOL,
  legend: adventurerLegend,
  farLegend: {
    ...adventurerLegend,
    r: bone[2], q: bone[1], p: bone[0], R: bone[2], Q: bone[1], P: bone[0],
    g: wood[1], f: wood[0], e: wood[0],
  },
  sleeve: [acid[0], acid[1], acid[2]],
  cuff: [bone[1], bone[2], bone[3]],
  // Wider grids hold the drooping tip; dx keeps the face where Kai's is.
  heads: {
    0: { rows: [
      '.....HGGGH...',
      '...HJJJGGGGH.',
      '..HGJJGGGGGGH',
      '.HGGGGGGGGGGH',
      'HGGhHHHHHHHHH',
      'HGGhhbcccKKcc',
      '.HGhhbcKKlkmd',
      '.HH.hbcccmmcc',
      '..H..bbccccc.',
      '......abbbb..',
    ] },
    1: { dx: -1, rows: [
      '....HJJGGH..',
      '..HGJJGGGGGH',
      '.HGGGGGGGGGH',
      'GGGhHHHHHHHH',
      '.GhhbKKccKKc',
      '..hhKlkmKlkm',
      '...hbmmccmmc',
      '....bbccccc.',
      '.....abbbb..',
    ] },
    2: { dx: -1, rows: [
      '....HJJGGH..',
      '...HGJJGGGH.',
      '..HGGGGGGGGH',
      'HGGGHHHHHHHH',
      'HGbcKKddKKca',
      'H.bKlkmKlkma',
      '..bcmmccmmca',
      '...ccccbcbb.',
      '....cbbbbb..',
    ] },
    6: { rows: [
      '..HJJGGH..',
      '.HJJGGGGH.',
      'HGGGGGGGGH',
      'HGGGGGGGGH',
      'hHHGGGGHHh',
      'hhhHGGHhhh',
      'KhhhHHhhhK',
      '.bhhhhhha.',
      '..abbbba..',
    ] },
    7: { rows: [
      '..HJJGGGH.',
      '.HJJGGGGGH',
      'HGGGGGGGGH',
      'HGGGGGGGGH',
      'HGGHHHHHHc',
      'GGGGhihKcc',
      'KHHHhihccc',
      '.bhhhhabb.',
      '..abbbba..',
    ] },
  },
  packs: {
    // Seen edge on from the side.
    0: { dx: -5, dy: -1, rows: [
      '.TT',
      'SDT',
      'SDU',
      'SEU',
      'SEU',
      '.UU',
    ] },
    6: SHIELD,
    7: { ...SHIELD, dx: -1 },
  },
  torsos: {
    0: { rows: [
      '..vvuuu..',
      '.uuuuuuut',
      '.uuuuuuut',
      '.uuuuuutt',
      '.BBBBBBCC',
      '.uuuuuutt',
      '.uuuuuutt',
    ] },
    1: { rows: [
      '...vvuuu..',
      '.uuuuuuuut',
      'uuuuuuuutt',
      'uuuuuuuutt',
      'BBBBBBBBCC',
      'uuuuuuuutt',
      'uuuuuuuutt',
    ] },
    2: TUNIC,
    6: TUNIC,
    7: TUNIC,
  },
};

// Caped Hero: a blue suit, a red cape in the pack grids (tied over the shoulders, so it
// shows from the front too), a yellow belt, his own dark hair, and a small red eye mask
// worn around the glasses: it takes only skin pixels, so the rims and eyes still read.
const capedLegend = dressed({
  v: denim[2], u: denim[1], t: denim[0],
  y: fire[2], Y: fire[1],
  A: blood[3], B: blood[2], C: blood[1],
  M: blood[2],
  r: denim[2], q: denim[1], p: denim[0], R: denim[2], Q: denim[1], P: denim[0],
});

const SUIT_BACK: Part = { rows: [
  '...vvuuu..',
  '.uuuuuuut.',
  'vuuuuuuutt',
  'vuuuuuuutt',
  'yyyyyyyyYY',
  'vuuuuuuutt',
  'vuuuttuutt',
] };

/** Folds lit from the upper left, hanging to the calves. */
const CAPE_BACK: Part = { dy: 2, rows: [
  '.AAABBBBBCC.',
  '.ABABBCBBCC.',
  'AABABBCBBCC.',
  'AABABBCBBCCC',
  'AABABBCBBCCC',
  'AABABBCBBCCC',
  'AABABBCBBCCC',
  'ABBABBCBBCCC',
] };

const CAPED: Person = {
  ...SOL,
  legend: capedLegend,
  farLegend: {
    ...capedLegend,
    r: denim[1], q: denim[0], p: denim[0], R: denim[1], Q: denim[0], P: denim[0],
  },
  sleeve: [denim[0], denim[1], denim[2]],
  cuff: [denim[0], denim[1], denim[2]],
  heads: {
    0: { dx: 1, rows: [
      '..hjjih...',
      '.hjjiiihh.',
      'hjjiiiiihh',
      'hiiiihhiih',
      'hhMMMMKKcc',
      'hhMMKKlkmd',
      '.hbMMMmmcc',
      '..bbccccc.',
      '...abbbb..',
    ] },
    1: { rows: [
      '..hjjiih..',
      '.hjjiiiih.',
      'hjjiiiiiih',
      'hiiMMMMMMM',
      'hhbKKMMKKM',
      'hhKlkmKlkm',
      '.hbmmMMmmc',
      '..bbccccc.',
      '...abbbb..',
    ] },
    2: { rows: [
      '..hjjih...',
      '.hjjiiiih.',
      'hjjiiiiiih',
      'hiihhiiihh',
      'MMKKMMKKMM',
      'MKlkmKlkmM',
      'bcmmMMmmca',
      '.ccccbcbb.',
      '..cbbbbb..',
    ] },
    6: { rows: [
      '..hjjih...',
      '.hjjiiiih.',
      'hjjiiiiiih',
      'hiiiiiiiih',
      'hiijiiiihh',
      'hhjjiiihhh',
      'KhhiiihhhK',
      '.bhhhhhha.',
      '..abbbba..',
    ] },
    7: { rows: [
      '..hjjiih..',
      '.hjjiiiih.',
      'hjjiiiiiih',
      'hiiiiiiiih',
      'hijjiiihhc',
      'hhjiiihKcc',
      'Khhiiihccc',
      '.bhhhhabb.',
      '..abbbba..',
    ] },
  },
  packs: {
    0: { dx: -5, dy: 3, rows: [
      '...AB',
      '..AAB',
      '..ABC',
      '.AABC',
      '.ABBC',
      '.ABBC',
      'AABBC',
      'ABBCC',
      'ABBC.',
      'ABB..',
    ] },
    1: { dx: -6, dy: 3, rows: [
      '..AB',
      '..AB',
      '.AAB',
      '.ABB',
      '.ABB',
      'AABB',
      'AABC',
      'ABBC',
      'ABBC',
      'ABB.',
    ] },
    2: { dy: 1, rows: [
      '..AAAAAABBC...',
      '.AAAAAABBBCC..',
      '.AAAAABBBBCCC.',
      '.AAAAABBBBCCC.',
      'AAAAABBBBBCCCC',
      'AAAABBBBBCCCCC',
      'AAAABBBBBCCCCC',
      '.AABBBBBCCCC..',
    ] },
    6: CAPE_BACK,
    7: { dx: -1, dy: 2, rows: [
      '.AAABBBBCC.',
      '.ABABBCBBC.',
      'AABABBCBBC.',
      'AABABBCBBCC',
      'AABABBCBBCC',
      'AABABBCBBCC',
      'AABABBCBBCC',
      'ABBABBCBBCC',
    ] },
  },
  torsos: {
    0: { rows: [
      '..vvuuu..',
      '.vuuuuuut',
      '.vuuuuuut',
      '.vuuuuutt',
      '.yyyyyyYY',
      '.vuuuuutt',
      '.vuuuuutt',
    ] },
    1: { rows: [
      '...vvuuu..',
      '.uuuuuuuut',
      'vuuuuuuutt',
      'vuuuuuuutt',
      'yyyyyyyyYY',
      'vuuuuuuutt',
      'vuuuuuuutt',
    ] },
    2: { rows: [
      '.AAvuuuuC.',
      'AAvvuuuuCC',
      'vuuuuuuutt',
      'vuuuuuuutt',
      'yyyyyyyyYY',
      'vuuuuuuutt',
      'vuuuttuutt',
    ] },
    6: SUIT_BACK,
    7: SUIT_BACK,
  },
};

export const SOL_COSTUMES: readonly Costume[] = [
  { id: 'kid', name: 'Kid', person: SOL },
  { id: 'plumber', name: 'Plumber', person: PLUMBER },
  { id: 'adventurer', name: 'Adventurer', person: ADVENTURER },
  { id: 'caped', name: 'Caped Hero', person: CAPED },
];
