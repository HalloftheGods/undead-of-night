<template>
  <v-sheet class="canvas-loot-backdrop" color="transparent" @contextmenu.prevent>
    <canvas
      ref="canvasRef"
      class="canvas-loot"
      :style="{ width: `${VIEW_W * scale}px`, height: `${VIEW_H * scale}px` }"
      :width="VIEW_W"
      :height="VIEW_H"
      @pointermove="onMove"
      @pointerleave="onLeave"
      @click="onClick"
      @dblclick="onDoubleClick"
    />
    <p class="canvas-loot-note">{{ note }}</p>
  </v-sheet>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { ArtBook } from '../../art/types.ts';
import type { ContainerArt } from '../../art/containers.ts';
import {
  autoPackItem,
  canPlaceItem,
  createInventoryGrid,
  findItemAtTile,
  ITEM_FOOTPRINTS,
  placeItem,
  removeItem,
  type GridFootprint,
  type GridPoint,
  type InventoryGrid,
} from '../../../shared/grid-inventory.ts';
import type { ContainerKind } from '../../../shared/containers.ts';
import { drawLootUi, layoutLootUi, lootHitAt, type EditId, type LootEditView, type LootHit } from '../../engine/loot-ui.ts';
import {
  createDualLootState,
  pickUpItemFromGear,
  pickUpItemFromGrid,
  placeHeldItemInGear,
  placeHeldItemInGrid,
  quickTransferBetweenInventories,
  resolveGridById,
  returnHeldItemToSource,
  rotateActiveItem,
  type GridIdentifier,
} from '../../game/inventory/dual-loot-modal.ts';

interface Props {
  art: ArtBook | null;
  title: string;
  kind: ContainerKind;
  grid: InventoryGrid;
  containerArt?: ContainerArt | null;
}

const props = withDefaults(defineProps<Props>(), { containerArt: null });
const emit = defineEmits<{
  close: [];
  /** The container's size changed; the bench keeps it and saves it. */
  size: [payload: { cols: number; rows: number }];
  blocked: [cells: GridPoint[]];
  /** An item's footprint changed. */
  footprint: [payload: { type: string; width: number; height: number }];
  save: [];
}>();

/** The game draws into a 480 by 270 buffer and scales it by whole numbers; this does the same. */
const VIEW_W = 480;
const VIEW_H = 270;
const MIN_SIDE = 1;
const MAX_SIDE = 12;
const MAX_FOOTPRINT = 6;
const PACK_SAMPLE = ['bandage', 'medkit', 'pistol_ammo', 'water_bottle'];

const canvasRef = ref<HTMLCanvasElement | null>(null);
const scale = ref(Math.max(1, Math.floor(Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H) * 0.95)));
const editOn = ref(true);
const selectedType = ref<string | null>(null);
const note = computed(() =>
  editOn.value
    ? 'Edit: click a container cell to block it, click an item to select it, then resize it. Switch MODE to play-test.'
    : 'Play: click to pick up and place, R rotates, Esc closes. Switch MODE to edit.'
);

const state = createDualLootState({
  containerKind: props.kind,
  containerTitle: props.title,
  containerGrid: props.grid,
  backpackTier: 'satchel',
});
PACK_SAMPLE.forEach((type, i) => autoPackItem(state.backpackGrid, { id: `pack-${i}`, type, rotated: false }));

/** The footprints as the game has them, put back when the editor closes so a preview never changes a run. */
const originals = new Map<string, GridFootprint | undefined>();

let hover: LootHit | null = null;
let pointer: { x: number; y: number } | null = null;

function footprintOf(type: string): GridFootprint {
  return ITEM_FOOTPRINTS[type] ?? { width: 1, height: 1 };
}

function editView(): LootEditView {
  const type = selectedType.value;
  const fp = type ? footprintOf(type) : null;
  return {
    on: editOn.value,
    cols: state.containerGrid.cols,
    rows: state.containerGrid.rows,
    item: type && fp ? { type, width: fp.width, height: fp.height } : null,
  };
}

