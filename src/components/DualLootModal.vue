<template>
  <div
    ref="backdrop"
    class="dual-loot-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    tabindex="-1"
    :style="{ '--pack-cols': backpackSection.grid.cols, '--pack-rows': backpackSection.grid.rows, '--container-rows': modalState.containerGrid.rows }"
  >
    <div class="dual-loot-overlay">
      <!-- Top Center: Pockets to the left of Guns -->
      <div class="loot-top-panel">
        <div class="sub-inventory-section section-pockets">
          <h4 class="sub-section-title">{{ pocketsSection.label }}</h4>
          <div
            class="grid-board"
            :style="{
              '--cols': pocketsSection.grid.cols,
              '--rows': pocketsSection.grid.rows,
            }"
          >
            <div
              v-for="cell in pocketsSection.cells"
              :key="`pockets-${cell.col}-${cell.row}`"
              class="grid-cell"
              :class="getCellHighlightClass('pockets', cell.col, cell.row)"
              :style="getCellCustomProperties(cell.col, cell.row)"
              @pointerenter="setHoverTile('pockets', cell.col, cell.row)"
              @pointerleave="clearHoverTile('pockets', cell.col, cell.row)"
              @click="onCellClick('pockets', cell.col, cell.row)"
              @dragover.prevent="setHoverTile('pockets', cell.col, cell.row)"
              @drop.prevent="onDropCell('pockets', cell.col, cell.row)"
            />
            <div
              v-for="item in pocketsSection.grid.items"
              :key="item.id"
              class="grid-item"
              :class="[{ 'is-selected': modalState.selectedItemId === item.id, 'is-pad': padItemId === item.id }, arrivalClass(item.id)]"
              :data-item-id="item.id"
              :style="getItemCustomProperties(item)"
              draggable="true"
              @click.stop="onItemClick('pockets', item)"
              @dblclick.stop="onItemDblClick('pockets', item)"
              @dragstart="onItemDragStart($event, 'pockets', item)"
              @dragend="onItemDragEnd"
            >
              <LootItemArt :art :type="item.type" :name="getItemName(item.type)" :scale="getItemArtScale(item)" :count="item.count" :ammo="item.ammo" :lying="lyingOf(item)" />
            </div>

            <div
              v-if="isGhostInGrid('pockets')"
              class="grid-item is-ghost"
              :style="ghostCustomProperties"
              @click.stop="onGhostClick('pockets')"
              @dblclick.stop="onGhostDblClick('pockets')"
            >
              <LootItemArt :art :type="modalState.heldItem!.item.type" :name="getItemName(modalState.heldItem!.item.type)" :scale="getGhostArtScale()" :count="modalState.heldItem!.item.count" :ammo="modalState.heldItem!.item.ammo" :lying="lyingOf(modalState.heldItem!.item)" />
            </div>
          </div>
        </div>

        <div class="gear-slots-row">
          <div
            v-for="slot in gearSlotDefs"
            :key="slot.id"
            class="gear-slot"
            :class="{
              'is-valid-target': getGearSlotHighlight(slot.id) === 'valid',
              'is-invalid-target': getGearSlotHighlight(slot.id) === 'invalid',
              'is-occupied': modalState.gear[slot.id] !== null,
            }"
            @click="onGearSlotClick(slot.id)"
            @dragover.prevent="setHoverGear(slot.id)"
            @drop.prevent="onDropGear(slot.id)"
          >
            <span class="gear-slot-tag">{{ slot.label }}</span>
            <div v-if="modalState.gear[slot.id]" class="gear-item-card">
              <LootItemArt :art :type="modalState.gear[slot.id]!.type" :name="getItemName(modalState.gear[slot.id]!.type)" :scale="2" :ammo="modalState.gear[slot.id]!.ammo" />
            </div>
            <div v-else class="gear-empty-slot">
              <span>{{ slot.emptyLabel }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Left Center: Candy Bag -->
      <div class="loot-left-panel">
        <div class="sub-inventory-section section-candy-bag">
          <h4 class="sub-section-title">{{ candyBagSection.label }}</h4>
          <div
            class="grid-board candy-grid"
            :style="{
              '--cols': candyBagSection.grid.cols,
              '--rows': candyBagSection.grid.rows,
            }"
          >
            <div
              v-for="cell in candyBagSection.cells"
              :key="`candyBag-${cell.col}-${cell.row}`"
              class="grid-cell"
              :class="getCellHighlightClass('candyBag', cell.col, cell.row)"
              :style="getCellCustomProperties(cell.col, cell.row)"
              @pointerenter="setHoverTile('candyBag', cell.col, cell.row)"
              @pointerleave="clearHoverTile('candyBag', cell.col, cell.row)"
              @click="onCellClick('candyBag', cell.col, cell.row)"
              @dragover.prevent="setHoverTile('candyBag', cell.col, cell.row)"
              @drop.prevent="onDropCell('candyBag', cell.col, cell.row)"
            />
            <div
              v-for="item in candyBagSection.grid.items"
              :key="item.id"
              class="grid-item"
              :class="[{ 'is-selected': modalState.selectedItemId === item.id, 'is-pad': padItemId === item.id }, arrivalClass(item.id)]"
              :data-item-id="item.id"
              :style="getItemCustomProperties(item)"
              draggable="true"
              @click.stop="onItemClick('candyBag', item)"
              @dblclick.stop="onItemDblClick('candyBag', item)"
              @dragstart="onItemDragStart($event, 'candyBag', item)"
              @dragend="onItemDragEnd"
            >
              <LootItemArt :art :type="item.type" :name="getItemName(item.type)" :scale="getItemArtScale(item)" :count="item.count" :ammo="item.ammo" :lying="lyingOf(item)" />
            </div>

            <div
              v-if="isGhostInGrid('candyBag')"
              class="grid-item is-ghost"
              :style="ghostCustomProperties"
              @click.stop="onGhostClick('candyBag')"
              @dblclick.stop="onGhostDblClick('candyBag')"
            >
              <LootItemArt :art :type="modalState.heldItem!.item.type" :name="getItemName(modalState.heldItem!.item.type)" :scale="getGhostArtScale()" :count="modalState.heldItem!.item.count" :ammo="modalState.heldItem!.item.ammo" :lying="lyingOf(modalState.heldItem!.item)" />
            </div>
          </div>
        </div>
      </div>

      <!-- Center: Searching / Opened Container with grid animation -->
      <div class="loot-center-panel">
        <section v-if="hasContainer" class="loot-dock container-dock container-panel" :class="zoomClass" :style="zoomStyle">
          <!-- No card: the container floats over the game under a small label. -->
          <header class="container-label">
            <h2 id="modal-title" class="dock-title">{{ modalState.containerTitle.toUpperCase() }}</h2>
            <span class="dock-capacity">{{ sweeping ? 'SEARCHING' : `${modalState.containerGrid.items.length} ITEMS` }}</span>
          </header>

          <div class="container-grid-stage">
            <!-- Both drawings sit by their anchors in one box, and the box is stretched over the grid so each cell covers its own part of the object. -->
            <svg
              v-if="containerArtStage"
              ref="stageArt"
              class="container-stage-bg-art"
              :viewBox="containerArtStage.viewBox"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <image
                :href="containerArtStage.url"
                :x="containerArtStage.x"
                :y="containerArtStage.y"
                :width="containerArtStage.w"
                :height="containerArtStage.h"
              />
            </svg>

            <div
              class="grid-board container-grid"
              :style="{
                '--cols': modalState.containerGrid.cols,
                '--rows': modalState.containerGrid.rows,
              }"
            >
              <div
                v-for="cell in containerCells"
                :key="`container-${cell.col}-${cell.row}`"
                class="grid-cell"
                :class="[
                  getCellHighlightClass('container', cell.col, cell.row),
                  sweepClass(cell.col, cell.row),
                  { 'is-blocked': showsVoid(cell.col, cell.row) },
                ]"
                :style="getCellCustomProperties(cell.col, cell.row)"
                @pointerenter="setHoverTile('container', cell.col, cell.row)"
                @pointerleave="clearHoverTile('container', cell.col, cell.row)"
                @click="onCellClick('container', cell.col, cell.row)"
                @dragover.prevent="setHoverTile('container', cell.col, cell.row)"
                @drop.prevent="onDropCell('container', cell.col, cell.row)"
              />

              <div
                v-for="item in modalState.containerGrid.items"
                :key="item.id"
                class="grid-item"
                :class="[{ 'is-selected': modalState.selectedItemId === item.id, 'is-pad': padItemId === item.id }, arrivalClass(item.id)]"
                :data-item-id="item.id"
                :style="getItemCustomProperties(item)"
                draggable="true"
                @click.stop="onItemClick('container', item)"
                @dblclick.stop="onItemDblClick('container', item)"
                @dragstart="onItemDragStart($event, 'container', item)"
                @dragend="onItemDragEnd"
              >
                <span v-if="itemHidden(item.id)" class="item-unknown" aria-label="Unrevealed item">?</span>
                <LootItemArt v-else :art :type="item.type" :name="getItemName(item.type)" :scale="getItemArtScale(item)" :count="item.count" :ammo="item.ammo" :lying="lyingOf(item)" />
              </div>

              <div
                v-if="isGhostInGrid('container')"
                class="grid-item is-ghost"
                :style="ghostCustomProperties"
                @click.stop="onGhostClick('container')"
                @dblclick.stop="onGhostDblClick('container')"
              >
                <LootItemArt :art :type="modalState.heldItem!.item.type" :name="getItemName(modalState.heldItem!.item.type)" :scale="getGhostArtScale()" :count="modalState.heldItem!.item.count" :ammo="modalState.heldItem!.item.ammo" :lying="lyingOf(modalState.heldItem!.item)" />
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Right Center: Backpack & Buttons -->
      <div class="loot-right-panel player-panel">
        <header class="dock-header pack-header">
          <div class="dock-title-group">
            <h3 class="dock-title">{{ backpackSection.label }}</h3>
            <span class="backpack-tier-badge">{{ currentTierLabel }}</span>
          </div>

          <div class="header-actions">
            <button type="button" class="action-btn rotate-btn" :class="{ 'is-active': isHoldingItem }" @click="onRotateClick">
              [R] ROTATE ({{ currentOrientationLabel }})
            </button>
            <button type="button" class="action-btn close-btn" @click="onClose">
              [ESC] CLOSE
            </button>
          </div>
        </header>

        <div class="sub-inventory-section section-backpack">
          <div
            class="grid-board"
            :style="{
              '--cols': backpackSection.grid.cols,
              '--rows': backpackSection.grid.rows,
            }"
          >
            <div
              v-for="cell in backpackSection.cells"
              :key="`backpack-${cell.col}-${cell.row}`"
              class="grid-cell"
              :class="getCellHighlightClass('backpack', cell.col, cell.row)"
              :style="getCellCustomProperties(cell.col, cell.row)"
              @pointerenter="setHoverTile('backpack', cell.col, cell.row)"
              @pointerleave="clearHoverTile('backpack', cell.col, cell.row)"
              @click="onCellClick('backpack', cell.col, cell.row)"
              @dragover.prevent="setHoverTile('backpack', cell.col, cell.row)"
              @drop.prevent="onDropCell('backpack', cell.col, cell.row)"
            />
            <div
              v-for="item in backpackSection.grid.items"
              :key="item.id"
              class="grid-item"
              :class="[{ 'is-selected': modalState.selectedItemId === item.id, 'is-pad': padItemId === item.id }, arrivalClass(item.id)]"
              :data-item-id="item.id"
              :style="getItemCustomProperties(item)"
              draggable="true"
              @click.stop="onItemClick('backpack', item)"
              @dblclick.stop="onItemDblClick('backpack', item)"
              @dragstart="onItemDragStart($event, 'backpack', item)"
              @dragend="onItemDragEnd"
            >
              <LootItemArt :art :type="item.type" :name="getItemName(item.type)" :scale="getItemArtScale(item)" :count="item.count" :ammo="item.ammo" :lying="lyingOf(item)" />
            </div>

            <div
              v-if="isGhostInGrid('backpack')"
              class="grid-item is-ghost"
              :style="ghostCustomProperties"
              @click.stop="onGhostClick('backpack')"
              @dblclick.stop="onGhostDblClick('backpack')"
            >
              <LootItemArt :art :type="modalState.heldItem!.item.type" :name="getItemName(modalState.heldItem!.item.type)" :scale="getGhostArtScale()" :count="modalState.heldItem!.item.count" :ammo="modalState.heldItem!.item.ammo" :lying="lyingOf(modalState.heldItem!.item)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, useTemplateRef, watch } from 'vue';
