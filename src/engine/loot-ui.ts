import type { ArtBook, PixelSprite } from '../art/types.ts';
import type { ContainerArt } from '../art/containers.ts';
import { backpackDef } from '../../shared/backpack.ts';
import { getItemFootprint, type GridItem, type InventoryGrid } from '../../shared/grid-inventory.ts';
import { drawOutlinedText, drawText, FONT_HEIGHT, textWidth } from './bitmap-font.ts';
import { drawSpriteScaled, spriteCanvas } from './sprite-cache.ts';
import { stageSprite } from '../game/inventory/container-stage.ts';
import { cellPhase, itemHidden, searchSweep, shownSweep, sweepRanks } from '../game/inventory/search-overlay.ts';
import { lerpRect, noteStageRect, toSpace, zoomFrame, zoomLandedAt } from '../game/inventory/container-zoom.ts';
import { drawStageArt, drawSweptStageArt } from './loot-container-art.ts';
import { bareCellLook, drawBareCell } from './loot-bare-cells.ts';
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
import { arrivalCamera, cellKey, motionOf, shakeOf } from '../game/inventory/move-motion.ts';
import { moveGridOf } from '../game/inventory/loot-moves.ts';
import { drawFlight, drawPop, drawPuffs, drawShake } from './loot-arrivals-draw.ts';

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

