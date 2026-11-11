// Interface art: crosshair, weapon and pickup icons, heart and skull. Each is a hand
// placed grid. Body grids get one dark outline so they hold on any background.

import type { PickupType, WeaponId } from '../../../shared/protocol.ts';
import type { PixelSprite } from '../types.ts';
import { PixelCanvas } from '../kit.ts';
import type { Legend } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import { KIT_ART } from './kits.ts';
import { PART_ART } from './parts.ts';
import { gridSprite } from './shared.ts';
import type { Grid } from './shared.ts';
import { BANDAGE, CARBINE_AMMO, PISTOL_AMMO, SHELLS } from './pickups.ts';
import { JEWEL_LARGE, JEWEL_SMALL, SILVER, TREASURE_LEGEND } from './treasure.ts';
import { SURVIVAL_ITEM_ART, SURVIVAL_LEGEND } from './survival-art.ts';

const { blood, bone, fire, ink, metal, olive, rot, violet, wood } = RAMPS;

const ICON: Legend = {
  k: ink[0], K: ink[1],
  e: bone[3], f: bone[2], g: bone[1], h: bone[0],
  v: rot[0], d: rot[1], q: rot[2], Q: rot[3],
  r: blood[0], s: blood[1], t: blood[2], u: blood[3],
  m: metal[0], n: metal[1], o: metal[2], p: metal[3],
  a: olive[0], b: olive[1], c: olive[2],
  w: wood[0], x: wood[1], y: wood[2], z: wood[3],
  Y: fire[3], B: fire[2], C: fire[1], D: fire[0],
  i: violet[0], j: violet[1], l: violet[2],
  ...TREASURE_LEGEND,
};

const CROSSHAIR: Grid = [
  '.....kkk.....',
  '.....kek.....',
  '.....kek.....',
  '.....kek.....',
  '.....kkk.....',
  'kkkkk.k.kkkkk',
  'keeekkukkeeek',
  'kkkkk.k.kkkkk',
  '.....kkk.....',
  '.....kek.....',
  '.....kek.....',
  '.....kek.....',
  '.....kkk.....',
];

const PISTOL: Grid = [
  '.................p..',
  '.oppppppppppppppppp.',
  '.onononoonnnnnnnnnn.',
  '.nnnnnnnnnnnnnnnnnm.',
  '.mmmmmmmmmmmmmmmmm..',
  '.mnnnnnn.m..m.......',
  '.nxxxxm..m.m........',
  '.xyyyxm...m.........',
  'xyzyxm..............',
  'xyyxxm..............',
  'xxxwwm..............',
];

const CARBINE: Grid = [
  '.........oooooooo.............',
  '.........nnnnnnnn.......p.....',
  'nn......oppppppppcccccccpn.nn.',
  'onnnnnnnopoooooooccbcbcbbppppp',
  'on...nnnonnnnnnnnbbabababnnnnn',
  'on.nnn..nnnnnnnnnbbbbbbba..nn.',
  'onnn.....mmnm..mnnm...........',
  'nn.......mnm.nn.noom..........',
  '........mnm.....noom..........',
  '........mnm......noom.........',
  '.......mmm.......nnom.........',
];

const SHOTGUN: Grid = [
  '...........oooo...............',
  '..........oppppppppppppppppppp',
  '.......xynoooooooooooooooooooo',
  '..zyyyyyzynnnnnnzzzzzzzyynnnnn',
  'zzyyyyyxxxnnmnnnyyyxyxyxxmmmmm',
  'zyyyxxxww.nmm.nnxxxxxxxxw.....',
  'yyxxxw....mm.m................',
  'yxxw.......m..................',
  'xw............................',
];

const MEDKIT: Grid = [
  '....nppn....',
  '....n..n....',
  'eeeeeeeeeeef',
  'eeeeeuteeeef',
  'eeeeeuteeeef',
  'eeuutttttsef',
  'eetttttttsef',
  'eeeeeutseeef',
  'eeeeeutseeff',
  'fggggggggggh',
];

