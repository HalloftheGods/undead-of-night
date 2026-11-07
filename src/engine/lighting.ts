import { LightField } from './light-field.ts';
import type { Rgb, ScreenRect } from './light-field.ts';
import type { OcclusionGrid } from './occlusion.ts';

/** Moonlight. Whatever no lamp reaches is multiplied by this. */
export const NIGHT_AMBIENT: Rgb = [24, 28, 52];
/** Inside a building the moon does not reach: enough to read the room's shape, not its loot. */
const ROOM_AMBIENT: Rgb = [26, 25, 31];
/** Outdoors seen from inside, as a share of what it would be. */
const OUTSIDE_FROM_ROOM = 0.42;

const BEAM_COLOR: Rgb = [255, 208, 132];
const BEAM_RAYS = 40;
const BEAM_HALF_ANGLE = 0.6;
const BEAM_TAN_HALF = Math.tan(BEAM_HALF_ANGLE);
/** Rays are spaced evenly in tan(angle), which is how LightField looks them up. */
const RAY_TURNS = Float32Array.from({ length: BEAM_RAYS + 1 }, (_, i) => Math.atan(BEAM_TAN_HALF * ((i / BEAM_RAYS) * 2 - 1)));
/** A beam stopped at a prop still lights the face that rises above its footprint. */
const PROP_BLEED = 20;
/** Likewise a building's front, which stands taller. */
const FACADE_BLEED = 44;
/** Lit air and dust: light multiplied over dark art alone never looks warm, so a little is added back. */
const HAZE = 0.11;

const FALLBACK_RGB: Rgb = [255, 255, 255];
/** Furthest the camera can have moved for last frame's light to be laid down again. */
const MAX_REUSE_SHIFT = 24;

/** Mostly steady with the odd dropout, like a failing ballast. */
export function flicker(time: number, seed: number): number {
  const hum = 0.92 + 0.08 * Math.sin(time * 9.7 + seed * 3.1);
  const gate = Math.sin(time * 1.3 + seed * 5.7) * Math.sin(time * 3.1 + seed * 2.3);
  return gate > 0.82 ? hum * 0.35 : hum;
}

const parsedColors = new Map<string, Rgb>();

/** The map and the fx give colours in CSS #rgb or #rrggbb form. */
export function parseColor(color: string): Rgb {
  let rgb = parsedColors.get(color);
  if (!rgb) {
    const hex = color.replace('#', '');
    const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex;
    const value = Number.parseInt(full, 16);
    rgb = Number.isNaN(value) ? FALLBACK_RGB : [(value >> 16) & 255, (value >> 8) & 255, value & 255];
    parsedColors.set(color, rgb);
  }
  return rgb;
}

/** The brightnesses that should come out flat under this sky: outdoors, in a room, and outdoors seen from one. */
function flatLevels(ambient: Rgb): number[] {
  const sky = Math.max(...ambient);
  return [sky, Math.max(...ROOM_AMBIENT), Math.round(sky * OUTSIDE_FROM_ROOM)];
}

/** Bridges the LightField to the screen: rays in, one small canvas out, multiplied over the world. */
export class Lighting {
  private readonly field = new LightField(flatLevels(NIGHT_AMBIENT));
  private ambient: Rgb = NIGHT_AMBIENT;
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly rays = new Float32Array(BEAM_RAYS + 1);
  private image: ImageData | null = null;
  private pixels = new Int32Array(0);
  private width = 0;
  private height = 0;
  /** Where the camera stood for the light on the canvas, and how far it has moved since. */
  private litLeft = 0;
  private litTop = 0;
  private composed = false;
  private shiftX = 0;
  private shiftY = 0;

  constructor() {
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
  }

  /** Each level's sky. Once a level, since the field rebuilds its flat brightnesses. */
  setAmbient(ambient: Rgb): void {
    this.ambient = ambient;
    this.field.setAnchors(flatLevels(ambient));
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.composed = false;
    this.canvas.width = width;
    this.canvas.height = height;
    this.field.resize(width, height);
    this.image = this.ctx.createImageData(width, height);
    this.pixels = new Int32Array(this.image.data.buffer);
  }

