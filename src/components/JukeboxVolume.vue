<template>
  <div class="jukebox-vol-wrap" role="group" aria-label="Music volume">
    <button
      type="button"
      class="jukebox-vol-btn"
      :title="muted ? 'Unmute' : 'Mute'"
      :aria-label="muted ? 'Unmute' : 'Mute'"
      @click="emit('toggleMute')"
    >
      <span class="jukebox-vol-icon" aria-hidden="true">{{ muted ? '🔇' : (volume === 0 ? '🔈' : '🔊') }}</span>
    </button>
    <input
      type="range"
      min="0"
      max="1"
      step="0.05"
      :value="muted ? 0 : volume"
      class="jukebox-vol-slider"
      aria-label="Volume slider"
      @input="emit('changeVolume', Number(($event.target as HTMLInputElement).value))"
    />
    <span class="jukebox-vol-pct">{{ muted ? 'MUTED' : `${Math.round(volume * 100)}%` }}</span>
  </div>
</template>

<script setup lang="ts">
/**
 * Interactive volume control widget for the Jukebox screen: speaker mute button,
 * smooth range slider, and percentage level readout.
 */
defineProps<{
  volume: number;
  muted: boolean;
}>();

const emit = defineEmits<{
  toggleMute: [];
  changeVolume: [val: number];
}>();
</script>

<style scoped>
.jukebox-vol-wrap {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 2.5);
  padding: calc(var(--u) * 1) calc(var(--u) * 3);
  background: rgba(11, 12, 16, 0.85);
  border: 1px solid var(--ink-line);
}

.jukebox-vol-btn {
  display: grid;
  place-items: center;
  width: calc(var(--u) * 12);
  height: calc(var(--u) * 12);
  border: 1px solid var(--ink-line);
  background: var(--ink);
  color: var(--bone);
  cursor: pointer;
  padding: 0;
  outline: none;
  transition: border-color 0.1s, transform 0.1s;
}

.jukebox-vol-btn:hover,
.jukebox-vol-btn:focus-visible {
  border-color: var(--amber);
  transform: scale(1.08);
}

.jukebox-vol-icon {
  font-size: calc(var(--u) * 6.5);
  line-height: 1;
}

.jukebox-vol-slider {
  -webkit-appearance: none;
  appearance: none;
  width: calc(var(--u) * 44);
  height: calc(var(--u) * 3);
  background: var(--ink-line);
  outline: none;
  cursor: pointer;
}

.jukebox-vol-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: calc(var(--u) * 7);
  height: calc(var(--u) * 7);
  background: var(--amber);
  border: 1px solid var(--ink);
  box-shadow: 0 0 calc(var(--u) * 2) rgba(232, 163, 61, 0.6);
  cursor: pointer;
}

.jukebox-vol-slider::-moz-range-thumb {
  width: calc(var(--u) * 7);
  height: calc(var(--u) * 7);
  background: var(--amber);
  border: 1px solid var(--ink);
  box-shadow: 0 0 calc(var(--u) * 2) rgba(232, 163, 61, 0.6);
  cursor: pointer;
}

.jukebox-vol-pct {
  font-size: calc(var(--u) * 6);
  font-weight: 700;
  color: var(--amber);
  min-width: 5.5ch;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
