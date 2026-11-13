import { STAT_SLOTS } from '../../shared/character-stats.ts';
import type { PixelSprite } from '../art/types.ts';
import type { PlayMode } from '../game/play-flow.ts';
import type { DifficultyId } from '../../shared/difficulty.ts';
import { chosenOption } from '../game/setup-picks.ts';
import type { PickOption, SetupPick } from '../game/setup-picks.ts';
import type { SetupWindow } from '../game/setup-view.ts';
import { drawText, FONT_HEIGHT, textWidth } from './bitmap-font.ts';
import { fitTitle, drawTextCentered, drawTextScaled, titleHeight } from './setup-text.ts';
import { spriteCanvas } from './sprite-cache.ts';
import type { ButtonBox, Box, CardBox, FocusId, OptionBox, SetupLayout } from './setup-ui.ts';

const INK = '#0b0c10';
const RAISED = '#17181f';
const LINE = '#33343c';
const BONE = '#e4dcc3';
const DIM = '#938d7a';
const BLOOD = '#e0463a';
const SICK = '#8fbf3a';
const AMBER = '#e8a33d';
const AMBER_TINT = 'rgba(232, 163, 61, 0.16)';
const NOTE_TONE = { accent: AMBER, dim: DIM, error: BLOOD } as const;
const CELL = 3;
const CELL_GAP = 1;

/** A 1 pixel frame with a fill, the page's px-frame without its notched corners. */
function frame(ctx: CanvasRenderingContext2D, box: Box, edge: string, fill: string): void {
  ctx.fillStyle = edge;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.fillStyle = fill;
  ctx.fillRect(box.x + 1, box.y + 1, box.w - 2, box.h - 2);
}

/** A sprite filling `box` like CSS object-fit: cover crops the overflow, contain shows it whole. Pixels stay sharp. */
function drawFit(ctx: CanvasRenderingContext2D, sprite: PixelSprite, box: Box, mode: 'cover' | 'contain'): void {
  const canvas = spriteCanvas(sprite);
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  if (mode === 'cover') {
    const s = Math.max(box.w / sprite.w, box.h / sprite.h);
    const sw = box.w / s;
    const sh = box.h / s;
    ctx.drawImage(canvas, (sprite.w - sw) / 2, (sprite.h - sh) / 2, sw, sh, box.x, box.y, box.w, box.h);
  } else {
    const s = Math.min(box.w / sprite.w, box.h / sprite.h);
    const dw = Math.round(sprite.w * s);
    const dh = Math.round(sprite.h * s);
    ctx.drawImage(canvas, box.x + Math.floor((box.w - dw) / 2), box.y + Math.floor((box.h - dh) / 2), dw, dh);
  }
  ctx.imageSmoothingEnabled = smoothing;
}

/** The film-title name over the foot of a picture, on a rising dark wash: shrunk until its longest word fits. */
function drawName(ctx: CanvasRenderingContext2D, art: Box, name: string, color: string, maxScale: number): void {
  const fitted = fitTitle(name.toUpperCase(), art.w - 6, maxScale);
  const height = titleHeight(fitted.scale, fitted.lines.length);
  const washH = Math.min(art.h, height + 14);
  const bands = 5;
  for (let band = 0; band < bands; band += 1) {
    const h = Math.ceil(washH / bands);
    ctx.fillStyle = `rgba(7, 8, 12, ${0.15 + (band / (bands - 1)) * 0.77})`;
    ctx.fillRect(art.x, art.y + art.h - washH + band * h, art.w, Math.min(h, washH - band * h));
  }
  let y = art.y + art.h - height - 3;
  for (const line of fitted.lines) {
    const centre = art.x + art.w / 2;
    drawTextCentered(ctx, line, centre, y + fitted.scale, BLOOD, fitted.scale);
    drawTextCentered(ctx, line, centre, y, color, fitted.scale);
    y += (FONT_HEIGHT + 1) * fitted.scale;
  }
}

/** The pop-art RUSTY / OP / LVL n stamp on a survivor, top right of the picture. */
function drawBadge(ctx: CanvasRenderingContext2D, art: Box, option: PickOption): void {
  const stamp = option.isRusty ? 'RUSTY' : option.isMaxed ? 'OP' : 'LVL';
  const number = !option.isRusty && !option.isMaxed ? String(option.level ?? '') : '';
  const w = textWidth(stamp) + (number ? textWidth(number) + 2 : 0) + 4;
  const box = { x: art.x + art.w - w - 2, y: art.y + 2, w, h: FONT_HEIGHT + 4 };
  ctx.fillStyle = INK;
  ctx.fillRect(box.x + 1, box.y + 1, box.w, box.h);
  frame(ctx, box, INK, '#ffffff');
  drawText(ctx, stamp, box.x + 2, box.y + 2, option.isRusty ? BLOOD : INK);
  if (number) drawText(ctx, number, box.x + 2 + textWidth(stamp) + 2, box.y + 2, INK);
}

