import { describe, expect, it } from 'vitest';
import { generateBunkerMap } from '../shared/bunker-map.ts';
import { OVERRUN_GAP_SPACING, gapCount, gapSpawnCentre, pickGaps } from '../shared/camp/breach-pick.ts';
import { CAMP_SIZES, fenceSections, gapGround } from '../shared/camp/camp-ring.ts';
import { settleFence } from '../shared/camp/fence-fall.ts';
import { FlowField } from '../shared/flow-field.ts';
import { createRng } from '../shared/rng.ts';
import { TILE_SIZE } from '../shared/protocol.ts';
import { circleHitsSolid, isLifted } from '../shared/world-query.ts';

/** What the flow field's distance reads for a tile it cannot reach. */
const UNREACHED = 0xffff;
const ringGap = (n: number, a: number, b: number): number => Math.min(Math.abs(a - b), n - Math.abs(a - b));

describe('how many places the fence gives', () => {
  it('gives in more places the further the room has been and the harder the run', () => {
    expect(gapCount(2, 'night_light')).toBe(1);
    expect(gapCount(3, 'stay_close')).toBe(1);
    expect(gapCount(3, 'lights_out')).toBe(2);
    expect(gapCount(5, 'stay_close')).toBe(2);
    expect(gapCount(7, 'night_light')).toBe(3);
    expect(gapCount(10, 'undead_tired')).toBe(4);
    for (const level of [0, 1, 2]) expect(gapCount(level, 'night_light')).toBeGreaterThanOrEqual(1);
  });
});

describe('which sections give', () => {
  it.each(CAMP_SIZES)('picks only breachable sections, never side by side, spread round the ring where it can, at size %i', (size) => {
    const sections = fenceSections(size);
    for (const count of [1, 2, 3, 4]) {
      for (let seed = 1; seed <= 25; seed++) {
        let draws = 0;
        const rng = createRng(seed);
        const counted = (): number => {
          draws += 1;
          return rng();
        };
        const gaps = pickGaps(sections, count, counted);
        expect(gaps.length, `count ${count} seed ${seed}`).toBeGreaterThanOrEqual(1);
        expect(gaps.length).toBeLessThanOrEqual(count);
        expect(draws).toBeLessThanOrEqual(count);
        expect([...gaps].sort((a, b) => a - b)).toEqual(gaps);
        for (const i of gaps) expect(sections[i].breachable, `section ${i}`).toBe(true);
        for (const a of gaps) for (const b of gaps) if (a !== b) expect(ringGap(sections.length, a, b)).toBeGreaterThanOrEqual(2);
        const spread = gaps.every((a) => gaps.every((b) => a === b || ringGap(sections.length, a, b) >= OVERRUN_GAP_SPACING));
        if (count <= 2) expect(spread, `count ${count} seed ${seed}`).toBe(true);
      }
    }
  });

  it('gives as many as the run asks for on the largest camp', () => {
    expect(pickGaps(fenceSections(5), 4, createRng(7))).toHaveLength(4);
  });

  it('is the same pick from the same rolls', () => {
    expect(pickGaps(fenceSections(3), 3, createRng(99))).toEqual(pickGaps(fenceSections(3), 3, createRng(99)));
  });
});

describe('where the horde comes from', () => {
  it.each(CAMP_SIZES)('has open ground outside every breachable section at size %i, with a way in through that gap alone', (size) => {
    const map = generateBunkerMap(size);
    const sections = map.camp?.sections ?? [];
    for (const section of sections.filter((s) => s.breachable)) {
      const centre = gapSpawnCentre(section);
      expect(circleHitsSolid(map, centre.x, centre.y, 12), `section ${section.index}`).toBe(false);
      const walk = new FlowField(map);
      walk.recompute([map.spawn]);
      expect(walk.distanceAt(centre.x, centre.y), `section ${section.index} before it falls`).toBeGreaterThanOrEqual(UNREACHED);
      settleFence(map, [section.index]);
      const opened = new FlowField(map);
      opened.recompute([map.spawn]);
      expect(opened.distanceAt(centre.x, centre.y), `section ${section.index} once it falls`).toBeLessThan(UNREACHED);
      settleFence(map, []);
    }
  });
});

describe('the fence falling', () => {
  it('lifts exactly the fallen sections, and stands them back up', () => {
    const map = generateBunkerMap(2);
    const breachable = (map.camp?.sections ?? []).filter((s) => s.breachable);
    const [a, b] = [breachable[2], breachable[9]];
    expect(settleFence(map, [a.index, b.index])).toBe(true);
    expect(settleFence(map, [a.index, b.index])).toBe(false);
    expect(isLifted(map, a.index) && isLifted(map, b.index)).toBe(true);
    const box = gapGround(a);
    expect(circleHitsSolid(map, (box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, 2)).toBe(false);
    expect(settleFence(map, [b.index])).toBe(true);
    expect(isLifted(map, a.index)).toBe(false);
    expect(circleHitsSolid(map, (box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, 2)).toBe(true);
    settleFence(map, []);
    expect(isLifted(map, b.index)).toBe(false);
  });

  it('puts the spawn of a gap 4 to 7 tiles out', () => {
    for (const section of fenceSections(3).filter((s) => s.breachable)) {
      const box = gapGround(section);
      const mid = { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 };
      const centre = gapSpawnCentre(section);
      const out = Math.hypot(centre.x - mid.x, centre.y - mid.y) / TILE_SIZE;
      expect(out).toBeGreaterThanOrEqual(5);
      expect(out).toBeLessThanOrEqual(6);
    }
  });
});
