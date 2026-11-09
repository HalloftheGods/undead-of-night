// Pixel lettering and the abstract marks that say what a building is at a glance.
// No real brands: plain words and invented shapes only.

import type { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Color } from '../palette.ts';

const { ink, metal, bone } = RAMPS;

// 5x7 capitals, seven rows of five bits. Only the letters the town's signs spell.
const BLOCK: Readonly<Record<string, readonly number[]>> = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30], E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14],
  K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31], M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 25, 21, 19, 19, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], W: [17, 17, 17, 21, 21, 27, 17], Y: [17, 17, 10, 4, 4, 4, 4],
};

// 3x5 capitals for small print.
const SMALL: Readonly<Record<string, readonly number[]>> = {
  A: [2, 5, 7, 5, 5], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], G: [3, 4, 5, 5, 3],
  H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7], M: [5, 7, 7, 5, 5],
  N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6],
  T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 3], X: [5, 5, 2, 5, 5], Y: [5, 5, 2, 2, 2],
  2: [6, 1, 2, 4, 7], 4: [5, 5, 7, 1, 1],
};

function stamp(
  c: PixelCanvas, x: number, y: number, text: string, glyphs: Readonly<Record<string, readonly number[]>>,
  cols: number, advance: number, color: Color,
): void {
  let pen = x;
  for (const letter of text) {
    (glyphs[letter] ?? []).forEach((bits, row) => {
      for (let col = 0; col < cols; col++) {
        const inked = (bits & (1 << (cols - 1 - col))) !== 0;
        if (inked) c.px(pen + col, y + row, color);
      }
    });
    pen += advance;
  }
}

export const blockWidth = (text: string): number => text.length * 6 - 1;

/** 5x7 capitals with an optional hard drop shadow to the lower right. */
export function blockText(c: PixelCanvas, x: number, y: number, text: string, color: Color, shadow?: Color): void {
  const shadowed = shadow !== undefined;
  if (shadowed) stamp(c, x + 1, y + 1, text, BLOCK, 5, 6, shadow);
  stamp(c, x, y, text, BLOCK, 5, 6, color);
}

export const heavyWidth = (text: string): number => text.length * 7 - 1;

/** The same capitals with doubled stems, for names cut deep into stone. */
export function heavyText(c: PixelCanvas, x: number, y: number, text: string, color: Color): void {
  stamp(c, x, y, text, BLOCK, 5, 7, color);
  stamp(c, x + 1, y, text, BLOCK, 5, 7, color);
}

export function smallText(c: PixelCanvas, x: number, y: number, text: string, color: Color): void {
  stamp(c, x, y, text, SMALL, 3, 4, color);
}

/** A framed board for lettering: lit top and left, dark bottom and right. */
export function signBoard(c: PixelCanvas, x: number, y: number, w: number, h: number, field: Color, frame: Color = metal[2]): void {
  c.rect(x, y, w, h, field);
  c.rect(x, y, w, 1, frame).rect(x, y, 1, h, frame);
  c.rect(x, y + h - 1, w, 1, ink[1]).rect(x + w - 1, y, 1, h, ink[1]);
}

/** A plus shape, with a lit top and left and shade on its lower right. */
export function plusMark(c: PixelCanvas, cx: number, cy: number, arm: number, half: number, face: Color, lit: Color, dark: Color): void {
  const size = half * 2 + 1;
  c.rect(cx - arm, cy - half, arm * 2 + 1, size, face).rect(cx - half, cy - arm, size, arm * 2 + 1, face);
  c.rect(cx - arm, cy - half, arm - half, 1, lit).rect(cx - arm, cy - half, 1, size, lit);
  c.rect(cx - half, cy - arm, size, 1, lit).rect(cx - half, cy - arm, 1, arm - half, lit);
  c.rect(cx + half + 1, cy - half, arm - half, 1, lit);
  c.rect(cx - arm, cy + half, arm - half, 1, dark).rect(cx + half + 1, cy + half, arm - half, 1, dark);
  c.rect(cx + arm, cy - half, 1, size, dark).rect(cx + half, cy + half, 1, arm - half + 1, dark);
  c.rect(cx - half, cy + arm, size, 1, dark);
}

const HEART = [
  '.##...##.',
  '####.####',
  '#########',
  '#########',
  '.#######.',
  '..#####..',
  '...###...',
  '....#....',
];

export function heartMark(c: PixelCanvas, x: number, y: number, color: Color): void {
  c.grid(x, y, HEART, { '#': color });
}

/** The trace of a heartbeat, flat, one spike, flat. */
export function pulseLine(c: PixelCanvas, x: number, y: number, w: number, color: Color): void {
  const mid = x + Math.floor(w / 2);
  c.rect(x, y, mid - x - 4, 1, color);
  c.line(mid - 4, y, mid - 2, y - 4, color).line(mid - 2, y - 4, mid, y + 5, color);
  c.line(mid, y + 5, mid + 2, y, color);
  c.rect(mid + 2, y, x + w - mid - 2, 1, color);
}

const BADGE = [
  '......#.#......',
  '.#####...#####.',
  '#oooooo#oooooo#',
  '#ooooo###ooooo#',
  '#oo#########oo#',
  '#ooo#######ooo#',
  '#oooo#####oooo#',
  '#oooo#####oooo#',
  '#ooo###.###ooo#',
  '.#oo##...##oo#.',
  '.#ooooooooooo#.',
  '..#ooooooooo#..',
  '...##ooooo##...',
  '.....##o##.....',
  '.......#.......',
];

/** A shield with a star in it: law, without being anybody's actual crest. */
export function badgeMark(c: PixelCanvas, x: number, y: number, rim: Color, field: Color, scale = 1): void {
  const legend: Readonly<Record<string, Color>> = { '#': rim, o: field };
  BADGE.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const color = legend[row[i]];
      const painted = color !== undefined;
      if (painted) c.rect(x + i * scale, y + j * scale, scale, scale, color);
    }
  });
}

/** Concentric rings and a cross-hair. */
export function targetMark(c: PixelCanvas, cx: number, cy: number, r: number, ring: Color, field: Color): void {
  c.ellipse(cx, cy, r, r, ring).ellipse(cx, cy, r - 2, r - 2, field);
  c.ellipse(cx, cy, r * 0.55, r * 0.55, ring).ellipse(cx, cy, r * 0.55 - 2, r * 0.55 - 2, field);
  c.rect(cx - r - 3, cy, r * 2 + 7, 1, ring).rect(cx, cy - r - 3, 1, r * 2 + 7, ring);
  c.rect(cx - 1, cy - 1, 3, 3, bone[2]);
}

const RIFLE = [
  '..............###...............#.',
  '##...........#####..............#.',
  '####......#######################.',
  '#########################.........',
  '##########.####.##.###............',
  '#######.....###.##................',
  '####........##....................',
];

/** A long gun in profile, stock to the left. */
export function rifleMark(c: PixelCanvas, x: number, y: number, color: Color): void {
  c.grid(x, y, RIFLE, { '#': color });
}
