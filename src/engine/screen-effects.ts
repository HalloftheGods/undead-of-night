import { bayerThreshold } from './light-dither.ts';

const MAX_SHAKE_PX = 7;
const SHAKE_DECAY = 2.6;
export const REDUCED_MOTION_SHAKE = 0.2;
const HURT_DECAY = 1.8;
const FLASH_DECAY = 3.2;
const LOW_HEALTH = 0.34;
const DESATURATE_RATE = 0.45;
const VIGNETTE_RGB = [122, 16, 12] as const;

/** How hard the screen shakes: the player's slider, 0..1, which Reduced motion caps at a gentle nudge. */
export function shakeScaleFor(reducedMotion: boolean, shakeLevel: number): number {
  const level = Math.min(1, Math.max(0, shakeLevel));
  return reducedMotion ? Math.min(level, REDUCED_MOTION_SHAKE) : level;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Red creeping in from the edges, stippled rather than blended. */
function buildVignette(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = (x / width) * 2 - 1;
      const ny = (y / height) * 2 - 1;
      const density = smoothstep(0.55, 1.15, Math.hypot(nx, ny));
      const isClear = density <= bayerThreshold(x, y);
      if (isClear) continue;
      const i = (y * width + x) * 4;
      image.data[i] = VIGNETTE_RGB[0];
      image.data[i + 1] = VIGNETTE_RGB[1];
      image.data[i + 2] = VIGNETTE_RGB[2];
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** Whole-screen feedback: shake, damage vignette, low-health pulse, death desaturation. */
export class ScreenEffects {
  shakeX = 0;
  shakeY = 0;
  private shakeScale: number;
  private reducedMotion: boolean;
  private trauma = 0;
  private hurt = 0;
  private flash = 0;
  private health = 1;
  /** 0..1, the heartbeat's swell this frame (src/game/heartbeat.ts), so the red beats with the heart. */
  private heartPulse = 0;
  private desaturation = 0;
  private desaturationTarget = 0;
  private time = 0;
  private vignette: HTMLCanvasElement | null = null;

  constructor(reducedMotion: boolean, shakeLevel = 1) {
    this.reducedMotion = reducedMotion;
    this.shakeScale = shakeScaleFor(reducedMotion, shakeLevel);
  }

  /** The Motion setting changed: from the Options page, or the system's own switch under System. */
  setMotion(reducedMotion: boolean, shakeLevel: number): void {
    this.reducedMotion = reducedMotion;
    this.shakeScale = shakeScaleFor(reducedMotion, shakeLevel);
    if (reducedMotion) this.flash = 0;
  }

  resize(width: number, height: number): void {
    this.vignette = buildVignette(width, height);
  }

  reset(): void {
    this.trauma = 0;
    this.hurt = 0;
    this.flash = 0;
    this.health = 1;
    this.heartPulse = 0;
    this.desaturation = 0;
    this.desaturationTarget = 0;
  }

  /** 0..1. Stacks, then squares, so small kicks stay small. */
  addShake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** A white wash for a big moment. Reduced motion skips it: a full-screen flash is the kind of thing that setting is for. */
  addFlash(amount: number): void {
    if (this.reducedMotion) return;
    this.flash = Math.min(1, this.flash + amount);
  }

  addHurt(amount: number): void {
    this.hurt = Math.min(1, this.hurt + amount);
  }

  setHealth(fraction: number): void {
    this.health = fraction;
  }

  setHeartPulse(pulse: number): void {
    this.heartPulse = pulse;
  }

  setDesaturation(target: number): void {
    this.desaturationTarget = target;
  }

  update(dt: number): void {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - SHAKE_DECAY * dt);
    this.hurt = Math.max(0, this.hurt - HURT_DECAY * dt);
    this.flash = Math.max(0, this.flash - FLASH_DECAY * dt);
    const toward = this.desaturationTarget - this.desaturation;
    const step = Math.min(Math.abs(toward), DESATURATE_RATE * dt);
    this.desaturation += Math.sign(toward) * step;

    const magnitude = this.trauma * this.trauma * MAX_SHAKE_PX * this.shakeScale;
    this.shakeX = Math.round(Math.sin(this.time * 71) * magnitude);
    this.shakeY = Math.round(Math.cos(this.time * 83) * magnitude);
  }

  private vignetteStrength(): number {
    let lowHealth = 0;
    const isLowHealth = this.health > 0 && this.health < LOW_HEALTH;
    if (isLowHealth) {
      const severity = 1 - this.health / LOW_HEALTH;
      // Reduced motion holds the red steady instead of throbbing.
      const pulse = this.reducedMotion ? 0.7 : 0.45 + 0.55 * this.heartPulse;
      lowHealth = (0.25 + 0.5 * severity) * pulse;
    }
    return Math.min(1, Math.max(this.hurt, lowHealth));
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const isDesaturating = this.desaturation > 0.01;
    if (isDesaturating) {
      ctx.globalCompositeOperation = 'saturation';
      ctx.globalAlpha = this.desaturation;
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    }
    const strength = this.vignetteStrength();
    const vignette = this.vignette;
    const showsVignette = strength > 0.01 && vignette !== null;
    if (showsVignette) {
      ctx.globalAlpha = strength;
      ctx.drawImage(vignette, 0, 0);
    }
    const isFlashing = this.flash > 0.01;
    if (isFlashing) {
      ctx.globalAlpha = this.flash * 0.6;
      ctx.fillStyle = '#fff4dc';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.globalAlpha = 1;
  }
}