function bufferPoint(event: MouseEvent): { x: number; y: number } {
  const rect = canvasRef.value!.getBoundingClientRect();
  return { x: Math.floor(((event.clientX - rect.left) * VIEW_W) / rect.width), y: Math.floor(((event.clientY - rect.top) * VIEW_H) / rect.height) };
}

function currentLayout() {
  return layoutLootUi(state, VIEW_W, VIEW_H, editView());
}

function redraw(): void {
  const canvas = canvasRef.value;
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#10151a';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let y = 0; y < VIEW_H; y += 16) for (let x = (y / 16) % 2 === 0 ? 0 : 16; x < VIEW_W; x += 32) {
    ctx.fillStyle = '#141a20';
    ctx.fillRect(x, y, 16, 16);
  }
  const edit = editView();
  drawLootUi(ctx, { state, art: props.art, containerArt: props.containerArt, hover, pointer, edit }, layoutLootUi(state, VIEW_W, VIEW_H, edit));
}

function hitAt(event: MouseEvent): LootHit | null {
  const point = bufferPoint(event);
  return lootHitAt(currentLayout(), point.x, point.y);
}

function gridOf(id: GridIdentifier): InventoryGrid {
  return resolveGridById(state, id);
}

/** Puts every item of the old container into a grid of the new shape: where it was if it fits, else the first free spot. */
function rebuildContainer(cols: number, rows: number, blocked: readonly GridPoint[]): void {
  const next = createInventoryGrid(cols, rows, blocked);
  for (const item of state.containerGrid.items) {
    const fits = canPlaceItem(next, item.type, item.x, item.y, item.rotated, item.id);
    if (fits) placeItem(next, { ...item });
    else autoPackItem(next, { id: item.id, type: item.type, rotated: item.rotated, count: item.count, ammo: item.ammo });
  }
  state.containerGrid = next;
}

function resize(cols: number, rows: number): void {
  const c = Math.min(MAX_SIDE, Math.max(MIN_SIDE, cols));
  const r = Math.min(MAX_SIDE, Math.max(MIN_SIDE, rows));
  if (c === state.containerGrid.cols && r === state.containerGrid.rows) return;
  const kept = (state.containerGrid.blocked ?? []).filter((p) => p.x < c && p.y < r);
  rebuildContainer(c, r, kept);
  emit('size', { cols: c, rows: r });
  emit('blocked', [...kept]);
}

function toggleBlocked(col: number, row: number): void {
  const grid = state.containerGrid;
  if (findItemAtTile(grid, col, row)) return;
  const blocked = grid.blocked ?? [];
  const isBlocked = blocked.some((p) => p.x === col && p.y === row);
  const next = isBlocked ? blocked.filter((p) => !(p.x === col && p.y === row)) : [...blocked, { x: col, y: row }];
  rebuildContainer(grid.cols, grid.rows, next);
  emit('blocked', [...next]);
}

/** After a footprint changes, every item of that type is put back: where it was if it still fits, else the first free spot. */
function refit(type: string): void {
  for (const grid of [state.containerGrid, state.backpackGrid, state.pocketsGrid, state.candyBagGrid]) {
    for (const item of grid.items.filter((i) => i.type === type)) {
      removeItem(grid, item.id);
      const fits = canPlaceItem(grid, item.type, item.x, item.y, item.rotated, item.id);
      if (fits) placeItem(grid, { ...item });
      else autoPackItem(grid, { id: item.id, type: item.type, rotated: item.rotated, count: item.count, ammo: item.ammo });
    }
  }
}

function setFootprint(type: string, width: number, height: number): void {
  const w = Math.min(MAX_FOOTPRINT, Math.max(1, width));
  const h = Math.min(MAX_FOOTPRINT, Math.max(1, height));
  if (!originals.has(type)) originals.set(type, ITEM_FOOTPRINTS[type]);
  ITEM_FOOTPRINTS[type] = { width: w, height: h };
  refit(type);
  emit('footprint', { type, width: w, height: h });
}

