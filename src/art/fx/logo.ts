// The title lockup: UNDEAD OF NIGHT. Bone block capitals dipped in blood under a cold
// moon, the blood line wandering across each word and running off in drips. Damage is
// placed by hand: every bite, crack and bullet hole below sits where it breaks a letter
// without losing it. The last line is an empty ammo belt with one round left in it.

import type { PixelSprite } from '../types.ts';
import { PixelCanvas } from '../kit.ts';
import type { Legend, Point } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Color } from '../palette.ts';
import { STENCIL } from './lettering.ts';
import { paintSky } from './logo-sky.ts';
import type { Grid } from './shared.ts';

const { blood, bone, denim, fire, ink, wood } = RAMPS;

const W = 276;
const H = 94;
const EXTRUDE = 2;
const SUBTITLE = 'LAST ROUND';
const SUB_Y = 81;
const SUB_PITCH = 11;
const SUB_SPACE = 7;
const BELT_LEFT = 10;
const BELT_RIGHT = 266;
const LOOP_PITCH = 7;

// ---------------------------------------------------------------- letterforms

interface Glyph {
  readonly outer: readonly Point[];
  readonly holes: readonly (readonly Point[])[];
}

/** One cut letter: which, where, how wide, and the hand kerning that hangs it crooked. */
type Placed = readonly [letter: string, x: number, w: number, dy: number];

interface Word {
  readonly y: number;
  /** Bottom row of the capitals, counted from y. */
  readonly h: number;
  readonly stem: number;
  readonly bar: number;
  readonly letters: readonly Placed[];
  /** The blood line: x and the y it stands at, joined up in small steps. */
  readonly soak: readonly Point[];
}

/** Chamfered block capitals, cut to any box. w and h are the last column and row. */
function cut(letter: string, w: number, h: number, s: number, b: number): Glyph {
  const c = 4;
  const r = Math.round;
  const box: Point[] = [[c, 0], [w - c, 0], [w, c], [w, h - c], [w - c, h], [c, h], [0, h - c], [0, c]];
  const mid = r(h * 0.44);
  switch (letter) {
    case 'O':
      return { outer: box, holes: [[[s + 1, b], [w - s - 1, b], [w - s, b + 1], [w - s, h - b - 1], [w - s - 1, h - b], [s + 1, h - b], [s, h - b - 1], [s, b + 1]]] };
    case 'U':
      return { outer: [[0, 0], [s, 0], [s, h - b - 2], [s + 2, h - b], [w - s - 2, h - b], [w - s, h - b - 2], [w - s, 0], [w, 0], [w, h - c], [w - c, h], [c, h], [0, h - c]], holes: [] };
    case 'N': {
      const lean = r(h * 0.42);
      return { outer: [[0, 0], [s + 2, 0], [w - s, h - lean], [w - s, 0], [w, 0], [w, h], [w - s - 2, h], [s, lean], [s, h], [0, h]], holes: [] };
    }
    case 'D':
      return {
        outer: [[0, 0], [w - c - 3, 0], [w, c + 3], [w, h - c - 3], [w - c - 3, h], [0, h]],
        holes: [[[s, b], [w - s - 3, b], [w - s, b + 3], [w - s, h - b - 3], [w - s - 3, h - b], [s, h - b]]],
      };
    case 'E':
      return { outer: [[0, 0], [w, 0], [w, b - 1], [s, b - 1], [s, mid - 1], [w - 4, mid - 1], [w - 4, mid + b - 2], [s, mid + b - 2], [s, h - b + 1], [w, h - b + 1], [w, h], [0, h]], holes: [] };
    case 'F':
      return { outer: [[0, 0], [w, 0], [w, b - 1], [s, b - 1], [s, mid - 1], [w - 4, mid - 1], [w - 4, mid + b - 2], [s, mid + b - 2], [s, h], [0, h]], holes: [] };
    case 'H':
      return { outer: [[0, 0], [s, 0], [s, mid], [w - s, mid], [w - s, 0], [w, 0], [w, h], [w - s, h], [w - s, mid + b - 1], [s, mid + b - 1], [s, h], [0, h]], holes: [] };
    case 'I': {
      const l = r((w - s) / 2);
      return { outer: [[0, 0], [w, 0], [w, b - 2], [l + s, b - 2], [l + s, h - b + 2], [w, h - b + 2], [w, h], [0, h], [0, h - b + 2], [l, h - b + 2], [l, b - 2], [0, b - 2]], holes: [] };
    }
    case 'T': {
      const l = r((w - s) / 2);
      return { outer: [[0, 0], [w, 0], [w, b], [l + s, b], [l + s, h], [l, h], [l, b], [0, b]], holes: [] };
    }
    case 'G': {
      const spur = r(w * 0.5);
      const arm = r(h * 0.52);
      return {
        outer: [
          [c, 0], [w - c, 0], [w, c], [w, b], [s + 1, b], [s, b + 1], [s, h - b - 1], [s + 1, h - b],
          [w - s - 1, h - b], [w - s, h - b - 1], [w - s, arm + b - 2], [spur, arm + b - 2], [spur, arm], [w, arm], [w, h - c], [w - c, h], [c, h], [0, h - c], [0, c],
        ],
        holes: [],
      };
    }
    case 'A': {
      const a = r(w * 0.27);
      const cross = r(h * 0.54);
      const under = cross + b - 3;
      const at = (y: number) => r(((h - y) / h) * a);
      return {
        outer: [[a, 0], [w - a, 0], [w, h], [w - s, h], [w - s - at(under), under], [s + at(under), under], [s, h], [0, h]],
        holes: [[[r(w / 2) - 1, b], [r(w / 2) + 1, b], [w - s - at(cross), cross], [s + at(cross), cross]]],
      };
    }
    default:
      throw new Error(`no letter ${letter}`);
  }
}

