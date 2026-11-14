import type { ArtBook, PixelSprite } from '../art/types.ts';
import type { ContainerArt } from '../art/containers.ts';
import { backpackDef } from '../../shared/backpack.ts';
import { getItemFootprint, type GridItem, type InventoryGrid } from '../../shared/grid-inventory.ts';
import { drawOutlinedText, drawText, FONT_HEIGHT, textWidth } from './bitmap-font.ts';
import { drawSpriteScaled, spriteCanvas } from './sprite-cache.ts';
import { stageBox, stageOffset, stageSprite } from '../game/inventory/container-stage.ts';
import { cellPhase, itemHidden, searchSweep, sweepRanks } from '../game/inventory/search-overlay.ts';
import {
  computeTileHighlight,
  formatItemName,
  GEAR_SLOT_DEFS,
  isItemValidForGearSlot,
  type DualLootState,
  type GearSlotId,
  type GridIdentifier,
} from '../game/inventory/dual-loot-modal.ts';
import { longSprite, lootBadge, lootSprite } from '../game/inventory/loot-item-art.ts';

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
export const TILE = 17;
const PAD = 3;
const HEAD = 9;
const GEAR_W = 40;
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
  /** Null when the bench hides the survivor's own docks. */
  readonly survivor: Box | null;
  readonly pack: GridBox | null;
  readonly pockets: GridBox | null;
  readonly candy: GridBox | null;
  readonly gear: readonly (Box & { readonly id: GearSlotId })[];
  readonly buttons: readonly (Box & { readonly id: 'rotate' | 'close'; readonly label: string })[];
  readonly editor: EditorLayout | null;
  readonly library: { readonly box: Box; readonly cells: readonly (Box & LibraryEntry)[] } | null;
}

/** The dev bench's edit panel buttons. */
export type EditId =
  | 'prev' | 'next' | 'mode' | 'colsDown' | 'colsUp' | 'rowsDown' | 'rowsUp' | 'wDown' | 'wUp' | 'hDown' | 'hUp' | 'clear' | 'save'
  | 'lookPrev' | 'lookNext' | 'grid';

/** The look (sprite style) the bench is editing, among the looks of its kind, and whose grid it edits. */
export interface LookEditView {
  /** This look's place among its kind's looks, 1-based. */
  readonly index: number;
  readonly count: number;
  /** The kind's original look: its grid is the base every look without its own uses. */
  readonly base: boolean;
  /** This look has a grid of its own instead of the base. */
  readonly own: boolean;
  /** How many of the kind's looks follow the base grid. */
  readonly onBase: number;
}

/** What the dev bench shows in its edit panel: the container's size and the selected item's footprint. */
export interface LootEditView {
  readonly on: boolean;
  readonly cols: number;
  readonly rows: number;
  readonly item: { readonly type: string; readonly width: number; readonly height: number } | null;
  /** A line of help along the bottom of the screen. */
  readonly hint?: string;
  /** Where this object is in the list the bench steps through, such as "3 OF 17". */
  readonly position?: string;
  /** The dev bench shows only the container and the editor: the survivor's backpack, pockets, gear and buttons are left out. */
  readonly benchOnly?: boolean;
  /** The bench's library of containers, drawn at in-game size where the survivor's dock would be. */
  readonly library?: readonly LibraryEntry[];
  /** The library entry the editor is showing, outlined. */
  readonly libraryCurrent?: string;
  /** The library's heading, such as "LOOKS". */
  readonly libraryTitle?: string;
  /** Set when the container comes in more than one look: draws the toolbar's look row. */
  readonly look?: LookEditView;
}

export interface EditorLayout {
  readonly box: Box;
  readonly lines: readonly { readonly x: number; readonly y: number; readonly text: string }[];
  readonly buttons: readonly (Box & { readonly id: EditId; readonly label: string })[];
}

export type LootHit =
  | { readonly kind: 'edit'; readonly id: EditId }
  | { readonly kind: 'cell'; readonly gridId: GridIdentifier; readonly col: number; readonly row: number }
  | { readonly kind: 'gear'; readonly slot: GearSlotId }
  | { readonly kind: 'button'; readonly id: 'rotate' | 'close' }
  | { readonly kind: 'library'; readonly id: string };

