<template>
  <!-- The bench is drawn on the game canvas by the page kit. The editors are drawn there too; this component draws nothing itself. -->
  <CanvasLootPreview
    v-if="containerEditor"
    :key="`${containerEditor.entryId}:${containerEditor.rev}`"
    :position="containerPosition"
    :art="art"
    :title="containerEditor.title"
    :kind="containerEditor.kind"
    :grid="containerEditor.grid"
    :container-art="containerEditor.containerArt"
    :library="lookEntries"
    :library-current="containerEditor.entryId"
    library-title="LOOKS"
    :look="lookView"
    @pick="openContainerById"
    @close="closeEditor"
    @size="onEditorSize"
    @blocked="onEditorBlocked"
    @footprint="onEditorFootprint"
    @save="saveAll"
    @step="stepContainer"
    @look="stepLook"
    @grid="toggleOwnGrid"
  />
  <CanvasLootPreview
    v-else-if="itemEditor"
    :key="itemEditor.entryId"
    :position="itemPosition"
    :art="art"
    :title="itemEditor.name"
    kind="box"
    :grid="itemEditor.grid"
    :focus-item="itemEditor.entryId"
    :container-art="boxArt"
    :library="libraryEntries"
    @pick="openContainerById"
    @close="closeEditor"
    @footprint="onEditorFootprint"
    @save="saveAll"
    @step="stepItemContainer"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ArtBook } from '../../art/types.ts';
import type { ContainerArt } from '../../art/containers.ts';
import type { InventoryGrid, GridPoint } from '../../../shared/grid-inventory.ts';
import { autoPackItem, createInventoryGrid, randomPackItem } from '../../../shared/grid-inventory.ts';
import type { BuildingKind, PropKind } from '../../../shared/map-protocol.ts';
import { BUILDING_KINDS } from '../../../shared/map-protocol.ts';
import { nextStep, prevStep, type BuildingStep } from '../../game/dev/building-wizard.ts';
import { PICKUP_TYPES } from '../../../shared/events.ts';
import type { ContainerKind } from '../../../shared/containers.ts';
import { flipDimensions, flipPoint, isVerticalLook } from '../../../shared/container-flip.ts';
import { useCanvasPage } from '../use-canvas-page.ts';
import CanvasLootPreview from './CanvasLootPreview.vue';
import type { LibraryEntry, LookEditView } from '../../engine/loot-ui.ts';
import {
  benchContainers,
  benchItems,
  buildingDrafts,
  containerSizes,
  entryGrid,
  footprints,
  hasOwnGrid,
  isBaseLook,
  isContainerModified,
  isItemModified,
  MAX_WEIGHT,
  resetAllContainers,
  resetAllItems,
  resetBuilding,
  isBuildingDirty,
  setEntryBlocked,
  setEntrySize,
  setItemSize,
  setOwnGrid,
  syncToCodebase,
} from '../../game/dev/bench-store.ts';
import { buildBenchModel, type BenchIcons, type BenchTab, type ItemRow, type ObjectRow } from '../../game/dev/bench-canvas-model.ts';
import type { PickupType } from '../../../shared/protocol.ts';
import { lootSprite } from '../../game/inventory/loot-item-art.ts';
import type { DevContainerEntry } from '../../game/dev/container-catalogue.ts';
import type { DevItemEntry } from '../../game/dev/item-catalogue.ts';

const props = defineProps<{ art: ArtBook | null }>();
const emit = defineEmits<{ close: [] }>();

const tab = ref<BenchTab>('items');
const building = ref<BuildingKind>(BUILDING_KINDS[0]);
const buildingStep = ref<BuildingStep>('pick');
const roomPick = ref<string | null>(null);
const status = ref('');
let statusTimer: ReturnType<typeof setTimeout> | null = null;

/** A container open in the in-game editor: its own grid, seeded with sample loot the way the Vue bench seeds it. */
interface ContainerEditor {
  entryId: string;
  /** Bumped when the grid is swapped under the editor (own grid on or off), so it opens afresh. */
  rev: number;
  kind: ContainerKind;
  title: string;
  grid: InventoryGrid;
  containerArt: ContainerArt | null;
  flipped: boolean;
}