import LootItemArt from './LootItemArt.vue';
import { useGame } from './use-game.ts';
import { useItemArrivals } from './use-item-arrivals.ts';
import { useContainerZoom } from './use-container-zoom.ts';
import { careTargetAt } from '../game/inventory/care-hover.ts';
import { cellFrom, findShown, GROUND_TARGET, groundTargetAt, moveGridOf, placedAt, sourceOf, USE_TARGET, windowMove } from '../game/inventory/loot-moves.ts';
import { cellKey, type CellOrigin, type MotionKind } from '../game/inventory/move-motion.ts';
import type { MoveFrom, MoveTo } from '../../shared/item-move.ts';
import { backpackDef } from '../../shared/backpack.ts';
import { findItemAtTile, getItemFootprint, isCellBlocked, type GridItem } from '../../shared/grid-inventory.ts';
import { cellPhase, itemHidden, searchSweep, shownSweep, stageView, sweepRanks } from '../game/inventory/search-overlay.ts';
import type { CellPhase } from '../game/inventory/search-overlay.ts';
import { heldButtonAt, heldOnSurvivor, setHeld, setHeldBare } from '../game/held-cursor.ts';
import { elementOwnsPoint } from '../game/inventory/inventory-hands.ts';
import { anchorOf, isLootPadInCharge, moveCursor, setLootPad, settleCursor, startCursor } from '../game/inventory/loot-pad.ts';
import type { LootButton, LootCursor, LootDirection } from '../game/inventory/loot-pad.ts';
import { itemBlurb } from '../game/inventory/item-blurb.ts';
import { heldActions, isLoadable } from '../game/inventory/held-actions.ts';
import { useSoundOf } from '../game/inventory/use-sound.ts';
import { lootSprite } from '../game/loot-item-art.ts';
import {
  buildGridCells,
  computeTileHighlight,
  createDualLootState,
  formatItemName,
  isItemValidForGearSlot,
  pickUpItemFromGear,
  pickUpItemFromGrid,
  placeHeldItemInGear,
  placeHeldItemInGrid,
  quickTransferBetweenInventories,
  resolveGridById,
  returnHeldItemToSource,
  rotateActiveItem,
  type DualLootModalEmits,
  type DualLootModalProps,
  type GearSlotId,
  type GridIdentifier,
  type TileHighlightState,
} from '../game/dual-loot-modal.ts';

