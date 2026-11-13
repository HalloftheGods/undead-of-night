import type { LevelLinkCard, PickKey, SetupPick } from '../game/setup-picks.ts';
import { FONT_HEIGHT, textWidth } from './bitmap-font.ts';

/**
 * The Campaign and Arcade setup screen, drawn on the game canvas in art pixels. This file is the pure part: what the
 * screen shows (SetupModel), where everything sits for a view size (layoutSetupUi), what a point is over
 * (setupHitAt) and which control the keys and a pad move to (neighbour). setup-ui-draw.ts paints the layout.
 */

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Everything the screen says, handed over as plain data. The Vue page's PlaySetup computes the same things. */
export interface SetupModel {
  readonly heading: string;
  readonly picks: readonly SetupPick[];
  readonly levelLink: LevelLinkCard | null;
  readonly callsign: string;
  readonly startLine: string | null;
  readonly failure: string | null;
  readonly start: { readonly label: string; readonly enabled: boolean };
  readonly resume: { readonly label: string; readonly enabled: boolean } | null;
  /** The pick whose list is open. */
  readonly open: PickKey | null;
}

export type CardKey = PickKey | 'level';
export type ButtonId = 'back' | 'resume' | 'start';

export interface CardBox extends Box {
  readonly key: CardKey;
  /** Null for the Level card, which is a link and has no list. */
  readonly pick: SetupPick | null;
  readonly number: number;
  readonly label: string;
  readonly art: Box;
  readonly head: Box;
}

export interface ButtonBox extends Box {
  readonly id: ButtonId;
  readonly label: string;
  readonly primary: boolean;
  readonly enabled: boolean;
}

export interface OptionBox extends Box {
  readonly index: number;
  readonly art: Box;
  /** Where its first stat bar starts. */
  readonly bars: Box;
}

export interface ListLayout {
  readonly pick: SetupPick;
  readonly label: { readonly text: string; readonly x: number; readonly y: number; readonly scale: number };
  readonly options: readonly OptionBox[];
}

export interface SetupLayout {
  readonly heading: { readonly text: string; readonly x: number; readonly y: number; readonly scale: number };
  readonly cards: readonly CardBox[];
  readonly callsign: { readonly label: Box; readonly field: Box };
  readonly lines: readonly { readonly text: string; readonly x: number; readonly y: number; readonly tone: 'dim' | 'error' }[];
  readonly buttons: readonly ButtonBox[];
  readonly list: ListLayout | null;
}

export type SetupHit =
  | { readonly kind: 'card'; readonly key: CardKey }
  | { readonly kind: 'option'; readonly index: number }
  | { readonly kind: 'button'; readonly id: ButtonId }
  | { readonly kind: 'callsign' }
  | { readonly kind: 'backdrop' };

/** Something the keyboard can rest on: the picks, the callsign, the buttons. */
export type FocusId = `card:${CardKey}` | 'callsign' | `button:${ButtonId}`;

export const PORTRAIT_W = 56;
export const PORTRAIT_H = 72;
const PAD = 3;
const HEAD_H = 9;
const HEAD_GAP = 2;
export const CARD_W = PORTRAIT_W + PAD * 2;
export const CARD_H = PAD + HEAD_H + HEAD_GAP + PORTRAIT_H + PAD;
const JOIN = 8;
const EDGE = 4;
const HEADING_GAP = 10;
const ROW_GAP = 10;
const FIELD_W = 120;
const FIELD_H = 13;
const LABEL_GAP = 3;
const BUTTON_H = 13;
const BUTTON_PAD = 8;
const BUTTON_MIN_W = 40;
const BUTTON_GAP = 6;
const LINE_GAP = 3;

export const OPTION_PAD = 2;
export const OPTION_W = PORTRAIT_W + OPTION_PAD * 2;
export const BAR_PITCH = 6;
const OPTION_GAP = 6;
const LIST_LABEL_GAP = 10;
export const LIST_LABEL_SCALE = 2;
const HEADING_SCALE = 2;

function inside(box: Box, x: number, y: number): boolean {
  return x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
}

function buttonWidth(label: string): number {
  return Math.max(BUTTON_MIN_W, textWidth(label.toUpperCase()) + BUTTON_PAD * 2);
}

/** The cards in the order the page shows them: the picks, with the Level link standing in front of the pick it names. */
function cardSpecs(model: SetupModel): readonly { key: CardKey; pick: SetupPick | null; number: number; label: string }[] {
  const specs: { key: CardKey; pick: SetupPick | null; number: number; label: string }[] = [];
  for (const pick of model.picks) {
    const link = model.levelLink;
    if (link && link.before === pick.key) specs.push({ key: 'level', pick: null, number: link.number, label: link.label });
    specs.push({ key: pick.key, pick, number: pick.number, label: pick.label });
  }
  return specs;
}

