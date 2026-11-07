import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { drawOutlinedText } from '../src/engine/bitmap-font.ts';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';

describe('drawOutlinedText', () => {
  beforeEach(() => {
    installFakeBrowser();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('draws a whole outlined label in one call, at whole pixels', () => {
    const target = fakeCanvas().getContext();
    const ctx = target as unknown as CanvasRenderingContext2D;
    drawOutlinedText(ctx, '+30 X2.5', 100.4, 50, '#e8a33d');
    drawOutlinedText(ctx, '+30 X2.5', 120, 44.6, '#e8a33d');
    expect(target.drawImageCalls).toBe(2);
  });
});
