// Ambient and impact extras: metal sparks, weather, drifting particles, gibs, footprints,
// scorch marks, glass, bullet holes and a pulsing ring for pickups. All drawn in code from
// the master palette, so they build in Node and the browser alike and stay identical.

import type { AmbientFxArt, Clip, PixelSprite } from '../types.ts';
import { makeClip, PixelCanvas, seeded } from '../kit.ts';
import type { Legend } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import { cell } from './shared.ts';
import type { Grid } from './shared.ts';

const { acid, ash, blood, bone, concrete, denim, fire, ink, metal, olive, rot, teal, wood } = RAMPS;

// ---------------------------------------------------------------- hit spark

const SPARK_SIZE = 20;
const SPARK_CENTRE = 10;
const SPARK_FRAMES = 4;
const SPARK_COLORS = [fire[3], fire[2], fire[1], fire[0]];

/** Unit-ish directions of the thrown sparks. Uneven on purpose: an even ring reads as a star. */
const SPARK_VECTORS: readonly (readonly [number, number])[] = [
  [1, -0.3], [0.7, -0.9], [-0.2, -1], [-0.9, -0.7], [-1, 0.1], [-0.6, 0.8], [0.5, 0.9],
];
const SPARK_SPEED = [2.2, 1.6, 2.6, 1.9, 2.4, 1.5, 2];

function sparkFrame(frame: number): PixelCanvas {
  const canvas = new PixelCanvas(SPARK_SIZE, SPARK_SIZE);
  const color = SPARK_COLORS[frame];
  SPARK_VECTORS.forEach(([vx, vy], i) => {
    const reach = 2 + frame * SPARK_SPEED[i];
    const x = Math.round(SPARK_CENTRE + vx * reach);
    const y = Math.round(SPARK_CENTRE + vy * reach + frame * frame * 0.4);
    canvas.px(x, y, color);
    const hasTail = frame < 3;
    if (hasTail) canvas.px(Math.round(x - vx), Math.round(y - vy), SPARK_COLORS[Math.min(frame + 1, 3)]);
  });
  const hasFlash = frame < 2;
  if (hasFlash) {
    canvas.rect(SPARK_CENTRE - 1, SPARK_CENTRE - 1, 3, 3, fire[3]);
    canvas.px(SPARK_CENTRE, SPARK_CENTRE, bone[3]);
  }
  return canvas;
}

function buildHitSpark(): Clip {
  const frames = Array.from({ length: SPARK_FRAMES }, (_, i) => sparkFrame(i).toSprite(SPARK_SIZE, SPARK_SIZE, SPARK_CENTRE, SPARK_CENTRE));
  return makeClip(frames, 24, false);
}

// ------------------------------------------------------------------ weather

const STREAK_W = 8;
const STREAK_H = 16;

/** One falling rain streak, shimmering over four frames. The renderer moves it. */
function buildRainStreak(): Clip {
  const frames = Array.from({ length: 4 }, (_, f) => {
    const top = f * 2;
    const canvas = new PixelCanvas(STREAK_W, STREAK_H);
    canvas.line(5, top, 2, top + 9, denim[2]);
    canvas.px(5, top, denim[1]);
    canvas.px(2, top + 9, metal[3]);
    return canvas.toSprite(STREAK_W, STREAK_H, 2, STREAK_H);
  });
  return makeClip(frames, 14, true);
}

const SPLASH_W = 14;
const SPLASH_H = 8;

/** A raindrop landing: droplets hop, then a ripple widens and thins. */
function buildRainSplash(): Clip {
  const drawn = [
    new PixelCanvas(SPLASH_W, SPLASH_H).px(7, 5, metal[3]).px(6, 4, denim[2]).px(8, 4, denim[2]),
    new PixelCanvas(SPLASH_W, SPLASH_H).ellipseOutline(7, 5, 2, 1, denim[2]).px(4, 2, metal[3]).px(10, 2, metal[3]).px(7, 1, metal[3]),
    new PixelCanvas(SPLASH_W, SPLASH_H).ellipseOutline(7, 5, 4, 2, denim[2]).px(3, 3, denim[1]).px(11, 3, denim[1]),
    new PixelCanvas(SPLASH_W, SPLASH_H).ellipseOutline(7, 5, 6, 2, denim[1]),
  ];
  return makeClip(drawn.map((canvas) => canvas.toSprite(SPLASH_W, SPLASH_H, 7, 5)), 14, false);
}

// --------------------------------------------------------- drifting motes

const MOTE_W = 8;
const MOTE_H = 12;
const MOTE_SWAY = [4, 3, 4, 5, 4, 3];

