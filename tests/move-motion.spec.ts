import { afterEach, describe, expect, it } from 'vitest';
import { flightBox } from '../src/engine/loot-arrivals-draw.ts';
import { activePuffs, cellKey, clearMotions, FLY_MS, motionOf, noteMotion, noteShake, POP_MS, PUFF_MS, setArrivalCamera, SHAKE_MS, shakeOf } from '../src/game/inventory/move-motion.ts';

const still = { still: true, toBuffer: (point: { x: number; y: number }) => point, toClient: (point: { x: number; y: number }) => point };

describe('one motion source', () => {
  afterEach(() => {
    clearMotions();
    setArrivalCamera(null);
  });

  it('flies, then pops, then is done', () => {
    noteMotion({ itemId: 'a', itemType: 'medkit', kind: 'fly', from: { world: { x: 50, y: 60 } }, to: null }, 1000);
    expect(motionOf('a', 1000)?.phase).toBe('fly');
    expect(motionOf('a', 1000 + FLY_MS + 1)?.phase).toBe('pop');
    expect(motionOf('a', 1000 + FLY_MS + POP_MS + 1)).toBeNull();
  });

  it('only pops a landing', () => {
    noteMotion({ itemId: 'l', itemType: 'medkit', kind: 'land', from: null, to: null }, 0);
    expect(motionOf('l', 0)?.phase).toBe('pop');
    expect(motionOf('l', POP_MS + 1)).toBeNull();
  });

  it('only pops a flight with nowhere to fly from', () => {
    noteMotion({ itemId: 'n', itemType: 'medkit', kind: 'fly', from: null, to: null }, 0);
    expect(motionOf('n', 0)?.phase).toBe('pop');
  });

  it('flies an item back from the cell it was shown in, at that cell size, into its source', () => {
    noteMotion({ itemId: 'b', itemType: 'medkit', kind: 'back', from: { cell: { buffer: { x: 0, y: 0, w: 10, h: 10 } } }, to: null }, 0);
    const phase = motionOf('b', 0);
    expect(phase).toMatchObject({ kind: 'back', phase: 'fly' });
    const cell = { x: 100, y: 50, w: 20, h: 20 };
    expect(flightBox(phase!.motion, cell, 0)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
    expect(flightBox(phase!.motion, cell, 1)).toEqual(cell);
  });

  it('puffs for its own short time, from the cell it left', () => {
    const origin = { buffer: { x: 4, y: 4, w: 8, h: 8 } };
    noteMotion({ itemId: 'p', itemType: 'bandage', kind: 'puff', from: { cell: origin }, to: null }, 0);
    expect(motionOf('p', PUFF_MS - 1)?.phase).toBe('puff');
    expect(activePuffs(10)).toEqual([{ origin, t: 10 / PUFF_MS }]);
    expect(motionOf('p', PUFF_MS + 1)).toBeNull();
    expect(activePuffs(PUFF_MS + 1)).toEqual([]);
  });

  it('turns every flight into a landing with reduced motion', () => {
    setArrivalCamera(still);
    for (const kind of ['fly', 'back', 'toss'] as const) {
      noteMotion({ itemId: kind, itemType: 'medkit', kind, from: { world: { x: 5, y: 5 } }, to: null }, 100);
      expect(motionOf(kind, 100)).toMatchObject({ kind: 'land', phase: 'pop' });
    }
  });

  it('shakes a refused cell for its time', () => {
    const key = cellKey('pack', 2, 1);
    noteShake(key, 0);
    expect(shakeOf(key, SHAKE_MS / 2)).toBeCloseTo(0.5);
    expect(shakeOf(cellKey('pack', 1, 2), 10)).toBeNull();
    expect(shakeOf(key, SHAKE_MS + 1)).toBeNull();
  });
});
