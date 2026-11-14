<template>
  <section class="building-editor">
    <!-- Left: every building kind -->
    <aside class="building-list px-frame" aria-label="Buildings">
      <h3 class="pane-title">BUILDINGS ({{ BUILDING_KINDS.length }})</h3>
      <PixelButton
        v-for="kind in BUILDING_KINDS"
        :key="kind"
        class="building-row"
        :class="{ 'is-chosen': selected === kind, 'is-dirty': isBuildingDirty(kind) }"
        @press="selected = kind"
      >
        {{ BUILDING_DEFS[kind].label }}
      </PixelButton>
    </aside>

    <!-- Right: the selected building's containers and loot pool, all editable in the draft -->
    <main class="building-detail px-frame">
      <header class="detail-header">
        <div>
          <h3 class="pane-title">{{ BUILDING_DEFS[selected].label.toUpperCase() }}</h3>
          <code class="detail-id">{{ selected }}</code>
        </div>
        <div class="detail-actions">
          <PixelButton class="reset-btn" :disabled="!isBuildingDirty(selected)" @press="resetBuilding(selected)">
            Reset Building
          </PixelButton>
          <!-- Save target for buildings and loot tables lands in a later phase; the draft stays in memory until then. -->
          <PixelButton class="save-btn" :primary="true" disabled>
            Save: phase 2
          </PixelButton>
        </div>
      </header>

      <section class="detail-section">
        <h4 class="section-title">ROOMS: PROP → CONTAINER</h4>
        <p v-if="propRows.length === 0" class="empty-text">No searchable props in this building.</p>
        <div v-for="row in propRows" :key="row.prop" class="prop-row">
          <span class="prop-name">{{ row.prop }}</span>
          <select
            class="container-select"
            :value="row.container"
            @change="setContainer(row.prop, ($event.target as HTMLSelectElement).value as ContainerKind)"
          >
            <option v-for="kind in containerKinds" :key="kind" :value="kind">{{ CONTAINER_LABEL[kind] }}</option>
          </select>
          <PixelButton class="size-btn" @press="emit('openContainer', row.container)">
            Size grid
          </PixelButton>
        </div>
      </section>

      <section class="detail-section">
        <h4 class="section-title">LOOT POOL (ODDS {{ Math.round(draftLoot.odds * 100) }}%)</h4>
        <div class="odds-row">
          <label class="odds-label" for="building-odds">Odds</label>
          <input
            id="building-odds"
            class="odds-input"
            type="number"
            min="0"
            max="1"
            step="0.05"
            :value="draftLoot.odds"
            @change="setOdds(Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div v-for="[item, weight] in poolRows" :key="item" class="pool-row">
          <span class="item-name">{{ item }}</span>
          <input
            class="weight-input"
            type="number"
            min="0"
            step="0.25"
            :value="weight"
            @change="setWeight(item, Number(($event.target as HTMLInputElement).value))"
          />
          <PixelButton class="item-btn" @press="emit('openItem', item)">Footprint</PixelButton>
          <PixelButton class="item-btn" @press="removeItem(item)">Remove</PixelButton>
        </div>
        <div class="pool-add">
          <select v-model="addItemChoice" class="container-select">
            <option value="">Add item…</option>
            <option v-for="item in addableItems" :key="item" :value="item">{{ item }}</option>
          </select>
          <PixelButton :disabled="!addItemChoice" @press="addItem">Add</PixelButton>
        </div>
      </section>
    </main>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import PixelButton from '../PixelButton.vue';
import { BUILDING_DEFS, BUILDING_KINDS } from '../../../shared/map-protocol.ts';
import type { BuildingKind, PropKind } from '../../../shared/map-protocol.ts';
import { CONTAINER_LABEL, ROOM_CONTAINERS } from '../../../shared/containers.ts';
import type { ContainerKind } from '../../../shared/containers.ts';
import { CONTAINER_LOOT } from '../../../shared/container-loot.ts';
import { PICKUP_TYPES } from '../../../shared/events.ts';

const emit = defineEmits<{
  /** Opens the container's size grid in the in-game editor. */
  openContainer: [kind: ContainerKind];
  /** Opens the item's footprint in the in-game editor. */
  openItem: [id: string];
}>();

type Pool = Partial<Record<string, number>>;

/** Each building's draft: a copy of its rooms and loot, so edits never touch the code's own tables. */
interface BuildingDraft {
  rooms: Partial<Record<PropKind, ContainerKind>>;
  odds: number;
  pool: Pool;
}

