// The sewer's props: the cast-iron manhole cover on the street, the iron ladder in the shaft below,
// and the pipe mouth, overflow grate and wall conduit that dress the tunnels.
// Sizes are fixed here, not read from PROP_DEFS, so the file stands before those keys land:
// manhole 16x16, sewer ladder 16x6 (both match the spec footprints), pipe mouth 24x18,
// overflow grate 16x10, wall conduit 16x6. Each bakes with its anchor at the bottom centre.

import type { PixelSprite } from '../types.ts';
import { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import { bake } from './common.ts';

const { acid, concrete, fire, ink, metal, olive } = RAMPS;

const MANHOLE = 16;
const LADDER_W = 16;
const LADDER_H = 6;
const MOUTH_W = 24;
const MOUTH_H = 18;
const GRATE_W = 16;
const GRATE_H = 10;
const CONDUIT_W = 16;
const CONDUIT_H = 6;

/** A round cast-iron cover seen from above: a ring, a crosshatch of anti-slip ribs and a keyhole slot. */
export function buildManhole(): PixelSprite {
  const c = new PixelCanvas(MANHOLE, MANHOLE);
  const mid = MANHOLE / 2 - 0.5;
  c.ellipse(mid, mid, 8, 8, ink[0]).ellipse(mid, mid, 7, 7, metal[0]);
  c.ellipse(mid, mid, 6, 6, metal[1]);
  c.ellipseOutline(mid, mid, 6, 6, metal[2]);
  c.ellipseOutline(mid, mid, 4, 4, metal[0]);
  // Anti-slip crosshatch inside the ring, clipped to the disc.
  for (let y = 4; y <= 11; y++) {
    for (let x = 4; x <= 11; x++) {
      const dx = x - mid;
      const dy = y - mid;
      if (dx * dx + dy * dy > 13) continue;
      if ((x + y) % 3 === 0 || (x - y + 16) % 3 === 0) c.px(x, y, metal[0]);
    }
  }
  // Keyhole slot for the hook, with a dark pit and a lit edge above it.
  c.rect(6, 7, 4, 2, ink[0]).rect(6, 6, 4, 1, metal[2]).px(7, 7, ink[1]);
  // Rust and grime at the rim, a little catch of light on the lip.
  c.px(3, 12, olive[0]).px(12, 4, olive[0]).px(12, 11, concrete[0]).px(5, 3, metal[3]);
  return bake(c, 0, MANHOLE, MANHOLE);
}

/** Two iron rails with rungs, bolted to a wall seen from above, with a drop shadow under it. */
export function buildSewerLadder(): PixelSprite {
  const c = new PixelCanvas(LADDER_W, LADDER_H);
  c.rect(2, 3, LADDER_W - 3, 3, ink[0]);
  c.rect(1, 0, LADDER_W - 2, 1, metal[2]).rect(1, 1, LADDER_W - 2, 1, metal[1]);
  c.rect(1, 4, LADDER_W - 2, 1, metal[1]).rect(1, 5, LADDER_W - 2, 1, metal[0]);
  for (let x = 2; x < LADDER_W - 2; x += 3) {
    c.rect(x, 1, 1, 4, metal[2]).px(x, 2, metal[3]).px(x, 4, metal[0]);
  }
  c.rect(0, 0, 1, 6, metal[0]).rect(LADDER_W - 1, 0, 1, 6, metal[0]);
  return bake(c, 0, LADDER_W, LADDER_H);
}

/** A round concrete outfall seen face-on, mouth black, with a lip of sludge and a trickle. */
export function buildPipeMouth(): PixelSprite {
  const c = new PixelCanvas(MOUTH_W, MOUTH_H);
  const cx = MOUTH_W / 2 - 0.5;
  c.rect(1, 2, MOUTH_W - 2, MOUTH_H - 2, concrete[1]).rect(1, 2, MOUTH_W - 2, 1, concrete[3]);
  c.rect(1, MOUTH_H - 2, MOUTH_W - 2, 2, concrete[0]);
  c.ellipse(cx, 9, 8, 7, concrete[0]).ellipse(cx, 9, 7, 6, ink[0]).ellipse(cx, 10, 5, 4, ink[1]);
  c.ellipse(cx, 10, 3, 2, ink[0]);
  c.rect(6, 13, 12, 3, olive[0]).rect(7, 14, 10, 1, olive[1]).px(10, 14, acid[1]).px(14, 15, acid[0]);
  c.rect(11, 9, 2, 4, olive[1]).px(11, 9, acid[1]);
  c.rect(3, 3, 1, 5, concrete[0]).rect(20, 4, 1, 4, concrete[0]);
  for (const [x, y] of [[2, 3], [21, 3]] as const) c.px(x, y, metal[2]);
  return bake(c, 0, MOUTH_W, MOUTH_H);
}

/** A flat iron grate over a drain: bars over a dark gap with a dull emergency-green glow below. */
export function buildOverflowGrate(): PixelSprite {
  const c = new PixelCanvas(GRATE_W, GRATE_H);
  c.rect(0, 0, GRATE_W, GRATE_H, metal[1]).frame(0, 0, GRATE_W, GRATE_H, metal[2]);
  c.rect(0, GRATE_H - 1, GRATE_W, 1, metal[0]);
  c.rect(2, 2, GRATE_W - 4, GRATE_H - 4, ink[0]);
  c.rect(3, 5, GRATE_W - 6, 2, acid[0]).px(6, 5, acid[1]).px(11, 6, acid[1]);
  for (let x = 3; x < GRATE_W - 2; x += 3) c.rect(x, 2, 1, GRATE_H - 4, metal[2]).px(x, 3, metal[3]);
  for (const [x, y] of [[1, 1], [GRATE_W - 2, 1]] as const) c.px(x, y, ink[1]);
  return bake(c, 0, GRATE_W, GRATE_H);
}

/** A wall-mounted conduit run: a steel pipe with clamps and a weeping joint. */
export function buildWallConduit(): PixelSprite {
  const c = new PixelCanvas(CONDUIT_W, CONDUIT_H);
  c.rect(0, 4, CONDUIT_W, 2, ink[0]);
  c.rect(0, 1, CONDUIT_W, 3, metal[1]).rect(0, 1, CONDUIT_W, 1, metal[3]).rect(0, 3, CONDUIT_W, 1, metal[0]);
  for (const x of [2, 12]) c.rect(x, 0, 2, 5, metal[2]).rect(x, 0, 2, 1, metal[3]).px(x + 1, 4, metal[0]);
  c.rect(7, 2, 2, 2, olive[1]).px(7, 4, fire[1]);
  return bake(c, 0, CONDUIT_W, CONDUIT_H);
}