function buttonSpecs(model: SetupModel): readonly Omit<ButtonBox, 'x' | 'y' | 'w' | 'h'>[] {
  const specs: Omit<ButtonBox, 'x' | 'y' | 'w' | 'h'>[] = [{ id: 'back', label: 'Back', primary: false, enabled: true }];
  if (model.resume) specs.push({ id: 'resume', label: model.resume.label, primary: false, enabled: model.resume.enabled });
  specs.push({ id: 'start', label: model.start.label, primary: true, enabled: model.start.enabled });
  return specs;
}

function optionLayout(pick: SetupPick, viewW: number, viewH: number): ListLayout {
  const count = pick.options.length;
  const barCount = Math.max(0, ...pick.options.map((option) => option.bars.length));
  const barsH = barCount * BAR_PITCH + 2;
  const cardH = OPTION_PAD + PORTRAIT_H + OPTION_PAD + barsH;
  const room = viewW - EDGE * 2;
  const perRowMost = Math.max(1, Math.floor((room + OPTION_GAP) / (OPTION_W + OPTION_GAP)));
  const rows = Math.ceil(count / perRowMost);
  const perRow = Math.ceil(count / rows);
  const labelText = `CHOOSE ${pick.label.toUpperCase()}`;
  const labelH = FONT_HEIGHT * LIST_LABEL_SCALE;
  const blockH = labelH + LIST_LABEL_GAP + rows * cardH + (rows - 1) * OPTION_GAP;
  const top = Math.max(EDGE, Math.floor((viewH - blockH) / 2));
  const options: OptionBox[] = [];
  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / perRow);
    const inRow = row === rows - 1 ? count - row * perRow : perRow;
    const rowW = inRow * OPTION_W + (inRow - 1) * OPTION_GAP;
    const x = Math.floor((viewW - rowW) / 2) + (index - row * perRow) * (OPTION_W + OPTION_GAP);
    const y = top + labelH + LIST_LABEL_GAP + row * (cardH + OPTION_GAP);
    options.push({
      index,
      x,
      y,
      w: OPTION_W,
      h: cardH,
      art: { x: x + OPTION_PAD, y: y + OPTION_PAD, w: PORTRAIT_W, h: PORTRAIT_H },
      bars: { x: x + OPTION_PAD, y: y + OPTION_PAD + PORTRAIT_H + OPTION_PAD, w: PORTRAIT_W, h: barsH },
    });
  }
  const labelW = textWidth(labelText) * LIST_LABEL_SCALE;
  return { pick, label: { text: labelText, x: Math.floor((viewW - labelW) / 2), y: top, scale: LIST_LABEL_SCALE }, options };
}

/** Where everything goes for a view of this size: heading, the row of picks, callsign, notes, buttons, centred together. */
export function layoutSetupUi(model: SetupModel, viewW: number, viewH: number): SetupLayout {
  const specs = cardSpecs(model);
  const buttons = buttonSpecs(model);
  const headingScale = textWidth(model.heading) * HEADING_SCALE + EDGE * 2 <= viewW ? HEADING_SCALE : 1;
  const headingH = FONT_HEIGHT * headingScale;
  const noteLines: { text: string; tone: 'dim' | 'error' }[] = [];
  if (model.startLine) noteLines.push({ text: model.startLine, tone: 'dim' });
  if (model.failure) noteLines.push({ text: model.failure, tone: 'error' });
  const notesH = noteLines.length * FONT_HEIGHT + Math.max(0, noteLines.length - 1) * LINE_GAP;
  const fieldBlockH = FONT_HEIGHT + LABEL_GAP + FIELD_H;
  const total =
    headingH + HEADING_GAP + CARD_H + ROW_GAP + fieldBlockH + (notesH > 0 ? ROW_GAP + notesH : 0) + ROW_GAP + BUTTON_H;
  let y = Math.max(EDGE, Math.floor((viewH - total) / 2));

  const heading = { text: model.heading.toUpperCase(), x: Math.floor((viewW - textWidth(model.heading) * headingScale) / 2), y, scale: headingScale };
  y += headingH + HEADING_GAP;

  const join = specs.length * CARD_W + (specs.length - 1) * JOIN + EDGE * 2 > viewW ? 4 : JOIN;
  const rowW = specs.length * CARD_W + (specs.length - 1) * join;
  const cards: CardBox[] = specs.map((spec, index) => {
    const x = Math.floor((viewW - rowW) / 2) + index * (CARD_W + join);
    return {
      ...spec,
      x,
      y,
      w: CARD_W,
      h: CARD_H,
      head: { x: x + PAD, y: y + PAD, w: PORTRAIT_W, h: HEAD_H },
      art: { x: x + PAD, y: y + PAD + HEAD_H + HEAD_GAP, w: PORTRAIT_W, h: PORTRAIT_H },
    };
  });
  y += CARD_H + ROW_GAP;

  const fieldX = Math.floor((viewW - FIELD_W) / 2);
  const callsign = {
    label: { x: fieldX, y, w: FIELD_W, h: FONT_HEIGHT },
    field: { x: fieldX, y: y + FONT_HEIGHT + LABEL_GAP, w: FIELD_W, h: FIELD_H },
  };
  y += fieldBlockH + ROW_GAP;

  const lines = noteLines.map((line, index) => ({
    ...line,
    x: Math.floor((viewW - textWidth(line.text)) / 2),
    y: y + index * (FONT_HEIGHT + LINE_GAP),
  }));
  if (notesH > 0) y += notesH + ROW_GAP;

  const widths = buttons.map((button) => buttonWidth(button.label));
  const buttonsW = widths.reduce((sum, w) => sum + w, 0) + (buttons.length - 1) * BUTTON_GAP;
  let bx = Math.floor((viewW - buttonsW) / 2);
  const placed: ButtonBox[] = buttons.map((button, index) => {
    const box = { ...button, x: bx, y, w: widths[index], h: BUTTON_H };
    bx += widths[index] + BUTTON_GAP;
    return box;
  });

  const openPick = model.open === null ? null : (model.picks.find((pick) => pick.key === model.open) ?? null);
  return { heading, cards, callsign, lines, buttons: placed, list: openPick ? optionLayout(openPick, viewW, viewH) : null };
}

