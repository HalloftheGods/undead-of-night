import type { ArtBook, PixelSprite } from '../art/types.ts';
import type { CanvasHudView, Hotkey, ItemRow } from '../game/canvas-hud-view.ts';
import { drawOutlinedText, drawText, FONT_HEIGHT, textWidth } from './bitmap-font.ts';
import {
  AMBER, BLOOD, BONE, CHIP_H, DIM, GAP, GOOD, LINE_GAP, MARGIN, METER_H, PAD, centredHeight, drawCentredLines, drawHotkey, hotkeyWidth, meter, panel,
  spriteInRow,
} from './canvas-hud-parts.ts';
import type { TextLine } from './canvas-hud-parts.ts';
import {
  drawBite, drawBoss, drawBottomRight, drawDrive, drawFeed, drawKeepsakes, drawRunLog, drawSugarAndMaterials, drawTeammates, drawTreasureAndHint,
} from './canvas-hud-extras.ts';
import type { KeepsakeHit } from './canvas-hud-extras.ts';
import { drawSpriteScaled } from './sprite-cache.ts';

export type { KeepsakeHit };

const GUN_ICON_SCALE = 1;
const GUN_BOX_PAD = 2;
const GUN_ROUNDS_H = FONT_HEIGHT + 2;
const WEAPON_PIP = 4;
const PIP_GAP = 3;
const FIT_PIP = 2;
const LOW_HEALTH = 0.34;
const LINE_H = FONT_HEIGHT + LINE_GAP;
/** The street sign, in the page sign's colours. */
const SIGN_FILL = 'rgba(29, 107, 59, 0.5)';
const SIGN_RIM = 'rgba(233, 239, 230, 0.7)';
const SIGN_CROSS = '#c9e3d1';
const SIGN_RADIUS = 2;

/** Paints the run's HUD onto the game canvas, in buffer pixels. Returns the keepsake cards it drew, for clicks. */
/** While the run log is open, the rest of the HUD steps back to this brightness, as the page HUD does while looting. */
const HUD_DIMMED_ALPHA = 0.22;

export function drawCanvasHud(ctx: CanvasRenderingContext2D, view: CanvasHudView, art: ArtBook, viewW: number, viewH: number): KeepsakeHit[] {
  ctx.save();
  ctx.globalAlpha = view.logOpen ? HUD_DIMMED_ALPHA : 1;
  drawItemColumn(ctx, view, art);
  drawVitals(ctx, view, art, viewW);
  drawTopCentre(ctx, view, art, viewW, viewH);
  drawBottomCentre(ctx, view, art, viewW, viewH);
  const driveTop = drawDrive(ctx, view, viewH);
  const signBottom = view.drive ? driveTop - GAP : driveTop;
  drawStreetSign(ctx, view, MARGIN, signBottom);
  const stackTop = drawBottomRight(ctx, view, art, viewW, viewH - MARGIN);
  drawFeed(ctx, view, viewW, stackTop - GAP);
  drawBite(ctx, view, viewW, viewH);
  ctx.restore();
  drawRunLog(ctx, view, viewW, viewH);
  return drawKeepsakes(ctx, view, viewW, viewH);
}

/** The items down the left side, a row each, then sugar and materials under them. */
function drawItemColumn(ctx: CanvasRenderingContext2D, view: CanvasHudView, art: ArtBook): void {
  let y = MARGIN;
  for (const row of view.items) y = drawItemRow(ctx, row, art, MARGIN, y) + GAP;
  drawSugarAndMaterials(ctx, view, art, MARGIN, y);
}

function itemSprite(icon: ItemRow['icon'], art: ArtBook) {
  if (icon === 'medkit') return art.ui.pickupIcons.medkit;
  if (icon === 'bottle') return art.ui.bottle;
  if (icon === 'fireworks') return art.ui.fireworks;
  if (icon === 'fountain') return art.ui.fountain;
  if (icon === 'candy') return art.ui.candy;
  return art.ui.pickupIcons.knife;
}

