// Kai's select screen bust, drawn from his face reference: a very round, chubby-cheeked face;
// thick dark brown hair in a bowl cut whose fringe sweeps from the part on the left down across
// the forehead to the right and covers the tops of the ears; big round black glasses with
// thick rims and a high bridge, the wide-open dark brown eyes and raised brows seen through
// the lenses; a small round nose, rosy cheeks, and a cheeky grin showing two gapped top teeth.
// He keeps his in-game outfit: the red cap with its blue visor cocked to the left and pushed
// back so the fringe shows, the yellow and blue ringer tee, and his backpack straps.
//
// Lit from the upper left. Cap is blood e/H/J/G with a seam and button; hair is wood h/i/j
// with a D sheen along the lock; skin a-d, l glints on the lenses and eyes. k is the ink outline.

import { RAMPS } from '../../palette.ts';
import type { BustDef } from '../bust.ts';

const { blood, bone, denim, fire, ink, skin, wood } = RAMPS;

export const SOL_BUST: BustDef = {
  legend: {
    k: ink[0],
    a: skin[0], b: skin[1], c: skin[2], d: skin[3],
    h: wood[0], i: wood[1], j: wood[2], D: wood[3],
    e: blood[0], H: blood[1], J: blood[2], G: blood[3],
    m: denim[0], n: denim[1], o: denim[2],
    u: fire[2], v: fire[3],
    l: bone[3],
  },
  rows: [
    '................................................',
    '................................................',
    '.......................kk.......................',
    '....................kkkJJkkk....................',
    '.................kkkGGGHJJJJkkk.................',
    '...............kkGGGGGGHJJJJJJJkk...............',
    '.............kkGGGGGGGGHJJJJJJJJHkk.............',
    '............kGGGGGGGGGGHJJJJJJJJHHHk............',
    '...........kGGGGGGGGGGGHJJJJJJJJHHHek...........',
    '...........kGGGGGGGGGGGHJJJJJJJJHHHek...........',
    '....kkkkkkkookGGGGGGGGJHJJJJJJJHHHHeek..........',
    '..kknnnnnnnnnnkHHHHHHHHHHHHHHHHHeeeeek..........',
    '..kkkmmmmmmmmkkkkkkkkkkkkkkkkkkkkkkkkkk.........',
    '.....kkkkkkkkiijjjiihhhhhhhhhhhhhhhhhhk.........',
    '.........kihhjDDDjjjiiiiihhhhiiiihihhhk.........',
    '.........kihhhjDDDDjjjjiiiihhhjjiiiihhk.........',
    '.........kihihhjjjDDjjjjjiiiihhjjjiihhk.........',
    '.........kihbcbhhiijjjjDDjjjiiihhjjiihk.........',
    '........kiihcddcbbhhhiijjjjjjjiiiihhihhk........',
    '........kiihcdckkkkkccbccbbbkkkkkbhhhihk........',
    '........kiihckkkiiikkkcccckkkiiikkkbhihk........',
    '........kiikkkkicccikkckkckkicccikkkkhhk........',
    '.......kiiihkkcckkkcckkcckkcckkkcckkhhhhk.......',
    '.......kiiickkcklhhkckkcckkcklhhkckkbhhhk.......',
    '......kcbicckkclikhlckkcckkclikhlckkbbhabk......',
    '.....kccbccckkcliiilckkcckkcliiilckkbbbabbk.....',
    '.....kccbccckkccbbbcdkkcckkccbbbcdkkbbbabbk.....',
    '.....kccbcddckkcccclkkcdcckkcccclkkbbbbabbk.....',
    '.....kccbccddkkkccckkkbcbckkkccckkkbbababbk.....',
    '.....kccbcccGGckkkkkcccabccckkkkkGGbbababbk.....',
    '......kkbkccccccccccccccccccckcbbbbbaakakk......',
    '..........kccccccckccccccccckcbbbbbbak..........',
    '..........kcccccccckkkkkkkkkbbbbbbbbak..........',
    '...........kcccccccckllelleekbbbbbbak...........',
    '............kcccccccckJGGGJkbbbbbaak............',
    '.............kkkcccccbbbbbbbbbaakkk.............',
    '................kkkkkkkkkkkkkkkk................',
    '..................kaaaaaaaaaak..................',
    '................kkkbbbbbbbbbbkkk................',
    '................kookkbbbbbbkknnk................',
    '..........kkkkkkkooookkkkkkonnnkkkkkkk..........',
    '.........kvvvkDjkooooooooooonnnkjikuuuk.........',
    '.......kkuuuukDjkuuuuuuuuuuuuuukjikuuuukk.......',
    '......kuuuuukDjkuuuuuuuuuuuuuuuukjikuuuuuk......',
    '....kkooooookDjkooooooooooooooookjiknnnnnnkk....',
    '...knnnnnnnkDjknnnnnnnnnnnnnnnnnnkjikmmmmmmmk...',
    '..kvvvvvvvvkDjkvvvvvvvvvvvvvvvvvvkjikuuuuuuuuk..',
    '..kuuuuuuukDjkuuuuuuuuuuuuuuuuuuuukjikuuuuuuuk..',
    '..kuuuuuuukDjkuuuuuuuuuuuuuuuuuuuukjikuuuuuuuk..',
    '.kooooooookDjkooooooooooooooooooookjiknnnnnnnnk.',
    '.knnnnnnnnkDjknnnnnnnnnnnnnnnnnnnnkjikmmmmmmmmk.',
    '.kvvvvvvvvkDjkvvvvvvvvvvvvvvvvvvvvkjikuuuuuuuuk.',
    '.kuuuuuuuukDjkuuuuuuuuuuuuuuuuuuuukjikuuuuuuuuk.',
    '.kuuuuuuuukDjkuuuuuuuuuuuuuuuuuuuukjikuuuuuuuuk.',
    '.kooooooookDjkooooooooooooooooooookjiknnnnnnnnk.',
    '.knnnnnnnnkDjknnnnnnnnnnnnnnnnnnnnkjikmmmmmmmmk.',
  ],
};