const props = withDefaults(defineProps<DualLootModalProps>(), {
  art: null,
  containerTitle: 'Cabinet',
  backpackTier: 'satchel',
  equippedPrimary: null,
  equippedSecondary: null,
  equippedSidearm: null,
  equippedArmor: null,
});

const emit = defineEmits<DualLootModalEmits>();
/** Every lift, set-down, rotate and move in the grids has its own sound. */
const game = useGame();

const modalState = reactive(
  createDualLootState({
    containerTitle: props.containerTitle,
    containerKind: props.containerKind,
    containerGrid: props.containerGrid,
    backpackTier: props.backpackTier,
    backpackGrid: props.backpackGrid,
    pocketsGrid: props.pocketsGrid,
    candyBagGrid: props.candyBagGrid,
    primary: props.equippedPrimary,
    secondary: props.equippedSecondary,
    sidearm: props.equippedSidearm,
    armor: props.equippedArmor,
  })
);

const hoveredGrid = ref<GridIdentifier | null>(null);
/** Items picked up while the window is open land in the grids live, flying in from the world. */
const backdrop = useTemplateRef<HTMLElement>('backdrop');
const { arrivalClass, isShaking } = useItemArrivals(backdrop, () => [modalState.backpackGrid, modalState.pocketsGrid, modalState.candyBagGrid, modalState.containerGrid]);
/** The container's own drawing zooms out of the world to where its art sits; the grid shows once it lands. */
const stageArt = useTemplateRef<SVGSVGElement>('stageArt');
const { zoomClass, zoomStyle } = useContainerZoom(backdrop, stageArt);

