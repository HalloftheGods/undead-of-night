<template>
  <section class="held-panel" :class="{ 'is-holding': item !== null }" aria-live="polite">
    <template v-if="item">
      <span class="held-body">
        <span class="held-text">
          <span class="held-label">{{ name }}</span>
          <span class="held-hint">{{ width }}x{{ height }} / [R] rotate / click a cell to place / [ESC] returns it</span>
        </span>
      </span>
      <div class="held-actions">
        <button v-if="canUse" type="button" class="action-btn use-btn" @click.stop="useHeld">{{ actionVerb }}</button>
        <button v-if="canDrop" type="button" class="action-btn drop-btn" @click.stop="dropHeld">DROP</button>
      </div>
    </template>
    <span v-else class="held-empty">HANDS EMPTY. Click an item to pick it up.</span>
  </section>
</template>

<script setup lang="ts">
/**
 * What the survivor is carrying between slots: its name, hint and the buttons. The item's picture follows
 * the pointer on the game canvas (held-cursor.ts), so it is not drawn here.
 */
import { computed } from 'vue';
import { isDroppableBagItem } from '../../shared/bag.ts';
import { isCandyId } from '../../shared/candy.ts';
import { getItemFootprint, type GridItem } from '../../shared/grid-inventory.ts';
import { isSupplyType } from '../../shared/supply-types.ts';
import { formatItemName } from '../game/dual-loot-modal.ts';
import { useGame } from './use-game.ts';
import { useSoundOf } from '../game/inventory/use-sound.ts';

const { item = null } = defineProps<{
  item?: GridItem | null;
}>();

const emit = defineEmits<{
  (e: 'use'): void;
  (e: 'drop'): void;
}>();
const game = useGame();

const name = computed(() => (item ? formatItemName(item.type) : ''));
const footprint = computed(() => (item ? getItemFootprint(item.type, item.rotated) : { width: 1, height: 1 }));
const width = computed(() => footprint.value.width);
const height = computed(() => footprint.value.height);

const actionVerb = computed(() => {
  const type = item?.type;
  if (!type) return 'USE';
  const isFoodOrSweet = isCandyId(type) || type === 'canned_food';
  if (isFoodOrSweet) return 'EAT';
  const isDrink = type === 'water_bottle' || type === 'bottle';
  if (isDrink) return 'DRINK';
  const isTopical = type === 'bandage' || type === 'disinfectant';
  if (isTopical) return 'APPLY';
  const isPill = type === 'antibiotics';
  if (isPill) return 'TAKE';
  const isMedkit = type === 'medkit';
  if (isMedkit) return 'HEAL';
  return 'USE';
});

const canUse = computed(() => {
  if (!item) return false;
  const isSupply = isSupplyType(item.type);
  const isCandy = isCandyId(item.type);
  const isMedkit = item.type === 'medkit';
  return isSupply || isCandy || isMedkit;
});

const canDrop = computed(() => {
  if (!item) return false;
  const isDroppable = isDroppableBagItem(item.type);
  const isCandy = isCandyId(item.type);
  return isDroppable || isCandy;
});

/** The item's own sound for USE, then the use happens at once. */
function useHeld(): void {
  if (item) game.playSfx(useSoundOf(item.type));
  emit('use');
}

/** A drop has the same sound whatever the item is; the drop itself happens at once. */
function dropHeld(): void {
  game.playSfx('ui_drop');
  emit('drop');
}
</script>

<style scoped>
/* Pixel-art look: --ap is one art pixel, set by the modal's backdrop. */
.held-panel {
  width: 0; /* never wider than the column, so what is held cannot push it open */
  min-width: 100%;
  display: flex;
  align-items: center;
  gap: max(calc(var(--u) * 3), calc(var(--ap) * 3));
  min-height: max(calc(var(--u) * 26), calc(var(--ap) * 30));
  height: auto;
  flex: 0 0 auto;
  background: rgba(11, 12, 16, 0.9);
  box-shadow: 0 0 0 var(--ap) var(--ink-line);
  padding: max(calc(var(--u) * 1.5), var(--ap)) max(calc(var(--u) * 2.5), calc(var(--ap) * 2));
  font-family: 'Silkscreen', monospace;
  font-size: max(calc(var(--u) * 5.5), calc(var(--m) * 2.8));
  color: var(--bone-dim);
  box-sizing: border-box;
  overflow: hidden;
}
/* Holding: the item is the hero. No box around it, just the thing, its name and two big buttons. */
.held-panel.is-holding { background: transparent; box-shadow: none; color: var(--bone); }
/* The item stands above its name and hint. LootItemArt sizes its picture by the scale prop, so this stays pixel-sharp at 3x. */
/* The picture and its words stack in a column that keeps a readable width; the buttons drop below when the panel is narrow. */
.held-panel { flex-wrap: wrap; row-gap: calc(var(--ap) * 6); }
.held-body { display: flex; flex-direction: column; align-items: flex-start; gap: calc(var(--ap) * 4); flex: 1 1 calc(var(--ap) * 150); min-width: 0; }
.held-text { display: flex; flex-direction: column; gap: calc(var(--ap) * 2); width: 100%; min-width: 0; }
.held-label { font-size: max(calc(var(--u) * 10), calc(var(--m) * 5)); color: var(--amber); text-transform: uppercase; letter-spacing: var(--ap); line-height: 1.1; overflow-wrap: break-word; }
.held-hint { font-size: max(calc(var(--u) * 4), calc(var(--m) * 2)); color: var(--bone-dim); }
.held-empty { font-size: max(calc(var(--u) * 5.5), calc(var(--m) * 2.8)); }
.held-actions { display: flex; align-items: stretch; gap: calc(var(--ap) * 3); margin-left: auto; }
.action-btn {
  --edge: var(--bone-dim);
  background: var(--ink-raised);
  border: 0;
  color: var(--bone);
  box-shadow: 0 0 0 var(--ap) var(--edge), 0 calc(var(--ap) * 2) 0 var(--ap) var(--ink-line);
  padding: max(calc(var(--u) * 4), calc(var(--ap) * 4)) max(calc(var(--u) * 7), calc(var(--ap) * 7));
  min-width: calc(var(--ap) * 36);
  cursor: pointer;
  font-family: inherit;
  font-size: max(calc(var(--u) * 8), calc(var(--m) * 4));
  font-weight: 700;
  white-space: nowrap;
}
.action-btn:hover, .action-btn:focus-visible { --edge: var(--amber); color: var(--amber); outline: none; }
.action-btn:active { transform: translateY(var(--ap)); box-shadow: 0 0 0 var(--ap) var(--edge), 0 var(--ap) 0 var(--ap) var(--ink-line); }
.use-btn { --edge: var(--amber); color: var(--amber); }
.drop-btn { --edge: var(--blood); color: var(--blood-bright); }
</style>