/** Where everything goes for a view of this size: candy on left, guns and pockets top center, container direct center, bag on right. */
export function layoutLootUi(state: DualLootState, viewW: number, viewH: number, edit: LootEditView | null = null): LootLayout {
  const pack = state.backpackGrid;
  const candy = state.candyBagGrid;
  const pockets = state.pocketsGrid;

  const top = edit ? editorTop(edit) : 0;
  const room = viewH - top - (edit ? EDITOR_BOTTOM : 0);
  const margin = edit ? 2 : EDGE;

  // 1. Guns (gear slots) top center
  const gearW = GEAR_SLOT_COUNT * GEAR_W + (GEAR_SLOT_COUNT - 1) * GAP;
  const gearX = Math.round((viewW - gearW) / 2);
  const gearY = top + (edit ? 4 : EDGE);
  const gear = GEAR_SLOT_DEFS.map((def, i) => ({ id: def.id, x: gearX + i * (GEAR_W + GAP), y: gearY, w: GEAR_W, h: GEAR_H }));

  // 2. Pockets to the left of the guns
  const pocketsW = pockets.cols * TILE;
  const pocketsX = gearX - 8 - pocketsW;
  const pocketsY = gearY + 8;
  const pocketsBox = gridBox('pockets', pockets, 'POCKETS', pocketsX, pocketsY);

  // 3. Candy bag to the left center (3x4)
  const candyW = candy.cols * TILE;
  const candyH = candy.rows * TILE;
  const candyX = EDGE;
  const candyY = top + Math.max(margin, Math.round((room - (candyH + 8)) / 2)) + 8;
  const candyBox = gridBox('candyBag', candy, 'CANDY', candyX, candyY);

  // 4. The bag (backpack) to the right center, with R ROTATE and ESC CLOSE buttons directly below
  const packW = pack.cols * TILE;
  const packH = pack.rows * TILE;
  const rotateW = textWidth('R ROTATE') + 8;
  const closeW = textWidth('ESC CLOSE') + 8;
  const buttonsW = rotateW + GAP + closeW;
  const rightW = Math.max(packW, buttonsW);
  const rightX = viewW - EDGE - rightW;
  const packX = rightX + Math.round((rightW - packW) / 2);
  const packTotalH = packH + 8 + GAP + BUTTON_H;
  const packY = top + Math.max(margin, Math.round((room - packTotalH) / 2)) + 8;
  const tierLabel = tierName(state);
  const packTitle = tierLabel ? `PACK ${pack.cols}X${pack.rows} ${tierLabel}` : `PACK ${pack.cols}X${pack.rows}`;
  const packBox = gridBox('backpack', pack, packTitle, packX, packY);

  const buttonY = packY + packH + GAP + 2;
  const buttons = [
    { id: 'rotate' as const, label: 'R ROTATE', x: rightX, y: buttonY, w: rotateW, h: BUTTON_H },
    { id: 'close' as const, label: 'ESC CLOSE', x: rightX + rotateW + GAP, y: buttonY, w: closeW, h: BUTTON_H },
  ];

  // 5. Container searching / open direct center center of screen, bounded so it never bleeds under gear, candy, or pack
  const hasContainer = state.containerGrid.items.length > 0 || Boolean(state.containerKind);
  let container: LootLayout['container'] = null;
  if (hasContainer) {
    const grid = state.containerGrid;
    const boardW = grid.cols * TILE;
    const boardH = grid.rows * TILE;
    const labelW = textWidth(upper(state.containerTitle)) + 6 + Math.max(textWidth('SEARCHING'), textWidth(`${grid.items.length} ITEMS`));
    const w = Math.max(boardW, labelW);
    const h = boardH + HEAD;
    const leftBound = candyX + candyW + GAP * 2;
    const rightBound = packX - GAP * 2;
    const topBound = gearY + GEAR_H + GAP * 2;
    const bottomBound = viewH - EDGE;
    const centerSpanX = rightBound - leftBound;
    const centerSpanY = bottomBound - topBound;
    const x = leftBound > 0 && centerSpanX > w ? leftBound + Math.round((centerSpanX - w) / 2) : Math.round((viewW - w) / 2);
    const y = topBound > 0 && centerSpanY > h ? topBound + Math.round((centerSpanY - h) / 2) : Math.max(topBound, top + Math.round((room - h) / 2));
    const boardX = leftBound > 0 && centerSpanX > boardW ? leftBound + Math.round((centerSpanX - boardW) / 2) : Math.round((viewW - boardW) / 2);
    const boardY = y + HEAD;
    const board = gridBox('container', grid, upper(state.containerTitle), boardX, boardY);
    container = edit ? { x: boardX - PAD, y: y - PAD, w: boardW + PAD * 2, h: h + PAD * 2, board } : { x, y, w, h, board };
  }

  if (edit?.benchOnly) {
    const library = edit.library ? layoutLibrary(edit.library, viewW, viewH, top, EDITOR_BOTTOM, edit.libraryCurrent) : null;
    return { container, survivor: null, pack: null, pockets: null, candy: null, gear: [], buttons: [], editor: layoutEditor(edit, viewW), library };
  }
  return { container, survivor: null, pack: packBox, pockets: pocketsBox, candy: candyBox, gear, buttons, editor: edit ? layoutEditor(edit, viewW) : null, library: null };
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
/** Where an item sits on screen, in buffer pixels: the plate it is drawn on. Null when its grid is not shown. */
export function itemPlateAt(layout: LootLayout, gridId: GridBox['id'], item: GridItem): Box | null {
  const board = [layout.container?.board, layout.pack, layout.pockets, layout.candy].find((each) => each?.id === gridId);
  if (!board) return null;
  const dims = getItemFootprint(item.type, item.rotated);
  const area = cellBox(board, item.x, item.y, dims.width, dims.height);
  return { x: area.x + 1, y: area.y + 1, w: area.w - 2, h: area.h - 2 };
}

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
  for (const button of layout.editor?.buttons ?? []) {
    const isOverEditButton = inside(button, x, y);
    if (isOverEditButton) return { kind: 'edit', id: button.id };
  }
  for (const button of layout.buttons) {
    const isOverButton = inside(button, x, y);
    if (isOverButton) return { kind: 'button', id: button.id };
  }
  for (const cell of layout.library?.cells ?? []) {
    const isOverLibraryCell = inside(cell, x, y);
    if (isOverLibraryCell) return { kind: 'library', id: cell.id };
  }
  for (const slot of layout.gear) {
    const isOverGearSlot = inside(slot, x, y);
    if (isOverGearSlot) return { kind: 'gear', slot: slot.id };
  }
  const boards = [layout.container?.board, layout.pack, layout.pockets, layout.candy];
  for (const board of boards) {
    const isBoardMissing = !board;
    if (isBoardMissing) continue;
    const isOutsideBoard = !inside(board, x, y);
    if (isOutsideBoard) continue;
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
  const hasLongArt = Boolean(long);
  const isItemTurned = Boolean(item.rotated);
  const shouldTurnLongArt = hasLongArt && isItemTurned;
  if (shouldTurnLongArt) {
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
  const idleRing = hovered ? BONE : DIM;
  ring(ctx, selected ? AMBER : idleRing, box);
  const hasArt = art !== null;
  const didDrawArt = hasArt && drawStretched(ctx, art, item, box);
  if (didDrawArt) {
    // drawn: the art fills its footprint
  } else drawOutlinedText(ctx, upper(formatItemName(item.type)).slice(0, 8), box.x + box.w / 2, box.y + box.h / 2 - 2, BONE);
  const badge = lootBadge(item.count, item.ammo);
  const hasBadge = badge !== '';
  if (hasBadge) drawOutlinedText(ctx, badge.toUpperCase(), box.x + box.w - textWidth(badge) / 2 - 2, box.y + box.h - FONT_HEIGHT - 2, BONE);
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
      const shouldFleck = onDiagonal && inDash;
      if (shouldFleck) ctx.fillRect(box.x + 2 + i, box.y + 2 + j, 1, 1);
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
  const sweep = shownSweep.value ?? 0;
  // In game the container's drawing is the board: no plate, no cell edges, no voids (loot-bare-cells.ts).
  const bare = translucent && !view.edit;
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const box = cellBox(board, col, row);
      if (bare) {
        const hovered = hover !== null && hover.col === col && hover.row === row;
        const rank = ranks ? ranks.rankOf(col, row) : null;
        const open = ranks ? ranks.open : 0;
        const look = bareCellLook({ rank, open, sweep, hovered, holding: held !== null, blocked: blocked.has(`${col},${row}`) });
        if (look) drawBareCell(ctx, look, box.x, box.y, TILE);
        const bareMark = computeTileHighlight(grid, col, row, hover ? hover.col : null, hover ? hover.row : null, held, board.id, state.candyBagGrid);
        const isBareCellMarked = bareMark !== 'none';
        if (isBareCellMarked) fill(ctx, bareMark === 'valid' ? SICK : BLOOD, box.x + 2, box.y + 2, TILE - 4, TILE - 4);
        continue;
      }
      const phase = ranks ? cellPhase(ranks.rankOf(col, row), ranks.open, sweep) : 'read';
      // A void is not lit: it looks like any other cell until the head reaches it, then shows as a void.
      const shut = blocked.has(`${col},${row}`) && phase !== 'waiting';
      const covered = ranks !== null && phase === 'waiting';
      const isHoveredCell = hover && hover.col === col && hover.row === row && held === null;
      const isDimmed = translucent && !covered;
      const fallbackLight = translucent ? 'transparent' : RAISED;
      const unhoveredLight = isDimmed ? 'rgba(11,12,16,0.35)' : fallbackLight;
      const light = isHoveredCell ? LINE : unhoveredLight;
      if (shut) {
        if (view.edit) drawDisabledCell(ctx, box);
        continue;
      }
      fill(ctx, light, box.x + 1, box.y + 1, TILE - 2, TILE - 2);
      fill(ctx, INK, box.x + 1, box.y + 1, TILE - 2, 1);
      fill(ctx, INK, box.x + 1, box.y + 1, 1, TILE - 2);
      fill(ctx, LINE, box.x + 1, box.y + TILE - 2, TILE - 2, 1);
      fill(ctx, LINE, box.x + TILE - 2, box.y + 1, 1, TILE - 2);
      const isSweepHead = phase === 'head';
      if (isSweepHead) fill(ctx, AMBER, box.x + 1, box.y + 1, TILE - 2, TILE - 2);
      const mark = computeTileHighlight(grid, col, row, hover ? hover.col : null, hover ? hover.row : null, held, board.id, state.candyBagGrid);
      const isCellMarked = mark !== 'none';
      if (isCellMarked) fill(ctx, mark === 'valid' ? SICK : BLOOD, box.x + 2, box.y + 2, TILE - 4, TILE - 4);
    }
  }
  for (const item of grid.items) {
    const dims = getItemFootprint(item.type, item.rotated);
    const area = cellBox(board, item.x, item.y, dims.width, dims.height);
    const plateBox = { x: area.x + 1, y: area.y + 1, w: area.w - 2, h: area.h - 2 };
    const isHeld = state.heldItem !== null && state.heldItem.item.id === item.id;
    if (isHeld) continue;
    const over = hover !== null && hover.col >= item.x && hover.col < item.x + dims.width && hover.row >= item.y && hover.row < item.y + dims.height;
    const isContainerBoard = board.id === 'container';
    const isItemConcealed = isContainerBoard && itemHidden(item.id);
    if (isItemConcealed) {
      drawHiddenItem(ctx, plateBox);
      continue;
    }
    // Moving: it flies in from the world or the cell it left first (drawn after every board, over them), then pops.
    const arriving = motionOf(item.id);
    const isFlyingIn = arriving?.phase === 'fly';
    if (isFlyingIn) {
      const drawIn = (box: Box) => drawItem(ctx, view.art, item, box, false, false);
      flights.push(() => drawFlight(ctx, arriving.motion, plateBox, arriving.t, drawIn) || drawIn(plateBox));
      continue;
    }
    drawItem(ctx, view.art, item, plateBox, state.selectedItemId === item.id, over && held === null);
    const isPoppingIn = arriving?.phase === 'pop';
    if (isPoppingIn) drawPop(ctx, plateBox, arriving.t);
  }
  // A cell a refused move was aimed at shakes red.
  const moveGrid = moveGridOf(board.id);
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const shake = shakeOf(cellKey(moveGrid, col, row));
      const isShaking = shake !== null;
      if (isShaking) drawShake(ctx, cellBox(board, col, row), shake);
    }
  }
}

