<template>
  <nav v-if="items.length > 0" class="touch-items" data-touch-pad aria-label="Throw or eat">
    <button
      v-for="each in items"
      :key="each.code"
      class="touch-button touch-item"
      :class="{ 'is-held': held.includes(each.code), 'is-none': !each.ready }"
      type="button"
      :aria-label="each.label"
      :title="each.label"
      @pointerdown.prevent="press(each.code)"
      @pointerup="release(each.code)"
      @pointercancel="release(each.code)"
      @pointerleave="release(each.code)"
      @mousedown.stop
      @contextmenu.prevent
    >
      <span v-if="each.art === 'candy'" class="touch-candy" aria-hidden="true" />
      <SpriteImg v-else :sprite="art.ui[each.art]" />
      <span class="touch-item-count">{{ each.count }}</span>
    </button>
  </nav>
  <nav class="touch-pad" data-touch-pad aria-label="Touch controls">
    <button
      v-for="each in TOUCH_BUTTONS"
      :key="each.code"
      class="touch-button"
      :class="{ 'is-held': held.includes(each.code) }"
      type="button"
      :aria-label="each.label"
      :title="each.label"
      @pointerdown.prevent="press(each.code)"
      @pointerup="release(each.code)"
      @pointercancel="release(each.code)"
      @pointerleave="release(each.code)"
      @mousedown.stop
      @contextmenu.prevent
    >
      <svg
        class="touch-glyph"
        :viewBox="`0 0 ${each.glyph[0].length} ${each.glyph.length}`"
        aria-hidden="true"
        shape-rendering="crispEdges"
      >
        <path :d="glyphPath(each.glyph)" fill="currentColor" />
      </svg>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { ArtBook } from '../art/types.ts';
import type { HudState } from '../game/hud-state.ts';
import { touchItems } from '../game/touch-items.ts';
import { glyphPath, TOUCH_BUTTONS } from '../game/touch-pad.ts';
import SpriteImg from './SpriteImg.vue';
import { useGame } from './use-game.ts';

const props = defineProps<{ hud: HudState; art: ArtBook }>();

const { input } = useGame();
const held = ref<string[]>([]);
const items = computed(() => touchItems(props.hud));

function press(code: string): void {
  held.value = [...held.value, code];
  input.padDown(code);
}

function release(code: string): void {
  const wasDown = held.value.includes(code);
  if (!wasDown) return;
  held.value = held.value.filter((each) => each !== code);
  input.padUp(code);
}

// The last bottle thrown takes its button away before the thumb lifts: let go of it then.
watch(items, (now) => {
  const shown = new Set([...now.map((each) => each.code), ...TOUCH_BUTTONS.map((each) => each.code)]);
  held.value.filter((code) => !shown.has(code)).forEach((code) => release(code));
});

// The run can end under a held thumb, and the next one must not start with Search down.
onBeforeUnmount(() => held.value.forEach((code) => input.padUp(code)));
</script>
