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
    <p class="canvas-loot-note">Canvas draft of the loot window. Click to pick up and place, R rotates, Esc closes.</p>
  </v-sheet>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { ArtBook } from '../../art/types.ts';
import type { ContainerArt } from '../../art/containers.ts';
import { autoPackItem, findItemAtTile, type InventoryGrid } from '../../../shared/grid-inventory.ts';
import type { ContainerKind } from '../../../shared/containers.ts';
import { drawLootUi, layoutLootUi, lootHitAt, type LootHit } from '../../engine/loot-ui.ts';
import {
  createDualLootState,
  pickUpItemFromGear,
  pickUpItemFromGrid,
  placeHeldItemInGear,
  placeHeldItemInGrid,
  quickTransferBetweenInventories,
  returnHeldItemToSource,
  rotateActiveItem,
} from '../../game/inventory/dual-loot-modal.ts';

interface Props {
  art: ArtBook | null;
  title: string;
  kind: ContainerKind;
  grid: InventoryGrid;
  containerArt?: ContainerArt | null;
}

const props = withDefaults(defineProps<Props>(), { containerArt: null });
const emit = defineEmits<{ close: [] }>();

/** The game draws into a 480 by 270 buffer and scales it by whole numbers; this draft does the same. */
const VIEW_W = 480;
const VIEW_H = 270;
const PACK_SAMPLE = ['bandage', 'medkit', 'pistol_ammo', 'water_bottle'];

const canvasRef = ref<HTMLCanvasElement | null>(null);
const scale = ref(Math.max(1, Math.floor(Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H) * 0.95)));

const state = createDualLootState({
  containerKind: props.kind,
  containerTitle: props.title,
  containerGrid: props.grid,
  backpackTier: 'satchel',
});
PACK_SAMPLE.forEach((type, i) => autoPackItem(state.backpackGrid, { id: `pack-${i}`, type, rotated: false }));

let hover: LootHit | null = null;
let pointer: { x: number; y: number } | null = null;

function bufferPoint(event: MouseEvent): { x: number; y: number } {
  const rect = canvasRef.value!.getBoundingClientRect();
  return { x: Math.floor(((event.clientX - rect.left) * VIEW_W) / rect.width), y: Math.floor(((event.clientY - rect.top) * VIEW_H) / rect.height) };
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
  const layout = layoutLootUi(state, VIEW_W, VIEW_H);
  drawLootUi(ctx, { state, art: props.art, containerArt: props.containerArt, hover, pointer }, layout);
}

function hitAt(event: MouseEvent): LootHit | null {
  const point = bufferPoint(event);
  return lootHitAt(layoutLootUi(state, VIEW_W, VIEW_H), point.x, point.y);
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
  if (hit.kind === 'button') {
    if (hit.id === 'close') close();
    else rotateActiveItem(state);
  } else if (hit.kind === 'gear') {
    if (state.heldItem) placeHeldItemInGear(state, hit.slot);
    else pickUpItemFromGear(state, hit.slot);
  } else if (state.heldItem) {
    placeHeldItemInGrid(state, hit.gridId, hit.col, hit.row);
  } else {
    const grid = gridOf(hit.gridId);
    const item = findItemAtTile(grid, hit.col, hit.row);
    if (item) pickUpItemFromGrid(state, hit.gridId, item.id);
  }
  redraw();
}

function onDoubleClick(event: MouseEvent): void {
  const hit = hitAt(event);
  if (!hit || hit.kind !== 'cell') return;
  if (state.heldItem) returnHeldItemToSource(state);
  const item = findItemAtTile(gridOf(hit.gridId), hit.col, hit.row);
  if (item) quickTransferBetweenInventories(state, hit.gridId, item.id);
  redraw();
}

function gridOf(id: 'container' | 'pockets' | 'backpack' | 'candyBag'): InventoryGrid {
  const grids = { container: state.containerGrid, pockets: state.pocketsGrid, backpack: state.backpackGrid, candyBag: state.candyBagGrid };
  return grids[id];
}

function close(): void {
  if (state.heldItem) returnHeldItemToSource(state);
  emit('close');
}

function onKey(event: KeyboardEvent): void {
  if (event.code === 'KeyR') rotateActiveItem(state);
  else if (event.code === 'Escape') {
    if (state.heldItem) returnHeldItemToSource(state);
    else return close();
  } else return;
  redraw();
}

onMounted(() => {
  window.addEventListener('keydown', onKey);
  redraw();
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
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
