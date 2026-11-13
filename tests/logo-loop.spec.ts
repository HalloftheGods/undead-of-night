import { describe, expect, it } from 'vitest';
import { buildLogo, buildLogoFrames } from '../src/art/fx/logo.ts';
import { LOGO_FPS } from '../src/components/use-logo-loop.ts';

describe('title logo loop', () => {
  const frames = buildLogoFrames(8);

  it('makes one frame per step, all the same size as the still logo', () => {
    const still = buildLogo();
    expect(frames).toHaveLength(8);
    for (const frame of frames) {
      expect(frame.w).toBe(still.w);
      expect(frame.h).toBe(still.h);
      expect(frame.rgba.length).toBe(still.rgba.length);
    }
  });

  it('starts on the still logo and moves the blood after that', () => {
    const still = buildLogo();
    expect(Buffer.from(frames[0].rgba).equals(Buffer.from(still.rgba))).toBe(true);
    expect(Buffer.from(frames[4].rgba).equals(Buffer.from(frames[0].rgba))).toBe(false);
  });

  it('runs slowly', () => {
    expect(LOGO_FPS).toBeLessThanOrEqual(2);
  });
});
