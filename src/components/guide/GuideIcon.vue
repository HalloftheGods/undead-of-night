<template>
  <img class="tg-icon" :src="url" alt="" draggable="false" />
</template>

<script setup lang="ts">
/** A find's picture: the pickup's own icon, or the HUD's fireworks and wrapped candy. */
import { computed } from 'vue';
import type { ArtBook, PixelSprite } from '../../art/types.ts';
import { spriteDataUrl } from '../../engine/sprite-cache.ts';
import type { FindIcon } from '../../game/town-guide.ts';

const { icon, art } = defineProps<{ icon: FindIcon; art: ArtBook }>();

const HUD_ICONS = { fountain: 'fountain', firework: 'fireworks', candy: 'candy' } as const;

function spriteOf(find: FindIcon): PixelSprite {
  const isHudIcon = find === 'fountain' || find === 'firework' || find === 'candy';
  return isHudIcon ? art.ui[HUD_ICONS[find]] : art.ui.pickupIcons[find];
}

const url = computed(() => spriteDataUrl(spriteOf(icon)));
</script>
