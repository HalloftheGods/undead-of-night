import { windTravel } from './ground-motion.ts';
import type { FogKind, LevelLook } from './level-look.ts';

const SMOKE_CLUSTER_COUNT = 14;
const WAVY_RIBBON_BANDS = 4;
const SPREAD_X = 0.6180339887;
const SPREAD_Y = 0.7548776662;

const CLOUD_W = 208;
const CLOUD_H = 112;
const RIBBON_W = 360;
const RIBBON_H = 96;

const smokeClusterCanvases = new Map<string, HTMLCanvasElement>();
const wavyRibbonCanvases = new Map<string, HTMLCanvasElement>();

function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}

/** Pre-renders an organic, multi-lobed billowing smoke cluster. No circular bubbles! */
function getSmokeClusterCanvas(color: string): HTMLCanvasElement {
  let canvas = smokeClusterCanvases.get(color);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = CLOUD_W;
    canvas.height = CLOUD_H;
    const ctx = canvas.getContext('2d');
    if (ctx && typeof ctx.createRadialGradient === 'function') {
      const LOBES = [
        { x: 104, y: 56, r: 40, a: 0.35 },
        { x: 140, y: 52, r: 32, a: 0.30 },
        { x: 90, y: 42, r: 30, a: 0.28 },
        { x: 120, y: 68, r: 28, a: 0.26 },
        { x: 68, y: 58, r: 26, a: 0.24 },
        { x: 156, y: 60, r: 22, a: 0.22 },
        { x: 48, y: 54, r: 20, a: 0.20 },
      ];
      for (const lobe of LOBES) {
        const grad = ctx.createRadialGradient(lobe.x, lobe.y, 0, lobe.x, lobe.y, lobe.r);
        if (grad && typeof grad.addColorStop === 'function') {
          grad.addColorStop(0, color);
          grad.addColorStop(0.35, color);
          grad.addColorStop(0.75, color);
          grad.addColorStop(1, 'transparent');
          ctx.save();
          ctx.globalAlpha = lobe.a;
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(lobe.x, lobe.y, lobe.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
    smokeClusterCanvases.set(color, canvas);
  }
  return canvas;
}

/** Pre-renders a wide undulating wavy smoke ribbon. No straight horizontal scanlines! */
function getWavyRibbonCanvas(color: string): HTMLCanvasElement {
  let canvas = wavyRibbonCanvases.get(color);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = RIBBON_W;
    canvas.height = RIBBON_H;
    const ctx = canvas.getContext('2d');
    if (ctx && typeof ctx.createRadialGradient === 'function') {
      const LOBE_STEPS = 14;
      for (let i = 0; i <= LOBE_STEPS; i += 1) {
        const u = i / LOBE_STEPS;
        const envelope = Math.sin(u * Math.PI) ** 1.6;
        const x = 24 + u * (RIBBON_W - 48);
        const waveY = 48 + Math.sin(u * Math.PI * 2.8) * 14 + Math.cos(u * Math.PI * 4.6) * 8;
        const radius = (16 + Math.sin(u * Math.PI * 2.3) * 6) * (0.6 + 0.4 * envelope);
        const grad = ctx.createRadialGradient(x, waveY, 0, x, waveY, radius);
        if (grad && typeof grad.addColorStop === 'function') {
          grad.addColorStop(0, color);
          grad.addColorStop(0.3, color);
          grad.addColorStop(0.7, color);
          grad.addColorStop(1, 'transparent');
          ctx.save();
          ctx.globalAlpha = 0.35 * envelope;
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(x, waveY, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
    wavyRibbonCanvases.set(color, canvas);
  }
  return canvas;
}

export class GroundFog {
  private reducedMotion: boolean;

  constructor(reducedMotion: boolean) {
    this.reducedMotion = reducedMotion;
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    look: LevelLook,
    left: number,
    top: number,
    viewW: number,
    viewH: number,
    time: number,
    outdoors: number,
    lightAt?: (x: number, y: number) => number,
  ): void {
    const fogMode = look.fog ?? null;
    const hasFog = fogMode !== null && outdoors > 0;
    if (!hasFog) return;

    const fogColor = look.fogColor ?? '#384656';
    const currentTime = this.reducedMotion ? 0 : time;
    const windDistance = windTravel(currentTime);

    const hasSheets = fogMode === 'sheet' || fogMode === 'both';
    if (hasSheets) {
      this.drawSheets(ctx, fogColor, left, top, viewW, viewH, currentTime, outdoors, lightAt);
    }

    const hasTendrils = fogMode === 'tendril' || fogMode === 'both';
    if (hasTendrils) {
      this.drawTendrils(ctx, fogColor, left, top, viewW, viewH, currentTime, windDistance, outdoors, lightAt);
    }
  }

  private drawSheets(
    ctx: CanvasRenderingContext2D,
    color: string,
    left: number,
    top: number,
    viewW: number,
    viewH: number,
    time: number,
    outdoors: number,
    lightAt?: (x: number, y: number) => number,
  ): void {
    const ribbon = getWavyRibbonCanvas(color);
    const wrapH = viewH + RIBBON_H * 2;
    const wrapW = viewW + RIBBON_W * 2;
    const bandSpacing = wrapH / WAVY_RIBBON_BANDS;
    const stepX = RIBBON_W - 48;
    const stampCount = viewW <= 320 ? 2 : Math.max(2, Math.ceil((viewW + RIBBON_W) / stepX));

    for (let i = 0; i < WAVY_RIBBON_BANDS; i += 1) {
      const waveShift = Math.sin(time * 0.45 + i * 1.9) * 20;
      const baseWorldY = i * bandSpacing + time * 5 - top * 0.65;
      const screenY = wrap(baseWorldY, wrapH) - RIBBON_H + waveShift;
      const baseDriftX = wrap(time * 8 + i * 75 - left * 0.65, wrapW) - RIBBON_W;

      const baseAlpha = (0.16 + Math.sin(time * 0.5 + i * 2.7) * 0.04) * outdoors;
      const lightBoost = lightAt ? Math.min(0.12, (lightAt(viewW / 2, screenY + RIBBON_H / 2) / 255) * 0.15) : 0;
      const finalAlpha = Math.min(0.35, baseAlpha + lightBoost);

      ctx.save();
      ctx.globalAlpha = finalAlpha;
      for (let s = 0; s < stampCount; s += 1) {
        const drawX = Math.round(baseDriftX + s * stepX);
        const floatY = Math.round(screenY + Math.sin(time * 0.6 + i + s * 1.4) * 6);
        ctx.drawImage(ribbon, drawX, floatY, RIBBON_W, RIBBON_H);
      }
      ctx.restore();
    }
  }

  private drawTendrils(
    ctx: CanvasRenderingContext2D,
    color: string,
    left: number,
    top: number,
    viewW: number,
    viewH: number,
    time: number,
    travel: number,
    outdoors: number,
    lightAt?: (x: number, y: number) => number,
  ): void {
    const cluster = getSmokeClusterCanvas(color);
    const wrapW = viewW + CLOUD_W * 2;
    const wrapH = viewH + CLOUD_H * 2;

    for (let i = 0; i < SMOKE_CLUSTER_COUNT; i += 1) {
      const seedX = (i * SPREAD_X) % 1;
      const seedY = (i * SPREAD_Y) % 1;
      const driftSpeed = 0.55 + 0.45 * seedY;
      const swayOffset = Math.sin(time * 0.6 + i * 1.6) * 22;
      const scale = 0.85 + 0.3 * Math.sin(time * 0.8 + i * 2.1);

      const worldX = seedX * wrapW + travel * 14 * driftSpeed + swayOffset - left * 0.8;
      const worldY = seedY * wrapH + time * 4 * driftSpeed - top * 0.8;

      const screenX = wrap(worldX, wrapW) - CLOUD_W;
      const screenY = wrap(worldY, wrapH) - CLOUD_H;

      const currentW = Math.round(CLOUD_W * scale);
      const currentH = Math.round(CLOUD_H * scale);
      const drawX = Math.round(screenX - (currentW - CLOUD_W) / 2);
      const drawY = Math.round(screenY - (currentH - CLOUD_H) / 2);

      const centerX = drawX + currentW / 2;
      const centerY = drawY + currentH / 2;
      const baseAlpha = (0.13 + 0.04 * Math.sin(time * 0.7 + i)) * outdoors;
      const lightBoost = lightAt ? Math.min(0.14, (lightAt(centerX, centerY) / 255) * 0.18) : 0;
      const finalAlpha = Math.min(0.36, baseAlpha + lightBoost);

      ctx.save();
      ctx.globalAlpha = finalAlpha;
      ctx.drawImage(cluster, drawX, drawY, currentW, currentH);
      ctx.restore();
    }
  }
}
