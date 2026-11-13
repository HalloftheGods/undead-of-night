import type { ArtBook, PixelSprite } from '../art/types.ts';
import type { ContainerArt } from '../art/containers.ts';
import { backpackDef } from '../../shared/backpack.ts';
import { getItemFootprint, type GridItem, type InventoryGrid } from '../../shared/grid-inventory.ts';
import { drawOutlinedText, drawText, FONT_HEIGHT, textWidth } from './bitmap-font.ts';
import { drawSpriteScaled } from './sprite-cache.ts';
import {
  computeTileHighlight,
  formatItemName,
  GEAR_SLOT_DEFS,
  isItemValidForGearSlot,
  type DualLootState,
  type GearSlotId,
  type GridIdentifier,
} from '../game/inventory/dual-loot-modal.ts';
import { lootBadge, lootSprite } from '../game/inventory/loot-item-art.ts';

/**
 * The loot window drawn on the game canvas, in art pixels, like the rest of the game. A pure layout step
 * turns the state and the view size into rectangles; one draw step paints them; one hit step answers a
 * pointer. Nothing here is reactive and nothing here owns state: the caller holds a DualLootState and the
 * hover, and calls the same pickUp / place functions the Vue overlay does.
 */

const INK = '#0b0c10';
const RAISED = '#17181f';
const LINE = '#33343c';
const BONE = '#e4dcc3';
const DIM = '#938d7a';
const BLOOD = '#e0463a';
const SICK = '#8fbf3a';
const AMBER = '#e8a33d';

/** One bag slot: a 15 pixel sprite with a pixel of air each side. */
const TILE = 17;
const PAD = 3;
const HEAD = 9;
const GEAR_W = 32;
const GEAR_H = 40;
const GAP = 2;
const EDGE = 6;
const BUTTON_H = 9;

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface GridBox extends Box {
  readonly id: GridIdentifier;
  readonly grid: InventoryGrid;
  readonly title: string;
}

export interface LootLayout {
  readonly container: (Box & { readonly board: GridBox }) | null;
  readonly survivor: Box;
  readonly pack: GridBox;
  readonly pockets: GridBox;
  readonly candy: GridBox;
  readonly gear: readonly (Box & { readonly id: GearSlotId })[];
  readonly buttons: readonly (Box & { readonly id: 'rotate' | 'close'; readonly label: string })[];
}

export type LootHit =
  | { readonly kind: 'cell'; readonly gridId: GridIdentifier; readonly col: number; readonly row: number }
  | { readonly kind: 'gear'; readonly slot: GearSlotId }
  | { readonly kind: 'button'; readonly id: 'rotate' | 'close' };

export interface LootView {
  readonly state: DualLootState;
  readonly art: ArtBook | null;
  readonly containerArt: ContainerArt | null;
  readonly hover: LootHit | null;
  /** The pointer in buffer pixels, for the item in hand. */
  readonly pointer: { readonly x: number; readonly y: number } | null;
}

function upper(text: string): string {
  return text.toUpperCase();
}

function gridBox(id: GridIdentifier, grid: InventoryGrid, title: string, x: number, y: number): GridBox {
  return { id, grid, title, x, y, w: grid.cols * TILE, h: grid.rows * TILE };
}