/** Items in flight this frame, drawn once every board is down so they pass over the window. */
const flights: (() => void)[] = [];

/** The search is under way: the container's grid is empty and being swept, and the drawing is still shut. */
function sweepingNow(view: LootView): boolean {
  return searchSweep.value !== null && view.state.containerGrid.items.length === 0;
}

function containerArtOf(view: LootView): ContainerArt | null {
  return view.containerArt ?? (view.art && view.state.containerKind ? view.art.containers[view.state.containerKind] : null);
}

/** The container's picture stretched over the rect (the grid, or where the zoom has got to). */
function drawContainerArt(ctx: CanvasRenderingContext2D, view: LootView, rect: Box, alpha = 0.92): void {
  const art = containerArtOf(view);
  if (art) drawStageArt(ctx, art, !sweepingNow(view), rect, alpha);
}

/** The landed drawing: while the search runs it comes open cell by cell behind the sweep head. */
function drawLandedArt(ctx: CanvasRenderingContext2D, view: LootView, board: GridBox): void {
  const art = containerArtOf(view);
  if (!art) return;
  const isSweepOver = !sweepingNow(view);
  if (isSweepOver) {
    drawStageArt(ctx, art, true, board, 0.92);
    return;
  }
  const ranks = sweepRanks(board.grid);
  const sweep = shownSweep.value ?? 0;
  drawSweptStageArt(ctx, art, board, board.grid.cols, board.grid.rows, (col, row) => cellPhase(ranks.rankOf(col, row), ranks.open, sweep) === 'read', 0.92);
}

