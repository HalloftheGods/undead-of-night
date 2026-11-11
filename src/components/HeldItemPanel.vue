<template>
  <section class="held-panel" :class="{ 'is-holding': item !== null }" aria-live="polite">
    <template v-if="item">
      <span class="held-icon"><LootItemArt :art :type="item.type" :name /></span>
      <span class="held-text">
        <span class="held-label">HOLDING: <strong>{{ name }}</strong> ({{ width }}x{{ height }})</span>
        <span class="held-hint">[R] rotate. Click a cell to drop. [ESC] returns it.</span>
      </span>
      <div class="held-actions">
        <button v-if="canUse" type="button" class="action-btn use-btn" @click.stop="$emit('use')">USE</button>
        <button v-if="canDrop" type="button" class="action-btn drop-btn" @click.stop="$emit('drop')">DROP</button>
      </div>
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
import { isDroppableBagItem } from '../../shared/bag.ts';
import { getItemFootprint, type GridItem } from '../../shared/grid-inventory.ts';
import { isSupplyType } from '../../shared/supply-types.ts';
import { formatItemName } from '../game/dual-loot-modal.ts';
import LootItemArt from './LootItemArt.vue';

const { art = null, item = null } = defineProps<{
  art?: ArtBook | null;
  item?: GridItem | null;
}>();

defineEmits<{
  (e: 'use'): void;
  (e: 'drop'): void;
}>();

const name = computed(() => (item ? formatItemName(item.type) : ''));
const footprint = computed(() => (item ? getItemFootprint(item.type, item.rotated) : { width: 1, height: 1 }));
const width = computed(() => footprint.value.width);
const height = computed(() => footprint.value.height);
const canUse = computed(() => Boolean(item && isSupplyType(item.type)));
const canDrop = computed(() => Boolean(item && isDroppableBagItem(item.type)));
</script>

<style scoped>
/* Pixel-art look: --ap is one art pixel, set by the modal's backdrop. */
.held-panel {
  width: 0; /* never wider than the column, so what is held cannot push it open */
  min-width: 100%;
  display: flex;
  align-items: center;
  gap: max(calc(var(--u) * 2), calc(var(--ap) * 2));
  min-height: max(calc(var(--u) * 16), calc(var(--ap) * 20));
  height: auto;
  flex: 0 0 auto;
  background: rgba(11, 12, 16, 0.9);
  box-shadow: 0 0 0 var(--ap) var(--ink-line);
  padding: max(calc(var(--u) * 1.5), var(--ap)) max(calc(var(--u) * 2.5), calc(var(--ap) * 2));
  font-size: max(calc(var(--u) * 5.5), calc(var(--m) * 2.8));
  color: var(--bone-dim);
  box-sizing: border-box;
  overflow: hidden;
}
.held-panel.is-holding { box-shadow: 0 0 0 var(--ap) var(--amber); background: var(--ink-raised); color: var(--bone); }
.held-icon { width: calc(var(--ap) * 14); height: calc(var(--ap) * 14); flex: 0 0 auto; }
.held-text { display: flex; flex-direction: column; gap: var(--ap); min-width: 0; flex: 1; }
.held-hint { font-size: max(calc(var(--u) * 5), calc(var(--m) * 2.5)); color: var(--bone-dim); }
.held-empty { font-size: max(calc(var(--u) * 5.5), calc(var(--m) * 2.8)); }
.held-actions { display: flex; align-items: center; gap: calc(var(--ap) * 2); margin-left: auto; }
.action-btn {
  --edge: var(--bone-dim);
  background: var(--ink-raised);
  border: 0;
  color: var(--bone);
  box-shadow: 0 0 0 var(--ap) var(--edge), 0 calc(var(--ap) * 2) 0 var(--ap) var(--ink-line);
  padding: max(calc(var(--u) * 1.5), var(--ap)) max(calc(var(--u) * 2.5), calc(var(--ap) * 2));
  cursor: pointer;
  font-family: inherit;
  font-size: max(calc(var(--u) * 5), calc(var(--m) * 2.5));
  font-weight: 700;
  white-space: nowrap;
}
.action-btn:hover, .action-btn:focus-visible { --edge: var(--amber); color: var(--amber); outline: none; }
.action-btn:active { transform: translateY(var(--ap)); box-shadow: 0 0 0 var(--ap) var(--edge), 0 var(--ap) 0 var(--ap) var(--ink-line); }
.use-btn { --edge: var(--amber); color: var(--amber); }
.drop-btn { --edge: var(--blood); color: var(--blood-bright); }
</style>
