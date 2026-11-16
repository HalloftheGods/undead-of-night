// The broadsheet's type: Silkscreen, the same pixel face the game's own menus and sheets use (it is loaded globally in
// main.ts). It has real lowercase and is set on its 8-pixel grid, so text stays crisp. Drawn with the canvas's own
// text. The game's 5-pixel bitmap font stays for the dark pages.

export const PAPER_FONT_NAME = 'Silkscreen';
/** Body copy and headlines are both set in Silkscreen. */
export const BODY_FAMILY = `"${PAPER_FONT_NAME}", monospace`;
export const HEAD_FAMILY = BODY_FAMILY;
/** Silkscreen's grid is 8 pixels: the body and headline sizes are multiples of it to keep the edges sharp. */
export const BODY_SIZE = 8;
/** The leading between body lines, in art pixels. */
export const BODY_LINE = 12;
/** The biggest a headline is set. */
export const HEAD_SIZE = 16;
/** The leading between headline lines. */
export const HEAD_LINE = HEAD_SIZE + 4;

let measurer: CanvasRenderingContext2D | null | undefined;

function measuringContext(): CanvasRenderingContext2D | null {
  if (measurer !== undefined) return measurer;
  try {
    measurer = document.createElement('canvas').getContext('2d');
  } catch {
    measurer = null;
  }
  return measurer ?? null;
}

// Ask for the face once, when the module first loads, so the first frame that draws it has it.
try {
  if (typeof document !== 'undefined' && document.fonts) {
    void document.fonts.load(`${BODY_SIZE}px "${PAPER_FONT_NAME}"`);
    void document.fonts.load(`${HEAD_SIZE}px "${PAPER_FONT_NAME}"`);
  }
} catch {
  // No font loading here (a test host): the fallback face is measured and drawn instead.
}

/** How wide a run of text is at a size, in art pixels. Falls back to a rough estimate where there is no canvas. */
export function paperWidth(text: string, size: number, family: string = BODY_FAMILY): number {
  const ctx = measuringContext();
  if (!ctx) return text.length * size * 0.6;
  ctx.font = `${size}px ${family}`;
  return ctx.measureText(text).width;
}

/** Body lines packed into a column no wider than `maxW`. */
export function wrapPaper(text: string, maxW: number): readonly string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter((each) => each !== '')) {
      const joined = line === '' ? word : `${line} ${word}`;
      if (paperWidth(joined, BODY_SIZE) <= maxW || line === '') line = joined;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line !== '') lines.push(line);
  }
  return lines;
}

/** A headline broken into lines at the one headline size (HEAD_SIZE), wrapping to the next line rather than shrinking. */
export function wrapHeadline(text: string, maxW: number): readonly string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter((each) => each !== '')) {
    const joined = line === '' ? word : `${line} ${word}`;
    if (paperWidth(joined, HEAD_SIZE, HEAD_FAMILY) <= maxW || line === '') line = joined;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== '') lines.push(line);
  return lines.length > 0 ? lines : [''];
}

/** Draws a run of text on the canvas with its top at y, on whole pixels. */
export function drawPaper(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size: number, family: string = BODY_FAMILY): void {
  ctx.font = `${size}px ${family}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(text, Math.round(x), Math.round(y));
}
