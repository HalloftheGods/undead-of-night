<template>
  <canvas ref="canvasRef" class="map-key-icon" :width="icon.w" :height="icon.h" :style="{ '--w': icon.w, '--h': icon.h }" aria-hidden="true" />
</template>

<script setup lang="ts">
import { onMounted, useTemplateRef, watch } from 'vue';
import type { MapIcon } from '../game/map-sprite.ts';

const { icon } = defineProps<{ icon: MapIcon }>();
const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef');

function paint(): void {
  const ctx = canvasRef.value?.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, icon.w, icon.h);
  icon.paint(ctx);
}

onMounted(paint);
watch(() => icon, paint);
</script>

<style scoped>
/* One map pixel to one unit of the pixel font, so the key's pictures sit at the same grain as its words. */
.map-key-icon {
  width: calc(var(--u) * var(--w));
  height: calc(var(--u) * var(--h));
  image-rendering: pixelated;
}
</style>
