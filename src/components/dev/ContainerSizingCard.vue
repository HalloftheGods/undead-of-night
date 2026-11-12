<template>
  <article class="container-card" :class="{ 'is-modified': isModified }">
    <header class="card-header">
      <div class="card-ident">
        <h3 class="card-title">{{ entry.name }}</h3>
        <code class="card-id">{{ entry.kind }} ({{ entry.look }})</code>
      </div>
      <div class="card-badges">
        <span class="search-badge">{{ entry.searchSec }}s Search</span>
        <span v-if="isModified" class="modified-badge">MODIFIED</span>
      </div>
    </header>

    <p class="card-desc">{{ entry.description }}</p>

    <div class="preview-wrapper">
      <ContainerGridPreview
        :art="art"
        :look="entry.look"
        :kind="entry.kind"
        :cols="cols"
        :rows="rows"
        :blocked="blocked"
        :opened="isOpened"
        @toggle-cell="toggleBlockedCell"
      />
    </div>

    <div class="controls-section">
      <!-- Blocked tiles notification & clear button -->
      <div v-if="blocked.length > 0" class="blocked-controls-row">
        <span class="blocked-info-text">{{ blocked.length }} BLOCKED TILES (CLICK GRID TO TOGGLE)</span>
        <PixelButton class="clear-blocked-btn" @press="clearBlockedCells">
          Clear Blocked
        </PixelButton>
      </div>
      <!-- Steppers -->
      <div class="steppers-row">
        <!-- Columns -->
        <div class="stepper-group">
          <label class="stepper-label">COLS (WIDTH)</label>
          <div class="stepper-box">
            <PixelButton
              class="stepper-btn"
              :disabled="cols <= minSize"
              @press="decreaseCols"
            >
              -
            </PixelButton>
            <span class="stepper-val">{{ cols }}</span>
            <PixelButton
              class="stepper-btn"
              :disabled="cols >= maxSize"
              @press="increaseCols"
            >
              +
            </PixelButton>
          </div>
        </div>

        <!-- Rows -->
        <div class="stepper-group">
          <label class="stepper-label">ROWS (HEIGHT)</label>
          <div class="stepper-box">
            <PixelButton
              class="stepper-btn"
              :disabled="rows <= minSize"
              @press="decreaseRows"
            >
              -
            </PixelButton>
            <span class="stepper-val">{{ rows }}</span>
            <PixelButton
              class="stepper-btn"
              :disabled="rows >= maxSize"
              @press="increaseRows"
            >
              +
            </PixelButton>
          </div>
        </div>
      </div>

      <!-- Quick Presets -->
      <div class="presets-row">
        <span class="presets-label">CONTAINER PRESETS:</span>
        <div class="preset-buttons">
          <PixelButton
            v-for="preset in CONTAINER_PRESETS"
            :key="`${preset.c}x${preset.r}`"
            class="preset-btn"
            :class="{ 'is-active': isPresetActive(preset.c, preset.r) }"
            @press="applyPreset(preset.c, preset.r)"
          >
            {{ preset.c }}x{{ preset.r }}
          </PixelButton>
        </div>
      </div>

      <!-- Card Actions: Toggle Sprite, In-Game Preview, and Reset -->
      <div class="card-actions">
        <PixelButton class="sprite-toggle-btn" @press="toggleSprite">
          {{ isOpened ? 'Sprite: Searched' : 'Sprite: Closed' }}
        </PixelButton>
        <PixelButton class="preview-btn" :primary="true" @press="triggerPreview">
          In-Game Preview
        </PixelButton>
        <PixelButton
          class="reset-btn"
          :disabled="!isModified"
          @press="resetToDefault"
        >
          Reset Default ({{ entry.defaultDimensions.cols }}x{{ entry.defaultDimensions.rows }})
        </PixelButton>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ArtBook } from '../../art/types.ts';
