// The Survivors' Ledger: tooled distressed leather cover with heavy brass corner plates,
// aged parchment page inset with deckled edges, a hanging crimson velvet ribbon,
// a golden skull and crossed bones crest, authentic tally marks, and a bloody thumbprint.

import type { Legend } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { PixelSprite } from '../types.ts';
import { CardGrid } from './card-grid.ts';

const { blood, bone, fire, ink, metal, wood } = RAMPS;

const RECORDS_LEGEND: Legend = {
  k: ink[0],
  K: ink[1],
  w: wood[0],
  x: wood[1],
  y: wood[2],
  z: wood[3],
  n: bone[0],
  e: bone[1],
  W: bone[2],
  Z: bone[3],
  r: blood[0],
  s: blood[1],
  t: blood[2],
  u: blood[3],
  M: metal[1],
  l: metal[2],
  L: metal[3],
  C: fire[1],
  B: fire[2],
  Y: fire[3],
};

function drawCornerBracket(board: CardGrid, ox: number, oy: number, flipX: boolean, flipY: boolean): void {
  for (let j = 0; j < 8; j += 1) {
    for (let i = 0; i < 8; i += 1) {
      if (i + j < 10) {
        const x = flipX ? ox + (7 - i) : ox + i;
        const y = flipY ? oy + (7 - j) : oy + j;
        const isEdge = i === 0 || j === 0 || i + j === 9;
        const isRivet = (i === 2 && j === 2) || (i === 5 && j === 1) || (i === 1 && j === 5);
        if (isRivet) {
          board.put(x, y, 'L');
        } else if (isEdge) {
          board.put(x, y, 'k');
        } else {
          board.put(x, y, (i + j) % 2 === 0 ? 'Y' : 'B');
        }
      }
    }
  }
}

