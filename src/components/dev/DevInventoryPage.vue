<template>
  <TitlePage heading="Inventory Sizing Dev Bench" size="extra-wide" @close="emit('close')">
    <div class="dev-inventory-layout">
      <!-- Top View Switcher -->
      <nav class="view-switch-nav" aria-label="Dev bench sections">
        <PixelButton
          class="view-tab-btn"
          :class="{ 'is-active': activeView === 'items' }"
          @press="activeView = 'items'"
        >
          Items ({{ catalogue.length }})
        </PixelButton>
        <PixelButton
          class="view-tab-btn"
          :class="{ 'is-active': activeView === 'containers' }"
          @press="activeView = 'containers'"
        >
          Lootable Objects ({{ containerCatalogue.length }})
        </PixelButton>
      </nav>

      <!-- ============================================== -->
      <!-- SECTION 1: ITEMS SIZING BENCH                  -->
      <!-- ============================================== -->
      <template v-if="activeView === 'items'">
        <!-- Items Controls Deck -->
        <section class="dev-toolbar px-frame">
          <div class="toolbar-top-row">
            <div class="toolbar-stats">
              <span class="stat-pill">Total: {{ catalogue.length }}</span>
              <span class="stat-pill" :class="{ 'is-highlight': modifiedItemsCount > 0 }">
                Modified: {{ modifiedItemsCount }}
              </span>
              <span class="stat-pill">Visible: {{ filteredItems.length }}</span>
            </div>

            <div class="toolbar-search-box">
              <input
                v-model="itemSearchQuery"
                type="text"
                class="search-input"
                placeholder="Search items by name or id..."
              />
              <PixelButton
                v-if="itemSearchQuery"
                class="clear-search-btn"
                @press="clearItemSearch"
              >
                Clear
              </PixelButton>
            </div>

            <div class="toolbar-toggles">
              <PixelButton
                class="save-codebase-btn"
                :primary="true"
                :disabled="isSaving || modifiedItemsCount === 0"
                @press="saveItemsToCodebase"
              >
                {{ saveItemStatus || 'Save to Codebase' }}
              </PixelButton>
              <PixelButton
                class="toggle-btn"
                :class="{ 'is-active': onlyModifiedItems }"
                @press="toggleOnlyModifiedItems"
              >
                {{ onlyModifiedItems ? 'Showing Modified Only' : 'Show All Items' }}
              </PixelButton>
              <PixelButton
                class="reset-all-btn"
                :disabled="modifiedItemsCount === 0"
                @press="resetAllFootprints"
              >
                Reset All Items
              </PixelButton>
            </div>
          </div>

          <!-- Category Tabs -->
          <nav class="category-tabs" aria-label="Item categories">
            <PixelButton
              v-for="cat in ITEM_CATEGORIES"
              :key="cat.id"
              class="tab-btn"
              :class="{ 'is-chosen': activeItemCategory === cat.id }"
              @press="activeItemCategory = cat.id"
            >
              {{ cat.label }} ({{ countItemCategory(cat.id) }})
            </PixelButton>
          </nav>
        </section>

        <!-- Items Grid -->
        <main class="items-grid-container">
          <div v-if="filteredItems.length === 0" class="empty-state px-frame">
            <p class="empty-text">No items match the current filter or search criteria.</p>
            <PixelButton @press="clearItemFilters">Reset Filters</PixelButton>
          </div>

          <div v-else class="items-cards-grid">
            <ItemSizingCard
              v-for="entry in filteredItems"
              :key="entry.id"
              :art="art"
              :entry="entry"
              :width="footprints[entry.id]?.width ?? entry.defaultFootprint.width"
              :height="footprints[entry.id]?.height ?? entry.defaultFootprint.height"
              @update:width="updateItemWidth(entry.id, $event)"
              @update:height="updateItemHeight(entry.id, $event)"
            />
          </div>
        </main>

        <!-- Items Output & Fix Export -->
        <section class="export-section px-frame">
          <header class="export-header">
            <div class="export-title-group">
              <h3 class="export-title">OUTPUT FIX: ITEM_FOOTPRINTS</h3>
              <span class="export-sub">Generated TypeScript code ready to update shared/grid-inventory.ts</span>
            </div>

            <div class="export-actions">
              <PixelButton
                class="export-mode-btn"
                :class="{ 'is-chosen': itemExportMode === 'full' }"
                @press="itemExportMode = 'full'"
              >
                Full Code
              </PixelButton>
              <PixelButton
                class="export-mode-btn"
                :class="{ 'is-chosen': itemExportMode === 'modified' }"
                @press="itemExportMode = 'modified'"
              >
                Modified Only ({{ modifiedItemsCount }})
              </PixelButton>
              <PixelButton
                class="export-mode-btn"
                :class="{ 'is-chosen': itemExportMode === 'json' }"
                @press="itemExportMode = 'json'"
              >
                JSON
              </PixelButton>
              <PixelButton
                class="save-codebase-btn"
                :primary="true"
                :disabled="isSaving"
                @press="saveItemsToCodebase"
              >
                {{ saveItemStatus || 'Save to Codebase' }}
              </PixelButton>
              <PixelButton
                class="copy-btn"
                @press="copyItemCode"
              >
                {{ copyItemStatus || 'Copy Code' }}
              </PixelButton>
            </div>
          </header>

          <div class="code-container">
            <pre class="code-preview"><code>{{ formattedItemOutputCode }}</code></pre>
          </div>
        </section>
      </template>

      <!-- ============================================== -->
      <!-- SECTION 2: LOOTABLE OBJECTS SIZING BENCH       -->
      <!-- ============================================== -->
      <template v-else>
        <!-- Containers Controls Deck -->
        <section class="dev-toolbar px-frame">
          <div class="toolbar-top-row">
            <div class="toolbar-stats">
              <PixelButton class="stat-pill" @press="previewCanvas = !previewCanvas">
                Preview: {{ previewCanvas ? 'Canvas' : 'Vue overlay' }}
              </PixelButton>
              <span class="stat-pill">Total: {{ containerCatalogue.length }}</span>
              <span class="stat-pill" :class="{ 'is-highlight': modifiedContainersCount > 0 }">
                Modified: {{ modifiedContainersCount }}
              </span>
              <span class="stat-pill">Visible: {{ filteredContainers.length }}</span>
            </div>

            <div class="toolbar-search-box">
              <input
                v-model="containerSearchQuery"
                type="text"
                class="search-input"
                placeholder="Search lootable objects..."
              />
              <PixelButton
                v-if="containerSearchQuery"
                class="clear-search-btn"
                @press="clearContainerSearch"
              >
                Clear
              </PixelButton>
            </div>

            <div class="toolbar-toggles">
              <PixelButton
                class="save-codebase-btn"
                :primary="true"
                :disabled="isSaving || modifiedContainersCount === 0"
                @press="saveContainersToCodebase"
              >
                {{ saveContainerStatus || 'Save to Codebase' }}
              </PixelButton>
              <PixelButton
                class="toggle-btn"
                :class="{ 'is-active': onlyModifiedContainers }"
                @press="toggleOnlyModifiedContainers"
              >
                {{ onlyModifiedContainers ? 'Showing Modified Only' : 'Show All Objects' }}
              </PixelButton>
              <PixelButton
                class="reset-all-btn"
                :disabled="modifiedContainersCount === 0"
                @press="resetAllContainers"
              >
                Reset All Objects
              </PixelButton>
            </div>
          </div>
        </section>

        <!-- Containers Grid -->
        <main class="items-grid-container">
          <div v-if="filteredContainers.length === 0" class="empty-state px-frame">
            <p class="empty-text">No lootable objects match the current filter or search criteria.</p>
            <PixelButton @press="clearContainerFilters">Reset Filters</PixelButton>
          </div>

          <div v-else class="containers-cards-grid">
            <ContainerSizingCard
              v-for="entry in filteredContainers"
              :key="entry.id"
              :art="art"
              :entry="entry"
              :cols="containerSizes[entry.kind]?.cols ?? entry.defaultDimensions.cols"
              :rows="containerSizes[entry.kind]?.rows ?? entry.defaultDimensions.rows"
              :blocked="containerSizes[entry.kind]?.blocked ?? entry.defaultDimensions.blocked ?? []"
              @update:cols="updateContainerCols(entry.kind, $event)"
              @update:rows="updateContainerRows(entry.kind, $event)"
              @update:blocked="updateContainerBlocked(entry.kind, $event)"
              @preview="openPreviewModal(entry)"
            />
          </div>
        </main>

        <!-- Containers Output & Fix Export -->
        <section class="export-section px-frame">
          <header class="export-header">
            <div class="export-title-group">
              <h3 class="export-title">OUTPUT FIX: CONTAINER_GRID_SIZE</h3>
              <span class="export-sub">Generated TypeScript code ready to update shared/containers.ts</span>
            </div>

            <div class="export-actions">
              <PixelButton
                class="export-mode-btn"
                :class="{ 'is-chosen': containerExportMode === 'full' }"
                @press="containerExportMode = 'full'"
              >
                Full Code
              </PixelButton>
              <PixelButton
                class="export-mode-btn"
                :class="{ 'is-chosen': containerExportMode === 'modified' }"
                @press="containerExportMode = 'modified'"
              >
                Modified Only ({{ modifiedContainersCount }})
              </PixelButton>
              <PixelButton
                class="export-mode-btn"
                :class="{ 'is-chosen': containerExportMode === 'json' }"
                @press="containerExportMode = 'json'"
              >
                JSON
              </PixelButton>
              <PixelButton
                class="save-codebase-btn"
                :primary="true"
                :disabled="isSaving"
                @press="saveContainersToCodebase"
              >
                {{ saveContainerStatus || 'Save to Codebase' }}
              </PixelButton>
              <PixelButton
                class="copy-btn"
                @press="copyContainerCode"
              >
                {{ copyContainerStatus || 'Copy Code' }}
              </PixelButton>
            </div>
          </header>

          <div class="code-container">
            <pre class="code-preview"><code>{{ formattedContainerOutputCode }}</code></pre>
          </div>
        </section>
      </template>
    </div>

    <!-- In-Game Dual Loot Modal Preview -->
    <CanvasLootPreview
      v-if="previewModal && previewCanvas"
      :art="art"
      :title="previewModal.title"
      :kind="previewModal.containerKind"
      :grid="previewModal.grid"
      :container-art="previewModal.containerArt"
      @close="closePreviewModal"
    />
    <DualLootModal
      v-else-if="previewModal"
      :art="art"
      :container-title="previewModal.title"
      :container-kind="previewModal.containerKind"
      :container-art="previewModal.containerArt"
      :container-grid="previewModal.grid"
      backpack-tier="satchel"
      @close="closePreviewModal"
    />
  </TitlePage>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import type { ArtBook } from '../../art/types.ts';
