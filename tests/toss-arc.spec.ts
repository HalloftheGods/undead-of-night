import { describe, expect, it } from 'vitest';
import { arcHeight, BOUNCE_AT, groundProgress, TossArcs, TOSS_MS } from '../src/engine/toss-arc.ts';

describe('the toss arc', () => {
  it('has no height at either end', () => {
    expect(arcHeight(0)).toBe(0);
    expect(arcHeight(1)).toBe(0);
  });

  it('rises in the main flight and lands once before it bounces', () => {
    expect(arcHeight(BOUNCE_AT / 2)).toBeGreaterThan(10);
    expect(arcHeight(BOUNCE_AT)).toBeCloseTo(0, 5);
  });

  it('bounces after 70% of the toss, lower than the flight', () => {
    expect(BOUNCE_AT).toBe(0.7);
    const bounce = arcHeight((BOUNCE_AT + 1) / 2);
    expect(bounce).toBeGreaterThan(0);
    expect(bounce).toBeLessThan(arcHeight(BOUNCE_AT / 2));
  });

  it('covers the ground in the main flight and then stays put', () => {
    expect(groundProgress(0)).toBe(0);
    expect(groundProgress(BOUNCE_AT)).toBe(1);
    expect(groundProgress(0.9)).toBe(1);
  });

  it('tracks in-flight tosses and suppresses pickup appearance until complete', () => {
    const arcs = new TossArcs();
    const event = { type: 'item_tossed' as const, playerId: 'p1', itemType: 'medkit', fromX: 10, fromY: 10, toX: 100, toY: 100 };
    const now = 1000;
    arcs.handle(event, now);
    expect(arcs.isFlying('medkit', 100, 100, now + 100)).toBe(true);
    expect(arcs.isFlying('medkit', 100, 100, now + TOSS_MS - 1)).toBe(true);
    expect(arcs.isFlying('medkit', 100, 100, now + TOSS_MS + 1)).toBe(false);
    expect(arcs.isFlying('knife', 100, 100, now + 100)).toBe(false);
  });
});