interface ItemEditor {
  entryId: string;
  name: string;
  grid: InventoryGrid;
}

const containerEditor = ref<ContainerEditor | null>(null);
const itemEditor = ref<ItemEditor | null>(null);
const editing = computed(() => containerEditor.value !== null || itemEditor.value !== null);

const SAMPLE_LOOT_ITEMS = ['bandage', 'water_bottle', 'pistol_ammo', 'knife', 'medkit', 'full_size_bar'];

const shownSize = (entry: DevContainerEntry) => {
  const saved = entryGrid(entry);
  return isVerticalLook(entry.look) ? flipDimensions(saved) : saved;
};

const itemRows = computed<ItemRow[]>(() =>
  benchItems.map((entry: DevItemEntry) => ({
    id: entry.id,
    name: entry.name,
    width: footprints[entry.id]?.width ?? entry.defaultFootprint.width,
    height: footprints[entry.id]?.height ?? entry.defaultFootprint.height,
    modified: isItemModified(entry),
  })),
);

const objectRows = computed<ObjectRow[]>(() =>
  benchContainers.map((entry) => {
    const size = shownSize(entry);
    return { id: entry.id, kind: entry.kind, name: entry.name, cols: size.cols, rows: size.rows, modified: isContainerModified(entry) };
  }),
);

const itemsModified = computed(() => itemRows.value.filter((row) => row.modified).length);
const objectsModified = computed(() => objectRows.value.filter((row) => row.modified).length);

/** The bench's pictures, straight from the loaded art book. */
const icons = computed<BenchIcons>(() => {
  const art = props.art;
  return {
    building: (kind) => art?.environment.buildings[kind]?.[0],
    prop: (prop) => art?.environment.props[prop as PropKind],
    container: (kind) => art?.containers[kind]?.closed,
    // The same picture the bag and loot grid draw, then the ground pickup when there is no bag icon.
    item: (id) => (art ? (lootSprite(art, id) ?? art.pickups[id as PickupType]?.frames[0]) : undefined),
    object: (id) => {
      const entry = benchContainers.find((candidate) => candidate.id === id);
      return entry ? art?.containers[entry.look]?.closed : undefined;
    },
  };
});

const model = computed(() =>
  buildBenchModel(
    {
      icons: icons.value,
      tab: tab.value,
      building: building.value,
      buildingStep: buildingStep.value,
      roomPick: roomPick.value,
      draft: buildingDrafts[building.value],
      buildingDirty: isBuildingDirty,
      items: itemRows.value,
      objects: objectRows.value,
      itemsModified: itemsModified.value,
      objectsModified: objectsModified.value,
      status: status.value,
    },
    { items: benchItems.length, objects: benchContainers.length },
  ),
);

const libraryEntries = computed<LibraryEntry[]>(() =>
  benchContainers.map((entry) => ({ id: entry.id, label: entry.name, art: props.art?.containers[entry.look] ?? null })),
);

const editorEntry = computed(() => benchContainers.find((e) => e.id === containerEditor.value?.entryId) ?? null);

/** The looks (sprite styles) of the open container's kind, base first, in catalogue order. */
const looksOfKind = computed(() => {
  const entry = editorEntry.value;
  if (!entry) return [];
  const looks = benchContainers.filter((e) => e.kind === entry.kind);
  return [...looks.filter(isBaseLook), ...looks.filter((e) => !isBaseLook(e))];
});

const lookEntries = computed<LibraryEntry[]>(() =>
  looksOfKind.value.map((entry, i) => ({
    id: entry.id,
    label: isBaseLook(entry) ? 'BASE' : `LOOK ${i + 1}`,
    art: props.art?.containers[entry.look] ?? null,
    ...(hasOwnGrid(entry) ? { tag: 'OWN' } : {}),
  })),
);

const lookView = computed<LookEditView | undefined>(() => {
  const entry = editorEntry.value;
  const looks = looksOfKind.value;
  if (!entry || looks.length < 2) return undefined;
  return {
    index: looks.findIndex((e) => e.id === entry.id) + 1,
    count: looks.length,
    base: isBaseLook(entry),
    own: hasOwnGrid(entry),
    onBase: looks.filter((e) => !hasOwnGrid(e)).length,
  };
});

