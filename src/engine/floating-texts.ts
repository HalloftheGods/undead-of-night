import { drawOutlinedText, FONT_HEIGHT, textWidth } from './bitmap-font.ts';

/** How long a note stays up, counted again from each repeat that folds into it. */
const TEXT_LIFE = 1.1;
/** A note drifts this far up over its first RISE_TIME seconds, then holds so it can be read. */
const TEXT_RISE = 14;
const RISE_TIME = 0.6;
/** Fades over its last moments instead of blinking out. */
const FADE_TIME = 0.25;
const MAX_TEXTS = 24;
/** The same note again this soon and this close is one note with a bigger number. */
const MERGE_WINDOW = 0.6;
const MERGE_REACH = 28;
/** Glyphs plus the one-pixel outline above and below, plus a clear gap. */
const LINE_HEIGHT = FONT_HEIGHT + 2 + 2;
/** Side room so outlines of neighbours never touch. */
const SIDE_GAP = 4;
/** Pixels a second an older note slides up to make room. */
const LIFT_SPEED = 120;

const AMOUNT = /^\+(\d+)(.*)$/;

interface FloatingText {
  /** What decides whether a repeat folds in: the colour and the words without their number or count. */
  readonly key: string;
  readonly base: string;
  readonly color: string;
  readonly x: number;
  readonly y: number;
  /** Summed "+N" amount, or null for a plain word. */
  amount: number | null;
  count: number;
  text: string;
  width: number;
  age: number;
  life: number;
  lift: number;
  liftTarget: number;
}

export interface TextLine {
  readonly text: string;
  /** Centre x and the top of the glyphs, in world pixels. */
  readonly x: number;
  readonly top: number;
  readonly alpha: number;
}

function wordsOf(item: FloatingText): string {
  const summed = item.amount !== null;
  if (summed) return `+${item.amount}${item.base}`;
  const repeated = item.count > 1;
  return repeated ? `${item.base} x${item.count}` : item.base;
}

function rise(age: number): number {
  return Math.round(Math.min(1, age / RISE_TIME) * TEXT_RISE);
}

/**
 * Pickup, score and warning notes over the scene. A repeat of the same note close by folds into it
 * ("+4 SHELLS" twice reads "+8 SHELLS", "CLATTER" twice reads "CLATTER x2"), and older notes slide up
 * out of the way of newer ones, so no two lines are ever drawn over each other.
 */
export class FloatingTexts {
  private readonly items: FloatingText[] = [];

  clear(): void {
    this.items.length = 0;
  }

  get size(): number {
    return this.items.length;
  }

  add(text: string, x: number, y: number, color: string): void {
    const match = AMOUNT.exec(text);
    const base = match ? match[2] : text;
    const key = `${color}|${match ? '+' : ''}${base}`;
    const same = this.findRepeat(key, x, y);
    if (same) {
      const adds = same.amount !== null && match !== null;
      if (adds) same.amount = (same.amount ?? 0) + Number(match[1]);
      same.count += 1;
      this.refresh(same);
      same.life = same.age + TEXT_LIFE;
      return;
    }
    const full = this.items.length >= MAX_TEXTS;
    if (full) this.items.shift();
    const item: FloatingText = {
      key, base, color, x, y,
      amount: match ? Number(match[1]) : null,
      count: 1,
      text,
      width: 0,
      age: 0,
      life: TEXT_LIFE,
      lift: 0,
      liftTarget: 0,
    };
    this.refresh(item);
    this.items.push(item);
  }

  update(dt: number): void {
    let kept = 0;
    for (const item of this.items) {
      item.age += dt;
      const alive = item.age < item.life;
      if (alive) this.items[kept++] = item;
    }
    this.items.length = kept;
    this.makeRoom();
    for (const item of this.items) item.lift = Math.min(item.liftTarget, item.lift + LIFT_SPEED * dt);
  }

  /** Where each line is drawn this frame, oldest first. */
  lines(): TextLine[] {
    return this.items.map((item) => ({
      text: item.text,
      x: item.x,
      top: this.topOf(item, item.lift),
      alpha: Math.max(0, Math.min(1, (item.life - item.age) / FADE_TIME)),
    }));
  }

  draw(ctx: CanvasRenderingContext2D, left: number, top: number): void {
    const before = ctx.globalAlpha;
    for (const item of this.items) {
      ctx.globalAlpha = before * Math.max(0, Math.min(1, (item.life - item.age) / FADE_TIME));
      drawOutlinedText(ctx, item.text, Math.round(item.x) - left, Math.round(this.topOf(item, item.lift)) - top, item.color);
    }
    ctx.globalAlpha = before;
  }

  private refresh(item: FloatingText): void {
    item.text = wordsOf(item);
    item.width = textWidth(item.text);
  }

  private findRepeat(key: string, x: number, y: number): FloatingText | null {
    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      const item = this.items[i];
      const fresh = item.age < MERGE_WINDOW;
      const near = Math.abs(item.x - x) <= MERGE_REACH && Math.abs(item.y - y) <= MERGE_REACH;
      const repeat = item.key === key && fresh && near;
      if (repeat) return item;
    }
    return null;
  }

  private topOf(item: FloatingText, lift: number): number {
    return item.y - rise(item.age) - lift - FONT_HEIGHT;
  }

  /**
   * Newest notes keep their spot; each older one that would touch a newer one is pushed up above it.
   * Targets only ever grow, so a note never drops back down into a line it just cleared.
   */
  private makeRoom(): void {
    for (let i = this.items.length - 2; i >= 0; i -= 1) {
      const older = this.items[i];
      for (let pass = 0; pass < MAX_TEXTS; pass += 1) {
        const pushed = this.pushAbove(older, i);
        if (!pushed) break;
      }
    }
  }

  private pushAbove(older: FloatingText, index: number): boolean {
    const olderTop = this.topOf(older, older.liftTarget);
    for (let j = index + 1; j < this.items.length; j += 1) {
      const newer = this.items[j];
      const sideBySide = Math.abs(older.x - newer.x) >= (older.width + newer.width) / 2 + SIDE_GAP;
      if (sideBySide) continue;
      const newerTop = this.topOf(newer, newer.liftTarget);
      const overlap = olderTop + LINE_HEIGHT - newerTop;
      const clash = overlap > 0 && olderTop < newerTop + LINE_HEIGHT;
      if (!clash) continue;
      older.liftTarget += overlap;
      return true;
    }
    return false;
  }
}