/** One item: its hotkey (a letter, or a D-pad arrow on a pad), its picture and its count. Returns the y below it. */
function drawItemRow(ctx: CanvasRenderingContext2D, row: ItemRow, art: ArtBook, x: number, y: number): number {
  const icon = itemSprite(row.icon, art);
  const hotkeyW = row.hotkey ? hotkeyWidth(row.hotkey) + GAP : 0;
  const countW = row.text ? GAP + textWidth(row.text) : 0;
  const w = PAD + hotkeyW + icon.w + countW + PAD;
  panel(ctx, x, y, w, CHIP_H);
  let cursor = x + PAD;
  if (row.hotkey) {
    drawHotkey(ctx, row.hotkey, cursor, y, CHIP_H, AMBER);
    cursor += hotkeyW;
  }
  spriteInRow(ctx, icon, cursor, y, CHIP_H);
  cursor += icon.w;
  if (row.text) drawText(ctx, row.text, cursor + GAP, y + Math.round((CHIP_H - FONT_HEIGHT) / 2), row.dim ? DIM : BONE);
  return y + CHIP_H;
}

/** Health, kills and XP right aligned in the top right corner, the co-op link, then the teammates under them. */
function drawVitals(ctx: CanvasRenderingContext2D, view: CanvasHudView, art: ArtBook, viewW: number): void {
  const { hud } = view;
  const right = viewW - MARGIN;
  const fraction = Math.max(0, Math.min(1, hud.health / hud.maxHealth));
  const isLow = hud.health / hud.maxHealth < LOW_HEALTH;
  const healthText = String(Math.ceil(hud.health));
  const meterW = 40;
  const healthW = PAD + art.ui.heart.w + GAP + meterW + GAP + textWidth(healthText) + PAD;
  const healthX = right - healthW;
  panel(ctx, healthX, MARGIN, healthW, CHIP_H);
  spriteInRow(ctx, art.ui.heart, healthX + PAD, MARGIN, CHIP_H);
  const meterX = healthX + PAD + art.ui.heart.w + GAP;
  meter(ctx, meterX, MARGIN + Math.round((CHIP_H - 3) / 2), meterW, fraction, BLOOD);
  drawText(ctx, healthText, meterX + meterW + GAP, MARGIN + Math.round((CHIP_H - FONT_HEIGHT) / 2), isLow ? BLOOD : BONE);

  let y = MARGIN + CHIP_H + GAP;
  const killsText = String(hud.kills);
  const killsW = PAD + art.ui.zombieHead.w + GAP + textWidth(killsText) + PAD;
  panel(ctx, right - killsW, y, killsW, CHIP_H);
  spriteInRow(ctx, art.ui.zombieHead, right - killsW + PAD, y, CHIP_H);
  drawText(ctx, killsText, right - killsW + PAD + art.ui.zombieHead.w + GAP, y + Math.round((CHIP_H - FONT_HEIGHT) / 2), BONE);
  y += CHIP_H + GAP;

  const xpText = `${hud.score.toLocaleString()} XP`;
  const xpW = PAD + textWidth(xpText) + PAD;
  panel(ctx, right - xpW, y, xpW, CHIP_H);
  drawText(ctx, xpText, right - xpW + PAD, y + Math.round((CHIP_H - FONT_HEIGHT) / 2), AMBER);
  y += CHIP_H + GAP;

  if (view.mode === 'coop') {
    const linkText = view.signalWeak ? 'Signal weak' : 'Linked';
    const linkW = PAD + textWidth(linkText) + PAD;
    panel(ctx, right - linkW, y, linkW, CHIP_H);
    drawText(ctx, linkText, right - linkW + PAD, y + Math.round((CHIP_H - FONT_HEIGHT) / 2), view.signalWeak ? BLOOD : GOOD);
    y += CHIP_H + GAP;
  }
  drawTeammates(ctx, view, right, y);
}

/** The top centre: the gun box when it sits on top, else the run's night info. Then the boss and the place banner. */
function drawTopCentre(ctx: CanvasRenderingContext2D, view: CanvasHudView, art: ArtBook, viewW: number, viewH: number): void {
  const cx = Math.round(viewW / 2);
  let y = MARGIN;
  if (view.gunOnTop) {
    drawGunBlock(ctx, view, art, cx, y);
    y += gunBlockHeight(gunIcon(view, art)) + GAP;
  } else {
    y += drawCentredLines(ctx, nightLines(view), cx, y) + GAP;
  }
  drawBoss(ctx, view, cx, y);
  if (view.place) drawOutlinedText(ctx, view.place.label, cx, Math.round(viewH * 0.22), BONE);
}

