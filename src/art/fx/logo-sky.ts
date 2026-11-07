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
const BAT: Grid = ['#.........#', '##..#.#..##', '###.###.###', '###########', '.##.###.##.', '.....#.....'];
const BATS: readonly Point[] = [[234, 48]];

/** The moon's lit edge fades through grey into the blue of its shadow. */
function moonShade(shade: number, r: number): Color {
  const isLitEdge = shade < r + 1;
  if (isLitEdge) return metal[3];
  return shade < r + 7 ? metal[2] : denim[2];
}

function paintMoon(target: PixelCanvas): void {
  const [cx, cy, r] = MOON;
  for (let y = 0; y < target.h; y++) {
    for (let x = 0; x < target.w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      const even = (x + y) % 2 === 0;
      const isPastHalo = d > r + 7;
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

/** Stars, the moon and its bat, behind the letters. */
export function paintSky(target: PixelCanvas): void {
  for (const [x, y] of STARS) target.px(x, y, metal[3]);
  paintMoon(target);
  for (const [x, y] of BATS) target.grid(x, y, BAT, { '#': ink[0] });
}
