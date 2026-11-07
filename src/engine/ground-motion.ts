import type { LevelTheme } from '../../shared/levels.ts';
import { TILE_KINDS, TILE_SIZE } from '../../shared/protocol.ts';
import type { WorldMap } from '../../shared/protocol.ts';

// What moves on the ground itself: light running over flood water and rain landing in it, and loose snow
// blown along the street. All of it is pinned to the world, drawn before the lightmap so it sits in the
// same dark as the road, and kept to a few dozen rectangles a frame. Floors stay still: buildings are dry.

/** The worst case for a frame, every kind of mark together. */
export const MAX_GROUND_MARKS = 220;

/** Golden-ratio step, the same trick the weather uses, so nothing random has to be carried around. */
const SPREAD = 0.7548776662;

const INDOOR_KINDS = new Set<number>(
  TILE_KINDS.flatMap((kind, index) => (kind.startsWith('floor_') || kind === 'bunker_wall' ? [index] : [])),
);

/** World pixels between glint cells on flood water. */
const RIPPLE_CELL = 22;
const RIPPLE_COLORS = ['#8cc0ea', '#5f93c8'] as const;
/** Drawn after the lightmap, so this is how bright it shows even in the dark. */
const RIPPLE_ALPHA = 0.2;
const MAX_RIPPLES = 120;
/** Pixels a second the current carries the light. */
const CURRENT_X = 5;
const CURRENT_Y = 1.5;

const SPLASH_COUNT = 18;
/** Seconds a splash ring lasts. */
const SPLASH_LIFE = 0.45;
const SPLASH_COLOR = '#b4d6f4';

const DRIFT_COUNT = 22;
/** Seconds one wisp of blown snow lives, fading in and out. */
const DRIFT_LIFE = 2.6;
const DRIFT_COLOR = '#ffffff';
const DRIFT_ALPHA = 0.32;
/** World pixels a second the wind pushes loose snow, before gusts. */
const DRIFT_SPEED = -26;
const SPARKLE_CELL = 18;
const SPARKLE_COLOR = '#ffffff';
const MAX_SPARKLES = 50;

/** A fraction 0..1 that is the same for the same inputs. */
/** A ripple runs longer the higher the swell. */
export function rippleLength(swell: number): number {
  const isHighSwell = swell > 0.75;
  if (isHighSwell) return 4;
  return swell > 0.45 ? 3 : 2;
}