/** Where everything goes for a view of this size: the container on the left, the survivor's gap in the middle, the bag on the right. */
export function layoutLootUi(state: DualLootState, viewW: number, viewH: number): LootLayout {
  const pack = state.backpackGrid;
  const candyW = state.candyBagGrid.cols * TILE;
  const gridsW = pack.cols * TILE + 4 + candyW;
  const gearW = GEAR_SLOT_COUNT * GEAR_W + (GEAR_SLOT_COUNT - 1) * GAP;
  const tierLabel = tierName(state);
  const headW = textWidth('SURVIVOR INVENTORY') + 6 + textWidth(tierLabel);
  const innerW = Math.max(gearW, gridsW, headW);
  const sw = innerW + PAD * 2;
  const packH = pack.rows * TILE + 8;
  const pocketsH = state.pocketsGrid.rows * TILE + 8;
  const gridsH = Math.max(packH + GAP + pocketsH, state.candyBagGrid.rows * TILE + 8);
  const sh = HEAD + GAP + GEAR_H + GAP + gridsH + GAP + BUTTON_H + PAD * 2;
  const sx = viewW - EDGE - sw;
  const sy = Math.max(EDGE, Math.round((viewH - sh) / 2));

  const gx = sx + PAD;
  let gy = sy + PAD + HEAD + GAP;
  const gear = GEAR_SLOT_DEFS.map((def, i) => ({ id: def.id, x: gx + i * (GEAR_W + GAP), y: gy, w: GEAR_W, h: GEAR_H }));
  gy += GEAR_H + GAP;

  const packBox = gridBox('backpack', pack, `PACK ${pack.cols}X${pack.rows}`, gx, gy + 8);
  const pocketsBox = gridBox('pockets', state.pocketsGrid, 'POCKETS', gx, gy + packH + GAP + 8);
  const candyBox = gridBox('candyBag', state.candyBagGrid, 'CANDY', gx + innerW - candyW, gy + 8);

  const buttonY = sy + sh - PAD - BUTTON_H;
  const rotateW = textWidth('[R] ROTATE'.replace(/[\[\]]/g, '')) + 8;
  const closeW = textWidth('ESC CLOSE') + 8;
  const buttons = [
    { id: 'rotate' as const, label: 'R ROTATE', x: gx, y: buttonY, w: rotateW, h: BUTTON_H },
    { id: 'close' as const, label: 'ESC CLOSE', x: gx + rotateW + GAP, y: buttonY, w: closeW, h: BUTTON_H },
  ];

  const hasContainer = state.containerGrid.items.length > 0 || Boolean(state.containerKind);
  let container: LootLayout['container'] = null;
  if (hasContainer) {
    const grid = state.containerGrid;
    const boardW = grid.cols * TILE;
    const boardH = grid.rows * TILE;
    const headW = textWidth(upper(state.containerTitle)) + 6 + textWidth(`${grid.items.length} ITEMS`);
    const w = Math.max(90, boardW + PAD * 2, headW + PAD * 2);
    const h = HEAD + GAP + boardH + PAD * 2;
    const x = EDGE;
    const y = Math.max(EDGE, Math.round((viewH - h) / 2));
    const board = gridBox('container', grid, upper(state.containerTitle), x + Math.round((w - boardW) / 2), y + PAD + HEAD + GAP);
    container = { x, y, w, h, board };
  }

  const survivor: Box = { x: sx, y: sy, w: sw, h: sh };
  return { container, survivor, pack: packBox, pockets: pocketsBox, candy: candyBox, gear, buttons };
}

const GEAR_SLOT_COUNT = GEAR_SLOT_DEFS.length;

/** Short enough for a 32 pixel slot. */
const GEAR_TAG: Readonly<Record<GearSlotId, string>> = { primary: 'PRIMARY', secondary: 'SECOND', sidearm: 'SIDEARM', armor: 'ARMOR' };

/** The pack's tier, without the roman numeral: "SATCHEL". */
function tierName(state: DualLootState): string {
  const label = backpackDef(state.backpackTier).label;
  return upper(label.includes(': ') ? label.split(': ')[1] : label);
}

function inside(box: Box, x: number, y: number): boolean {
  return x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
}

/** What is under a point, or null. */
export function lootHitAt(layout: LootLayout, x: number, y: number): LootHit | null {
  for (const button of layout.buttons) if (inside(button, x, y)) return { kind: 'button', id: button.id };
  for (const slot of layout.gear) if (inside(slot, x, y)) return { kind: 'gear', slot: slot.id };
  const boards = [layout.container?.board, layout.pack, layout.pockets, layout.candy];
  for (const board of boards) {
    if (!board || !inside(board, x, y)) continue;
    return { kind: 'cell', gridId: board.id, col: Math.floor((x - board.x) / TILE), row: Math.floor((y - board.y) / TILE) };
  }
  return null;
}

