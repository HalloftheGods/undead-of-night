import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { CARTRIDGE_HEIGHT, CARTRIDGE_LABEL, CARTRIDGE_PICTURE, CARTRIDGE_WIDTH, GUIDE_PICTURES, cartridgeSrc, guideIconSrc, pictureSvg } from '../src/art/cartridge.ts';
import { ALL_COLORS, toHex } from '../src/art/palette.ts';
import { guideFor } from '../src/game/pwa/ios-guide.ts';
import { buildIdOf, isShellFile, musicVersionsOf, stampWorker } from '../tools/vite-pwa.ts';
import { drawCartridge } from '../src/art/cartridge-art.ts';
import { ICON_WORDS, cartridgeGrid, iconFiles } from '../tools/pwa-icons.ts';

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url));
const manifest = JSON.parse(read('public/manifest.webmanifest').toString());

function pngSize(file: string): { width: number; height: number; signature: string } {
  const bytes = read(file);
  return { signature: bytes.subarray(1, 4).toString('ascii'), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('web manifest', () => {
  it('is installable, standalone and relative so it works under a subfolder', () => {
    expect(manifest.display).toBe('standalone');
    expect(manifest.name).toBe('Undead of Night: Last Round');
    for (const key of ['id', 'start_url', 'scope']) expect(manifest[key]).toBe('./');
    for (const icon of manifest.icons) expect(icon.src.startsWith('/') || icon.src.includes('://')).toBe(false);
    expect(manifest.theme_color).toBe('#0b0c10');
    expect(manifest.background_color).toBe('#0b0c10');
  });

  it('lists 192 and 512 icons and a maskable one, each a real PNG of the size it claims', () => {
    const wanted = [
      ['icons/icon-192.png', 192, 'any'],
      ['icons/icon-512.png', 512, 'any'],
      ['icons/icon-maskable-512.png', 512, 'maskable'],
    ] as const;
    for (const [src, size, purpose] of wanted) {
      const entry = manifest.icons.find((icon: { src: string }) => icon.src === src);
      expect(entry?.purpose).toBe(purpose);
      expect(entry?.sizes).toBe(`${size}x${size}`);
      expect(pngSize(`public/${src}`)).toEqual({ signature: 'PNG', width: size, height: size });
    }
    expect(pngSize('public/apple-touch-icon.png')).toEqual({ signature: 'PNG', width: 180, height: 180 });
  });

  it('keeps the studio name off the icons: they are the game art only', () => {
    expect(JSON.stringify(manifest)).not.toMatch(/hall of the gods/i);
  });
});

describe('index.html', () => {
  // Attribute whitespace is formatter-owned, so collapse it before matching.
  const html = read('index.html').toString().replace(/\s+/g, ' ');

  it('links the manifest and the Apple touch icon and sets the iOS app tags', () => {
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('rel="apple-touch-icon" href="/apple-touch-icon.png"');
    expect(html).toContain('name="apple-mobile-web-app-capable"');
    expect(html).toContain('name="theme-color" content="#0b0c10"');
  });
});

describe('worker stamping', () => {
  const worker = read('public/sw.js').toString();

  it('puts the build id and shell files into the worker, so every build is a new worker', () => {
    const stamped = stampWorker(worker, 'abc123', ['assets/a.js', 'index.html']);
    expect(stamped).toContain('const BUILD_ID = "abc123";');
    expect(stamped).toContain('const SHELL_FILES = ["assets/a.js","index.html"];');
    expect(stamped).not.toBe(stampWorker(worker, 'def456', ['assets/a.js', 'index.html']));
  });

  it('stamps the version of every music file, so a replaced track is a new one', () => {
    const stamped = stampWorker(worker, 'abc123', [], { 'music/a.mp3': 'h1' });
    expect(stamped).toContain('const MUSIC_VERSIONS = {"music/a.mp3":"h1"};');
    const same = musicVersionsOf([['music/a.mp3', Buffer.from('x')], ['assets/b.js', Buffer.from('y')]]);
    expect(Object.keys(same)).toEqual(['music/a.mp3']);
    expect(same).toEqual(musicVersionsOf([['music/a.mp3', Buffer.from('x')]]));
    expect(same).not.toEqual(musicVersionsOf([['music/a.mp3', Buffer.from('z')]]));
  });

  it('refuses a worker that has lost the lines it stamps', () => {
    expect(() => stampWorker('self.addEventListener', 'x', [])).toThrow();
  });

  it('keeps music, the worker itself and source maps out of the shell', () => {
    expect(isShellFile('music/escalation.mp3')).toBe(false);
    expect(isShellFile('sw.js')).toBe(false);
    expect(isShellFile('assets/index.js.map')).toBe(false);
    expect(isShellFile('assets/index-abc.js')).toBe(true);
    expect(isShellFile('index.html')).toBe(true);
    expect(isShellFile('manifest.webmanifest')).toBe(true);
  });

  it('gives different contents a different id', () => {
    expect(buildIdOf([Buffer.from('a')])).not.toBe(buildIdOf([Buffer.from('b')]));
    expect(buildIdOf([Buffer.from('a')])).toHaveLength(10);
  });
});

describe('cartridge art', () => {
  it('is a 48 by 56 picture drawn only in the master palette', () => {
    const svg = pictureSvg(CARTRIDGE_PICTURE);
    expect([CARTRIDGE_WIDTH, CARTRIDGE_HEIGHT]).toEqual([48, 56]);
    expect(svg).toContain(`viewBox="0 0 ${CARTRIDGE_WIDTH} ${CARTRIDGE_HEIGHT}"`);
    const palette = Object.values(CARTRIDGE_PICTURE.colors);
    for (const [, fill] of svg.matchAll(/fill="([^"]+)"/g)) expect(palette).toContain(fill);
    const master = ALL_COLORS.map(toHex);
    for (const color of palette) expect(master).toContain(color);
    expect(cartridgeSrc().startsWith('data:image/svg+xml,')).toBe(true);
  });

  it('keeps every block inside the picture and leaves a label recess for the printed label', () => {
    for (const picture of [CARTRIDGE_PICTURE, ...Object.values(GUIDE_PICTURES)]) {
      for (const [key, x, y, w, h] of picture.blocks) {
        expect(picture.colors[key]).toBeDefined();
        expect(x + w).toBeLessThanOrEqual(picture.width);
        expect(y + h).toBeLessThanOrEqual(picture.height);
      }
    }
    const recess = CARTRIDGE_PICTURE.blocks.find(([key]) => key === 'recess');
    expect(recess).toEqual(['recess', CARTRIDGE_LABEL.x, CARTRIDGE_LABEL.y, CARTRIDGE_LABEL.width, CARTRIDGE_LABEL.height]);
  });

  it('draws an icon for every step of both how to install cards', () => {
    for (const kind of ['ios', 'menu'] as const) {
      for (const step of guideFor(kind).steps) expect(guideIconSrc(step.icon).startsWith('data:image/svg+xml,')).toBe(true);
    }
    const ios = guideFor('ios').steps.map((step) => step.title);
    expect(ios).toEqual(['Tap Share', 'Add to Home Screen']);
  });
});

/** The alpha of an RGBA PNG's top left pixel, read from its one IDAT chunk. */
function cornerAlpha(file: string): number {
  const bytes = read(file);
  const colorType = bytes[25];
  const RGBA = 6;
  expect(colorType).toBe(RGBA);
  let at = 8;
  while (bytes.subarray(at + 4, at + 8).toString('ascii') !== 'IDAT') at += 12 + bytes.readUInt32BE(at);
  const rows = inflateSync(bytes.subarray(at + 8, at + 8 + bytes.readUInt32BE(at)));
  return rows[1 + 3];
}

describe('app icons', () => {
  it('are the cartridge with the game name on it, as tools/pwa-icons.ts draws them', () => {
    for (const [file, bytes] of Object.entries(iconFiles())) {
      expect(read(file).equals(bytes), `${file} is out of date: run node --experimental-strip-types tools/pwa-icons.ts`).toBe(true);
    }
  });

  it('are clear around the cartridge, except the maskable and Apple ones, which must be opaque', () => {
    expect(cornerAlpha('public/icons/icon-192.png')).toBe(0);
    expect(cornerAlpha('public/icons/icon-512.png')).toBe(0);
    expect(cornerAlpha('public/icons/icon-maskable-512.png')).toBe(255);
    expect(cornerAlpha('public/apple-touch-icon.png')).toBe(255);
  });

  it('keep the Install Game cartridge as it was: the icon label is its own', () => {
    const install = drawCartridge();
    const icon = drawCartridge(ICON_WORDS);
    expect([icon.w, icon.h]).toEqual([install.w, install.h]);
    expect(icon.data).not.toEqual(install.data);
    expect(cartridgeGrid()).toHaveLength(CARTRIDGE_HEIGHT);
  });

  it('draw the icon cartridge only in the master palette', () => {
    const icon = drawCartridge(ICON_WORDS);
    for (let y = 0; y < icon.h; y++) {
      for (let x = 0; x < icon.w; x++) {
        const color = icon.get(x, y);
        const painted = color !== null;
        if (painted) expect(ALL_COLORS.includes(color), `${toHex(color)} at ${x},${y}`).toBe(true);
      }
    }
  });
});
