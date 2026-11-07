import { describe, expect, it } from 'vitest';
import { ParticleSystem } from '../src/engine/particles.ts';
import type { Dot } from '../src/engine/particles.ts';

const dot = (): Dot => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, color: '#fff', size: 1, emissive: false });

describe('ParticleSystem under a budget', () => {
  it('takes only its share of new dots, keeping what is already flying', () => {
    const particles = new ParticleSystem(() => {});
    for (let i = 0; i < 1000; i += 1) particles.addDot(dot());
    const full = particles.dots.length;
    particles.setShare(0.25);
    particles.addDot(dot());
    expect(particles.dots.length).toBe(full);
    particles.clear();
    for (let i = 0; i < 1000; i += 1) particles.addDot(dot());
    expect(particles.dots.length).toBe(Math.round(full * 0.25));
  });
});