function fill(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function ring(ctx: CanvasRenderingContext2D, color: string, box: Box): void {
  fill(ctx, color, box.x, box.y, box.w, 1);
  fill(ctx, color, box.x, box.y + box.h - 1, box.w, 1);
  fill(ctx, color, box.x, box.y, 1, box.h);
  fill(ctx, color, box.x + box.w - 1, box.y, 1, box.h);
}

function plate(ctx: CanvasRenderingContext2D, box: Box, alpha: number): void {
  fill(ctx, 'rgba(0,0,0,0.5)', box.x + 1, box.y + 3, box.w, box.h);
  ctx.globalAlpha = alpha;
  fill(ctx, INK, box.x, box.y, box.w, box.h);
  ctx.globalAlpha = 1;
  ring(ctx, LINE, box);
}

function drawTitle(ctx: CanvasRenderingContext2D, text: string, box: Box, right?: string): void {
  drawText(ctx, text, box.x + PAD, box.y + PAD + 1, AMBER);
  if (right) drawText(ctx, right, box.x + box.w - PAD - textWidth(right), box.y + PAD + 1, DIM);
  fill(ctx, LINE, box.x + PAD, box.y + PAD + HEAD - 2, box.w - PAD * 2, 1);
}

/** A sprite centred in a box at a whole-number scale. Sprites are anchored, so the anchor is added back. */
function drawCentred(ctx: CanvasRenderingContext2D, sprite: PixelSprite, box: Box, scale: number): void {
  const x = box.x + Math.round((box.w - sprite.w * scale) / 2) + sprite.ax * scale;
  const y = box.y + Math.round((box.h - sprite.h * scale) / 2) + sprite.ay * scale;
  drawSpriteScaled(ctx, sprite, x, y, scale);
}

function artScale(item: GridItem): number {
  const dims = getItemFootprint(item.type, item.rotated);
  return Math.min(2, dims.width, dims.height);
}

function drawItem(ctx: CanvasRenderingContext2D, art: ArtBook | null, item: GridItem, box: Box, selected: boolean, hovered: boolean): void {
  ctx.globalAlpha = hovered ? 0.2 : 0.1;
  fill(ctx, selected ? AMBER : BONE, box.x, box.y, box.w, box.h);
  ctx.globalAlpha = 1;
  ring(ctx, selected ? AMBER : hovered ? BONE : DIM, box);
  const sprite = art ? lootSprite(art, item.type, false) : null;
  if (sprite) drawCentred(ctx, sprite, box, artScale(item));
  else drawOutlinedText(ctx, upper(formatItemName(item.type)).slice(0, 8), box.x + box.w / 2, box.y + box.h / 2 - 2, BONE);
  const badge = lootBadge(item.count, item.ammo);
  if (badge !== '') drawOutlinedText(ctx, badge.toUpperCase(), box.x + box.w - textWidth(badge) / 2 - 2, box.y + box.h - FONT_HEIGHT - 2, BONE);
}

function cellBox(board: GridBox, col: number, row: number, w = 1, h = 1): Box {
  return { x: board.x + col * TILE, y: board.y + row * TILE, w: w * TILE, h: h * TILE };
}

function drawBoard(ctx: CanvasRenderingContext2D, view: LootView, board: GridBox, translucent: boolean): void {
  const { state } = view;
  const grid = board.grid;
  fill(ctx, translucent ? 'rgba(11,12,16,0.35)' : INK, board.x - 1, board.y - 1, board.w + 2, board.h + 2);
  if (!translucent) ring(ctx, LINE, { x: board.x - 1, y: board.y - 1, w: board.w + 2, h: board.h + 2 });
  const hover = view.hover && view.hover.kind === 'cell' && view.hover.gridId === board.id ? view.hover : null;
  const held = state.heldItem ? state.heldItem.item : null;
  const blocked = new Set((grid.blocked ?? []).map((p) => `${p.x},${p.y}`));
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const box = cellBox(board, col, row);
      const shut = blocked.has(`${col},${row}`);
      const light = hover && hover.col === col && hover.row === row && held === null ? LINE : translucent ? 'rgba(11,12,16,0.35)' : RAISED;
      fill(ctx, shut ? '#5a1414' : light, box.x + 1, box.y + 1, TILE - 2, TILE - 2);
      fill(ctx, INK, box.x + 1, box.y + 1, TILE - 2, 1);
      fill(ctx, INK, box.x + 1, box.y + 1, 1, TILE - 2);
      fill(ctx, LINE, box.x + 1, box.y + TILE - 2, TILE - 2, 1);
      fill(ctx, LINE, box.x + TILE - 2, box.y + 1, 1, TILE - 2);
      const mark = computeTileHighlight(grid, col, row, hover ? hover.col : null, hover ? hover.row : null, held, board.id);
      if (mark !== 'none') fill(ctx, mark === 'valid' ? SICK : BLOOD, box.x + 2, box.y + 2, TILE - 4, TILE - 4);
    }
  }
  for (const item of grid.items) {
    const dims = getItemFootprint(item.type, item.rotated);
    const area = cellBox(board, item.x, item.y, dims.width, dims.height);
    const plateBox = { x: area.x + 1, y: area.y + 1, w: area.w - 2, h: area.h - 2 };
    const isHeld = state.heldItem !== null && state.heldItem.item.id === item.id;
    if (isHeld) continue;
    const over = hover !== null && hover.col >= item.x && hover.col < item.x + dims.width && hover.row >= item.y && hover.row < item.y + dims.height;
    drawItem(ctx, view.art, item, plateBox, state.selectedItemId === item.id, over && held === null);
  }
}