interface MoteLook {
  readonly colors: readonly number[];
  /** Frames from this one on are a single pixel. */
  readonly shrinkAt: number;
  /** Frames before this one wear a hot core. */
  readonly coreUntil: number;
  readonly core: number;
}

function moteClip(look: MoteLook): Clip {
  const frames = MOTE_SWAY.map((sway, f) => {
    const canvas = new PixelCanvas(MOTE_W, MOTE_H);
    // Frame 0 sits on the bottom rows and the last frame on the top one, so every frame stays on the canvas.
    const y = 10 - f * 2;
    const color = look.colors[f];
    const big = f < look.shrinkAt;
    if (big) canvas.rect(sway, y, 2, 2, color);
    else canvas.px(sway, y, color);
    const hot = f < look.coreUntil;
    if (hot) canvas.px(sway, y, look.core);
    return canvas.toSprite(MOTE_W, MOTE_H, 4, MOTE_H);
  });
  return makeClip(frames, 8, true);
}

/** A fire ember rising from a barrel or a burning wreck, cooling as it goes. */
function buildEmberDrift(): Clip {
  return moteClip({ colors: [fire[3], fire[2], fire[2], fire[1], fire[0], fire[0]], shrinkAt: 3, coreUntil: 2, core: fire[3] });
}

/** A glowing spore from the blight biome, brightening then dimming. */
function buildSporeDrift(): Clip {
  return moteClip({ colors: [acid[1], acid[2], acid[2], acid[1], acid[0], acid[0]], shrinkAt: 4, coreUntil: 4, core: bone[3] });
}

const LEAF: Legend = { L: olive[2], l: olive[1], s: olive[0], d: wood[2] };
const LEAF_FRAMES: readonly Grid[] = [
  ['..ll....', '.lLLl...', 'lLLLLs..', '.slLsd..'],
  ['.ll...', 'lLLls.', 'lLLLLs', '.lLLs.'],
  ['.L.', 'lLs', 'lLs', '.s.'],
  ['...ll.', '.slLLl', 'sLLLLl', '.sLLl.'],
];

/** A leaf tumbling down in the evergreen and yard biomes. */
function buildLeafFall(): Clip {
  const frames = LEAF_FRAMES.map((rows) => cell(10, 10, rows, LEAF, 1, 3).toSprite(10, 10, 5, 10));
  return makeClip(frames, 6, true);
}

// ------------------------------------------------------------------- gibs

const GIB: Legend = {
  f: blood[2], F: blood[1], g: blood[3],
  b: bone[2], B: bone[1], c: bone[3],
  r: rot[2], R: rot[1],
};

const GIB_GRIDS: readonly Grid[] = [
  ['.ggf.', 'gfffF', 'fffFF', '.FFF.'],
  ['..cb', '.cbB', 'cbB.', 'bB..'],
  ['.rr..', 'rrRR.', 'rRRR.', '.RR..'],
  ['cb.cb', 'bB.bB', '.bBB.'],
  ['gf', 'fF'],
];

/** Chunks thrown off a death: flesh, bone, rot, ribs and a scrap. Each is outlined and anchored at its middle. */
function buildGibs(): PixelSprite[] {
  return GIB_GRIDS.map((rows) => {
    const w = Math.max(...rows.map((row) => row.length)) + 2;
    const h = rows.length + 2;
    return cell(w, h, rows, GIB, 1, 1).outline({ color: ink[0] }).toSprite(w, h, Math.floor(w / 2), Math.floor(h / 2));
  });
}

// --------------------------------------------------------- ground marks

const PRINT_W = 8;
const PRINT_H = 12;

function footprint(color: number, light: number, mirror: boolean): PixelSprite {
  const canvas = new PixelCanvas(PRINT_W, PRINT_H);
  canvas.ellipse(4, 3.5, 2.5, 3, color);
  canvas.ellipse(4, 9, 1.8, 1.8, color);
  canvas.px(3, 2, light);
  canvas.px(5, 0, color);
  const shown = mirror ? canvas.mirrorX() : canvas;
  return shown.toSprite(PRINT_W, PRINT_H, 4, 6);
}

/** Left, right and a worn-out left: bloody footprints a zombie leaves, fading as they go. */
function buildBloodFootprints(): PixelSprite[] {
  return [footprint(blood[1], blood[2], false), footprint(blood[1], blood[2], true), footprint(blood[0], blood[1], false)];
}

const SCORCH_SIZES = [14, 20, 28];

