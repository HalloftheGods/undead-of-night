// Tiny sprites for the map screen, written as rows of letters like the rest of the game's art,
// and the icon shape the key beside the map draws them through.

/** Letter to CSS colour. A letter not in the legend, and '.', is left clear. */
export type SpriteLegend = Readonly<Record<string, string>>;

/** Shared ink for every outline on the map, so the marks read as one set. */
export const MAP_INK = '#0b0c10';

/** Paints rows of letters with their top left at (x, y), one map pixel per letter. */
export function drawRows(ctx: CanvasRenderingContext2D, x: number, y: number, rows: readonly string[], legend: SpriteLegend): void {
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx += 1) {
      const color = legend[row[dx]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + dx, y + dy, 1, 1);
    }
  });
}

/** Paints the rows centred on (x, y). */
export function drawRowsCentred(ctx: CanvasRenderingContext2D, x: number, y: number, rows: readonly string[], legend: SpriteLegend): void {
  drawRows(ctx, x - Math.floor(rows[0].length / 2), y - Math.floor(rows.length / 2), rows, legend);
}

/** A picture for one line of the map's key: its size in map pixels, and how to paint it from (0, 0). */
export interface MapIcon {
  readonly w: number;
  readonly h: number;
  readonly paint: (ctx: CanvasRenderingContext2D) => void;
}

/** An icon that is just a sprite. */
export function rowsIcon(rows: readonly string[], legend: SpriteLegend): MapIcon {
  return { w: rows[0].length, h: rows.length, paint: (ctx) => drawRows(ctx, 0, 0, rows, legend) };
}
