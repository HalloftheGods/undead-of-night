import type { LevelTheme } from '../../shared/levels.ts';
import type { NightEventId } from '../../shared/night-events.ts';
import { windTravel } from './ground-motion.ts';
import { LEVEL_LOOKS, withEvent } from './level-look.ts';
import type { LevelLook, WeatherKind } from './level-look.ts';

const WASH_PULSE_RATE = 2.2;
/** Golden-ratio steps spread flakes evenly with no random numbers to carry around. */
const SPREAD_X = 0.6180339887;
const SPREAD_Y = 0.7548776662;

interface WeatherSpec {
  readonly count: number;
  /** Buffer pixels a second at full speed. */
  readonly driftX: number;
  readonly driftY: number;
  /** Side to side, in pixels. */
  readonly sway: number;
  readonly width: number;
  readonly height: number;
  readonly colors: readonly [string, string];
  /** Opacity of this layer, 1 when unset. */
  readonly alpha?: number;
}

interface Weather {
  /** Back to front: a far layer of small slow flakes, then an optional near one, bigger and quicker. */
  readonly layers: readonly WeatherSpec[];
  /** Rides the gusting wind sideways instead of a steady drift. */
  readonly windy: boolean;
}

/** The worst case for a frame: one rectangle each, however busy the street. */
export const MAX_FLAKES = 180;

const single = (spec: WeatherSpec, windy = false): Weather => ({ layers: [spec], windy });

const WEATHER: Record<WeatherKind, Weather> = {
  soot: single({ count: 40, driftX: -14, driftY: 10, sway: 6, width: 1, height: 1, colors: ['#3a384e', '#6c6a78'] }, true),
  rain: {
    windy: false,
    layers: [
      { count: 84, driftX: -40, driftY: 250, sway: 0, width: 1, height: 4, colors: ['#5274aa', '#3a5288'], alpha: 0.8 },
      { count: 30, driftX: -60, driftY: 400, sway: 0, width: 1, height: 7, colors: ['#9cc0e8', '#76a0d2'] },
    ],
  },
  spores: single({ count: 50, driftX: 6, driftY: -9, sway: 8, width: 1, height: 1, colors: ['#c4f048', '#5ca82c'] }),
  snow: {
    windy: true,
    layers: [
      { count: 110, driftX: -10, driftY: 24, sway: 8, width: 1, height: 1, colors: ['#e6edf4', '#b4bfcb'], alpha: 0.85 },
      { count: 56, driftX: -22, driftY: 48, sway: 14, width: 2, height: 2, colors: ['#ffffff', '#dfe8f2'] },
    ],
  },
  hive: single({ count: 56, driftX: -5, driftY: -7, sway: 9, width: 1, height: 1, colors: ['#b070d0', '#6c3c9c'] }),
  embers: single({ count: 70, driftX: 10, driftY: -34, sway: 7, width: 1, height: 1, colors: ['#ffc03c', '#e8701c'] }, true),
};

function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}

/**
 * Where a flake is. Pinned to the world through left and top, so it scrolls with the street.
 * travel is how far the wind has gone, in seconds of steady drift; it is just time when there is no wind.
 */
export function flakeX(spec: WeatherSpec, index: number, time: number, left: number, viewW: number, travel = time): number {
  const speed = 0.7 + 0.3 * ((index * SPREAD_Y) % 1);
  const sway = spec.sway * Math.sin(time * 0.9 + index);
  return Math.floor(wrap(((index * SPREAD_X) % 1) * viewW + spec.driftX * speed * travel + sway - left, viewW));
}

export function flakeY(spec: WeatherSpec, index: number, time: number, top: number, viewH: number): number {
  const speed = 0.7 + 0.3 * ((index * SPREAD_Y) % 1);
  return Math.floor(wrap(((index * SPREAD_Y) % 1) * viewH + spec.driftY * speed * time - top, viewH));
}

/** The level's palette and weather over the finished frame. It holds still for reduced motion. */
export class Atmosphere {
  look: LevelLook = LEVEL_LOOKS.night;
  private reducedMotion: boolean;

  constructor(reducedMotion: boolean) {
    this.reducedMotion = reducedMotion;
  }

  /** The Motion setting changed while the game was running. */
  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
  }

  setTheme(theme: LevelTheme, event: NightEventId | null = null): void {
    this.look = withEvent(LEVEL_LOOKS[theme], event);
  }

  /** The wash's alpha right now. */
  washAlpha(time: number): number {
    const { wash, washPulse } = this.look;
    if (!wash) return 0;
    const pulsing = washPulse > 0 && !this.reducedMotion;
    return pulsing ? wash.alpha + washPulse * Math.sin(time * WASH_PULSE_RATE) : wash.alpha;
  }

  /** outdoors is 0..1 as the room the viewer is in opens: the sky stays outside. */
  drawWash(ctx: CanvasRenderingContext2D, viewW: number, viewH: number, time: number, outdoors: number): void {
    const { wash } = this.look;
    if (!wash) return;
    ctx.globalAlpha = this.washAlpha(time) * outdoors;
    ctx.fillStyle = wash.color;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.globalAlpha = 1;
  }

  drawWeather(
    ctx: CanvasRenderingContext2D,
    left: number,
    top: number,
    viewW: number,
    viewH: number,
    time: number,
    outdoors: number,
  ): void {
    const { weather } = this.look;
    const unseen = weather === null || outdoors <= 0;
    if (unseen) return;
    const { layers, windy } = WEATHER[weather];
    const shownTime = this.reducedMotion ? 0 : time;
    const travel = windy ? windTravel(shownTime) : shownTime;
    for (let depth = 0; depth < layers.length; depth += 1) {
      const spec = layers[depth];
      // The near layer scrolls a little faster than the street, so the flakes read as falling in front of it.
      const parallax = 1 + depth * 0.25;
      ctx.globalAlpha = outdoors * (spec.alpha ?? 1);
      for (let shade = 0; shade < spec.colors.length; shade += 1) {
        ctx.fillStyle = spec.colors[shade];
        for (let i = shade; i < spec.count; i += spec.colors.length) {
          // Each layer starts from its own scatter, not the one behind it.
          const flake = i + depth * 509;
          const x = flakeX(spec, flake, shownTime, left * parallax, viewW, travel);
          const y = flakeY(spec, flake, shownTime, top * parallax, viewH);
          ctx.fillRect(x, y, spec.width, spec.height);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}
