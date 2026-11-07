import { tagLabel } from '../../shared/callsign.ts';
import { EXIT_RADIUS, ZOMBIES } from '../../shared/constants.ts';
import { CONTAINER_LABEL } from '../../shared/containers.ts';
import { HEAD_MARGIN, isOnHead, TOUCH_HEAD_MARGIN } from '../../shared/headshots.ts';
import type { DropView, EntityId, ExitEntity, PlayerEntity, ZombieEntity } from '../../shared/protocol.ts';
import { dirFromAngle } from '../art/types.ts';
import type { ArtBook } from '../art/types.ts';
import { drawOutlinedText, FONT_HEIGHT } from './bitmap-font.ts';
import type { SceneView } from './scene.ts';
import { stationPrompt } from './station-labels.ts';
import { bodyHeight, drawSprite } from './sprite-cache.ts';
import { drawFingertipBox, drawStick } from './touch-overlay.ts';
import type { VisualStore } from './visuals.ts';
import { hitPalette } from './hit-palette.ts';

const POINTER_INSET = 8;
/** Clear of the HUD in every corner, and of the screen's edge, where the van must not be missed. */
const VAN_POINTER_INSET = 26;
const VAN_POINTER_LABEL_GAP = 5;
/** A hurt zombie's bar only shows where a light finds it; in the dark it would mark the spot. */
const BAR_MIN_LIGHT = 60;
const INK = '#0b0c10';
const BONE = '#e4dcc3';
const AMBER = '#e8a33d';
const DEFAULT_BODY_HEIGHT = 18;
/** Words and the wait bar sit this far over the van's ground line. */
const VAN_TAG_HEIGHT = 46;
const VAN_BAR_WIDTH = 32;
const EXIT_RING_DOTS = 28;
/** A search's bar and prompt sit this far over a head, clear of a teammate's own tag. */
const SEARCH_TAG_HEIGHT = FONT_HEIGHT * 2 + 12;
const SEARCH_BAR_WIDTH = 24;
/** A stall's "!" floats this far over its sprite. */
const QUEST_MARK_GAP = FONT_HEIGHT + 4;
/** The sprint bar sits this far under a survivor's feet, clear of the shadow. */
const STAMINA_BAR_DROP = 5;
const STAMINA_BAR_WIDTH = 16;
/** A winded survivor's bar blinks this many times a second. */
const WINDED_BLINKS_PER_SEC = 3;

type Pixel = readonly [number, number];

function parsePixels(rows: readonly string[]): Pixel[] {
  const pixels: Pixel[] = [];
  rows.forEach((row, y) => [...row].forEach((cell, x) => {
    const isInked = cell === '#';
    if (isInked) pixels.push([x - 2, y - 2]);
  }));
  return pixels;
}

const ARROW_EAST = parsePixels(['#....', '###..', '#####', '###..', '#....']);
const ARROW_SOUTHEAST = parsePixels(['....#', '...##', '..###', '.####', '#####']);

function quarterTurns(pixels: readonly Pixel[], turns: number): Pixel[] {
  return pixels.map(([x, y]) => {
    let px = x;
    let py = y;
    for (let i = 0; i < turns; i += 1) [px, py] = [-py, px];
    return [px, py];
  });
}

/** Indexed like dirFromAngle: 0=E 1=SE 2=S and on round. */
const ARROWS: readonly (readonly Pixel[])[] = Array.from({ length: 8 }, (_, dir) =>
  quarterTurns(dir % 2 === 0 ? ARROW_EAST : ARROW_SOUTHEAST, Math.floor(dir / 2)));

export interface StaminaBar {
  readonly fraction: number;
  readonly color: string;
}

/** What the local survivor's sprint bar shows, or null while it is full, they are not alive, or it is someone else. */
export function staminaBar(player: PlayerEntity, isLocal: boolean, time: number): StaminaBar | null {
  const stamina = player.stamina ?? 1;
  const worn = isLocal && player.status === 'alive' && stamina < 1;
  if (!worn) return null;
  if (!player.winded) return { fraction: stamina, color: AMBER };
  const lit = Math.floor(time * WINDED_BLINKS_PER_SEC * 2) % 2 === 0;
  return lit ? { fraction: stamina, color: hitPalette().danger } : { fraction: stamina, color: INK };
}

export interface EdgePointer {
  readonly x: number;
  readonly y: number;
  readonly dir: number;
}

