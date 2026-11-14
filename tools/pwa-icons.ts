/**
 * Draws the app icons from the game's cartridge (src/art/cartridge-art.ts) with the game's name on its label,
 * at a whole number of pixels per art pixel so the edges stay crisp. The ordinary icons fill their height and are
 * clear around the cartridge, so the desktop shows through. Maskable and Apple icons must be opaque, so they sit on ink.
 * Run: node --experimental-strip-types tools/pwa-icons.ts
 * The Hall of the Gods name is not drawn on any of them. The favicon stays the zombie head: a cartridge is
 * unreadable at 16 pixels.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { drawCartridge } from '../src/art/cartridge-art.ts';
import type { CartridgeWords } from '../src/art/cartridge-art.ts';

const root = fileURLToPath(new URL('../', import.meta.url));

/** The cartridge's label for the app icons. The launcher prints the short name under the icon, so the label keeps the title and drops the subtitle. */
export const ICON_WORDS: CartridgeWords = { ribbon: 'UNDEAD OF', title: 'NIGHT' };

export type Rgb = readonly [number, number, number];
/** A pixel of the cartridge, or null where it is clear. */
export type Cell = Rgb | null;

const INK: Rgb = [11, 12, 16];

/** The cartridge's pixels as rows of colours, null where it is clear. */
export function cartridgeGrid(words: CartridgeWords = ICON_WORDS): Cell[][] {
  const art = drawCartridge(words);
  return Array.from({ length: art.h }, (_, y) =>
    Array.from({ length: art.w }, (_, x): Cell => {
      const color = art.get(x, y);
      return color === null ? null : [(color >> 16) & 255, (color >> 8) & 255, color & 255];
    }));
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** An RGBA PNG: a pixel that is null is fully clear. */
function encodePng(size: number, pixel: (x: number, y: number) => Cell): Buffer {
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const at = y * (size * 4 + 1);
    for (let x = 0; x < size; x += 1) {
      const color = pixel(x, y);
      if (color) Buffer.from([...color, 255]).copy(rows, at + 1 + x * 4);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

/** The cartridge's height fills about `fill` of the icon, centred, at a whole pixel scale, on `background` or clear when that is null. */
export function drawIcon(grid: Cell[][], size: number, fill: number, background: Cell = null): Buffer {
  const rows = grid.length;
  const columns = grid[0].length;
  const scale = Math.max(1, Math.floor((size * fill) / rows));
  const left = Math.floor((size - columns * scale) / 2);
  const top = Math.floor((size - rows * scale) / 2);
  return encodePng(size, (x, y) => {
    const gx = Math.floor((x - left) / scale);
    const gy = Math.floor((y - top) / scale);
    const inside = x >= left && y >= top && gx < columns && gy < rows;
    return (inside ? grid[gy][gx] : null) ?? background;
  });
}

/** Every icon file and its bytes, by path from the package root. */
export function iconFiles(): Readonly<Record<string, Buffer>> {
  const grid = cartridgeGrid();
  return {
    'public/icons/icon-192.png': drawIcon(grid, 192, 1),
    'public/icons/icon-512.png': drawIcon(grid, 512, 1),
    'public/icons/icon-maskable-512.png': drawIcon(grid, 512, 0.6, INK),
    'public/apple-touch-icon.png': drawIcon(grid, 180, 1, INK),
  };
}

function writeIcons(): void {
  mkdirSync(`${root}public/icons`, { recursive: true });
  for (const [file, bytes] of Object.entries(iconFiles())) writeFileSync(`${root}${file}`, bytes);
}

const ranDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (ranDirectly) writeIcons();
