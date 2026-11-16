import { FONT_HEIGHT, textWidth } from './bitmap-font.ts';
import { BODY_LINE, BODY_SIZE, HEAD_LINE, HEAD_SIZE, wrapHeadline, wrapPaper } from './paper-type.ts';
import { wrapWords } from './setup-text.ts';
import type { Box } from './setup-ui.ts';
import type { PixelSprite } from '../art/types.ts';

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
  /** A link with `icon` is a taller row with the sprite drawn at its left, so you can see what you are picking. */
  | { readonly kind: 'link'; readonly id: string; readonly label: string; readonly icon?: PixelSprite; readonly value?: string; readonly sub?: string; readonly disabled?: boolean }
  /** An action and the key or button it is bound to; pressing it starts listening for a new one. */
  | { readonly kind: 'bind'; readonly id: string; readonly label: string; readonly value: string; readonly listening: boolean }
  /** A row of picture cards (a badge, a tag, the cover art and two captions). Each card is a part of the control. */
  | { readonly kind: 'cards'; readonly id: string; readonly cards: readonly PageCard[] }
  /** The paper's logo (the cover's photo), drawn centred where it falls in the page. */
  | { readonly kind: 'logo' }
  | RadioItem
  | AlbumSliderItem;

export interface PageCard {
  readonly id: string;
  readonly badge: string;
  readonly tag: string;
  readonly art: PixelSprite;
  readonly caption: string;
  readonly detail: string;
}

export interface RadioTrackInfo {
  readonly name: string;
  readonly where: string;
  readonly find?: boolean;
}

export const RADIO_PARTS = [
  'prev',
  'rewind',
  'play',
  'stop',
  'forward',
  'next',
  'shuffle',
  'repeat',
  'favorite',
] as const;

export type RadioPart = (typeof RADIO_PARTS)[number];

export interface RadioItem {
  readonly kind: 'radio';
  readonly id: string;
  readonly track: RadioTrackInfo | null;
  readonly isPlaying: boolean;
  readonly isPaused: boolean;
  readonly currentTime: number;
  readonly duration: number;
  readonly position: number;
  readonly repeatMode: string;
  readonly isShuffle: boolean;
  readonly isFavorite: boolean;
}

export interface AlbumTrackInfo {
  readonly id: string;
  readonly name: string;
  readonly where: string;
  readonly file: string;
  readonly isPlaying: boolean;
  readonly isPaused: boolean;
  readonly isFavorite: boolean;
}

export interface AlbumSliderItem {
  readonly kind: 'album_slider';
  readonly id: string;
  readonly volume: string;
  readonly title: string;
  readonly subtitle: string;
  readonly art: PixelSprite;
  readonly albumIndex: number;
  readonly totalAlbums: number;
  readonly isHorde: boolean;
  readonly tracks: readonly AlbumTrackInfo[];
}

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
  /** Optional custom width in art pixels (defaults to COLUMN_MAX). */
  readonly width?: number;
  /** Drawn as a printed broadsheet, as in the digital art, instead of the game's dark panels. `photo` puts the picture in the masthead. */
  readonly paper?: { readonly masthead?: boolean };
}