/** One container in the bench's library: its drawing at in-game size, and the label under it. */
export interface LibraryEntry {
  readonly id: string;
  readonly label: string;
  readonly art: ContainerArt | null;
  /** A short tag in the cell's corner, such as "OWN" for a look with its own grid. */
  readonly tag?: string;
}

export interface LootView {
  readonly state: DualLootState;
  readonly art: ArtBook | null;
  readonly containerArt: ContainerArt | null;
  readonly hover: LootHit | null;
  /** The pointer in buffer pixels, for the item in hand. */
  readonly pointer: { readonly x: number; readonly y: number } | null;
  /** Set on the dev bench only: draws the edit panel. */
  readonly edit?: LootEditView | null;
}

function upper(text: string): string {
  return text.toUpperCase();
}

function gridBox(id: GridIdentifier, grid: InventoryGrid, title: string, x: number, y: number): GridBox {
  return { id, grid, title, x, y, w: grid.cols * TILE, h: grid.rows * TILE };
}

/** Where everything goes for a view of this size: the container on the left, the survivor's gap in the middle, the bag on the right. */
export function layoutLootUi(state: DualLootState, viewW: number, viewH: number, edit: LootEditView | null = null): LootLayout {
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
  const sh = HEAD + GAP + gridsH + GAP + BUTTON_H + PAD * 2;
  const sx = viewW - EDGE - sw;
  // With the editor's toolbar up, the docks centre in the space under it and above the help line.
  const top = edit ? editorTop(edit) : 0;
  const room = viewH - top - (edit ? EDITOR_BOTTOM : 0);
  const margin = edit ? 2 : EDGE;
  // The gear row hangs along the bottom centre of the whole canvas; the survivor dock stays above it.
  const gearY = viewH - (edit ? EDITOR_BOTTOM : 0) - EDGE - GEAR_H;
  const sy = Math.max(top + margin, Math.min(top + Math.round((room - sh) / 2), gearY - GAP - sh));

  const gx = sx + PAD;
  const gridsY = sy + PAD + HEAD + GAP;
  const packBox = gridBox('backpack', pack, `PACK ${pack.cols}X${pack.rows}`, gx, gridsY + 8);
  const pocketsBox = gridBox('pockets', state.pocketsGrid, 'POCKETS', gx, gridsY + packH + GAP + 8);
  const candyBox = gridBox('candyBag', state.candyBagGrid, 'CANDY', gx + innerW - candyW, gridsY + 8);

  const gearX = Math.round((viewW - gearW) / 2);
  const gear = GEAR_SLOT_DEFS.map((def, i) => ({ id: def.id, x: gearX + i * (GEAR_W + GAP), y: gearY, w: GEAR_W, h: GEAR_H }));

  const buttonY = sy + sh - PAD - BUTTON_H;
  const rotateW = textWidth('[R] ROTATE'.replace(/[[\]]/g, '')) + 8;
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
    const y = top + Math.max(margin, Math.round((room - h) / 2));
    const board = gridBox('container', grid, upper(state.containerTitle), x + Math.round((w - boardW) / 2), y + PAD + HEAD + GAP);
    container = { x, y, w, h, board };
  }

  const survivor: Box = { x: sx, y: sy, w: sw, h: sh };
  if (edit?.benchOnly) {
    const library = edit.library ? layoutLibrary(edit.library, viewW, viewH, top, EDITOR_BOTTOM, edit.libraryCurrent) : null;
    return { container, survivor: null, pack: null, pockets: null, candy: null, gear: [], buttons: [], editor: layoutEditor(edit, viewW), library };
  }
  return { container, survivor, pack: packBox, pockets: pocketsBox, candy: candyBox, gear, buttons, editor: edit ? layoutEditor(edit, viewW) : null, library: null };
}

const GEAR_SLOT_COUNT = GEAR_SLOT_DEFS.length;