/** What a point is over. An open list covers the screen: only its options answer, and the rest is its backdrop. */
export function setupHitAt(layout: SetupLayout, x: number, y: number): SetupHit | null {
  if (layout.list) {
    const option = layout.list.options.find((each) => inside(each, x, y));
    return option ? { kind: 'option', index: option.index } : { kind: 'backdrop' };
  }
  const button = layout.buttons.find((each) => inside(each, x, y));
  if (button) return { kind: 'button', id: button.id };
  const card = layout.cards.find((each) => inside(each, x, y));
  if (card) return { kind: 'card', key: card.key };
  const { label, field } = layout.callsign;
  if (inside(label, x, y) || inside(field, x, y)) return { kind: 'callsign' };
  return null;
}

export interface FocusTarget {
  readonly id: FocusId;
  readonly box: Box;
}

/** Every control the keyboard can rest on, in tab order: the picks, the callsign, then Back and the actions. */
export function focusTargets(layout: SetupLayout): readonly FocusTarget[] {
  return [
    ...layout.cards.map((card): FocusTarget => ({ id: `card:${card.key}`, box: card })),
    { id: 'callsign', box: layout.callsign.field },
    ...layout.buttons.filter((button) => button.enabled).map((button): FocusTarget => ({ id: `button:${button.id}`, box: button })),
  ];
}

export type Direction = 'left' | 'right' | 'up' | 'down';

/**
 * The control a step in `dir` from `from` lands on: the nearest centre that lies that way, an off-axis miss counting half
 * as much, so the move favours the next row or column over a far one. Null when nothing lies that way, so the focus stays put.
 */
export function neighbour(targets: readonly FocusTarget[], from: FocusId, dir: Direction): FocusId | null {
  const at = targets.find((target) => target.id === from);
  if (!at) return targets[0]?.id ?? null;
  const cx = at.box.x + at.box.w / 2;
  const cy = at.box.y + at.box.h / 2;
  let best: FocusId | null = null;
  let bestScore = Infinity;
  for (const target of targets) {
    if (target.id === from) continue;
    const dx = target.box.x + target.box.w / 2 - cx;
    const dy = target.box.y + target.box.h / 2 - cy;
    const along = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy;
    const across = dir === 'left' || dir === 'right' ? dy : dx;
    if (along <= 0) continue;
    const score = along + Math.abs(across) * 0.5;
    if (score < bestScore) {
      bestScore = score;
      best = target.id;
    }
  }
  return best;
}

/** The next control in tab order, wrapping; `step` is 1 for Tab and -1 for Shift+Tab. */
export function tabFrom(targets: readonly FocusTarget[], from: FocusId | null, step: 1 | -1): FocusId | null {
  if (targets.length === 0) return null;
  const at = targets.findIndex((target) => target.id === from);
  if (at < 0) return targets[step === 1 ? 0 : targets.length - 1].id;
  return targets[(at + step + targets.length) % targets.length].id;
}
