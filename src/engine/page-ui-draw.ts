import { drawText, FONT_HEIGHT, textWidth } from './bitmap-font.ts';
import { CARD_CAPTION_H, CARD_HEAD_H, layoutPageUi, PAPER_PAD, paperBand, paperMasthead, paperSheet } from './page-ui.ts';
import { BODY_SIZE, drawPaper, HEAD_FAMILY, HEAD_LINE, HEAD_SIZE, paperWidth } from './paper-type.ts';
import { GLYPHS } from '../art/books/paper-card.ts';
import { RAMPS } from '../art/palette.ts';
import type { PageCard, PageLayout, PageModel, PlacedButton, PlacedControl, Tone } from './page-ui.ts';
import { drawTextScaled } from './setup-text.ts';
import type { Box } from './setup-ui.ts';
import type { PageWindow } from '../game/page-view.ts';
import type { PixelSprite } from '../art/types.ts';
import { spriteCanvas } from './sprite-cache.ts';
import { drawRadio } from './radio-deck-draw.ts';
import { drawAlbumSlider } from './album-slider-draw.ts';

const INK = '#0b0c10';
const RAISED = '#17181f';
const LINE = '#33343c';
const BONE = '#e4dcc3';
const DIM = '#938d7a';
const BLOOD = '#e0463a';
const AMBER = '#e8a33d';
const SICK = '#8fbf3a';
const TONES: Readonly<Record<Tone, string>> = { bone: BONE, dim: DIM, accent: AMBER, error: BLOOD };

function frame(ctx: CanvasRenderingContext2D, box: Box, edge: string, fill: string): void {
  ctx.fillStyle = edge;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.fillStyle = fill;
  ctx.fillRect(box.x + 1, box.y + 1, box.w - 2, box.h - 2);
}

