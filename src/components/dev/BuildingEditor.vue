<template>
  <section class="building-wizard px-frame">
    <!-- Step dots: where you are, and where you have been -->
    <ol class="step-dots" aria-label="Steps">
      <li
        v-for="(info, i) in BUILDING_STEPS"
        :key="info.id"
        class="step-dot"
        :class="{ 'is-now': i === index, 'is-past': i < index }"
        :aria-current="i === index ? 'step' : undefined"
      >
        <span class="dot-number">{{ i < index ? '✓' : i + 1 }}</span>
        <span class="dot-title">{{ info.title }}</span>
      </li>
    </ol>

    <header class="step-header">
      <p class="step-counter">
        {{ stepCounter(step) }}<template v-if="step !== 'pick'"> · {{ buildingLabel(selected) }}</template>
      </p>
      <h3 class="step-ask">{{ stepInfo(step).ask }}</h3>
      <p class="step-hint">{{ stepInfo(step).hint }}</p>
    </header>

    <!-- STEP 1: pick a building -->
    <div v-if="step === 'pick'" class="pick-grid">
      <PixelButton
        v-for="kind in BUILDING_KINDS"
        :key="kind"
        class="pick-card"
        :class="{ 'is-chosen': selected === kind }"
        @press="pick(kind)"
      >
        {{ buildingLabel(kind) }}
        <span v-if="isBuildingDirty(kind)" class="changed-tag">changed</span>
      </PixelButton>
    </div>

    <!-- STEP 2: what each search spot opens as -->
    <div v-else-if="step === 'rooms'" class="step-body">
      <p v-if="propRows.length === 0" class="empty-text">Nothing to search here. Press Next.</p>
      <div v-for="row in propRows" :key="row.prop" class="big-row">
        <span class="row-name">{{ friendlyName(row.prop) }}</span>
        <select
          class="big-select"
          :aria-label="`What ${friendlyName(row.prop)} opens as`"
          :value="row.container"
          @change="setContainer(row.prop, ($event.target as HTMLSelectElement).value as ContainerKind)"
        >
          <option v-for="kind in containerKinds" :key="kind" :value="kind">{{ CONTAINER_LABEL[kind] }}</option>
        </select>
        <PixelButton class="small-btn" @press="emit('openContainer', row.container)">Change size</PixelButton>
      </div>
    </div>

    <!-- STEP 3: what you can find -->
    <div v-else-if="step === 'loot'" class="step-body">
      <label class="big-row">
        <span class="row-name">How lucky?</span>
        <input
          class="big-slider"
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="draft.odds"
          @input="setOdds(Number(($event.target as HTMLInputElement).value))"
        />
        <span class="row-readout">{{ Math.round(draft.odds * 100) }}%</span>
      </label>
      <p class="step-hint">{{ oddsWords(draft.odds) }}</p>

      <h4 class="section-title">Things inside</h4>
      <p v-if="poolRows.length === 0" class="empty-text">Nothing inside yet. Add something below!</p>
      <div v-for="[item, weight] in poolRows" :key="item" class="big-row">
        <span class="row-name">{{ friendlyName(item) }}</span>
        <input
          class="big-slider"
          type="range"
          min="0.25"
          :max="MAX_WEIGHT"
          step="0.25"
          :value="weight"
          :aria-label="`How often you find ${friendlyName(item)}`"
          @input="setWeight(item, Number(($event.target as HTMLInputElement).value))"
        />
        <span class="row-readout">{{ weightWord(weight) }}</span>
        <PixelButton class="small-btn" @press="emit('openItem', item)">Size</PixelButton>
        <PixelButton class="small-btn" @press="removeItem(item)">Take out</PixelButton>
      </div>
      <div class="big-row">
        <select v-model="addItemChoice" class="big-select" aria-label="Pick a thing to put in">
          <option value="">Pick a thing to put in…</option>
          <option v-for="item in addableItems" :key="item" :value="item">{{ friendlyName(item) }}</option>
        </select>
        <PixelButton :disabled="!addItemChoice" @press="addItem">+ Put in</PixelButton>
      </div>
    </div>

    <!-- STEP 4: what changed -->
    <div v-else class="step-body">
      <ul v-if="changes.length > 0" class="change-list">
        <li v-for="line in changes" :key="line">{{ line }}</li>
      </ul>
      <p v-else class="empty-text">You did not change anything. That is OK!</p>
      <!-- Save target for buildings and loot tables lands in a later phase; the draft stays in memory until then. -->
      <p class="step-hint">Saving to code comes later. Your changes stay here until you close the game.</p>
    </div>

    <footer class="step-footer">
      <PixelButton v-if="step !== 'pick'" class="nav-btn" @press="step = prevStep(step)">‹ Back</PixelButton>
      <span class="spacer" />
      <template v-if="step === 'done'">
        <PixelButton class="nav-btn" :disabled="!isBuildingDirty(selected)" @press="resetBuilding(selected)">
          Undo my changes
        </PixelButton>
        <PixelButton class="nav-btn" :primary="true" @press="step = 'pick'">Finish ✓</PixelButton>
      </template>
      <PixelButton v-else-if="step !== 'pick'" class="nav-btn" :primary="true" @press="step = nextStep(step)">
        Next ›
      </PixelButton>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import PixelButton from '../PixelButton.vue';
