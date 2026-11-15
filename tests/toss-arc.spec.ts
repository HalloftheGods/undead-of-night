import { describe, expect, it } from 'vitest';
import { arcHeight, BOUNCE_AT, groundProgress } from '../src/engine/toss-arc.ts';

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
});