/** The library sits on the right, where the survivor's dock was. Each cell is a container drawn at in-game size. */
function layoutLibrary(entries: readonly LibraryEntry[], viewW: number, viewH: number, top: number, bottom: number, current?: string) {
  const sprites = entries.map((entry) => (entry.art ? stageSprite(entry.art, true) : null));
  const cellW = Math.max(40, ...sprites.map((s) => (s ? s.w : 0)), ...entries.map((e) => textWidth(upper(e.label)) / 1)) + 4;
  const cellH = Math.max(0, ...sprites.map((s) => (s ? s.h : 0))) + ROW_H + 4;
  const maxW = Math.round(viewW * 0.42);
  const cols = Math.max(1, Math.floor((maxW - PAD * 2) / cellW));
  const w = cols * cellW + PAD * 2;
  const x = viewW - EDGE - w;
  const maxRows = Math.max(1, Math.floor((viewH - top - bottom - HEAD - PAD * 2 - EDGE) / cellH));
  // A window of the entries that always holds the current one, so the one being edited is never cut off.
  const span = cols * maxRows;
  const at = Math.max(0, entries.findIndex((entry) => entry.id === current));
  const start = Math.max(0, Math.min(entries.length - span, at - Math.floor(span / 2)));
  const shown = entries.slice(start, start + span);
  const rows = Math.ceil(shown.length / cols);
  const y = top + EDGE;
  const h = HEAD + PAD * 2 + rows * cellH;
  const cells = shown.map((entry, i) => ({ ...entry, x: x + PAD + (i % cols) * cellW, y: y + HEAD + PAD + Math.floor(i / cols) * cellH, w: cellW, h: cellH }));
  return { box: { x, y, w, h }, cells };
}

const ROW_H = 11;
/** Space the editor's toolbar takes at the top, and its help line at the bottom. */
const editorTop = (edit: LootEditView): number => EDGE + ROW_H * (edit.look ? 2 : 1) + PAD * 2 + 3;
const EDITOR_BOTTOM = 14;

/** A toolbar along the top: mode, the container's size, the selected item's footprint, clear and save. The docks sit below it. */
function layoutEditor(edit: LootEditView, viewW: number): EditorLayout {
  const lines: { x: number; y: number; text: string }[] = [];
  const buttons: (Box & { id: EditId; label: string })[] = [];
  const y = EDGE;
  const h = ROW_H + PAD * 2;
  const by = y + PAD;
  let x = EDGE + PAD;
  const SEP = 5;
  const wide = (id: EditId, label: string): void => {
    const w = textWidth(label) + 6;
    buttons.push({ id, label, x, y: by, w, h: ROW_H - 2 });
    x += w + SEP;
  };
  const stepper = (name: string, value: number, down: EditId, up: EditId): void => {
    const text = `${name} ${value}`;
    lines.push({ x, y: by + 2, text });
    x += textWidth(text) + 4;
    buttons.push({ id: down, label: '-', x, y: by, w: 11, h: ROW_H - 2 });
    buttons.push({ id: up, label: '+', x: x + 12, y: by, w: 11, h: ROW_H - 2 });
    x += 23 + SEP;
  };
  wide('prev', 'PREV');
  wide('next', 'NEXT');
  if (edit.position) {
    lines.push({ x: x - 3, y: by + 2, text: edit.position });
    x += textWidth(edit.position) + SEP;
  }
  wide('mode', edit.on ? 'MODE EDIT' : 'MODE PLAY');
  stepper('COLS', edit.cols, 'colsDown', 'colsUp');
  stepper('ROWS', edit.rows, 'rowsDown', 'rowsUp');
  if (edit.item) {
    const name = upper(formatItemName(edit.item.type)).slice(0, 10);
    lines.push({ x, y: by + 2, text: name });
    x += textWidth(name) + SEP;
    stepper('W', edit.item.width, 'wDown', 'wUp');
    stepper('H', edit.item.height, 'hDown', 'hUp');
  }
  wide('clear', 'CLEAR');
  wide('save', 'SAVE');
  const look = edit.look;
  if (!look) return { box: { x: EDGE, y, w: viewW - EDGE * 2, h }, lines, buttons };
  // The look row: step through this kind's looks, and say (or switch) whose grid this look opens with.
  x = EDGE + PAD;
  const ly = by + ROW_H;
  const lookText = `LOOK ${look.index} OF ${look.count}`;
  buttons.push({ id: 'lookPrev', label: '<', x, y: ly, w: 11, h: ROW_H - 2 });
  buttons.push({ id: 'lookNext', label: '>', x: x + 12, y: ly, w: 11, h: ROW_H - 2 });
  x += 23 + SEP;
  lines.push({ x, y: ly + 2, text: lookText });
  x += textWidth(lookText) + SEP;
  if (look.base) {
    lines.push({ x, y: ly + 2, text: `BASE GRID: ${look.onBase} OF ${look.count} LOOKS USE IT` });
  } else {
    const label = look.own ? 'OWN GRID' : 'BASE GRID';
    const w = textWidth(label) + 6;
    buttons.push({ id: 'grid', label, x, y: ly, w, h: ROW_H - 2 });
    x += w + SEP;
    lines.push({ x, y: ly + 2, text: look.own ? 'EDITS CHANGE THIS LOOK ONLY' : 'ON BASE: AN EDIT GIVES THIS LOOK ITS OWN GRID' });
  }
  return { box: { x: EDGE, y, w: viewW - EDGE * 2, h: h + ROW_H }, lines, buttons };
}

