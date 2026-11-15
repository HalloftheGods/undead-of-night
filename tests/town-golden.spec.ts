import { describe, expect, it } from 'vitest';
import { townPrint } from '../shared/town-print.ts';
import { generateWorldMap } from '../shared/world-map.ts';

/**
 * Golden prints: the town every seed 1-20 builds at a level from four of the biomes. A change here means towns are laid
 * out differently, so a guest on an older build would walk a different town: bump PROTOCOL_VERSION and paste in the
 * new prints from the failure.
 */
const GOLDEN: Readonly<Record<number, readonly number[]>> = {
  1: [3613805164, 1388283082, 2678968423, 1205490271, 2457696360, 2954625529, 1368274144, 921016173, 1759080570, 197811174, 2608923555, 1805959879, 3113385911, 2683207094, 1055630801, 4081606220, 411237823, 287415122, 3856766555, 318234609],
  3: [1337761313, 2135175179, 50415317, 3793062490, 926571426, 1422530346, 697372883, 3218303144, 70817420, 3844989574, 1930668428, 759336037, 283825438, 3174019110, 2145781214, 2569143954, 1030080119, 3739009559, 2671437928, 2836383941],
  6: [3441488919, 3626995465, 838192051, 1867562646, 1274831997, 1724506609, 3627443535, 2134342031, 680757540, 1792060378, 3398675872, 1540624738, 3396219331, 469050703, 2012814220, 840694112, 2179998696, 1745314803, 2005164642, 248374081],
  9: [1782920070, 2110276666, 2880430825, 1390315763, 1373175865, 1919936722, 429487594, 3058452491, 3724122366, 748646534, 1627452756, 4119933475, 505581642, 1628923964, 3854927158, 790937419, 2428238551, 222102260, 343984785, 4094877143],
};

describe('golden towns', () => {
  it.each(Object.keys(GOLDEN).map(Number))('level %i: seeds 1-20 build the recorded towns', (level) => {
    const prints = GOLDEN[level].map((_, index) => townPrint(generateWorldMap(index + 1, level)));
    expect(prints).toEqual(GOLDEN[level]);
  }, 60_000);
});