import {
  buildItemCatalogue,
  generateFootprintsCode,
  generateFootprintsJson,
  type DevItemCategory,
  type DevItemEntry,
} from '../../game/dev/item-catalogue.ts';
import {
  buildContainerCatalogue,
  generateContainerGridSizeCode,
  generateContainerGridSizeJson,
  type DevContainerEntry,
} from '../../game/dev/container-catalogue.ts';
import type { ContainerArt } from '../../art/containers.ts';
import {
  autoPackItem,
  createInventoryGrid,
  randomPackItem,
  type GridFootprint,
  type GridPoint,
  type InventoryGrid,
} from '../../../shared/grid-inventory.ts';
import {
  CONTAINER_LABEL,
  containerGridDimensions,
  type ContainerGridDimensions,
  type ContainerKind,
} from '../../../shared/containers.ts';
import PixelButton from '../PixelButton.vue';
import TitlePage from '../TitlePage.vue';
import DualLootModal from '../DualLootModal.vue';
import CanvasLootPreview from './CanvasLootPreview.vue';
import ItemSizingCard from './ItemSizingCard.vue';
import ContainerSizingCard from './ContainerSizingCard.vue';

interface Props {
  art?: ArtBook | null;
}

const props = withDefaults(defineProps<Props>(), {
  art: null,
});

