<template>
  <div
    class="dual-loot-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    tabindex="-1"
    :style="{ '--pack-cols': backpackSection.grid.cols, '--pack-rows': backpackSection.grid.rows }"
  >
    <div class="dual-loot-overlay">
      <!-- Left Dock: Container (Enlarged Prop with Overlaid Grid) -->
      <div class="left-column">
        <section v-if="hasContainer" class="loot-dock container-dock container-panel">
          <header class="dock-header container-header">
            <div class="dock-title-group">
              <h2 id="modal-title" class="dock-title">{{ modalState.containerTitle.toUpperCase() }}</h2>
              <span class="dock-capacity">{{ modalState.containerGrid.items.length }} ITEMS</span>
            </div>
          </header>

          <div class="container-grid-stage">
            <img
              v-if="containerArtUrl"
              :src="containerArtUrl"
              class="container-stage-bg-art"
              alt=""
              draggable="false"
            />

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
                <LootItemArt :art :type="item.type" :name="getItemName(item.type)" :scale="getItemArtScale(item)" :count="item.count" :ammo="item.ammo" :lying="lyingOf(item)" />
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
        <HeldItemPanel :art :item="modalState.heldItem?.item ?? null" />
      </div>

      <!-- Center Spacer: Open view of player character in game world -->
      <div class="center-stage-spacer" />

      <!-- Right Dock: Survivor Inventory -->
      <section class="loot-dock survivor-dock player-panel">
        <header class="dock-header survivor-header">
          <div class="dock-title-group">
            <h2 class="dock-title">SURVIVOR INVENTORY</h2>
            <span class="backpack-tier-badge">{{ currentTierLabel }}</span>
            <span class="dock-capacity">{{ totalPlayerItemsCount }} ITEMS</span>
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

        <div class="player-grids-column">
          <div class="player-subgrids-row">
            <!-- Pockets -->
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
                  :class="{ 'is-selected': modalState.selectedItemId === item.id }"
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

            <!-- Candy Bag -->
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
                  :class="{ 'is-selected': modalState.selectedItemId === item.id }"
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

          <!-- Backpack -->
          <div class="sub-inventory-section section-backpack">
            <h4 class="sub-section-title">{{ backpackSection.label }}</h4>
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
                :class="{ 'is-selected': modalState.selectedItemId === item.id }"
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

        <footer class="dock-footer">
          <span class="footer-tip">[R] Rotate | Drag to Move | Double-Click to Transfer | [ESC] Close</span>
        </footer>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import HeldItemPanel from './HeldItemPanel.vue';
import LootItemArt from './LootItemArt.vue';
import { backpackDef } from '../../shared/backpack.ts';
import { getItemFootprint, type GridItem } from '../../shared/grid-inventory.ts';
import { spriteDataUrl } from '../engine/sprite-cache.ts';
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
  art: null,
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

const containerArtUrl = computed(() => {
  if (!props.art || !props.containerKind) return '';
  const containerArt = props.art.containers[props.containerKind];
  if (!containerArt) return '';
  const hasItems = modalState.containerGrid.items.length > 0;
  const sprite = hasItems
    ? (containerArt.closed ?? containerArt.opened)
    : (containerArt.opened ?? containerArt.closed);
  return sprite ? spriteDataUrl(sprite) : '';
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
  let count = modalState.pocketsGrid.items.length + modalState.candyBagGrid.items.length + modalState.backpackGrid.items.length;
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

function getItemName(type: string): string {
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
  const isTargetGrid = hoveredGrid.value === gridId;
  const isNotTargetGrid = !isTargetGrid;
  if (isNotTargetGrid) return '';
  const grid = resolveGridById(modalState, gridId);
  const highlight = computeTileHighlight(grid, col, row, hoveredCol.value, hoveredRow.value, modalState.heldItem?.item ?? null, gridId);
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

const lastItemClick = ref<{ id: string; gridId: GridIdentifier; time: number } | null>(null);

function triggerQuickTransfer(gridId: GridIdentifier, itemId: string): void {
  const didTransfer = quickTransferBetweenInventories(modalState, gridId, itemId);
  if (didTransfer) {
    const isContainer = gridId === 'container';
    const targetName = isContainer ? 'backpack' : 'container';
    emit('transfer', { itemId, source: gridId, target: targetName });
  }
}

function onItemClick(gridId: GridIdentifier, item: GridItem): void {
  const isHolding = modalState.heldItem !== null;
  if (isHolding) {
    onCellClick(gridId, item.x, item.y);
    return;
  }
  lastItemClick.value = { id: item.id, gridId, time: Date.now() };
  pickUpItemFromGrid(modalState, gridId, item.id);
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
