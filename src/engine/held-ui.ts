import type { PixelSprite } from '../art/types.ts';
import type { HeldAction, HeldActionKind } from '../game/inventory/held-actions.ts';
import { drawOutlinedText, drawText, FONT_HEIGHT, textWidth } from './bitmap-font.ts';
import { drawSprite } from './sprite-cache.ts';

/** The item in hand, as the canvas draws it: the picture at the pointer, its words and buttons under the survivor. */
export interface HeldView {
  readonly sprite: PixelSprite | null;
  readonly name: string;
  readonly hint: string;
  readonly actions: readonly HeldAction[];
  /** The pointer, in buffer pixels. */
  readonly x: number;
  readonly y: number;
}

/** A button's box in buffer pixels. */
export interface HeldButtonRect {
  readonly kind: HeldActionKind;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const INK = '#0b0c10';
const BONE = '#e8e4d8';
const DIM = '#9a968a';
const AMBER = '#f2a23a';
const BLOOD = '#e0483c';
const BELOW_SURVIVOR = 20;
const BUTTON_PAD_X = 6;
const BUTTON_PAD_Y = 3;
const BUTTON_GAP = 6;
const LINE_GAP = 3;

/** Draws the held item and its buttons. `anchor` is the survivor on screen (null: the middle). Returns where the buttons are, for clicks. */
export function drawHeldUi(ctx: CanvasRenderingContext2D, held: HeldView, anchor: { x: number; y: number } | null, viewW: number, viewH: number): HeldButtonRect[] {
  const centerX = anchor?.x ?? Math.round(viewW / 2);
  const top = (anchor?.y ?? Math.round(viewH / 2)) + BELOW_SURVIVOR;
  drawOutlinedText(ctx, held.name.toUpperCase(), centerX, top, BONE);
  if (held.hint !== '') drawOutlinedText(ctx, held.hint, centerX, top + FONT_HEIGHT + LINE_GAP, DIM);

  const height = FONT_HEIGHT + BUTTON_PAD_Y * 2;
  const widths = held.actions.map((action) => textWidth(action.label) + BUTTON_PAD_X * 2);
  const total = widths.reduce((sum, w) => sum + w, 0) + BUTTON_GAP * Math.max(0, widths.length - 1);
  let x = Math.round(centerX - total / 2);
  const y = top + (FONT_HEIGHT + LINE_GAP) * 2 + 2;
  const rects: HeldButtonRect[] = [];
  held.actions.forEach((action, i) => {
    const w = widths[i];
    const color = action.kind === 'drop' ? BLOOD : AMBER;
    const hovered = held.x >= x && held.x <= x + w && held.y >= y && held.y <= y + height;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, height);
    ctx.fillStyle = hovered ? color : INK;
    ctx.fillRect(x + 1, y + 1, w - 2, height - 2);
    drawText(ctx, action.label, x + BUTTON_PAD_X, y + BUTTON_PAD_Y, hovered ? INK : color);
    rects.push({ kind: action.kind, x, y, w, h: height });
    x += w + BUTTON_GAP;
  });

  if (held.sprite) drawSprite(ctx, held.sprite, held.x, held.y);
  return rects;
}
