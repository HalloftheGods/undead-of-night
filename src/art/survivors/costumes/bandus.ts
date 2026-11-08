// Bear's costumes, default first. See ../costume.ts.
// Grizzly is his default look, drawn in ../bandus.ts. Polar Bear and Honey Bear reuse the
// grizzly's hood, tail and build with their own colours; Polar Bear also draws a red scarf
// over the torso. Recruit is his look from before the bear suit, kept unchanged: a plain red
// shirt, olive recruit trousers, a dark belt, brown boots, dog tags and a high and tight
// haircut, with no insignia, logos or text.

import { RAMPS } from '../../palette.ts';
import type { Costume } from '../costume.ts';
import { BANDUS } from '../bandus.ts';
import type { Person } from '../rig.ts';

const { blood, bone, fire, ink, metal, olive, skin, skinDeep, wood } = RAMPS;

const POLAR_LEGEND = {
  k: ink[0], K: ink[1],
  a: skin[0], b: skin[1], c: skin[2], d: skin[3],
  // A cool white suit: lit, body and shade. The grizzly's silvertips are plain lit fur here.
  v: bone[3], u: metal[3], t: metal[2], x: bone[3],
  // Inner ears, a cream snout and belly, and felt eyes and nose in navy.
  y: bone[1], z: bone[2], Z: bone[1], n: metal[0],
  // The scarf: lit, body and shade.
  s: blood[3], S: blood[2], w: blood[1],
  r: bone[3], q: metal[3], p: metal[2], R: bone[3], Q: metal[3], P: metal[2],
  // Grey paws with pale claws.
  g: metal[2], f: metal[1], e: bone[3],
};

/** White fur and a red scarf; dark grey mitts so the paws read against the white. */
const POLAR: Person = {
  ...BANDUS,
  legend: POLAR_LEGEND,
  farLegend: { ...POLAR_LEGEND, r: metal[3], q: metal[2], p: metal[1], R: metal[3], Q: metal[2], P: metal[1], g: metal[2], f: metal[1], e: bone[1] },
  // Starting on the ramp floor, the rig leaves the arms their own grey where they cross the white chest.
  sleeve: [metal[0], metal[2], bone[3]],
  cuff: [metal[0], metal[2], bone[3]],
  hand: [metal[0], metal[1], metal[2]],
  torsos: {
    0: { rows: [
      '...vvuuu..',
      '..ssSSSSw.',
      '.vSSSSSSwt',
      '.vuuuuzzZt',
      '.vuuuzzzZt',
      '.uuuuzzzZt',
      '.uuuuuZZtt',
      '.uuuuuuttt',
      '..ttttttt.',
    ] },
    1: { rows: [
      '...vvuuuu..',
      '.vsssSSSSww',
      'vvSSSSSSwwt',
      'vuuuzzzzuut',
      'vuuzzzzZutt',
      'vuuzzzzZutt',
      'uuuuzzZZttt',
      'uuuuuZZZttt',
      '.ttttttttt.',
    ] },
    2: { rows: [
      '...vuuuuuu..',
      '.vsssSSSSSu.',
      'vvSSSSSSwwut',
      'vuuuzzzSwuut',
      'vuuzzzzSwuut',
      'vuuzzzZSwutt',
      'uuuzzzZZuttt',
      'uuuuZZZuuttt',
      '.tttttttttt.',
    ] },
    6: { rows: [
      '...vuuuuuu..',
      '.vssSSSSSSw.',
      'vvSSSSSSSwwt',
      'vvuuuuuuuuut',
      'vuuuuuuuuutt',
      'vuuuuuuuuttt',
      'uuuuuuuutttt',
      'uuuuuuuutttt',
      '.tttttttttt.',
    ] },
    7: { rows: [
      '...vuuuu...',
      '.vssSSSSww.',
      'vvSSSSSwwtt',
      'vvuuuuuuutt',
      'vuuuuuuuttt',
      'vuuuuuuuttt',
      'uuuuuuuuttt',
      'uuuuuuuuttt',
      '.ttttttttt.',
    ] },
  },
};

const HONEY_LEGEND = {
  k: ink[0], K: ink[1],
  a: skin[0], b: skin[1], c: skin[2], d: skin[3],
  // A pale honey suit kept on the bone ramp, so no outline or contact line turns orange.
  v: bone[3], u: bone[2], t: wood[3], x: bone[3],
  // Golden inner ears, a cream snout and belly, and cocoa felt eyes and nose.
  y: fire[2], z: bone[3], Z: bone[2], n: skinDeep[0],
  r: bone[3], q: bone[2], p: wood[3], R: bone[3], Q: bone[2], P: wood[3],
  // Cocoa paws with cream claws.
  g: skinDeep[2], f: skinDeep[1], e: bone[2],
};

/** A pale honey teddy with cocoa mitts and paws: paler and yellower than Satori's orange tabby. */
const HONEY: Person = {
  ...BANDUS,
  legend: HONEY_LEGEND,
  farLegend: { ...HONEY_LEGEND, r: bone[2], q: wood[3], p: wood[3], R: bone[2], Q: wood[3], P: wood[3], g: skinDeep[1], f: skinDeep[0], e: bone[1] },
  sleeve: [skinDeep[0], wood[3], bone[3]],
  cuff: [skinDeep[0], wood[3], bone[3]],
  hand: [skinDeep[0], skinDeep[1], skinDeep[2]],
};

