import type { GameEvent } from '../../shared/protocol.ts';
import type { ArtBook } from '../art/types.ts';
import { lootSprite } from '../game/inventory/loot-item-art.ts';
import { drawSprite, spriteCanvas } from './sprite-cache.ts';

/** How long a toss takes, from the hand to the last settle. */
export const TOSS_MS = 500;
/** The fraction of the toss spent in the main flight; the rest is the one bounce. */
export const BOUNCE_AT = 0.7;
const FLIGHT_HEIGHT = 22;
const BOUNCE_HEIGHT = 5;

/** Height above the ground at toss progress `t` (0 to 1): rises and falls once, then bounces once and settles. Zero at both ends. */
export function arcHeight(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  if (t < BOUNCE_AT) {
    const u = t / BOUNCE_AT;
    return FLIGHT_HEIGHT * 4 * u * (1 - u);
  }
  const u = (t - BOUNCE_AT) / (1 - BOUNCE_AT);
  return BOUNCE_HEIGHT * 4 * u * (1 - u);
}

/** How far along the ground the item is at progress `t`: it covers the distance in the main flight and then stays. */
export function groundProgress(t: number): number {
  return Math.min(1, Math.max(0, t / BOUNCE_AT));
}

interface Toss {
  readonly type: string;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly at: number;
}

/** Every survivor's tosses in flight (`item_tossed`), drawn for everyone with a shadow on the ground. */
export class TossArcs {
  private tosses: Toss[] = [];

  handle(event: GameEvent, now: number): void {
    if (event.type !== 'item_tossed') return;
    this.tosses.push({ type: event.itemType, fromX: event.fromX, fromY: event.fromY, toX: event.toX, toY: event.toY, at: now });
  }

  isFlying(type: string, x: number, y: number, now: number): boolean {
    this.tosses = this.tosses.filter((toss) => now - toss.at < TOSS_MS);
    return this.tosses.some((toss) => {
      const isSameType = toss.type === type || (toss.type === 'candy' && type.startsWith('candy'));
      const isNearTarget = Math.hypot(toss.toX - x, toss.toY - y) < 8;
      return isSameType && isNearTarget;
    });
  }

  draw(ctx: CanvasRenderingContext2D, art: ArtBook, left: number, top: number, now: number): void {
    this.tosses = this.tosses.filter((toss) => now - toss.at < TOSS_MS);
    for (const toss of this.tosses) {
      const t = (now - toss.at) / TOSS_MS;
      const along = groundProgress(t);
      const x = toss.fromX + (toss.toX - toss.fromX) * along - left;
      const y = toss.fromY + (toss.toY - toss.fromY) * along - top;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(Math.round(x - 3), Math.round(y), 6, 2);
      const sprite = lootSprite(art, toss.type === 'candy' ? 'candy' : toss.type);
      const lift = arcHeight(t);
      const isFarBottle = toss.type === 'bottle' && Math.hypot(toss.toX - toss.fromX, toss.toY - toss.fromY) > 40;
      const shouldSpin = Boolean(sprite) && isFarBottle;
      if (shouldSpin && sprite) {
        const angle = t * Math.PI * 4;
        const cx = Math.round(x);
        const cy = Math.round(y - lift);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.drawImage(spriteCanvas(sprite), -sprite.ax, -sprite.ay);
        ctx.restore();
      } else if (sprite) {
        drawSprite(ctx, sprite, Math.round(x), Math.round(y - lift));
      } else {
        ctx.fillRect(Math.round(x - 2), Math.round(y - lift - 2), 4, 4);
      }
    }
  }
}

/** The dotted line an item in hand would fly, from the survivor to the spot it would land, with a ring there. */
export function drawTossPreview(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number): void {
  const dots = 10;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  for (let i = 1; i < dots; i += 1) {
    const t = i / dots;
    const x = fromX + (toX - fromX) * t;
    const y = fromY + (toY - fromY) * t - arcHeight(t * BOUNCE_AT) * 0.8;
    ctx.fillRect(Math.round(x - 1), Math.round(y - 1), 2, 2);
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(toX, toY, 5, 3, 0, 0, Math.PI * 2);
  ctx.stroke();
}