const boxArt = computed<ContainerArt | null>(() => props.art?.containers.box ?? null);

const containerPosition = computed(() => {
  const at = containerEditor.value ? benchContainers.findIndex((e) => e.id === containerEditor.value!.entryId) : -1;
  return at < 0 ? '' : `${at + 1} OF ${benchContainers.length}`;
});

const itemPosition = computed(() => {
  const at = itemEditor.value ? benchItems.findIndex((e) => e.id === itemEditor.value!.entryId) : -1;
  return at < 0 ? '' : `${at + 1} OF ${benchItems.length}`;
});

function flashStatus(text: string): void {
  status.value = text;
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    status.value = '';
  }, 3000);
}

async function saveItems(): Promise<void> {
  flashStatus((await syncToCodebase('items')) ? 'SAVED TO CODE!' : 'SAVE FAILED');
}

async function saveObjects(): Promise<void> {
  flashStatus((await syncToCodebase('containers')) ? 'SAVED TO CODE!' : 'SAVE FAILED');
}

/** The editor's Save writes what it changed: container sizes and item footprints. */
async function saveAll(): Promise<void> {
  if (objectsModified.value > 0) await saveObjects();
  if (itemsModified.value > 0) await saveItems();
}

function openContainerEditor(entry: DevContainerEntry): void {
  const size = shownSize(entry);
  const grid = createInventoryGrid(size.cols, size.rows, size.blocked ?? []);
  SAMPLE_LOOT_ITEMS.forEach((type, index) => {
    const data = { id: `preview-${entry.kind}-${index}`, type, rotated: false };
    if (!randomPackItem(grid, data, Math.random)) autoPackItem(grid, data);
  });
  itemEditor.value = null;
  const rev = containerEditor.value?.entryId === entry.id ? containerEditor.value.rev + 1 : 0;
  containerEditor.value = {
    entryId: entry.id,
    rev,
    kind: entry.kind,
    title: entry.name,
    grid,
    containerArt: props.art?.containers[entry.look] ?? null,
    flipped: isVerticalLook(entry.look),
  };
}

function openContainerById(id: string): void {
  const entry = benchContainers.find((candidate) => candidate.id === id);
  if (entry) openContainerEditor(entry);
}

function openContainerByKind(kind: ContainerKind): void {
  const entry = benchContainers.find((candidate) => candidate.kind === kind);
  if (entry) openContainerEditor(entry);
}

function openItemEditor(entry: DevItemEntry): void {
  const box = containerSizes.box;
  containerEditor.value = null;
  itemEditor.value = {
    entryId: entry.id,
    name: entry.name,
    grid: createInventoryGrid(box.cols, box.rows, box.blocked ?? []),
  };
}

function closeEditor(): void {
  containerEditor.value = null;
  itemEditor.value = null;
}

/** Prev and Next in the container editor walk the objects; in the item editor they walk the containers from the box. */
function stepContainer(direction: -1 | 1): void {
  const at = containerEditor.value ? benchContainers.findIndex((e) => e.id === containerEditor.value!.entryId) : -1;
  const next = benchContainers[(Math.max(at, 0) + direction + benchContainers.length) % benchContainers.length];
  openContainerEditor(next);
}

/** Steps through the looks of the open container's kind, wrapping round. */
function stepLook(direction: -1 | 1): void {
  const looks = looksOfKind.value;
  const at = looks.findIndex((e) => e.id === containerEditor.value?.entryId);
  if (looks.length < 2 || at < 0) return;
  openContainerEditor(looks[(at + direction + looks.length) % looks.length]);
}

/** Gives the open look its own grid (a copy of the base to start from), or puts it back on the base grid. */
function toggleOwnGrid(): void {
  const entry = editorEntry.value;
  if (!entry || isBaseLook(entry)) return;
  setOwnGrid(entry, !hasOwnGrid(entry));
  flashStatus(hasOwnGrid(entry) ? 'OWN GRID' : 'BASE GRID');
  openContainerEditor(entry);
}