export interface PlacedPanel {
  readonly heading: string;
  /** The heading broken into lines (one line on the dark pages). */
  readonly headLines: readonly string[];
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
  readonly item: Exclude<PageItem, { kind: 'text' | 'stat' | 'logo' }>;
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
  /** The logo rows, placed where they fall in the page. */
  readonly pictures: readonly Box[];
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
/** An icon link: room for a 24px picture with a pixel of frame around it. */
export const ICON_ROW_H = 28;
export const RADIO_ROW_H = 88;
/** A picture card: a head bar, the cover art, and two caption lines under it. */
export const CARD_H = 92;
const CARD_GAP = 4;
/** A printed broadsheet: the sheet keeps a newspaper's proportions and sits centred on the street. */
export const PAPER_RATIO = 0.72;
/** The sheet takes this share of the view, so the game shows around it. */
export const PAPER_VIEW_FRACTION = 0.8;
/** Padding at the sheet's edges: 2 pixels at most. */
export const PAPER_PAD = 2;
/** The logo (the cover's photo) on the last page, at the bottom centre, above the buttons. */
export const PAPER_LOGO_W = 56;
export const PAPER_LOGO_H = 40;
export const PAPER_HEAD_SCALE = 3;
/** A headline's row: the tallest it can be, at PAPER_HEAD_SCALE, with room for its rule. */
export const PAPER_HEAD_H = HEAD_SIZE + 10;
/** Pixel letters are 23 squares wide for NOISE, and the glyph gap is one square. */
const NAME_WIDTH_SQUARES = 23;

/** The sheet inside a view: as tall as the view allows at the newspaper's proportions, centred. */
export function paperSheet(viewW: number, viewH: number): Box {
  let h = Math.round(viewH * PAPER_VIEW_FRACTION);
  let w = Math.round(h * PAPER_RATIO);
  if (w > viewW * PAPER_VIEW_FRACTION) {
    w = Math.round(viewW * PAPER_VIEW_FRACTION);
    h = Math.round(w / PAPER_RATIO);
  }
  return { x: Math.floor((viewW - w) / 2), y: Math.floor((viewH - h) / 2), w, h };
}

/** The masthead's squares: NOISE 23 wide, NIGHT 22, and the small "IN" (8) and "THE" (13) stacked between them. */
const NOISE_SQUARES = 23;
const NIGHT_SQUARES = 22;
const IN_SQUARES = 8;
const THE_SQUARES = 13;
/** The gap either side of the small words, in big squares. */
const NAME_GAP_SQUARES = 3;
const STORY_BAND_H = 6;

export interface Masthead {
  /** Pixels per square of NOISE and NIGHT. */
  readonly scale: number;
  /** Pixels per square of the small "IN" and "THE". */
  readonly small: number;
  /** The nameplate's height, the letters' height. */
  readonly height: number;
  /** The band the nameplate and its rules take, top to the first row of text. */
  readonly band: number;
}

/**
 * The masthead for a sheet: NOISE, a small stacked "IN THE", and NIGHT on one line, as big as the sheet's width allows.
 */
export function paperMasthead(sheetW: number, sheetH: number): Masthead {
  const available = sheetW - PAPER_PAD * 2;
  let scale = 2;
  for (let s = 9; s >= 2; s -= 1) {
    const small = Math.max(1, Math.floor(s / 2));
    const width = (NOISE_SQUARES + NIGHT_SQUARES) * s + NAME_GAP_SQUARES * 2 * s + THE_SQUARES * small;
    if (width <= available && 5 * s <= sheetH * 0.2) {
      scale = s;
      break;
    }
  }
  const small = Math.max(1, Math.floor(scale / 2));
  const height = 5 * scale;
  return { scale, small, height, band: height + 22 };
}

/** The band a page's header takes: the masthead on the front page, a thin rule on the stories. */
export function paperBand(model: PageModel, mast: Masthead): number {
  return model.paper?.masthead ? mast.band : STORY_BAND_H;
}
export const CARD_HEAD_H = 9;
export const CARD_CAPTION_H = 14;
const SLIDER_H = 5;
export const BUTTON_H = 13;
const BUTTON_PAD = 8;
const BUTTON_MIN_W = 40;
const BUTTON_GAP = 6;
const HEADING_SCALE = 2;
export const SCROLL_STEP = 24;
const ROW_KINDS: readonly PageItem['kind'][] = ['switch', 'link', 'bind'];

function inside(box: Box, x: number, y: number): boolean {
  return x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
}

function buttonWidth(label: string): number {
  return Math.max(BUTTON_MIN_W, textWidth(label.toUpperCase()) + BUTTON_PAD * 2);
}

/** How tall a row is at this inner width: text wraps, a choice stacks its label over its buttons. */
/** The lines a text row breaks into: the bitmap font's capitals on the dark pages, real sentences on the paper. */
function textLines(text: string, w: number, paper: boolean): readonly string[] {
  return paper ? wrapPaper(text, w) : wrapWords(text.toUpperCase(), w, textWidth);
}

function lineStep(paper: boolean): number {
  return paper ? BODY_LINE : LINE_H;
}

function itemHeight(item: PageItem, innerW: number, paper: boolean): number {
  if (item.kind === 'text') {
    const step = lineStep(paper);
    const lines = textLines(item.text, innerW, paper).length;
    return lines === 0 ? 0 : (lines - 1) * step + (paper ? BODY_SIZE : FONT_HEIGHT);
  }
  if (item.kind === 'choice') return FONT_HEIGHT + 3 + ROW_H;
  if (item.kind === 'slider') return FONT_HEIGHT + 3 + SLIDER_H;
  if (item.kind === 'link') {
    if (item.icon) return item.sub ? Math.max(ICON_ROW_H, 24) : ICON_ROW_H;
    return item.sub ? ROW_H + 9 : ROW_H;
  }
  if (item.kind === 'radio') return RADIO_ROW_H;
  if (item.kind === 'cards') return CARD_H;
  if (item.kind === 'logo') return PAPER_LOGO_H + 6;
  if (item.kind === 'album_slider') return 18 + 144 + 6 + 8 + 6 + item.tracks.length * 18;
  return item.kind === 'stat' ? (paper ? BODY_LINE : FONT_HEIGHT) : ROW_H;
}

function panelHeight(panel: PagePanel, innerW: number, headH: number, paper: boolean): number {
  const rows = panel.items.map((item) => itemHeight(item, innerW, paper));
  const gaps = Math.max(0, rows.length - 1) * ITEM_GAP;
  return headH + PANEL_PAD + rows.reduce((sum, h) => sum + h, 0) + gaps + PANEL_PAD;
}

/** Where a page's rows sit: the margins, the masthead or heading band, and the row heights. */
interface FlowGeometry {
  readonly top: number;
  readonly side: number;
  readonly bottom: number;
  readonly headingH: number;
  readonly headH: number;
  readonly width: number;
  /** Set in the paper's type (real lowercase and its leading) rather than the bitmap font. */
  readonly paper: boolean;
  /** The space between the heading band and the first row. */
  readonly gap: number;
  /** Room kept free above the buttons for the logo. */
  readonly reserve: number;
}

function darkGeometry(model: PageModel, headingScale: number): FlowGeometry {
  return {
    top: EDGE,
    side: EDGE,
    bottom: EDGE,
    headingH: FONT_HEIGHT * headingScale,
    headH: HEAD_H,
    width: model.width ?? COLUMN_MAX,
    paper: false,
    gap: HEADING_GAP,
    reserve: 0,
  };
}

/** Where everything goes for a view of this size, with the content scrolled down by `scroll` art pixels. */
export function layoutPageUi(model: PageModel, viewW: number, viewH: number, scroll: number): PageLayout {
  const headingScale = textWidth(model.heading) * HEADING_SCALE + EDGE * 2 <= viewW ? HEADING_SCALE : 1;
  if (!model.paper) return flowLayout(model, viewW, viewH, scroll, darkGeometry(model, headingScale));
  const sheet = paperSheet(viewW, viewH);
  const masthead = paperMasthead(sheet.w, sheet.h);
  const geo: FlowGeometry = {
    top: PAPER_PAD,
    side: PAPER_PAD,
    bottom: PAPER_PAD,
    headingH: paperBand(model, masthead),
    headH: PAPER_HEAD_H,
    width: sheet.w - PAPER_PAD * 2,
    paper: true,
    gap: 4,
    reserve: 0,
  };
  return shiftLayout(flowLayout(model, sheet.w, sheet.h, scroll, geo), sheet.x, sheet.y);
}

function shiftLayout(layout: PageLayout, dx: number, dy: number): PageLayout {
  const moved = (box: Box): Box => ({ ...box, x: box.x + dx, y: box.y + dy });
  return {
    heading: { ...layout.heading, x: layout.heading.x + dx, y: layout.heading.y + dy },
    area: moved(layout.area),
    panels: layout.panels.map((panel) => ({ ...panel, box: moved(panel.box), head: moved(panel.head) })),
    lines: layout.lines.map((line) => ({ ...line, x: line.x + dx, y: line.y + dy })),
    stats: layout.stats.map((stat) => ({ ...stat, box: moved(stat.box) })),
    controls: layout.controls.map((control) => ({
      ...control,
      box: moved(control.box),
      parts: control.parts.map(moved),
      track: control.track ? moved(control.track) : null,
    })),
    pictures: layout.pictures.map(moved),
    buttons: layout.buttons.map((button) => ({ ...button, x: button.x + dx, y: button.y + dy })),
    scrollMax: layout.scrollMax,
  };
}

function flowLayout(model: PageModel, viewW: number, viewH: number, scroll: number, geo: FlowGeometry): PageLayout {
  const headingScale = textWidth(model.heading) * HEADING_SCALE + EDGE * 2 <= viewW ? HEADING_SCALE : 1;
  const headingH = geo.headingH;
  const headH = geo.headH;
  const heading = { text: model.heading.toUpperCase(), x: Math.floor((viewW - textWidth(model.heading) * headingScale) / 2), y: EDGE, scale: headingScale };

  const widths = model.buttons.map((button) => buttonWidth(button.label));
  const footW = widths.reduce((sum, w) => sum + w, 0) + Math.max(0, widths.length - 1) * BUTTON_GAP;
  const footY = viewH - geo.bottom - BUTTON_H;
  let bx = Math.floor((viewW - footW) / 2);
  const buttons = model.buttons.map((button, index): PlacedButton => {
    const placed = { ...button, x: bx, y: footY, w: widths[index], h: BUTTON_H };
    bx += widths[index] + BUTTON_GAP;
    return placed;
  });

  const areaY = geo.top + headingH + geo.gap;
  const area: Box = { x: 0, y: areaY, w: viewW, h: Math.max(0, footY - FOOT_GAP - geo.reserve - areaY) };
  const columnW = Math.min(geo.width, viewW - geo.side * 2);
  const columnX = Math.floor((viewW - columnW) / 2);
  const innerW = columnW - PANEL_PAD * 2;

  // A paper headline wraps to as many lines as the column needs, so each panel's head height is its own.
  const headLinesOf = (heading: string): readonly string[] => (geo.paper ? wrapHeadline(heading, columnW - 8) : [heading]);
  const headHeights = model.panels.map((panel) => (geo.paper ? headLinesOf(panel.heading).length * HEAD_LINE + 8 : headH));
  const heights = model.panels.map((panel, index) => panelHeight(panel, innerW, headHeights[index], geo.paper));
  const contentH = heights.reduce((sum, h) => sum + h, 0) + Math.max(0, heights.length - 1) * PANEL_GAP;
  const scrollMax = Math.max(0, contentH - area.h);
  const offset = Math.min(Math.max(0, scroll), scrollMax);

  const panels: PlacedPanel[] = [];
  const lines: TextLine[] = [];
  const stats: PlacedStat[] = [];
  const controls: PlacedControl[] = [];
  const pictures: Box[] = [];
  let y = areaY - offset;
  model.panels.forEach((panel, index) => {
    const box = { x: columnX, y, w: columnW, h: heights[index] };
    const panelHeadH = headHeights[index];
    panels.push({ heading: panel.heading, headLines: headLinesOf(panel.heading), box, head: { x: columnX, y, w: columnW, h: panelHeadH } });
    let rowY = y + panelHeadH + PANEL_PAD;
    const x = columnX + PANEL_PAD;
    for (const item of panel.items) {
      const h = itemHeight(item, innerW, geo.paper);
      const row = { x, y: rowY, w: innerW, h };
      if (item.kind === 'text') {
        textLines(item.text, innerW, geo.paper).forEach((text, n) => lines.push({ text, x, y: rowY + n * lineStep(geo.paper), tone: item.tone }));
      } else if (item.kind === 'stat') {
        stats.push({ label: item.label, value: item.value, box: row });
      } else if (item.kind === 'choice') {
        const count = Math.max(1, item.options.length);
        const each = Math.floor((innerW - (count - 1) * BUTTON_GAP) / count);
        const parts = item.options.map((_option, n): Box => ({ x: x + n * (each + BUTTON_GAP), y: rowY + FONT_HEIGHT + 3, w: each, h: ROW_H }));
        controls.push({ id: item.id, item, box: row, parts, track: null });
      } else if (item.kind === 'slider') {
        controls.push({ id: item.id, item, box: row, parts: [], track: { x, y: rowY + FONT_HEIGHT + 3, w: innerW, h: SLIDER_H } });
      } else if (item.kind === 'radio') {
        const chassisY = rowY + 7;
        const speakerW = Math.max(30, Math.min(42, Math.floor((innerW - 140) / 2)));
        const centerW = innerW - (speakerW + 6) * 2;
        const centerX = x + speakerW + 6;

        const tunerX = centerX + 2;
        const tunerY = chassisY + 4;
        const tunerW = centerW - 4;
        const track: Box = { x: tunerX, y: tunerY + 6, w: tunerW, h: 8 };

        const btnGap = 2;
        const btnCount = 6;
        const totalGap = (btnCount - 1) * btnGap;
        const btnW = Math.floor((centerW - 4 - totalGap) / btnCount);
        const transportW = btnCount * btnW + totalGap;
        const transportStartX = centerX + 2 + Math.floor((centerW - 4 - transportW) / 2);
        const transportY = chassisY + 61;
        const transportH = 14;

        const transportParts = Array.from({ length: btnCount }, (_, n): Box => ({
          x: transportStartX + n * (btnW + btnGap),
          y: transportY,
          w: btnW,
          h: transportH,
        }));

        const sideBtnX = x + innerW - speakerW - 2;
        const sideBtnW = speakerW - 4;
        const sideBtnY = chassisY + 38;
        const sideBtnH = 11;
        const sideBtnGap = 2;
        const sideParts = Array.from({ length: 3 }, (_, n): Box => ({
          x: sideBtnX,
          y: sideBtnY + n * (sideBtnH + sideBtnGap),
          w: sideBtnW,
          h: sideBtnH,
        }));

        const parts: Box[] = [...transportParts, ...sideParts];
        controls.push({ id: item.id, item, box: row, parts, track });
      } else if (item.kind === 'cards') {
        const count = Math.max(1, item.cards.length);
        const each = Math.floor((innerW - (count - 1) * CARD_GAP) / count);
        const parts = item.cards.map((_card, n): Box => ({ x: x + n * (each + CARD_GAP), y: rowY, w: each, h: CARD_H }));
        controls.push({ id: item.id, item, box: row, parts, track: null });
      } else if (item.kind === 'album_slider') {
        const cardW = 112;
        const cardH = 144;
        const cardX = x + Math.floor((innerW - cardW) / 2);
        const cardY = rowY + 18;

        const flipperW = 16;
        const flipperH = 26;
        const flipperY = cardY + Math.floor((cardH - flipperH) / 2);
        const prevFlipper: Box = { x: cardX - flipperW - 6, y: flipperY, w: flipperW, h: flipperH };
        const nextFlipper: Box = { x: cardX + cardW + 6, y: flipperY, w: flipperW, h: flipperH };

        const dotsY = cardY + cardH + 6;
        const dotSize = 8;
        const dotGap = 2;
        const totalDotsW = item.totalAlbums * dotSize + (item.totalAlbums - 1) * dotGap;
        const dotsStartX = x + Math.floor((innerW - totalDotsW) / 2);
        const dotParts = Array.from({ length: item.totalAlbums }, (_, n): Box => ({
          x: dotsStartX + n * (dotSize + dotGap),
          y: dotsY,
          w: dotSize,
          h: dotSize,
        }));

        const tracksStartY = dotsY + 8 + 6;
        const trackParts: Box[] = [];
        const favParts: Box[] = [];
        const favW = 16;
        const trackRowH = 16;
        const trackGap = 2;
        item.tracks.forEach((_, n) => {
          const ty = tracksStartY + n * (trackRowH + trackGap);
          trackParts.push({ x, y: ty, w: innerW - favW - 4, h: trackRowH });
          favParts.push({ x: x + innerW - favW, y: ty, w: favW, h: trackRowH });
        });

        const parts: Box[] = [prevFlipper, nextFlipper, ...dotParts, ...trackParts, ...favParts];
        controls.push({ id: item.id, item, box: row, parts, track: null });
      } else if (item.kind === 'logo') {
        pictures.push({ x: columnX + Math.floor((columnW - PAPER_LOGO_W) / 2), y: rowY + 3, w: PAPER_LOGO_W, h: PAPER_LOGO_H });
      } else {
        controls.push({ id: item.id, item, box: row, parts: [], track: null });
      }
      rowY += h + ITEM_GAP;
    }
    y += heights[index] + PANEL_GAP;
  });

  return { heading, area, panels, lines, stats, controls, pictures, buttons, scrollMax };
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
    const isRow = ROW_KINDS.includes(control.item.kind);
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
