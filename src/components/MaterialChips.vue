<template>
  <ul v-if="chips.length > 0" class="material-chips" aria-label="Building materials">
    <li v-for="chip in chips" :key="chip.type" class="material-chip" :title="chip.label">
      <SpriteImg :sprite="art.ui.pickupIcons[chip.type]" />
      <span v-if="chip.count !== null">{{ chip.count }}</span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ArtBook } from '../art/types.ts';
import { materialChips } from '../game/material-chips.ts';
import type { HudState } from '../game/hud-state.ts';
import SpriteImg from './SpriteImg.vue';

const props = defineProps<{ hud: HudState; art: ArtBook }>();
const chips = computed(() => materialChips(props.hud.materials, props.hud.backpackTier));
</script>

<style scoped>
/* Same chip look as the carried-item row above it; wraps rather than running off a narrow screen. */
.material-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: calc(var(--u) * 1.5);
  max-width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}

.material-chip {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(var(--u) * 2);
  padding: calc(var(--u) * 2) calc(var(--u) * 4);
  background: rgba(11, 12, 16, 0.78);
}

.is-touch .material-chips {
  gap: var(--u);
}

.is-touch .material-chip {
  padding: calc(var(--u) * 2) calc(var(--u) * 3);
}
</style>
