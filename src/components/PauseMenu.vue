<template>
  <section class="px-screen">
    <div class="px-panel px-frame pause">
      <h2 class="px-heading">{{ mode === 'solo' ? 'Paused' : 'Menu' }}</h2>
      <p v-if="mode === 'coop'" class="px-note">Co-op does not pause. The horde is still coming.</p>
      <template v-if="ui.onlineRoom">
        <p class="px-label">Room code {{ ui.onlineRoom }}</p>
        <PixelButton @press="copy">{{ label }}</PixelButton>
        <p class="px-note">Leaving ends the game for everyone in it.</p>
      </template>

      <label class="px-label" for="pause-volume">Volume{{ ui.muted ? ' (muted)' : '' }}</label>
      <input
        id="pause-volume"
        class="px-slider"
        type="range"
        min="0"
        max="1"
        step="0.05"
        :value="ui.volume"
        @input="onVolume"
      />

      <GestureHints />

      <PixelButton class="pause-resume" primary silent @press="game.togglePause()">Resume</PixelButton>
      <p v-if="warning" class="px-error" role="alert">{{ warning }}</p>
      <PixelButton @press="game.toMenu()">Main menu</PixelButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { leaveWarning } from '../game/home-screens.ts';
import type { UiState } from '../game/hud-state.ts';
import type { TransportKind } from '../network/transport.ts';
import GestureHints from './GestureHints.vue';
import PixelButton from './PixelButton.vue';
import { useRoomLink } from './use-room-link.ts';
import { useGame } from './use-game.ts';

const { ui } = defineProps<{ ui: UiState; mode: TransportKind }>();
const game = useGame();
const warning = computed(() => leaveWarning(ui.home));

const { label, copy } = useRoomLink(() => ui.onlineRoom);

function onVolume(event: Event): void {
  game.setVolume(Number((event.target as HTMLInputElement).value));
}
</script>

<style scoped>
.pause {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 4);
  width: calc(var(--u) * 130);
  max-width: 100%;
}

.pause-resume {
  margin-top: calc(var(--u) * 3);
}
</style>