import { BUILDING_KINDS } from '../../../shared/map-protocol.ts';
import type { BuildingKind, PropKind } from '../../../shared/map-protocol.ts';
import { CONTAINER_LABEL } from '../../../shared/containers.ts';
import type { ContainerKind } from '../../../shared/containers.ts';
import { PICKUP_TYPES } from '../../../shared/events.ts';
import { MAX_WEIGHT, buildingDrafts, isBuildingDirty, resetBuilding } from '../../game/dev/bench-store.ts';
import {
  BUILDING_STEPS,
  buildingLabel,
  changeSummary,
  friendlyName,
  nextStep,
  oddsWords,
  prevStep,
  stepCounter,
  stepIndex,
  stepInfo,
  weightWord,
  type BuildingStep,
} from '../../game/dev/building-wizard.ts';

const emit = defineEmits<{
  /** Opens the container's size grid in the in-game editor. */
  openContainer: [kind: ContainerKind];
  /** Opens the item's footprint in the in-game editor. */
  openItem: [id: string];
}>();

const step = ref<BuildingStep>('pick');
const selected = ref<BuildingKind>(BUILDING_KINDS[0]);
const addItemChoice = ref('');

const containerKinds = Object.keys(CONTAINER_LABEL) as ContainerKind[];

const index = computed(() => stepIndex(step.value));
const draft = computed(() => buildingDrafts[selected.value]);

/** Each search spot of the building, with the container it opens as. */
const propRows = computed(() =>
  Object.entries(draft.value.rooms).map(([prop, container]) => ({ prop, container: container as ContainerKind })),
);

/** The loot pool's items, sorted by name, with their weights. */
const poolRows = computed(() => Object.entries(draft.value.pool).sort(([a], [b]) => a.localeCompare(b)));

const addableItems = computed(() => PICKUP_TYPES.filter((item) => !(item in draft.value.pool)));

const changes = computed(() => changeSummary(selected.value, draft.value));

const pick = (kind: BuildingKind): void => {
  selected.value = kind;
  step.value = nextStep('pick');
};

const setContainer = (prop: string, container: ContainerKind): void => {
  draft.value.rooms[prop as PropKind] = container;
};

const setOdds = (odds: number): void => {
  if (Number.isFinite(odds)) draft.value.odds = Math.min(1, Math.max(0, odds));
};

const setWeight = (item: string, weight: number): void => {
  if (Number.isFinite(weight)) draft.value.pool[item] = Math.max(0.25, weight);
};

const removeItem = (item: string): void => {
  delete draft.value.pool[item];
};

const addItem = (): void => {
  if (!addItemChoice.value) return;
  draft.value.pool[addItemChoice.value] = 1;
  addItemChoice.value = '';
};
</script>

<style scoped>
.building-wizard {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 4);
  padding: calc(var(--u) * 5);
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

.step-dots {
  display: flex;
  gap: calc(var(--u) * 2);
  list-style: none;
  padding: 0;
  margin: 0;
  flex-wrap: wrap;
}

.step-dot {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 1.5);
  opacity: 0.5;
  font-size: calc(var(--u) * 4.5);
}

.step-dot.is-now,
.step-dot.is-past {
  opacity: 1;
}

.dot-number {
  display: inline-grid;
  place-items: center;
  width: calc(var(--u) * 8);
  height: calc(var(--u) * 8);
  border: calc(var(--u) * 0.5) solid var(--ink-line);
  border-radius: 50%;
  font-weight: 700;
}

.step-dot.is-now .dot-number {
  border-color: var(--amber);
  color: var(--amber);
}

.step-dot.is-past .dot-number {
  background: var(--amber);
  border-color: var(--amber);
  color: var(--ink-raised);
}

.step-counter {
  opacity: 0.7;
  font-size: calc(var(--u) * 4);
}

.step-ask {
  font-size: calc(var(--u) * 7);
  font-weight: 700;
  color: var(--amber);
  margin: calc(var(--u) * 1) 0;
}

.step-hint,
.empty-text {
  opacity: 0.75;
  font-size: calc(var(--u) * 4.5);
}

.pick-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: calc(var(--u) * 3);
}

.pick-card {
  min-height: calc(var(--u) * 18);
  font-size: calc(var(--u) * 5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(var(--u) * 1);
}

.pick-card.is-chosen {
  border-color: var(--amber);
}

.changed-tag {
  font-size: calc(var(--u) * 3.5);
  color: var(--amber);
}

.step-body {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
}

.section-title {
  font-weight: 700;
  font-size: calc(var(--u) * 5);
  margin-top: calc(var(--u) * 2);
}

.big-row {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 3);
  flex-wrap: wrap;
  padding: calc(var(--u) * 2) 0;
  border-bottom: calc(var(--u) * 0.5) solid var(--ink-line);
}

.row-name {
  min-width: 160px;
  font-size: calc(var(--u) * 5);
}

.row-readout {
  min-width: 90px;
  font-weight: 700;
  color: var(--amber);
  font-size: calc(var(--u) * 4.5);
}

.big-select {
  font-size: calc(var(--u) * 5);
  padding: calc(var(--u) * 2) calc(var(--u) * 3);
  background: var(--ink-raised);
  color: inherit;
  border: calc(var(--u) * 0.5) solid var(--ink-line);
  min-height: 44px;
}

.big-slider {
  flex: 1;
  min-width: 140px;
  min-height: 44px;
  accent-color: var(--amber);
}

.small-btn {
  font-size: calc(var(--u) * 4);
}

.change-list {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2);
  font-size: calc(var(--u) * 5);
  padding-left: calc(var(--u) * 6);
}

.step-footer {
  display: flex;
  gap: calc(var(--u) * 3);
  align-items: center;
  padding-top: calc(var(--u) * 3);
  border-top: calc(var(--u) * 0.5) solid var(--ink-line);
}

.spacer {
  flex: 1;
}

.nav-btn {
  font-size: calc(var(--u) * 5.5);
  min-height: 48px;
  padding-inline: calc(var(--u) * 6);
}
</style>