const WORDS: readonly Word[] = [
  {
    y: 4, h: 31, stem: 11, bar: 8,
    letters: [['U', 8, 37, 0], ['N', 51, 37, 1], ['D', 94, 37, -1], ['E', 137, 34, 1], ['A', 176, 41, -1], ['D', 223, 37, 1]],
    soak: [
      [0, 24], [10, 22], [18, 25], [28, 23], [40, 26], [52, 23], [60, 20], [70, 25], [84, 27], [96, 24], [108, 21], [118, 25],
      [130, 26], [140, 22], [150, 25], [160, 23], [172, 26], [184, 24], [194, 20], [204, 25], [216, 27], [228, 24], [240, 21], [250, 25], [262, 23],
    ],
  },
  {
    y: 44, h: 24, stem: 8, bar: 7,
    letters: [['O', 8, 26, 0], ['F', 40, 22, 1], ['N', 78, 28, 0], ['I', 112, 16, 1], ['G', 134, 26, -1], ['H', 166, 28, 1], ['T', 200, 26, 0]],
    soak: [
      [0, 60], [12, 58], [24, 61], [38, 59], [52, 62], [64, 60], [84, 57], [96, 61], [110, 59], [122, 62], [136, 58], [150, 60],
      [166, 62], [178, 59], [192, 61], [206, 57], [216, 60], [230, 58],
    ],
  },
];

// ---------------------------------------------------------------- hand placed detail

const BLOOD: Legend = { u: blood[3], t: blood[2], s: blood[1], e: bone[3] };

interface RunShape {
  readonly head: Grid;
  readonly neck: string;
  readonly bead: Grid;
}

const RUNS: readonly RunShape[] = [
  {
    head: ['uttttts', '.utttss', '..utts.'],
    neck: '..uts..',
    bead: ['..utts.', '.uutts.', '.uettss', '.utttss', '..tsss.'],
  },
  {
    head: ['uttts', '.utts'],
    neck: '.ut..',
    bead: ['.uts.', 'uetss', 'utsss', '.sss.'],
  },
  {
    head: ['uttss', '.uts.'],
    neck: '.us..',
    bead: ['.uts.', '.ets.', '.tss.'],
  },
];

/** x, the row of the word it runs from, which run shape, and how long its neck is. */
const DRIPS: readonly (readonly [number, number, number, number])[] = [
  [11, 0, 2, 0], [20, 0, 1, 1], [35, 0, 2, 10], [55, 0, 2, 0], [66, 0, 0, 34], [82, 0, 1, 0], [100, 0, 2, 1],
  [108, 0, 2, 14], [122, 0, 1, 0], [146, 0, 2, 0], [161, 0, 2, 12], [182, 0, 1, 1], [194, 0, 2, 16], [212, 0, 1, 0], [232, 0, 0, 2], [250, 0, 2, 0],
  [11, 1, 1, 1], [24, 1, 2, 0], [46, 1, 0, 2], [84, 1, 2, 1], [100, 1, 1, 0], [118, 1, 2, 1], [140, 1, 1, 1], [152, 1, 2, 0], [171, 1, 2, 2], [187, 1, 1, 0], [209, 1, 0, 5],
];

/** A drop that has let go of its run. */
const LOOSE: readonly Point[] = [[68, 73], [197, 73]];
const DROP: Grid = ['.u.', 'uts', 'uts', '.s.'];

