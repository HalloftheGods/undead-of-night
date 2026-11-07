<template>
  <div class="sound-options">
    <div class="sound-options-master">
      <OptionSlider id="volume" label="Volume" :value="ui.volume" @change="game.setVolume" />
      <PixelButton class="sound-options-mute" :aria-pressed="ui.muted" @press="game.toggleMute()">{{ muteLabel }}</PixelButton>
    </div>
    <OptionSlider id="music-volume" label="Music" :value="ui.musicVolume" @change="game.setMusicVolume" />
    <OptionSlider id="sfx-volume" label="Sound effects" :value="ui.sfxVolume" @change="game.setSfxVolume" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { UiState } from '../game/hud-state.ts';
import OptionSlider from './OptionSlider.vue';
import PixelButton from './PixelButton.vue';
import { useGame } from './use-game.ts';

const { ui } = defineProps<{ ui: UiState }>();
const game = useGame();

const muteLabel = computed(() => (ui.muted ? 'Unmute' : 'Mute'));
</script>

<style scoped>
.sound-options {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
}

.sound-options-master {
  display: flex;
  align-items: flex-end;
  gap: calc(var(--u) * 6);
}

.sound-options-master > :first-child {
  flex: 1;
  padding-bottom: calc(var(--u) * 3);
}

.sound-options-mute {
  width: calc(var(--u) * 56);
}
</style>