const hoveredCol = ref<number | null>(null);
const hoveredRow = ref<number | null>(null);
const hoveredGearSlot = ref<GearSlotId | null>(null);

const gearSlotDefs: { id: GearSlotId; label: string; emptyLabel: string }[] = [
  { id: 'primary', label: 'PRIMARY WEAPON', emptyLabel: '[EMPTY PRIMARY]' },
  { id: 'secondary', label: 'SECONDARY WEAPON', emptyLabel: '[EMPTY SECONDARY]' },
  { id: 'sidearm', label: 'SIDEARM', emptyLabel: '[EMPTY SIDEARM]' },
  { id: 'armor', label: 'ARMOR VEST', emptyLabel: '[EMPTY VEST]' },
];

const currentTierLabel = computed(() => backpackDef(modalState.backpackTier).label);
const isHoldingItem = computed(() => modalState.heldItem !== null);

const hasContainer = computed(() => modalState.containerGrid.items.length > 0 || Boolean(props.containerKind));

/** The container's picture, placed by its anchor in a box that holds both drawings. */
const containerArtStage = computed(() => {
  const containerArt = props.containerArt ?? (props.art && props.containerKind ? props.art.containers[props.containerKind] : null);
  // The open drawing comes with the loot; while the search is still under way the container is shut.
  return containerArt ? stageView(containerArt, !sweeping.value) : null;
});

/** The search is under way: the grid is empty and being read like a defrag pass, over exactly as long as the search. */
const sweeping = computed(() => searchSweep.value !== null && modalState.containerGrid.items.length === 0);

function sweepPhase(col: number, row: number): CellPhase | null {
  if (!sweeping.value) return null;
  const ranks = sweepRanks(modalState.containerGrid);
  return cellPhase(ranks.rankOf(col, row), ranks.open, shownSweep.value ?? 0);
}

/** Head and read cells light up. A void is never lit: it shows as a void when the head reaches it, and looks like any other cell before. */
function sweepClass(col: number, row: number): string | null {
  const phase = sweepPhase(col, row);
  const isWaitingPhase = phase === 'waiting';
  if (isWaitingPhase) return null;
  // A void is not lit: it just shows itself when its turn comes.
  if (isCellBlocked(modalState.containerGrid, col, row)) return null;
  const isHeadPhase = phase === 'head';
  if (isHeadPhase) return 'is-sweep-head';
  const isReadPhase = phase === 'read';
  return isReadPhase ? 'is-sweep-read' : null;
}

function showsVoid(col: number, row: number): boolean {
  const phase = sweepPhase(col, row);
  return isCellBlocked(modalState.containerGrid, col, row) && phase !== 'waiting';
}

const currentOrientationLabel = computed(() => {
  const activeHeld = modalState.heldItem;
  const isHolding = activeHeld !== null;
  if (isHolding) {
    const isRotated = activeHeld.item.rotated;
    return isRotated ? 'VERT' : 'HORIZ';
  }
  return 'HORIZ';
});

const containerCells = computed(() => buildGridCells(modalState.containerGrid.cols, modalState.containerGrid.rows));

const pocketsSection = computed(() => ({
  id: 'pockets' as const,
  label: 'POCKETS (2x2)',
  grid: modalState.pocketsGrid,
  cells: buildGridCells(modalState.pocketsGrid.cols, modalState.pocketsGrid.rows),
}));

const candyBagSection = computed(() => ({
  id: 'candyBag' as const,
  label: 'CANDY BAG (2x6)',
  grid: modalState.candyBagGrid,
  cells: buildGridCells(modalState.candyBagGrid.cols, modalState.candyBagGrid.rows),
}));

const backpackSection = computed(() => ({
  id: 'backpack' as const,
  label: `BACKPACK (${modalState.backpackGrid.cols}x${modalState.backpackGrid.rows})`,
  grid: modalState.backpackGrid,
  cells: buildGridCells(modalState.backpackGrid.cols, modalState.backpackGrid.rows),
}));