/** Chunks missing from the letters, as small polygons. */
const BITES: readonly (readonly Point[])[] = [
  [[8, 14], [12, 16], [10, 18], [8, 21]],
  [[38, 4], [40, 7], [43, 6], [45, 4]],
  [[56, 5], [59, 8], [62, 5]],
  [[82, 5], [80, 8], [83, 9], [85, 12], [88, 11], [88, 5]],
  [[51, 19], [54, 21], [51, 24]],
  [[104, 3], [107, 6], [110, 3]],
  [[131, 15], [127, 17], [129, 20], [131, 21]],
  [[166, 5], [169, 8], [171, 7], [171, 5]],
  [[137, 13], [140, 15], [137, 19]],
  [[192, 3], [194, 6], [197, 3]],
  [[248, 5], [252, 8], [254, 5]],
  [[223, 21], [226, 23], [223, 27]],
  [[14, 44], [17, 47], [20, 44]],
  [[8, 54], [11, 56], [8, 59]],
  [[46, 45], [49, 48], [52, 45]],
  [[78, 49], [81, 51], [78, 54]],
  [[99, 44], [102, 46], [106, 44]],
  [[118, 45], [120, 47], [123, 45]],
  [[150, 43], [153, 46], [156, 43]],
  [[166, 53], [169, 55], [166, 58]],
  [[188, 45], [191, 48], [194, 45]],
  [[220, 44], [223, 47], [226, 46], [226, 44]],
];

/** Hairline cracks as polylines. */
const CRACKS: readonly (readonly Point[])[] = [
  [[12, 4], [15, 8], [12, 12], [15, 17]],
  [[42, 10], [39, 14], [41, 17]],
  [[68, 11], [71, 15], [69, 19], [72, 23]],
  [[98, 4], [101, 8], [98, 12], [100, 17]],
  [[143, 6], [146, 10], [143, 14], [146, 20]],
  [[203, 4], [205, 9], [208, 12], [207, 18]],
  [[252, 6], [250, 10], [253, 14], [251, 19]],
  [[228, 6], [230, 10], [227, 13]],
  [[29, 44], [27, 48], [30, 52]],
  [[44, 46], [46, 50], [43, 54]],
  [[106, 52], [103, 56], [105, 60]],
  [[138, 44], [141, 48], [139, 52]],
  [[170, 46], [172, 50], [170, 54]],
  [[213, 52], [215, 56], [212, 60]],
];

/** Bullet holes, on stems wide enough to take one. */
const HOLES: readonly Point[] = [[37, 13], [226, 13], [146, 28]];
const HOLE: Grid = ['.##.', '####', '####', '.##.'];

/** Scrapes on the bone: x, y and length of each dash, in small groups. */
const SCUFFS: readonly (readonly [number, number, number])[] = [
  [18, 6, 3], [20, 7, 2], [36, 8, 4], [60, 9, 3], [75, 7, 4], [77, 8, 2], [112, 7, 5], [114, 8, 2], [122, 14, 3],
  [150, 7, 4], [152, 8, 3], [190, 8, 4], [196, 14, 3], [236, 7, 4], [238, 8, 2], [245, 16, 3],
  [16, 46, 3], [52, 46, 2], [86, 48, 3], [116, 54, 2], [146, 46, 3], [176, 48, 2], [208, 46, 3],
];

/** Blood flung up onto the bone. */
const FLECKS: readonly Point[] = [
  [14, 18], [40, 20], [60, 15], [78, 18], [100, 18], [122, 16], [142, 19], [158, 16], [190, 17], [201, 19], [229, 18], [254, 17],
  [12, 53], [46, 54], [92, 53], [118, 52], [141, 54], [172, 53], [207, 51],
];

const LOWER_STENCIL: Readonly<Record<string, Grid>> = {
  L: ['###......', '###......', '###......', '###......', '###......', '###......', '###......', '###......', '###.#####', '###.#####'],
  A: ['.###.###.', '####.####', '###...###', '###...###', '###...###', '#########', '#########', '###...###', '###...###', '###...###'],
  U: ['###...###', '###...###', '###...###', '###...###', '###...###', '###...###', '###...###', '###...###', '####.####', '.###.###.'],
  N: ['####..###', '#####.###', '###.#.###', '###.#.###', '###.#.###', '###.#.###', '###.#.###', '###.#.###', '###.#####', '###..####'],
  D: ['###.####.', '###.#####', '###...###', '###...###', '###...###', '###...###', '###...###', '###...###', '###.#####', '###.####.'],
};
const stencil = (letter: string): Grid => LOWER_STENCIL[letter] ?? STENCIL[letter];

