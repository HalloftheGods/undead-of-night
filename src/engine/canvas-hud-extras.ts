import type { ArtBook } from '../art/types.ts';
import type { CanvasHudView, KeepsakeRow, MoodleRow } from '../game/canvas-hud-view.ts';
import { drawText, FONT_HEIGHT, textWidth } from './bitmap-font.ts';
import {
  AMBER, BLOOD, BONE, CHIP_H, DIM, GAP, GOOD, LINE_GAP, MARGIN, PAD, centredHeight, cssColor, drawCentredLines, drawHotkey, hotkeyWidth, logToneColor, meter, panel, spriteInRow, wrapText,
} from './canvas-hud-parts.ts';
import type { TextLine } from './canvas-hud-parts.ts';
import type { PixelSprite } from '../art/types.ts';

const LINE_H = FONT_HEIGHT + LINE_GAP;
const METER_W = 36;
const SEVERITY_COLOR: Readonly<Record<string, string>> = { critical: BLOOD, high: BLOOD, medium: AMBER, low: BONE };
const CARD_MAX_W = 96;
const CARD_BLURB_LINES = 4;

/** Sugar and carried materials, under the item column. Returns the y below them. */
export function drawSugarAndMaterials(ctx: CanvasRenderingContext2D, view: CanvasHudView, art: ArtBook, x: number, y: number): number {
  let cursor = y;
  for (const sugar of view.sugar) {
    const text = `${sugar.name} ${sugar.left}`;
    const w = PAD + textWidth(text) + PAD;
    panel(ctx, x, cursor, w, CHIP_H);
    drawText(ctx, text, x + PAD, cursor + Math.round((CHIP_H - FONT_HEIGHT) / 2), AMBER);
    cursor += CHIP_H + GAP;
  }
  for (const chip of view.materials) {
    const icon = art.ui.pickupIcons[chip.type];
    const countW = chip.count === null ? 0 : textWidth(chip.count);
    const w = PAD + icon.w + (chip.count === null ? 0 : GAP + countW) + PAD;
    panel(ctx, x, cursor, w, CHIP_H);
    spriteInRow(ctx, icon, x + PAD, cursor, CHIP_H);
    if (chip.count !== null) drawText(ctx, chip.count, x + PAD + icon.w + GAP, cursor + Math.round((CHIP_H - FONT_HEIGHT) / 2), BONE);
    cursor += CHIP_H + GAP;
  }
  return cursor;
}

/** Teammates, top right under the run numbers: name, survivor, and their health or status. Returns the y below them. */
export function drawTeammates(ctx: CanvasRenderingContext2D, view: CanvasHudView, right: number, y: number): number {
  let cursor = y;
  for (const mate of view.teammates) {
    const status = mate.alive ? '' : mate.status;
    const tailW = mate.alive ? METER_W : textWidth(status);
    const w = PAD + textWidth(mate.name) + GAP + textWidth(mate.character) + GAP + tailW + PAD;
    const x = right - w;
    panel(ctx, x, cursor, w, CHIP_H);
    const textY = cursor + Math.round((CHIP_H - FONT_HEIGHT) / 2);
    drawText(ctx, mate.name, x + PAD, textY, mate.color);
    drawText(ctx, mate.character, x + PAD + textWidth(mate.name) + GAP, textY, DIM);
    const tailX = x + w - PAD - tailW;
    if (mate.alive) meter(ctx, tailX, cursor + Math.round((CHIP_H - 3) / 2), METER_W, mate.fraction, BLOOD);
    else drawText(ctx, status, tailX, textY, BLOOD);
    cursor += CHIP_H + GAP;
  }
  return cursor;
}

/** The town's boss, under the street sign: its name and what health it has left. Returns the y below it. */
export function drawBoss(ctx: CanvasRenderingContext2D, view: CanvasHudView, cx: number, y: number): number {
  if (!view.boss) return y;
  const w = Math.max(120, textWidth(view.boss.name) + PAD * 2);
  const x = Math.round(cx - w / 2);
  panel(ctx, x, y, w, CHIP_H + 5);
  drawText(ctx, view.boss.name, x + PAD, y + 2, BLOOD);
  meter(ctx, x + PAD, y + CHIP_H + 1, w - PAD * 2, view.boss.fraction, BLOOD);
  return y + CHIP_H + 5 + GAP;
}