/** Where to pin an arrow for a point off screen, or null if the point is in view. */
export function edgePointer(screenX: number, screenY: number, viewW: number, viewH: number, inset = POINTER_INSET): EdgePointer | null {
  const inView = screenX >= 0 && screenY >= 0 && screenX < viewW && screenY < viewH;
  if (inView) return null;
  const centerX = viewW / 2;
  const centerY = viewH / 2;
  const dx = screenX - centerX;
  const dy = screenY - centerY;
  const reach = Math.min(
    dx === 0 ? Infinity : (centerX - inset) / Math.abs(dx),
    dy === 0 ? Infinity : (centerY - inset) / Math.abs(dy),
  );
  return {
    x: Math.round(centerX + dx * reach),
    y: Math.round(centerY + dy * reach),
    dir: dirFromAngle(Math.atan2(dy, dx)),
  };
}

export function drawArrow(ctx: CanvasRenderingContext2D, pointer: EdgePointer, color: string): void {
  const pixels = ARROWS[pointer.dir];
  ctx.fillStyle = INK;
  for (const [x, y] of pixels) ctx.fillRect(pointer.x + x + 1, pointer.y + y + 1, 1, 1);
  ctx.fillStyle = color;
  for (const [x, y] of pixels) ctx.fillRect(pointer.x + x, pointer.y + y, 1, 1);
}

function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, fraction: number, color: string): void {
  ctx.fillStyle = INK;
  ctx.fillRect(x - 1, y - 1, width + 2, 4);
  const filled = Math.max(1, Math.round(width * Math.min(1, fraction)));
  ctx.fillStyle = color;
  ctx.fillRect(x, y, filled, 2);
}

/**
 * Whether a screen point is on a head the player can make out. A head in the dark
 * stays unmarked, for the same reason a hurt zombie's bar does: it would mark the spot.
 */
export function onSeenHead(
  zombies: readonly ZombieEntity[],
  screenX: number,
  screenY: number,
  left: number,
  top: number,
  lightAt: (x: number, y: number) => number,
  isKilled: (id: EntityId) => boolean,
  margin = HEAD_MARGIN,
): boolean {
  return zombies.some((zombie) => {
    const aimedAt = !isKilled(zombie.id) && isOnHead(zombie, screenX + left, screenY + top, margin);
    return aimedAt && lightAt(zombie.x - left, zombie.y - top) >= BAR_MIN_LIGHT;
  });
}

/** Dots around the spot that counts as being at the van. */
const EXIT_RING: readonly Pixel[] = Array.from({ length: EXIT_RING_DOTS }, (_, dot) => {
  const angle = (dot / EXIT_RING_DOTS) * Math.PI * 2;
  return [Math.round(Math.cos(angle) * EXIT_RADIUS), Math.round(Math.sin(angle) * EXIT_RADIUS)];
});

/** Everything drawn on top of the world: bars, names, edge arrows and the crosshair. */
export class OverlayRenderer {
  private readonly art: ArtBook;
  private readonly visuals: VisualStore;

  constructor(art: ArtBook, visuals: VisualStore) {
    this.art = art;
    this.visuals = visuals;
  }

  private heightOf(id: string): number {
    const sprite = this.visuals.get(id).sprite;
    return sprite ? bodyHeight(sprite) : DEFAULT_BODY_HEIGHT;
  }

  private drawZombieBar(ctx: CanvasRenderingContext2D, zombie: ZombieEntity, left: number, top: number): void {
    const width = ZOMBIES[zombie.type].radius * 2;
    const x = Math.round(zombie.x) - left - Math.round(width / 2);
    const y = Math.round(zombie.y) - top - this.heightOf(zombie.id) - 4;
    drawBar(ctx, x, y, width, zombie.health / zombie.maxHealth, hitPalette().danger);
  }

  private drawPlayerTag(ctx: CanvasRenderingContext2D, player: PlayerEntity, isLocal: boolean, left: number, top: number, time: number): void {
    const x = Math.round(player.x) - left;
    let y = Math.round(player.y) - top - this.heightOf(player.id) - 4;

    const isDowned = player.status === 'downed';
    if (isDowned) {
      const isBeingRevived = player.revive > 0;
      if (isBeingRevived) {
        drawBar(ctx, x - 12, y, 24, player.revive, AMBER);
      } else {
        const isHelpBlinkOn = !isLocal && Math.floor(time * 3) % 2 === 0;
        if (isHelpBlinkOn) drawOutlinedText(ctx, 'HELP', x, y - 2, hitPalette().danger);
      }
      y -= FONT_HEIGHT + 3;
    }
    const hasNoTag = isLocal || player.status === 'dead';
    if (hasNoTag) return;
    const isAlive = player.status === 'alive';
    if (isAlive) {
      drawBar(ctx, x - 8, y, 16, player.health / player.maxHealth, hitPalette().safe);
      y -= FONT_HEIGHT + 3;
    }
    drawOutlinedText(ctx, tagLabel(player.name, player.skin), x, y, BONE);
  }