import type { DevContainerEntry } from '../../game/dev/container-catalogue.ts';
import type { GridPoint } from '../../../shared/grid-inventory.ts';
import PixelButton from '../PixelButton.vue';
import ContainerGridPreview from './ContainerGridPreview.vue';

interface Props {
  art: ArtBook | null;
  entry: DevContainerEntry;
  cols: number;
  rows: number;
  blocked?: readonly GridPoint[];
}

const props = withDefaults(defineProps<Props>(), {
  blocked: () => [],
});

const emit = defineEmits<{
  'update:cols': [value: number];
  'update:rows': [value: number];
  'update:blocked': [points: GridPoint[]];
  preview: [];
}>();

const minSize = 1;
const maxSize = 12;
const isOpened = ref(false);

const CONTAINER_PRESETS = [
  { c: 2, r: 2 },
  { c: 3, r: 3 },
  { c: 4, r: 2 },
  { c: 4, r: 3 },
  { c: 5, r: 3 },
  { c: 5, r: 4 },
  { c: 3, r: 8 },
  { c: 4, r: 6 },
  { c: 6, r: 4 },
  { c: 6, r: 5 },
] as const;

const areBlockedPointsEqual = (a?: readonly GridPoint[], b?: readonly GridPoint[]): boolean => {
  const aList = a ?? [];
  const bList = b ?? [];
  const hasLengthMismatch = aList.length !== bList.length;
  if (hasLengthMismatch) {
    return false;
  }
  const toPointKey = (pt: GridPoint): string => `${pt.x}:${pt.y}`;
  const aKeys = [...aList].map(toPointKey).sort();
  const bKeys = [...bList].map(toPointKey).sort();
  return aKeys.every((key, index) => key === bKeys[index]);
};

const isModified = computed(() => {
  const colsMatch = props.cols === props.entry.defaultDimensions.cols;
  const rowsMatch = props.rows === props.entry.defaultDimensions.rows;
  const blockedMatch = areBlockedPointsEqual(props.blocked, props.entry.defaultDimensions.blocked);
  const isAllMatching = colsMatch && rowsMatch && blockedMatch;
  return !isAllMatching;
});

const isPresetActive = (c: number, r: number): boolean => {
  const isColsMatching = props.cols === c;
  const isRowsMatching = props.rows === r;
  return isColsMatching && isRowsMatching;
};

const applyPreset = (c: number, r: number): void => {
  emit('update:cols', c);
  emit('update:rows', r);
};

const increaseCols = (): void => {
  const canIncrease = props.cols < maxSize;
  if (canIncrease) {
    emit('update:cols', props.cols + 1);
  }
};

const decreaseCols = (): void => {
  const canDecrease = props.cols > minSize;
  if (canDecrease) {
    emit('update:cols', props.cols - 1);
  }
};

const increaseRows = (): void => {
  const canIncrease = props.rows < maxSize;
  if (canIncrease) {
    emit('update:rows', props.rows + 1);
  }
};

const decreaseRows = (): void => {
  const canDecrease = props.rows > minSize;
  if (canDecrease) {
    emit('update:rows', props.rows - 1);
  }
};

const toggleBlockedCell = (point: GridPoint): void => {
  const currentBlocked = props.blocked ?? [];
  const isExisting = currentBlocked.some((pt) => pt.x === point.x && pt.y === point.y);
  const updatedPoints = isExisting
    ? currentBlocked.filter((pt) => !(pt.x === point.x && pt.y === point.y))
    : [...currentBlocked, point];
  emit('update:blocked', updatedPoints);
};

const clearBlockedCells = (): void => {
  emit('update:blocked', []);
};

const toggleSprite = (): void => {
  isOpened.value = !isOpened.value;
};

const triggerPreview = (): void => {
  emit('preview');
};