function onEdit(id: EditId): void {
  const grid = state.containerGrid;
  const type = selectedType.value;
  const fp = type ? footprintOf(type) : null;
  if (id === 'mode') {
    if (state.heldItem) returnHeldItemToSource(state);
    editOn.value = !editOn.value;
  } else if (id === 'colsDown') resize(grid.cols - 1, grid.rows);
  else if (id === 'colsUp') resize(grid.cols + 1, grid.rows);
  else if (id === 'rowsDown') resize(grid.cols, grid.rows - 1);
  else if (id === 'rowsUp') resize(grid.cols, grid.rows + 1);
  else if (id === 'clear') {
    rebuildContainer(grid.cols, grid.rows, []);
    emit('blocked', []);
  } else if (id === 'save') emit('save');
  else if (type && fp) {
    if (id === 'wDown') setFootprint(type, fp.width - 1, fp.height);
    else if (id === 'wUp') setFootprint(type, fp.width + 1, fp.height);
    else if (id === 'hDown') setFootprint(type, fp.width, fp.height - 1);
    else if (id === 'hUp') setFootprint(type, fp.width, fp.height + 1);
  }
}

function onEditCell(hit: Extract<LootHit, { kind: 'cell' }>): void {
  const item = findItemAtTile(gridOf(hit.gridId), hit.col, hit.row);
  if (item) {
    selectedType.value = item.type;
    state.selectedItemId = item.id;
    return;
  }
  if (hit.gridId === 'container') toggleBlocked(hit.col, hit.row);
}

function onPlayClick(hit: LootHit): void {
  if (hit.kind === 'button') {
    if (hit.id === 'close') close();
    else rotateActiveItem(state);
  } else if (hit.kind === 'gear') {
    if (state.heldItem) placeHeldItemInGear(state, hit.slot);
    else pickUpItemFromGear(state, hit.slot);
  } else if (hit.kind === 'cell') {
    if (state.heldItem) placeHeldItemInGrid(state, hit.gridId, hit.col, hit.row);
    else {
      const item = findItemAtTile(gridOf(hit.gridId), hit.col, hit.row);
      if (item) pickUpItemFromGrid(state, hit.gridId, item.id);
    }
  }
}

function onMove(event: PointerEvent): void {
  pointer = bufferPoint(event);
  hover = hitAt(event);
  redraw();
}

function onLeave(): void {
  hover = null;
  pointer = null;
  redraw();
}

function onClick(event: MouseEvent): void {
  const hit = hitAt(event);
  if (!hit) return;
  if (hit.kind === 'edit') onEdit(hit.id);
  else if (editOn.value) {
    if (hit.kind === 'cell') onEditCell(hit);
    else if (hit.kind === 'button' && hit.id === 'close') close();
  } else onPlayClick(hit);
  redraw();
}

function onDoubleClick(event: MouseEvent): void {
  if (editOn.value) return;
  const hit = hitAt(event);
  if (!hit || hit.kind !== 'cell') return;
  if (state.heldItem) returnHeldItemToSource(state);
  const item = findItemAtTile(gridOf(hit.gridId), hit.col, hit.row);
  if (item) quickTransferBetweenInventories(state, hit.gridId, item.id);
  redraw();
}

function close(): void {
  if (state.heldItem) returnHeldItemToSource(state);
  emit('close');
}

/** Capture phase, so Escape closes only this editor and not the bench page behind it. */
function onKey(event: KeyboardEvent): void {
  if (event.code === 'KeyR' && !editOn.value) rotateActiveItem(state);
  else if (event.code === 'Escape') {
    event.stopPropagation();
    if (state.heldItem) returnHeldItemToSource(state);
    else return close();
  } else return;
  redraw();
}

onMounted(() => {
  window.addEventListener('keydown', onKey, true);
  redraw();
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey, true);
  for (const [type, fp] of originals) {
    if (fp) ITEM_FOOTPRINTS[type] = fp;
    else delete ITEM_FOOTPRINTS[type];
  }
});
</script>

<style scoped>
.canvas-loot-backdrop {
  position: fixed;
  inset: 0;
  z-index: 960;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.88);
}

.canvas-loot {
  image-rendering: pixelated;
  cursor: none;
}

.canvas-loot-note {
  color: var(--bone-dim, #938d7a);
  font-size: 12px;
}
</style>
