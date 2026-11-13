import { drawText, FONT_HEIGHT, textWidth } from './bitmap-font.ts';

/** A title cut into lines at a whole-number size of the 5 pixel font. */
export interface FittedTitle {
  readonly scale: number;
  readonly lines: readonly string[];
}

type WidthOf = (text: string) => number;

/** Words packed into lines no wider than `maxW`; a single word wider than that still gets its own line. */
export function wrapWords(text: string, maxW: number, widthOf: WidthOf): readonly string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter((each) => each !== '')) {
    const joined = line === '' ? word : `${line} ${word}`;
    const fits = widthOf(joined) <= maxW;
    if (fits || line === '') line = joined;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

/**
 * The biggest whole-number size, up to `maxScale`, at which the longest word of `text` fits `maxW`, with the
 * text wrapped on its spaces: the page's titles shrink until the longest word fits, and so do these.
 */
export function fitTitle(text: string, maxW: number, maxScale: number, widthOf: WidthOf = textWidth): FittedTitle {
  const words = text.split(/\s+/).filter((each) => each !== '');
  const longest = Math.max(0, ...words.map((word) => widthOf(word)));
  let scale = Math.max(1, Math.floor(maxScale));
  while (scale > 1 && longest * scale > maxW) scale -= 1;
  return { scale, lines: wrapWords(text, Math.floor(maxW / scale), widthOf) };
}

/** Height of `lines` lines at `scale`, with a pixel of air between lines. */
export function titleHeight(scale: number, lines: number): number {
  return lines * FONT_HEIGHT * scale + Math.max(0, lines - 1) * scale;
}

const scaledCache = new Map<string, HTMLCanvasElement>();
const SCALED_CACHE_SIZE = 64;

/** The text at its own size, baked once, so a scaled draw is one drawImage. */
function baked(text: string, color: string): HTMLCanvasElement {
  const key = `${color}|${text}`;
  const cached = scaledCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, textWidth(text));
  canvas.height = FONT_HEIGHT;
  drawText(canvas.getContext('2d')!, text, 0, 0, color);
  scaledCache.set(key, canvas);
  if (scaledCache.size > SCALED_CACHE_SIZE) scaledCache.delete(scaledCache.keys().next().value!);
  return canvas;
}

/** The font drawn `scale` times as big, pixels kept square. Left edge at x. */
export function drawTextScaled(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, scale: number): void {
  if (text === '') return;
  const isPlain = scale === 1;
  if (isPlain) {
    drawText(ctx, text, x, y, color);
    return;
  }
  const source = baked(text, color);
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, Math.round(x), Math.round(y), source.width * scale, source.height * scale);
  ctx.imageSmoothingEnabled = smoothing;
}

/** The text centred on `centerX`. */
export function drawTextCentered(ctx: CanvasRenderingContext2D, text: string, centerX: number, y: number, color: string, scale = 1): void {
  drawTextScaled(ctx, text, centerX - (textWidth(text) * scale) / 2, y, color, scale);
}
