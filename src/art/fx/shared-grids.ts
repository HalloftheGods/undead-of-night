// Grids that both icons.ts and pickups.ts draw from. They live here so neither file
// has to import the other (icons.ts <-> pickups.ts was a cycle).
import type { Grid } from './shared.ts';

/** A twist-wrapped sweet: pale wrapper pinched either side of an amber body. */
export const CANDY: Grid = [
  '....ttttt....',
  'e..tueettr..e',
  'effteetteeffe',
  'e..settees..e',
  '....sssss....',
];

export const CANDY_GRID: Grid = CANDY;

/** A sawn board leaning corner to corner, a nail at each end. */
export const PLANK_GRID: Grid = [
  '........zzzzx',
  '.......zyyxw.',
  '.......zypxw.',
  '......zyyxw..',
  '.....zyxyw...',
  '.....zyxyw...',
  '....zyyxw....',
  '...zyyxw.....',
  '...zyxxw.....',
  '..zyyxw......',
  '.zypxw.......',
  '.zyyxw.......',
  'xxxww........',
];

/** The earlier drawing of PLANK_GRID, kept to switch back to. */
export const PLANK_GRID_OLD: Grid = [
  '..kzzzzzzzk..',
  '.kzyyyyyyyzk.',
  'kzyyppppyzyzk',
  'kxxxxxxxxxxxk',
  'kxxwyyyyywxxk',
  '.kwwwwwwwwwk.',
];

export const NAILS_GRID: Grid = [
  '..kppk..kppk..',
  '..kppk..kppk..',
  '..kmmk..kmmk..',
  '...knk...knk..',
  '...knk...knk..',
  '....kk....kk..',
];

/** A claw hammer on the diagonal, as the knife lies: wood handle up to a steel head set square across it. */
export const HAMMER_GRID: Grid = [
  '.......o.....',
  '.....nnop....',
  '....m..nop...',
  '........nop..',
  '........ynop.',
  '.......zx.nop',
  '......zx...mn',
  '.....zx......',
  '....zx.......',
  '...zx........',
  '..zx.........',
  '.yw..........',
  'yw...........',
];

/** The earlier drawing of HAMMER_GRID, kept to switch back to. */
export const HAMMER_GRID_OLD: Grid = [
  '..kppmmmoook..',
  '.kpppmnnnnook.',
  '..kppkkkkkkk..',
  '....kzyzk.....',
  '....kzyzk.....',
  '....kxyxk.....',
  '....kwwwwk....',
];

export const CURTAIN_GRID: Grid = [
  'keeeeeeeeeeeek',
  'kffgffgffgfffk',
  'keehffhffhffek',
  'kffgffgffgfffk',
  'keehffhffhffek',
  '.kkkkkkkkkkkk.',
];

/** A red wrecking bar on the diagonal, corner to corner: bare steel gooseneck up top, chisel tip below. */
export const CROWBAR_GRID: Grid = [
  '.......ooo...',
  '......op.nn..',
  '......p..nn..',
  '.........ut..',
  '........ut...',
  '.......ut....',
  '......ut.....',
  '.....ut......',
  '....ut.......',
  '...ut........',
  '..on.........',
  '.on..........',
  'pn...........',
];

/** The earlier drawing of CROWBAR_GRID, kept to switch back to. */
export const CROWBAR_GRID_OLD: Grid = [
  '...kppmmk.....',
  '..kpmnnmok....',
  '..kmnk..kmk...',
  '..kmnk...kk...',
  '..kmnk........',
  '..kmnk........',
  '...kk.........',
];
