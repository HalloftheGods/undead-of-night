<template>
  <button
    class="sound-chip px-frame"
    :class="{ 'is-playing': isPlaying, 'is-locked': !entry.unlocked, 'is-find': isFind }"
    type="button"
    :disabled="!entry.unlocked"
    :aria-pressed="isPlaying"
    :aria-label="ariaText"
    @click="emit('toggle', entry)"
  >
    <span class="chip-top">
      <span class="chip-badge" :class="`is-${badgeKind}`">{{ badgeLabel }}</span>
      <span class="chip-where">{{ entry.where }}</span>
    </span>

    <span class="chip-main">
      <span class="chip-name">{{ entry.label }}</span>
    </span>

    <span class="chip-bottom">
      <template v-if="isPlaying">
        <span class="chip-eq" aria-hidden="true">
          <span class="eq-dot" />
          <span class="eq-dot" />
          <span class="eq-dot" />
        </span>
        <span class="chip-status is-active">PLAYING</span>
      </template>
      <template v-else-if="!entry.unlocked">
        <span class="chip-status is-locked">LOCKED</span>
      </template>
      <template v-else>
        <span class="chip-status">PREVIEW</span>
      </template>
    </span>
  </button>
</template>

<script setup lang="ts">
/**
 * Atom component representing a single sound/music cartridge chip in the Sound Test rack.
 */
import { computed } from 'vue';
import type { SoundEntry } from '../game/sound-test.ts';

interface SoundChipProps {
  entry: SoundEntry;
  isPlaying: boolean;
}

const { entry, isPlaying } = defineProps<SoundChipProps>();
const emit = defineEmits<{ toggle: [entry: SoundEntry] }>();

const isFind = computed(() => entry.kind === 'music' && entry.find);

const badgeKind = computed(() => {
  if (isFind.value) return 'find';
  if (entry.kind === 'music') return 'music';
  return 'sfx';
});

const badgeLabel = computed(() => {
  if (isFind.value) return 'FIND';
  if (entry.kind === 'music') return 'MUSIC';
  return 'SFX';
});

const ariaText = computed(() => {
  if (!entry.unlocked) return `${entry.where}, locked`;
  return `${entry.name}, ${entry.where}`;
});
</script>

<style scoped>
.sound-chip {
  --edge: var(--ink-line);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: calc(var(--u) * 2);
  width: 100%;
  min-height: calc(var(--u) * 36);
  border: 0;
  padding: calc(var(--u) * 3) calc(var(--u) * 3);
  background: var(--ink-raised);
  color: var(--bone);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 60ms ease, box-shadow 60ms ease;
}

.sound-chip:hover:not(:disabled),
.sound-chip:focus-visible {
  --edge: var(--amber);
  outline: none;
  background: rgba(232, 163, 61, 0.08);
}

.sound-chip.is-playing {
  --edge: var(--amber);
  background: rgba(232, 163, 61, 0.16);
  color: var(--amber);
}

.sound-chip.is-locked {
  --edge: rgba(51, 52, 60, 0.4);
  background: rgba(11, 12, 16, 0.6);
  color: var(--bone-dim);
  cursor: default;
  opacity: 0.6;
}

.chip-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--u);
  font-size: calc(var(--u) * 5);
}

.chip-badge {
  padding: 0 calc(var(--u) * 2);
  font-weight: 700;
  letter-spacing: 0.05em;
  background: var(--ink-line);
  color: var(--bone);
}

.chip-badge.is-music {
  background: rgba(232, 163, 61, 0.25);
  color: var(--amber);
}

.chip-badge.is-find {
  background: rgba(143, 191, 58, 0.25);
  color: var(--sick);
}

.chip-badge.is-sfx {
  background: rgba(179, 38, 30, 0.25);
  color: var(--blood-bright);
}

.chip-where {
  color: var(--bone-dim);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.chip-main {
  display: flex;
  flex-direction: column;
  margin: var(--u) 0;
}

.chip-name {
  font-size: calc(var(--u) * 7);
  font-weight: 700;
  line-height: 1.2;
  word-break: break-word;
}

.chip-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: calc(var(--u) * 5);
}

.chip-status {
  color: var(--bone-dim);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.chip-status.is-active {
  color: var(--amber);
  font-weight: 700;
}

.chip-status.is-locked {
  color: var(--bone-dim);
  opacity: 0.7;
}

.chip-eq {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 1);
}

.eq-dot {
  width: calc(var(--u) * 2);
  height: calc(var(--u) * 2);
  background: var(--amber);
  animation: pulse-dot 600ms ease infinite alternate;
}

.eq-dot:nth-child(2) {
  animation-delay: 200ms;
}

.eq-dot:nth-child(3) {
  animation-delay: 400ms;
}

@keyframes pulse-dot {
  from { opacity: 0.3; transform: scaleY(0.6); }
  to { opacity: 1; transform: scaleY(1.4); }
}
</style>