function getItemName(type?: string | null): string {
  return formatItemName(type);
}

/** A sprite is drawn double size once the item covers at least two cells each way. */
function getItemArtScale(item: GridItem): number {
  const dims = getItemFootprint(item.type, item.rotated);
  return Math.min(2, dims.width, dims.height);
}

/** How an item lies in its slots, so a long one is drawn end to end the right way round. */
function lyingOf(item: GridItem): 'upright' | 'turned' {
  return item.rotated ? 'turned' : 'upright';
}

function getItemCustomProperties(item: GridItem) {
  const dims = getItemFootprint(item.type, item.rotated);
  return { '--col': item.x + 1, '--col-span': dims.width, '--row': item.y + 1, '--row-span': dims.height };
}

function isGhostInGrid(gridId: GridIdentifier): boolean {
  const held = modalState.heldItem;
  const hasNoHeld = held === null;
  if (hasNoHeld) return false;
  const isFromGrid = held.source.kind === 'grid';
  const matchesGrid = isFromGrid && held.source.gridId === gridId;
  return matchesGrid;
}

const ghostCustomProperties = computed(() => {
  const held = modalState.heldItem;
  const hasNoHeld = held === null;
  if (hasNoHeld) return {};
  const isNotFromGrid = held.source.kind !== 'grid';
  if (isNotFromGrid) return {};
  const dims = getItemFootprint(held.item.type, held.originalRotated);
  return {
    '--col': held.source.x + 1,
    '--col-span': dims.width,
    '--row': held.source.y + 1,
    '--row-span': dims.height,
  };
});

function getGhostArtScale(): number {
  const held = modalState.heldItem;
  const hasNoHeld = held === null;
  if (hasNoHeld) return 1;
  const dims = getItemFootprint(held.item.type, held.originalRotated);
  return Math.min(2, dims.width, dims.height);
}

function getCellCustomProperties(col: number, row: number) {
  return { '--col': col + 1, '--row': row + 1 };
}

function getCellHighlightClass(gridId: GridIdentifier, col: number, row: number): string {
  const pad = isPadCell(gridId, col, row) ? 'is-pad' : '';
  // A cell a refused move was aimed at shows red for its shake.
  const refused = isShaking(cellKey(moveGridOf(gridId), col, row)) ? 'is-invalid-target' : '';
  const target = refused || hoverHighlightClass(gridId, col, row);
  return pad && target ? `${pad} ${target}` : pad || target;
}

function hoverHighlightClass(gridId: GridIdentifier, col: number, row: number): string {
  const isTargetGrid = hoveredGrid.value === gridId;
  const isNotTargetGrid = !isTargetGrid;
  if (isNotTargetGrid) return '';
  const grid = resolveGridById(modalState, gridId);
  const highlight = computeTileHighlight(grid, col, row, hoveredCol.value, hoveredRow.value, modalState.heldItem?.item ?? null, gridId, modalState.candyBagGrid);
  const isValid = highlight === 'valid';
  if (isValid) return 'is-valid-target';
  const isInvalid = highlight === 'invalid';
  if (isInvalid) return 'is-invalid-target';
  return '';
}

function getGearSlotHighlight(slotId: GearSlotId): TileHighlightState {
  const isTargetSlot = hoveredGearSlot.value === slotId;
  const hasHeld = modalState.heldItem !== null;
  const isNotTarget = !isTargetSlot;
  const isNotHolding = !hasHeld;
  const shouldSkip = isNotTarget || isNotHolding;
  if (shouldSkip) return 'none';
  const canFit = isItemValidForGearSlot(modalState.heldItem!.item.type, slotId);
  return canFit ? 'valid' : 'invalid';
}

function setHoverTile(gridId: GridIdentifier, col: number, row: number): void {
  hoveredGrid.value = gridId;
  hoveredCol.value = col;
  hoveredRow.value = row;
  hoveredGearSlot.value = null;
}

function clearHoverTile(gridId: GridIdentifier, col: number, row: number): void {
  const matchesCurrent = hoveredGrid.value === gridId && hoveredCol.value === col && hoveredRow.value === row;
  if (matchesCurrent) clearHover();
}

function setHoverGear(slotId: GearSlotId): void {
  hoveredGearSlot.value = slotId;
  hoveredGrid.value = null;
  hoveredCol.value = null;
  hoveredRow.value = null;
}

function clearHover(): void {
  hoveredGrid.value = null;
  hoveredCol.value = null;
  hoveredRow.value = null;
  hoveredGearSlot.value = null;
}

function syncGearEmits(slotId: GearSlotId): void {
  const isPrimary = slotId === 'primary';
  if (isPrimary) emit('update:equippedPrimary', modalState.gear.primary);
  const isSecondary = slotId === 'secondary';
  if (isSecondary) emit('update:equippedSecondary', modalState.gear.secondary);
  const isSidearm = slotId === 'sidearm';
  if (isSidearm) emit('update:equippedSidearm', modalState.gear.sidearm);
  const isArmor = slotId === 'armor';
  if (isArmor) emit('update:equippedArmor', modalState.gear.armor);
}

