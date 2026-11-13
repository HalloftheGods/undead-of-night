import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../shared/protocol.ts';
import { CAMP_COLS, CAMP_RING_TILES, CAMP_ROWS, CAMP_SIZES, GATE_ROWS, clampCampSize, fenceSections, gapGround, ringRect } from '../shared/camp/camp-ring.ts';
import type { FenceSection } from '../shared/camp/camp-ring.ts';

const onSide = (sections: readonly FenceSection[], side: FenceSection['side']): FenceSection[] => sections.filter((s) => s.side === side);
const span = (sections: FenceSection[], axis: 'x' | 'y'): number =>
  sections.reduce((sum, s) => sum + (axis === 'x' ? gapGround(s).x1 - gapGround(s).x0 : gapGround(s).y1 - gapGround(s).y0), 0);

describe('camp fence ring', () => {
  it('reads a camp size from anything', () => {
    expect([Number.NaN, -3, 0, 1, 2.9, 5, 99, Infinity].map(clampCampSize)).toEqual([1, 1, 1, 1, 2, 5, 5, 1]);
  });

  it('keeps the east side and the middle fixed and grows west, north and south', () => {
    expect(ringRect(1)).toEqual({ col0: 32, row0: 17, col1: 55, row1: 30 });
    expect(ringRect(5)).toEqual({ col0: 16, row0: 11, col1: 55, row1: 36 });
    for (const size of CAMP_SIZES) {
      const rect = ringRect(size);
      const small = ringRect(1);
      expect(rect.col1).toBe(55);
      expect(rect.col0).toBeLessThanOrEqual(small.col0);
      expect(rect.row0).toBeLessThanOrEqual(small.row0);
      expect(rect.row1).toBeGreaterThanOrEqual(small.row1);
      expect(rect.col1 - rect.col0 + 1).toBe(CAMP_RING_TILES[size].w);
      expect(rect.row1 - rect.row0 + 1).toBe(CAMP_RING_TILES[size].h);
    }
  });

  it('leaves at least 11 tiles of wilderness round the largest ring', () => {
    const rect = ringRect(5);
    expect(Math.min(rect.col0, rect.row0, CAMP_COLS - 1 - rect.col1, CAMP_ROWS - 1 - rect.row1)).toBeGreaterThanOrEqual(11);
  });

  it.each(CAMP_SIZES)('closes the ring at size %i: each side is covered end to end', (size) => {
    const rect = ringRect(size);
    const sections = fenceSections(size);
    const wide = (rect.col1 - rect.col0 + 1) * TILE_SIZE;
    const tall = (rect.row1 - rect.row0 + 1) * TILE_SIZE;
    expect(span(onSide(sections, 'n'), 'x')).toBe(wide);
    expect(span(onSide(sections, 's'), 'x')).toBe(wide);
    expect(span(onSide(sections, 'e'), 'y')).toBe(tall);
    expect(span(onSide(sections, 'w'), 'y')).toBe(tall);
    expect(sections.map((s) => s.index)).toEqual(sections.map((_, i) => i));
    // Clockwise from the north-west corner: the north side runs east, the south side runs west, the west side runs north.
    expect(onSide(sections, 'n')[0].x).toBeLessThan(onSide(sections, 'n')[1].x);
    expect(onSide(sections, 's')[0].x).toBeGreaterThan(onSide(sections, 's')[1].x);
    expect(onSide(sections, 'w')[0].y).toBeGreaterThan(onSide(sections, 'w')[1].y);
    // Each side's footprint lies just outside the fenced ground.
    expect(gapGround(onSide(sections, 'n')[0]).y1).toBe(rect.row0 * TILE_SIZE);
    expect(gapGround(onSide(sections, 's')[0]).y0).toBe((rect.row1 + 1) * TILE_SIZE);
    expect(gapGround(onSide(sections, 'w')[0]).x1).toBe(rect.col0 * TILE_SIZE);
    expect(gapGround(onSide(sections, 'e')[0]).x0).toBe((rect.col1 + 1) * TILE_SIZE);
  });

  it.each(CAMP_SIZES)('has one gate at the same place at size %i, and never breaks it, a stub or a side end', (size) => {
    const sections = fenceSections(size);
    const gates = sections.filter((s) => s.kind === 'camp_gate');
    expect(gates).toHaveLength(1);
    expect(gates[0].side).toBe('e');
    expect(gapGround(gates[0])).toMatchObject({ y0: GATE_ROWS.top * TILE_SIZE, y1: (GATE_ROWS.bottom + 1) * TILE_SIZE });
    expect(gates[0].x).toBe(fenceSections(1).find((s) => s.kind === 'camp_gate')?.x);
    for (const side of ['n', 'e', 's', 'w'] as const) {
      const run = onSide(sections, side);
      expect(run[0].breachable).toBe(false);
      expect(run[run.length - 1].breachable).toBe(false);
    }
    expect(sections.filter((s) => s.kind === 'camp_gate' || s.kind === 'camp_post').every((s) => !s.breachable)).toBe(true);
    expect(sections.filter((s) => s.breachable).length).toBeGreaterThanOrEqual(20);
  });

  it('points every section away from the camp', () => {
    const rect = ringRect(3);
    const centre = { x: ((rect.col0 + rect.col1 + 1) / 2) * TILE_SIZE, y: ((rect.row0 + rect.row1 + 1) / 2) * TILE_SIZE };
    for (const s of fenceSections(3)) {
      const box = gapGround(s);
      const mid = { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 };
      expect((mid.x - centre.x) * s.out.x + (mid.y - centre.y) * s.out.y).toBeGreaterThan(0);
    }
  });
});