/** Short enough for a 32 pixel slot. */
const GEAR_TAG: Readonly<Record<GearSlotId, string>> = { primary: 'PRIMARY', secondary: 'SECOND', sidearm: 'SIDEARM', armor: 'ARMOR' };

/** The pack's tier, without the roman numeral: "SATCHEL". */
function tierName(state: DualLootState): string {
  const label = backpackDef(state.backpackTier).label;
  return upper(label.includes(': ') ? label.split(': ')[1] : label);
}

/** The item in hand, at the size the grid shows it, hung from the pointer. */
export function heldBox(item: GridItem, pointer: { readonly x: number; readonly y: number }): Box {
  const dims = getItemFootprint(item.type, item.rotated);
  const w = dims.width * TILE - 2;
  const h = dims.height * TILE - 2;
  return { x: Math.round(pointer.x - w / 2), y: Math.round(pointer.y - h / 2), w, h };
}

/** Where the held item's first cell is, as a point: the spot that decides which cell it would land on. */
export function heldAnchor(item: GridItem, pointer: { readonly x: number; readonly y: number }): { x: number; y: number } {
  const box = heldBox(item, pointer);
  return { x: box.x + Math.floor(TILE / 2), y: box.y + Math.floor(TILE / 2) };
}

function inside(box: Box, x: number, y: number): boolean {
  return x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
}