const CARBINE_SMALL: Grid = [
  '......ooo....',
  'nn...ppppccc.',
  'onnnnooooccbp',
  'on..nnnn.....',
  'n....mn......',
  '.....mn......',
  '......m......',
];

/** The earlier drawing of CARBINE_SMALL, kept to switch back to. */
export const CARBINE_SMALL_OLD: Grid = [
  '...........op',
  '..........opn',
  '.........opn.',
  '........opn..',
  '.......opnn..',
  '......opnnom.',
  '.....opnn.nom',
  '....opnnm..nm',
  '...opnmnm....',
  '..onn.mnm....',
  '.onn...m.....',
  'onn..........',
  'nn...........',
];

const SHOTGUN_SMALL: Grid = [
  '.....pppppppp',
  'zzyxnooooooo.',
  'zyyxnnyyyx...',
  'yxw..........',
];

/** The earlier drawing of SHOTGUN_SMALL, kept to switch back to. */
export const SHOTGUN_SMALL_OLD: Grid = [
  '...........pp',
  '..........pon',
  '.........pon.',
  '........pon..',
  '.......zyn...',
  '......zyx....',
  '.....pnw.....',
  '....ponn.....',
  '...zon.n.....',
  '..zyx........',
  '.zyx.........',
  'zyx..........',
  'yxw..........',
];

const KNIFE_SMALL: Grid = [
  '...........ee',
  '.........eepo',
  '........eppo.',
  '.......eppo..',
  '......eppo...',
  '.....eppo....',
  '...eeppo.....',
  '....mmo......',
  '...zyx.......',
  '..zyx........',
  '.zyx.........',
  'zyx..........',
  'xw...........',
];

/** The flat, horizontal knife, kept to switch back to. */
export const KNIFE_SMALL_FLAT: Grid = [
  '......noooop.',
  'zyyyxmnpppppp',
  'zyyyxmnppeep.',
  'xxxxwmnooo...',
  '......n......',
];

/** The earlier drawing of KNIFE_SMALL, kept to switch back to. */
export const KNIFE_SMALL_OLD: Grid = [
  '...........pe',
  '..........ppo',
  '.........ppo.',
  '........ppo..',
  '.......ppo...',
  '......ppo....',
  '.....ppo.....',
  '...nnpo......',
  '...znnn......',
  '..zyxn.......',
  '.zyx.........',
  'zyx..........',
  'xw...........',
];

const HEART: Grid = [
  '..ttt...ttt..',
  '.tuuut.tttts.',
  'tueeuttttttss',
  'tueutttttttss',
  'tuutttttttsss',
  '.ttttttttsss.',
  '..ttttttsss..',
  '...tttsss....',
  '....tsss.....',
  '.....ss......',
];

/** An empty green bottle with a cork. */
const BOTTLE: Grid = [
  '..x..',
  '..y..',
  '.aba.',
  '.abc.',
  '.abc.',
  'abbcc',
  'abbec',
  'abbec',
  'abbcc',
  'abbcc',
  'abbcc',
  '.aaa.',
];

/** A ground spinner firework: a striped drum with its fuse lit. Lit and tossed, it whirls sparks on the street. */
const FIREWORKS: Grid = [
  '.YB.jjj....',
  '...jjjtt...',
  '..jjjjttt.B',
  '..jjjYttt.Y',
  'Y.ttttjjj..',
  'B..ttjjj...',
  '....tjj.BY.',
];

/** The earlier drawing of FIREWORKS, kept to switch back to. */
export const FIREWORKS_OLD: Grid = [
  '......Y....',
  '.....YBY...',
  '......C....',
  '.....n.....',
  '..gffnffg..',
  '.gfeeeeefg.',
  '.ijjjjjjll.',
  '.rsssssstt.',
  '.ijjjjjjll.',
  '.rsssssstt.',
  '.ijjjjjjll.',
  '..rrsssst..',
];

/** A fountain firework: a striped cone on a card base, lit and spraying sparks straight up. */
const FOUNTAIN: Grid = [
  '..Y..Y..Y..',
  '.B..YBY..B.',
  '...B.Y.B...',
  '....YBY....',
  '.....e.....',
  '....rst....',
  '....YBB....',
  '...rsstu...',
  '...rsstt...',
  '..YYBBBBC..',
  '..rsssttu..',
  '.gffffffee.',
];

