// How to Play: tactical field survival manual. A lone hooded survivor with a backpack
// facing down a dark highway under a full moon, flashlight beam cutting through the gloom
// toward approaching shambler silhouettes.

import type { Legend } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { PixelSprite } from '../types.ts';
import { CardGrid } from './card-grid.ts';

const { acid, asphalt, blood, bone, denim, fire, grass, ink, metal, olive, violet, wood } = RAMPS;

const HOWTO_LEGEND: Legend = {
  k: ink[0],
  K: ink[1],
  V: violet[0],
  v: violet[1],
  w: violet[2],
  d: denim[0],
  e: denim[1],
  u: denim[2],
  n: bone[0],
  y: bone[1],
  Z: bone[2],
  z: bone[3],
  a: asphalt[0],
  b: asphalt[1],
  c: asphalt[2],
  g: grass[0],
  G: grass[1],
  J: olive[0],
  j: olive[1],
  q: olive[2],
  h: wood[0],
  H: wood[1],
  M: metal[1],
  m: metal[2],
  f: fire[0],
  o: fire[1],
  s: fire[2],
  S: fire[3],
  r: blood[1],
  A: acid[1],
};

export function buildHowToCover(): PixelSprite {
  const board = new CardGrid('V');

  // Top tactical hazard warning bar (rows 0-5)
  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 56; x += 1) {
      const isAmberStripe = (x + y * 2) % 7 < 3;
      board.put(x, y, isAmberStripe ? 'S' : 'k');
    }
  }
  board.rect(0, 5, 56, 1, 'M');

  // Night sky gradient & dither (rows 6-34)
  board.rect(0, 6, 56, 12, 'K');
  board.dither(0, 18, 56, 8, 'K', 'V');
  board.rect(0, 26, 56, 8, 'V');

  // Stars
  const starCoords = [
    [5, 8], [19, 9], [28, 7], [34, 11], [42, 8], [49, 10], [53, 14],
    [7, 18], [25, 20], [31, 16], [38, 22], [47, 18],
  ];
  starCoords.forEach(([sx, sy]) => board.put(sx, sy, 'w'));

  // Glowing full moon at (12, 14) with craters & halo
  board.disc(12, 14, 8, 'd');
  board.disc(12, 14, 7, 'u');
  board.disc(12, 14, 6, 'z');
  board.disc(14, 13, 5, 'Z');
  board.disc(15, 14, 3, 'y');
  board.put(10, 12, 'Z');
  board.put(11, 16, 'Z');
  board.put(14, 16, 'y');

  // Telephone poles on the right verge marching to vanishing point
  // Near pole at x=51
  board.rect(51, 12, 2, 34, 'k');
  board.rect(52, 13, 1, 33, 'h');
  board.rect(47, 16, 9, 2, 'k');
  board.rect(48, 17, 7, 1, 'H');
  board.put(47, 15, 'z');
  board.put(55, 15, 'z');
  // Wires trailing off
  board.line(47, 16, 38, 24, 'k');
  board.line(55, 16, 56, 20, 'k');

  // Distant pole at x=42
  board.rect(42, 22, 1, 18, 'k');
  board.rect(39, 24, 7, 1, 'k');

  // Jagged treeline & abandoned rooftops on the horizon (rows 32-38)
  for (let x = 0; x < 56; x += 1) {
    const treeH = 3 + Math.abs(Math.sin(x * 0.4)) * 4;
    board.rect(x, Math.floor(37 - treeH), 1, Math.floor(treeH), 'k');
  }

  // Approaching zombie silhouettes on the horizon / verge
  // Walker 1 (x=36, y=30)
  board.rect(36, 30, 2, 2, 'k');
  board.rect(35, 32, 4, 4, 'k');
  board.put(35, 33, 'A'); // Glowing acid eye
  board.rect(34, 33, 1, 3, 'k'); // Reaching arm
  board.line(35, 36, 34, 40, 'k');
  board.line(37, 36, 38, 40, 'k');

  // Walker 2 (x=44, y=28)
  board.rect(44, 28, 2, 2, 'k');
  board.rect(43, 30, 3, 4, 'k');
  board.put(44, 29, 'r'); // Red glint
  board.line(43, 34, 42, 38, 'k');
  board.line(45, 34, 46, 38, 'k');

  // Roadway and verge (rows 38-71)
  // Grass verge right
  for (let y = 38; y < 72; y += 1) {
    const vergeX = Math.floor(42 + (y - 38) * 0.35);
    board.rect(vergeX, y, 56 - vergeX, 1, (vergeX + y) % 2 === 0 ? 'g' : 'G');
  }
  // Grass verge left
  for (let y = 38; y < 72; y += 1) {
    const vergeLeft = Math.floor(10 - (y - 38) * 0.3);
    if (vergeLeft > 0) board.rect(0, y, vergeLeft, 1, (vergeLeft + y) % 2 === 0 ? 'g' : 'G');
  }

  // Asphalt surface
  board.rect(10, 38, 33, 34, 'b');
  board.dither(8, 48, 38, 24, 'b', 'c');
  board.rect(0, 38, 56, 1, 'k'); // Horizon separator

  // Dashed centre road lines
  const centerDashes = [
    [26, 39, 1, 2], [26, 43, 1, 3], [25, 48, 2, 4], [25, 55, 2, 5], [24, 63, 2, 7],
  ];
  centerDashes.forEach(([dx, dy, dw, dh]) => board.rect(dx, dy, dw, dh, 'Z'));

  // Flashlight beam (expanding amber/yellow cone from survivor hand)
  // Hand is at (23, 51); beam expands rightward/forward toward (36..52, 38..48)
  for (let y = 38; y <= 52; y += 1) {
    const progress = (52 - y) / 14;
    const minX = Math.floor(23 + progress * 8);
    const maxX = Math.floor(24 + progress * 26);
    for (let x = minX; x <= maxX; x += 1) {
      const isInner = x > minX + 2 && x < maxX - 2 && progress > 0.3;
      const isCore = isInner && progress > 0.6;
      if (isCore) {
        board.put(x, y, 'S');
      } else if (isInner) {
        board.put(x, y, (x + y) % 2 === 0 ? 's' : 'S');
      } else {
        board.put(x, y, (x + y) % 2 === 0 ? 'o' : 'f');
      }
    }
  }

  // Survivor standing in left lane (seen from behind)
  // Legs & combat boots (rows 59-68)
  board.rect(14, 59, 4, 8, 'k');
  board.rect(20, 59, 4, 8, 'k');
  board.rect(13, 67, 5, 2, 'm');
  board.rect(20, 67, 5, 2, 'm');
  board.rect(14, 59, 3, 6, 'd');
  board.rect(20, 59, 3, 6, 'd');

  // Torso & backpack (rows 46-59)
  board.rect(13, 47, 12, 13, 'k');
  board.rect(14, 48, 10, 11, 'd');
  board.rect(15, 49, 8, 9, 'J'); // Backpack olive body
  board.rect(16, 51, 6, 6, 'j');
  board.rect(14, 46, 10, 3, 'h'); // Rolled bedroll on top of pack
  board.rect(15, 47, 8, 1, 'H');

  // Hooded head (rows 40-47)
  board.disc(18, 44, 4, 'k');
  board.disc(18, 44, 3, 'u');
  board.disc(18, 44, 2, 'e');

  // Right arm holding flashlight out
  board.line(22, 50, 24, 52, 'k');
  board.rect(23, 51, 2, 2, 'M');
  board.put(25, 51, 'S'); // Flashlight lens bulb

  // Cast shadow stretching backward/left in ink
  board.rect(6, 68, 14, 3, 'k');

  // Dropped brass shell casing on road
  board.rect(29, 65, 2, 1, 'S');
  board.put(28, 65, 'k');

  // Tactical frame border
  board.frame(0, 0, 56, 72, 'k');
  board.frame(1, 6, 54, 65, 'M');

  return board.toSprite(HOWTO_LEGEND);
}