const emit = defineEmits<{ close: [] }>();

// Bench view switcher: 'items' or 'containers'
const activeView = ref<'items' | 'containers'>('items');
const isSaving = ref(false);

// ==========================================
// 1. ITEMS STATE & LOGIC
// ==========================================
const catalogue: DevItemEntry[] = buildItemCatalogue();

const initialFootprints: Record<string, GridFootprint> = {};
for (const item of catalogue) {
  initialFootprints[item.id] = {
    width: item.defaultFootprint.width,
    height: item.defaultFootprint.height,
  };
}

const footprints = reactive<Record<string, GridFootprint>>(initialFootprints);

const itemSearchQuery = ref('');
const activeItemCategory = ref<'all' | DevItemCategory>('all');
const onlyModifiedItems = ref(false);
const itemExportMode = ref<'full' | 'modified' | 'json'>('full');
const copyItemStatus = ref('');

const ITEM_CATEGORIES: ReadonlyArray<{ readonly id: 'all' | DevItemCategory; readonly label: string }> = [
  { id: 'all', label: 'All Items' },
  { id: 'weapons', label: 'Weapons' },
  { id: 'ammo', label: 'Ammo' },
  { id: 'survival', label: 'Survival' },
  { id: 'fortifications', label: 'Fortifications' },
  { id: 'gear', label: 'Gear' },
  { id: 'parts', label: 'Parts' },
  { id: 'kits', label: 'Kits' },
  { id: 'salvage', label: 'Salvage' },
  { id: 'candies', label: 'Candies' },
];

