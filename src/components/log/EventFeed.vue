<template>
  <button type="button" class="hud-chip feed" aria-label="Open the run log" @mousedown.stop @touchstart.stop @click="game.toggleLog()">
    <ol class="feed-lines" aria-live="polite">
      <LogLine v-for="(entry, index) in recent" :key="entry.key" :entry :class="`is-age-${age(index)}`" />
    </ol>
    <span class="feed-hint"><span v-if="keys.readKeyLabel('KeyL')" class="keys-only">{{ keys.readKeyLabel('KeyL') }}: </span>Log</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { LogEntry } from '../../game/event-log.ts';
import { useGame } from '../use-game.ts';
import LogLine from './LogLine.vue';
import { useKeyLabels } from '../use-key-labels.ts';

const keys = useKeyLabels();

/** The corner keeps the newest few; the rest wait in the full log. Touch shows only the last two (see CSS). */
const FEED_LINES = 5;

const { log } = defineProps<{ log: readonly LogEntry[] }>();
const game = useGame();
const recent = computed(() => log.slice(-FEED_LINES));

/** 0 for the newest line; older lines dim (see CSS), but stay where they are. */
function age(index: number): number {
  return recent.value.length - 1 - index;
}
</script>

<style scoped>
.feed {
  border: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  width: min(calc(var(--u) * 150), 34vw);
  align-items: stretch;
  pointer-events: auto;
  cursor: pointer;
}

.feed-lines {
  display: flex;
  flex-direction: column;
  gap: var(--u);
  list-style: none;
}

.feed-lines :deep(.log-text) {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.is-age-1 { opacity: 0.85; }
.is-age-2 { opacity: 0.7; }
.is-age-3 { opacity: 0.55; }
.is-age-4 { opacity: 0.4; }

.feed-hint {
  align-self: flex-end;
  color: var(--bone-dim);
  text-transform: uppercase;
}

.is-touch .feed-lines :deep(.log-line:nth-last-child(n + 3)) {
  display: none;
}

.is-touch .feed {
  border: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  width: min(calc(var(--u) * 110), 40vw);
}
</style>
