import { describe, expect, it } from 'vitest';
import { townPrint } from '../shared/town-print.ts';
import { generateWorldMap } from '../shared/world-map.ts';

/**
 * Golden prints: the town every seed 1-20 builds at a level from four of the biomes. A change here means towns are laid
 * out differently, so a guest on an older build would walk a different town: bump PROTOCOL_VERSION and paste in the
 * new prints from the failure.
 */
const GOLDEN: Readonly<Record<number, readonly number[]>> = {
  1: [103973656, 682403019, 3588162919, 2876625100, 348262255, 3450670346, 1394046794, 3793814608, 859269510, 796478289, 779633998, 794525683, 3105321697, 26674110, 169774873, 602650659, 214563233, 4025981868, 2436528008, 2488946973],
  3: [2486038486, 1742349582, 3314966354, 2775204892, 3131369309, 1852108792, 1583135401, 1899735822, 3199990695, 3067900122, 1043394472, 973329647, 358863211, 1159632760, 816251630, 188267639, 2233693581, 2356807718, 2804879744, 2473089211],
  6: [1505507854, 842758316, 2758260025, 3239808701, 3727455614, 2231654934, 3112217202, 642693121, 578013347, 2231503602, 1371574086, 582353666, 3444721978, 1309220740, 1874272759, 1801361997, 3026229009, 2515881215, 1241347445, 1203147976],
  9: [4269261829, 3035582551, 1819367838, 1992109677, 3983274306, 3386718300, 439092779, 290815074, 3085812356, 1970595409, 2473476024, 979411022, 765452133, 2959286579, 3426582643, 89823104, 1308404008, 1634637769, 1445297577, 3639141474],
};

describe('golden towns', () => {
  it.each(Object.keys(GOLDEN).map(Number))('level %i: seeds 1-20 build the recorded towns', (level) => {
    const prints = GOLDEN[level].map((_, index) => townPrint(generateWorldMap(index + 1, level)));
    expect(prints).toEqual(GOLDEN[level]);
  }, 60_000);
});