/** How long the container's labels take to fade in once its drawing lands. */
const LABEL_FADE_MS = 160;

/** Text with a pixel of ink under it, so it reads over the world with no plate behind it. */
function floatingText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
  drawText(ctx, text, x + 1, y + 1, INK);
  drawText(ctx, text, x, y, color);
}

/**
 * The container in game: its own drawing zooms out of the world to the grid, and only once it lands do the grid and a
 * floating label show. No card goes round it. The dev bench keeps its plate and title.
 */
function drawContainerDock(ctx: CanvasRenderingContext2D, view: LootView, dock: NonNullable<LootLayout['container']>): void {
  const { state } = view;
  const count = `${state.containerGrid.items.length} ITEMS`;
  if (view.edit) {
    plate(ctx, dock, 0.85);
    drawTitle(ctx, upper(state.containerTitle), dock, count);
  }
  const zoom = view.edit ? null : zoomFrame();
  const camera = arrivalCamera();
  const hasZoom = zoom !== null;
  const isZoomInFlight = hasZoom && !zoom.landed;
  if (isZoomInFlight) {
    const from = zoom.from;
    const isZoomKind = zoom.kind === 'zoom';
    const hasStartRect = from !== null;
    const hasCamera = camera !== null;
    const shouldFlyFromStart = isZoomKind && hasStartRect && hasCamera;
    if (shouldFlyFromStart) drawContainerArt(ctx, view, lerpRect(toSpace(from, camera, 'buffer'), dock.board, zoom.eased), 0.92);
    else drawContainerArt(ctx, view, dock.board, zoom.kind === 'fade' ? 0.92 * zoom.eased : 0);
    return;
  }
  drawLandedArt(ctx, view, dock.board);
  drawBoard(ctx, view, dock.board, true);
  if (view.edit) return;
  const board = dock.board;
  const label = sweepingNow(view) ? 'SEARCHING' : count;
  // The labels fade in as the drawing settles, instead of popping on with the landing.
  const before = ctx.globalAlpha;
  ctx.globalAlpha = Math.min(1, Math.max(0, (performance.now() - zoomLandedAt()) / LABEL_FADE_MS));
  floatingText(ctx, upper(state.containerTitle), dock.x, board.y - 8, AMBER);
  floatingText(ctx, label, dock.x + dock.w - textWidth(label), board.y - 8, DIM);
  ctx.globalAlpha = before;
  noteStageRect('buffer', board, !sweepingNow(view));
}