const copyDraft = (kind: BuildingKind): BuildingDraft => {
  const loot = CONTAINER_LOOT[kind];
  return {
    rooms: { ...ROOM_CONTAINERS[kind] },
    odds: loot.odds,
    pool: { ...loot.table },
  };
};

const drafts = reactive<Record<string, BuildingDraft>>(
  Object.fromEntries(BUILDING_KINDS.map((kind) => [kind, copyDraft(kind)])),
);

const selected = ref<BuildingKind>(BUILDING_KINDS[0]);
const addItemChoice = ref('');

const containerKinds = Object.keys(CONTAINER_LABEL) as ContainerKind[];

const current = computed(() => drafts[selected.value]);
const draftLoot = computed(() => ({ odds: current.value.odds }));

/** Each searchable prop of the building, with the container it opens as. */
const propRows = computed(() =>
  Object.entries(current.value.rooms).map(([prop, container]) => ({ prop, container: container as ContainerKind })),
);

/** The loot pool's items, sorted by name, with their weights. */
const poolRows = computed(() => Object.entries(current.value.pool).sort(([a], [b]) => a.localeCompare(b)));

const addableItems = computed(() => PICKUP_TYPES.filter((item) => !(item in current.value.pool)));

const isBuildingDirty = (kind: BuildingKind): boolean => {
  const original = CONTAINER_LOOT[kind];
  const draft = drafts[kind];
  if (!draft) return false;
  const roomsOriginal = ROOM_CONTAINERS[kind] ?? {};
  const roomsDirty = JSON.stringify(sortKeys(draft.rooms)) !== JSON.stringify(sortKeys(roomsOriginal));
  const poolDirty = JSON.stringify(sortKeys(draft.pool)) !== JSON.stringify(sortKeys(original.table));
  return roomsDirty || poolDirty || draft.odds !== original.odds;
};

const sortKeys = (obj: object): object => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));

const setContainer = (prop: string, container: ContainerKind): void => {
  drafts[selected.value].rooms[prop as PropKind] = container;
};

const setOdds = (odds: number): void => {
  if (!Number.isFinite(odds)) return;
  drafts[selected.value].odds = Math.min(1, Math.max(0, odds));
};

const setWeight = (item: string, weight: number): void => {
  if (!Number.isFinite(weight)) return;
  if (weight <= 0) {
    removeItem(item);
    return;
  }
  drafts[selected.value].pool[item] = weight;
};

const removeItem = (item: string): void => {
  delete drafts[selected.value].pool[item];
};

const addItem = (): void => {
  if (!addItemChoice.value) return;
  drafts[selected.value].pool[addItemChoice.value] = 1;
  addItemChoice.value = '';
};

const resetBuilding = (kind: BuildingKind): void => {
  drafts[kind] = copyDraft(kind);
};
</script>

<style scoped>
.building-editor {
  display: grid;
  grid-template-columns: minmax(180px, 240px) 1fr;
  gap: calc(var(--u) * 4);
  align-items: start;
}

.building-list,
.building-detail {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2);
  padding: calc(var(--u) * 4);
}

.building-row {
  text-align: left;
  font-size: calc(var(--u) * 4.5);
}

.building-row.is-chosen {
  border-color: var(--amber);
}

.building-row.is-dirty::after {
  content: ' *';
  color: var(--amber);
}

.pane-title,
.section-title {
  font-weight: 700;
  letter-spacing: 0.05em;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: calc(var(--u) * 3);
  flex-wrap: wrap;
}

.detail-id {
  font-size: calc(var(--u) * 4);
  opacity: 0.7;
}

.detail-actions {
  display: flex;
  gap: calc(var(--u) * 2);
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2);
  padding-top: calc(var(--u) * 3);
  border-top: calc(var(--u) * 0.5) solid var(--ink-line);
}

.prop-row,
.pool-row,
.pool-add,
.odds-row {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 2);
  flex-wrap: wrap;
}

.prop-name,
.item-name {
  min-width: 140px;
  font-size: calc(var(--u) * 4.5);
}

.container-select,
.odds-input,
.weight-input {
  font-size: calc(var(--u) * 4.5);
  padding: calc(var(--u) * 1) calc(var(--u) * 2);
  background: var(--ink-raised);
  color: inherit;
  border: calc(var(--u) * 0.5) solid var(--ink-line);
}

.weight-input,
.odds-input {
  width: 90px;
}

.item-btn,
.size-btn {
  font-size: calc(var(--u) * 4);
}

.empty-text {
  opacity: 0.7;
}

@media (max-width: 700px) {
  .building-editor {
    grid-template-columns: 1fr;
  }
}
</style>
