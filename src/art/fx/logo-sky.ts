// The title lockup's night sky: a cold moon with its seas and halo, a few stars and one bat.
import type { PixelCanvas, Point } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Color } from '../palette.ts';
import type { Grid } from './shared.ts';

const { denim, ink, metal } = RAMPS;

const MOON: readonly [number, number, number] = [240, 56, 26];
/** Dark seas on the moon, as ellipses. */
const SEAS: readonly (readonly [number, number, number, number])[] = [[222, 50, 4, 3], [250, 41, 5, 3], [253, 62, 6, 7], [238, 72, 8, 4], [229, 62, 4, 3]];
const STARS: readonly Point[] = [[3, 42], [50, 1], [92, 1], [270, 20], [272, 74], [3, 78], [234, 1], [150, 1], [64, 76]];
/** The bat with its wings up and down: the two strokes of one flap. */
const BAT_UP: Grid = ['#.........#', '##..#.#..##', '###.###.###', '###########', '.##.###.##.', '.....#.....'];
const BAT_DOWN: Grid = ['...........', '###.....###', '#####.#####', '###########', '.##.###.##.', '.....#.....'];
/** Wings spread and still, for gliding. */
const BAT_GLIDE: Grid = ['...........', '#.........#', '##.......##', '###.###.###', '.##.###.##.', '.....#.....'];
const BAT_AT: Point = [234, 48];
/** Where the loop turns from flapping to gliding. */
const GLIDE_AT = 0.375;

/** 0 up to 1 and back to 0 with no seam: the loop's breathing. */
export function swell(phase: number): number {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

/** The moon's lit edge fades through grey into the blue of its shadow. */
function moonShade(shade: number, r: number): Color {
  const isLitEdge = shade < r + 1;
  if (isLitEdge) return metal[3];
  return shade < r + 7 ? metal[2] : denim[2];
}

function paintMoon(target: PixelCanvas, phase: number): void {
  const [cx, cy, r] = MOON;
  const halo = 7 + Math.round(swell(phase));
  for (let y = 0; y < target.h; y++) {
    for (let x = 0; x < target.w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      const even = (x + y) % 2 === 0;
      const isPastHalo = d > r + halo;
      if (isPastHalo) continue;
      const isOuterHalo = d > r + 2;
      if (isOuterHalo) {
        if (even) target.px(x, y, denim[0]);
        continue;
      }
      const isInnerHalo = d > r;
      if (isInnerHalo) {
        target.px(x, y, even ? denim[1] : denim[0]);
        continue;
      }
      const shade = Math.hypot(dx + 7, dy + 7) + (even ? 2 : 0);
      target.px(x, y, moonShade(shade, r));
    }
  }
  for (const [x, y, rx, ry] of SEAS) {
    for (let j = -ry; j <= ry; j++) {
      for (let i = -rx; i <= rx; i++) {
        const isOutsideSea = (i * i) / (rx * rx) + (j * j) / (ry * ry) > 1;
        if (isOutsideSea) continue;
        const under = target.get(x + i, y + j);
        if (under === metal[3]) target.px(x + i, y + j, metal[2]);
        else if (under === metal[2]) target.px(x + i, y + j, denim[2]);
        else if (under === denim[2]) target.px(x + i, y + j, denim[1]);
      }
    }
  }
}

/**
 * Stars, the moon and its bat, behind the letters. `phase` is 0 to 1 around the loop: the halo breathes,
 * the bat beats its wings a few times, then glides, and its path sways and dips over the moon.
 */
export function paintSky(target: PixelCanvas, phase: number): void {
  for (const [x, y] of STARS) target.px(x, y, metal[3]);
  paintMoon(target, phase);
  const [bx, by] = BAT_AT;
  const isGliding = phase >= GLIDE_AT;
  const beat = isGliding ? BAT_GLIDE : Math.floor(phase * 8) % 2 === 1 ? BAT_UP : BAT_DOWN;
  const sway = Math.round(Math.sin(2 * Math.PI * phase) * 5);
  const dip = Math.round(Math.sin(4 * Math.PI * phase) * 2);
  target.grid(bx + sway, by + dip, beat, { '#': ink[0] });
}
