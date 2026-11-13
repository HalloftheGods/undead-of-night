import { FONT_HEIGHT, textWidth } from './bitmap-font.ts';
import { wrapWords } from './setup-text.ts';
import type { Box } from './setup-ui.ts';

/**
 * The page kit for title pages drawn on the game canvas, in art pixels: a heading, stacked panels of rows, and
 * buttons along the foot. This file is the pure part: what a page says (PageModel), where it all sits for a view
 * size and a scroll (layoutPageUi), what a point is over (pageHitAt) and which control the keys land on.
 * page-ui-draw.ts paints the layout; game/canvas-page.ts answers the pointer and keys.
 */

export type Tone = 'bone' | 'dim' | 'accent' | 'error';

export interface ChoiceOption {
  readonly id: string;
  readonly label: string;
}

/** One row of a panel. Rows with an `id` are controls: the pointer and keys reach them. */
export type PageItem =
  | { readonly kind: 'text'; readonly text: string; readonly tone: Tone }
  | { readonly kind: 'stat'; readonly label: string; readonly value: string }
  | { readonly kind: 'switch'; readonly id: string; readonly label: string; readonly on: boolean; readonly enabled: boolean }
  | { readonly kind: 'choice'; readonly id: string; readonly label: string; readonly options: readonly ChoiceOption[]; readonly value: string }
  | { readonly kind: 'slider'; readonly id: string; readonly label: string; readonly value: number; readonly readout: string }
  | { readonly kind: 'link'; readonly id: string; readonly label: string };

export interface PagePanel {
  readonly heading: string;
  readonly items: readonly PageItem[];
}

export interface PageButton {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly primary: boolean;
}

export interface PageModel {
  readonly heading: string;
  readonly panels: readonly PagePanel[];
  /** Along the foot, Back first. */
  readonly buttons: readonly PageButton[];
}

export interface PlacedPanel {
  readonly heading: string;
  readonly box: Box;
  readonly head: Box;
}

export interface TextLine {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly tone: Tone;
}

export interface PlacedControl {
  readonly id: string;
  readonly item: Exclude<PageItem, { kind: 'text' | 'stat' }>;
  readonly box: Box;
  /** A choice's buttons, in option order. */
  readonly parts: readonly Box[];
  /** A slider's track. */
  readonly track: Box | null;
}

export interface PlacedStat {
  readonly label: string;
  readonly value: string;
  readonly box: Box;
}

export interface PlacedButton extends Box {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly primary: boolean;
}

export interface PageLayout {
  readonly heading: { readonly text: string; readonly x: number; readonly y: number; readonly scale: number };
  /** Where panels may show: anything outside is scrolled off and neither draws nor answers. */
  readonly area: Box;
  readonly panels: readonly PlacedPanel[];
  readonly lines: readonly TextLine[];
  readonly stats: readonly PlacedStat[];
  readonly controls: readonly PlacedControl[];
  readonly buttons: readonly PlacedButton[];
  /** The farthest the content scrolls. */
  readonly scrollMax: number;
}

export type PageHit =
  | { readonly kind: 'control'; readonly id: string; readonly part: number | null; readonly along: number | null }
  | { readonly kind: 'button'; readonly id: string };

export type PageFocusId = `control:${string}` | `button:${string}`;

const EDGE = 4;
const COLUMN_MAX = 300;
const HEADING_GAP = 8;
const FOOT_GAP = 6;
const PANEL_GAP = 6;
const PANEL_PAD = 4;
const HEAD_H = 11;
const ITEM_GAP = 3;
const LINE_H = FONT_HEIGHT + 2;
const ROW_H = 13;
const SLIDER_H = 5;
const BUTTON_H = 13;
const BUTTON_PAD = 8;
const BUTTON_MIN_W = 40;
const BUTTON_GAP = 6;
const HEADING_SCALE = 2;
export const SCROLL_STEP = 24;

