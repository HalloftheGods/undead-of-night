import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/** The Brightness setting must reach the renderer: the slider is useless if nothing reads it. */
describe('brightness reaches the renderer', () => {
  const stage = readFileSync(new URL('../src/game/run-stage.ts', import.meta.url), 'utf8');
  const renderer = readFileSync(new URL('../src/engine/world-renderer.ts', import.meta.url), 'utf8');

  it('hands the lift for the run (or the saved setting outside a run) to the renderer', () => {
    expect(stage).toContain('renderer?.setBrightness(liftFor(this.difficulty));');
  });

  it('leaves the ambient untouched at zero lift and lifts toward white above it', () => {
    expect(renderer).toContain('this.brightness === 0 ? ambient');
    expect(renderer).toContain('c + (255 - c) * this.brightness');
  });
});