function gearMark(view: LootView, slot: GearSlotId): 'valid' | 'invalid' | 'none' {
  const held = view.state.heldItem;
  const over = view.hover && view.hover.kind === 'gear' && view.hover.slot === slot;
  const isHandEmpty = !held;
  const isNotOverSlot = !over;
  const shouldShowNoMark = isHandEmpty || isNotOverSlot;
  if (shouldShowNoMark) return 'none';
  return isItemValidForGearSlot(held.item.type, slot) ? 'valid' : 'invalid';
}

function drawButton(ctx: CanvasRenderingContext2D, box: Box, label: string, color: string, hovered: boolean, active: boolean): void {
  fill(ctx, LINE, box.x, box.y + 1, box.w, box.h - 1);
  fill(ctx, active ? AMBER : RAISED, box.x, box.y, box.w, box.h - 1);
  ring(ctx, hovered ? AMBER : DIM, { x: box.x, y: box.y, w: box.w, h: box.h - 1 });
  const idleLabel = hovered ? AMBER : color;
  drawText(ctx, label, box.x + Math.round((box.w - textWidth(label)) / 2), box.y + 2, active ? INK : idleLabel);
}

function drawLibrary(ctx: CanvasRenderingContext2D, view: LootView, library: NonNullable<LootLayout['library']>): void {
  plate(ctx, library.box, 0.92);
  drawTitle(ctx, view.edit?.libraryTitle ?? 'CONTAINERS', library.box);
  for (const cell of library.cells) {
    const current = view.edit?.libraryCurrent === cell.id;
    const hovered = view.hover !== null && view.hover.kind === 'library' && view.hover.id === cell.id;
    fill(ctx, RAISED, cell.x, cell.y, cell.w, cell.h);
    const idleRing = hovered ? BONE : LINE;
    ring(ctx, current ? AMBER : idleRing, cell);
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
    const unmarkedRing = item ? DIM : LINE;
    const invalidRing = mark === 'invalid' ? BLOOD : unmarkedRing;
    ring(ctx, mark === 'valid' ? SICK : invalidRing, slot);
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
    const hasBadge = badge !== '';
    if (hasBadge) drawOutlinedText(ctx, badge.toUpperCase(), slot.x + slot.w - textWidth(badge) / 2 - 3, slot.y + slot.h - FONT_HEIGHT - 2, BONE);
  }

  for (const board of [layout.pack, layout.candy, layout.pockets]) {
    if (!board) continue;
    drawText(ctx, board.title, board.x, board.y - 8, DIM);
    drawBoard(ctx, view, board, false);
  }

  if (layout.container) {
    drawContainerDock(ctx, view, layout.container);
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

  drawPuffs(ctx);
  for (const flight of flights.splice(0)) flight();
  const held = state.heldItem;
  const pointer = view.pointer;
  const isCarrying = held !== null && pointer !== null;
  if (isCarrying) drawItem(ctx, view.art, held.item, heldBox(held.item, pointer), true, false);
  ctx.imageSmoothingEnabled = smoothing;
}