/** Moodles and the Nightly quests, stacked up the bottom right. */
export function drawBottomRight(ctx: CanvasRenderingContext2D, view: CanvasHudView, art: ArtBook, viewW: number, bottomEdge: number): number {
  let bottom = bottomEdge;
  const right = viewW - MARGIN;
  if (view.quests) {
    const lines: TextLine[] = [{ text: view.quests.summary, color: DIM }];
    for (const line of view.quests.lines) {
      const color = line.atRisk ? BLOOD : line.ready ? GOOD : BONE;
      lines.push({ text: `${line.title} ${line.value}`, color });
    }
    if (view.quests.warning) lines.push({ text: view.quests.warning, color: BLOOD });
    bottom -= drawRightLines(ctx, lines, right, bottom);
    bottom -= GAP;
  }
  for (const moodle of [...view.moodles].reverse()) {
    bottom -= drawMoodle(ctx, moodle, art, right, bottom);
    bottom -= GAP;
  }
  return bottom;
}

/** A moodle as two rows: its name and percentage, then the remedy with its key. Returns its height. */
function drawMoodle(ctx: CanvasRenderingContext2D, moodle: MoodleRow, art: ArtBook, right: number, bottom: number): number {
  const moodleIcons = art.ui.moodles as Readonly<Record<string, PixelSprite | undefined>> | undefined;
  const icon = moodleIcons?.[moodle.id];
  const head = [moodle.label, moodle.percentText].filter((part) => part !== null).join('  ');
  const remedyW = textWidth(moodle.remedy) + (moodle.hotkey ? GAP + hotkeyWidth(moodle.hotkey) : 0);
  const iconW = icon ? icon.w + GAP : 0;
  const w = PAD + iconW + Math.max(textWidth(head), remedyW) + PAD;
  const h = LINE_H * 2 + PAD * 2 - LINE_GAP;
  const x = right - w;
  const y = bottom - h;
  panel(ctx, x, y, w, h);
  if (icon) spriteInRow(ctx, icon, x + PAD, y, h);
  const textX = x + PAD + iconW;
  const color = SEVERITY_COLOR[moodle.severity] ?? BONE;
  drawText(ctx, head, textX, y + PAD, color);
  const remedyY = y + PAD + LINE_H;
  let cursor = textX;
  drawText(ctx, moodle.remedy, cursor, remedyY, DIM);
  cursor += textWidth(moodle.remedy);
  if (moodle.hotkey) {
    cursor += GAP;
    drawHotkey(ctx, moodle.hotkey, cursor, remedyY - 1, FONT_HEIGHT + 2, AMBER);
  }
  return h;
}

/** Right-aligned lines in one panel, bottom at `bottom`. Returns the panel's height. */
function drawRightLines(ctx: CanvasRenderingContext2D, lines: readonly TextLine[], right: number, bottom: number): number {
  const w = Math.max(...lines.map((line) => textWidth(line.text))) + PAD * 2;
  const h = lines.length * LINE_H - LINE_GAP + PAD * 2;
  const x = right - w;
  const y = bottom - h;
  panel(ctx, x, y, w, h);
  lines.forEach((line, index) => drawText(ctx, line.text, x + PAD, y + PAD + index * LINE_H, line.color));
  return h;
}

/** The drive readout, bottom left, on a Test Drive seat. */
export function drawDrive(ctx: CanvasRenderingContext2D, view: CanvasHudView, viewH: number): number {
  if (!view.drive) return viewH - MARGIN;
  const lines: TextLine[] = [
    { text: `SPEED ${view.drive.speed}`, color: BONE },
    { text: `HEADING ${view.drive.heading}`, color: BONE },
    { text: `BODY ${view.drive.body}`, color: BONE },
    { text: `LAST CRASH ${view.drive.crash}`, color: DIM },
  ];
  const w = Math.max(...lines.map((line) => textWidth(line.text))) + PAD * 2;
  const h = lines.length * LINE_H - LINE_GAP + PAD * 2;
  const y = viewH - MARGIN - h;
  panel(ctx, MARGIN, y, w, h);
  lines.forEach((line, index) => drawText(ctx, line.text, MARGIN + PAD, y + PAD + index * LINE_H, line.color));
  return y;
}

const FEED_MAX_LINES = 6;
/** The full run log's share of the view's width. */
export const RUN_LOG_WIDTH = 0.33;
/** The page log's fade: the newest line full, then each older line a step dimmer. */
const FEED_AGE_ALPHA = [1, 0.85, 0.7, 0.55, 0.4] as const;

