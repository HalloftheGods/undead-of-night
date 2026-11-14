// Sweet Tooth (Candy Magazine): vintage horror-comic cover with dynamic sunburst rays,
// bold masthead, and authentic in-game pixel candies stamped on stage.

import { CANDY_GRIDS, SWEET_LEGEND } from '../fx/candies.ts';
import { RAMPS } from '../palette.ts';
import type { PixelSprite } from '../types.ts';
import { CardGrid } from './card-grid.ts';

const { blood, fire, violet } = RAMPS;

const CANDY_CARD_LEGEND = {
  ...SWEET_LEGEND,
  V: violet[0],
  v: violet[1],
  f: fire[0],
  T: blood[3],
};

const SWEET_GLYPHS: readonly string[] = [
  'kYYYYkkkWWkkkWWkkYYYYYYkkYYYYYYkkTTTTTk',
  'YYkkYYkkWWkkkWWkkYYkkkkkkYYkkkkkkkkWWkk',
  'kYYkkkkkWWkkwWWkkYYYYkkkkYYYYkkkkkkWWkk',
  'kkkYYykkWWWWWWWkkYYkkkkkkYYkkkkkkkkWWkk',
  'YYkkYYkkWWWkwWWkkYYkkkkkkYYkkkkkkkkWWkk',
  'kYYYYkkkWWkkkWWkkYYYYYYkkYYYYYYkkkkWWkk',
];

const TOOTH_GLYPHS: readonly string[] = [
  'TTTTTkkwOOOOkwOOOOkkTTTTTkkwHHkkHHk',
  'kkWWkkkOOkkOOOOkkOOkkkWWkkkkwHHkkHHk',
  'kkWWkkkOOkkOOOOkkOOkkkWWkkkkwHHHHHHk',
  'kkWWkkkOOkkOOOOkkOOkkkWWkkkkwHHkkHHk',
  'kkWWkkkOOkkOOOOkkOOkkkWWkkkkwHHkkHHk',
  'kkWWkkkwOOOOkwOOOOkkkkWWkkkkwHHkkHHk',
];

export function buildCandyCover(): PixelSprite {
  const board = new CardGrid('s');
  const cx = 28;
  const cy = 42;

  // Radiating comic sunburst rays
  for (let y = 0; y < 72; y += 1) {
    for (let x = 0; x < 56; x += 1) {
      const angle = (Math.atan2(y - cy, x - cx) + Math.PI) / (Math.PI * 2);
      const rayIndex = Math.floor(angle * 18);
      const isYellowRay = rayIndex % 2 === 0;
      const dist = Math.hypot(x - cx, y - cy);
      const isFar = dist > 30 && (x + y) % 2 === 0;

      if (isYellowRay) {
        board.put(x, y, isFar ? 'C' : 'B');
      } else {
        board.put(x, y, isFar ? 'r' : 's');
      }
    }
  }

  // Central starburst glow
  board.disc(cx, cy, 14, 'Y');
  board.disc(cx, cy, 9, 'W');

  // Top Comic Masthead Box
  board.rect(0, 0, 56, 17, 'k');
  board.rect(1, 1, 54, 15, 'V');
  board.rect(1, 15, 54, 1, 'Y');

  // "SWEET" (row 2-7, x=9)
  board.stamp(9, 2, SWEET_GLYPHS);

  // "TOOTH" (row 9-14, x=11)
  board.stamp(11, 9, TOOTH_GLYPHS);

  // Corner issue badge: "OCT 31"
  board.rect(43, 2, 11, 7, 'r');
  board.frame(43, 2, 11, 7, 'Y');
  board.rect(45, 4, 7, 1, 'W');
  board.rect(45, 6, 7, 1, 'Y');

  // Corner price badge: "25¢"
  board.rect(2, 2, 6, 7, 'Y');
  board.frame(2, 2, 6, 7, 'k');
  board.rect(4, 4, 2, 3, 'k');

  // Stamping authentic in-game pixel art candies with shadow halos
  const candies = [
    { grid: CANDY_GRIDS.sour_skulls, x: 3, y: 20 },
    { grid: CANDY_GRIDS.fang_taffy, x: 40, y: 20 },
    { grid: CANDY_GRIDS.bat_bites, x: 22, y: 19 },
    { grid: CANDY_GRIDS.full_size_bar, x: 22, y: 39 },
    { grid: CANDY_GRIDS.pumpkin_fizz, x: 3, y: 46 },
    { grid: CANDY_GRIDS.jawbreaker, x: 40, y: 46 },
  ];

  candies.forEach(({ grid, x, y }) => {
    // Drop shadow
    board.stamp(x + 1, y + 1, grid.map((row) => row.replace(/[^. ]/g, 'k')));
    // Candy sprite
    board.stamp(x, y, grid);
  });

  // Floating sparkle stars around candies
  const sparkles = [
    [17, 24], [37, 26], [16, 42], [38, 38], [20, 34], [35, 34], [18, 56], [38, 60],
  ];
  sparkles.forEach(([sx, sy]) => {
    board.put(sx, sy, 'W');
    board.put(sx - 1, sy, 'Y');
    board.put(sx + 1, sy, 'Y');
    board.put(sx, sy - 1, 'Y');
    board.put(sx, sy + 1, 'Y');
  });

  // Bottom issue teaser badge
  board.rect(4, 62, 48, 7, 'k');
  board.rect(5, 63, 46, 5, 'Y');
  board.rect(7, 65, 42, 1, 'k');
  board.rect(10, 64, 36, 1, 'r');
  board.rect(10, 66, 36, 1, 'r');

  // Outer border frame
  board.frame(0, 0, 56, 72, 'k');
  board.frame(1, 1, 54, 70, 'Y');

  return board.toSprite(CANDY_CARD_LEGEND);
}