function hash(a: number, b: number): number {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * How far the wind has carried something by `time`, in seconds of calm wind. The speed runs between a lull
 * and a gust, and since this is the integral of that speed, nothing riding it ever jumps.
 */
export function windTravel(time: number): number {
  return time + (0.45 * (1 - Math.cos(time * 0.37))) / 0.37 + (0.2 * (1 - Math.cos(time * 1.13))) / 1.13;
}

/** The wind's strength right now: 1 is calm, a gust reaches about 1.65, a lull about 0.35. */
export function windSpeed(time: number): number {
  return 1 + 0.45 * Math.sin(time * 0.37) + 0.2 * Math.sin(time * 1.13);
}

type Motion = 'water' | 'snow' | null;

const MOTION: Partial<Record<LevelTheme, Motion>> = { flooded: 'water', snow: 'snow' };

export class GroundMotion {
  private map: WorldMap | null = null;
  private motion: Motion = null;
  private reducedMotion: boolean;

  constructor(reducedMotion: boolean) {
    this.reducedMotion = reducedMotion;
  }

  /** The Motion setting changed while the game was running. */
  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
  }

  setMap(map: WorldMap): void {
    this.map = map;
  }

  setTheme(theme: LevelTheme): void {
    this.motion = MOTION[theme] ?? null;
  }

  /** True on street, grass and sidewalk; false on floors, walls and off the map. */
  isOutdoors(x: number, y: number): boolean {
    const map = this.map;
    if (!map) return false;
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);
    const onMap = col >= 0 && row >= 0 && col < map.cols && row < map.rows;
    return onMap && !INDOOR_KINDS.has(map.tiles[row * map.cols + col]);
  }

  /** Whether a 1-pixel-tall run drawn at buffer x, y, length long lies wholly outdoors. */
  private openRun(left: number, top: number, x: number, y: number, length: number): boolean {
    return this.isOutdoors(x + left, y + top) && this.isOutdoors(x + length - 1 + left, y + top);
  }

  /**
   * pass 'ground' goes after the ground and before anything standing on it, so the snow sits in the dark;
   * pass 'lit' goes after the lightmap, so the water's glints still read on the darkest street.
   * Reduced motion holds the water and snow still.
   */
  draw(ctx: CanvasRenderingContext2D, left: number, top: number, viewW: number, viewH: number, time: number, pass: 'ground' | 'lit' = 'ground'): void {
    const hasNoMotion = !this.map || !this.motion;
    if (hasNoMotion) return;
    const wanted = this.motion === 'water' ? 'lit' : 'ground';
    const isOtherPass = pass !== wanted;
    if (isOtherPass) return;
    const shownTime = this.reducedMotion ? 0 : time;
    const previous = ctx.globalAlpha;
    const isWater = this.motion === 'water';
    if (isWater) {
      this.drawRipples(ctx, left, top, viewW, viewH, shownTime);
      if (!this.reducedMotion) this.drawSplashes(ctx, left, top, viewW, viewH, shownTime);
    } else {
      this.drawSparkles(ctx, left, top, viewW, viewH, shownTime);
      if (!this.reducedMotion) this.drawDrift(ctx, left, top, viewW, viewH, shownTime);
    }
    ctx.globalAlpha = previous;
  }

  /** Short bright dashes that swell and fade as the current carries them: light on moving water. */
  private drawRipples(ctx: CanvasRenderingContext2D, left: number, top: number, viewW: number, viewH: number, time: number): void {
    const driftX = CURRENT_X * time;
    const driftY = CURRENT_Y * time;
    const col0 = Math.floor((left - driftX) / RIPPLE_CELL) - 1;
    const row0 = Math.floor((top - driftY) / RIPPLE_CELL) - 1;
    const cols = Math.ceil(viewW / RIPPLE_CELL) + 2;
    const rows = Math.ceil(viewH / RIPPLE_CELL) + 2;
    let drawn = 0;
    for (let r = 0; r < rows && drawn < MAX_RIPPLES; r += 1) {
      for (let c = 0; c < cols && drawn < MAX_RIPPLES; c += 1) {
        const col = col0 + c;
        const row = row0 + r;
        const seed = hash(col, row);
        const swell = Math.sin(time * (1.1 + seed * 0.9) + seed * Math.PI * 2);
        const isFlat = swell <= 0.2;
        if (isFlat) continue;
        const wx = col * RIPPLE_CELL + seed * RIPPLE_CELL + driftX;
        const wy = row * RIPPLE_CELL + hash(row, col) * RIPPLE_CELL + driftY;
        const sx = Math.round(wx - left);
        const sy = Math.round(wy - top);
        const length = rippleLength(swell);
        const x0 = sx - (length >> 1);
        const onScreen = x0 >= 0 && x0 + length <= viewW && sy >= 0 && sy < viewH;
        const isHidden = !onScreen || !this.openRun(left, top, x0, sy, length);
        if (isHidden) continue;
        ctx.globalAlpha = RIPPLE_ALPHA * swell;
        ctx.fillStyle = RIPPLE_COLORS[seed < 0.5 ? 0 : 1];
        ctx.fillRect(x0, sy, length, 1);
        drawn += 1;
      }
    }
  }

  /** Rain landing: a dot, then a ring that opens and fades. Each slot comes back somewhere new. */
  private drawSplashes(ctx: CanvasRenderingContext2D, left: number, top: number, viewW: number, viewH: number, time: number): void {
    ctx.fillStyle = SPLASH_COLOR;
    const margin = 5;
    for (let i = 0; i < SPLASH_COUNT; i += 1) {
      const clock = time / SPLASH_LIFE + ((i * SPREAD) % 1);
      const slot = Math.floor(clock);
      const age = clock - slot;
      const sx = margin + Math.floor(hash(i, slot) * (viewW - margin * 2));
      const sy = margin + Math.floor(hash(slot, i + 7) * (viewH - margin * 2));
      const isBlocked = !this.openRun(left, top, sx - 4, sy - 3, 9) || !this.openRun(left, top, sx - 4, sy + 3, 9);
      if (isBlocked) continue;
      ctx.globalAlpha = 0.34 * (1 - age);
      const isFresh = age < 0.25;
      if (isFresh) {
        ctx.fillRect(sx, sy, 1, 1);
        continue;
      }
      const reach = 1 + Math.round(age * 3);
      const up = Math.max(1, reach - 1);
      ctx.fillRect(sx - reach, sy, 1, 1);
      ctx.fillRect(sx + reach, sy, 1, 1);
      ctx.fillRect(sx, sy - up, 1, 1);
      ctx.fillRect(sx, sy + up, 1, 1);
    }
  }

  /** Thin wisps of loose snow skating along the ground with the wind, longer in the gusts. */
  private drawDrift(ctx: CanvasRenderingContext2D, left: number, top: number, viewW: number, viewH: number, time: number): void {
    ctx.fillStyle = DRIFT_COLOR;
    const gust = windSpeed(time);
    const travel = DRIFT_SPEED * windTravel(time);
    for (let i = 0; i < DRIFT_COUNT; i += 1) {
      const offset = (i * SPREAD) % 1;
      const clock = time / DRIFT_LIFE + offset;
      const slot = Math.floor(clock);
      const age = clock - slot;
      // Where this wisp was born, in the world, plus how far the wind has pushed it since.
      const born = (slot - offset) * DRIFT_LIFE;
      const pushed = travel - DRIFT_SPEED * windTravel(born);
      const wx = left + 30 + hash(i, slot) * viewW + pushed;
      const wy = top + hash(slot + 3, i) * viewH;
      const sx = Math.round(wx - left);
      const sy = Math.round(wy - top + Math.sin(time * 2 + i) * 1.5);
      const length = Math.round(4 + gust * 5 + hash(i, 2) * 4);
      const tail = Math.round(length / 2);
      const onScreen = sx >= 0 && sx + length + tail <= viewW && sy >= 0 && sy < viewH;
      const isHidden = !onScreen || !this.openRun(left, top, sx, sy, length + tail);
      if (isHidden) continue;
      ctx.globalAlpha = DRIFT_ALPHA * Math.sin(age * Math.PI);
      ctx.fillRect(sx, sy, length, 1);
      ctx.globalAlpha *= 0.5;
      ctx.fillRect(sx + length, sy, tail, 1);
    }
  }

  /** Single crystals catching the light, winking on and off. */
  private drawSparkles(ctx: CanvasRenderingContext2D, left: number, top: number, viewW: number, viewH: number, time: number): void {
    ctx.fillStyle = SPARKLE_COLOR;
    const col0 = Math.floor(left / SPARKLE_CELL);
    const row0 = Math.floor(top / SPARKLE_CELL);
    const cols = Math.ceil(viewW / SPARKLE_CELL) + 1;
    const rows = Math.ceil(viewH / SPARKLE_CELL) + 1;
    let drawn = 0;
    for (let r = 0; r < rows && drawn < MAX_SPARKLES; r += 1) {
      for (let c = 0; c < cols && drawn < MAX_SPARKLES; c += 1) {
        const col = col0 + c;
        const row = row0 + r;
        const seed = hash(col + 11, row);
        const wink = Math.sin(time * (0.8 + seed * 1.6) + seed * 40);
        const isDark = wink < 0.93;
        if (isDark) continue;
        const wx = col * SPARKLE_CELL + seed * SPARKLE_CELL;
        const wy = row * SPARKLE_CELL + hash(row, col + 5) * SPARKLE_CELL;
        const sx = Math.round(wx - left);
        const sy = Math.round(wy - top);
        const onScreen = sx >= 0 && sx < viewW && sy >= 0 && sy < viewH;
        const isHidden = !onScreen || !this.openRun(left, top, sx, sy, 1);
        if (isHidden) continue;
        ctx.globalAlpha = Math.min(1, (wink - 0.93) * 12);
        ctx.fillRect(sx, sy, 1, 1);
        drawn += 1;
      }
    }
  }
}