function onRotateClick(): void {
  // A box of rounds has nothing to turn: R reloads with it.
  const held = modalState.heldItem;
  const isHoldingItem = held !== null;
  const isHeldLoadable = isHoldingItem && isLoadable(held.item);
  if (isHeldLoadable) {
    game.playSfx(useSoundOf(held.item.type));
    onUseHeld();
    return;
  }
  const rotated = rotateActiveItem(modalState);
  if (rotated) game.playSfx('ui_rotate');
}

function onEscape(): void {
  const isHolding = modalState.heldItem !== null;
  if (isHolding) {
    returnHeldItemToSource(modalState);
    return;
  }
  emit('close');
}

function onClose(): void {
  const isHolding = modalState.heldItem !== null;
  if (isHolding) returnHeldItemToSource(modalState);
  emit('close');
}

/** Hands the inventory what the hand just did, as one move (loot-moves.ts). By default the target is where it now sits. */
function emitMove(item: GridItem, from: MoveFrom, motion: MotionKind, origin: CellOrigin | null = null, to: MoveTo | null = placedAt(modalState, item.id)): void {
  const move = windowMove(item, from, to);
  // The hand is empty now: the cursor hears it first, so the grids refill with the item where it was set down.
  const isHandEmpty = modalState.heldItem === null;
  if (isHandEmpty) setHeld(null);
  if (move) emit('move', move, motion, origin);
}

/** Where an item is drawn now, in client pixels, for a flight back or a puff. */
function itemOrigin(itemId: string): CellOrigin | null {
  const isItemShown = findShown(modalState, itemId) !== null;
  if (!isItemShown) return null;
  const rect = backdrop.value?.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(itemId)}"]`)?.getBoundingClientRect() ?? null;
  return rect ? { client: { x: rect.left, y: rect.top, w: rect.width, h: rect.height } } : null;
}

function onCellClick(gridId: GridIdentifier, col: number, row: number): boolean {
  const held = modalState.heldItem;
  const isHandEmpty = held === null;
  if (isHandEmpty) return false;
  const placed = placeHeldItemInGrid(modalState, gridId, col, row);
  if (placed) {
    // Set down by hand (a click or a drag): it only lands, it does not fly.
    emitMove(held.item, sourceOf(held.source), 'land');
    game.playSfx('ui_place');
  }
  return placed;
}

const lastItemClick = ref<{ id: string; gridId: GridIdentifier; time: number } | null>(null);

function triggerQuickTransfer(gridId: GridIdentifier, itemId: string): void {
  // A double click sends it across: it flies from where its cell is now.
  const leaving = resolveGridById(modalState, gridId).items.find((item) => item.id === itemId);
  const held = modalState.heldItem;
  const moving = leaving ?? held?.item ?? null;
  const heldFrom = held ? sourceOf(held.source) : null;
  const from = leaving ? cellFrom(gridId, leaving) : heldFrom;
  const cell = backdrop.value?.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(itemId)}"]`)?.getBoundingClientRect() ?? null;
  const didTransfer = quickTransferBetweenInventories(modalState, gridId, itemId);
  if (didTransfer) {
    const isHandEmpty = modalState.heldItem === null;
    if (isHandEmpty) setHeld(null);
    game.playSfx('ui_place');
    const origin = cell ? { client: { x: cell.left, y: cell.top, w: cell.width, h: cell.height } } : null;
    const canEmitMove = moving && from;
    if (canEmitMove) emitMove(moving, from, origin ? 'fly' : 'land', origin);
  }
}

function onItemClick(gridId: GridIdentifier, item: GridItem): void {
  const isHolding = modalState.heldItem !== null;
  if (isHolding) {
    onCellClick(gridId, item.x, item.y);
    return;
  }
  lastItemClick.value = { id: item.id, gridId, time: Date.now() };
  const picked = pickUpItemFromGrid(modalState, gridId, item.id);
  if (picked) game.playSfx('ui_pickup');
}

function onUseHeld(): void {
  const held = modalState.heldItem;
  if (!held) return;
  const item = { ...held.item };
  const from = sourceOf(held.source);
  // A box of rounds is loaded, not spent: it goes back where it was, and leaves the bag when the gun has used the rounds.
  if (isLoadable(item)) returnHeldItemToSource(modalState);
  else modalState.heldItem = null;
  emitMove(item, from, 'land', null, USE_TARGET);
}

function onDropHeld(to: MoveTo = GROUND_TARGET): void {
  const held = modalState.heldItem;
  if (!held) return;
  modalState.heldItem = null;
  emitMove(held.item, sourceOf(held.source), 'land', null, to);
}

function onGhostClick(gridId: GridIdentifier): void {
  const held = modalState.heldItem;
  const hasNoHeld = held === null;
  if (hasNoHeld) return;

  const now = Date.now();
  const clickRecord = lastItemClick.value;
  const isDblClick = clickRecord !== null && clickRecord.id === held.item.id && now - clickRecord.time < 400;

  if (isDblClick) {
    triggerQuickTransfer(gridId, held.item.id);
    lastItemClick.value = null;
    return;
  }

  returnHeldItemToSource(modalState);
  lastItemClick.value = null;
}

