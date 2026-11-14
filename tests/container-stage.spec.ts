import { describe, expect, it } from 'vitest';
import { stageBox, stageOffset, stageSprite } from '../src/game/inventory/container-stage.ts';
import type { PixelSprite } from '../src/art/types.ts';

const sprite = (w: number, h: number, ax: number, ay: number): PixelSprite => ({ w, h, ax, ay, rgba: new Uint8ClampedArray(w * h * 4) }) as PixelSprite;

describe('a container keeps its art still when it is searched', () => {
  const art = { closed: sprite(10, 10, 5, 10), opened: sprite(12, 8, 6, 10) };

  it('holds both drawings in one box', () => {
    const box = stageBox(art)!;
    expect(box).toEqual({ minX: -6, minY: -10, width: 12, height: 10 });
  });

  it('puts the shared anchor on the same spot for either drawing, so nothing jumps', () => {
    const box = stageBox(art)!;
    const shut = stageOffset(box, art.closed);
    const open = stageOffset(box, art.opened);
    expect(shut.x + art.closed.ax).toBe(open.x + art.opened.ax);
    expect(shut.y + art.closed.ay).toBe(open.y + art.opened.ay);
  });

  it('shows the shut drawing while it is searched and the open one once it has been, loot or none', () => {
    expect(stageSprite(art, false)).toBe(art.closed);
    expect(stageSprite(art, true)).toBe(art.opened);
  });
});
