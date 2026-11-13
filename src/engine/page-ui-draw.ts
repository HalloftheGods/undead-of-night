import { drawText, FONT_HEIGHT, textWidth } from './bitmap-font.ts';
import { layoutPageUi } from './page-ui.ts';
import type { PageLayout, PlacedButton, PlacedControl, Tone } from './page-ui.ts';
import { drawTextScaled } from './setup-text.ts';
import type { Box } from './setup-ui.ts';
import type { PageWindow } from '../game/page-view.ts';

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

function drawControl(ctx: CanvasRenderingContext2D, win: PageWindow, control: PlacedControl): void {
  const { item, box } = control;
  const lit = isLit(win, control.id);
  const labelY = box.y + (item.kind === 'switch' || item.kind === 'link' ? Math.floor((box.h - FONT_HEIGHT) / 2) : 0);
  if (item.kind === 'link') {
    if (lit) frame(ctx, box, AMBER, RAISED);
    drawText(ctx, item.label.toUpperCase(), box.x + 4, labelY, lit ? BONE : AMBER);
    return;
  }
  drawText(ctx, item.label.toUpperCase(), box.x + (item.kind === 'switch' ? 0 : 0), labelY, lit ? AMBER : DIM);
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

function drawButton(ctx: CanvasRenderingContext2D, win: PageWindow, button: PlacedButton): void {
  const hovered = win.hover?.kind === 'button' && win.hover.id === button.id && button.enabled;
  const lit = hovered || win.focus === `button:${button.id}`;
  const look = buttonLook(button, lit);
  frame(ctx, button, look.edge, look.fill);
  centred(ctx, button.label, button, look.ink);
}

/** The page over the game: a dim on the town, the heading, the panels clipped to their area, then the buttons. */
export function drawPageUi(ctx: CanvasRenderingContext2D, win: PageWindow, viewW: number, viewH: number): PageLayout {
  const layout = layoutPageUi(win.model, viewW, viewH, win.scroll);
  ctx.fillStyle = 'rgba(7, 8, 12, 0.7)';
  ctx.fillRect(0, 0, viewW, viewH);
  const { heading, area } = layout;
  drawTextScaled(ctx, heading.text, heading.x, heading.y + heading.scale, BLOOD, heading.scale);
  drawTextScaled(ctx, heading.text, heading.x, heading.y, BONE, heading.scale);

  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x, area.y, area.w, area.h);
  ctx.clip();
  for (const panel of layout.panels) {
    frame(ctx, panel.box, LINE, 'rgba(23, 24, 31, 0.92)');
    ctx.fillStyle = INK;
    ctx.fillRect(panel.head.x + 1, panel.head.y + 1, panel.head.w - 2, panel.head.h - 1);
    ctx.fillStyle = AMBER;
    ctx.fillRect(panel.head.x + 1, panel.head.y + panel.head.h - 1, panel.head.w - 2, 1);
    drawText(ctx, panel.heading.toUpperCase(), panel.head.x + 5, panel.head.y + 3, AMBER);
  }
  for (const line of layout.lines) drawText(ctx, line.text, line.x, line.y, TONES[line.tone]);
  for (const stat of layout.stats) {
    drawText(ctx, stat.label.toUpperCase(), stat.box.x, stat.box.y, DIM);
    const value = stat.value.toUpperCase();
    drawText(ctx, value, stat.box.x + stat.box.w - textWidth(value), stat.box.y, BONE);
  }
  for (const control of layout.controls) drawControl(ctx, win, control);
  ctx.restore();

  if (layout.scrollMax > 0) {
    const trackH = area.h;
    const thumbH = Math.max(8, Math.floor((trackH * area.h) / (area.h + layout.scrollMax)));
    const thumbY = area.y + Math.floor(((trackH - thumbH) * win.scroll) / layout.scrollMax);
    ctx.fillStyle = LINE;
    ctx.fillRect(viewW - 3, area.y, 1, trackH);
    ctx.fillStyle = AMBER;
    ctx.fillRect(viewW - 3, thumbY, 1, thumbH);
  }
  for (const button of layout.buttons) drawButton(ctx, win, button);
  return layout;
}
