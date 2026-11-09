<template>
  <button
    class="touch-tab"
    :class="{ 'is-lit': lit }"
    type="button"
    :aria-label="label"
    :aria-pressed="lit"
    @pointerdown.prevent="$emit('press')"
    @pointerup="$emit('release')"
    @pointercancel="$emit('release')"
    @pointerleave="$emit('release')"
    @mousedown.stop
    @contextmenu.prevent
  >
    <svg
      class="tab-glyph"
      :viewBox="`0 0 ${glyph[0].length} ${glyph.length}`"
      aria-hidden="true"
      shape-rendering="crispEdges"
    >
      <path :d="glyphPath(glyph)" fill="currentColor" />
    </svg>
    <span class="tab-label">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import { glyphPath } from '../game/touch-pad.ts';
import type { PadGlyph } from '../game/touch-pad.ts';

defineProps<{
  label: string;
  glyph: PadGlyph;
  /** Held down, or the thing it opens is open. */
  lit?: boolean;
}>();

defineEmits<{
  press: [];
  release: [];
}>();
</script>

<style scoped>
/* A tab of an iOS bar, drawn in the HUD's pixels: the icon over its word, amber while it is in use. */
.touch-tab {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(var(--u) * 1.5);
  min-width: 0;
  min-height: var(--tab-row);
  border: 0;
  padding: calc(var(--u) * 2) 0 calc(var(--u) * 1.5);
  background: transparent;
  color: var(--bone-dim);
  font: inherit;
  cursor: pointer;
  touch-action: none;
}

/* The lit tab's notch along the top edge of the bar, as wide as its icon. */
.touch-tab::before {
  position: absolute;
  top: calc(var(--u) * -1);
  left: 50%;
  width: var(--tab-glyph);
  height: calc(var(--u) * 1.5);
  transform: translateX(-50%);
  background: transparent;
  content: '';
}

.touch-tab:active,
.touch-tab.is-lit {
  color: var(--amber);
}

.touch-tab:active::before,
.touch-tab.is-lit::before {
  background: var(--amber);
}

.tab-glyph {
  display: block;
  flex: none;
  width: var(--tab-glyph);
  height: var(--tab-glyph);
}

.tab-label {
  font-size: calc(var(--u) * 6);
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
}

/* On its side a phone has no height to give: the word goes beside the icon, iOS's compact bar. */
@media (orientation: landscape) and (max-height: 520px) {
  .touch-tab {
    flex-direction: row;
    gap: calc(var(--u) * 3);
    padding: 0;
  }
}
</style>