/** What is under a point, or null. */
export function lootHitAt(layout: LootLayout, x: number, y: number): LootHit | null {
  for (const button of layout.editor?.buttons ?? []) if (inside(button, x, y)) return { kind: 'edit', id: button.id };
  for (const button of layout.buttons) if (inside(button, x, y)) return { kind: 'button', id: button.id };
  for (const cell of layout.library?.cells ?? []) if (inside(cell, x, y)) return { kind: 'library', id: cell.id };
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

/**
 * An item's art, stretched to fill the whole footprint, so a two wide item reads two wide. A long item uses its
 * end-to-end drawing, turned a quarter when the item is. Smoothing stays off, so every art pixel is still a block.
 */
function drawStretched(ctx: CanvasRenderingContext2D, art: ArtBook, item: GridItem, box: Box): boolean {
  const long = longSprite(art, item.type);
  const sprite = long ?? lootSprite(art, item.type, false);
  if (!sprite) return false;
  const canvas = spriteCanvas(sprite);
  const w = box.w - 2;
  const h = box.h - 2;
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  if (long && item.rotated) {
    ctx.save();
    ctx.translate(box.x + Math.floor(box.w / 2), box.y + Math.floor(box.h / 2));
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(canvas, -Math.floor(h / 2), -Math.floor(w / 2), h, w);
    ctx.restore();
  } else {
    ctx.drawImage(canvas, box.x + 1, box.y + 1, w, h);
  }
  ctx.imageSmoothingEnabled = smoothing;
  return true;
}

function drawItem(ctx: CanvasRenderingContext2D, art: ArtBook | null, item: GridItem, box: Box, selected: boolean, hovered: boolean): void {
  ctx.globalAlpha = hovered ? 0.2 : 0.1;
  fill(ctx, selected ? AMBER : BONE, box.x, box.y, box.w, box.h);
  ctx.globalAlpha = 1;
  ring(ctx, selected ? AMBER : hovered ? BONE : DIM, box);
  if (art && drawStretched(ctx, art, item, box)) {
    // drawn: the art fills its footprint
  } else drawOutlinedText(ctx, upper(formatItemName(item.type)).slice(0, 8), box.x + box.w / 2, box.y + box.h / 2 - 2, BONE);
  const badge = lootBadge(item.count, item.ammo);
  if (badge !== '') drawOutlinedText(ctx, badge.toUpperCase(), box.x + box.w - textWidth(badge) / 2 - 2, box.y + box.h - FONT_HEIGHT - 2, BONE);
}

/** An item the search has found but not yet shown: its plate with a "?" on it. */
function drawHiddenItem(ctx: CanvasRenderingContext2D, box: Box): void {
  ctx.globalAlpha = 0.1;
  fill(ctx, AMBER, box.x, box.y, box.w, box.h);
  ctx.globalAlpha = 1;
  ring(ctx, DIM, box);
  drawOutlinedText(ctx, '?', box.x + box.w / 2, box.y + box.h / 2 - 2, AMBER);
}

function cellBox(board: GridBox, col: number, row: number, w = 1, h = 1): Box {
  return { x: board.x + col * TILE, y: board.y + row * TILE, w: w * TILE, h: h * TILE };
}

/** A cell that is not part of this container: a light darkening with dashed diagonals over it, so the object's art still shows through and the cell reads as switched off. */
function drawDisabledCell(ctx: CanvasRenderingContext2D, box: Box): void {
  fill(ctx, 'rgba(0,0,0,0.3)', box.x + 1, box.y + 1, TILE - 2, TILE - 2);
  ctx.fillStyle = 'rgba(147,141,122,0.32)';
  for (let j = 0; j < TILE - 4; j += 1) {
    for (let i = 0; i < TILE - 4; i += 1) {
      const onDiagonal = (i + j) % 4 === 0;
      const inDash = j % 6 < 4;
      if (onDiagonal && inDash) ctx.fillRect(box.x + 2 + i, box.y + 2 + j, 1, 1);
    }
  }
}

function drawBoard(ctx: CanvasRenderingContext2D, view: LootView, board: GridBox, translucent: boolean): void {
  const { state } = view;
  const grid = board.grid;
  // A container board is see-through: the object's art shows, and each cell tints it a little.
  if (!translucent) fill(ctx, INK, board.x - 1, board.y - 1, board.w + 2, board.h + 2);
  if (!translucent) ring(ctx, LINE, { x: board.x - 1, y: board.y - 1, w: board.w + 2, h: board.h + 2 });
  const hover = view.hover && view.hover.kind === 'cell' && view.hover.gridId === board.id ? view.hover : null;
  const held = state.heldItem ? state.heldItem.item : null;
  const blocked = new Set((grid.blocked ?? []).map((p) => `${p.x},${p.y}`));
  const ranks = sweepingNow(view) && board.id === 'container' ? sweepRanks(grid) : null;
  const sweep = searchSweep.value ?? 0;
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const box = cellBox(board, col, row);
      const phase = ranks ? cellPhase(ranks.rankOf(col, row), ranks.open, sweep) : 'read';
      // A void is not lit: it looks like any other cell until the head reaches it, then shows as a void.
      const shut = blocked.has(`${col},${row}`) && phase !== 'waiting';
      // A cell the search has not reached yet is blank: it covers the drawing underneath until its turn comes.
      const covered = ranks !== null && phase === 'waiting';
      const light = hover && hover.col === col && hover.row === row && held === null ? LINE : translucent && !covered ? 'rgba(11,12,16,0.35)' : RAISED;
      if (shut) {
        drawDisabledCell(ctx, box);
        continue;
      }
      fill(ctx, light, box.x + 1, box.y + 1, TILE - 2, TILE - 2);
      fill(ctx, INK, box.x + 1, box.y + 1, TILE - 2, 1);
      fill(ctx, INK, box.x + 1, box.y + 1, 1, TILE - 2);
      fill(ctx, LINE, box.x + 1, box.y + TILE - 2, TILE - 2, 1);
      fill(ctx, LINE, box.x + TILE - 2, box.y + 1, 1, TILE - 2);
      if (ranks && phase === 'read') fill(ctx, 'rgba(124,196,120,0.32)', box.x + 2, box.y + 2, TILE - 4, TILE - 4);
      if (phase === 'head') fill(ctx, AMBER, box.x + 1, box.y + 1, TILE - 2, TILE - 2);
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
    if (board.id === 'container' && itemHidden(item.id)) {
      drawHiddenItem(ctx, plateBox);
      continue;
    }
    drawItem(ctx, view.art, item, plateBox, state.selectedItemId === item.id, over && held === null);
  }
}

