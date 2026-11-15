import type { ContainerArt } from '../art/containers.ts';
import { stageBox, stageOffset, stageSprite } from '../game/inventory/container-stage.ts';
import type { ScreenRect } from '../game/inventory/pickup-arrivals.ts';
import { spriteCanvas } from './sprite-cache.ts';

/**
 * The container's picture, stretched so the box that holds both drawings covers the rect exactly. Over the loot
 * grid a cell then sits over its own piece of the object, so where a valid cell is on the picture reads at a glance,
 * and the blocked cells fall on the parts that cannot hold anything. Each drawing is still placed by its anchor inside
 * that box, so emptying the container never shifts it. The same drawing flies between the world and the window, so
 * it lives here where both the loot window and the world renderer can reach it. Smoothing stays off: every art pixel
 * is a block, a little wider or taller.
 */
export function drawStageArt(ctx: CanvasRenderingContext2D, art: ContainerArt, searched: boolean, rect: ScreenRect, alpha = 0.9): void {
  const box = stageBox(art);
  const sprite = stageSprite(art, searched);
  if (!box || !sprite || alpha <= 0) return;
  const at = stageOffset(box, sprite);
  const x0 = rect.x + Math.round((at.x / box.width) * rect.w);
  const y0 = rect.y + Math.round((at.y / box.height) * rect.h);
  const x1 = rect.x + Math.round(((at.x + sprite.w) / box.width) * rect.w);
  const y1 = rect.y + Math.round(((at.y + sprite.h) / box.height) * rect.h);
  const smoothing = ctx.imageSmoothingEnabled;
  const before = ctx.globalAlpha;
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = alpha;
  ctx.drawImage(spriteCanvas(sprite), x0, y0, x1 - x0, y1 - y0);
  ctx.globalAlpha = before;
  ctx.imageSmoothingEnabled = smoothing;
}
