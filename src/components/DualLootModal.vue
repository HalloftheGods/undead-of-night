<template>
  <div
    class="dual-loot-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    tabindex="-1"
  >
    <div class="dual-loot-modal px-frame">
      <header class="modal-header">
        <div class="header-main-row">
          <div class="title-group">
            <h2 id="modal-title" class="modal-title">{{ modalState.containerTitle.toUpperCase() }} LOOTING</h2>
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
        </div>

        <div v-if="isHoldingItem" class="held-item-banner">
          <span class="held-icon">📦</span>
          <span class="held-label">
            HOLDING: <strong>{{ heldItemDisplayName }}</strong> ({{ heldItemDimensions.width }}x{{ heldItemDimensions.height }})
          </span>
          <span class="held-hint">Press R to rotate footprint. Click cell to drop. Esc to return.</span>
        </div>
      </header>

      <div class="dual-panels-container">
        <!-- Left Panel: Container Grid -->
        <section class="loot-panel container-panel">
          <div class="panel-header">
            <h3 class="panel-title">{{ modalState.containerTitle.toUpperCase() }}</h3>
            <span class="panel-capacity">{{ modalState.containerGrid.items.length }} ITEMS</span>
          </div>

          <div
            class="grid-board"
            :style="{
              '--cols': modalState.containerGrid.cols,
              '--rows': modalState.containerGrid.rows,
            }"
          >
            <div
              v-for="cell in containerCells"
              :key="`container-${cell.col}-${cell.row}`"
              class="grid-cell"
              :class="getCellHighlightClass('container', cell.col, cell.row)"
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
              :class="{ 'is-selected': modalState.selectedItemId === item.id }"
              :style="getItemCustomProperties(item)"
              draggable="true"
              @click.stop="onItemClick('container', item)"
              @dblclick.stop="onItemDblClick('container', item)"
              @dragstart="onItemDragStart($event, 'container', item)"
              @dragend="onItemDragEnd"
            >
              <span class="item-name">{{ getItemName(item.type) }}</span>
              <span class="item-meta">{{ getItemDimensionsLabel(item) }}</span>
            </div>
          </div>
        </section>

        <!-- Right Panel: Player Inventory -->
        <section class="loot-panel player-panel">
          <div class="panel-header">
            <h3 class="panel-title">SURVIVOR INVENTORY</h3>
            <span class="panel-capacity">{{ totalPlayerItemsCount }} ITEMS</span>
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
                <span class="gear-item-name">{{ getItemName(modalState.gear[slot.id]!.type) }}</span>
                <span v-if="modalState.gear[slot.id]!.ammo !== undefined" class="gear-item-ammo">
                  {{ modalState.gear[slot.id]!.ammo }} RDS
                </span>
              </div>
              <div v-else class="gear-empty-slot">
                <span>{{ slot.emptyLabel }}</span>
              </div>
            </div>
          </div>

          <div
            v-for="section in playerSections"
            :key="section.id"
            class="sub-inventory-section"
          >
            <h4 class="sub-section-title">{{ section.label }}</h4>
            <div
              class="grid-board"
              :style="{
                '--cols': section.grid.cols,
                '--rows': section.grid.rows,
              }"
            >
              <div
                v-for="cell in section.cells"
                :key="`${section.id}-${cell.col}-${cell.row}`"
                class="grid-cell"
                :class="getCellHighlightClass(section.id, cell.col, cell.row)"
                :style="getCellCustomProperties(cell.col, cell.row)"
                @pointerenter="setHoverTile(section.id, cell.col, cell.row)"
                @pointerleave="clearHoverTile(section.id, cell.col, cell.row)"
                @click="onCellClick(section.id, cell.col, cell.row)"
                @dragover.prevent="setHoverTile(section.id, cell.col, cell.row)"
                @drop.prevent="onDropCell(section.id, cell.col, cell.row)"
              />

              <div
                v-for="item in section.grid.items"
                :key="item.id"
                class="grid-item"
                :class="{ 'is-selected': modalState.selectedItemId === item.id }"
                :style="getItemCustomProperties(item)"
                draggable="true"
                @click.stop="onItemClick(section.id, item)"
                @dblclick.stop="onItemDblClick(section.id, item)"
                @dragstart="onItemDragStart($event, section.id, item)"
                @dragend="onItemDragEnd"
              >
                <span class="item-name">{{ getItemName(item.type) }}</span>
                <span class="item-meta">{{ getItemDimensionsLabel(item) }}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer class="modal-footer">
        <span class="footer-tip">[R] Rotate Item | Click or Drag to Move | Double-Click to Quick Transfer | [ESC] Close</span>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { backpackDef } from '../../shared/backpack.ts';
import { getItemFootprint, type GridFootprint, type GridItem } from '../../shared/grid-inventory.ts';
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
  sourceName,
  type DualLootModalEmits,
  type DualLootModalProps,
  type GearSlotId,
  type GridIdentifier,
  type TileHighlightState,
} from '../game/dual-loot-modal.ts';

const props = withDefaults(defineProps<DualLootModalProps>(), {
  containerTitle: 'Cabinet',
  backpackTier: 'satchel',
  equippedPrimary: null,
  equippedSecondary: null,
  equippedSidearm: null,
  equippedArmor: null,
});

const emit = defineEmits<DualLootModalEmits>();

const modalState = reactive(
  createDualLootState({
    containerTitle: props.containerTitle,
    containerGrid: props.containerGrid,
    backpackTier: props.backpackTier,
    backpackGrid: props.backpackGrid,
    pocketsGrid: props.pocketsGrid,
    primary: props.equippedPrimary,
    secondary: props.equippedSecondary,
    sidearm: props.equippedSidearm,
    armor: props.equippedArmor,
  })
);

