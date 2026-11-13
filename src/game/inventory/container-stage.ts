import type { ContainerArt } from '../../art/containers.ts';
import type { PixelSprite } from '../../art/types.ts';

/**
 * A container has two whole drawings, shut and searched, anchored on the same spot like every prop. In the
 * world they sit exactly on each other, so the swap looks like the lid lifting. The loot window must keep that:
 * both are placed by their anchors inside one box that holds both, never each fitted on its own, or the art
 * would jump when the container is emptied.
 */
export interface StageBox {
  /** The box that holds every drawing, in art pixels, relative to the shared anchor. */
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

export function stageBox(art: ContainerArt): StageBox | null {
  const sprites = [art.closed, art.opened].filter((s): s is PixelSprite => Boolean(s));
  if (sprites.length === 0) return null;
  const minX = Math.min(...sprites.map((s) => -s.ax));
  const minY = Math.min(...sprites.map((s) => -s.ay));
  const maxX = Math.max(...sprites.map((s) => s.w - s.ax));
  const maxY = Math.max(...sprites.map((s) => s.h - s.ay));
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

/** Which drawing shows: the shut one while there is still something inside, the searched one once it is empty. */
export function stageSprite(art: ContainerArt, hasItems: boolean): PixelSprite | null {
  return hasItems ? (art.closed ?? art.opened ?? null) : (art.opened ?? art.closed ?? null);
}

/** Where a drawing sits inside the box, in art pixels from the box's top left. */
export function stageOffset(box: StageBox, sprite: PixelSprite): { x: number; y: number } {
  return { x: -sprite.ax - box.minX, y: -sprite.ay - box.minY };
}