const resetToDefault = (): void => {
  emit('update:cols', props.entry.defaultDimensions.cols);
  emit('update:rows', props.entry.defaultDimensions.rows);
  const defaultBlocked = props.entry.defaultDimensions.blocked
    ? [...props.entry.defaultDimensions.blocked]
    : [];
  emit('update:blocked', defaultBlocked);
};
</script>

<style scoped>
.container-card {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
  padding: calc(var(--u) * 4);
  background: var(--ink-raised);
  border: calc(var(--u) * 1) solid var(--ink-line);
  box-sizing: border-box;
  transition: border-color 0.15s ease;
}

.container-card.is-modified {
  border-color: var(--amber);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: calc(var(--u) * 2);
  border-bottom: calc(var(--u) * 1) solid var(--ink-line);
  padding-bottom: calc(var(--u) * 2);
}

.card-ident {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 1);
}

.card-title {
  margin: 0;
  font-size: calc(var(--u) * 6);
  color: var(--bone);
  letter-spacing: -0.2px;
}

.card-id {
  font-size: calc(var(--u) * 4.5);
  color: var(--bone-dim);
  font-family: monospace;
}

.card-desc {
  margin: 0;
  font-size: calc(var(--u) * 4);
  color: var(--bone-dim);
  line-height: 1.3;
}

.card-badges {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: calc(var(--u) * 1);
}

.search-badge {
  font-size: calc(var(--u) * 4);
  background: var(--ink);
  color: var(--sick);
  padding: calc(var(--u) * 0.5) calc(var(--u) * 2);
  border: calc(var(--u) * 0.5) solid var(--ink-line);
}

.modified-badge {
  font-size: calc(var(--u) * 4);
  font-weight: 700;
  background: var(--amber);
  color: var(--ink);
  padding: calc(var(--u) * 0.5) calc(var(--u) * 2);
}

.preview-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 180px;
  background: var(--ink);
}

.controls-section {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2.5);
}

.steppers-row {
  display: flex;
  justify-content: space-between;
  gap: calc(var(--u) * 2);
}

.stepper-group {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 1);
  flex: 1;
}

.stepper-label {
  font-size: calc(var(--u) * 4);
  color: var(--bone-dim);
  font-weight: 700;
}

.stepper-box {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 1);
}

.stepper-btn {
  padding: calc(var(--u) * 1) calc(var(--u) * 3);
  font-size: calc(var(--u) * 6);
  font-weight: 700;
}

.stepper-val {
  font-size: calc(var(--u) * 7);
  font-weight: 700;
  color: var(--bone);
  min-width: calc(var(--u) * 6);
  text-align: center;
}

.presets-row {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 1);
}

.presets-label {
  font-size: calc(var(--u) * 3.5);
  color: var(--bone-dim);
}

.preset-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--u) * 1);
}

.preset-btn {
  font-size: calc(var(--u) * 4);
  padding: calc(var(--u) * 0.5) calc(var(--u) * 1.5);
}

.preset-btn.is-active {
  background: var(--sick);
  color: var(--ink);
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--u) * 2);
  margin-top: calc(var(--u) * 1);
}

.sprite-toggle-btn {
  flex: 1;
  font-size: calc(var(--u) * 4.5);
}

.preview-btn {
  font-size: calc(var(--u) * 4.5);
}

.reset-btn {
  font-size: calc(var(--u) * 4);
  color: var(--blood-bright);
}

.blocked-controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--u) * 2);
  padding: calc(var(--u) * 1.5) calc(var(--u) * 2);
  background: rgba(220, 38, 38, 0.15);
  border: calc(var(--u) * 1) solid rgba(220, 38, 38, 0.35);
}

.blocked-info-text {
  font-family: var(--font-pixel-heading);
  font-size: calc(var(--u) * 3);
  color: #fca5a5;
  letter-spacing: 0.05em;
}

.clear-blocked-btn {
  font-size: calc(var(--u) * 3);
  padding: calc(var(--u) * 1) calc(var(--u) * 2);
}
</style>
