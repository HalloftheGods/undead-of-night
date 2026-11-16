import { drawText, textWidth } from './bitmap-font.ts';
import type { Box } from './setup-ui.ts';
import type { PlacedControl, RadioItem } from './page-ui.ts';
import type { PageWindow } from '../game/page-view.ts';
import { formatTrackTime } from '../game/radio-player.ts';

const INK = '#0b0c10';
const RAISED = '#17181f';
const LINE = '#33343c';
const BONE = '#e4dcc3';
const DIM = '#938d7a';
const BLOOD = '#e0463a';
const AMBER = '#e8a33d';
const SICK = '#8fbf3a';
const CHASSIS_BG = '#1a1b24';
const CHASSIS_TOP = '#484b5c';
const CHASSIS_BOT = '#0e0f14';
const TAPE_BROWN = '#3d2b1f';

function frame(ctx: CanvasRenderingContext2D, box: Box, edge: string, fill: string): void {
  ctx.fillStyle = edge;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.fillStyle = fill;
  ctx.fillRect(box.x + 1, box.y + 1, box.w - 2, box.h - 2);
}

function beveledBox(
  ctx: CanvasRenderingContext2D,
  box: Box,
  topEdge: string,
  botEdge: string,
  fill: string,
): void {
  ctx.fillStyle = fill;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.fillStyle = topEdge;
  ctx.fillRect(box.x, box.y, box.w, 1);
  ctx.fillRect(box.x, box.y, 1, box.h);
  ctx.fillStyle = botEdge;
  ctx.fillRect(box.x, box.y + box.h - 1, box.w, 1);
  ctx.fillRect(box.x + box.w - 1, box.y, 1, box.h);
}

function drawHandleAndAntenna(ctx: CanvasRenderingContext2D, box: Box, chassis: Box): void {
  // Angled telescoping antenna with tip bead
  const antX = chassis.x + 6;
  ctx.fillStyle = DIM;
  ctx.fillRect(antX, box.y + 2, 2, chassis.y - (box.y + 2));
  ctx.fillStyle = BONE;
  ctx.fillRect(antX - 1, box.y, 4, 2);

  // Sturdy metallic handle
  const handleX = chassis.x + 16;
  const handleW = chassis.w - 32;
  ctx.fillStyle = LINE;
  ctx.fillRect(handleX, box.y + 3, 3, 4);
  ctx.fillRect(handleX + handleW - 3, box.y + 3, 3, 4);
  ctx.fillStyle = CHASSIS_TOP;
  ctx.fillRect(handleX, box.y + 2, handleW, 2);
  ctx.fillStyle = LINE;
  ctx.fillRect(handleX, box.y + 3, handleW, 1);
}

