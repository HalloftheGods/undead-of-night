<template>
  <div class="sound-options">
    <div class="sound-options-master">
      <OptionSlider
        id="volume"
        label="Master Volume"
        :value="ui.volume"
        :readout="masterReadout"
        @change="game.setVolume"
      />
      <PixelButton
        class="sound-options-mute"
        :class="{ 'is-muted': ui.muted }"
        :aria-pressed="ui.muted"
        @press="game.toggleMute()"
      >
        {{ muteLabel }}
      </PixelButton>
    </div>
    <div class="sound-options-channels">
      <OptionSlider
        id="music-volume"
        label="Music Volume"
        :value="ui.musicVolume"
        :readout="musicReadout"
        @change="game.setMusicVolume"
      />
      <OptionSlider
        id="sfx-volume"
        label="SFX Volume"
        :value="ui.sfxVolume"
        :readout="sfxReadout"
        @change="game.setSfxVolume"
      />
    </div>
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
const masterReadout = computed(() => (ui.muted ? 'MUTED' : `${Math.round(ui.volume * 100)}%`));
const musicReadout = computed(() => `${Math.round(ui.musicVolume * 100)}%`);
const sfxReadout = computed(() => `${Math.round(ui.sfxVolume * 100)}%`);
</script>

<style scoped>
.sound-options {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 4);
}

.sound-options-master {
  display: flex;
  align-items: flex-end;
  gap: calc(var(--u) * 4);
}

.sound-options-master > :first-child {
  flex: 1;
}

.sound-options-mute {
  min-width: calc(var(--u) * 48);
  height: calc(var(--u) * 16);
}

.sound-options-mute.is-muted {
  --edge: var(--blood-bright);
  color: var(--blood-bright);
}

.sound-options-channels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: calc(var(--u) * 4);
}

@container (max-width: 480px) {
  .sound-options-channels {
    grid-template-columns: 1fr;
  }
}
</style>