/** The green street sign: a translucent green card with a rounded white rim, like the signs in the town. Bottom left, its bottom edge at `bottom`. */
function drawStreetSign(ctx: CanvasRenderingContext2D, view: CanvasHudView, x: number, bottom: number): void {
  const street = view.hud.street;
  if (!street) return;
  const road = street.road;
  const cross = street.cross;
  const w = Math.max(textWidth(road), textWidth(cross)) + PAD * 2 + 4;
  const h = LINE_H * 2 - LINE_GAP + PAD * 2 + 4;
  const y = bottom - h;
  ctx.fillStyle = SIGN_FILL;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, SIGN_RADIUS);
  ctx.fill();
  ctx.strokeStyle = SIGN_RIM;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, SIGN_RADIUS);
  ctx.stroke();
  drawText(ctx, road, x + 2 + PAD, y + 2 + PAD, SIGN_RIM);
  drawText(ctx, cross, x + 2 + PAD, y + 2 + PAD + LINE_H, street.junction ? SIGN_RIM : SIGN_CROSS);
}

/** The equipped gun's box, with its rounds (or the reload bar) inside, and the pips for the carried guns under it. */
function drawGunBlock(ctx: CanvasRenderingContext2D, view: CanvasHudView, art: ArtBook, cx: number, top: number): void {
  const active = view.slots.find((slot) => slot.active);
  const icon = gunIcon(view, art);
  const box = gunBoxSize(icon);
  const boxX = cx - Math.round(box.w / 2);
  panel(ctx, boxX, top, box.w, box.h);
  if (active) drawSpriteScaled(ctx, icon, cx - Math.round(icon.w / 2) + icon.ax, top + GUN_BOX_PAD + icon.ay, GUN_ICON_SCALE, !active.owned);
  if (view.hud.reload > 0) {
    meter(ctx, boxX + GUN_BOX_PAD, top + box.h - GUN_BOX_PAD - METER_H, box.w - GUN_BOX_PAD * 2, view.hud.reload, AMBER);
  } else {
    const rounds = `${view.hud.ammo}/${view.hud.reserve}`;
    const isLow = view.ammo === 'low';
    const lowColor = isLow ? AMBER : BONE;
    const roundsColor = view.ammo === 'empty' ? BLOOD : lowColor;
    drawText(ctx, rounds, Math.round(cx - textWidth(rounds) / 2), top + box.h - FONT_HEIGHT - 1, roundsColor);
  }
  const pipY = top + box.h + PIP_GAP;
  const pipsW = view.slots.length * WEAPON_PIP + Math.max(0, view.slots.length - 1) * 2;
  const pipX = cx - Math.round(pipsW / 2);
  view.slots.forEach((slot, index) => {
    const x = pipX + index * (WEAPON_PIP + 2);
    if (slot.active) {
      ctx.fillStyle = AMBER;
      ctx.fillRect(x, pipY, WEAPON_PIP, WEAPON_PIP);
    } else if (slot.owned) {
      ctx.fillStyle = BONE;
      ctx.fillRect(x, pipY, WEAPON_PIP, WEAPON_PIP);
    } else {
      ctx.strokeStyle = DIM;
      ctx.strokeRect(x + 0.5, pipY + 0.5, WEAPON_PIP - 1, WEAPON_PIP - 1);
    }
  });
  if (active?.keyHint) drawText(ctx, active.keyHint, pipX - textWidth(active.keyHint) - GAP, pipY - 1, DIM);
  if (active) {
    ctx.fillStyle = BONE;
    for (let rank = 0; rank < active.pips.plain; rank += 1) ctx.fillRect(pipX + pipsW + GAP + rank * (FIT_PIP + 1), pipY + 1, FIT_PIP, FIT_PIP);
  }
}

function gunIcon(view: CanvasHudView, art: ArtBook): PixelSprite {
  const active = view.slots.find((slot) => slot.active);
  return active ? art.ui.weaponIcons[active.weapon] : art.ui.weaponIcons.pistol;
}