function hasBadge(key: string, option: PickOption): boolean {
  return key === 'who' && (option.isRusty === true || (option.level ?? 0) > 0);
}

/** The picture for a pick's option: the mode or difficulty scene, or the survivor's bust (`bust`) or standing figure. */
function optionSprite(win: SetupWindow, key: SetupPick['key'], id: string, bust: boolean): PixelSprite | null {
  const art = win.art;
  if (!art) return null;
  if (key === 'mode') return art.ui.mode[id as PlayMode] ?? null;
  if (key === 'difficulty') return art.ui.difficulty[id as DifficultyId] ?? null;
  const survivor = art.survivors[Number(id)];
  return (bust ? survivor?.select : survivor?.portrait) ?? survivor?.portrait ?? null;
}

function isFocused(win: SetupWindow, id: FocusId): boolean {
  return win.focus === id;
}

/** A card that only shows a choice made for the player, such as Nightly Run's town: no caret, and nothing lights it. */
function drawFixedCard(ctx: CanvasRenderingContext2D, card: CardBox, fixed: NonNullable<CardBox['fixed']>): void {
  frame(ctx, card, LINE, RAISED);
  const head = card.head;
  ctx.fillStyle = AMBER;
  ctx.fillRect(head.x, head.y, 7, 7);
  drawText(ctx, String(card.number), head.x + Math.floor((7 - textWidth(String(card.number))) / 2), head.y + 1, INK);
  drawText(ctx, card.label.toUpperCase(), head.x + 10, head.y + 1, DIM);
  ctx.fillStyle = INK;
  ctx.fillRect(card.art.x, card.art.y, card.art.w, card.art.h);
  if (fixed.sprite) drawFit(ctx, fixed.sprite, card.art, 'cover');
  drawName(ctx, card.art, fixed.name, BONE, 2);
}

function drawCard(ctx: CanvasRenderingContext2D, win: SetupWindow, card: CardBox): void {
  if (card.fixed) {
    drawFixedCard(ctx, card, card.fixed);
    return;
  }
  const isOpen = win.model.open === card.key;
  const hovered = win.hover?.kind === 'card' && win.hover.key === card.key;
  const lit = hovered || isFocused(win, `card:${card.key}`) || isOpen;
  frame(ctx, card, lit ? AMBER : LINE, isOpen ? '#2a2216' : RAISED);
  const head = card.head;
  ctx.fillStyle = AMBER;
  ctx.fillRect(head.x, head.y, 7, 7);
  drawText(ctx, String(card.number), head.x + Math.floor((7 - textWidth(String(card.number))) / 2), head.y + 1, INK);
  drawText(ctx, card.label.toUpperCase(), head.x + 10, head.y + 1, DIM);
  drawCaret(ctx, head.x + head.w - 5, head.y + 2, card.key === 'level' ? 'right' : 'down');

  const art = card.art;
  ctx.fillStyle = INK;
  ctx.fillRect(art.x, art.y, art.w, art.h);
  const pick = card.pick;
  if (pick === null) {
    const link = win.model.levelLink;
    if (link?.sprite) drawFit(ctx, link.sprite, art, 'cover');
    if (link) drawName(ctx, art, link.name, BONE, 2);
    return;
  }
  const previewing = isOpen && win.previewed !== null ? pick.options.find((each) => each.id === win.previewed) : undefined;
  const shown = previewing ?? chosenOption(pick);
  const sprite = optionSprite(win, pick.key, shown.id, true);
  if (sprite) drawFit(ctx, sprite, art, 'cover');
  if (hasBadge(pick.key, shown)) drawBadge(ctx, art, shown);
  const isWho = pick.key === 'who';
  drawName(ctx, art, shown.name, isWho ? AMBER : BONE, isWho ? 3 : 2);
}

function drawCaret(ctx: CanvasRenderingContext2D, x: number, y: number, dir: 'down' | 'right'): void {
  ctx.fillStyle = DIM;
  for (let i = 0; i < 3; i += 1) {
    if (dir === 'down') ctx.fillRect(x + i, y + i, 5 - i * 2, 1);
    else ctx.fillRect(x + i, y + i, 1, 5 - i * 2);
  }
}

function drawBars(ctx: CanvasRenderingContext2D, area: Box, bars: PickOption['bars']): void {
  const cellsW = STAT_SLOTS * CELL + (STAT_SLOTS - 1) * CELL_GAP;
  bars.forEach((bar, row) => {
    const y = area.y + 1 + row * 6;
    drawText(ctx, bar.label.toUpperCase(), area.x + 2, y, bar.strong ? AMBER : DIM);
    for (let slot = 0; slot < STAT_SLOTS; slot += 1) {
      const on = slot < bar.filled;
      ctx.fillStyle = on ? (bar.strong ? AMBER : SICK) : LINE;
      ctx.fillRect(area.x + area.w - 2 - cellsW + slot * (CELL + CELL_GAP), y + 1, CELL, CELL);
    }
  });
}