// ---------------------------------------------------------------- painting

function stamped(mask: PixelCanvas, rows: Grid, x: number, y: number): void {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const isInked = row[i] === '#';
      if (isInked) mask.erase(x + i, y + j);
    }
  });
}

function wordMask(): PixelCanvas {
  const mask = new PixelCanvas(W, H);
  const cuts = new PixelCanvas(W, H);
  for (const word of WORDS) {
    for (const [letter, x, w, dy] of word.letters) {
      const glyph = cut(letter, w, word.h, word.stem, word.bar);
      const y = word.y + dy;
      mask.poly(glyph.outer.map(([px, py]) => [px + x, py + y]), bone[2]);
      for (const hole of glyph.holes) cuts.poly(hole.map(([px, py]) => [px + x, py + y]), ink[0]);
    }
  }
  for (const bite of BITES) cuts.poly(bite, ink[0]);
  for (const crack of CRACKS) {
    for (let i = 0; i + 1 < crack.length; i++) cuts.line(crack[i][0], crack[i][1], crack[i + 1][0], crack[i + 1][1], ink[0]);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const isCut = cuts.get(x, y) !== null;
      if (isCut) mask.erase(x, y);
    }
  }
  for (const [x, y] of HOLES) stamped(mask, HOLE, x, y);
  return mask;
}

const wordAt = (y: number): Word => WORDS.find((word) => y <= word.y + word.h + 2) ?? WORDS[WORDS.length - 1];

function soakAt(word: Word, x: number): number {
  const line = word.soak;
  for (let i = 0; i + 1 < line.length; i++) {
    const [x0, y0] = line[i];
    const [x1, y1] = line[i + 1];
    const isOnSegment = x >= x0 && x < x1;
    if (isOnSegment) return Math.round(y0 + ((x - x0) / (x1 - x0)) * (y1 - y0));
  }
  return line[line.length - 1][1];
}

function faceColor(mask: PixelCanvas, x: number, y: number): Color {
  const open = (dx: number, dy: number) => mask.get(x + dx, y + dy) === null;
  const word = wordAt(y);
  const soak = soakAt(word, x);
  const litEdge = open(-1, 0) || open(0, -1);
  const shadeEdge = open(1, 0) || open(0, 1);
  const isSoaked = y >= soak;
  if (isSoaked) {
    if (shadeEdge) return blood[1];
    const isBloodHighlight = y === soak || litEdge;
    if (isBloodHighlight) return blood[3];
    return y > soak + 7 ? blood[1] : blood[2];
  }
  const isSoakLine = y === soak - 1;
  if (isSoakLine) return bone[1];
  if (shadeEdge) return bone[1];
  if (litEdge) return bone[3];
  return y < word.y + 9 ? bone[3] : bone[2];
}

function paintFace(mask: PixelCanvas): PixelCanvas {
  const face = new PixelCanvas(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const isLetter = mask.get(x, y) !== null;
      if (isLetter) face.px(x, y, faceColor(mask, x, y));
    }
  }
  for (const [x, y, length] of SCUFFS) {
    for (let i = 0; i < length; i++) {
      // A scuff darkens bone one step: the brightest bone first, then the middle tone.
      const isBrightBone = face.get(x + i, y) === bone[3];
      if (isBrightBone) {
        face.px(x + i, y, bone[2]);
        continue;
      }
      const isMidBone = face.get(x + i, y) === bone[2];
      if (isMidBone) face.px(x + i, y, bone[1]);
    }
  }
  for (const [x, y] of FLECKS) {
    for (const [dx, dy, color] of [[0, 0, blood[2]], [1, 0, blood[1]], [0, 1, blood[1]]]) {
      const isOnLetter = mask.get(x + dx, y + dy) !== null;
      if (isOnLetter) face.px(x + dx, y + dy, color);
    }
  }
  return face;
}

function extrusion(mask: PixelCanvas): PixelCanvas {
  const block = new PixelCanvas(W, H);
  for (let d = EXTRUDE; d >= 1; d--) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const isLetter = mask.get(x, y) !== null;
        if (isLetter) block.px(x + d, y + d, d === 1 ? blood[0] : ink[1]);
      }
    }
  }
  return block;
}

/** Everything the sky can reach from the edge of the art, so counters stay black. */
function openSky(letters: PixelCanvas): Uint8Array {
  const open = new Uint8Array(W * H);
  const stack = [0];
  open[0] = 1;
  while (stack.length > 0) {
    const at = stack.pop() as number;
    const x = at % W;
    const y = (at - x) / W;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const isBlocked = !letters.inBounds(nx, ny) || open[ny * W + nx] || letters.get(nx, ny) !== null;
      if (isBlocked) continue;
      open[ny * W + nx] = 1;
      stack.push(ny * W + nx);
    }
  }
  return open;
}