  /** The local survivor's sprint bar, under their feet. */
  private drawStamina(ctx: CanvasRenderingContext2D, player: PlayerEntity, isLocal: boolean, left: number, top: number, time: number): void {
    const bar = staminaBar(player, isLocal, time);
    if (!bar) return;
    const x = Math.round(player.x) - left - STAMINA_BAR_WIDTH / 2;
    const y = Math.round(player.y) - top + STAMINA_BAR_DROP;
    drawBar(ctx, x, y, STAMINA_BAR_WIDTH, bar.fraction, bar.color);
  }

  private drawPointers(ctx: CanvasRenderingContext2D, scene: SceneView, left: number, top: number, viewW: number, viewH: number): void {
    for (const player of scene.players) {
      const needsNoPointer = player.status !== 'downed' || player.id === scene.localId;
      if (needsNoPointer) continue;
      const pointer = edgePointer(player.x - left, player.y - top, viewW, viewH);
      if (pointer) drawArrow(ctx, pointer, hitPalette().safe);
    }
  }

  /** A bar over anyone searching, and for the local player the key to hold: for a container, or a bunker station. */
  private drawSearch(ctx: CanvasRenderingContext2D, scene: SceneView, left: number, top: number): void {
    for (const player of scene.players) {
      const x = Math.round(player.x) - left;
      const y = Math.round(player.y) - top - this.heightOf(player.id) - SEARCH_TAG_HEIGHT;
      const isLocal = player.id === scene.localId;
      const prompted = isLocal && scene.searchable !== null;
      const atStation = isLocal && scene.station !== undefined;
      const onStairs = isLocal && scene.stairs !== undefined;
      if (player.search > 0) drawBar(ctx, x - SEARCH_BAR_WIDTH / 2, y, SEARCH_BAR_WIDTH, player.search, BONE);
      else if (onStairs) drawOutlinedText(ctx, `${scene.touch ? 'SEARCH' : 'E'}: ${scene.stairs}`, x, y, AMBER);
      else if (prompted) drawOutlinedText(ctx, `${scene.touch ? 'SEARCH' : 'HOLD E'}: ${CONTAINER_LABEL[scene.searchable.kind]}`, x, y, AMBER);
      else if (atStation) drawOutlinedText(ctx, stationPrompt(scene.station, Boolean(scene.touch), this.payFrom(scene)), x, y, AMBER);
    }
  }

  /** Who is holding pay at the stall the local player stands at, if anyone: it replaces the stall's name in the prompt. */
  private payFrom(scene: SceneView): string | undefined {
    return scene.questMarks?.find((mark) => mark.ready && mark.merchant === scene.station)?.name;
  }

  /** A "!" over each stall with work to take (pale) or pay to collect (amber). */
  private drawQuestMarks(ctx: CanvasRenderingContext2D, scene: SceneView, left: number, top: number): void {
    for (const mark of scene.questMarks ?? []) {
      const height = bodyHeight(this.art.environment.props[mark.merchant]);
      const y = Math.round(mark.y) - top - height - QUEST_MARK_GAP;
      drawOutlinedText(ctx, '!', Math.round(mark.x) - left, y, mark.ready ? AMBER : BONE);
    }
  }

  /** An arrow to the supply drop while it is out of sight; in sight, a red ring and what it is. */
  private drawDrop(ctx: CanvasRenderingContext2D, drop: DropView, left: number, top: number, viewW: number, viewH: number, time: number): void {
    const x = Math.round(drop.x) - left;
    const y = Math.round(drop.y) - top;
    const label = drop.landed ? 'SUPPLIES' : 'DROP';
    const pointer = edgePointer(x, y, viewW, viewH, VAN_POINTER_INSET);
    if (pointer) {
      drawArrow(ctx, pointer, hitPalette().danger);
      const labelBelow = pointer.y < viewH / 2;
      const labelY = labelBelow ? pointer.y + VAN_POINTER_LABEL_GAP : pointer.y - VAN_POINTER_LABEL_GAP - FONT_HEIGHT;
      drawOutlinedText(ctx, label, pointer.x, labelY, hitPalette().danger);
      return;
    }
    const blinkOn = drop.landed || Math.floor(time * 3) % 2 === 0;
    if (!blinkOn) return;
    ctx.fillStyle = hitPalette().danger;
    for (const [dx, dy] of EXIT_RING) ctx.fillRect(x + dx, y + dy, 1, 1);
    drawOutlinedText(ctx, label, x, y - VAN_TAG_HEIGHT / 2, hitPalette().danger);
  }

