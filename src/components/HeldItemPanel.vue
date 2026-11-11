<template>
  <section class="held-panel" :class="{ 'is-holding': item !== null }" aria-live="polite">
    <template v-if="item">
      <span class="held-icon"><LootItemArt :art :type="item.type" :name /></span>
      <span class="held-text">
        <span class="held-label">HOLDING: <strong>{{ name }}</strong> ({{ width }}x{{ height }})</span>
        <span class="held-hint">[R] rotate. Click a cell to drop. [ESC] returns it.</span>
      </span>
    </template>
    <span v-else class="held-empty">HANDS EMPTY. Click an item to pick it up.</span>
  </section>
</template>

<script setup lang="ts">
/**
 * What the survivor is carrying between slots. It always takes its space, empty or not, so picking an
 * item up or putting it down never moves anything else in the modal.
 */
import { computed } from 'vue';
import type { ArtBook } from '../art/types.ts';
import { getItemFootprint, type GridItem } from '../../shared/grid-inventory.ts';
import { formatItemName } from '../game/dual-loot-modal.ts';
import LootItemArt from './LootItemArt.vue';

const { art = null, item = null } = defineProps<{
  art?: ArtBook | null;
  item?: GridItem | null;
}>();

const name = computed(() => (item ? formatItemName(item.type) : ''));
const footprint = computed(() => (item ? getItemFootprint(item.type, item.rotated) : { width: 1, height: 1 }));
const width = computed(() => footprint.value.width);
const height = computed(() => footprint.value.height);
</script>

<style scoped>
/* Pixel-art look: --ap is one art pixel, set by the modal's backdrop. */
.held-panel {
  width: 0; /* never wider than the column, so what is held cannot push it open */
  min-width: 100%;
  display: flex;
  align-items: center;
  gap: calc(var(--ap) * 2);
  height: calc(var(--ap) * 20);
  flex: 0 0 auto;
  background: rgba(11, 12, 16, 0.9);
  box-shadow: 0 0 0 var(--ap) var(--ink-line);
  padding: var(--ap) calc(var(--ap) * 2);
  font-size: calc(var(--m) * 2.4);
  color: var(--bone-dim);
  box-sizing: border-box;
  overflow: hidden;
}
.held-panel.is-holding { box-shadow: 0 0 0 var(--ap) var(--amber); background: var(--ink-raised); color: var(--bone); }
.held-icon { width: calc(var(--ap) * 14); height: calc(var(--ap) * 14); flex: 0 0 auto; }
.held-text { display: flex; flex-direction: column; gap: var(--ap); min-width: 0; }
.held-hint { font-size: calc(var(--m) * 2); color: var(--bone-dim); }
.held-empty { font-size: calc(var(--m) * 2); }
</style>
