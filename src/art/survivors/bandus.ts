// Skin 1, Bear: an older teen, the tallest of the cast, in a brown grizzly bear suit. The
// hood has round ears with tan insides, felt eyes and a tan snout over the forehead, with his
// own face in the opening. Pale tips on the hood crown and the shoulder hump read as a
// grizzly's silvertip coat. A tan belly, tan mitten paws on thick arms, paw feet with pale
// claws and a tan stub tail behind. The arms take the suit's own browns starting from the
// ramp floor, so the rig leaves them their colour where they cross the chest. Only the k and K
// outline letters map to outline ink. The file and export keep the old name until the wiring
// task renames them (#7116); his red-shirt recruit look is the Recruit costume in costumes/bandus.ts.

import { RAMPS } from '../palette.ts';
import type { Person } from './rig.ts';

const { bone, ink, skin, wood } = RAMPS;

const legend = {
  k: ink[0], K: ink[1],
  a: skin[0], b: skin[1], c: skin[2], d: skin[3],
  // The suit: lit, fur and shade. Never below wood[1] on the outside, so it stays off the road.
  v: wood[3], u: wood[2], t: wood[1],
  // Silvertip: the pale fur tips on the crown and the shoulder hump.
  x: bone[2],
  // Tan inner ears, snout, belly and tail, and its shade. n is the felt nose and eyes.
  y: bone[2], z: bone[2], Z: bone[1], n: wood[0],
  r: wood[3], q: wood[2], p: wood[1], R: wood[3], Q: wood[2], P: wood[1],
  // Paws: a step darker than the shin, with a row of pale claws at the toe.
  g: wood[2], f: wood[1], e: bone[1],
};

export const BANDUS: Person = {
  legend,
  spread: 0,
  thick: true,
  farLegend: { ...legend, r: wood[2], q: wood[1], p: wood[1], R: wood[2], Q: wood[1], P: wood[1], g: wood[1], f: wood[1], e: wood[3] },
  sleeve: [wood[0], wood[2], wood[3]],
  cuff: [wood[0], wood[2], wood[3]],
  hand: [bone[0], bone[1], bone[2]],
  heads: {
    0: { dx: 1, dy: 1, rows: [
      '..vv.vvv....',
      '.vvvvvyyv...',
      '.vxxvvvnvv..',
      'uvvvvvvnvzz.',
      'uvvvvvvvzzzn',
      'uuvvvvuuZZZn',
      'uuuuucdddd..',
      'uuuuucdkdc..',
      'uuuuuccccc..',
      '.uuuuucbb...',
      '..uuuuu.....',
    ] },
    1: { dy: 1, rows: [
      '..vv.....uu.',
      '.vyyvvvvvuyt',
      '.vyvnvvvnuyt',
      'uuvvnvzznuut',
      'uuvvvzzzZuut',
      'uuvvvznnZuut',
      'uuucdddddbut',
      'uuucdkddkbbt',
      'uuucccccccbt',
      '.uuuccccbbtt',
      '..uuuuuutt..',
    ] },
    2: { dy: 1, rows: [
      '.vv......uu.',
      'vyyvvvvvvuyt',
      'vyvnvvvvnuyt',
      'uuvnvzzvnuut',
      'uuvvzzzZuuut',
      'uuuuznnZuuut',
      'uucddddddbut',
      'uuckdddkcbut',
      'uucccccccbut',
      '.uucccccbbu.',
      '..uuuuuutt..',
    ] },
    6: { dy: 1, rows: [
      '.vv......uu.',
      'vxxvvvvvvuut',
      'vvvvxxvvuuut',
      'uvvvvvvuuuut',
      'uvvvvuuuuuut',
      'uuvuuuuuuutt',
      'uuuuuuuuuutt',
      'uuuuuuuuuttt',
      'uuuuuuuuuttt',
      '.ttuuuuuttt.',
      '..tttttttt..',
    ] },
    7: { dy: 1, rows: [
      '..vv.....uu.',
      '.vxxvvvvvuut',
      '.vvvvxxvuuut',
      'uvvvvvvuuuzz',
      'uvvvvuuuuuZZ',
      'uuvuuuuuuucc',
      'uuuuuuuuuucb',
      'uuuuuuuuuubb',
      'uuuuuuuuuut.',
      '.ttuuuuuutt.',
      '..tttttt....',
    ] },
  },
  // The stub tail: a nub from the side, a tan tuft from behind.
  packs: {
    0: { dx: -5, dy: 0, rows: [
      'vv',
      'tt',
    ] },
    6: { dy: -1, rows: [
      '.zx.',
      'zzxx',
      'xxtt',
      '.tt.',
    ] },
    7: { dx: -2, dy: -1, rows: [
      '.zx.',
      'zzxx',
      'xxtt',
      '.tt.',
    ] },
  },
  // The shoulders carry a hump with silvertips; the front shows the tan belly.
  torsos: {
    0: { rows: [
      '...vvuuu..',
      '.xxvvuuuu.',
      'vxvvuuuzzt',
      'vvvuuuzzzt',
      '.vuuuuzzZt',
      '.uuuuuzzZt',
      '.uuuuuuZZt',
      '.uuuuuuttt',
      '..ttttttt.',
    ] },
    1: { rows: [
      '...vvuuuu..',
      '.vxxuuuuuuu',
      'vvvuuzzzzut',
      'vvuuzzzzZut',
      'vuuuzzzzZut',
      'uuuuzzzZZtt',
      'uuuuuZZZttt',
      'uuuuuuuuttt',
      '.ttttttttt.',
    ] },
    2: { rows: [
      '...vvuuuuu..',
      '.vxxuuuuuuu.',
      'vvvvzzzzZuut',
      'vvuzzzzzZuut',
      'vuuzzzzzZutt',
      'uuuzzzzZZutt',
      'uuuuZZZZtttt',
      'uuuuuuuutttt',
      '.tttttttttt.',
    ] },
    6: { rows: [
      '...vvuuuuu..',
      '.xxvvvvvvxx.',
      'vvvvvvvvvvut',
      'vvvvuuuuuuut',
      'vvuuuuuuuutt',
      'uuuuuuuuuttt',
      'uuuuuuuutttt',
      'uuuuuuuutttt',
      '.tttttttttt.',
    ] },
    7: { rows: [
      '...vvuuuu..',
      '.xxvvvvvxx.',
      'vvvvvvvvvut',
      'vvvvuuuuuut',
      'vvuuuuuuutt',
      'uuuuuuuuttt',
      'uuuuuuuuttt',
      'uuuuuuuuttt',
      '.ttttttttt.',
    ] },
  },
};