/** A deep blue glow hugging the letters: solid close in, then a dither that thins out. */
function paintGlow(target: PixelCanvas, letters: PixelCanvas): void {
  const reach = 5;
  const open = openSky(letters);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!open[y * W + x]) continue;
      let near = 99;
      for (let j = -reach; j <= reach; j++) {
        for (let i = -reach; i <= reach; i++) {
          const isLetterNear = letters.get(x + i, y + j) !== null;
          if (isLetterNear) near = Math.min(near, Math.abs(i) + Math.abs(j));
        }
      }
      const isInGlow = near <= 3 || (near <= reach && (x + y) % 2 === 0);
      if (isInGlow) target.px(x, y, denim[0]);
    }
  }
}

function bottomOf(mask: PixelCanvas, x: number, word: Word): number {
  for (let y = word.y + word.h + 2; y >= word.y; y--) {
    const isLetter = mask.get(x, y) !== null;
    if (isLetter) return y;
  }
  return -1;
}

function paintDrips(target: PixelCanvas, mask: PixelCanvas): void {
  for (const [x, row, shape, neck] of DRIPS) {
    const { head, neck: neckRow, bead } = RUNS[shape];
    const top = bottomOf(mask, x + 1, WORDS[row]);
    const hasNoLetterBelow = top < 0;
    if (hasNoLetterBelow) continue;
    target.grid(x, top, [...head, ...Array.from({ length: neck }, () => neckRow), ...bead], BLOOD);
  }
  for (const [x, y] of LOOSE) target.grid(x, y, DROP, BLOOD);
}

function subtitleColor(row: number): Color {
  const isTopRow = row < 2;
  if (isTopRow) return fire[3];
  return row < 7 ? fire[2] : fire[1];
}

/** An ammo belt with nothing in it: empty loops on a strap. */
function paintBelt(target: PixelCanvas, from: number, to: number): void {
  target.rect(from, SUB_Y + 3, to - from, 4, wood[1]);
  target.rect(from, SUB_Y + 3, to - from, 1, wood[2]);
  for (let x = from + 1; x + 5 <= to; x += LOOP_PITCH) {
    target.rect(x, SUB_Y + 2, 5, 6, wood[2]);
    target.rect(x, SUB_Y + 2, 5, 1, wood[3]);
    target.rect(x + 1, SUB_Y + 2, 3, 3, ink[0]);
  }
}

/** The last round: a brass case and a copper nose, standing tall in its loop. */
function paintRound(target: PixelCanvas, x: number): void {
  target.grid(x, SUB_Y - 5, ['..p..', '.pqr.', '.pqr.', 'pqqqr', 'pqqqr', 'abbbc', 'abbbc', 'abbbc', 'abbbc', 'abbbc', 'abbbc', 'ddddd'], {
    p: fire[3], q: fire[1], r: fire[0], a: fire[3], b: fire[2], c: fire[1], d: fire[0],
  });
}

function paintSubtitle(target: PixelCanvas): void {
  const width = [...SUBTITLE].reduce((sum, letter) => sum + (letter === ' ' ? SUB_SPACE : SUB_PITCH), -2);
  const left = Math.floor((BELT_LEFT + BELT_RIGHT - width) / 2);
  const layer = new PixelCanvas(W, H);
  let pen = left;
  for (const letter of SUBTITLE) {
    const isSpace = letter === ' ';
    if (isSpace) {
      pen += SUB_SPACE;
      continue;
    }
    stencil(letter).forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const isInked = row[i] === '#';
        if (isInked) layer.px(pen + i, SUB_Y + j, subtitleColor(j));
      }
    });
    pen += SUB_PITCH;
  }
  paintBelt(layer, BELT_LEFT, left - 8);
  paintBelt(layer, left + width + 8, BELT_RIGHT);
  paintRound(layer, left + width + 10);
  layer.outline({ color: ink[0] });
  target.blit(layer);
}

export function buildLogo(): PixelSprite {
  const mask = wordMask();
  const letters = new PixelCanvas(W, H).blit(extrusion(mask)).blit(paintFace(mask));
  paintDrips(letters, mask);
  letters.outline({ color: ink[0] });
  const art = new PixelCanvas(W, H);
  paintGlow(art, letters);
  paintSky(art);
  art.blit(letters);
  paintSubtitle(art);
  return art.toSprite(W, H, W / 2, H / 2);
}