const countItemCategory = (catId: 'all' | DevItemCategory): number => {
  if (catId === 'all') return catalogue.length;
  return catalogue.filter((item) => item.category === catId).length;
};

const isItemModified = (item: DevItemEntry): boolean => {
  const current = footprints[item.id];
  if (!current) return false;
  const isWidthSame = current.width === item.defaultFootprint.width;
  const isHeightSame = current.height === item.defaultFootprint.height;
  return !(isWidthSame && isHeightSame);
};

const modifiedItemsCount = computed(() => catalogue.filter(isItemModified).length);

const filteredItems = computed(() => {
  const query = itemSearchQuery.value.trim().toLowerCase();
  return catalogue.filter((item) => {
    const matchesCategory = activeItemCategory.value === 'all' || item.category === activeItemCategory.value;
    if (!matchesCategory) return false;

    if (onlyModifiedItems.value) {
      const modified = isItemModified(item);
      if (!modified) return false;
    }

    if (query.length > 0) {
      const matchesName = item.name.toLowerCase().includes(query);
      const matchesId = item.id.toLowerCase().includes(query);
      return matchesName || matchesId;
    }

    return true;
  });
});

const formattedItemOutputCode = computed(() => {
  if (itemExportMode.value === 'json') {
    return generateFootprintsJson(footprints, false);
  }
  const isModifiedOnly = itemExportMode.value === 'modified';
  return generateFootprintsCode(footprints, isModifiedOnly);
});

const updateItemWidth = (id: string, width: number): void => {
  const current = footprints[id];
  if (!current) return;
  footprints[id] = { ...current, width };
};

const updateItemHeight = (id: string, height: number): void => {
  const current = footprints[id];
  if (!current) return;
  footprints[id] = { ...current, height };
};

const clearItemSearch = (): void => {
  itemSearchQuery.value = '';
};

const toggleOnlyModifiedItems = (): void => {
  onlyModifiedItems.value = !onlyModifiedItems.value;
};

const clearItemFilters = (): void => {
  itemSearchQuery.value = '';
  activeItemCategory.value = 'all';
  onlyModifiedItems.value = false;
};

const resetAllFootprints = (): void => {
  for (const item of catalogue) {
    footprints[item.id] = {
      width: item.defaultFootprint.width,
      height: item.defaultFootprint.height,
    };
  }
};

const saveItemStatus = ref('');
let copyItemTimeout: ReturnType<typeof setTimeout> | null = null;
let saveItemTimeout: ReturnType<typeof setTimeout> | null = null;

const saveItemsToCodebase = async (): Promise<void> => {
  if (isSaving.value) return;
  isSaving.value = true;
  saveItemStatus.value = 'SAVING...';

  try {
    const response = await fetch('/api/dev/inventory-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: 'items',
        footprints,
      }),
    });

    if (response.ok) {
      saveItemStatus.value = 'SAVED TO CODE!';
    } else {
      saveItemStatus.value = 'SAVE FAILED';
    }
  } catch {
    saveItemStatus.value = 'SAVE ERROR';
  } finally {
    isSaving.value = false;
  }

  if (saveItemTimeout) clearTimeout(saveItemTimeout);
  saveItemTimeout = setTimeout(() => {
    saveItemStatus.value = '';
  }, 3000);
};

