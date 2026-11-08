<template>
  <button
    class="mobile-fab px-frame"
    :class="{ 'is-held': held, 'is-open': open }"
    type="button"
    :aria-label="label"
    :title="label"
    @pointerdown.prevent="$emit('press')"
    @pointerup="$emit('release')"
    @pointercancel="$emit('release')"
    @pointerleave="$emit('release')"
    @mousedown.stop
    @contextmenu.prevent
  >
    <svg
      class="fab-glyph"
      :viewBox="`0 0 ${glyph[0].length} ${glyph.length}`"
      aria-hidden="true"
      shape-rendering="crispEdges"
    >
      <path :d="glyphPath(glyph)" fill="currentColor" />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { glyphPath } from '../game/touch-pad.ts';
import type { PadGlyph } from '../game/touch-pad.ts';

defineProps<{
  label: string;
  glyph: PadGlyph;
  held?: boolean;
  open?: boolean;
}>();

defineEmits<{
  press: [];
  release: [];
}>();
</script>

<style scoped>
/* A pixel chip with the HUD's own notched edge, not a floating grey circle. */
.mobile-fab {
  --edge: var(--bone-dim);
  display: grid;
  place-items: center;
  width: var(--fab-size, 56px);
  height: var(--fab-size, 56px);
  min-width: var(--tap, 44px);
  min-height: var(--tap, 44px);
  border: 0;
  padding: 0;
  background: rgba(11, 12, 16, 0.86);
  color: var(--bone);
  cursor: pointer;
  touch-action: none;
}

.mobile-fab:active,
.mobile-fab.is-held,
.mobile-fab.is-open {
  --edge: var(--bone);
  background: var(--amber);
  color: var(--ink);
}

.fab-glyph {
  display: block;
  width: calc(var(--fab-size, 56px) * 0.46);
  height: calc(var(--fab-size, 56px) * 0.46);
}
</style>
