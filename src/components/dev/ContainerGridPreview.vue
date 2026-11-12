<template>
  <div class="container-preview-wrapper" :style="{ '--ap': `${pixelScale}px` }">
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
          '--cols': cols,
          '--rows': rows,
        }"
      >
        <div
          v-for="cell in cells"
          :key="`cell-${cell.x}-${cell.y}`"
          class="grid-cell"
          :style="{
            '--col': cell.x + 1,
            '--row': cell.y + 1,
          }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ContainerLook } from '../../art/containers.ts';
import type { ArtBook } from '../../art/types.ts';
import { spriteDataUrl } from '../../engine/sprite-cache.ts';
import type { ContainerKind } from '../../../shared/containers.ts';

interface Props {
  art: ArtBook | null;
  look: ContainerLook;
  kind: ContainerKind;
  cols: number;
  rows: number;
  opened?: boolean;
  pixelScale?: number;
}

const props = withDefaults(defineProps<Props>(), {
  art: null,
  opened: false,
  pixelScale: 2,
});

const containerArtUrl = computed(() => {
  if (!props.art) return '';
  const containerArt = props.art.containers[props.look] ?? props.art.containers[props.kind];
  if (!containerArt) return '';
  const sprite = props.opened
    ? (containerArt.opened ?? containerArt.closed)
    : (containerArt.closed ?? containerArt.opened);
  return sprite ? spriteDataUrl(sprite) : '';
});

const cells = computed(() => {
  const result: Array<{ x: number; y: number }> = [];
  const totalCols = props.cols;
  const totalRows = props.rows;
  for (let y = 0; y < totalRows; y += 1) {
    for (let x = 0; x < totalCols; x += 1) {
      result.push({ x, y });
    }
  }
  return result;
});
</script>

<style scoped>
.container-preview-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(var(--ap) * 2);
  background: rgba(11, 12, 16, 0.85);
  box-shadow: inset 0 0 0 var(--ap) var(--ink-line);
}

.container-grid-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(var(--ap) * 1.5);
  background: rgba(11, 12, 16, 0.7);
  box-shadow: inset 0 0 0 var(--ap) var(--ink-line);
  box-sizing: border-box;
  overflow: hidden;
  width: fit-content;
  height: fit-content;
}

.container-stage-bg-art {
  position: absolute;
  inset: calc(var(--ap) * 1.5);
  width: calc(100% - calc(var(--ap) * 3));
  height: calc(100% - calc(var(--ap) * 3));
  object-fit: fill;
  image-rendering: pixelated;
  pointer-events: none;
  z-index: 0;
  opacity: 0.85;
  filter: drop-shadow(0 calc(var(--ap) * 2) 0 rgba(0, 0, 0, 0.7));
}

.container-grid {
  position: relative;
  z-index: 1;
  background: transparent !important;
  --tile-size: calc(var(--ap) * 17);
  display: grid;
  grid-template-columns: repeat(var(--cols), var(--tile-size));
  grid-template-rows: repeat(var(--rows), var(--tile-size));
  box-shadow: 0 0 0 var(--ap) var(--ink-line);
  user-select: none;
}

.container-grid .grid-cell {
  grid-column: var(--col);
  grid-row: var(--row);
  width: var(--tile-size);
  height: var(--tile-size);
  background: rgba(11, 12, 16, 0.35);
  box-shadow:
    inset var(--ap) var(--ap) 0 0 rgba(0, 0, 0, 0.45),
    inset calc(var(--ap) * -1) calc(var(--ap) * -1) 0 0 rgba(228, 220, 195, 0.12),
    0 0 0 var(--ap) rgba(27, 31, 39, 0.75);
  box-sizing: border-box;
  transition: background-color 0.15s ease;
}

.container-grid .grid-cell:hover {
  background: rgba(228, 220, 195, 0.2);
}
</style>
