// Bear's select portrait: the older teen in his grizzly bear suit. The hood is a bear's head,
// round ears with tan insides, felt button eyes and a tan snout with a dark nose over his brow,
// and his own face looks out of the opening: a dark brown buzz cut at the hood's front rim,
// thick dark brows, blue eyes, a straight nose, a broad grin with the top teeth showing,
// a flush on the cheeks and a squarish jaw. Pale silvertip tufts on the crown and the shoulder
// hump, a zip with its pull down the front, and the top of the tan belly.
//
// Lit from the upper left. The suit is wood v/u/t lit to shade with n in the deepest folds, the
// same browns as the in-game suit; fur tufts are small darker chevrons, not noise. Tan is bone
// z/Z with e for the lit edge, x the silvertip. Skin is a/b/c/d with d the fair lit side, y the
// flush, r the mouth. The eyes are denim O/o around the k pupil with an e glint. The zip is
// metal m/S/s. k and K are the ink outline.
import { RAMPS } from '../../palette.ts';
import type { BustDef } from '../bust.ts';

const { blood, bone, denim, ink, metal, skin, wood } = RAMPS;

export const BANDUS_BUST: BustDef = {
  legend: {
    k: ink[0], K: ink[1],
    a: skin[0], b: skin[1], c: skin[2], d: skin[3],
    n: wood[0], t: wood[1], u: wood[2], v: wood[3],
    x: bone[2], z: bone[2], Z: bone[1], e: bone[3],
    r: blood[1], y: blood[3],
    m: metal[1], S: metal[2], s: metal[3],
    o: denim[1], O: denim[2],
  },
  rows: [
    '................................................',
    '........kkk..........................kkk........',
    '......kkvvvkk......................kkvuukk......',
    '.....kvvvvuuuk.....kkkkkkkkkk.....kvvvuuutk.....',
    '.....kvvnnnnuk.kkkkvvvxvvvuuukkkk.kvnnnnutk.....',
    '....kvvnZZZnutkvvvxvvxxvvvuututuukvunZZZntk.....',
    '....kvunZzzzutkvvxxvvvvvvxuuutuuukuuzzzZnttk....',
    '....kvuuZzzzttkvvkkvvvvvxxuuukkuukuuzzzZtttk....',
    '.....kuutzzttkvvkenkvvvvuuuukenkuukutzztttk.....',
    '.....kuttttttkvvknnkvvvuuuuuknnkuuktttttnk......',
    '......kktttkkvvvvkkvvkkkkkkuukkuuuukkttnkk......',
    '........kvvvvvvvvvvvktnnnnzkuuuututuuuuk........',
    '.......kvvvvvvvvvvvkezznnzzZkuuuutuuuuutk.......',
    '.......kvvvvvvvvvvvkzzzttzZZkuuuuuuuuuttk.......',
    '.......kuvuvvvvvvvtkzznzZnZZknuuuuuuutttk.......',
    '.......kvuvvvvvvntttkzZZZZZktntnuuuuuntnk.......',
    '......kvvvvvvvvnttntnkkkkkktntntnuuuttnttk......',
    '......kvvvvvvvntttntnttntntntntntnuutttttk......',
    '......kvvvvuvunttcdddcccccccccbtnnuttttttk......',
    '......kvvvvvuntcdddddddddccccccbbtnttttttk......',
    '......kuvuvvvntcdnnnntddcctnnnncbtnttttttk......',
    '......kvuvvvvntcnnnntdddccctnnnnbtntttntnk......',
    '......kvvvvvvncddccdddddcccccbbccbnttttntk......',
    '......kvvvvvvncdckkkkcddccckkkkcbbnttttttk......',
    '......kvvvvvvncdkOekecddcccOekekbbnttttttk......',
    '......kvvvvvvncddcOocdddccccOoccbbnttttttk......',
    '.......kvuvuvncddcddddddccccccccbbntttttk.......',
    '.......kvvuvvncdycddddddbccccccybbntntntk.......',
    '.......kvvvvuncdddddddcbabccccccbbnttnttk.......',
    '.......kvvvvuncdddKdddddcccccKccbbntttttk.......',
    '........kvvuuncdddckkkkkkkkkkcccbbnttttk........',
    '........kvtutncdddckeeeeeeeZkcccbbnttttk........',
    '.........kutuundddcdkkKrrKkkcbccbntntnk.........',
    '..........kuuukddddddcbbbbccccbbakttnk..........',
    '...........kuuukcdddddddcccccbbakttnk...........',
    '............kuutkccddddccccbbbaktnnk............',
    '.......kkkkkkuttkkkkkkkkkkkkkkttnnkkkkkk........',
    '......kvvvvvvkuuttttnnnnnnnnttttnnkuuuuutk......',
    '....kkvvvxvvxvkkkkkkkkkkkkkkkkkkkkuuuvuuttkk....',
    '...kvvvvxxvxxvvvvvvuuuksskuuuuuuuuuuvvutvtttk...',
    '..kvvvxvvvvvvvvvvvvuuuksSkuuuuuuuuuuuutvvttttk..',
    'kkvvvxxvvvvvvvvvvvuuuukSmkuuuuuuuuuuutttttttttkk',
    'kvvvvvvvxvvvvvvvvvuuuutkknuuuuuuuuuuuttttttttttk',
    'kvvvxvvxxvvvvvvvvuuuuutSmnuuuuuuuuuutttttttttttk',
    'kvvxxvvvvvvvvvvvuuuuuutmSnuuuuuuuuuutttttttttttk',
    'kvvvvvvvvuvvvuvuuuuuuutSmnuuuuutututttnttttttttk',
    'kvvvvvvvvuvvvvuuuutututmSnututuututtttnttttttttk',
    'kvvvvvvvvuvvvvvuuuutuutSmnuutuuuuuttttnttttttttk',
    'kvvvvuvuuvvvvvuuuuuuutZmSZtuuuuuuttttttntntntttk',
    'kvvvvvuvuvvvvuuuuuuttzZSmZzttuuuuttttttnttnttttk',
    'kvvvvvvvuvvvvuuuuutzzzZmSZzZZtuutttttttntttttttk',
    'kvvvvvvvuvvvuuuttnzzzzZSmZzZZZtntttttttntttttttk',
    'kvvvvvvvuvvvuuuunzzzzzZmSZzZZZZttttttttntttttttk',
    'kvvuvuvuvvvuuuutzzzzzzZSmZzZZZZZttttttttntntnttk',
    'kvvvuvvuvvututtzzzzzzzZmSZzZZZZZZtttntntnttntttk',
    'kvvvvvvuvvuututzzzzzzzZSmZzZZZZZZttttnttnttttttk',
  ],
};