/** The earlier drawing of FOUNTAIN, kept to switch back to. */
export const FOUNTAIN_OLD: Grid = [
  '.Y...B...Y.',
  '...Y.Y.Y...',
  '.B..YBY..B.',
  '....YYY....',
  '....gfe....',
  '....HHI....',
  '...rsstt...',
  '...GHHHI...',
  '..rssssst..',
  '..GHHHHHI..',
  '.rsssssstt.',
  '.ggfffffee.',
];

const SKULL: Grid = [
  '...eeeeeee...',
  '.eeeeeeeeeff.',
  '.eeeeeeeefff.',
  'eeeeeeeeeefgg',
  'eekkkeeekkkfg',
  'eekkkeeekkkfg',
  'eekkkefekkkgg',
  '.eeeeeKeeefg.',
  '..feeKkKefg..',
  '...efffffg...',
  '...ekekekg...',
  '...fkfkfkg...',
];

const RADIO_SMALL: Grid = [
  '.........p...',
  '........p....',
  '.ccccccccccc.',
  'cbbbbbbbbbbba',
  'cbmnmbeeeeeba',
  'cbnmnbefrfeba',
  'cbmnmbeeeeeba',
  'cbnmnbbbbbbba',
  'cbmnmbbpbpbba',
  'cbbbbbbbbbbba',
  'aaaaaaaaaaaaa',
];

/**
 * A walker's head, for the HUD's kill count. Rotten flesh, sunken sockets and a few teeth left:
 * the same green the zombies are drawn in, so the number plainly counts them and not anything else.
 */
const ZOMBIE_HEAD: Grid = [
  '...ddddd...',
  '..dqQQqqd..',
  '.dqqqqqqqd.',
  '.dqkqqqkqd.',
  '.dkkqqqkkd.',
  '.dqqqvqqqd.',
  '.dqqvvvqqd.',
  '.dqkkkkkqd.',
  '.dqeqeqeqd.',
  '..dqqqqqd..',
  '...ddddd...',
];

/** A twist-wrapped sweet: pale wrapper pinched either side of an amber body. */
const CANDY: Grid = [
  '....ttttt....',
  'e..tueettr..e',
  'effteetteeffe',
  'e..settees..e',
  '....sssss....',
];

/** The earlier drawing of CANDY, kept to switch back to. */
export const CANDY_OLD: Grid = [
  '.....CCC.....',
  '.f..CBBBC..f.',
  'ffgCBBYBBCgff',
  'ffgCBBBBBCgff',
  '.f..CCCCC..f.',
  '.....CCC.....',
];

/** The town map, folded in three: paper, creases, blocks, and a mark where the van waits. */
const TOWN_MAP: Grid = [
  'eeegeeegeee',
  'bbegbbegebb',
  'bbegbbegebb',
  'eeegeeegeee',
  'ggggggggggg',
  'eeegtetgeee',
  'bbegetegebb',
  'bbegtetgebb',
  'eeegeeegeee',
];

/** Centres a body grid in a fixed cell, leaving room for the outline. */
function outlined(rows: Grid, w: number, h: number, legend: Legend = ICON): PixelSprite {
  const width = Math.max(...rows.map((row) => row.length));
  const x = Math.floor((w - width) / 2);
  const y = Math.floor((h - rows.length) / 2);
  const canvas = new PixelCanvas(w, h).grid(x, y, rows, legend).outline({ color: ink[0] });
  return canvas.toSprite(w, h, Math.floor(w / 2), Math.floor(h / 2));
}

export function buildCrosshair(): PixelSprite {
  return gridSprite(CROSSHAIR, ICON, 6, 6);
}

export function buildCrosshairHead(): PixelSprite {
  return gridSprite(CROSSHAIR, { ...ICON, e: blood[3] }, 6, 6);
}