function drawOption(ctx: CanvasRenderingContext2D, win: SetupWindow, pick: SetupPick, box: OptionBox): void {
  const option = pick.options[box.index];
  const chosen = box.index === pick.chosen;
  const hovered = win.hover?.kind === 'option' && win.hover.index === box.index;
  const focused = win.previewed === option.id;
  const lit = chosen || hovered || focused;
  frame(ctx, { x: box.x - 1, y: box.y - 1, w: box.w + 2, h: box.h + 2 }, lit ? AMBER : LINE, chosen ? '#2a2216' : RAISED);
  ctx.fillStyle = INK;
  ctx.fillRect(box.art.x, box.art.y, box.art.w, box.art.h);
  const turning = pick.key === 'who' && win.previewed === option.id ? win.art?.survivors[Number(option.id)]?.portraits[win.facing] : undefined;
  const sprite = turning ?? optionSprite(win, pick.key, option.id, false);
  if (sprite) drawFit(ctx, sprite, box.art, pick.key === 'who' ? 'contain' : 'cover');
  if (hasBadge(pick.key, option)) drawBadge(ctx, box.art, option);
  drawName(ctx, box.art, option.name, lit ? AMBER : BONE, 2);
  drawBars(ctx, box.bars, option.bars);
}

function drawList(ctx: CanvasRenderingContext2D, win: SetupWindow, layout: SetupLayout, viewW: number, viewH: number): void {
  const list = layout.list;
  if (!list) return;
  ctx.fillStyle = 'rgba(5, 6, 10, 0.84)';
  ctx.fillRect(0, 0, viewW, viewH);
  drawTextScaled(ctx, list.label.text, list.label.x, list.label.y + list.label.scale, BLOOD, list.label.scale);
  drawTextScaled(ctx, list.label.text, list.label.x, list.label.y, BONE, list.label.scale);
  for (const box of list.options) drawOption(ctx, win, list.pick, box);
}

function drawButton(ctx: CanvasRenderingContext2D, win: SetupWindow, button: ButtonBox): void {
  const hovered = win.hover?.kind === 'button' && win.hover.id === button.id && button.enabled;
  const lit = hovered || isFocused(win, `button:${button.id}`);
  const fill = button.primary ? (button.enabled ? AMBER : LINE) : RAISED;
  const ink = button.primary ? INK : button.enabled ? BONE : DIM;
  frame(ctx, button, lit ? BONE : button.primary ? AMBER : LINE, lit && !button.primary ? '#22232c' : fill);
  const label = button.label.toUpperCase();
  drawText(ctx, label, button.x + Math.floor((button.w - textWidth(label)) / 2), button.y + Math.floor((button.h - FONT_HEIGHT) / 2), ink);
}

function drawCallsign(ctx: CanvasRenderingContext2D, win: SetupWindow, layout: SetupLayout): void {
  if (!layout.hasCallsign) return;
  const { label, field } = layout.callsign;
  drawText(ctx, 'CALLSIGN', label.x, label.y, DIM);
  const lit = win.editing || isFocused(win, 'callsign') || (win.hover?.kind === 'callsign');
  frame(ctx, field, lit ? AMBER : LINE, INK);
  const typed = win.model.callsign ?? '';
  const text = typed === '' ? 'SURVIVOR' : typed;
  const y = field.y + Math.floor((field.h - FONT_HEIGHT) / 2);
  const x = field.x + Math.floor((field.w - textWidth(text)) / 2);
  drawText(ctx, text, x, y, typed === '' ? LINE : BONE);
  const blinkOn = Math.floor(performance.now() / 500) % 2 === 0;
  if (win.editing && blinkOn) {
    ctx.fillStyle = AMBER;
    const caretX = typed === '' ? x : x + textWidth(text) + 1;
    ctx.fillRect(caretX, y - 1, 1, FONT_HEIGHT + 2);
  }
}

/** The setup screen over the game: a light dim on the town, then the heading, the picks, the callsign, the notes and the buttons, then the open list over the lot. */
export function drawSetupUi(ctx: CanvasRenderingContext2D, win: SetupWindow, layout: SetupLayout, viewW: number, viewH: number): void {
  ctx.fillStyle = 'rgba(7, 8, 12, 0.42)';
  ctx.fillRect(0, 0, viewW, viewH);
  const { heading } = layout;
  drawTextScaled(ctx, heading.text, heading.x, heading.y + heading.scale, BLOOD, heading.scale);
  drawTextScaled(ctx, heading.text, heading.x, heading.y, BONE, heading.scale);
  for (const card of layout.cards) drawCard(ctx, win, card);
  drawCallsign(ctx, win, layout);
  for (const line of layout.lines) drawText(ctx, line.text.toUpperCase(), line.x, line.y, NOTE_TONE[line.tone]);
  for (const button of layout.buttons) drawButton(ctx, win, button);
  drawList(ctx, win, layout, viewW, viewH);
}