const hoveredGrid = ref<GridIdentifier | null>(null);
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

const heldItemDisplayName = computed(() => {
  const activeHeld = modalState.heldItem;
  const isHeldMissing = activeHeld === null;
  if (isHeldMissing) return '';
  return formatItemName(activeHeld.item.type);
});

const heldItemDimensions = computed<GridFootprint>(() => {
  const activeHeld = modalState.heldItem;
  const isHeldMissing = activeHeld === null;
  if (isHeldMissing) return { width: 1, height: 1 };
  return getItemFootprint(activeHeld.item.type, activeHeld.item.rotated);
});

const currentOrientationLabel = computed(() => {
  const activeHeld = modalState.heldItem;
  const isHolding = activeHeld !== null;
  if (isHolding) {
    const isRotated = activeHeld.item.rotated;
    return isRotated ? 'VERT' : 'HORIZ';
  }
  return 'HORIZ';
});

const totalPlayerItemsCount = computed(() => {
  let count = modalState.pocketsGrid.items.length + modalState.backpackGrid.items.length;
  const hasPrimary = modalState.gear.primary !== null;
  if (hasPrimary) count += 1;
  const hasSecondary = modalState.gear.secondary !== null;
  if (hasSecondary) count += 1;
  const hasSidearm = modalState.gear.sidearm !== null;
  if (hasSidearm) count += 1;
  const hasArmor = modalState.gear.armor !== null;
  if (hasArmor) count += 1;
  return count;
});

const containerCells = computed(() => buildGridCells(modalState.containerGrid.cols, modalState.containerGrid.rows));

const playerSections = computed(() => [
  { id: 'pockets' as const, label: 'POCKETS (2x2)', grid: modalState.pocketsGrid, cells: buildGridCells(modalState.pocketsGrid.cols, modalState.pocketsGrid.rows) },
  { id: 'backpack' as const, label: `BACKPACK (${modalState.backpackGrid.cols}x${modalState.backpackGrid.rows})`, grid: modalState.backpackGrid, cells: buildGridCells(modalState.backpackGrid.cols, modalState.backpackGrid.rows) },
]);

function getItemName(type: string): string {
  return formatItemName(type);
}

function getItemDimensionsLabel(item: GridItem): string {
  const dims = getItemFootprint(item.type, item.rotated);
  return `${dims.width}x${dims.height}`;
}

function getItemCustomProperties(item: GridItem) {
  const dims = getItemFootprint(item.type, item.rotated);
  return { '--col': item.x + 1, '--col-span': dims.width, '--row': item.y + 1, '--row-span': dims.height };
}

function getCellCustomProperties(col: number, row: number) {
  return { '--col': col + 1, '--row': row + 1 };
}

function getCellHighlightClass(gridId: GridIdentifier, col: number, row: number): string {
  const isTargetGrid = hoveredGrid.value === gridId;
  const isNotTargetGrid = !isTargetGrid;
  if (isNotTargetGrid) return '';
  const grid = resolveGridById(modalState, gridId);
  const highlight = computeTileHighlight(grid, col, row, hoveredCol.value, hoveredRow.value, modalState.heldItem?.item ?? null);
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
  rotateActiveItem(modalState);
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

function onCellClick(gridId: GridIdentifier, col: number, row: number): boolean {
  const held = modalState.heldItem;
  if (held === null) return false;
  const from = sourceName(held.source);
  const placed = placeHeldItemInGrid(modalState, gridId, col, row);
  if (placed) emit('transfer', { itemId: modalState.selectedItemId ?? '', source: from, target: gridId });
  return placed;
}

function onItemClick(gridId: GridIdentifier, item: GridItem): void {
  const isHolding = modalState.heldItem !== null;
  if (isHolding) {
    onCellClick(gridId, item.x, item.y);
    return;
  }
  pickUpItemFromGrid(modalState, gridId, item.id);
}

function onItemDblClick(gridId: GridIdentifier, item: GridItem): void {
  const didTransfer = quickTransferBetweenInventories(modalState, gridId, item.id);
  if (didTransfer) {
    const isContainer = gridId === 'container';
    const targetName = isContainer ? 'backpack' : 'container';
    emit('transfer', { itemId: item.id, source: gridId, target: targetName });
  }
}

function onGearSlotClick(slotId: GearSlotId): boolean {
  const isHolding = modalState.heldItem !== null;
  if (isHolding) {
    const placed = placeHeldItemInGear(modalState, slotId);
    if (placed) {
      syncGearEmits(slotId);
      emit('transfer', { itemId: modalState.gear[slotId]?.id ?? '', source: 'held', target: `gear-${slotId}` });
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
  if (isNotHolding) pickUpItemFromGrid(modalState, gridId, item.id);
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
  const isRotateKey = event.key === 'r' || event.key === 'R';
  if (isRotateKey) {
    event.preventDefault();
    onRotateClick();
  }
}

onMounted(() => {
  const isWindowDefined = typeof window !== 'undefined';
  if (isWindowDefined) window.addEventListener('keydown', handleGlobalKey);
});

/** Esc from outside: put a held item back first, and close on the next press. */
/** Puts a held item back where it came from, so the grids are whole when the bag is read on close. */
function settle(): void {
  if (modalState.heldItem !== null) returnHeldItemToSource(modalState);
}

defineExpose({ escape: onEscape, rotate: onRotateClick, settle });

onUnmounted(() => {
  const isWindowDefined = typeof window !== 'undefined';
  if (isWindowDefined) window.removeEventListener('keydown', handleGlobalKey);
});
</script>

<style scoped src="./dual-loot-modal.css">
/* Theme CSS variables: --u, --sick, --blood-bright; classes: is-valid-target, is-invalid-target */
</style>