function scorch(size: number, seed: number): PixelSprite {
  const random = seeded(seed);
  const canvas = new PixelCanvas(size, size);
  const c = (size - 1) / 2;
  canvas.ellipse(c, c, size / 2 - 0.5, size / 2.5, ink[1]);
  canvas.ellipse(c, c, size / 3, size / 4, ink[0]);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot((x - c) / (size / 2), (y - c) / (size / 2.5));
      const rim = distance > 0.75 && canvas.get(x, y) !== null;
      const chipped = rim && random() < 0.4;
      if (chipped) canvas.erase(x, y);
    }
  }
  for (let i = 0; i < 6; i++) {
    const x = Math.round(c + (random() - 0.5) * size * 0.7);
    const y = Math.round(c + (random() - 0.5) * size * 0.5);
    const onMark = canvas.get(x, y) !== null;
    if (onMark) canvas.px(x, y, i < 4 ? ash[0] : fire[0]);
  }
  canvas.px(Math.round(c), Math.round(c), ink[0]);
  return canvas.toSprite(size, size, Math.floor(size / 2), Math.floor(size / 2));
}

/** Burnt ground left by a molotov, a flare or a blast, small to large. */
function buildScorchDecals(): PixelSprite[] {
  return SCORCH_SIZES.map((size, i) => scorch(size, 31 + i));
}

const SHARDS: readonly (readonly (readonly [number, number])[])[] = [
  [[1, 3], [5, 1], [4, 4]],
  [[1, 1], [6, 3], [2, 5]],
  [[2, 1], [4, 1], [3, 5]],
];

/** Broken glass from windows and bottles. */
function buildGlassShards(): PixelSprite[] {
  return SHARDS.map((points) => {
    const canvas = new PixelCanvas(8, 8);
    canvas.poly(points, metal[3]);
    canvas.line(points[0][0], points[0][1], points[1][0], points[1][1], teal[2]);
    canvas.px(points[0][0], points[0][1], bone[3]);
    return canvas.outline({ color: ink[0] }).toSprite(8, 8, 4, 4);
  });
}

function bulletHole(size: number, seed: number): PixelSprite {
  const random = seeded(seed);
  const canvas = new PixelCanvas(size, size);
  const c = Math.floor(size / 2);
  canvas.rect(c - 1, c - 1, 2, 2, concrete[1]);
  canvas.rect(c, c, 1, 1, ink[0]);
  canvas.px(c - 1, c - 1, ink[1]);
  const arms = 3 + Math.floor(random() * 2);
  for (let i = 0; i < arms; i++) {
    const angle = random() * Math.PI * 2;
    const length = c - 1;
    const x = Math.round(c + Math.cos(angle) * length);
    const y = Math.round(c + Math.sin(angle) * length);
    canvas.line(c, c, x, y, concrete[0]);
  }
  canvas.px(c - 2, c - 2, concrete[3]);
  canvas.px(c + 1, c - 2, concrete[3]);
  canvas.px(c - 2, c + 1, concrete[2]);
  canvas.rect(c, c, 1, 1, ink[0]);
  return canvas.toSprite(size, size, c, c);
}

/** Chips and cracks where bullets land in a wall or floor. */
function buildBulletHoles(): PixelSprite[] {
  return [bulletHole(7, 5), bulletHole(7, 9), bulletHole(9, 14)];
}

// ----------------------------------------------------------- pickup ring

const RING_W = 34;
const RING_H = 16;
const RING_RADII: readonly (readonly [number, number, number])[] = [
  [5, 2, fire[2]],
  [9, 3.5, fire[2]],
  [13, 5, fire[1]],
  [16, 6, fire[0]],
];

function dotted(src: PixelCanvas): PixelCanvas {
  const out = new PixelCanvas(src.w, src.h);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const color = src.get(x, y);
      const keep = color !== null && (x + y) % 2 === 0;
      if (keep) out.px(x, y, color);
    }
  }
  return out;
}

/** A ring that swells under a pickup to catch the eye, solid at first then breaking up as it fades. */
function buildPickupRing(): Clip {
  const frames = RING_RADII.map(([rx, ry, color], f) => {
    const ring = new PixelCanvas(RING_W, RING_H).ellipseOutline(17, 8, rx, ry, color);
    const shown = f < 2 ? ring : dotted(ring);
    return shown.toSprite(RING_W, RING_H, 17, 8);
  });
  return makeClip(frames, 8, true);
}

export function buildAmbientFx(): AmbientFxArt {
  return {
    hitSpark: buildHitSpark(),
    rainStreak: buildRainStreak(),
    rainSplash: buildRainSplash(),
    emberDrift: buildEmberDrift(),
    sporeDrift: buildSporeDrift(),
    leafFall: buildLeafFall(),
    gibs: buildGibs(),
    bloodFootprints: buildBloodFootprints(),
    scorchDecals: buildScorchDecals(),
    glassShards: buildGlassShards(),
    bulletHoles: buildBulletHoles(),
    pickupRing: buildPickupRing(),
  };
}