/** The search is under way: the container's grid is empty and being swept, and the drawing is still shut. */
function sweepingNow(view: LootView): boolean {
  return searchSweep.value !== null && view.state.containerGrid.items.length === 0;
}

function containerArtOf(view: LootView): ContainerArt | null {
  return view.containerArt ?? (view.art && view.state.containerKind ? view.art.containers[view.state.containerKind] : null);
}

/**
 * The container's picture, stretched so the box that holds both drawings covers the grid exactly. A cell then sits
 * over its own piece of the object, so where a valid cell is on the picture reads at a glance, and the blocked cells
 * fall on the parts that cannot hold anything. Each drawing is still placed by its anchor inside that box, so
 * emptying the container never shifts it. Smoothing stays off: every art pixel is a block, a little wider or taller.
 */
function drawContainerArt(ctx: CanvasRenderingContext2D, view: LootView, board: Box): void {
  const art = containerArtOf(view);
  if (!art) return;
  const box = stageBox(art);
  const sprite = stageSprite(art, !sweepingNow(view));
  if (!box || !sprite) return;
  const at = stageOffset(box, sprite);
  const x0 = board.x + Math.round((at.x / box.width) * board.w);
  const y0 = board.y + Math.round((at.y / box.height) * board.h);
  const x1 = board.x + Math.round(((at.x + sprite.w) / box.width) * board.w);
  const y1 = board.y + Math.round(((at.y + sprite.h) / box.height) * board.h);
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 0.9;
  ctx.drawImage(spriteCanvas(sprite), x0, y0, x1 - x0, y1 - y0);
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = smoothing;
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
  drawText(ctx, label, box.x + Math.round((box.w - textWidth(label)) / 2), box.y + 2, active ? INK : hovered ? AMBER : color);
}

function drawLibrary(ctx: CanvasRenderingContext2D, view: LootView, library: NonNullable<LootLayout['library']>): void {
  plate(ctx, library.box, 0.92);
  drawTitle(ctx, view.edit?.libraryTitle ?? 'CONTAINERS', library.box);
  for (const cell of library.cells) {
    const current = view.edit?.libraryCurrent === cell.id;
    const hovered = view.hover !== null && view.hover.kind === 'library' && view.hover.id === cell.id;
    fill(ctx, RAISED, cell.x, cell.y, cell.w, cell.h);
    ring(ctx, current ? AMBER : hovered ? BONE : LINE, cell);
    const sprite = cell.art ? stageSprite(cell.art, true) : null;
    if (sprite) {
      const canvas = spriteCanvas(sprite);
      const at = { x: cell.x + Math.round((cell.w - sprite.w) / 2), y: cell.y + 2 };
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(canvas, at.x, at.y, sprite.w, sprite.h);
    }
    const label = upper(cell.label);
    drawText(ctx, label, cell.x + Math.round((cell.w - textWidth(label)) / 2), cell.y + cell.h - ROW_H + 2, current ? AMBER : DIM);
    if (cell.tag) {
      const tag = upper(cell.tag);
      fill(ctx, INK, cell.x + 1, cell.y + 1, textWidth(tag) + 4, FONT_HEIGHT + 3);
      drawText(ctx, tag, cell.x + 3, cell.y + 2, SICK);
    }
  }
}