const copyItemCode = async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(formattedItemOutputCode.value);
    copyItemStatus.value = 'COPIED!';
  } catch {
    copyItemStatus.value = 'FAILED';
  }

  if (copyItemTimeout) clearTimeout(copyItemTimeout);
  copyItemTimeout = setTimeout(() => {
    copyItemStatus.value = '';
  }, 2500);
};

// ==========================================
// 2. CONTAINERS / LOOT OBJECTS STATE & LOGIC
// ==========================================
const containerCatalogue: DevContainerEntry[] = buildContainerCatalogue();

const initDimensionsFor = (kind: ContainerKind): ContainerGridDimensions => {
  const base = containerGridDimensions(kind);
  return {
    cols: base.cols,
    rows: base.rows,
    blocked: base.blocked ? [...base.blocked] : [],
  };
};

const initialContainerSizes: Record<ContainerKind, ContainerGridDimensions> = {
  drawer: initDimensionsFor('drawer'),
  locker: initDimensionsFor('locker'),
  fridge: initDimensionsFor('fridge'),
  cabinet: initDimensionsFor('cabinet'),
  shelf: initDimensionsFor('shelf'),
  box: initDimensionsFor('box'),
  car: initDimensionsFor('car'),
  bowl: initDimensionsFor('bowl'),
  booth: initDimensionsFor('booth'),
  dumpster: initDimensionsFor('dumpster'),
  desk: initDimensionsFor('desk'),
};

const containerSizes = reactive<Record<ContainerKind, ContainerGridDimensions>>(initialContainerSizes);

const containerSearchQuery = ref('');
const onlyModifiedContainers = ref(false);
const containerExportMode = ref<'full' | 'modified' | 'json'>('full');
const copyContainerStatus = ref('');

const areBlockedPointsMatching = (a?: readonly GridPoint[], b?: readonly GridPoint[]): boolean => {
  const aList = a ?? [];
  const bList = b ?? [];
  const hasMismatch = aList.length !== bList.length;
  if (hasMismatch) {
    return false;
  }
  const toPointKey = (pt: GridPoint): string => `${pt.x}:${pt.y}`;
  const aKeys = [...aList].map(toPointKey).sort();
  const bKeys = [...bList].map(toPointKey).sort();
  return aKeys.every((key, index) => key === bKeys[index]);
};

const isContainerModified = (entry: DevContainerEntry): boolean => {
  const current = containerSizes[entry.kind];
  if (!current) return false;
  const colsMatch = current.cols === entry.defaultDimensions.cols;
  const rowsMatch = current.rows === entry.defaultDimensions.rows;
  const blockedMatch = areBlockedPointsMatching(current.blocked, entry.defaultDimensions.blocked);
  const isAllMatching = colsMatch && rowsMatch && blockedMatch;
  return !isAllMatching;
};

const modifiedContainersCount = computed(() => {
  const modifiedKinds = new Set<ContainerKind>();
  for (const entry of containerCatalogue) {
    if (isContainerModified(entry)) {
      modifiedKinds.add(entry.kind);
    }
  }
  return modifiedKinds.size;
});

const filteredContainers = computed(() => {
  const query = containerSearchQuery.value.trim().toLowerCase();
  return containerCatalogue.filter((entry) => {
    if (onlyModifiedContainers.value) {
      const modified = isContainerModified(entry);
      if (!modified) return false;
    }

    if (query.length > 0) {
      const matchesName = entry.name.toLowerCase().includes(query);
      const matchesKind = entry.kind.toLowerCase().includes(query);
      const matchesLook = entry.look.toLowerCase().includes(query);
      const matchesDesc = entry.description.toLowerCase().includes(query);
      return matchesName || matchesKind || matchesLook || matchesDesc;
    }

    return true;
  });
});

const formattedContainerOutputCode = computed(() => {
  if (containerExportMode.value === 'json') {
    return generateContainerGridSizeJson(containerSizes, false);
  }
  const isModifiedOnly = containerExportMode.value === 'modified';
  return generateContainerGridSizeCode(containerSizes, isModifiedOnly);
});

const updateContainerCols = (kind: ContainerKind, cols: number): void => {
  const targetContainer = containerSizes[kind];
  if (!targetContainer) return;
  const currentBlocked = targetContainer.blocked ?? [];
  const trimmedBlocked = currentBlocked.filter((pt) => pt.x < cols);
  containerSizes[kind] = {
    ...targetContainer,
    cols,
    blocked: trimmedBlocked,
  };
};