function inside(box: Box, x: number, y: number): boolean {
  return x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
}

function buttonWidth(label: string): number {
  return Math.max(BUTTON_MIN_W, textWidth(label.toUpperCase()) + BUTTON_PAD * 2);
}

/** How tall a row is at this inner width: text wraps, a choice stacks its label over its buttons. */
function itemHeight(item: PageItem, innerW: number): number {
  if (item.kind === 'text') return wrapWords(item.text.toUpperCase(), innerW, textWidth).length * LINE_H - (LINE_H - FONT_HEIGHT);
  if (item.kind === 'choice') return FONT_HEIGHT + 3 + ROW_H;
  if (item.kind === 'slider') return FONT_HEIGHT + 3 + SLIDER_H;
  return item.kind === 'stat' ? FONT_HEIGHT : ROW_H;
}

function panelHeight(panel: PagePanel, innerW: number): number {
  const rows = panel.items.map((item) => itemHeight(item, innerW));
  const gaps = Math.max(0, rows.length - 1) * ITEM_GAP;
  return HEAD_H + PANEL_PAD + rows.reduce((sum, h) => sum + h, 0) + gaps + PANEL_PAD;
}

/** Where everything goes for a view of this size, with the content scrolled down by `scroll` art pixels. */
export function layoutPageUi(model: PageModel, viewW: number, viewH: number, scroll: number): PageLayout {
  const headingScale = textWidth(model.heading) * HEADING_SCALE + EDGE * 2 <= viewW ? HEADING_SCALE : 1;
  const headingH = FONT_HEIGHT * headingScale;
  const heading = { text: model.heading.toUpperCase(), x: Math.floor((viewW - textWidth(model.heading) * headingScale) / 2), y: EDGE, scale: headingScale };

  const widths = model.buttons.map((button) => buttonWidth(button.label));
  const footW = widths.reduce((sum, w) => sum + w, 0) + Math.max(0, widths.length - 1) * BUTTON_GAP;
  const footY = viewH - EDGE - BUTTON_H;
  let bx = Math.floor((viewW - footW) / 2);
  const buttons = model.buttons.map((button, index): PlacedButton => {
    const placed = { ...button, x: bx, y: footY, w: widths[index], h: BUTTON_H };
    bx += widths[index] + BUTTON_GAP;
    return placed;
  });

  const areaY = EDGE + headingH + HEADING_GAP;
  const area: Box = { x: 0, y: areaY, w: viewW, h: Math.max(0, footY - FOOT_GAP - areaY) };
  const columnW = Math.min(COLUMN_MAX, viewW - EDGE * 2);
  const columnX = Math.floor((viewW - columnW) / 2);
  const innerW = columnW - PANEL_PAD * 2;

  const heights = model.panels.map((panel) => panelHeight(panel, innerW));
  const contentH = heights.reduce((sum, h) => sum + h, 0) + Math.max(0, heights.length - 1) * PANEL_GAP;
  const scrollMax = Math.max(0, contentH - area.h);
  const offset = Math.min(Math.max(0, scroll), scrollMax);

  const panels: PlacedPanel[] = [];
  const lines: TextLine[] = [];
  const stats: PlacedStat[] = [];
  const controls: PlacedControl[] = [];
  let y = areaY - offset;
  model.panels.forEach((panel, index) => {
    const box = { x: columnX, y, w: columnW, h: heights[index] };
    panels.push({ heading: panel.heading, box, head: { x: columnX, y, w: columnW, h: HEAD_H } });
    let rowY = y + HEAD_H + PANEL_PAD;
    const x = columnX + PANEL_PAD;
    for (const item of panel.items) {
      const h = itemHeight(item, innerW);
      const row = { x, y: rowY, w: innerW, h };
      if (item.kind === 'text') {
        wrapWords(item.text.toUpperCase(), innerW, textWidth).forEach((text, n) => lines.push({ text, x, y: rowY + n * LINE_H, tone: item.tone }));
      } else if (item.kind === 'stat') {
        stats.push({ label: item.label, value: item.value, box: row });
      } else if (item.kind === 'choice') {
        const count = Math.max(1, item.options.length);
        const each = Math.floor((innerW - (count - 1) * BUTTON_GAP) / count);
        const parts = item.options.map((_option, n): Box => ({ x: x + n * (each + BUTTON_GAP), y: rowY + FONT_HEIGHT + 3, w: each, h: ROW_H }));
        controls.push({ id: item.id, item, box: row, parts, track: null });
      } else if (item.kind === 'slider') {
        controls.push({ id: item.id, item, box: row, parts: [], track: { x, y: rowY + FONT_HEIGHT + 3, w: innerW, h: SLIDER_H } });
      } else {
        controls.push({ id: item.id, item, box: row, parts: [], track: null });
      }
      rowY += h + ITEM_GAP;
    }
    y += heights[index] + PANEL_GAP;
  });

  return { heading, area, panels, lines, stats, controls, buttons, scrollMax };
}

