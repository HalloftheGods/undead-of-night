<template>
  <article class="sizing-card" :class="{ 'is-modified': isModified }">
    <header class="card-header">
      <div class="card-ident">
        <h3 class="card-title">{{ entry.name }}</h3>
        <code class="card-id">{{ entry.id }}</code>
      </div>
      <div class="card-badges">
        <span class="category-badge">{{ entry.category }}</span>
        <span v-if="isModified" class="modified-badge">MODIFIED</span>
      </div>
    </header>

    <div class="preview-wrapper">
      <ItemGridPreview
        :art="art"
        :type="entry.id"
        :name="entry.name"
        :width="width"
        :height="height"
        :rotated="isRotated"
      />
    </div>

    <div class="controls-section">
      <!-- Stepper Controls -->
      <div class="steppers-row">
        <!-- Columns (Width) -->
        <div class="stepper-group">
          <label class="stepper-label">COLS (W)</label>
          <div class="stepper-box">
            <PixelButton
              class="stepper-btn"
              :disabled="width <= minSize"
              @press="decreaseWidth"
            >
              -
            </PixelButton>
            <span class="stepper-val">{{ width }}</span>
            <PixelButton
              class="stepper-btn"
              :disabled="width >= maxSize"
              @press="increaseWidth"
            >
              +
            </PixelButton>
          </div>
        </div>

        <!-- Rows (Height) -->
        <div class="stepper-group">
          <label class="stepper-label">ROWS (H)</label>
          <div class="stepper-box">
            <PixelButton
              class="stepper-btn"
              :disabled="height <= minSize"
              @press="decreaseHeight"
            >
              -
            </PixelButton>
            <span class="stepper-val">{{ height }}</span>
            <PixelButton
              class="stepper-btn"
              :disabled="height >= maxSize"
              @press="increaseHeight"
            >
              +
            </PixelButton>
          </div>
        </div>
      </div>

      <!-- Quick Preset Buttons -->
      <div class="presets-row">
        <span class="presets-label">PRESETS:</span>
        <div class="preset-buttons">
          <PixelButton
            v-for="preset in COMMON_PRESETS"
            :key="`${preset.w}x${preset.h}`"
            class="preset-btn"
            :class="{ 'is-active': isPresetActive(preset.w, preset.h) }"
            @press="applyPreset(preset.w, preset.h)"
          >
            {{ preset.w }}x{{ preset.h }}
          </PixelButton>
        </div>
      </div>

      <!-- Card Actions: Rotate and Reset -->
      <div class="card-actions">
        <PixelButton class="rotate-btn" @press="toggleRotation">
          {{ rotationLabel }}
        </PixelButton>
        <PixelButton
          class="reset-btn"
          :disabled="!isModified"
          @press="resetToDefault"
        >
          Reset Default ({{ entry.defaultFootprint.width }}x{{ entry.defaultFootprint.height }})
        </PixelButton>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ArtBook } from '../../art/types.ts';
import type { DevItemEntry } from '../../game/dev/item-catalogue.ts';
import PixelButton from '../PixelButton.vue';
import ItemGridPreview from './ItemGridPreview.vue';

interface Props {
  art: ArtBook | null;
  entry: DevItemEntry;
  width: number;
  height: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:width': [value: number];
  'update:height': [value: number];
}>();

const minSize = 1;
const maxSize = 6;
const isRotated = ref(false);

const COMMON_PRESETS = [
  { w: 1, h: 1 },
  { w: 1, h: 2 },
  { w: 2, h: 1 },
  { w: 2, h: 2 },
  { w: 1, h: 3 },
  { w: 1, h: 4 },
  { w: 4, h: 1 },
  { w: 4, h: 2 },
] as const;

const isModified = computed(() => {
  const widthMatches = props.width === props.entry.defaultFootprint.width;
  const heightMatches = props.height === props.entry.defaultFootprint.height;
  return !(widthMatches && heightMatches);
});

const rotationLabel = computed(() => (isRotated.value ? 'Preview: VERT' : 'Preview: HORIZ'));

const isPresetActive = (w: number, h: number): boolean => {
  const isWidthMatching = props.width === w;
  const isHeightMatching = props.height === h;
  return isWidthMatching && isHeightMatching;
};

const applyPreset = (w: number, h: number): void => {
  emit('update:width', w);
  emit('update:height', h);
};

const increaseWidth = (): void => {
  if (props.width < maxSize) {
    emit('update:width', props.width + 1);
  }
};

const decreaseWidth = (): void => {
  if (props.width > minSize) {
    emit('update:width', props.width - 1);
  }
};

const increaseHeight = (): void => {
  if (props.height < maxSize) {
    emit('update:height', props.height + 1);
  }
};

const decreaseHeight = (): void => {
  if (props.height > minSize) {
    emit('update:height', props.height - 1);
  }
};

const toggleRotation = (): void => {
  isRotated.value = !isRotated.value;
};

const resetToDefault = (): void => {
  emit('update:width', props.entry.defaultFootprint.width);
  emit('update:height', props.entry.defaultFootprint.height);
};
</script>

<style scoped>
.sizing-card {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
  padding: calc(var(--u) * 4);
  background: var(--ink-raised);
  border: calc(var(--u) * 1) solid var(--ink-line);
  box-sizing: border-box;
  transition: border-color 0.15s ease;
}

.sizing-card.is-modified {
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

.card-badges {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: calc(var(--u) * 1);
}

.category-badge {
  font-size: calc(var(--u) * 4);
  text-transform: uppercase;
  background: var(--ink);
  color: var(--bone-dim);
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
  min-height: 120px;
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
  gap: calc(var(--u) * 2);
  margin-top: calc(var(--u) * 1);
}

.rotate-btn {
  flex: 1;
  font-size: calc(var(--u) * 4.5);
}

.reset-btn {
  font-size: calc(var(--u) * 4);
  color: var(--blood-bright);
}
</style>
