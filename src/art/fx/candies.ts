// One picture for every Halloween candy, for the candy bag screen. Each is a hand placed grid in
// the game's own ramps with one dark outline, like the rest of the interface art (fx/icons.ts).

import type { CandyId } from '../../../shared/protocol.ts';
import { PixelCanvas } from '../kit.ts';
import type { Legend } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { PixelSprite } from '../types.ts';
import type { Grid } from './shared.ts';

const { acid, blood, bone, denim, fire, ink, metal, rot, violet, wood } = RAMPS;

/** Every candy fits this square, outline and all. */
export const CANDY_ART_SIZE = 16;

const SWEET: Legend = {
  k: ink[0], K: ink[1],
  W: bone[3], e: bone[2], g: bone[1],
  r: blood[0], s: blood[1], t: blood[2], u: blood[3],
  D: fire[0], C: fire[1], B: fire[2], Y: fire[3],
  i: violet[0], j: violet[1], l: violet[2],
  q: rot[2], Q: rot[3],
  A: acid[0], G: acid[1], H: acid[2],
  N: denim[0], O: denim[1], P: denim[2],
  w: wood[0], x: wood[1], y: wood[2], z: wood[3],
  m: metal[1], n: metal[2], o: metal[3],
};

/** A sugared green skull, sour enough to make the eyes water. */
const SOUR_SKULLS: Grid = [
  '...AAAAAA...',
  '..AGHHHHGA..',
  '.AGHHWHHHGA.',
  '.AHkkHHkkHA.',
  '.AHkkHHkkHA.',
  '.AGHHkkHHGA.',
  '..AGHHHHGA..',
  '...AHkHkHA..',
  '....AAAAA...',
];

/** Red taffy gums with two long white fangs. */
const FANG_TAFFY: Grid = [
  '..rssssssr..',
  '.rstuuuutsr.',
  'rsttttttttsr',
  'rssssssssssr',
  '.rWW....WWr.',
  '..WW....WW..',
  '..eW....We..',
  '...W....W...',
];

/** A sheet ghost of pale gum. */
const GHOST_GUM: Grid = [
  '....WWWW....',
  '..WWWWWWWW..',
  '.WWWWWWWWWl.',
  '.WWkkWWkkWl.',
  '.WWkkWWkkWl.',
  '.WWWWWWWWWl.',
  '.WWWWkkWWll.',
  '.WWWWWWWWll.',
  '.lWWWWWWlll.',
  '.WW.WW.Wl.l.',
];

/** A jack-o'-lantern of orange fizz. */
const PUMPKIN_FIZZ: Grid = [
  '.....wx.....',
  '.....xw.....',
  '..CCCBBCCC..',
  '.CBBCBBCBBC.',
  'CBBkBBBBkBBC',
  'CBkkBCBBkkBC',
  'CBBBBCBBBBBC',
  'CBkBkBkBkBBC',
  '.CBkkkkkkBC.',
  '..CCCCCCCC..',
];

/** A jagged slab of amber brittle, studded with nuts. */
const WITCHS_BRITTLE: Grid = [
  '...CCC......',
  '..CYBCC.....',
  '.CBByBBCC...',
  'CBxBBBxBBC..',
  'CBBByBBBBBC.',
  '.CBxBBByBBBC',
  '..CBBxBBBxC.',
  '...CCBBBBC..',
  '.....CCCC...',
];

/** A purple gummy bat, wings spread, red eyes. */
const BAT_BITES: Grid = [
  '....i..i....',
  '....iiii....',
  'i..iuiiui..i',
  'ij.iiiiii.ji',
  'ijjiijjiijji',
  'iiiiiiiiiiii',
  '.iii.ii.iii.',
  '..i..ii..i..',
  '.....ii.....',
];

/** Candy corn: white tip, orange middle, yellow base. */
const CORN_RUSH: Grid = [
  '.....WW.....',
  '....WWWe....',
  '....CCCC....',
  '...CYCCCC...',
  '...CCCCCD...',
  '..BYBBBBBB..',
  '..BBBBBBBC..',
  '.BBBBBBBBBC.',
  '..BBBBBBCC..',
];