function drawLeftSpeaker(ctx: CanvasRenderingContext2D, speakerBox: Box, isPlaying: boolean): void {
  frame(ctx, speakerBox, '#252733', '#0e0f14');
  const cx = speakerBox.x + Math.floor(speakerBox.w / 2);
  const cy = speakerBox.y + Math.floor(speakerBox.h / 2);
  const maxRadius = Math.floor(Math.min(speakerBox.w, speakerBox.h) / 2) - 3;
  const pulse = isPlaying ? Math.sin(Date.now() / 140) * 1.5 : 0;
  const coneRadius = Math.max(6, maxRadius + Math.round(pulse));

  // Speaker cone outer ring
  ctx.fillStyle = '#151720';
  ctx.beginPath();
  ctx.arc(cx, cy, coneRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2a2d3c';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Mesh grille dots
  ctx.fillStyle = '#222533';
  for (let gy = speakerBox.y + 3; gy < speakerBox.y + speakerBox.h - 3; gy += 3) {
    for (let gx = speakerBox.x + 3; gx < speakerBox.x + speakerBox.w - 3; gx += 3) {
      const dx = gx - cx;
      const dy = gy - cy;
      const insideCone = dx * dx + dy * dy < maxRadius * maxRadius;
      if (insideCone) ctx.fillRect(gx, gy, 1, 1);
    }
  }

  // Dust cap center
  ctx.fillStyle = '#262835';
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#484b5c';
  ctx.fillRect(cx - 1, cy - 1, 2, 2);
}

function drawRightSpeaker(ctx: CanvasRenderingContext2D, grilleBox: Box): void {
  frame(ctx, grilleBox, '#252733', '#0e0f14');
  const cx = grilleBox.x + Math.floor(grilleBox.w / 2);
  const cy = grilleBox.y + Math.floor(grilleBox.h / 2);
  const maxRadius = Math.floor(Math.min(grilleBox.w, grilleBox.h) / 2) - 2;

  ctx.fillStyle = '#151720';
  ctx.beginPath();
  ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2a2d3c';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Grille dots
  ctx.fillStyle = '#222533';
  for (let gy = grilleBox.y + 3; gy < grilleBox.y + grilleBox.h - 3; gy += 3) {
    for (let gx = grilleBox.x + 3; gx < grilleBox.x + grilleBox.w - 3; gx += 3) {
      const dx = gx - cx;
      const dy = gy - cy;
      const insideCone = dx * dx + dy * dy < maxRadius * maxRadius;
      if (insideCone) ctx.fillRect(gx, gy, 1, 1);
    }
  }

  ctx.fillStyle = '#262835';
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

/** Returns the value for the first true flag, otherwise the fallback. */
function pickFirst<T>(
  firstFlag: boolean,
  firstValue: T,
  secondFlag: boolean,
  secondValue: T,
  fallback: T,
): T {
  if (firstFlag) return firstValue;
  if (secondFlag) return secondValue;
  return fallback;
}

function repeatLabel(repeatMode: string): string {
  if (repeatMode === 'one') return 'RP1';
  if (repeatMode === 'all') return 'RPA';
  return 'RPT';
}

function radioSubtitle(item: RadioItem): string {
  const track = item.track;
  if (!track) return 'RADIO';
  if (track.find) return 'RADIO FIND';
  return track.where.toUpperCase();
}

function transportGlyphColor(flags: {
  isPlayingPlayBtn: boolean;
  isHovered: boolean;
  isStoppedStopBtn: boolean;
  isPlayBtn: boolean;
  isStopBtn: boolean;
}): string {
  if (flags.isPlayingPlayBtn) return AMBER;
  if (flags.isHovered) return BONE;
  if (flags.isStoppedStopBtn) return DIM;
  if (flags.isPlayBtn) return SICK;
  if (flags.isStopBtn) return BLOOD;
  return BONE;
}

function drawSideButtons(
  ctx: CanvasRenderingContext2D,
  sideParts: readonly Box[],
  item: RadioItem,
  win: PageWindow,
  controlId: string,
): void {
  const isHovered = (partIndex: number): boolean =>
    win.hover?.kind === 'control' && win.hover.id === controlId && win.hover.part === partIndex;

  // 6: Shuffle
  const shufBox = sideParts[0];
  if (shufBox) {
    const hovered = isHovered(6);
    const active = item.isShuffle;
    beveledBox(
      ctx,
      shufBox,
      pickFirst(hovered, BONE, active, AMBER, '#3b3e4e'),
      pickFirst(hovered, AMBER, active, '#2a2b36', INK),
      pickFirst(active, '#252835', hovered, '#222430', RAISED),
    );
    drawText(ctx, 'SHF', shufBox.x + 2, shufBox.y + 2, pickFirst(active, AMBER, hovered, BONE, DIM));
    // LED pip
    ctx.fillStyle = active ? SICK : '#1e2418';
    ctx.fillRect(shufBox.x + shufBox.w - 4, shufBox.y + 3, 2, 4);
  }

  // 7: Repeat
  const rptBox = sideParts[1];
  if (rptBox) {
    const hovered = isHovered(7);
    const active = item.repeatMode !== 'off';
    beveledBox(
      ctx,
      rptBox,
      pickFirst(hovered, BONE, active, AMBER, '#3b3e4e'),
      pickFirst(hovered, AMBER, active, '#2a2b36', INK),
      pickFirst(active, '#252835', hovered, '#222430', RAISED),
    );
    const label = repeatLabel(item.repeatMode);
    drawText(ctx, label, rptBox.x + 2, rptBox.y + 2, pickFirst(active, AMBER, hovered, BONE, DIM));
    ctx.fillStyle = active ? AMBER : '#2b2318';
    ctx.fillRect(rptBox.x + rptBox.w - 4, rptBox.y + 3, 2, 4);
  }

  // 8: Favorite
  const favBox = sideParts[2];
  if (favBox) {
    const hovered = isHovered(8);
    const active = item.isFavorite;
    beveledBox(
      ctx,
      favBox,
      pickFirst(hovered, BONE, active, BLOOD, '#3b3e4e'),
      pickFirst(hovered, BLOOD, active, '#2a1a1a', INK),
      pickFirst(active, '#2b1a1c', hovered, '#241a1c', RAISED),
    );
    drawText(ctx, 'FAV', favBox.x + 2, favBox.y + 2, pickFirst(active, BLOOD, hovered, BONE, DIM));
    ctx.fillStyle = active ? BLOOD : '#2b1414';
    ctx.fillRect(favBox.x + favBox.w - 4, favBox.y + 3, 2, 4);
  }
}

function drawTuner(
  ctx: CanvasRenderingContext2D,
  tunerBox: Box,
  track: Box,
  item: RadioItem,
  isGlassHovered: boolean,
): void {
  // Tuner header text
  drawText(ctx, 'FM TUNER', tunerBox.x + 2, tunerBox.y + 1, DIM);

  const isRunning = item.isPlaying && !item.isPaused;
  const ledX = tunerBox.x + 48;
  ctx.fillStyle = isRunning ? SICK : '#1b2416';
  ctx.fillRect(ledX, tunerBox.y + 2, 3, 3);
  drawText(ctx, isRunning ? 'STEREO' : 'IDLE', ledX + 5, tunerBox.y + 1, isRunning ? SICK : DIM);

  // Time readout right-aligned
  const timeStr = `${formatTrackTime(item.currentTime)} / ${formatTrackTime(item.duration)}`;
  const timeW = textWidth(timeStr);
  drawText(ctx, timeStr, tunerBox.x + tunerBox.w - timeW, tunerBox.y + 1, AMBER);

  // Tuner glass
  frame(ctx, track, isGlassHovered ? AMBER : '#282b38', '#0c0e14');

  // Scale frequency marks & tick marks
  const tickCount = 11;
  const tickStep = (track.w - 4) / (tickCount - 1);
  ctx.fillStyle = '#3a4052';
  for (let i = 0; i < tickCount; i++) {
    const tx = track.x + 2 + Math.round(i * tickStep);
    const isMajor = i % 2 === 0;
    const tickH = isMajor ? 4 : 2;
    ctx.fillRect(tx, track.y + track.h - tickH - 1, 1, tickH);
  }

  // Red tuning needle
  const ratio = Math.min(1, Math.max(0, item.position));
  const needleX = track.x + 2 + Math.round((track.w - 5) * ratio);
  ctx.fillStyle = BLOOD;
  ctx.fillRect(needleX, track.y + 1, 1, track.h - 2);
  ctx.fillStyle = '#ff756b';
  ctx.fillRect(needleX - 1, track.y + 1, 3, 1);
  ctx.fillRect(needleX - 1, track.y + track.h - 2, 3, 1);
}

function drawCassetteBay(ctx: CanvasRenderingContext2D, bayBox: Box, item: RadioItem): void {
  frame(ctx, bayBox, '#282b38', '#0d0e14');

  // LCD Readout strip across top of bay
  const lcdBox: Box = { x: bayBox.x + 2, y: bayBox.y + 2, w: bayBox.w - 4, h: 9 };
  frame(ctx, lcdBox, '#1b221b', '#111611');

  const title = item.track ? item.track.name.toUpperCase() : 'NO CASSETTE LOADED';
  drawText(ctx, title, lcdBox.x + 3, lcdBox.y + 2, '#ffb830');

  const sub = radioSubtitle(item);
  const subW = textWidth(sub);
  if (lcdBox.w - subW > textWidth(title) + 12) {
    drawText(ctx, sub, lcdBox.x + lcdBox.w - subW - 3, lcdBox.y + 2, '#9c7324');
  }

  // Tape window area
  const winBox: Box = { x: bayBox.x + 4, y: bayBox.y + 13, w: bayBox.w - 8, h: bayBox.h - 16 };
  frame(ctx, winBox, '#1c1e28', '#08090d');

  // 4 corner screw rivets
  ctx.fillStyle = '#44485c';
  ctx.fillRect(winBox.x + 2, winBox.y + 2, 1, 1);
  ctx.fillRect(winBox.x + winBox.w - 3, winBox.y + 2, 1, 1);
  ctx.fillRect(winBox.x + 2, winBox.y + winBox.h - 3, 1, 1);
  ctx.fillRect(winBox.x + winBox.w - 3, winBox.y + winBox.h - 3, 1, 1);

  // Cassette label band
  ctx.fillStyle = '#181b24';
  ctx.fillRect(winBox.x + 5, winBox.y + Math.floor(winBox.h / 2) - 1, winBox.w - 10, 3);
  ctx.fillStyle = '#4a3d24';
  ctx.fillRect(winBox.x + 5, winBox.y + Math.floor(winBox.h / 2), winBox.w - 10, 1);

  // Left & Right spools
  const isPlaying = item.isPlaying && !item.isPaused;
  const leftX = winBox.x + Math.floor(winBox.w * 0.28);
  const rightX = winBox.x + Math.floor(winBox.w * 0.72);
  const spoolY = winBox.y + Math.floor(winBox.h / 2);

  const leftTapeRadius = Math.max(3, Math.round(7 - 4 * item.position));
  const rightTapeRadius = Math.max(3, Math.round(3 + 4 * item.position));

  // Tape packs
  ctx.fillStyle = TAPE_BROWN;
  ctx.beginPath();
  ctx.arc(leftX, spoolY, leftTapeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(rightX, spoolY, rightTapeRadius, 0, Math.PI * 2);
  ctx.fill();

  // White spool hubs
  ctx.fillStyle = BONE;
  ctx.beginPath();
  ctx.arc(leftX, spoolY, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(rightX, spoolY, 3, 0, Math.PI * 2);
  ctx.fill();

  // Rotating spool teeth
  const angle = isPlaying ? (Date.now() / 120) % (Math.PI * 2) : 0;
  ctx.strokeStyle = '#222430';
  ctx.lineWidth = 1;
  for (let s = 0; s < 3; s++) {
    const a = angle + (s * Math.PI) / 3;
    const cos = Math.cos(a) * 3;
    const sin = Math.sin(a) * 3;
    ctx.beginPath();
    ctx.moveTo(leftX - cos, spoolY - sin);
    ctx.lineTo(leftX + cos, spoolY + sin);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rightX - cos, spoolY - sin);
    ctx.lineTo(rightX + cos, spoolY + sin);
    ctx.stroke();
  }

  // Magnetic tape ribbon bridge
  ctx.fillStyle = '#261b14';
  ctx.fillRect(leftX, winBox.y + winBox.h - 3, rightX - leftX, 2);
}

function drawGlyph(ctx: CanvasRenderingContext2D, index: number, cx: number, cy: number, color: string): void {
  ctx.fillStyle = color;
  if (index === 0) {
    // Prev: bar + left triangle
    ctx.fillRect(cx - 4, cy - 3, 2, 7);
    ctx.beginPath();
    ctx.moveTo(cx + 3, cy - 3);
    ctx.lineTo(cx - 2, cy);
    ctx.lineTo(cx + 3, cy + 3);
    ctx.closePath();
    ctx.fill();
  } else if (index === 1) {
    // Rewind: two left triangles
    ctx.beginPath();
    ctx.moveTo(cx, cy - 3);
    ctx.lineTo(cx - 4, cy);
    ctx.lineTo(cx, cy + 3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 4, cy - 3);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + 4, cy + 3);
    ctx.closePath();
    ctx.fill();
  } else if (index === 2) {
    // Play / Pause
    if (color === AMBER) {
      // Pause: two bars
      ctx.fillRect(cx - 3, cy - 3, 2, 7);
      ctx.fillRect(cx + 1, cy - 3, 2, 7);
    } else {
      // Play: right triangle
      ctx.beginPath();
      ctx.moveTo(cx - 3, cy - 4);
      ctx.lineTo(cx + 4, cy);
      ctx.lineTo(cx - 3, cy + 4);
      ctx.closePath();
      ctx.fill();
    }
  } else if (index === 3) {
    // Stop: square
    ctx.fillRect(cx - 3, cy - 3, 6, 6);
  } else if (index === 4) {
    // Forward: two right triangles
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 3);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx - 4, cy + 3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy - 3);
    ctx.lineTo(cx + 4, cy);
    ctx.lineTo(cx, cy + 3);
    ctx.closePath();
    ctx.fill();
  } else if (index === 5) {
    // Next: right triangle + bar
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy - 3);
    ctx.lineTo(cx + 2, cy);
    ctx.lineTo(cx - 3, cy + 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx + 2, cy - 3, 2, 7);
  }
}

