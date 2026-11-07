import type { BulletEntity, ZombieEntity } from '../../shared/protocol.ts';
import type { GunEffect } from '../../shared/round-effect-data.ts';
import type { PixelSprite } from '../art/types.ts';
import { silhouetteCanvas } from './sprite-cache.ts';

// What a gun's rounds leave on a zombie, drawn from the snapshot alone. Nothing here keeps per-zombie state, so a
// reconnect or a level change cannot leave a stale flame behind, and the cost is a few rects per marked body.

/** Most bodies that get pixel flames in one frame; the rest keep the cheap glow. */
export const MAX_FLAMES = 24;
/** Most bodies that get a glow in one frame. */
export const MAX_GLOWS = 40;

const TINT_ALPHA = 0.32;
const TINT_ACID = '#8fd13a';
const TINT_SLOW = '#6fb8ff';
const FLAME_OUTER = '#d4410f';
const FLAME_MID = '#ff8a1c';
const FLAME_CORE = '#ffe36b';
const DRIP = '#b6f24a';
const FROST = '#d6efff';
const FLAME_COLUMNS = 3;
const FLAME_SPREAD = 3;
const FLICKER_HZ = 9;
const DRIP_SEC = 1.1;
const GLOW_RADIUS = 22;
const GLOW_ALPHA = 0.5;

/** Tracer colours by effect; a plain round keeps the art book's tracer. */
const TRACER_COLOR: Record<GunEffect, string> = {
  incendiary: FLAME_MID,
  acid: DRIP,
  piercing: '#e8f4ff',
  tranq: TINT_SLOW,
};
const TRACER_TRAIL_PX: Record<GunEffect, number> = { incendiary: 5, acid: 4, piercing: 10, tranq: 4 };

const tints = new WeakMap<PixelSprite, Map<string, HTMLCanvasElement>>();
let glow: HTMLCanvasElement | null = null;
let flames = 0;
let glows = 0;

/** Call once at the top of the frame's emissive pass. */
export function beginStatusFrame(): void {
  flames = 0;
  glows = 0;
}

/** Cheap hash into 0..1 so each body flickers out of step with its neighbours. */
function jitter(id: string, step: number): number {
  let seed = 0;
  for (let i = 0; i < id.length; i += 1) seed = (seed * 31 + id.charCodeAt(i)) % 9973;
  const n = Math.sin(seed * 12.9898 + step * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function tintCanvas(sprite: PixelSprite, color: string): HTMLCanvasElement {
  let byColor = tints.get(sprite);
  if (!byColor) {
    byColor = new Map();
    tints.set(sprite, byColor);
  }
  let canvas = byColor.get(color);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = sprite.w;
    canvas.height = sprite.h;
    const c = canvas.getContext('2d')!;
    c.drawImage(silhouetteCanvas(sprite), 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color;
    c.fillRect(0, 0, sprite.w, sprite.h);
    byColor.set(color, canvas);
  }
  return canvas;
}

function glowCanvas(): HTMLCanvasElement {
  if (glow) return glow;
  glow = document.createElement('canvas');
  glow.width = GLOW_RADIUS * 2;
  glow.height = GLOW_RADIUS * 2;
  const c = glow.getContext('2d')!;
  const gradient = c.createRadialGradient(GLOW_RADIUS, GLOW_RADIUS, 1, GLOW_RADIUS, GLOW_RADIUS, GLOW_RADIUS);
  gradient.addColorStop(0, 'rgba(255, 170, 60, 1)');
  gradient.addColorStop(1, 'rgba(255, 90, 20, 0)');
  c.fillStyle = gradient;
  c.fillRect(0, 0, GLOW_RADIUS * 2, GLOW_RADIUS * 2);
  return glow;
}

/** The body, washed with the colour of what is on it. Drawn right over the sprite in the lit pass. */
export function paintTint(ctx: CanvasRenderingContext2D, zombie: ZombieEntity, sprite: PixelSprite, x: number, y: number, time: number, reducedMotion: boolean): void {
  const corroded = (zombie.corrosion ?? 0) > 0;
  const slowed = zombie.slowed === true;
  const isUnaffected = !corroded && !slowed;
  if (isUnaffected) return;
  const x0 = x - sprite.ax;
  const y0 = y - sprite.ay;
  const previous = ctx.globalAlpha;
  if (slowed) {
    ctx.globalAlpha = TINT_ALPHA;
    ctx.drawImage(tintCanvas(sprite, TINT_SLOW), x0, y0);
    ctx.fillStyle = FROST;
    ctx.globalAlpha = 1;
    ctx.fillRect(x - 5, y - 1, 1, 1);
    ctx.fillRect(x + 4, y, 1, 1);
  }
  if (corroded) {
    ctx.globalAlpha = TINT_ALPHA * (zombie.corrosion ?? 1) * 0.6;
    ctx.drawImage(tintCanvas(sprite, TINT_ACID), x0, y0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = DRIP;
    const height = Math.max(6, sprite.ay);
    for (let i = 0; i < (zombie.corrosion ?? 0); i += 1) {
      const phase = reducedMotion ? i / 3 : ((time / DRIP_SEC + i / 3 + jitter(zombie.id, i)) % 1);
      ctx.fillRect(x - 3 + i * 3, y - height * (1 - phase) * 0.8, 1, 2);
    }
  }
  ctx.globalAlpha = previous;
}

/** Flames over a burning body and the glow it throws. Drawn in the emissive pass, after lighting. */
export function paintBurn(ctx: CanvasRenderingContext2D, zombie: ZombieEntity, x: number, y: number, bodyHeight: number, time: number, reducedMotion: boolean): void {
  if (!zombie.burning) return;
  const hasGlowBudget = glows < MAX_GLOWS;
  if (hasGlowBudget) {
    glows += 1;
    const previous = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = GLOW_ALPHA;
    ctx.drawImage(glowCanvas(), x - GLOW_RADIUS, y - bodyHeight / 2 - GLOW_RADIUS);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = previous;
  }
  const isOutOfFlames = flames >= MAX_FLAMES;
  if (isOutOfFlames) return;
  flames += 1;
  const step = reducedMotion ? 0 : Math.floor(time * FLICKER_HZ);
  for (let i = 0; i < FLAME_COLUMNS; i += 1) {
    const height = 3 + Math.floor(jitter(zombie.id, step + i * 7) * 4);
    const cx = x + (i - 1) * FLAME_SPREAD;
    const top = y - bodyHeight * 0.55 - height;
    ctx.fillStyle = FLAME_OUTER;
    ctx.fillRect(cx - 1, top, 3, height);
    ctx.fillStyle = FLAME_MID;
    ctx.fillRect(cx, top + 1, 1, height - 1);
    ctx.fillStyle = FLAME_CORE;
    ctx.fillRect(cx, top + height - 2, 1, 2);
  }
}

/** A trail behind a round that carries an effect, so you can see what a gun is firing. Pixels, no allocation. */
export function paintEffectTrail(ctx: CanvasRenderingContext2D, bullet: BulletEntity, x: number, y: number): void {
  if (!bullet.effect) return;
  const speed = Math.hypot(bullet.vx, bullet.vy) || 1;
  const dx = -bullet.vx / speed;
  const dy = -bullet.vy / speed;
  ctx.fillStyle = TRACER_COLOR[bullet.effect];
  const length = TRACER_TRAIL_PX[bullet.effect];
  for (let i = 1; i <= length; i += 1) {
    ctx.globalAlpha = 1 - i / (length + 1);
    ctx.fillRect(Math.round(x + dx * i), Math.round(y + dy * i), 1, 1);
  }
  ctx.globalAlpha = 1;
}
