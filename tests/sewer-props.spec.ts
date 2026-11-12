import { describe, expect, it } from 'vitest';
import { PROP_DEFS } from '../shared/protocol.ts';
import { buildEnvironment } from '../src/art/environment.ts';
import {
  buildManhole,
  buildManholeOpen,
  buildOverflowGrate,
  buildPipeMouth,
  buildSewerLadder,
  buildWallConduit,
} from '../src/art/environment/sewer-props.ts';
import { RAMPS, inPalette } from '../src/art/palette.ts';
import type { PixelSprite } from '../src/art/types.ts';

// The sewer prop sheet: every piece's canvas size, and the palette it may draw from.
const SIZES = {
  manhole: { build: buildManhole, w: 16, h: 16 },
  manhole_open: { build: buildManholeOpen, w: 16, h: 16 },
  sewer_ladder: { build: buildSewerLadder, w: 16, h: 26 },
  pipe_mouth: { build: buildPipeMouth, w: 24, h: 18 },
  overflow_grate: { build: buildOverflowGrate, w: 16, h: 10 },
  wall_conduit: { build: buildWallConduit, w: 16, h: 6 },
} as const;

/** The ramps sewer-props.ts destructures from RAMPS. A new ramp here is a deliberate palette change. */
const SEWER_RAMPS = ['acid', 'asphalt', 'brick', 'concrete', 'fire', 'ink', 'metal', 'olive'] as const;

const PIECES = Object.entries(SIZES).map(([name, spec]) => ({ name, sprite: spec.build(), ...spec }));

function colorAt(sprite: PixelSprite, x: number, y: number): number {
  const i = (y * sprite.w + x) * 4;
  return (sprite.rgba[i] << 16) | (sprite.rgba[i + 1] << 8) | sprite.rgba[i + 2];
}

function alphaAt(sprite: PixelSprite, x: number, y: number): number {
  return sprite.rgba[(y * sprite.w + x) * 4 + 3];
}

function colorsOf(sprite: PixelSprite): number[] {
  const out = new Set<number>();
  for (let y = 0; y < sprite.h; y++) {
    for (let x = 0; x < sprite.w; x++) if (alphaAt(sprite, x, y) !== 0) out.add(colorAt(sprite, x, y));
  }
  return [...out];
}

describe('sewer props', () => {
  it.each(PIECES)('$name is $w x $h with its anchor at the bottom centre', ({ sprite, w, h }) => {
    expect([sprite.w, sprite.h]).toEqual([w, h]);
    expect(sprite.rgba.length).toBe(w * h * 4);
    expect([sprite.ax, sprite.ay]).toEqual([w / 2, h]);
  });

  it('matches the PROP_DEFS footprints: manhole fills its tile, the ladder spans its width', () => {
    expect([SIZES.manhole.w, SIZES.manhole.h]).toEqual([PROP_DEFS.manhole.w, PROP_DEFS.manhole.h]);
    expect([SIZES.manhole_open.w, SIZES.manhole_open.h]).toEqual([PROP_DEFS.manhole.w, PROP_DEFS.manhole.h]);
    expect(SIZES.sewer_ladder.w).toBe(PROP_DEFS.sewer_ladder.w);
    // The iron rises up the shaft wall above its 6px footprint.
    expect(SIZES.sewer_ladder.h).toBeGreaterThan(PROP_DEFS.sewer_ladder.h);
  });

  it.each(PIECES)('$name is hard-edged and drawn only from the 64-colour palette', ({ sprite }) => {
    for (let i = 3; i < sprite.rgba.length; i += 4) expect([0, 255]).toContain(sprite.rgba[i]);
    const colors = colorsOf(sprite);
    expect(colors.length).toBeGreaterThan(2);
    expect(colors.filter((c) => !inPalette(c))).toEqual([]);
  });

  it('draws only from the ramps the file names', () => {
    for (const key of SEWER_RAMPS) expect(Object.keys(RAMPS)).toContain(key);
    const allowed = new Set<number>(SEWER_RAMPS.flatMap((key) => [...RAMPS[key]]));
    for (const { name, sprite } of PIECES) expect(colorsOf(sprite).filter((c) => !allowed.has(c)), name).toEqual([]);
  });

  it('opens the manhole onto a dark shaft that the closed cover hides', () => {
    const closed = buildManhole();
    const open = buildManholeOpen();
    expect(Buffer.from(open.rgba).equals(Buffer.from(closed.rgba))).toBe(false);
    const dark = new Set<number>([...RAMPS.ink, ...RAMPS.asphalt]);
    const shaft = (sprite: PixelSprite) => {
      let n = 0;
      for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) n += Number(dark.has(colorAt(sprite, x, y)));
      return n;
    };
    expect(shaft(open)).toBeGreaterThan(shaft(closed) * 2);
  });

  it('keeps the manhole round: corners clear, centre solid', () => {
    for (const sprite of [buildManhole(), buildManholeOpen()]) {
      for (const [x, y] of [[0, 0], [15, 0], [0, 15], [15, 15]]) expect(alphaAt(sprite, x, y)).toBe(0);
      expect(alphaAt(sprite, 8, 8)).toBe(255);
    }
  });

  it('builds deterministically and is registered in the environment', () => {
    for (const { name, build, sprite } of PIECES) expect(Buffer.from(build().rgba).equals(Buffer.from(sprite.rgba)), name).toBe(true);
    const props = buildEnvironment().props;
    expect([props.manhole.w, props.manhole.h]).toEqual([SIZES.manhole.w, SIZES.manhole.h]);
    expect([props.sewer_ladder.w, props.sewer_ladder.h]).toEqual([SIZES.sewer_ladder.w, SIZES.sewer_ladder.h]);
  });
});