function drawTransportButtons(
  ctx: CanvasRenderingContext2D,
  transportParts: readonly Box[],
  item: RadioItem,
  win: PageWindow,
  controlId: string,
): void {
  const isRunning = item.isPlaying && !item.isPaused;
  transportParts.forEach((btn, index) => {
    const isHovered =
      win.hover?.kind === 'control' && win.hover.id === controlId && win.hover.part === index;
    const isPlayBtn = index === 2;
    const isPlayingPlayBtn = isPlayBtn && isRunning;
    const isStopBtn = index === 3;
    const isStoppedStopBtn = isStopBtn && !item.isPlaying;

    const topEdge = pickFirst(isHovered, BONE, isPlayingPlayBtn, AMBER, '#3d4052');
    const botEdge = pickFirst(isHovered, AMBER, isPlayingPlayBtn, '#1b1d26', INK);
    const fill = pickFirst(isPlayingPlayBtn, '#1e212c', isHovered, '#252835', RAISED);

    beveledBox(ctx, btn, topEdge, botEdge, fill);

    const cx = btn.x + Math.floor(btn.w / 2);
    const cy = btn.y + Math.floor(btn.h / 2);
    const glyphColor = transportGlyphColor({
      isPlayingPlayBtn,
      isHovered,
      isStoppedStopBtn,
      isPlayBtn,
      isStopBtn,
    });

    drawGlyph(ctx, index, cx, cy, glyphColor);
  });
}

