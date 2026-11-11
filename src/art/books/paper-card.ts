// Noise in the Night: a broadsheet on a dark street, its nameplate in heavy ink and blood red, a moonlit photo of a
// hand breaking the ground, columns of newsprint, a blood spatter and a dog-eared corner.

import type { Legend } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { PixelSprite } from '../types.ts';
import { CardGrid } from './card-grid.ts';

const { blood, bone, fire, ink, rot } = RAMPS;

const PAPER_LEGEND: Legend = {
  k: ink[0],
  K: ink[1],
  n: bone[0],
  e: bone[1],
  W: bone[2],
  Z: bone[3],
  r: blood[1],
  s: blood[2],
  t: blood[3],
  y: fire[2],
  Y: fire[3],
  v: rot[1],
  V: rot[2],
};

const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  N: ['X..X', 'XX.X', 'X.XX', 'X..X', 'X..X'],
  O: ['.XX.', 'X..X', 'X..X', 'X..X', '.XX.'],
  I: ['XXX', '.X.', '.X.', '.X.', 'XXX'],
  S: ['.XXX', 'X...', '.XX.', '...X', 'XXX.'],
  E: ['XXXX', 'X...', 'XXX.', 'X...', 'XXXX'],
  G: ['.XXX', 'X...', 'X.XX', 'X..X', '.XXX'],
  H: ['X..X', 'X..X', 'XXXX', 'X..X', 'X..X'],
  T: ['XXX', '.X.', '.X.', '.X.', '.X.'],
};

const SHEET_X = 6;
const SHEET_Y = 6;
const SHEET_W = 44;
const SHEET_H = 60;
const SHEET_MID = SHEET_X + SHEET_W / 2;

function wordWidth(word: string): number {
  const glyphWidth = (letter: string): number => GLYPHS[letter][0].length;
  return [...word].reduce((sum, letter) => sum + glyphWidth(letter), 0) + word.length - 1;
}

function drawWord(board: CardGrid, word: string, y: number, letter: string): void {
  let x = Math.round(SHEET_MID - wordWidth(word) / 2);
  for (const char of word) {
    const glyph = GLYPHS[char];
    board.stamp(x, y, glyph.map((row) => row.replaceAll('X', letter)));
    x += glyph[0].length + 1;
  }
}

/** Rows of newsprint: grey lines two pixels apart, the last line of each paragraph cut short. */
function drawColumn(board: CardGrid, x: number, y: number, w: number, h: number, seed: number): void {
  for (let row = 0; row < h; row += 2) {
    const isParagraphEnd = (row / 2 + seed) % 4 === 3;
    const length = isParagraphEnd ? Math.max(2, w - 3 - ((row + seed) % 3)) : w;
    board.rect(x, y + row, length, 1, 'n');
  }
}

function drawPhoto(board: CardGrid, x: number, y: number, w: number, h: number): void {
  board.frame(x, y, w, h, 'k');
  board.dither(x + 1, y + 1, w - 2, h - 2, 'K', 'k');
  board.disc(x + w - 6, y + 5, 3, 'y').disc(x + w - 6, y + 5, 2, 'Y');
  board.rect(x + 1, y + h - 4, w - 2, 3, 'k');
  board.stamp(x + 5, y + h - 11, ['.V.V.V', '.V.V.V', 'VVVVVV', 'vVVVVV', '.vVVV.', '.vVVV.', '..vVV.', '..vVV.']);
}

function drawSpatter(board: CardGrid): void {
  board.disc(45, 11, 2, 's').put(46, 10, 't');
  board.put(42, 9, 's');
  board.put(48, 14, 'r');
  board.rect(45, 14, 1, 4, 'r').put(45, 18, 's');
}

function drawDogEar(board: CardGrid): void {
  const right = SHEET_X + SHEET_W - 1;
  const bottom = SHEET_Y + SHEET_H - 1;
  for (let step = 0; step < 6; step += 1) {
    for (let i = 0; i <= step; i += 1) {
      board.put(right - 5 + step, bottom - i, 'k');
      board.put(right - 5 + i, bottom - step + i - (step - i), 'e');
    }
  }
  board.line(right - 5, bottom, right, bottom - 5, 'n');
}

export function buildPaperCover(): PixelSprite {
  const board = new CardGrid('k');
  board.dither(0, 0, 56, 72, 'k', 'K');

  board.rect(SHEET_X + 1, SHEET_Y + 1, SHEET_W, SHEET_H, 'k');
  board.rect(SHEET_X, SHEET_Y, SHEET_W, SHEET_H, 'Z');
  board.frame(SHEET_X, SHEET_Y, SHEET_W, SHEET_H, 'e');

  board.rect(9, 8, 38, 1, 'k');
  drawWord(board, 'NOISE', 10, 'k');
  board.rect(20, 16, 4, 1, 'r').rect(26, 16, 4, 1, 'r').rect(32, 16, 4, 1, 'r');
  drawWord(board, 'NIGHT', 18, 's');
  board.rect(9, 24, 38, 1, 'k').rect(9, 26, 38, 1, 'k');
  for (let x = 9; x < 47; x += 3) board.put(x, 28, 'n');

  board.rect(9, 30, 38, 2, 'K');
  board.rect(9, 33, 28, 2, 'K');

  drawPhoto(board, 9, 37, 19, 16);
  drawColumn(board, 30, 37, 17, 16, 0);
  board.rect(9, 55, 38, 1, 'e');
  drawColumn(board, 9, 57, 11, 7, 1);
  drawColumn(board, 22, 57, 11, 7, 2);
  drawColumn(board, 35, 57, 8, 7, 3);

  drawSpatter(board);
  drawDogEar(board);
  board.frame(0, 0, 56, 72, 'k');

  return board.toSprite(PAPER_LEGEND);
}
