import { drawText, FONT_HEIGHT, textWidth } from './bitmap-font.ts';
import type { Box } from './setup-ui.ts';
import type { AlbumSliderItem, PlacedControl } from './page-ui.ts';
import type { PageWindow } from '../game/page-view.ts';
import { drawFit, drawName } from './setup-ui-draw.ts';

const INK = '#0b0c10';
const RAISED = '#17181f';
const LINE = '#33343c';
const BONE = '#e4dcc3';
const DIM = '#938d7a';
const BLOOD = '#e0463a';
const AMBER = '#e8a33d';

function frame(ctx: CanvasRenderingContext2D, box: Box, edge: string, fill: string): void {
  ctx.fillStyle = edge;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.fillStyle = fill;
  ctx.fillRect(box.x + 1, box.y + 1, box.w - 2, box.h - 2);
}

function centred(ctx: CanvasRenderingContext2D, text: string, box: Box, color: string): void {
  const x = box.x + Math.floor((box.w - textWidth(text)) / 2);
  const y = box.y + Math.floor((box.h - FONT_HEIGHT) / 2);
  drawText(ctx, text, x, y, color);
}

export function drawAlbumSlider(
  ctx: CanvasRenderingContext2D,
  win: PageWindow,
  control: PlacedControl,
): void {
  const item = control.item as AlbumSliderItem;
  const { box, parts } = control;

  const cardW = 112;
  const cardH = 144;
  const cardX = box.x + Math.floor((box.w - cardW) / 2);
  const cardY = box.y + 18;

  // 1. Top Volume Header
  const volBadgeW = 14;
  const volBadgeH = 12;
  const volBadge: Box = { x: cardX, y: box.y + 2, w: volBadgeW, h: volBadgeH };
  const badgeNum = item.volume.replace('VOL. ', '');
  frame(ctx, volBadge, item.isHorde ? BLOOD : AMBER, item.isHorde ? BLOOD : AMBER);
  centred(ctx, badgeNum, volBadge, item.isHorde ? BONE : INK);

  const headLabel = `${item.volume} // ${item.subtitle}`.toUpperCase();
  drawText(ctx, headLabel, volBadge.x + volBadgeW + 4, box.y + 4, DIM);

  // 2. Play Setup Card: Frame, Big Art, Title Overlay
  const cardBox: Box = { x: cardX, y: cardY, w: cardW, h: cardH };
  frame(ctx, cardBox, item.isHorde ? BLOOD : LINE, RAISED);

  const artInset = 2;
  const artBox: Box = {
    x: cardBox.x + artInset,
    y: cardBox.y + artInset,
    w: cardBox.w - artInset * 2,
    h: cardBox.h - artInset * 2,
  };
  drawFit(ctx, item.art, artBox, 'cover');
  drawName(ctx, artBox, item.title, BONE, 2);

  // 3. Side Flipper Buttons (parts[0] = prev, parts[1] = next)
  const prevBox = parts[0];
  const nextBox = parts[1];
  const isPrevHovered = win.hover?.kind === 'control' && win.hover.id === control.id && win.hover.part === 0;
  const isNextHovered = win.hover?.kind === 'control' && win.hover.id === control.id && win.hover.part === 1;

  if (prevBox) {
    const canPrev = item.albumIndex > 0;
    frame(ctx, prevBox, isPrevHovered && canPrev ? AMBER : LINE, RAISED);
    centred(ctx, '◀', prevBox, canPrev ? (isPrevHovered ? AMBER : BONE) : DIM);
  }

  if (nextBox) {
    const canNext = item.albumIndex < item.totalAlbums - 1;
    frame(ctx, nextBox, isNextHovered && canNext ? AMBER : LINE, RAISED);
    centred(ctx, '▶', nextBox, canNext ? (isNextHovered ? AMBER : BONE) : DIM);
  }

  // 4. Album Indicator Dots (parts[2 .. 2+totalAlbums-1])
  for (let i = 0; i < item.totalAlbums; i++) {
    const dotBox = parts[2 + i];
    if (!dotBox) continue;
    const isActive = i === item.albumIndex;
    const isHovered = win.hover?.kind === 'control' && win.hover.id === control.id && win.hover.part === 2 + i;
    frame(ctx, dotBox, isActive ? AMBER : isHovered ? BONE : LINE, isActive ? AMBER : RAISED);
  }

  // 5. Cassette Track Rows & Favorite Buttons
  const totalAlbums = item.totalAlbums;
  const tracksCount = item.tracks.length;

  item.tracks.forEach((track, n) => {
    const trackPartIdx = 2 + totalAlbums + n;
    const favPartIdx = 2 + totalAlbums + tracksCount + n;
    const trackBox = parts[trackPartIdx];
    const favBox = parts[favPartIdx];

    if (!trackBox) return;

    const isTrackHovered = win.hover?.kind === 'control' && win.hover.id === control.id && win.hover.part === trackPartIdx;
    const isFavHovered = win.hover?.kind === 'control' && win.hover.id === control.id && win.hover.part === favPartIdx;

    // Track cassette row
    frame(ctx, trackBox, track.isPlaying ? AMBER : isTrackHovered ? BONE : LINE, track.isPlaying ? '#222018' : RAISED);

    // Track index / side
    const sideLabel = `A${n + 1}`;
    drawText(ctx, sideLabel, trackBox.x + 4, trackBox.y + 4, AMBER);

    // Play/Pause indicator
    if (track.isPlaying) {
      if (track.isPaused) {
        drawText(ctx, '||', trackBox.x + 18, trackBox.y + 4, AMBER);
      } else {
        // Mini animated EQ
        const now = performance.now();
        const b1 = 2 + Math.floor((Math.sin(now * 0.01) + 1) * 2);
        const b2 = 2 + Math.floor((Math.sin(now * 0.015 + 1) + 1) * 3);
        const b3 = 2 + Math.floor((Math.sin(now * 0.012 + 2) + 1) * 2);
        ctx.fillStyle = AMBER;
        ctx.fillRect(trackBox.x + 18, trackBox.y + 11 - b1, 2, b1);
        ctx.fillRect(trackBox.x + 22, trackBox.y + 11 - b2, 2, b2);
        ctx.fillRect(trackBox.x + 26, trackBox.y + 11 - b3, 2, b3);
      }
    }

    // Track title and origin
    const textStartX = trackBox.x + 32;
    const titleColor = track.isPlaying ? AMBER : isTrackHovered ? BONE : BONE;
    drawText(ctx, track.name.toUpperCase(), textStartX, trackBox.y + 4, titleColor);

    // Favorite heart button
    if (favBox) {
      frame(ctx, favBox, isFavHovered ? BLOOD : LINE, RAISED);
      centred(ctx, track.isFavorite ? '♥' : '♡', favBox, track.isFavorite ? BLOOD : DIM);
    }
  });
}
