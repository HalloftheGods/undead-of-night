import type { PixelSprite } from '../art/types.ts';
import type { HeldAction, HeldActionKind } from '../game/inventory/held-actions.ts';
import { drawOutlinedText, drawText, FONT_HEIGHT, textWidth } from './bitmap-font.ts';
import { drawSprite } from './sprite-cache.ts';
import type { QuipMood } from '../game/inventory/survivor-voices.ts';

/** The item in hand, as the canvas draws it: the picture at the pointer, its words and buttons under the survivor. */
export interface HeldView {
  readonly sprite: PixelSprite | null;
  readonly name: string;
  readonly hint: string;
  readonly actions: readonly HeldAction[];
  readonly type: string;
  readonly itemId: string;
  /** The pointer, in buffer pixels. */
  readonly x: number;
  readonly y: number;
  /** The pad buttons that use and drop it, shown on the buttons while a pad is in hand. Absent for mouse and keys. */
  readonly padKeys?: { readonly use: string; readonly drop: string } | null;
}

/** What the survivor says about the item, and how keen they are (game/inventory/survivor-quips.ts). */
export interface HeldQuip {
  readonly line: string;
  readonly mood: QuipMood;
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
const GREEN = '#8fdc5a';
/** How keen the survivor is, as the colour of their line and of the rim around them. */
export const QUIP_COLOR: Readonly<Record<QuipMood, string>> = { need: GREEN, fine: BONE, full: AMBER, cant: DIM };
/** The caption's leader starts at the survivor's shoulder, this far up and over from their feet. */
const LEADER_FROM = { x: 5, y: 22 };
const LEADER_LEN = 7;
const EDGE = 2;

/**
 * The survivor's line about the item, up and to one side of their head with a "/" leader pointing down at them.
 * It flips to the left ("\\") when the right side would run off the view.
 */
export function drawQuip(ctx: CanvasRenderingContext2D, quip: HeldQuip, anchor: { x: number; y: number }, viewW: number): void {
  const color = QUIP_COLOR[quip.mood];
  const text = quip.line.toUpperCase();
  const w = textWidth(text);
  const fitsRight = anchor.x + LEADER_FROM.x + LEADER_LEN + 1 + w <= viewW - EDGE;
  const dir = fitsRight ? 1 : -1;
  const startX = anchor.x + dir * LEADER_FROM.x;
  const startY = anchor.y - LEADER_FROM.y;
  const steps = Array.from({ length: LEADER_LEN }, (_, i) => ({ x: startX + dir * i, y: startY - i }));
  ctx.fillStyle = INK;
  for (const s of steps) ctx.fillRect(s.x - 1, s.y - 1, 3, 3);
  ctx.fillStyle = color;
  for (const s of steps) ctx.fillRect(s.x, s.y, 1, 1);
  const end = steps[steps.length - 1];
  const textLeft = fitsRight ? end.x + 2 : Math.max(EDGE, end.x - 2 - w);
  drawOutlinedText(ctx, text, textLeft + w / 2, end.y - FONT_HEIGHT - 1, color);
}

/** A button's words, with the pad button that presses it in front while a pad is in hand: "[RT] EAT". */
export function buttonLabel(action: HeldAction, padKeys: HeldView['padKeys']): string {
  if (!padKeys) return action.label;
  return `[${(action.kind === 'use' ? padKeys.use : padKeys.drop).toUpperCase()}] ${action.label}`;
}

/** Draws the held item and its buttons. `anchor` is the survivor on screen (null: the middle). Returns where the buttons are, for clicks. */
export function drawHeldUi(ctx: CanvasRenderingContext2D, held: HeldView, anchor: { x: number; y: number } | null, viewW: number, viewH: number): HeldButtonRect[] {
  const centerX = anchor?.x ?? Math.round(viewW / 2);
  const top = (anchor?.y ?? Math.round(viewH / 2)) + BELOW_SURVIVOR;
  drawOutlinedText(ctx, held.name.toUpperCase(), centerX, top, BONE);
  if (held.hint !== '') drawOutlinedText(ctx, held.hint, centerX, top + FONT_HEIGHT + LINE_GAP, DIM);

  const height = FONT_HEIGHT + BUTTON_PAD_Y * 2;
  const labels = held.actions.map((action) => buttonLabel(action, held.padKeys ?? null));
  const widths = labels.map((label) => textWidth(label) + BUTTON_PAD_X * 2);
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
    drawText(ctx, labels[i], x + BUTTON_PAD_X, y + BUTTON_PAD_Y, hovered ? INK : color);
    rects.push({ kind: action.kind, x, y, w, h: height });
    x += w + BUTTON_GAP;
  });

  if (held.sprite) drawSprite(ctx, held.sprite, held.x, held.y);
  return rects;
}
