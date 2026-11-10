// Field Guide: ruined city street under moonlight, matching the atmosphere of LEVEL_1_CARD.
// Water tower on a factory roof, a warm upstairs window in a standing brick shop,
// a wrecked car nose-in at the kerb, and a lone shambler lurking in the shadows.

import type { Legend } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { PixelSprite } from '../types.ts';
import { CardGrid } from './card-grid.ts';

const { acid, asphalt, bone, brick, concrete, denim, fire, ink, metal, violet, wood } = RAMPS;

const GUIDE_LEGEND: Legend = {
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
  A: asphalt[0],
  B: asphalt[1],
  C: asphalt[2],
  c: concrete[0],
  D: concrete[1],
  E: concrete[2],
  q: brick[0],
  r: brick[1],
  h: wood[0],
  H: wood[1],
  M: metal[1],
  l: metal[2],
  L: metal[3],
  f: fire[0],
  o: fire[1],
  s: fire[2],
  S: fire[3],
  G: acid[1],
};

export function buildGuideCover(): PixelSprite {
  const board = new CardGrid('V');

  // Top field guide sector header (rows 0-5)
  board.rect(0, 0, 56, 5, 'k');
  board.rect(1, 1, 54, 3, 'c');
  board.rect(3, 2, 8, 1, 'D');
  board.rect(13, 2, 30, 1, 'k');
  board.rect(45, 2, 8, 1, 'D');
  board.rect(0, 5, 56, 1, 'M');

  // Night sky gradient & stars (rows 6-28)
  board.rect(0, 6, 56, 10, 'K');
  board.dither(0, 16, 56, 8, 'K', 'V');
  board.rect(0, 24, 56, 6, 'V');

  const stars = [
    [4, 8], [18, 9], [25, 7], [33, 11], [48, 8], [52, 12], [22, 17], [30, 20],
  ];
  stars.forEach(([sx, sy]) => board.put(sx, sy, 'w'));

  // Cold full moon at (39, 14) with craters and denim halo
  board.disc(39, 14, 7, 'd');
  board.disc(39, 14, 6, 'u');
  board.disc(39, 14, 5, 'z');
  board.disc(41, 13, 4, 'Z');
  board.disc(42, 14, 2, 'y');
  board.put(37, 12, 'Z');
  board.put(38, 16, 'Z');

  // Rooftop water tower on the left (x=5..15, y=7..24)
  // Conical roof cap
  board.line(5, 11, 10, 7, 'k').line(10, 7, 15, 11, 'k').line(5, 11, 15, 11, 'k');
  board.rect(6, 10, 9, 1, 'M');
  board.put(10, 8, 'L');
  // Cylindrical wooden tank
  board.rect(5, 11, 11, 7, 'k');
  board.rect(6, 12, 9, 5, 'h');
  board.rect(6, 14, 9, 1, 'H');
  board.rect(6, 16, 9, 1, 'k'); // Iron hoop band
  // Steel support stilts & cross-bracing
  board.rect(6, 18, 1, 8, 'k');
  board.rect(14, 18, 1, 8, 'k');
  board.line(6, 18, 14, 25, 'k');
  board.line(14, 18, 6, 25, 'k');

  // Left ruined building facade (rows 24-48, x=0..18)
  board.rect(0, 24, 18, 25, 'k');
  board.rect(0, 25, 17, 23, 'q');
  for (let y = 26; y < 47; y += 3) {
    board.rect(1, y, 15, 1, 'r');
  }
  // Jagged broken roofline
  board.put(15, 24, 'k');
  board.put(16, 24, 'k');
  board.put(17, 24, 'k');
  board.put(14, 23, 'k');
  board.put(13, 22, 'k');

  // Right standing commercial building facade (rows 18-52, x=28..56)
  board.rect(28, 18, 28, 35, 'k');
  board.rect(29, 19, 26, 33, 'q');
  // Decorative cornice on roof
  board.rect(27, 18, 29, 2, 'c');
  board.rect(28, 19, 27, 1, 'D');

  // Warm flickering window upstairs (x=38..48, y=24..34)
  board.rect(38, 24, 11, 11, 'k');
  board.rect(39, 25, 9, 9, 'f');
  board.rect(40, 26, 7, 7, 'o');
  board.rect(41, 27, 5, 5, 's');
  board.rect(42, 28, 3, 3, 'S');
  // Broken window blinds / mullions
  board.rect(43, 24, 1, 11, 'k');
  board.rect(38, 29, 11, 1, 'k');
  board.line(39, 31, 47, 33, 'k'); // Slat angle

  // Shop awning on ground floor (rows 40-44, x=29..55)
  for (let x = 29; x < 55; x += 1) {
    const isStripe = Math.floor((x - 29) / 3) % 2 === 0;
    board.rect(x, 40, 1, 4, isStripe ? 'c' : 'r');
  }
  board.rect(29, 44, 26, 1, 'k');

  // Dark shop door entrance (x=41..48, y=45..54)
  board.rect(41, 45, 8, 10, 'k');
  // Zombie lurker standing in doorway!
  board.rect(43, 46, 3, 3, 'k');
  board.put(45, 47, 'G'); // Acid glowing eye
  board.rect(42, 49, 5, 5, 'k');

  // Streetlamp on sidewalk (x=24, y=32..54)
  board.rect(24, 32, 2, 22, 'k');
  board.rect(25, 33, 1, 21, 'M');
  board.rect(22, 31, 6, 2, 'k');
  board.rect(23, 33, 4, 3, 's');
  board.put(24, 34, 'S');
  // Lamp cone of light
  for (let ly = 36; ly < 54; ly += 1) {
    const spread = Math.floor((ly - 36) * 0.4);
    for (let lx = 24 - spread; lx <= 25 + spread; lx += 1) {
      if ((lx + ly) % 2 === 0 && board.get(lx, ly) === 'q') {
        board.put(lx, ly, 'r');
      }
    }
  }

  // Asphalt street & kerb (rows 52-71)
  board.rect(0, 52, 56, 2, 'c'); // Sidewalk curb
  board.rect(0, 53, 56, 1, 'D');
  board.rect(0, 54, 56, 18, 'A');
  board.dither(0, 58, 56, 14, 'A', 'B');

  // White road dashed centre line
  const dashes = [[20, 56, 4, 1], [18, 61, 6, 1], [16, 67, 8, 2]];
  dashes.forEach(([rx, ry, rw, rh]) => board.rect(rx, ry, rw, rh, 'z'));

  // Wrecked car at kerb on left (rows 55-66, x=2..22)
  board.rect(2, 58, 19, 8, 'k');
  board.rect(3, 59, 17, 6, 'M');
  board.rect(5, 56, 11, 4, 'k'); // Cab
  board.rect(6, 57, 9, 3, 'l');
  board.line(7, 57, 10, 59, 'L'); // Windshield gleam
  board.disc(6, 65, 2, 'k'); // Front wheel
  board.disc(17, 65, 2, 'k'); // Rear wheel
  board.rect(20, 60, 2, 2, 'f'); // Broken tail light

  // Moonlit puddle in street reflecting sky & moon (x=24..35, y=60..67)
  board.disc(29, 63, 4, 'k');
  board.disc(29, 63, 3, 'd');
  board.disc(29, 63, 2, 'u');
  board.put(29, 62, 'z'); // Moon reflection dot
  board.put(30, 63, 's'); // Window amber reflection dot

  // Tactical border
  board.frame(0, 0, 56, 72, 'k');
  board.frame(1, 5, 54, 66, 'c');

  return board.toSprite(GUIDE_LEGEND);
}
