<template>
  <section class="px-screen px-title-scale pause-screen" :class="{ 'is-previewing': previewing }" aria-labelledby="pause-heading">
    <div class="pause px-frame">
      <p class="pause-head">
        <template v-if="inBunker">The bunker</template>
        <template v-else-if="level !== null">
          <span class="pause-number" aria-hidden="true">{{ level }}</span>
          <span class="pause-town">{{ townName(level) }}</span>
        </template>
      </p>
      <h2 id="pause-heading" class="px-heading pause-heading">{{ mode === 'solo' ? 'Paused' : 'Menu' }}</h2>
      <p v-if="mode === 'coop'" class="px-note pause-note">Co-op does not pause. The horde is still coming.</p>
      <template v-if="ui.onlineRoom">
        <p class="px-label pause-room">Room code <span class="pause-code">{{ ui.onlineRoom }}</span></p>
        <PixelButton @press="copy">{{ label }}</PixelButton>
        <p class="px-note pause-note">Leaving ends the game for everyone in it.</p>
      </template>

      <div class="pause-sliders">
        <div>
          <label class="px-label pause-volume-label" for="pause-volume">
            <span>Volume</span>
            <span class="pause-volume-value" aria-hidden="true">{{ volumeShown }}</span>
          </label>
          <input
            id="pause-volume"
            class="px-slider"
            type="range"
            min="0"
            max="1"
            step="0.05"
            :value="ui.volume"
            :aria-valuetext="volumeShown"
            @input="onVolume"
          />
        </div>
        <!-- Right here, so a player who cannot see the zombies never has to quit to the title for it. -->
        <BrightnessSlider id="pause" :note="false" @preview="previewing = $event" />
      </div>

      <div ref="resumeBox" class="pause-resume">
        <PixelButton primary silent @press="game.togglePause()">Resume</PixelButton>
      </div>
      <p v-if="warning" class="px-error" role="alert">{{ warning }}</p>
      <MenuLink class="pause-menu-link" @press="game.toMenu()">Main menu</MenuLink>
    </div>

    <GestureHints />
  </section>
</template>

<script setup lang="ts">
/**
 * The pause card, framed like the Game Over and Level Select cards: where you are on a strip along its top,
 * then volume, Resume (focused, so Enter or a pad's A goes straight back in) and the way out.
 */
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue';
import { townName } from '../../shared/levels.ts';
import { leaveWarning } from '../game/home-screens.ts';
import type { UiState } from '../game/hud-state.ts';
import type { TransportKind } from '../network/transport.ts';
import BrightnessSlider from './BrightnessSlider.vue';
import GestureHints from './GestureHints.vue';
import MenuLink from './MenuLink.vue';
import PixelButton from './PixelButton.vue';
import { useRoomLink } from './use-room-link.ts';
import { useGame } from './use-game.ts';

const { ui } = defineProps<{ ui: UiState; mode: TransportKind }>();
const game = useGame();
const resumeBox = useTemplateRef<HTMLElement>('resumeBox');
/** While the Brightness thumb is held the backdrop and the rest of the card fade, so the town shows what it does. */
const previewing = ref(false);
const warning = computed(() => leaveWarning(ui.home));
const inBunker = computed(() => ui.home?.inBunker === true);
const level = computed(() => ui.hud?.level ?? null);
const volumeShown = computed(() => (ui.muted ? 'Muted' : `${Math.round(ui.volume * 100)}%`));

const { label, copy } = useRoomLink(() => ui.onlineRoom);

function onVolume(event: Event): void {
  game.setVolume(Number((event.target as HTMLInputElement).value));
}

onMounted(() => void nextTick(() => resumeBox.value?.querySelector('button')?.focus({ preventScroll: true })));
</script>

<style scoped>
.pause-screen {
  background: rgba(7, 8, 12, 0.82);
}

.pause-screen.is-previewing {
  background: transparent;
}

.pause-screen.is-previewing .pause {
  opacity: 0.35;
}

.pause {
  --edge: var(--amber);
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 4);
  width: calc(var(--u) * 140);
  max-width: 100%;
  padding: calc(var(--u) * 6);
  background: var(--ink-raised);
  animation: px-fade-in 120ms steps(3);
}

/* Where you are, on a strip along the card's top like the town strip on a Level Select card. */
.pause-head {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 2);
  min-height: calc(var(--u) * 7);
  margin: calc(var(--u) * -6) calc(var(--u) * -6) 0;
  padding: calc(var(--u) * 2) calc(var(--u) * 4);
  border-bottom: var(--u) solid var(--amber);
  background: var(--ink);
  color: var(--bone);
  font-size: calc(var(--u) * 6);
  text-transform: uppercase;
  white-space: nowrap;
}

.pause-number {
  display: grid;
  flex: none;
  place-items: center;
  width: calc(var(--u) * 7);
  height: calc(var(--u) * 7);
  background: var(--amber);
  color: var(--ink);
  font-weight: 700;
}

.pause-town {
  overflow: hidden;
  text-overflow: ellipsis;
}

.pause-heading {
  margin: calc(var(--u) * 2) 0 0;
}

.pause-note {
  margin: 0;
  max-width: none;
}

.pause-room {
  margin: 0;
  text-align: center;
}

.pause-code {
  color: var(--amber);
}

.pause-sliders {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 4);
}

.pause-volume-label {
  display: flex;
  justify-content: space-between;
  gap: calc(var(--u) * 4);
}

.pause-volume-value {
  color: var(--bone);
}

.pause-resume {
  margin-top: calc(var(--u) * 2);
}

/* The one big button, thumb-sized on a phone. */
.pause-resume :deep(.px-button) {
  min-height: 48px;
  padding-block: calc(var(--u) * 4);
  font-size: calc(var(--u) * 9);
}

.pause-menu-link {
  align-self: center;
  justify-content: center;
}

/* A phone on its side: the swipe hints go beside the card rather than under it. */
@media (orientation: landscape) and (max-height: 520px) {
  .pause-screen {
    flex-direction: row;
    gap: calc(var(--u) * 12);
  }

  .pause {
    gap: calc(var(--u) * 3);
    padding: calc(var(--u) * 4) calc(var(--u) * 6);
  }

  .pause-head {
    margin: calc(var(--u) * -4) calc(var(--u) * -6) 0;
  }
}
</style>
