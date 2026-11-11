<template>
  <span class="loot-art" :title="name">
    <img v-if="url" class="loot-art-img" :class="{ 'is-turned': turned }" :src="url" :style="{ '--art-scale': scale }" alt="" draggable="false" />
    <span v-else class="loot-art-name">{{ name }}</span>
    <span v-if="badge" class="loot-art-badge">{{ badge }}</span>
  </span>
</template>

<script setup lang="ts">
/** One inventory item drawn with the game's own sprite, at a whole number of screen pixels per art pixel. */
import { computed } from 'vue';
import type { ArtBook } from '../art/types.ts';
import { spriteDataUrl } from '../engine/sprite-cache.ts';
import { longSprite, lootBadge, lootSprite } from '../game/loot-item-art.ts';

const { art = null, type, name, scale = 1, count, ammo, lying } = defineProps<{
  art?: ArtBook | null;
  type: string;
  name: string;
  /** Art pixels are drawn this many slot pixels wide: 2 for an item at least two cells each way. */
  scale?: number;
  count?: number;
  ammo?: number;
  /** Given for an item lying in a bag slot: a long item is then drawn end to end, on its side when turned. */
  lying?: 'upright' | 'turned';
}>();

const inSlot = computed(() => lying !== undefined);
const url = computed(() => {
  const sprite = art ? lootSprite(art, type, inSlot.value) : null;
  return sprite ? spriteDataUrl(sprite) : '';
});
const turned = computed(() => lying === 'turned' && art !== null && longSprite(art, type) !== null);
const badge = computed(() => lootBadge(count, ammo));
</script>

<style scoped>
.loot-art {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.loot-art-img {
  /* The pickup icons are 15 art pixels square. */
  width: calc(var(--ap) * 15 * var(--art-scale, 1));
  height: auto;
  image-rendering: pixelated;
}

.loot-art-img.is-turned {
  transform: rotate(90deg);
}

.loot-art-name {
  font-size: max(calc(var(--u) * 5), calc(var(--m) * 2.5));
  color: var(--bone);
  text-align: center;
  line-height: 1.1;
  word-break: break-word;
}

.loot-art-badge {
  position: absolute;
  right: var(--ap);
  bottom: 0;
  font-size: max(calc(var(--u) * 5.5), calc(var(--m) * 2.8));
  font-weight: 700;
  color: var(--bone);
  text-shadow: var(--ap) 0 0 var(--ink), calc(var(--ap) * -1) 0 0 var(--ink), 0 var(--ap) 0 var(--ink), 0 calc(var(--ap) * -1) 0 var(--ink);
}
</style>
