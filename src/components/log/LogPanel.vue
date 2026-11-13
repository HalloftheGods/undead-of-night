<template>
  <aside class="log-panel" aria-label="Run log" @mousedown.stop @touchstart.stop @wheel.stop>
    <header class="log-head">
      <strong>Run log</strong>
      <button type="button" class="px-button log-close" @click="game.toggleLog()">
        <span v-if="keys.readKeyLabel('KeyL')" class="keys-only">{{ keys.readKeyLabel('KeyL') }} </span>Close
      </button>
    </header>
    <nav class="log-tabs">
      <button
        v-for="tab in LOG_FILTERS"
        :key="tab.id"
        type="button"
        class="log-tab"
        :class="{ 'is-on': tab.id === filter }"
        @click="filter = tab.id"
      >
        {{ tab.label }}
      </button>
    </nav>
    <ol ref="listRef" class="log-list">
      <LogLine v-for="entry in shown" :key="entry.key" :entry detail />
      <li v-if="shown.length === 0" class="log-empty">Nothing yet.</li>
    </ol>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue';
import { filterLog, LOG_FILTERS } from '../../game/event-log.ts';
import type { LogEntry, LogFilter } from '../../game/event-log.ts';
import { useGame } from '../use-game.ts';
import LogLine from './LogLine.vue';
import { useKeyLabels } from '../use-key-labels.ts';

const keys = useKeyLabels();

const { log } = defineProps<{ log: readonly LogEntry[] }>();
const game = useGame();
const filter = ref<LogFilter>('all');
const shown = computed(() => filterLog(log, filter.value));
const listRef = useTemplateRef<HTMLOListElement>('listRef');

/** Newest at the bottom: the list opens there and follows new lines, unless the player has scrolled up to read. */
function nearBottom(): boolean {
  const list = listRef.value;
  return !list || list.scrollHeight - list.scrollTop - list.clientHeight < 40;
}

function toBottom(): void {
  if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight;
}

onMounted(toBottom);
watch(shown, async () => {
  const follow = nearBottom();
  await nextTick();
  if (follow) toBottom();
});
watch(filter, async () => {
  await nextTick();
  toBottom();
});
</script>

<style scoped>
.log-panel {
  position: absolute;
  top: calc(var(--u) * 5);
  right: calc(var(--u) * 5);
  bottom: calc(var(--u) * 5);
  width: min(calc(var(--u) * 180), calc(100vw - var(--u) * 10));
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
  padding: calc(var(--u) * 4);
  background: rgba(11, 12, 16, 0.92);
  border: var(--u) solid var(--ink-line);
  color: var(--bone);
  cursor: auto;
  z-index: 5;
}

.log-head {
  display: flex;
  gap: calc(var(--u) * 3);
  white-space: nowrap;
  justify-content: space-between;
  align-items: center;
  text-transform: uppercase;
  color: var(--amber);
}

.log-close {
  flex: none;
  width: auto;
}

.log-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--u) * 2);
}

.log-tab {
  padding: var(--u) calc(var(--u) * 3);
  background: transparent;
  border: var(--u) solid var(--ink-line);
  color: var(--bone-dim);
  font: inherit;
  text-transform: uppercase;
  cursor: pointer;
}

.log-tab.is-on {
  border-color: var(--amber);
  color: var(--amber);
}

.log-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
  overflow-y: auto;
  list-style: none;
  overscroll-behavior: contain;
  touch-action: pan-y;
}

.log-empty {
  color: var(--bone-dim);
}

.is-touch .log-panel {
  top: calc(var(--safe-top, 0px) + var(--u) * 3);
  bottom: calc(var(--tabbar, 0px) + var(--u) * 3);
  right: calc(var(--safe-right, 0px) + var(--u) * 3);
}
</style>