export function buildRecordsCover(): PixelSprite {
  const board = new CardGrid('x');

  // Tooled leather grain background
  board.dither(0, 0, 56, 72, 'w', 'x');

  // Stitched border seam
  for (let x = 2; x < 54; x += 2) {
    board.put(x, 2, 'z');
    board.put(x, 69, 'z');
  }
  for (let y = 2; y < 70; y += 2) {
    board.put(2, y, 'z');
    board.put(53, y, 'z');
  }

  // Inner parchment page inset (cols 5-50, rows 5-66)
  board.rect(5, 5, 46, 62, 'k');
  board.rect(6, 6, 44, 60, 'e');
  board.rect(7, 7, 42, 58, 'W');

  // Deckled, aged parchment edges
  for (let x = 7; x < 49; x += 1) {
    if ((x * 7) % 5 === 0) {
      board.put(x, 7, 'e');
      board.put(x, 64, 'e');
    }
  }
  for (let y = 7; y < 65; y += 1) {
    if ((y * 11) % 4 === 0) {
      board.put(7, y, 'e');
      board.put(48, y, 'e');
    }
  }

  // Faint ink ledger lines
  for (let ly = 16; ly < 62; ly += 6) {
    for (let lx = 9; lx < 47; lx += 2) {
      board.put(lx, ly, 'n');
    }
  }

  // Hanging crimson velvet bookmark ribbon (cols 26-29, rows 0-56)
  board.rect(30, 7, 1, 48, 'n'); // Ribbon cast shadow on parchment
  board.rect(26, 0, 4, 54, 'r');
  board.rect(27, 0, 2, 54, 's');
  board.rect(27, 0, 1, 54, 't');
  // V-cut notch at bottom of ribbon
  board.put(26, 54, 'r');
  board.put(29, 54, 'r');
  board.put(26, 55, 'r');
  board.put(29, 55, 'r');
  board.put(27, 54, 'W');
  board.put(28, 54, 'W');

  // Heraldic Skull Crest & Crossed Bones (x=17..39, y=16..36)
  // Crossed bones behind the shield
  board.line(18, 17, 37, 34, 'k');
  board.line(19, 17, 38, 34, 'Z');
  board.line(37, 17, 18, 34, 'k');
  board.line(38, 17, 19, 34, 'Z');
  // Bone joint knobs
  board.rect(17, 16, 2, 2, 'Z');
  board.rect(37, 16, 2, 2, 'Z');
  board.rect(17, 34, 2, 2, 'Z');
  board.rect(37, 34, 2, 2, 'Z');

  // Heraldic shield frame
  board.rect(21, 18, 14, 15, 'k');
  board.rect(22, 19, 12, 13, 'B');
  board.rect(23, 20, 10, 11, 'x');
  // Shield pointed base
  board.rect(23, 33, 10, 1, 'k');
  board.rect(25, 34, 6, 1, 'k');
  board.rect(27, 35, 2, 1, 'k');
  board.rect(24, 33, 8, 1, 'B');
  board.rect(26, 34, 4, 1, 'B');

  // Pixel skull emblem inside shield
  board.rect(24, 21, 8, 6, 'Z'); // Cranium
  board.rect(25, 27, 6, 3, 'Z'); // Jaw
  board.put(25, 23, 'k'); // Left eye
  board.put(26, 23, 'k');
  board.put(29, 23, 'k'); // Right eye
  board.put(30, 23, 'k');
  board.put(27, 25, 'k'); // Nasal cavity
  board.put(28, 25, 'k');
  board.put(26, 28, 'k'); // Teeth gaps
  board.put(28, 28, 'k');

  // Golden laurel stars flanking shield
  board.put(19, 25, 'Y');
  board.put(18, 26, 'B');
  board.put(36, 25, 'Y');
  board.put(37, 26, 'B');

  // Tally marks (tallies of days survived / fallen)
  // Group 1 at x=10..15, y=42..47
  board.line(10, 42, 10, 47, 'k');
  board.line(12, 42, 12, 47, 'k');
  board.line(14, 42, 14, 47, 'k');
  board.line(16, 42, 16, 47, 'k');
  board.line(9, 46, 17, 43, 'k'); // Slash

  // Group 2 at x=19..24, y=42..47
  board.line(19, 42, 19, 47, 'k');
  board.line(21, 42, 21, 47, 'k');
  board.line(23, 42, 23, 47, 'k');
  board.line(25, 42, 25, 47, 'k');
  board.line(18, 46, 26, 43, 'k'); // Slash

  // Group 3 at x=33..38, y=42..47
  board.line(33, 42, 33, 47, 'k');
  board.line(35, 42, 35, 47, 'k');
  board.line(37, 42, 37, 47, 'k');
  board.line(39, 42, 39, 47, 'k');
  board.line(32, 46, 40, 43, 'k'); // Slash

  // Group 4 (unfinished tally) at x=42..46, y=42..47
  board.line(42, 42, 42, 47, 'k');
  board.line(44, 42, 44, 47, 'k');
  board.line(46, 42, 46, 47, 'k');

  // Group 5 on next row at x=10..15, y=50..55
  board.line(10, 50, 10, 55, 'k');
  board.line(12, 50, 12, 55, 'k');
  board.line(14, 50, 14, 55, 'k');
  board.line(16, 50, 16, 55, 'k');
  board.line(9, 54, 17, 51, 'k');

  // Bloody thumbprint at x=39..46, y=52..61
  const thumbprint = [
    '..rssr..',
    '.rsttsr.',
    'rsttttsr',
    'st.tt.ts',
    'st.tt.ts',
    'rsttttsr',
    '.rsttsr.',
    '..rssr..',
  ];
  board.stamp(39, 53, thumbprint);

  // Four heavy brass corner brackets
  drawCornerBracket(board, 0, 0, false, false);
  drawCornerBracket(board, 48, 0, true, false);
  drawCornerBracket(board, 0, 64, false, true);
  drawCornerBracket(board, 48, 64, true, true);

  // Outer leather border frame
  board.frame(0, 0, 56, 72, 'k');

  return board.toSprite(RECORDS_LEGEND);
}