function gunBlockHeight(icon: PixelSprite): number {
  return gunBoxSize(icon).h + PIP_GAP + WEAPON_PIP;
}

/** The item box hugs the gun in hand at the box's icon scale: its picture, a pad round it, and the rounds beneath. */
function gunBoxSize(icon: PixelSprite): { readonly w: number; readonly h: number } {
  return { w: icon.w * GUN_ICON_SCALE + GUN_BOX_PAD * 2, h: icon.h * GUN_ICON_SCALE + GUN_BOX_PAD * 2 + GUN_ROUNDS_H };
}

/**
 * The bottom centre, all informative when the gun sits on top: the night info at the bottom edge, then the prompt above it,
 * then the treasure and hint. With the gun at the bottom, the gun box takes the bottom edge and the prompt sits above it.
 */
function drawBottomCentre(ctx: CanvasRenderingContext2D, view: CanvasHudView, art: ArtBook, viewW: number, viewH: number): void {
  const cx = Math.round(viewW / 2);
  let promptY: number;
  if (view.gunOnTop) {
    const nightTop = viewH - MARGIN - centredHeight(nightLines(view).length);
    drawCentredLines(ctx, nightLines(view), viewW / 2, nightTop);
    promptY = nightTop - GAP - CHIP_H;
  } else {
    const blockTop = viewH - MARGIN - gunBlockHeight(gunIcon(view, art));
    drawGunBlock(ctx, view, art, cx, blockTop);
    promptY = blockTop - GAP - CHIP_H;
  }
  drawPrompt(ctx, view, viewW, promptY);
  drawTreasureAndHint(ctx, view, viewW, promptY - GAP);
}

function nightLines(view: CanvasHudView): TextLine[] {
  const lines: TextLine[] = [
    { text: view.levelText, color: DIM },
    { text: view.horde.title, color: view.horde.loud ? BLOOD : DIM },
  ];
  if (view.horde.detail) lines.push({ text: view.horde.detail, color: BLOOD });
  lines.push({ text: view.goal, color: view.hud.exitOpen ? AMBER : DIM });
  if (view.sidequest) lines.push({ text: view.sidequest, color: DIM });
  if (view.effectLabel) lines.push({ text: view.effectLabel, color: AMBER });
  return lines;
}

type Segment = { readonly text: string; readonly color: string } | { readonly hotkey: Hotkey; readonly color: string };

function segmentWidth(segment: Segment): number {
  return 'hotkey' in segment ? hotkeyWidth(segment.hotkey) : textWidth(segment.text);
}

/** What the player is told to press: out of ammo, or a swap or reload key. Nothing when there is nothing to say. */
function drawPrompt(ctx: CanvasRenderingContext2D, view: CanvasHudView, viewW: number, y: number): void {
  const segments = promptSegments(view);
  if (segments.length === 0) return;
  const w = segments.reduce((sum, segment) => sum + segmentWidth(segment), 0) + PAD * 2;
  const x = Math.round(viewW / 2 - w / 2);
  panel(ctx, x, y, w, CHIP_H);
  let cursor = x + PAD;
  for (const segment of segments) {
    const textY = y + Math.round((CHIP_H - FONT_HEIGHT) / 2);
    if ('hotkey' in segment) drawHotkey(ctx, segment.hotkey, cursor, y, CHIP_H, segment.color);
    else drawText(ctx, segment.text, cursor, textY, segment.color);
    cursor += segmentWidth(segment);
  }
}

function promptSegments(view: CanvasHudView): Segment[] {
  if (view.empty) {
    const shove = view.shoveKey ? `${view.shoveKey}: ${view.shoveLabel}` : view.shoveLabel;
    return [{ text: 'Empty  ', color: BLOOD }, { text: shove, color: DIM }];
  }
  if (view.swapPrompt) return [{ text: 'Press ', color: BLOOD }, { hotkey: view.swapPrompt, color: AMBER }];
  if (view.reloadPromptKey) return [{ text: 'Press ', color: BLOOD }, { hotkey: view.reloadPromptKey, color: AMBER }];
  return [];
}
