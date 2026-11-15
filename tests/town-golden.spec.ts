import { describe, expect, it } from 'vitest';
import { townPrint } from '../shared/town-print.ts';
import { generateWorldMap } from '../shared/world-map.ts';

/**
 * Golden prints: the town every seed 1-20 builds at a level from four of the biomes. A change here means towns are laid
 * out differently, so a guest on an older build would walk a different town: bump PROTOCOL_VERSION and paste in the
 * new prints from the failure.
 */
const GOLDEN: Readonly<Record<number, readonly number[]>> = {
  1: [1427233494, 1535899836, 1363108409, 326099981, 1900686905, 1729840275, 1873161072, 4041148641, 1644312400, 4277367914, 583937727, 68568317, 1299723292, 3470691787, 2352840407, 417631662, 3342609812, 173514995, 1865268397, 1116568459],
  3: [2936602992, 476292155, 1073640601, 4175008758, 2423498784, 343105919, 538725387, 2831188464, 1604836021, 1184530463, 74301405, 169819365, 3332575485, 1474334589, 1633024268, 2708782690, 1894185281, 1240633789, 3524719022, 2931555350],
  6: [4057239860, 2429138701, 2718548611, 246906319, 1431779000, 2875784419, 410851224, 97977704, 1036855501, 339936797, 96245783, 4181735965, 918618208, 2772553160, 737004189, 2446606262, 3838479562, 1597017350, 507420807, 1365637441],
  9: [574155767, 3528114924, 1315962993, 1345266751, 1479070672, 2369495297, 3094005776, 3347140215, 4043834787, 541211307, 2907659865, 3189411919, 2224914082, 2587914520, 747368350, 310680247, 4044194686, 841938854, 1701403791, 3771766527],
};

describe('golden towns', () => {
  it.each(Object.keys(GOLDEN).map(Number))('level %i: seeds 1-20 build the recorded towns', (level) => {
    const prints = GOLDEN[level].map((_, index) => townPrint(generateWorldMap(index + 1, level)));
    expect(prints).toEqual(GOLDEN[level]);
  }, 60_000);
});