const RECRUIT_LEGEND = {
  k: ink[0], K: ink[1],
  a: skin[0], b: skin[1], c: skin[2], d: skin[3],
  h: wood[0], i: wood[1], j: wood[2],
  t: blood[1], u: blood[2], v: blood[3],
  w: wood[0], s: metal[3], S: metal[2],
  r: olive[2], q: olive[1], p: olive[0], R: olive[2], Q: olive[1], P: olive[0],
  e: wood[0], f: wood[1], g: wood[2],
};

const RECRUIT: Person = {
  legend: RECRUIT_LEGEND,
  spread: 0,
  farLegend: { ...RECRUIT_LEGEND, r: olive[1], q: olive[0], p: olive[0], R: olive[1], Q: olive[0], P: olive[0], g: wood[1], f: wood[0], e: wood[0] },
  // A step under the shirt with no lit stripe: the rig cannot darken a tone that starts on
  // the ramp floor, and a sleeve whose light matched the chest broke into red-on-red specks.
  sleeve: [blood[0], blood[1], blood[1]],
  cuff: [skin[1], skin[2], skin[3]],
  hand: [skin[1], skin[2], skin[3]],
  heads: {
    0: { dx: 1, rows: [
      '...hjjih..',
      '..hijiiih.',
      '.bhiiiiiih',
      '.bbhcdddcc',
      '.bhcccdkdc',
      '.bbccccccc',
      '..bbcccbcc',
      '..abccccb.',
      '...abbbb..',
    ] },
    1: { rows: [
      '...hjjiih.',
      '..hijiiiih',
      '.bhiiiiiih',
      '.bbcdddcdc',
      '.bbcdkdcdk',
      '.bccccccdc',
      '.abcccbccb',
      '..abccccb.',
      '...abbbb..',
    ] },
    2: { rows: [
      '...hjjih..',
      '..hijiiih.',
      '.chiiiiihb',
      '.bccddddbb',
      '.ccddddcbb',
      '.cckdcdkba',
      '.ccccccbba',
      '..ccbbcba.',
      '...cccba..',
    ] },
    6: { rows: [
      '...hjjih..',
      '..hjjiiih.',
      '.chiiiiihb',
      '.cbiiiiibb',
      '.cbhiiihbb',
      '.cbbhhhbbb',
      '.abbbbbbba',
      '..abbbbba.',
      '...abbba..',
    ] },
    7: { rows: [
      '...hjjiih.',
      '..hjjiiiih',
      '.chiiiiihb',
      '.cbiiiiihc',
      '.cbhiiihcc',
      '.bbbhhhccc',
      '.abbbbbccb',
      '..abbbbcb.',
      '...abbbb..',
    ] },
  },
  torsos: {
    0: { rows: [
      '...vvuuu..',
      '..vvvuuut.',
      '.vvvuuuuut',
      '.vvuuuuuut',
      '.vuuuuuutt',
      '.uuuuuuutt',
      '.uuuuuuttt',
      '.ttttttttt',
      '..wwwwwww.',
    ] },
    1: { rows: [
      '...vvuuuu..',
      '.vvvStttSuu',
      'vvvuuStSuut',
      'vvuuuuSuuut',
      'vuuuuusuutt',
      'uuuuuuuuttt',
      'uuuuuuuuttt',
      'ttttttttttt',
      '.wwwwwwwww.',
    ] },
    2: { rows: [
      '...vvuuuuu..',
      '.vvvStttSuu.',
      'vvvuuStSuuut',
      'vvuuuuSuuutt',
      'vuuuuusuuutt',
      'uuuuuuuuuttt',
      'uuuuuuuuuttt',
      'tttttttttttt',
      '.wwwwwwwwww.',
    ] },
    6: { rows: [
      '...vvuuuuu..',
      '.vvvvuuuuuu.',
      'vvvvuuuuuuut',
      'vvtuuuuuuutt',
      'vuutuuuuuttt',
      'uuuuuuuuuttt',
      'uuuuuuuutttt',
      'tttttttttttt',
      '.wwwwwwwwww.',
    ] },
    7: { rows: [
      '...vvuuuu..',
      '.vvvvuuuut.',
      'vvvvuuuuuut',
      'vvtuuuuuutt',
      'vuutuuuuttt',
      'uuuuuuuuttt',
      'uuuuuuuuttt',
      'ttttttttttt',
      '.wwwwwwwww.',
    ] },
  },
};

export const BANDUS_COSTUMES: readonly Costume[] = [
  { id: 'grizzly', name: 'Grizzly', person: BANDUS },
  { id: 'polar', name: 'Polar Bear', person: POLAR },
  { id: 'honey', name: 'Honey Bear', person: HONEY },
  { id: 'recruit', name: 'Recruit', person: RECRUIT },
];
