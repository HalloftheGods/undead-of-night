<template>
  <button
    class="mobile-fab"
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
.mobile-fab {
  display: grid;
  place-items: center;
  width: var(--fab-size, 56px);
  height: var(--fab-size, 56px);
  border: 0;
  border-radius: 50%;
  padding: 0;
  background: rgba(23, 24, 31, 0.85);
  color: var(--bone);
  cursor: pointer;
  touch-action: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  transition: background 0.1s, transform 0.1s;
}

.mobile-fab:active,
.mobile-fab.is-held {
  background: var(--amber);
  color: var(--ink);
  transform: scale(0.95);
}

.mobile-fab.is-open {
  background: var(--amber);
  color: var(--ink);
}

.fab-glyph {
  display: block;
  width: 24px;
  height: 24px;
}
</style>
