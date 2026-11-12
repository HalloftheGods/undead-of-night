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
          :class="{
            'is-blocked': isCellBlocked(cell.x, cell.y),
            'is-interactive': interactive,
          }"
          :style="{
            '--col': cell.x + 1,
            '--row': cell.y + 1,
          }"
          :title="`(${cell.x}, ${cell.y}) - ${isCellBlocked(cell.x, cell.y) ? 'Blocked tile (click to unblock)' : 'Open tile (click to block)'}`"
          @click="handleCellClick(cell.x, cell.y)"
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
import type { GridPoint } from '../../../shared/grid-inventory.ts';

interface Props {
  art: ArtBook | null;
  look: ContainerLook;
  kind: ContainerKind;
  cols: number;
  rows: number;
  blocked?: readonly GridPoint[];
  opened?: boolean;
  pixelScale?: number;
  interactive?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  art: null,
  blocked: () => [],
  opened: false,
  pixelScale: 2,
  interactive: true,
});

const emit = defineEmits<{
  'toggle-cell': [point: GridPoint];
}>();

const isCellBlocked = (x: number, y: number): boolean => {
  const isMatching = (pt: GridPoint): boolean => pt.x === x && pt.y === y;
  return props.blocked.some(isMatching);
};

const handleCellClick = (x: number, y: number): void => {
  const isNotInteractive = !props.interactive;
  if (isNotInteractive) {
    return;
  }
  emit('toggle-cell', { x, y });
};

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

.container-grid .grid-cell.is-interactive {
  cursor: pointer;
}

.container-grid .grid-cell.is-blocked {
  background: rgba(220, 38, 38, 0.45);
  background-image: repeating-linear-gradient(
    -45deg,
    rgba(255, 68, 68, 0.35),
    rgba(255, 68, 68, 0.35) 4px,
    transparent 4px,
    transparent 8px
  );
  box-shadow:
    inset var(--ap) var(--ap) 0 0 rgba(120, 0, 0, 0.8),
    inset calc(var(--ap) * -1) calc(var(--ap) * -1) 0 0 rgba(255, 120, 120, 0.4),
    0 0 0 var(--ap) rgba(220, 38, 38, 0.7);
}

.container-grid .grid-cell.is-blocked:hover {
  background-color: rgba(239, 68, 68, 0.65);
}
</style>
