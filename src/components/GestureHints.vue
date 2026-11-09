<template>
  <!-- On the dim around the pause card, not in it: big enough to read at arm's length. -->
  <aside v-if="isTouch" class="gesture-hints" aria-label="Swipe controls">
    <p class="gesture-title">Swipe on the right side</p>
    <ul class="gesture-grid">
      <li v-for="hint in SWIPE_HINTS" :key="hint.direction" class="gesture-item">
        <svg
          class="gesture-arrow"
          :viewBox="`0 0 ${hint.arrow[0].length} ${hint.arrow.length}`"
          aria-hidden="true"
          shape-rendering="crispEdges"
        >
          <path :d="glyphPath(hint.arrow)" fill="currentColor" />
        </svg>
        <span class="gesture-label">{{ hint.label }}</span>
      </li>
    </ul>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { swipeArrow } from '../game/swipe-arrows.ts';
import type { SwipeDirection } from '../game/swipe-gesture.ts';
import { isTouchDevice } from '../game/touch-input.ts';
import { glyphPath } from '../game/touch-pad.ts';

const isTouch = ref(isTouchDevice());

/** What each swipe does in play (game/input-manager.ts handleSwipe). */
const SWIPES: readonly (readonly [SwipeDirection, string])[] = [
  ['up', 'Reload'],
  ['down', 'Pause'],
  ['left', 'Prev gun'],
  ['right', 'Next gun'],
];

const SWIPE_HINTS = SWIPES.map(([direction, label]) => ({ direction, label, arrow: swipeArrow(direction) }));
</script>

<style scoped>
.gesture-hints {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 5);
  margin: 0;
  color: var(--bone);
  text-shadow: calc(var(--u) * 1) calc(var(--u) * 1) 0 var(--ink);
}

.gesture-title {
  margin: 0;
  color: var(--amber);
  font-size: calc(var(--u) * 7);
  text-transform: uppercase;
  text-align: center;
}

.gesture-grid {
  display: grid;
  grid-template-columns: repeat(2, auto);
  gap: calc(var(--u) * 5) calc(var(--u) * 10);
  margin: 0;
  padding: 0;
  list-style: none;
}

.gesture-item {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 4);
}

/* The arrow's own box is square at any turn, so the words line up down the column. */
.gesture-arrow {
  flex: none;
  width: calc(var(--u) * 20);
  height: calc(var(--u) * 20);
  color: var(--bone);
  filter: drop-shadow(calc(var(--u) * 1) calc(var(--u) * 1) 0 var(--ink));
}

.gesture-label {
  font-size: calc(var(--u) * 8);
  text-transform: uppercase;
  white-space: nowrap;
}
</style>