function containerSprite(view: LootView): PixelSprite | null {
  const art = view.containerArt ?? (view.art && view.state.containerKind ? view.art.containers[view.state.containerKind] : null);
  if (!art) return null;
  const hasItems = view.state.containerGrid.items.length > 0;
  return hasItems ? (art.closed ?? art.opened ?? null) : (art.opened ?? art.closed ?? null);
}

function gearMark(view: LootView, slot: GearSlotId): 'valid' | 'invalid' | 'none' {
  const held = view.state.heldItem;
  const over = view.hover && view.hover.kind === 'gear' && view.hover.slot === slot;
  if (!held || !over) return 'none';
  return isItemValidForGearSlot(held.item.type, slot) ? 'valid' : 'invalid';
}

function drawButton(ctx: CanvasRenderingContext2D, box: Box, label: string, color: string, hovered: boolean, active: boolean): void {
  fill(ctx, LINE, box.x, box.y + 1, box.w, box.h - 1);
  fill(ctx, active ? AMBER : RAISED, box.x, box.y, box.w, box.h - 1);
  ring(ctx, hovered ? AMBER : DIM, { x: box.x, y: box.y, w: box.w, h: box.h - 1 });
  drawText(ctx, label, box.x + 4, box.y + 2, active ? INK : hovered ? AMBER : color);
}

/** Paints the whole window over whatever is already on the canvas. The world is left as it is: dimming is the caller's call. */
export function drawLootUi(ctx: CanvasRenderingContext2D, view: LootView, layout: LootLayout): void {
  const { state } = view;
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;

  if (layout.container) {
    const dock = layout.container;
    plate(ctx, dock, 0.85);
    drawTitle(ctx, upper(state.containerTitle), dock, `${state.containerGrid.items.length} ITEMS`);
    const sprite = containerSprite(view);
    if (sprite) {
      ctx.globalAlpha = 0.85;
      const fit = Math.max(1, Math.floor(Math.min(dock.board.w / sprite.w, dock.board.h / sprite.h)));
      drawCentred(ctx, sprite, dock.board, fit);
      ctx.globalAlpha = 1;
    }
    drawBoard(ctx, view, dock.board, true);
  }

  const dock = layout.survivor;
  plate(ctx, dock, 0.9);
  drawTitle(ctx, 'SURVIVOR INVENTORY', dock);
  const tier = tierName(state);
  drawText(ctx, tier, dock.x + dock.w - PAD - textWidth(tier), dock.y + PAD + 1, SICK);

  for (const slot of layout.gear) {
    const item = state.gear[slot.id];
    const mark = gearMark(view, slot.id);
    fill(ctx, RAISED, slot.x, slot.y, slot.w, slot.h);
    ring(ctx, mark === 'valid' ? SICK : mark === 'invalid' ? BLOOD : item ? DIM : LINE, slot);
    const tag = GEAR_TAG[slot.id];
    drawText(ctx, tag, slot.x + Math.round((slot.w - textWidth(tag)) / 2), slot.y + 3, DIM);
    const body = { x: slot.x, y: slot.y + 9, w: slot.w, h: slot.h - 9 };
    if (!item) {
      drawText(ctx, 'EMPTY', body.x + Math.round((body.w - textWidth('EMPTY')) / 2), body.y + Math.round(body.h / 2) - 2, DIM);
      continue;
    }
    const sprite = view.art ? lootSprite(view.art, item.type, false) : null;
    if (sprite) drawCentred(ctx, sprite, body, 2);
    const badge = lootBadge(item.count, item.ammo);
    if (badge !== '') drawOutlinedText(ctx, badge.toUpperCase(), slot.x + slot.w - textWidth(badge) / 2 - 3, slot.y + slot.h - FONT_HEIGHT - 2, BONE);
  }

  for (const board of [layout.pack, layout.candy, layout.pockets]) {
    drawText(ctx, board.title, board.x, board.y - 8, DIM);
    drawBoard(ctx, view, board, false);
  }

  const holding = state.heldItem !== null;
  for (const button of layout.buttons) {
    const hovered = view.hover !== null && view.hover.kind === 'button' && view.hover.id === button.id;
    drawButton(ctx, button, button.label, button.id === 'close' ? BLOOD : BONE, hovered, button.id === 'rotate' && holding);
  }

  const held = state.heldItem;
  if (held && view.pointer && view.art) {
    const sprite = lootSprite(view.art, held.item.type, false);
    if (sprite) drawSpriteScaled(ctx, sprite, view.pointer.x, view.pointer.y, 1);
  }
  ctx.imageSmoothingEnabled = smoothing;
}