/** The opaque part of a sprite, so a small pickup in a big frame still fills its icon. */
const opaqueBounds = new WeakMap<PixelSprite, Box>();
function boundsOf(sprite: PixelSprite): Box {
  let bounds = opaqueBounds.get(sprite);
  if (bounds) return bounds;
  let minX = sprite.w, minY = sprite.h, maxX = -1, maxY = -1;
  for (let y = 0; y < sprite.h; y++) {
    for (let x = 0; x < sprite.w; x++) {
      if (sprite.rgba[(y * sprite.w + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  bounds = maxX < 0 ? { x: 0, y: 0, w: sprite.w, h: sprite.h } : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  opaqueBounds.set(sprite, bounds);
  return bounds;
}

/** A sprite's opaque part fitted inside the box, centred: big art shrinks, small art grows by whole steps. */
function drawIcon(ctx: CanvasRenderingContext2D, sprite: PixelSprite, box: Box): void {
  const src = boundsOf(sprite);
  const fit = Math.min(box.w / src.w, box.h / src.h);
  const scale = fit >= 1 ? Math.floor(fit) : fit;
  const w = Math.max(1, Math.round(src.w * scale));
  const h = Math.max(1, Math.round(src.h * scale));
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spriteCanvas(sprite), src.x, src.y, src.w, src.h, box.x + Math.floor((box.w - w) / 2), box.y + Math.floor((box.h - h) / 2), w, h);
  ctx.imageSmoothingEnabled = smoothing;
}

function centred(ctx: CanvasRenderingContext2D, text: string, box: Box, color: string): void {
  const label = text.toUpperCase();
  drawText(ctx, label, box.x + Math.floor((box.w - textWidth(label)) / 2), box.y + Math.floor((box.h - FONT_HEIGHT) / 2), color);
}

/** The ink of a switch's ON/OFF: dark on the lit ON, bone while it can be pressed, dim once it cannot. */
function switchInk(on: boolean, enabled: boolean): string {
  if (on) return INK;
  return enabled ? BONE : DIM;
}

/** A choice button's edge: amber when chosen, bone under the pointer, line otherwise. */
function choiceEdge(chosen: boolean, hovered: boolean): string {
  if (chosen) return AMBER;
  return hovered ? BONE : LINE;
}

function isLit(win: PageWindow, id: string): boolean {
  const hovered = win.hover?.kind === 'control' && win.hover.id === id;
  return hovered || win.focus === `control:${id}`;
}

/** A row of picture cards: the badge and tag on a head bar, the cover art, then the caption and detail. The lit card is the pointed one, or the keyboard's. */
function drawCards(ctx: CanvasRenderingContext2D, win: PageWindow, control: PlacedControl, cards: readonly PageCard[]): void {
  const focused = win.focus === `control:${control.id}`;
  cards.forEach((card, index) => {
    const box = control.parts[index];
    const pointed = win.hover?.kind === 'control' && win.hover.id === control.id && win.hover.part === index;
    const lit = pointed || (focused && (win.cardAt ?? 0) === index);
    frame(ctx, box, lit ? AMBER : LINE, RAISED);
    ctx.fillStyle = INK;
    ctx.fillRect(box.x + 1, box.y + 1, box.w - 2, CARD_HEAD_H - 1);
    drawText(ctx, card.badge.toUpperCase(), box.x + 3, box.y + 3, AMBER);
    const tag = card.tag.toUpperCase();
    drawText(ctx, tag, box.x + box.w - 3 - textWidth(tag), box.y + 3, DIM);
    const art = { x: box.x + 3, y: box.y + CARD_HEAD_H + 2, w: box.w - 6, h: box.h - CARD_HEAD_H - CARD_CAPTION_H - 4 };
    ctx.fillStyle = INK;
    ctx.fillRect(art.x, art.y, art.w, art.h);
    drawIcon(ctx, card.art, art);
    const captionY = box.y + box.h - CARD_CAPTION_H + 2;
    drawText(ctx, card.caption.toUpperCase(), box.x + 3, captionY, lit ? BONE : DIM);
    drawText(ctx, card.detail.toUpperCase(), box.x + 3, captionY + FONT_HEIGHT + 2, DIM);
  });
}

function drawControl(ctx: CanvasRenderingContext2D, win: PageWindow, control: PlacedControl): void {
  const { item, box } = control;
  if (item.kind === 'radio') {
    drawRadio(ctx, win, control);
    return;
  }
  if (item.kind === 'cards') {
    drawCards(ctx, win, control, item.cards);
    return;
  }
  if (item.kind === 'album_slider') {
    drawAlbumSlider(ctx, win, control);
    return;
  }
  const lit = isLit(win, control.id);
  const isRow = item.kind === 'switch' || item.kind === 'link' || item.kind === 'bind';
  const labelY = box.y + (isRow ? Math.floor((box.h - FONT_HEIGHT) / 2) : 0);
  if (item.kind === 'link') {
    const disabled = item.disabled === true;
    if (lit && !disabled) frame(ctx, box, AMBER, RAISED);
    const textX = item.icon ? box.x + box.h + 4 : box.x + 4;
    if (item.icon) drawIcon(ctx, item.icon, { x: box.x + 2, y: box.y + 2, w: box.h - 4, h: box.h - 4 });
    const hasSub = item.sub !== undefined && item.sub !== '';
    const mainY = hasSub ? box.y + 3 : labelY;
    const litLabelColor = lit ? BONE : AMBER;
    const labelColor = disabled ? DIM : litLabelColor;
    drawText(ctx, item.label.toUpperCase(), textX, mainY, labelColor);
    if (item.value) {
      const val = item.value.toUpperCase();
      const litValColor = lit ? BONE : DIM;
      const valColor = disabled ? DIM : litValColor;
      drawText(ctx, val, box.x + box.w - 4 - textWidth(val), mainY, valColor);
    }
    if (hasSub) {
      const subY = mainY + FONT_HEIGHT + 2;
      drawText(ctx, item.sub!.toUpperCase(), textX, subY, DIM);
    }
    return;
  }
  drawText(ctx, item.label.toUpperCase(), box.x, labelY, lit ? AMBER : DIM);
  if (item.kind === 'bind') {
    const w = Math.min(box.w - 4, Math.max(60, textWidth(item.value.toUpperCase()) + 10));
    const key = { x: box.x + box.w - w, y: box.y, w, h: box.h };
    frame(ctx, key, item.listening || lit ? AMBER : LINE, item.listening ? AMBER : RAISED);
    centred(ctx, item.listening ? 'PRESS...' : item.value, key, item.listening ? INK : BONE);
    return;
  }
  if (item.kind === 'switch') {
    const w = 24;
    const toggle = { x: box.x + box.w - w, y: box.y, w, h: box.h };
    frame(ctx, toggle, lit ? AMBER : LINE, item.on ? AMBER : RAISED);
    centred(ctx, item.on ? 'ON' : 'OFF', toggle, switchInk(item.on, item.enabled));
    return;
  }
  if (item.kind === 'choice') {
    control.parts.forEach((part, index) => {
      const chosen = item.options[index].id === item.value;
      const hovered = win.hover?.kind === 'control' && win.hover.id === control.id && win.hover.part === index;
      frame(ctx, part, choiceEdge(chosen, hovered), chosen ? AMBER : RAISED);
      centred(ctx, item.options[index].label, part, chosen ? INK : BONE);
    });
    return;
  }
  const track = control.track;
  if (!track) return;
  const readoutW = textWidth(item.readout.toUpperCase());
  drawText(ctx, item.readout.toUpperCase(), box.x + box.w - readoutW, box.y, AMBER);
  frame(ctx, track, lit ? AMBER : LINE, INK);
  const fill = Math.round((track.w - 2) * item.value);
  ctx.fillStyle = SICK;
  ctx.fillRect(track.x + 1, track.y + 1, fill, track.h - 2);
}

function buttonLook(button: PlacedButton, lit: boolean): { edge: string; fill: string; ink: string } {
  if (button.primary) return { edge: lit ? BONE : AMBER, fill: button.enabled ? AMBER : LINE, ink: INK };
  return { edge: lit ? BONE : LINE, fill: lit ? '#22232c' : RAISED, ink: button.enabled ? BONE : DIM };
}

/** The broadsheet's inks, taken from the same ramps as the digital paper cover (art/books/paper-card.ts). */
const hex = (value: number): string => `#${value.toString(16).padStart(6, '0')}`;
const PAPER = {
  sheet: hex(RAMPS.bone[3]),
  column: hex(RAMPS.bone[3]),
  ink: hex(RAMPS.ink[0]),
  head: hex(RAMPS.ink[0]),
  headText: hex(RAMPS.bone[3]),
  dim: hex(RAMPS.bone[0]),
  faded: hex(RAMPS.bone[1]),
  red: hex(RAMPS.blood[2]),
  redDeep: hex(RAMPS.blood[1]),
  fire: hex(RAMPS.fire[2]),
  moon: hex(RAMPS.fire[3]),
  edge: hex(RAMPS.bone[1]),
};
const PAPER_TONES: Readonly<Record<Tone, string>> = { bone: PAPER.ink, dim: PAPER.dim, accent: PAPER.red, error: PAPER.red };

/** Pixel letters from the cover's nameplate: one 'X' is one square of `scale` pixels. */
function drawNameWord(ctx: CanvasRenderingContext2D, word: string, x: number, y: number, scale: number, color: string): void {
  ctx.fillStyle = color;
  let cursor = x;
  for (const char of word) {
    const glyph = GLYPHS[char];
    if (!glyph) {
      cursor += 3 * scale;
      continue;
    }
    glyph.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx += 1) {
        if (row[rx] === 'X') ctx.fillRect(cursor + rx * scale, y + ry * scale, scale, scale);
      }
    });
    cursor += (glyph[0].length + 1) * scale;
  }
}

/** The cover's photo: a halftone night, a yellow moon, a dark ground. */
function drawPhoto(ctx: CanvasRenderingContext2D, box: Box): void {
  ctx.fillStyle = PAPER.ink;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.fillStyle = PAPER.dim;
  for (let dy = 1; dy < box.h - 1; dy += 2) {
    for (let dx = 1 + ((dy >> 1) % 2); dx < box.w - 1; dx += 2) ctx.fillRect(box.x + dx, box.y + dy, 1, 1);
  }
  const cx = box.x + box.w - 9;
  const cy = box.y + 7;
  ctx.fillStyle = PAPER.fire;
  ctx.fillRect(cx - 3, cy - 3, 6, 6);
  ctx.fillStyle = PAPER.moon;
  ctx.fillRect(cx - 2, cy - 2, 4, 4);
  ctx.fillStyle = PAPER.ink;
  ctx.fillRect(box.x + 1, box.y + box.h - 5, box.w - 2, 4);
}

/** The broadsheet over the dark street: a drop shadow, the newsprint, its edge, a blood spatter and a dog-eared corner. */
function drawSheet(ctx: CanvasRenderingContext2D, model: PageModel, viewW: number, viewH: number): void {
  const sheet = paperSheet(viewW, viewH);
  const { x, y, w, h } = sheet;
  const paper = model.paper ?? {};
  ctx.fillStyle = PAPER.ink;
  ctx.fillRect(x + 3, y + 3, w, h);
  frame(ctx, sheet, PAPER.ink, PAPER.sheet);
  const mast = paperMasthead(w, h);
  const band = paperBand(model, mast);
  const left = x + PAPER_PAD;
  const right = x + w - PAPER_PAD;
  ctx.fillStyle = PAPER.ink;
  ctx.fillRect(left, y + PAPER_PAD + 4, right - left, 1);
  if (paper.masthead) {
    // The front page's nameplate on one line, centred: NOISE, IN THE stacked small, NIGHT.
    const s = mast.scale;
    const small = mast.small;
    const nameWidth = 51 * s + 13 * small;
    const nameLeft = x + Math.floor((w - nameWidth) / 2);
    const top = y + PAPER_PAD + 10;
    const stackH = 10 * small + 2;
    const stackY = top + Math.floor((5 * s - stackH) / 2);
    drawNameWord(ctx, 'NOISE', nameLeft, top, s, PAPER.ink);
    const smallX = nameLeft + 23 * s + 3 * s;
    drawNameWord(ctx, 'IN', smallX, stackY, small, PAPER.dim);
    drawNameWord(ctx, 'THE', smallX, stackY + 5 * small + 2, small, PAPER.dim);
    drawNameWord(ctx, 'NIGHT', smallX + 13 * small + 3 * s, top, s, PAPER.red);
  }
  const rule = y + PAPER_PAD + band - 4;
  ctx.fillStyle = PAPER.ink;
  ctx.fillRect(left, rule, right - left, 2);
  ctx.fillRect(left, rule + 3, right - left, 1);
  // The dog-eared corner.
  ctx.fillStyle = PAPER.edge;
  ctx.beginPath();
  ctx.moveTo(x + w - 10, y + h);
  ctx.lineTo(x + w, y + h - 10);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PAPER.ink;
  ctx.fillRect(x + w - 10, y + h - 1, 10, 1);
}

function drawButton(ctx: CanvasRenderingContext2D, win: PageWindow, button: PlacedButton): void {
  const hovered = win.hover?.kind === 'button' && win.hover.id === button.id && button.enabled;
  const lit = hovered || win.focus === `button:${button.id}`;
  if (win.model.paper) {
    frame(ctx, button, lit ? PAPER.red : PAPER.ink, PAPER.column);
    centred(ctx, button.label, button, button.enabled ? PAPER.ink : PAPER.faded);
    return;
  }
  const look = buttonLook(button, lit);
  frame(ctx, button, look.edge, look.fill);
  centred(ctx, button.label, button, look.ink);
}

/** The page over the game: a dim on the town, the heading, the panels clipped to their area, then the buttons. A `paper` page is a printed sheet instead. */
export function drawPageUi(ctx: CanvasRenderingContext2D, win: PageWindow, viewW: number, viewH: number): PageLayout {
  const layout = layoutPageUi(win.model, viewW, viewH, win.scroll);
  const paper = win.model.paper !== undefined;
  ctx.fillStyle = 'rgba(7, 8, 12, 0.7)';
  ctx.fillRect(0, 0, viewW, viewH);
  const { heading, area } = layout;
  if (paper) drawSheet(ctx, win.model, viewW, viewH);
  else {
    drawTextScaled(ctx, heading.text, heading.x, heading.y + heading.scale, BLOOD, heading.scale);
    drawTextScaled(ctx, heading.text, heading.x, heading.y, BONE, heading.scale);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x, area.y, area.w, area.h);
  ctx.clip();
  for (const panel of layout.panels) {
    if (paper) {
      // Headlines keep one size and wrap, each line centred over the column.
      panel.headLines.forEach((line, index) => {
        const width = paperWidth(line, HEAD_SIZE, HEAD_FAMILY);
        const lineX = panel.head.x + Math.floor((panel.head.w - width) / 2);
        drawPaper(ctx, line, lineX, panel.head.y + 4 + index * HEAD_LINE, PAPER.ink, HEAD_SIZE, HEAD_FAMILY);
      });
      ctx.fillStyle = PAPER.ink;
      ctx.fillRect(panel.head.x, panel.head.y + panel.head.h - 3, panel.head.w, 1);
      continue;
    }
    frame(ctx, panel.box, LINE, 'rgba(23, 24, 31, 0.92)');
    ctx.fillStyle = INK;
    ctx.fillRect(panel.head.x + 1, panel.head.y + 1, panel.head.w - 2, panel.head.h - 1);
    ctx.fillStyle = AMBER;
    ctx.fillRect(panel.head.x + 1, panel.head.y + panel.head.h - 1, panel.head.w - 2, 1);
    drawText(ctx, panel.heading.toUpperCase(), panel.head.x + 5, panel.head.y + 3, AMBER);
  }
  const tones = paper ? PAPER_TONES : TONES;
  for (const line of layout.lines) {
    if (paper) drawPaper(ctx, line.text, line.x, line.y, tones[line.tone], BODY_SIZE);
    else drawText(ctx, line.text, line.x, line.y, tones[line.tone]);
  }
  for (const stat of layout.stats) {
    if (paper) {
      drawPaper(ctx, stat.label, stat.box.x, stat.box.y, PAPER.dim, BODY_SIZE);
      const width = paperWidth(stat.value, BODY_SIZE);
      drawPaper(ctx, stat.value, stat.box.x + stat.box.w - width, stat.box.y, PAPER.ink, BODY_SIZE);
      continue;
    }
    drawText(ctx, stat.label.toUpperCase(), stat.box.x, stat.box.y, DIM);
    const value = stat.value.toUpperCase();
    drawText(ctx, value, stat.box.x + stat.box.w - textWidth(value), stat.box.y, BONE);
  }
  for (const control of layout.controls) drawControl(ctx, win, control);
  for (const picture of layout.pictures) drawPhoto(ctx, picture);
  ctx.restore();

  if (layout.scrollMax > 0) {
    const trackH = area.h;
    const thumbH = Math.max(8, Math.floor((trackH * area.h) / (area.h + layout.scrollMax)));
    const thumbY = area.y + Math.floor(((trackH - thumbH) * win.scroll) / layout.scrollMax);
    ctx.fillStyle = LINE;
    ctx.fillRect(area.x + area.w - 3, area.y, 1, trackH);
    ctx.fillStyle = AMBER;
    ctx.fillRect(area.x + area.w - 3, thumbY, 1, thumbH);
  }
  for (const button of layout.buttons) drawButton(ctx, win, button);
  return layout;
}
