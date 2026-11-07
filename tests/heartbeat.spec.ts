import { describe, expect, it } from 'vitest';
import { beatPeriod, beatPulse, Heartbeat, LOW_HEALTH } from '../src/game/heartbeat.ts';
import { muffleFor } from '../src/audio/audio-engine.ts';

describe('heartbeat', () => {
  it('rests above the low-health band and when down', () => {
    const heart = new Heartbeat();
    expect(heart.tick(0.016, 1)).toBe(false);
    expect(heart.tick(0.016, LOW_HEALTH)).toBe(false);
    expect(heart.tick(0.016, 0)).toBe(false);
    expect(heart.pulse).toBe(0);
  });

  it('beats at once on entering the band, then every period, faster the lower health is', () => {
    const heart = new Heartbeat();
    expect(heart.tick(0.016, 0.2)).toBe(true);
    expect(heart.pulse).toBeCloseTo(1);
    let beats = 0;
    for (let t = 0; t < 10; t += 0.01) if (heart.tick(0.01, 0.2)) beats += 1;
    expect(beats).toBeGreaterThanOrEqual(Math.floor(10 / beatPeriod(0.2)) - 1);
    expect(beatPeriod(0.05)).toBeLessThan(beatPeriod(0.3));
  });

  it('swells with a lub and a softer dub, then fades', () => {
    expect(beatPulse(0)).toBe(1);
    expect(beatPulse(0.19)).toBeGreaterThan(beatPulse(0.18));
    expect(beatPulse(0.19)).toBeLessThan(1);
    expect(beatPulse(1)).toBeLessThan(0.05);
    expect(beatPulse(-1)).toBe(0);
  });

  it('muffles hearing only inside the band, most near death', () => {
    expect(muffleFor(1)).toBe(0);
    expect(muffleFor(0)).toBe(0);
    expect(muffleFor(0.3)).toBeGreaterThan(0);
    expect(muffleFor(0.02)).toBeGreaterThan(muffleFor(0.3));
  });
});