/**
 * Draws the interactive pixel art boombox radio on the 2D canvas, matching RadioDeck.vue.
 */
export function drawRadio(ctx: CanvasRenderingContext2D, win: PageWindow, control: PlacedControl): void {
  const item = control.item as RadioItem;
  const box = control.box;
  const chassis: Box = { x: box.x, y: box.y + 7, w: box.w, h: box.h - 7 };

  // 1. Handle and antenna
  drawHandleAndAntenna(ctx, box, chassis);

  // 2. Chassis body with 3D bevels and corner rivets
  beveledBox(ctx, chassis, CHASSIS_TOP, CHASSIS_BOT, CHASSIS_BG);
  ctx.fillStyle = '#333748';
  ctx.fillRect(chassis.x + 2, chassis.y + 2, 1, 1);
  ctx.fillRect(chassis.x + chassis.w - 3, chassis.y + 2, 1, 1);
  ctx.fillRect(chassis.x + 2, chassis.y + chassis.h - 3, 1, 1);
  ctx.fillRect(chassis.x + chassis.w - 3, chassis.y + chassis.h - 3, 1, 1);

  const speakerW = Math.max(30, Math.min(42, Math.floor((box.w - 140) / 2)));
  const centerW = box.w - (speakerW + 6) * 2;
  const centerX = box.x + speakerW + 6;

  // 3. Left speaker
  const leftSpeakerBox: Box = { x: chassis.x + 3, y: chassis.y + 4, w: speakerW, h: chassis.h - 8 };
  drawLeftSpeaker(ctx, leftSpeakerBox, item.isPlaying && !item.isPaused);

  // 4. Right speaker (grille) and side buttons
  const rightGrilleBox: Box = {
    x: chassis.x + chassis.w - speakerW - 3,
    y: chassis.y + 4,
    w: speakerW,
    h: 32,
  };
  drawRightSpeaker(ctx, rightGrilleBox);

  const sideParts = control.parts.slice(6, 9);
  drawSideButtons(ctx, sideParts, item, win, control.id);

  // 5. Tuner section & scrubber
  const tunerBox: Box = { x: centerX + 2, y: chassis.y + 4, w: centerW - 4, h: 16 };
  const track = control.track ?? { x: tunerBox.x, y: tunerBox.y + 6, w: tunerBox.w, h: 8 };
  const isGlassHovered =
    win.hover?.kind === 'control' && win.hover.id === control.id && win.hover.along !== null;
  drawTuner(ctx, tunerBox, track, item, isGlassHovered);

  // 6. Cassette bay
  const cassetteBox: Box = { x: centerX + 2, y: chassis.y + 22, w: centerW - 4, h: 36 };
  drawCassetteBay(ctx, cassetteBox, item);

  // 7. Transport buttons (parts 0..5)
  const transportParts = control.parts.slice(0, 6);
  drawTransportButtons(ctx, transportParts, item, win, control.id);
}