/** Paints the whole window over whatever is already on the canvas. The world is left as it is: dimming is the caller's call. */
export function drawLootUi(ctx: CanvasRenderingContext2D, view: LootView, given: LootLayout): void {
  const { state } = view;
  // The editor's panel is part of the layout, so a view that carries one lays itself out with it.
  const layout = view.edit && !given.editor ? layoutLootUi(state, ctx.canvas.width, ctx.canvas.height, view.edit) : given;
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;

  if (layout.container) {
    const dock = layout.container;
    plate(ctx, dock, 0.85);
    drawTitle(ctx, upper(state.containerTitle), dock, `${state.containerGrid.items.length} ITEMS`);
    drawContainerArt(ctx, view, dock.board);
    drawBoard(ctx, view, dock.board, true);
  }

  const dock = layout.survivor;
  if (dock) {
    plate(ctx, dock, 0.9);
    drawTitle(ctx, 'SURVIVOR INVENTORY', dock);
    const tier = tierName(state);
    drawText(ctx, tier, dock.x + dock.w - PAD - textWidth(tier), dock.y + PAD + 1, SICK);
  }

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
    if (sprite) {
      // The largest whole scale (at most 2) that fits the body, and a clip so nothing spills past the slot's frame.
      const scale = Math.max(1, Math.min(2, Math.floor(Math.min((body.w - 4) / sprite.w, (body.h - 4) / sprite.h))));
      ctx.save();
      ctx.beginPath();
      ctx.rect(slot.x + 1, slot.y + 1, slot.w - 2, slot.h - 2);
      ctx.clip();
      drawCentred(ctx, sprite, body, scale);
      ctx.restore();
    }
    const badge = lootBadge(item.count, item.ammo);
    if (badge !== '') drawOutlinedText(ctx, badge.toUpperCase(), slot.x + slot.w - textWidth(badge) / 2 - 3, slot.y + slot.h - FONT_HEIGHT - 2, BONE);
  }

  for (const board of [layout.pack, layout.candy, layout.pockets]) {
    if (!board) continue;
    drawText(ctx, board.title, board.x, board.y - 8, DIM);
    drawBoard(ctx, view, board, false);
  }

  if (layout.editor) {
    const editor = layout.editor;
    plate(ctx, editor.box, 0.92);
    for (const line of editor.lines) drawText(ctx, line.text, line.x, line.y, BONE);
    for (const button of editor.buttons) {
      const hovered = view.hover !== null && view.hover.kind === 'edit' && view.hover.id === button.id;
      const active = (button.id === 'mode' && view.edit?.on === true) || (button.id === 'grid' && view.edit?.look?.own === true);
      drawButton(ctx, button, button.label, button.id === 'save' ? SICK : BONE, hovered, active);
    }
  }

  if (layout.library) drawLibrary(ctx, view, layout.library);

  if (view.edit?.hint) drawOutlinedText(ctx, view.edit.hint, Math.round(ctx.canvas.width / 2), ctx.canvas.height - EDGE - FONT_HEIGHT, DIM);

  const holding = state.heldItem !== null;
  for (const button of layout.buttons) {
    const hovered = view.hover !== null && view.hover.kind === 'button' && view.hover.id === button.id;
    drawButton(ctx, button, button.label, button.id === 'close' ? BLOOD : BONE, hovered, button.id === 'rotate' && holding);
  }

  const held = state.heldItem;
  if (held && view.pointer) drawItem(ctx, view.art, held.item, heldBox(held.item, view.pointer), true, false);
  ctx.imageSmoothingEnabled = smoothing;
}