  begin(left: number, top: number): void {
    this.field.begin(left, top, this.ambient);
    this.litLeft = left;
    this.litTop = top;
    this.shiftX = 0;
    this.shiftY = 0;
  }

  /**
   * Keeps last frame's light for this one, moved with the camera, instead of working it out again: for a
   * machine that cannot keep up. Street lamps stay exact; a moving flashlight is a frame behind. Returns
   * false, keeping nothing, when there is no light to keep or the camera has moved too far.
   */
  reuse(left: number, top: number): boolean {
    const shiftX = this.litLeft - left;
    const shiftY = this.litTop - top;
    const usable = this.composed && Math.abs(shiftX) <= MAX_REUSE_SHIFT && Math.abs(shiftY) <= MAX_REUSE_SHIFT;
    if (!usable) return false;
    this.shiftX = shiftX;
    this.shiftY = shiftY;
    return true;
  }

  /** Screen coordinates. Skips anything that cannot reach the view. */
  addPool(x: number, y: number, radius: number, color: string, strength: number, clip?: ScreenRect): void {
    this.field.addPool(x, y, radius, parseColor(color), Math.min(1, strength), clip);
  }

  /** Darkens all that lies outside the room the viewer is in. amount is 0..1 as it closes in. */
  enclose(room: ScreenRect, amount: number): void {
    this.field.enclose(room, ROOM_AMBIENT, OUTSIDE_FROM_ROOM, amount);
  }

  /** World coordinates for the rays, left/top to bring the result on screen. */
  addFlashlight(
    grid: OcclusionGrid | null,
    worldX: number,
    worldY: number,
    angle: number,
    reach: number,
    strength: number,
    left: number,
    top: number,
  ): void {
    const rays = this.rays;
    for (let i = 0; i <= BEAM_RAYS; i += 1) {
      rays[i] = grid ? grid.cast(worldX, worldY, angle + RAY_TURNS[i], reach, PROP_BLEED, FACADE_BLEED) : reach;
    }
    this.field.addBeam({
      x: worldX - left,
      y: worldY - top,
      angle,
      reach,
      tanHalf: BEAM_TAN_HALF,
      rays,
      color: BEAM_COLOR,
      strength,
    });
  }

  /** How lit a screen point is, for what should only show when a light finds it. */
  brightness(x: number, y: number): number {
    return this.field.brightness(x - this.shiftX, y - this.shiftY);
  }

  finish(): void {
    if (!this.image) return;
    this.field.write(this.pixels);
    this.ctx.putImageData(this.image, 0, 0);
    this.composed = true;
  }

  apply(target: CanvasRenderingContext2D): void {
    const { shiftX, shiftY } = this;
    target.globalCompositeOperation = 'multiply';
    target.drawImage(this.canvas, shiftX, shiftY);
    this.darkenUncovered(target);
    target.globalCompositeOperation = 'lighter';
    target.globalAlpha = HAZE;
    target.drawImage(this.canvas, shiftX, shiftY);
    target.globalAlpha = 1;
    target.globalCompositeOperation = 'source-over';
  }

  /** A reused light leaves a strip at the edge the camera moved toward: it gets the plain night. */
  private darkenUncovered(target: CanvasRenderingContext2D): void {
    const { shiftX, shiftY, width, height } = this;
    const inPlace = shiftX === 0 && shiftY === 0;
    if (inPlace) return;
    const [r, g, b] = this.ambient;
    target.fillStyle = `rgb(${r}, ${g}, ${b})`;
    // A strip as wide as the move, on the side the old light no longer covers; no move, no strip.
    const stripX = shiftX > 0 ? 0 : width + shiftX;
    const stripY = shiftY > 0 ? 0 : height + shiftY;
    target.fillRect(stripX, 0, Math.abs(shiftX), height);
    target.fillRect(0, stripY, width, Math.abs(shiftY));
  }
}