function stepItemContainer(direction: -1 | 1): void {
  const at = Math.max(0, benchContainers.findIndex((e) => e.kind === 'box'));
  openContainerEditor(benchContainers[(at + direction + benchContainers.length) % benchContainers.length]);
}

/** A variant look's first edit gives it its own grid, so editing one look never changes the others. The base look edits the base. */
function claimOwnGrid(entry: DevContainerEntry): void {
  if (isBaseLook(entry) || hasOwnGrid(entry)) return;
  setOwnGrid(entry, true);
  flashStatus('OWN GRID');
}

function onEditorSize(size: { cols: number; rows: number }): void {
  const editor = containerEditor.value;
  const entry = editorEntry.value;
  if (!editor || !entry) return;
  const own = editor.flipped ? { cols: size.rows, rows: size.cols } : size;
  claimOwnGrid(entry);
  setEntrySize(entry, own.cols, own.rows);
}

function onEditorBlocked(cells: GridPoint[]): void {
  const editor = containerEditor.value;
  const entry = editorEntry.value;
  if (!editor || !entry) return;
  claimOwnGrid(entry);
  setEntryBlocked(entry, editor.flipped ? cells.map(flipPoint) : cells);
}

function onEditorFootprint(change: { type: string; width: number; height: number }): void {
  setItemSize(change.type, change.width, change.height);
}

/** The page's buttons and rows. Each id names what it changes, so this is the one place they are read. */
function press(id: string): void {
  if (id === 'back') return emit('close');
  if (id === 'reset-items') return resetAllItems();
  if (id === 'save-items') return void saveItems();
  if (id === 'reset-objects') return resetAllContainers();
  if (id === 'save-objects') return void saveObjects();
  if (id === 'reset-building') return resetBuilding(building.value);
  if (id.startsWith('item:') || id.startsWith('foot:')) {
    const entry = benchItems.find((candidate) => candidate.id === id.slice(id.indexOf(':') + 1));
    if (entry) openItemEditor(entry);
    return;
  }
  if (id.startsWith('object:')) return openContainerById(id.slice('object:'.length));
  if (id.startsWith('building:')) {
    building.value = id.slice('building:'.length) as BuildingKind;
    buildingStep.value = nextStep('pick');
    roomPick.value = null;
    return;
  }
  if (id.startsWith('spot:')) {
    roomPick.value = id.slice('spot:'.length);
    return;
  }
  if (id.startsWith('box:') && roomPick.value) {
    buildingDrafts[building.value].rooms[roomPick.value as PropKind] = id.slice('box:'.length) as ContainerKind;
    roomPick.value = null;
    return;
  }
  if (id === 'box-cancel') {
    roomPick.value = null;
    return;
  }
  if (id === 'step-next') {
    buildingStep.value = nextStep(buildingStep.value);
    return;
  }
  if (id === 'step-back') {
    buildingStep.value = prevStep(buildingStep.value);
    return;
  }
  if (id === 'pick-another') {
    buildingStep.value = 'pick';
    return;
  }
  if (id.startsWith('size:')) return openContainerByKind(id.slice('size:'.length) as ContainerKind);
  if (id.startsWith('drop:')) {
    delete buildingDrafts[building.value].pool[id.slice('drop:'.length)];
    return;
  }
  if (id === 'add-item') {
    const draft = buildingDrafts[building.value];
    const next = PICKUP_TYPES.find((item) => !(item in draft.pool));
    if (next) draft.pool[next] = 1;
  }
}

function choose(id: string, option: string): void {
  if (id === 'view') {
    tab.value = option as BenchTab;
    return;
  }
}

function slide(id: string, value: number): void {
  const draft = buildingDrafts[building.value];
  if (id === 'odds') {
    draft.odds = Math.round(value * 100) / 100;
    return;
  }
  if (id.startsWith('weight:')) {
    const item = id.slice('weight:'.length);
    draft.pool[item] = Math.max(0.25, Math.round(value * MAX_WEIGHT * 4) / 4);
  }
}

useCanvasPage(
  model,
  {
    press,
    choose,
    slide,
    inert: () => editing.value,
    hidden: () => editing.value,
  },
  () => emit('close'),
);
</script>
