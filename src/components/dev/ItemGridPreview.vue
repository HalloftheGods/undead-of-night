<template>
  <div class="item-grid-preview" :style="{ '--ap': `${pixelScale}px` }">
    <div
      class="preview-board"
      :style="{
        '--cols': boardCols,
        '--rows': boardRows,
      }"
    >
      <div
        v-for="cell in cells"
        :key="`${cell.x}-${cell.y}`"
        class="preview-cell"
        :style="{
          '--col': cell.x + 1,
          '--row': cell.y + 1,
        }"
      />

      <div
        class="preview-item"
        :style="{
          '--col': 1,
          '--row': 1,
          '--col-span': effectiveCols,
          '--row-span': effectiveRows,
        }"
      >
        <LootItemArt
          :art
          :type
          :name
          :scale="artScale"
          :lying="lying"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ArtBook } from '../../art/types.ts';
import LootItemArt from '../LootItemArt.vue';

interface Props {
  art: ArtBook | null;
  type: string;
  name: string;
  width: number;
  height: number;
  rotated?: boolean;
  pixelScale?: number;
  padBoard?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  art: null,
  rotated: false,
  pixelScale: 2,
  padBoard: true,
});

const effectiveCols = computed(() => (props.rotated ? props.height : props.width));
const effectiveRows = computed(() => (props.rotated ? props.width : props.height));

const boardCols = computed(() => {
  if (!props.padBoard) return effectiveCols.value;
  return Math.max(4, effectiveCols.value + 1);
});

const boardRows = computed(() => {
  if (!props.padBoard) return effectiveRows.value;
  return Math.max(4, effectiveRows.value + 1);
});

const cells = computed(() => {
  const result: Array<{ x: number; y: number }> = [];
  const totalCols = boardCols.value;
  const totalRows = boardRows.value;
  for (let y = 0; y < totalRows; y += 1) {
    for (let x = 0; x < totalCols; x += 1) {
      result.push({ x, y });
    }
  }
  return result;
});

const artScale = computed(() => Math.min(2, props.width, props.height));
const lying = computed<'upright' | 'turned'>(() => (props.rotated ? 'turned' : 'upright'));
</script>

<style scoped>
.item-grid-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(var(--ap) * 2);
  background: rgba(11, 12, 16, 0.9);
  box-shadow: inset 0 0 0 var(--ap) var(--ink-line);
}

.preview-board {
  --tile-size: calc(var(--ap) * 17);
  display: grid;
  grid-template-columns: repeat(var(--cols), var(--tile-size));
  grid-template-rows: repeat(var(--rows), var(--tile-size));
  background: var(--ink);
  box-shadow: 0 0 0 var(--ap) var(--ink-line);
  position: relative;
  user-select: none;
}

.preview-cell {
  grid-column: var(--col);
  grid-row: var(--row);
  width: var(--tile-size);
  height: var(--tile-size);
  background: var(--ink-raised);
  box-shadow:
    inset var(--ap) var(--ap) 0 0 var(--ink),
    inset calc(var(--ap) * -1) calc(var(--ap) * -1) 0 0 var(--ink-line);
  box-sizing: border-box;
}

.preview-item {
  grid-column: var(--col) / span var(--col-span, 1);
  grid-row: var(--row) / span var(--row-span, 1);
  margin: var(--ap);
  background: rgba(228, 220, 195, 0.08);
  box-shadow: 0 0 0 var(--ap) var(--bone-dim);
  box-sizing: border-box;
  overflow: hidden;
  z-index: 2;
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
}

.preview-item:hover {
  background: rgba(228, 220, 195, 0.16);
  box-shadow: 0 0 0 var(--ap) var(--bone);
}
</style>