const updateContainerRows = (kind: ContainerKind, rows: number): void => {
  const targetContainer = containerSizes[kind];
  if (!targetContainer) return;
  const currentBlocked = targetContainer.blocked ?? [];
  const trimmedBlocked = currentBlocked.filter((pt) => pt.y < rows);
  containerSizes[kind] = {
    ...targetContainer,
    rows,
    blocked: trimmedBlocked,
  };
};

const updateContainerBlocked = (kind: ContainerKind, blocked: GridPoint[]): void => {
  const targetContainer = containerSizes[kind];
  if (!targetContainer) return;
  containerSizes[kind] = {
    ...targetContainer,
    blocked,
  };
};

const clearContainerSearch = (): void => {
  containerSearchQuery.value = '';
};

const toggleOnlyModifiedContainers = (): void => {
  onlyModifiedContainers.value = !onlyModifiedContainers.value;
};

const clearContainerFilters = (): void => {
  containerSearchQuery.value = '';
  onlyModifiedContainers.value = false;
};

const resetAllContainers = (): void => {
  const allKinds = Object.keys(CONTAINER_LABEL) as ContainerKind[];
  for (const kind of allKinds) {
    const original = containerGridDimensions(kind);
    containerSizes[kind] = {
      cols: original.cols,
      rows: original.rows,
      blocked: original.blocked ? [...original.blocked] : [],
    };
  }
};

const saveContainerStatus = ref('');
let copyContainerTimeout: ReturnType<typeof setTimeout> | null = null;
let saveContainerTimeout: ReturnType<typeof setTimeout> | null = null;

const saveContainersToCodebase = async (): Promise<void> => {
  if (isSaving.value) return;
  isSaving.value = true;
  saveContainerStatus.value = 'SAVING...';

  try {
    const response = await fetch('/api/dev/inventory-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: 'containers',
        containerSizes,
      }),
    });

    if (response.ok) {
      saveContainerStatus.value = 'SAVED TO CODE!';
    } else {
      saveContainerStatus.value = 'SAVE FAILED';
    }
  } catch {
    saveContainerStatus.value = 'SAVE ERROR';
  } finally {
    isSaving.value = false;
  }

  if (saveContainerTimeout) clearTimeout(saveContainerTimeout);
  saveContainerTimeout = setTimeout(() => {
    saveContainerStatus.value = '';
  }, 3000);
};

const copyContainerCode = async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(formattedContainerOutputCode.value);
    copyContainerStatus.value = 'COPIED!';
  } catch {
    copyContainerStatus.value = 'FAILED';
  }

  if (copyContainerTimeout) clearTimeout(copyContainerTimeout);
  copyContainerTimeout = setTimeout(() => {
    copyContainerStatus.value = '';
  }, 2500);
};

// ==========================================
// 3. IN-GAME DUAL LOOT MODAL PREVIEW
// ==========================================
interface PreviewModalState {
  title: string;
  containerKind: ContainerKind;
  grid: InventoryGrid;
  containerArt?: ContainerArt | null;
}

const previewModal = ref<PreviewModalState | null>(null);
/** Preview draws the loot window on a canvas, as the game would, instead of the Vue overlay. */
const previewCanvas = ref(true);

const SAMPLE_LOOT_ITEMS = ['bandage', 'water_bottle', 'pistol_ammo', 'knife', 'medkit', 'full_size_bar'];

const openPreviewModal = (entry: DevContainerEntry): void => {
  const currentDimensions = containerSizes[entry.kind] ?? entry.defaultDimensions;
  const grid = createInventoryGrid(currentDimensions.cols, currentDimensions.rows, currentDimensions.blocked);

  // Seed sample loot items into the container grid to test in-game packing and dragging
  let seedIndex = 0;
  for (const itemType of SAMPLE_LOOT_ITEMS) {
    const itemSeedId = `preview-${entry.kind}-${seedIndex}`;
    seedIndex += 1;
    const itemData = {
      id: itemSeedId,
      type: itemType,
      rotated: false,
    };
    const placed = randomPackItem(grid, itemData, Math.random);
    if (!placed) {
      autoPackItem(grid, itemData);
    }
  }

  const containerArt = props.art ? props.art.containers[entry.look] : null;

  previewModal.value = {
    title: entry.name,
    containerKind: entry.kind,
    containerArt,
    grid,
  };
};