/** A hard blue ball with a shine on it. */
const JAWBREAKER: Grid = [
  '....OOOO....',
  '..OPPPOOOO..',
  '.OPWPOOOOON.',
  '.OPPOOOOOON.',
  'OOOOOOOOOONN',
  'OOOOOOOOONNN',
  'OOOOOOOOONNN',
  '.OOOOOOONNN.',
  '.NOOOOONNNN.',
  '..NNNNNNNN..',
  '....NNNN....',
];

/** A long twist of black licorice. */
const LICORICE_LASH: Grid = [
  '.........mmm',
  '........mnmm',
  '.......mmnm.',
  '......mnmm..',
  '.....mmnm...',
  '....mnmm....',
  '...mmnm.....',
  '..mnmm......',
  '.mmnm.......',
  'mnmm........',
  'mmm.........',
];

/** A red apple under dripping caramel, on a stick. */
const CARAMEL_APPLE: Grid = [
  '.....z......',
  '.....y......',
  '.....y......',
  '..xxxxxxx...',
  '.xyzyyzyyx..',
  '.xyxtxyxyx..',
  '.ttxtttxtt..',
  '.tuttttttt..',
  '.tutttttts..',
  '.ttttttttts.',
  '..tttttsss..',
  '...sssss....',
];

/** An eyeball that pops: white, veined, a green iris. */
const POPPING_EYEBALLS: Grid = [
  '...WWWWW....',
  '..WWWWsWW...',
  '.WWsWWWWWW..',
  '.WWWQQQWWe..',
  '.WWQqkqQWe..',
  '.WWQkkkQWe..',
  '.sWQqkqQee..',
  '..WWQQQee...',
  '...eeeee....',
];

/** A red-hot cinnamon ball with flames licking up off it. */
const FIREBALLS: Grid = [
  '....Y..Y....',
  '...YB.YBY...',
  '..YBCYBCBY..',
  '..BCDCCDCB..',
  '...tttttt...',
  '..tuuttttt..',
  '.tuWutttttt.',
  '.tuuttttttt.',
  '.ttttttttts.',
  '.tttttttsss.',
  '..ttttssss..',
  '...ssssss...',
];

/** A whole chocolate bar, half out of its wrapper. */
const FULL_SIZE_BAR: Grid = [
  'tttttwwwwwww',
  'tuuutxyyxyyw',
  'tBBBtxyyxyyw',
  'tBYBtxxxxxxw',
  'tBBBtxyyxyyw',
  'tuuutxyyxyyw',
  'tttttwwwwwww',
];

const GRIDS: Readonly<Record<CandyId, Grid>> = {
  sour_skulls: SOUR_SKULLS,
  fang_taffy: FANG_TAFFY,
  ghost_gum: GHOST_GUM,
  pumpkin_fizz: PUMPKIN_FIZZ,
  witchs_brittle: WITCHS_BRITTLE,
  bat_bites: BAT_BITES,
  corn_rush: CORN_RUSH,
  jawbreaker: JAWBREAKER,
  licorice_lash: LICORICE_LASH,
  caramel_apple: CARAMEL_APPLE,
  popping_eyeballs: POPPING_EYEBALLS,
  fireballs: FIREBALLS,
  full_size_bar: FULL_SIZE_BAR,
};

/** Centred in the square with a dark outline, so each holds on any background. */
function sweet(rows: Grid): PixelSprite {
  const size = CANDY_ART_SIZE;
  const width = Math.max(...rows.map((row) => row.length));
  const x = Math.floor((size - width) / 2);
  const y = Math.floor((size - rows.length) / 2);
  const canvas = new PixelCanvas(size, size).grid(x, y, rows, SWEET).outline({ color: ink[0] });
  return canvas.toSprite(size, size, Math.floor(size / 2), Math.floor(size / 2));
}

export function buildCandyArt(): Record<CandyId, PixelSprite> {
  const entries = Object.entries(GRIDS).map(([id, rows]) => [id, sweet(rows)] as const);
  return Object.fromEntries(entries) as Record<CandyId, PixelSprite>;
}