function onGhostDblClick(gridId: GridIdentifier): void {
  const held = modalState.heldItem;
  const hasNoHeld = held === null;
  if (hasNoHeld) return;
  triggerQuickTransfer(gridId, held.item.id);
  lastItemClick.value = null;
}

function onItemDblClick(gridId: GridIdentifier, item: GridItem): void {
  triggerQuickTransfer(gridId, item.id);
  lastItemClick.value = null;
}

function onGearSlotClick(slotId: GearSlotId): boolean {
  const isHolding = modalState.heldItem !== null;
  if (isHolding) {
    const held = modalState.heldItem!;
    const placed = placeHeldItemInGear(modalState, slotId);
    if (placed) {
      syncGearEmits(slotId);
      const heldSource = held.source;
      const isLiftedFromGear = heldSource.kind === 'gear';
      if (isLiftedFromGear) syncGearEmits(heldSource.slotId);
      emitMove(held.item, sourceOf(held.source), 'land');
    }
    return placed;
  }
  const hasEquippedItem = modalState.gear[slotId] !== null;
  if (hasEquippedItem) {
    pickUpItemFromGear(modalState, slotId);
    syncGearEmits(slotId);
  }
  return false;
}

function onItemDragStart(event: DragEvent, gridId: GridIdentifier, item: GridItem): void {
  const isHolding = modalState.heldItem !== null;
  const isNotHolding = !isHolding;
  const didPickUp = isNotHolding && pickUpItemFromGrid(modalState, gridId, item.id);
  if (didPickUp) game.playSfx('ui_pickup');
  const hasDataTransfer = event.dataTransfer !== null;
  if (hasDataTransfer) {
    event.dataTransfer!.setData('text/plain', item.id);
    event.dataTransfer!.effectAllowed = 'move';
  }
}

function onDropCell(gridId: GridIdentifier, col: number, row: number): void {
  const isHolding = modalState.heldItem !== null;
  if (isHolding) {
    const placed = onCellClick(gridId, col, row);
    const didNotPlace = !placed;
    if (didNotPlace) returnHeldItemToSource(modalState);
  }
  clearHover();
}

function onItemDragEnd(): void {
  const isStillHeld = modalState.heldItem !== null;
  if (isStillHeld) returnHeldItemToSource(modalState);
  clearHover();
}

function onDropGear(slotId: GearSlotId): void {
  const isHolding = modalState.heldItem !== null;
  if (isHolding) {
    const placed = onGearSlotClick(slotId);
    const didNotPlace = !placed;
    if (didNotPlace) returnHeldItemToSource(modalState);
  }
  clearHover();
}

function handleGlobalKey(event: KeyboardEvent): void {
  const isEscKey = event.key === 'Escape' || event.key === 'Esc';
  if (isEscKey) {
    event.preventDefault();
    onEscape();
    return;
  }
  // R turns only an item in hand; with the hand empty it is left to the game as the reload key.
  const isRotateKey = event.key === 'r' || event.key === 'R';
  const isHoldingItem = modalState.heldItem !== null;
  const shouldRotateHeld = isRotateKey && isHoldingItem;
  if (shouldRotateHeld) {
    event.preventDefault();
    onRotateClick();
  }
}

/** The item in hand is drawn on the game canvas, with its buttons; this hands it over and answers a click on them. */
watch(
  () => {
    const held = modalState.heldItem;
    return held ? `${held.item.id}:${held.item.type}:${held.item.rotated}` : '';
  },
  () => {
    const held = modalState.heldItem;
    if (!held) return setHeld(null);
    const { item } = held;
    setHeld({
      sprite: props.art ? lootSprite(props.art, item.type) : null,
      name: formatItemName(item.type),
      hint: itemBlurb(item.type),
      actions: heldActions(item),
      type: item.type,
      itemId: item.id,
    });
    setHeldBare((clientX, clientY) => document.elementFromPoint(clientX, clientY) instanceof HTMLCanvasElement);
  },
  { immediate: true, flush: 'sync' },
);

/** A click on a button does what it says. A click on the game itself drops the item, or uses it if it lands on the survivor. */
function onHeldButtonClick(event: MouseEvent): void {
  const held = modalState.heldItem;
  if (!held) return;
  const actions = heldActions(held.item);
  const canUse = actions.some((a) => a.kind === 'use');
  const canDrop = actions.some((a) => a.kind === 'drop');
  const onButton = heldButtonAt(event.clientX, event.clientY);
  const onGame = event.target instanceof HTMLCanvasElement;
  const onSurvivor = onGame && heldOnSurvivor(event.clientX, event.clientY);
  const gameKind = onSurvivor ? 'use' : 'drop';
  const kind = onButton ?? (onGame ? gameKind : null);
  // A teammate under the item, in reach and helped by it, is handed it instead of the item being dropped.
  const careTo = careTargetAt(event.clientX, event.clientY);
  const to = careTo && kind === 'drop' ? careTo : groundTargetAt(event.clientX, event.clientY);
  actOnHeld(kind, canUse, canDrop, to);
}

