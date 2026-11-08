<template>
  <span v-if="icon === 'candy'" class="tg-candy" aria-hidden="true" />
  <img v-else class="tg-icon" :src="url" alt="" draggable="false" />
</template>

<script setup lang="ts">
/** A find's picture: the pickup's own icon, the HUD's flare or fireworks, or a wrapped candy drawn in CSS. */
import { computed } from 'vue';
import type { ArtBook, PixelSprite } from '../../art/types.ts';
import { spriteDataUrl } from '../../engine/sprite-cache.ts';
import type { FindIcon } from '../../game/town-guide.ts';

const { icon, art } = defineProps<{ icon: FindIcon; art: ArtBook }>();

function spriteOf(find: Exclude<FindIcon, 'candy'>): PixelSprite {
  const isFlare = find === 'flare';
  if (isFlare) return art.ui.flare;
  const isFirework = find === 'firework';
  return isFirework ? art.ui.fireworks : art.ui.pickupIcons[find];
}

const url = computed(() => (icon === 'candy' ? '' : spriteDataUrl(spriteOf(icon))));
</script>