export function buildWeaponIcons(): Record<WeaponId, PixelSprite> {
  return { pistol: outlined(PISTOL, 32, 14), carbine: outlined(CARBINE, 32, 14), shotgun: outlined(SHOTGUN, 32, 14) };
}

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

export function buildPickupIcons(): Record<PickupType, PixelSprite> {
  return {
    medkit: outlined(MEDKIT, 15, 15),
    bandage: outlined(BANDAGE, 15, 15),
    pistol_ammo: outlined(PISTOL_AMMO, 15, 15),
    carbine_ammo: outlined(CARBINE_AMMO, 15, 15),
    shells: outlined(SHELLS, 15, 15),
    carbine: outlined(CARBINE_SMALL, 15, 15),
    shotgun: outlined(SHOTGUN_SMALL, 15, 15),
    knife: outlined(KNIFE_SMALL, 15, 15),
    radio: outlined(RADIO_SMALL, 15, 15),
    canned_food: outlined(SURVIVAL_ITEM_ART.canned_food.rows, 15, 15, SURVIVAL_LEGEND),
    water_bottle: outlined(SURVIVAL_ITEM_ART.water_bottle.rows, 15, 15, SURVIVAL_LEGEND),
    disinfectant: outlined(SURVIVAL_ITEM_ART.disinfectant.rows, 15, 15, SURVIVAL_LEGEND),
    antibiotics: outlined(SURVIVAL_ITEM_ART.antibiotics.rows, 15, 15, SURVIVAL_LEGEND),
    barrel: outlined(PART_ART.barrel.rows, 15, 15),
    grip: outlined(PART_ART.grip.rows, 15, 15),
    magazine: outlined(PART_ART.magazine.rows, 15, 15),
    suppressor: outlined(PART_ART.suppressor.rows, 15, 15),
    toolkit: outlined(PART_ART.toolkit.rows, 15, 15),
    incendiary_kit: outlined(KIT_ART.incendiary_kit.rows, 15, 15),
    acid_kit: outlined(KIT_ART.acid_kit.rows, 15, 15),
    piercing_kit: outlined(KIT_ART.piercing_kit.rows, 15, 15),
    tranq_kit: outlined(KIT_ART.tranq_kit.rows, 15, 15),
    jewel_small: outlined(JEWEL_SMALL, 15, 15),
    jewel_large: outlined(JEWEL_LARGE, 15, 15),
    // Stand-ins drawn as the kit each makes, until salvage gets its own icons (#7242).
    fuel_can: outlined(KIT_ART.incendiary_kit.rows, 15, 15),
    car_battery: outlined(KIT_ART.acid_kit.rows, 15, 15),
    scrap_steel: outlined(KIT_ART.piercing_kit.rows, 15, 15),
    sedatives: outlined(KIT_ART.tranq_kit.rows, 15, 15),
    plank: outlined(PLANK_GRID, 15, 15),
    nails: outlined(NAILS_GRID, 15, 15),
    hammer_tool: outlined(HAMMER_GRID, 15, 15),
    sheet_curtain: outlined(CURTAIN_GRID, 15, 15),
    crowbar: outlined(CROWBAR_GRID, 15, 15),
  };
}

/** The money icon, drawn at the jewels' size so a price sits level with them. */
export function buildSilverIcon(): PixelSprite {
  return outlined(SILVER, 15, 15);
}

export function buildHeart(): PixelSprite {
  return outlined(HEART, 15, 12);
}

export function buildBottle(): PixelSprite {
  return outlined(BOTTLE, 15, 14);
}

export function buildFireworks(): PixelSprite {
  return outlined(FIREWORKS, 15, 14);
}

export function buildFountain(): PixelSprite {
  return outlined(FOUNTAIN, 15, 14);
}

export function buildSkull(): PixelSprite {
  return outlined(SKULL, 15, 14);
}

export function buildZombieHead(): PixelSprite {
  return outlined(ZOMBIE_HEAD, 15, 14);
}

export function buildCandy(): PixelSprite {
  return outlined(CANDY, 15, 14);
}

export function buildTownMap(): PixelSprite {
  return outlined(TOWN_MAP, 15, 14);
}