/** USE or DROP on the item in hand, with its sound, when the item allows it. True when something happened. */
function actOnHeld(kind: 'use' | 'drop' | null, canUse: boolean, canDrop: boolean, to: MoveTo = GROUND_TARGET): boolean {
  const held = modalState.heldItem;
  if (!held) return false;
  const shouldUse = kind === 'use' && canUse;
  const shouldDrop = kind === 'drop' && canDrop;
  if (shouldUse) {
    game.playSfx(useSoundOf(held.item.type));
    onUseHeld();
  } else if (shouldDrop) {
    game.playSfx('ui_drop');
    onDropHeld(to);
  } else return false;
  return true;
}

/** The controller's highlight: one cell, on the first item at first, moved by the D-pad. Null until a pad is in hand. */
const padCursor = ref<LootCursor | null>(null);
const padGridOf = (id: GridIdentifier) => resolveGridById(modalState, id);

const padItemId = computed(() => {
  const cursor = padCursor.value;
  if (!cursor) return null;
  return findItemAtTile(padGridOf(cursor.gridId), cursor.col, cursor.row)?.id ?? null;
});

/** The cursor's cell where no item covers it: an empty spot to set something down. */
function isPadCell(gridId: GridIdentifier, col: number, row: number): boolean {
  const cursor = padCursor.value;
  const isCursorOnGrid = cursor !== null && cursor.gridId === gridId;
  if (!isCursorOnGrid) return false;
  const onItem = padItemId.value !== null;
  return !onItem && cursor.col === col && cursor.row === row;
}

function padMove(direction: LootDirection): boolean {
  const cursor = padCursor.value ?? startCursor(padGridOf);
  const next = padCursor.value ? moveCursor(cursor, direction, padGridOf) : cursor;
  padCursor.value = next ?? cursor;
  // A lifted item rides the highlight, and shows green or red where it would land.
  const at = padCursor.value;
  const isHoldingItem = modalState.heldItem !== null;
  if (isHoldingItem) setHoverTile(at.gridId, at.col, at.row);
  return true;
}

/** A takes the item under the highlight across (or sets a held one down); X lifts it to move it; Y turns it. */
function padPress(button: LootButton): boolean {
  // With the hand empty the triggers are the game's (fire and shove), so they leave the highlight unlit.
  const isTrigger = button === 'rt' || button === 'lt';
  const isHandEmpty = modalState.heldItem === null;
  const isTriggerWithEmptyHand = isTrigger && isHandEmpty;
  if (isTriggerWithEmptyHand) return false;
  const cursor = padCursor.value ?? startCursor(padGridOf);
  padCursor.value = cursor;
  const grid = padGridOf(cursor.gridId);
  const item = findItemAtTile(grid, cursor.col, cursor.row);
  const isRotateButton = button === 'y';
  if (isRotateButton) {
    onRotateClick();
    return true;
  }
  if (isTrigger) {
    const held = modalState.heldItem;
    if (!held) return false;
    const actions = heldActions(held.item);
    const acted = actOnHeld(button === 'rt' ? 'use' : 'drop', actions.some((a) => a.kind === 'use'), actions.some((a) => a.kind === 'drop'));
    if (acted) padCursor.value = settleCursor(cursor, padGridOf);
    return acted;
  }
  const isHoldingItem = modalState.heldItem !== null;
  if (isHoldingItem) {
    onCellClick(cursor.gridId, cursor.col, cursor.row);
    padCursor.value = { gridId: cursor.gridId, ...anchorOf(grid, cursor.col, cursor.row) };
    return true;
  }
  if (!item) return true;
  const isLiftButton = button === 'x';
  if (isLiftButton) onItemClick(cursor.gridId, item);
  else triggerQuickTransfer(cursor.gridId, item.id);
  padCursor.value = settleCursor(cursor, padGridOf);
  return true;
}

onMounted(() => {
  if (isLootPadInCharge()) padCursor.value = startCursor(padGridOf);
  setLootPad({ move: padMove, press: padPress });
  const isWindowDefined = typeof window !== 'undefined';
  if (isWindowDefined) {
    window.addEventListener('keydown', handleGlobalKey);
    window.addEventListener('click', onHeldButtonClick);
  }
});

/** Esc from outside: put a held item back first, and close on the next press. */
/** Puts a held item back where it came from, so the grids are whole when the bag is read on close. */
function settle(): void {
  const isHoldingItem = modalState.heldItem !== null;
  if (isHoldingItem) returnHeldItemToSource(modalState);
  setHeld(null);
}

/** The page element under the point is this window's own: its panels, not the see-through gaps over the game. */
function ownsPoint(clientX: number, clientY: number): boolean {
  return elementOwnsPoint(backdrop.value, clientX, clientY);
}

defineExpose({ escape: onEscape, rotate: onRotateClick, settle, ownsPoint, itemOrigin });

onUnmounted(() => {
  setHeld(null);
  setLootPad(null);
  const isWindowDefined = typeof window !== 'undefined';
  if (isWindowDefined) {
    window.removeEventListener('keydown', handleGlobalKey);
    window.removeEventListener('click', onHeldButtonClick);
  }
});
</script>

<style scoped src="./dual-loot-modal.css">
/* Theme CSS variables: --u, --sick, --blood-bright; classes: is-valid-target, is-invalid-target */
</style>