interface FeedLine {
  readonly text: string;
  readonly color: string;
  readonly alpha: number;
}

/** The run log, bottom right: wrapped to a third of the view, newest brightest, faded after a few seconds, with the L hint. Returns its top edge. */
export function drawFeed(ctx: CanvasRenderingContext2D, view: CanvasHudView, viewW: number, bottomEdge: number): number {
  const bottom = bottomEdge;
  if (view.logOpen || view.feed.length === 0 || view.feedAlpha <= 0) return bottom;
  const right = viewW - MARGIN;
  const maxW = Math.max(LINE_H * 10, Math.round(viewW * 0.34));
  const innerW = maxW - PAD * 2;
  const rows: FeedLine[] = view.feed
    .flatMap((row) => {
      const count = row.count > 1 ? ` X${row.count}` : '';
      const color = logToneColor(row.tone);
      const alpha = FEED_AGE_ALPHA[Math.min(row.age, FEED_AGE_ALPHA.length - 1)];
      return wrapText(`${row.at} ${row.text}${count}`, innerW).map((text) => ({ text, color, alpha }));
    })
    .slice(-FEED_MAX_LINES);
  const hintW = view.logKey ? hotkeyWidth(view.logKey) + GAP + textWidth('LOG') : 0;
  const widest = Math.max(hintW, ...rows.map((line) => textWidth(line.text)));
  const w = Math.min(maxW, widest + PAD * 2);
  const lineCount = rows.length + (view.logKey ? 1 : 0);
  const h = lineCount * LINE_H - LINE_GAP + PAD * 2;
  const x = right - w;
  const y = bottom - h;
  ctx.save();
  ctx.globalAlpha = view.feedAlpha;
  panel(ctx, x, y, w, h);
  rows.forEach((line, index) => {
    ctx.globalAlpha = view.feedAlpha * line.alpha;
    drawText(ctx, line.text, x + PAD, y + PAD + index * LINE_H, line.color);
  });
  ctx.globalAlpha = view.feedAlpha;
  if (view.logKey) {
    const hintY = y + PAD + rows.length * LINE_H;
    const keyW = drawHotkey(ctx, view.logKey, x + PAD, hintY, LINE_H, AMBER);
    drawText(ctx, 'LOG', x + PAD + keyW + GAP, hintY + Math.round((LINE_H - FONT_HEIGHT) / 2), DIM);
  }
  ctx.restore();
  return y;
}

/** The treasure carried on a trip, then the first-run hint, stacked above `bottom`. Returns the top edge. */
export function drawTreasureAndHint(ctx: CanvasRenderingContext2D, view: CanvasHudView, viewW: number, bottom: number): number {
  let cursor = bottom;
  if (view.treasure) {
    const lines: TextLine[] = [{ text: view.treasure.worth, color: AMBER }];
    if (view.treasure.counts.length > 0) lines.push({ text: view.treasure.counts.join('  '), color: BONE });
    cursor -= drawCentredLines(ctx, lines, viewW / 2, cursor - centredHeight(lines.length)) + GAP;
  }
  if (view.hint) {
    const lines = wrapText(view.hint, Math.round(viewW * 0.6)).map((text) => ({ text, color: BONE }));
    cursor -= drawCentredLines(ctx, lines, viewW / 2, cursor - centredHeight(lines.length)) + GAP;
  }
  return cursor;
}

/** A short red mark on the screen edge in the direction of a bite from behind. */
export function drawBite(ctx: CanvasRenderingContext2D, view: CanvasHudView, viewW: number, viewH: number): void {
  if (!view.bite) return;
  const cx = viewW / 2;
  const cy = viewH / 2;
  const x = cx + Math.cos(view.bite.angle) * (cx - 2);
  const y = cy + Math.sin(view.bite.angle) * (cy - 2);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(view.bite.angle);
  ctx.fillStyle = BLOOD;
  ctx.fillRect(-5, -1, 10, 3);
  ctx.restore();
}