  /** An arrow to the van while it is out of sight. In sight, the ring to stand in and the wait. */
  private drawExit(ctx: CanvasRenderingContext2D, exit: ExitEntity, left: number, top: number, viewW: number, viewH: number): void {
    const x = Math.round(exit.x) - left;
    const y = Math.round(exit.y) - top;
    const pointer = edgePointer(x, y, viewW, viewH, VAN_POINTER_INSET);
    if (pointer) {
      drawArrow(ctx, pointer, AMBER);
      const labelBelow = pointer.y < viewH / 2;
      const labelY = labelBelow ? pointer.y + VAN_POINTER_LABEL_GAP : pointer.y - VAN_POINTER_LABEL_GAP - FONT_HEIGHT;
      drawOutlinedText(ctx, 'VAN', pointer.x, labelY, AMBER);
      return;
    }
    ctx.fillStyle = AMBER;
    for (const [dx, dy] of EXIT_RING) ctx.fillRect(x + dx, y + dy, 1, 1);
    const tagY = y - VAN_TAG_HEIGHT;
    const isLoading = exit.progress > 0;
    if (isLoading) drawBar(ctx, x - VAN_BAR_WIDTH / 2, tagY, VAN_BAR_WIDTH, exit.progress, hitPalette().safe);
    else drawOutlinedText(ctx, 'VAN', x, tagY, AMBER);
  }

  draw(
    ctx: CanvasRenderingContext2D,
    scene: SceneView,
    left: number,
    top: number,
    viewW: number,
    viewH: number,
    time: number,
    lightAt: (x: number, y: number) => number,
    isKilled: (id: EntityId) => boolean,
  ): void {
    for (const zombie of scene.zombies) {
      if (isKilled(zombie.id)) continue;
      const onScreen = zombie.x > left && zombie.x < left + viewW && zombie.y > top && zombie.y < top + viewH;
      const hurt = zombie.health < zombie.maxHealth;
      const showBar = onScreen && hurt && lightAt(zombie.x - left, zombie.y - top) >= BAR_MIN_LIGHT;
      if (showBar) this.drawZombieBar(ctx, zombie, left, top);
    }
    for (const player of scene.players) {
      this.drawPlayerTag(ctx, player, player.id === scene.localId, left, top, time);
      this.drawStamina(ctx, player, player.id === scene.localId, left, top, time);
    }
    this.drawQuestMarks(ctx, scene, left, top);
    this.drawSearch(ctx, scene, left, top);
    this.drawPointers(ctx, scene, left, top, viewW, viewH);
    const exitShown = scene.exit !== null && scene.phase !== 'gameover';
    if (exitShown) this.drawExit(ctx, scene.exit, left, top, viewW, viewH);
    const dropShown = scene.drop !== null && scene.phase !== 'gameover';
    if (dropShown) this.drawDrop(ctx, scene.drop, left, top, viewW, viewH, time);
  }

  drawCrosshair(
    ctx: CanvasRenderingContext2D,
    scene: SceneView,
    left: number,
    top: number,
    lightAt: (x: number, y: number) => number,
    isKilled: (id: EntityId) => boolean,
  ): void {
    const { touch } = scene;
    if (touch?.stick) drawStick(ctx, touch.stick);
    const x = touch ? touch.aim?.x ?? null : scene.pointerX;
    const y = touch ? touch.aim?.y ?? null : scene.pointerY;
    const noPointer = x === null || y === null;
    if (noPointer) return;
    const { crosshair, crosshairHead } = this.art.ui;
    const onHead = onSeenHead(scene.zombies, x, y, left, top, lightAt, isKilled, touch ? TOUCH_HEAD_MARGIN : HEAD_MARGIN);
    drawSprite(ctx, onHead ? crosshairHead : crosshair, Math.round(x), Math.round(y));
    if (touch) drawFingertipBox(ctx, x, y, touch.fingertip, onHead);
  }
}
