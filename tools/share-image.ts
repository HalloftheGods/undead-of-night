// Renders the link preview that chat apps and social sites show for the game.
//   node --experimental-strip-types tools/share-image.ts [outfile.png]
// The night scene and the title logo, at the 1200x630 size Open Graph cards use.

import { writeFileSync } from 'node:fs';
import { buildArtBook } from '../src/art/index.ts';
import { encodePng } from './png.ts';
import { renderScene } from './scene.ts';
import { drawSprite } from './sheet.ts';

const SCALE = 3;
const CROP = { x: 40, y: 20, w: 400, h: 210 };
const LOGO_TOP = 6;
const FADE_ROWS = 110;
const FADE_FLOOR = 0.25;

function main(): void {
  const outfile = process.argv[2] ?? 'public/og-image.png';
  const book = buildArtBook();
  const picture = renderScene(book, 1, true).cropped(CROP.x, CROP.y, CROP.w, CROP.h);
  for (let y = 0; y < FADE_ROWS; y++) {
    const shade = FADE_FLOOR + (1 - FADE_FLOOR) * (y / FADE_ROWS) ** 2;
    for (let x = 0; x < picture.w; x++) picture.tint(x, y, shade, shade, shade);
  }
  const logo = book.ui.logo;
  drawSprite(picture, logo, Math.round((picture.w - logo.w) / 2), LOGO_TOP, 1);
  const sheet = picture.scaled(SCALE);
  writeFileSync(outfile, encodePng(sheet.w, sheet.h, sheet.data));
  process.stdout.write(`${outfile} ${sheet.w}x${sheet.h}, logo ${logo.w}x${logo.h}\n`);
}

main();
