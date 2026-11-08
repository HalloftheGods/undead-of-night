<template>
  <section class="px-screen town" :aria-label="key.title">
    <canvas ref="canvasRef" class="town-canvas px-frame" :style="{ '--side': canvasSide }" />
    <aside class="town-key">
      <h2 class="town-title">{{ key.title }}</h2>
      <ul class="town-legend">
        <li v-for="[color, label] in key.legend" :key="label">
          <span class="town-swatch" :style="{ '--swatch': color }" />{{ label }}
        </li>
        <template v-if="key.marks">
          <li class="town-tick">Check: been inside</li>
          <li class="town-cross">X: cleared & searched</li>
        </template>
      </ul>
      <ul v-if="teammates.length > 0" class="town-legend town-team" aria-label="Your team">
        <li v-for="mate in teammates" :key="mate.id" :style="{ '--swatch': mate.color }">
          <span class="town-swatch" />{{ mate.name }}<span v-if="mate.status !== 'alive'" class="town-down">{{ mate.status }}</span>
        </li>
      </ul>
      <p class="px-note">{{ key.waitNote(mode) }} <span class="keys-only">Tab to close</span></p>
      <MenuLink class="touch-only town-close" @press="game.toggleMap()">Close</MenuLink>
    </aside>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import { mapKey } from '../game/map-key.ts';
import type { TeammateHud } from '../game/hud-state.ts';
import type { TransportKind } from '../network/transport.ts';
import MenuLink from './MenuLink.vue';
import { useGame } from './use-game.ts';

const SCREEN_MARGIN = 24;
const KEY_WIDTH = 260;

const { inBunker, teammates = [] } = defineProps<{ mode: TransportKind; inBunker: boolean; teammates?: readonly TeammateHud[] }>();

const game = useGame();
const key = computed(() => mapKey(inBunker));
const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef');
const mapPixels = ref(1);
const fit = ref(Math.min(window.innerWidth - KEY_WIDTH, window.innerHeight) - SCREEN_MARGIN);

/** In half steps of the map's size: whole steps alone leave a small window with a very small map. */
const canvasSide = computed(() => {
  const half = mapPixels.value / 2;
  return `${Math.max(2, Math.floor(fit.value / half)) * half}px`;
});

function measure(): void {
  fit.value = Math.min(window.innerWidth - KEY_WIDTH, window.innerHeight) - SCREEN_MARGIN;
}

onMounted(() => {
  game.attachTownCanvas(canvasRef.value);
  mapPixels.value = canvasRef.value?.width ?? 1;
  window.addEventListener('resize', measure);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', measure);
  game.attachTownCanvas(null);
});
</script>

<style scoped>
.town {
  flex-direction: row;
  flex-wrap: wrap;
  background: rgba(7, 8, 12, 0.92);
}

.town-canvas {
  flex: none;
  width: var(--side);
  /* The canvas keeps its own shape: the town is square, the bunker is wider than tall. */
  height: auto;
  image-rendering: pixelated;
}

.town-key {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 4);
  max-width: calc(var(--u) * 100);
}

.town-title {
  font-size: calc(var(--u) * 10);
  line-height: 1;
}

.town-legend {
  display: flex;
  flex-direction: column;
  gap: var(--u);
  color: var(--bone-dim);
  list-style: none;
}

.town-legend li {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 2);
}

.town-swatch {
  width: calc(var(--u) * 5);
  height: calc(var(--u) * 5);
  background: var(--swatch);
}

.town-team li {
  color: var(--swatch);
}

.town-down {
  color: var(--blood-bright);
}

.town-tick {
  color: var(--sick);
}

.town-cross {
  color: var(--blood-bright);
}
</style>