export interface KeepsakeHit {
  readonly id: KeepsakeRow['id'];
  readonly code: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The keepsake offer, centred over the run: three cards that a click or their key takes. Returns each card's box. */
export function drawKeepsakes(ctx: CanvasRenderingContext2D, view: CanvasHudView, viewW: number, viewH: number): KeepsakeHit[] {
  if (view.keepsakes.length === 0) return [];
  const cards = view.keepsakes;
  const cardW = Math.min(CARD_MAX_W, Math.floor((viewW - MARGIN * 2 - GAP * (cards.length - 1)) / cards.length));
  const inner = cardW - PAD * 2;
  const blurbs = cards.map((card) => wrapText(card.blurb, inner).slice(0, CARD_BLURB_LINES));
  const blurbH = Math.max(...blurbs.map((lines) => lines.length)) * LINE_H;
  const cardH = PAD + LINE_H + LINE_GAP + LINE_H + LINE_GAP + blurbH + PAD;
  const headerH = LINE_H * 2 + PAD * 2;
  const totalH = headerH + GAP + cardH;
  const top = Math.round(viewH / 2 - totalH / 2);
  const headerW = Math.max(textWidth('CHOOSE A KEEPSAKE'), textWidth('YOURS FOR THE REST OF THE RUN.')) + PAD * 2;
  panel(ctx, Math.round(viewW / 2 - headerW / 2), top, headerW, headerH);
  drawText(ctx, 'CHOOSE A KEEPSAKE', Math.round(viewW / 2 - textWidth('CHOOSE A KEEPSAKE') / 2), top + PAD, BONE);
  drawText(ctx, 'YOURS FOR THE REST OF THE RUN.', Math.round(viewW / 2 - textWidth('YOURS FOR THE REST OF THE RUN.') / 2), top + PAD + LINE_H, DIM);
  const rowW = cards.length * cardW + (cards.length - 1) * GAP;
  const startX = Math.round(viewW / 2 - rowW / 2);
  const cardY = top + headerH + GAP;
  return cards.map((card, index) => {
    const x = startX + index * (cardW + GAP);
    panel(ctx, x, cardY, cardW, cardH);
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, cardY + 0.5, cardW - 1, cardH - 1);
    const keyY = cardY + PAD;
    const nameY = keyY + LINE_H + LINE_GAP;
    const blurbY = nameY + LINE_H + LINE_GAP;
    if (card.keyLabel) drawText(ctx, card.keyLabel, x + PAD, keyY, AMBER);
    drawText(ctx, card.name, x + PAD, nameY, BONE);
    blurbs[index].forEach((line, lineIndex) => drawText(ctx, line, x + PAD, blurbY + lineIndex * LINE_H, DIM));
    return { id: card.id, code: card.code, x, y: cardY, w: cardW, h: cardH };
  });
}


/** The full run log, opened with L: the newest lines at the bottom of a panel on the right, with their details. */
export function drawRunLog(ctx: CanvasRenderingContext2D, view: CanvasHudView, viewW: number, viewH: number): void {
  if (!view.logOpen) return;
  const w = Math.round(viewW * RUN_LOG_WIDTH);
  const x = viewW - MARGIN - w;
  const top = Math.round(viewH * 0.2);
  const bottom = viewH - MARGIN;
  const innerW = w - PAD * 2;
  const headerH = LINE_H + LINE_GAP;
  const lines: TextLine[] = view.runLog.flatMap((row) => {
    const count = row.count > 1 ? ` X${row.count}` : '';
    const head = wrapText(`${row.at} ${row.text}${count}`, innerW).map((text) => ({ text, color: logToneColor(row.tone) }));
    const detail = row.detail ? wrapText(row.detail, innerW).map((text) => ({ text, color: cssColor('--bone-dim') })) : [];
    return [...head, ...detail];
  });
  const fitting = Math.max(0, Math.floor((bottom - top - PAD * 2 - headerH) / LINE_H));
  const shown = fitting === 0 ? [] : lines.slice(-fitting);
  const h = headerH + shown.length * LINE_H - LINE_GAP + PAD * 2;
  const y = bottom - h;
  panel(ctx, x, y, w, h);
  drawText(ctx, 'RUN LOG', x + PAD, y + PAD, AMBER);
  if (view.logKey) {
    const hint = 'CLOSE';
    const keyW = hotkeyWidth(view.logKey);
    const hintX = x + w - PAD - keyW - GAP - textWidth(hint);
    drawHotkey(ctx, view.logKey, hintX - keyW - GAP, y + PAD, LINE_H, AMBER);
    drawText(ctx, hint, hintX, y + PAD, DIM);
  }
  shown.forEach((line, index) => drawText(ctx, line.text, x + PAD, y + PAD + headerH + index * LINE_H, line.color));
}