const closePreviewModal = (): void => {
  previewModal.value = null;
};
</script>

<style scoped>
.dev-inventory-layout {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 4);
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
}

.view-switch-nav {
  display: flex;
  gap: calc(var(--u) * 2);
  border-bottom: calc(var(--u) * 1) solid var(--ink-line);
  padding-bottom: calc(var(--u) * 2);
}

.view-tab-btn {
  font-size: calc(var(--u) * 5.5);
  font-weight: 700;
  padding: calc(var(--u) * 2) calc(var(--u) * 4);
}

.view-tab-btn.is-active {
  background: var(--amber);
  color: var(--ink);
  border-color: var(--bone);
}

.dev-toolbar {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
  padding: calc(var(--u) * 4);
  background: var(--ink-raised);
}

.toolbar-top-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--u) * 3);
}

.toolbar-stats {
  display: flex;
  gap: calc(var(--u) * 2);
}

.stat-pill {
  font-size: calc(var(--u) * 4.5);
  padding: calc(var(--u) * 1) calc(var(--u) * 2.5);
  background: var(--ink);
  color: var(--bone);
  border: calc(var(--u) * 0.5) solid var(--ink-line);
}

.stat-pill.is-highlight {
  color: var(--amber);
  border-color: var(--amber);
}

.toolbar-search-box {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 1);
  flex: 1;
  min-width: 240px;
  max-width: 440px;
}

.search-input {
  width: 100%;
  background: var(--ink);
  border: calc(var(--u) * 1) solid var(--ink-line);
  color: var(--bone);
  font-family: inherit;
  font-size: calc(var(--u) * 5);
  padding: calc(var(--u) * 1.5) calc(var(--u) * 2.5);
  outline: none;
}

.search-input:focus {
  border-color: var(--bone);
}

.clear-search-btn {
  font-size: calc(var(--u) * 4);
}

.toolbar-toggles {
  display: flex;
  gap: calc(var(--u) * 2);
}

.save-codebase-btn {
  font-weight: 700;
  font-size: calc(var(--u) * 4);
}

.toggle-btn.is-active {
  background: var(--amber);
  color: var(--ink);
}

.reset-all-btn {
  color: var(--blood-bright);
}

.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--u) * 1.5);
  border-top: calc(var(--u) * 0.5) solid var(--ink-line);
  padding-top: calc(var(--u) * 2.5);
}

.tab-btn {
  font-size: calc(var(--u) * 4);
  padding: calc(var(--u) * 1) calc(var(--u) * 2);
}

.tab-btn.is-chosen {
  background: var(--sick);
  color: var(--ink);
}

.items-grid-container {
  min-height: 300px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(var(--u) * 3);
  padding: calc(var(--u) * 8);
  background: var(--ink-raised);
}

.empty-text {
  font-size: calc(var(--u) * 5.5);
  color: var(--bone-dim);
}

.items-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: calc(var(--u) * 4);
}

.containers-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: calc(var(--u) * 4);
}

.export-section {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
  padding: calc(var(--u) * 4);
  background: var(--ink-raised);
}

.export-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--u) * 2);
}

.export-title-group {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.5);
}

.export-title {
  margin: 0;
  font-size: calc(var(--u) * 6);
  color: var(--bone);
}

.export-sub {
  font-size: calc(var(--u) * 4);
  color: var(--bone-dim);
}

.export-actions {
  display: flex;
  gap: calc(var(--u) * 1.5);
}

.export-mode-btn.is-chosen {
  background: var(--amber);
  color: var(--ink);
}

.copy-btn {
  font-weight: 700;
}

.code-container {
  background: var(--ink);
  border: calc(var(--u) * 1) solid var(--ink-line);
  max-height: 280px;
  overflow-y: auto;
  overflow-x: auto;
  padding: calc(var(--u) * 3);
}

.code-preview {
  margin: 0;
  font-family: monospace;
  font-size: calc(var(--u) * 4.5);
  line-height: 1.4;
  color: var(--bone);
  white-space: pre;
}
</style>
