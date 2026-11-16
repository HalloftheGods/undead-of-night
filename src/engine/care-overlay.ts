import type { PlayerEntity } from '../../shared/protocol.ts';
import type { ArtBook } from '../art/types.ts';
import { careHint, setCareOffer } from '../game/inventory/care-hover.ts';
import type { CareBox } from '../game/inventory/care-hover.ts';
import { lootSprite } from '../game/inventory/loot-item-art.ts';
import { drawOutlinedText } from './bitmap-font.ts';
import type { SceneView } from './scene.ts';
import { drawOutline, drawSprite } from './sprite-cache.ts';
import type { VisualStore } from './visuals.ts';

const AMBER = '#ffc14d';
const DIM = '#8a8d97';
const RING_RADIUS = 7;
/** The survivor's box on screen, half the width and the height above and below their feet. */
const HALF_WIDTH = 14;
const BOX_ABOVE = 30;
const BOX_BELOW = 6;
const LABEL_ABOVE = 40;
/** How high the item floats between the pair. */
const ITEM_LIFT = 12;

interface ClientMap {
  readonly x: (bufferX: number) => number;
  readonly y: (bufferY: number) => number;
}

/** Hands-on care as everyone sees it: the item floating between giver and receiver, the receiver outlined, a ring filling. */
export class CareOverlay {
  private readonly art: ArtBook;
  private readonly visuals: VisualStore;

  constructor(art: ArtBook, visuals: VisualStore) {
    this.art = art;
    this.visuals = visuals;
  }

  /** The item in hand over a teammate it would help: ringed, with what it would do. Reports where every teammate stands for the click. */
  drawOffer(ctx: CanvasRenderingContext2D, scene: SceneView, left: number, top: number, client: ClientMap): void {
    const me = scene.players.find((each) => each.id === scene.localId);
    const held = scene.held;
    if (!held || !me) return setCareOffer(null, []);
    const mates = scene.players.filter((each) => each.id !== me.id);
    const boxes: CareBox[] = mates.map((mate) => this.boxOf(mate, left, top, client));
    const hint = careHint(held, mates, me);
    setCareOffer(hint, boxes);
    if (!hint) return;
    const mate = mates.find((each) => each.id === hint.id)!;
    const x = Math.round(mate.x - left);
    const y = Math.round(mate.y - top);
    const isOver = held.x >= x - HALF_WIDTH && held.x <= x + HALF_WIDTH && held.y >= y - BOX_ABOVE && held.y <= y + BOX_BELOW;
    if (!isOver) return;
    const color = hint.inReach ? AMBER : DIM;
    const sprite = this.visuals.get(mate.id).sprite;
    if (sprite) drawOutline(ctx, sprite, x, y, color);
    const label = hint.inReach ? hint.label : `${hint.label} (TOO FAR)`;
    drawOutlinedText(ctx, label.toUpperCase(), x, y - LABEL_ABOVE, color);
  }

  private boxOf(mate: PlayerEntity, left: number, top: number, client: ClientMap): CareBox {
    const x = Math.round(mate.x - left);
    const y = Math.round(mate.y - top);
    const x0 = client.x(x - HALF_WIDTH);
    const y0 = client.y(y - BOX_ABOVE);
    return { id: mate.id, x: x0, y: y0, w: client.x(x + HALF_WIDTH) - x0, h: client.y(y + BOX_BELOW) - y0 };
  }

  /** Every care in progress: the item rising between the two, the receiver outlined, a ring closing as it goes. */
  draw(ctx: CanvasRenderingContext2D, scene: SceneView, left: number, top: number): void {
    for (const giver of scene.players) {
      const care = giver.care;
      const receiver = care ? scene.players.find((each) => each.id === care.receiver) : undefined;
      if (!care || !receiver) continue;
      const gx = Math.round(giver.x - left);
      const gy = Math.round(giver.y - top);
      const rx = Math.round(receiver.x - left);
      const ry = Math.round(receiver.y - top);
      const sprite = this.visuals.get(receiver.id).sprite;
      if (sprite) drawOutline(ctx, sprite, rx, ry, AMBER);
      const item = lootSprite(this.art, care.itemType);
      if (item) drawSprite(ctx, item, Math.round((gx + rx) / 2), Math.round((gy + ry) / 2) - ITEM_LIFT);
      this.drawProgress(ctx, rx, ry - BOX_ABOVE, care.progress);
    }
  }

  private drawProgress(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number): void {
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(11, 12, 16, 0.8)';
    ctx.beginPath();
    ctx.arc(x, y, RING_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = AMBER;
    ctx.beginPath();
    ctx.arc(x, y, RING_RADIUS, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
  }
}
