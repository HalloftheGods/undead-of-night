export interface SpatialItem {
  x: number;
  y: number;
  radius: number;
}

/** Stored by centre only; queries widen by the largest radius seen, so nothing needs deduping. */
export class SpatialHashGrid<T extends SpatialItem> {
  private readonly cellSize: number;
  private readonly cells = new Map<number, T[]>();
  private maxRadius = 0;

  constructor(cellSize = 32) {
    this.cellSize = cellSize;
  }

  private key(cx: number, cy: number): number {
    return (cx + 4096) * 8192 + (cy + 4096);
  }

  clear(): void {
    this.cells.clear();
    this.maxRadius = 0;
  }

  insert(item: T): void {
    const key = this.key(Math.floor(item.x / this.cellSize), Math.floor(item.y / this.cellSize));
    const cell = this.cells.get(key);
    if (cell) cell.push(item);
    else this.cells.set(key, [item]);
    const isWidest = item.radius > this.maxRadius;
    if (isWidest) this.maxRadius = item.radius;
  }

  /** Every item whose circle touches the query circle. */
  query(x: number, y: number, radius: number, out: T[] = []): T[] {
    const reach = radius + this.maxRadius;
    const minCx = Math.floor((x - reach) / this.cellSize);
    const maxCx = Math.floor((x + reach) / this.cellSize);
    const minCy = Math.floor((y - reach) / this.cellSize);
    const maxCy = Math.floor((y + reach) / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const cell = this.cells.get(this.key(cx, cy));
        if (!cell) continue;
        for (const item of cell) {
          const dx = item.x - x;
          const dy = item.y - y;
          const combined = radius + item.radius;
          const overlaps = dx * dx + dy * dy <= combined * combined;
          if (overlaps) out.push(item);
        }
      }
    }
    return out;
  }
}