/** What a point is over. Rows scrolled out of the area do not answer, and the buttons always do. */
export function pageHitAt(layout: PageLayout, x: number, y: number): PageHit | null {
  const button = layout.buttons.find((each) => each.enabled && inside(each, x, y));
  if (button) return { kind: 'button', id: button.id };
  if (!inside(layout.area, x, y)) return null;
  for (const control of layout.controls) {
    const part = control.parts.findIndex((box) => inside(box, x, y));
    if (part >= 0) return { kind: 'control', id: control.id, part, along: null };
    const track = control.track;
    if (track && y >= track.y - 2 && y < track.y + track.h + 2 && x >= track.x && x < track.x + track.w) {
      return { kind: 'control', id: control.id, part: null, along: (x - track.x) / (track.w - 1) };
    }
    const isRow = control.item.kind === 'switch' || control.item.kind === 'link';
    if (isRow && inside(control.box, x, y)) return { kind: 'control', id: control.id, part: null, along: null };
  }
  return null;
}

export interface PageFocusTarget {
  readonly id: PageFocusId;
  readonly box: Box;
}

/** Every control the keys can rest on, top to bottom, then the enabled buttons. */
export function pageFocusTargets(layout: PageLayout): readonly PageFocusTarget[] {
  return [
    ...layout.controls.map((control): PageFocusTarget => ({ id: `control:${control.id}`, box: control.box })),
    ...layout.buttons.filter((button) => button.enabled).map((button): PageFocusTarget => ({ id: `button:${button.id}`, box: button })),
  ];
}

/** The next target in order, wrapping; Up and Shift+Tab step back. A null start lands on the first (or last, going back). */
export function stepPageFocus(targets: readonly PageFocusTarget[], from: PageFocusId | null, step: 1 | -1): PageFocusId | null {
  if (targets.length === 0) return null;
  const at = targets.findIndex((target) => target.id === from);
  if (at < 0) return targets[step === 1 ? 0 : targets.length - 1].id;
  return targets[(at + step + targets.length) % targets.length].id;
}

/**
 * The scroll that brings a control wholly into the area, moving as little as it can. The layout is read at the
 * current scroll, so the answer is a new scroll, not a delta.
 */
export function scrollToShow(layout: PageLayout, scroll: number, box: Box): number {
  const top = box.y - layout.area.y;
  const bottom = box.y + box.h - (layout.area.y + layout.area.h);
  if (top < 0) return Math.max(0, scroll + top - PANEL_PAD);
  if (bottom > 0) return Math.min(layout.scrollMax, scroll + bottom + PANEL_PAD);
  return scroll;
}

/** The value a choice or a slider takes one step along: choices wrap nowhere, sliders move by 5%. */
export function stepSlider(value: number, direction: 1 | -1): number {
  return Math.min(1, Math.max(0, Math.round((value + direction * 0.05) * 20) / 20));
}
