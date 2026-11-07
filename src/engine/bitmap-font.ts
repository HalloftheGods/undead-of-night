/** Hand-set 5px caps. '#' is ink. Glyphs may be any width; rows of one glyph match. */
const GLYPHS: Readonly<Record<string, string>> = {
  A: '.#./#.#/###/#.#/#.#', B: '##./#.#/##./#.#/##.', C: '.##/#../#../#../.##',
  D: '##./#.#/#.#/#.#/##.', E: '###/#../##./#../###', F: '###/#../##./#../#..',
  G: '.##/#../#.#/#.#/.##', H: '#.#/#.#/###/#.#/#.#', I: '###/.#./.#./.#./###',
  J: '..#/..#/..#/#.#/.#.', K: '#.#/#.#/##./#.#/#.#', L: '#../#../#../#../###',
  M: '#...#/##.##/#.#.#/#...#/#...#', N: '#..#/##.#/#.##/#..#/#..#', O: '.#./#.#/#.#/#.#/.#.',
  P: '##./#.#/##./#../#..', Q: '.#./#.#/#.#/##./.##', R: '##./#.#/##./#.#/#.#',
  S: '.##/#../.#./..#/##.', T: '###/.#./.#./.#./.#.', U: '#.#/#.#/#.#/#.#/###',
  V: '#.#/#.#/#.#/#.#/.#.', W: '#...#/#...#/#.#.#/##.##/#...#', X: '#.#/#.#/.#./#.#/#.#',
  Y: '#.#/#.#/.#./.#./.#.', Z: '###/..#/.#./#../###',
  0: '.#./#.#/#.#/#.#/.#.', 1: '.#./##./.#./.#./###', 2: '##./..#/.#./#../###',
  3: '##./..#/.#./..#/##.', 4: '#.#/#.#/###/..#/..#', 5: '###/#../##./..#/##.',
  6: '.##/#../##./#.#/.#.', 7: '###/..#/.#./.#./.#.', 8: '.#./#.#/.#./#.#/.#.',
  9: '.#./#.#/.##/..#/##.',
  '+': '.../.#./###/.#./...', '-': '.../.../###/.../...', '.': '././././#',
  ':': './#/./#/.', '!': '#/#/#/./#', '?': '##./..#/.#./.../.#.', "'": '#/#/././.',
  '/': '..#/..#/.#./#../#..', '_': '.../.../.../.../###', ' ': '../../../../..',
};

export const FONT_HEIGHT = 5;
const LETTER_GAP = 1;
const FALLBACK = '?';

type GlyphRows = readonly string[];

const parsed = new Map<string, GlyphRows>(
  Object.entries(GLYPHS).map(([char, rows]) => [char, rows.split('/')]),
);

export function glyphRows(char: string): GlyphRows {
  return parsed.get(char.toUpperCase()) ?? parsed.get(FALLBACK)!;
}

export function textWidth(text: string): number {
  let width = 0;
  for (const char of text) width += glyphRows(char)[0].length + LETTER_GAP;
  return Math.max(0, width - LETTER_GAP);
}

interface Atlas {
  readonly canvas: HTMLCanvasElement;
  readonly slots: Map<string, number>;
}

const atlases = new Map<string, Atlas>();

function buildAtlas(color: string): Atlas {
  const canvas = document.createElement('canvas');
  const slots = new Map<string, number>();
  let width = 0;
  for (const [char, rows] of parsed) {
    slots.set(char, width);
    width += rows[0].length;
  }
  canvas.width = width;
  canvas.height = FONT_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  for (const [char, rows] of parsed) {
    const origin = slots.get(char)!;
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) {
        const isInked = row[x] === '#';
        if (isInked) ctx.fillRect(origin + x, y, 1, 1);
      }
    });
  }
  return { canvas, slots };
}

function atlasFor(color: string): Atlas {
  let atlas = atlases.get(color);
  if (!atlas) {
    atlas = buildAtlas(color);
    atlases.set(color, atlas);
  }
  return atlas;
}

export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
  const atlas = atlasFor(color);
  let penX = Math.round(x);
  const penY = Math.round(y);
  for (const char of text) {
    const key = char.toUpperCase();
    const rows = glyphRows(key);
    const width = rows[0].length;
    const slot = atlas.slots.get(parsed.has(key) ? key : FALLBACK)!;
    ctx.drawImage(atlas.canvas, slot, 0, width, FONT_HEIGHT, penX, penY, width, FONT_HEIGHT);
    penX += width + LETTER_GAP;
  }
}

/** Outlined labels already drawn, newest last. A fight floats the same few scores for many frames each. */
const OUTLINED_CACHE_SIZE = 96;
const outlinedCache = new Map<string, HTMLCanvasElement>();

/** The label with its outline, baked once: five passes a letter would cost a busy frame hundreds of draws. */
function outlinedCanvas(text: string, color: string, outline: string): HTMLCanvasElement {
  const key = `${color}|${outline}|${text}`;
  const cached = outlinedCache.get(key);
  if (cached) {
    outlinedCache.delete(key);
    outlinedCache.set(key, cached);
    return cached;
  }
  const canvas = document.createElement('canvas');
  canvas.width = textWidth(text) + 2;
  canvas.height = FONT_HEIGHT + 2;
  const ctx = canvas.getContext('2d')!;
  drawText(ctx, text, 0, 1, outline);
  drawText(ctx, text, 2, 1, outline);
  drawText(ctx, text, 1, 0, outline);
  drawText(ctx, text, 1, 2, outline);
  drawText(ctx, text, 1, 1, color);
  outlinedCache.set(key, canvas);
  const overFull = outlinedCache.size > OUTLINED_CACHE_SIZE;
  if (overFull) outlinedCache.delete(outlinedCache.keys().next().value!);
  return canvas;
}

/** Text with a one-pixel dark outline, for reading over a busy scene. */
export function drawOutlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  color: string,
  outline = '#0b0c10',
): void {
  const x = Math.round(centerX - textWidth(text) / 2);
  ctx.drawImage(outlinedCanvas(text, color, outline), x - 1, Math.round(y) - 1);
}
