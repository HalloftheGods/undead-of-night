<template>
  <TitlePage heading="Options" size="wide" @close="emit('close')">
    <div class="options-cards">
      <div class="options-columns">
        <section class="options-card px-frame" aria-labelledby="options-display">
          <h3 id="options-display" class="options-card-head">Display</h3>
          <DisplayOptions :ui />
        </section>

        <section class="options-card px-frame" aria-labelledby="options-motion">
          <h3 id="options-motion" class="options-card-head">Comfort</h3>
          <MotionOptions />
          <TouchOptions />
        </section>

        <section class="options-card px-frame" aria-labelledby="options-gameplay">
          <h3 id="options-gameplay" class="options-card-head">Gameplay</h3>
          <div class="options-analytics">
            <PixelSwitch label="Auto-close empty loot" :on="autoCloseLoot" @change="setAutoCloseLoot" />
            <p class="options-note">Automatically closes the loot screen when the last item is taken from a container.</p>
            <PixelSwitch label="In-game loot window" :on="canvasLoot" @change="saveCanvasLoot" />
            <p class="options-note">Draws the loot grids on the game itself, over a dimmed world. Mouse only for now: phones and gamepads keep the page version.</p>
          </div>
        </section>

        <section class="options-card px-frame" aria-labelledby="options-privacy">
          <h3 id="options-privacy" class="options-card-head">Privacy</h3>
          <div class="options-analytics">
            <PixelSwitch label="Analytics" :on="analyticsOn" :disabled="consent.optedOut" @change="setAnalytics" />
            <p class="options-note">{{ analyticsNote }}</p>
            <MenuLink class="options-privacy" @press="openPrivacy()">Privacy</MenuLink>
          </div>
        </section>
      </div>
    </div>
  </TitlePage>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { consent, openPrivacy } from '../game/analytics/index.ts';
import type { UiState } from '../game/hud-state.ts';
import { canvasLoot, loadAutoCloseEmptyLoot, saveAutoCloseEmptyLoot, saveCanvasLoot } from '../game/loot-prefs.ts';
import DisplayOptions from './DisplayOptions.vue';
import MenuLink from './MenuLink.vue';
import MotionOptions from './MotionOptions.vue';
import PixelSwitch from './PixelSwitch.vue';
import TitlePage from './TitlePage.vue';
import TouchOptions from './TouchOptions.vue';

defineProps<{ ui: UiState }>();
const emit = defineEmits<{ close: [] }>();

const autoCloseLoot = ref(loadAutoCloseEmptyLoot());
function setAutoCloseLoot(on: boolean): void {
  autoCloseLoot.value = on;
  saveAutoCloseEmptyLoot(on);
}

const analyticsOn = computed(() => consent.allowed());
const analyticsNote = computed(() =>
  consent.optedOut
    ? 'Your browser sends Global Privacy Control, so analytics stays off.'
    : 'Play stats go to Google Analytics, which also receives your IP address and cookies. Turn it off any time.'
);

function setAnalytics(on: boolean): void {
  if (on) consent.grant();
  else consent.deny();
}
</script>

<style scoped>
/* Each group of settings is its own framed card, in two balanced columns where the window is wide enough. */
.options-cards {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 6);
  padding: calc(var(--u) * 1);
}

.options-columns {
  columns: 2 calc(var(--u) * 200);
  column-gap: calc(var(--u) * 6);
}

.options-columns > .options-card {
  break-inside: avoid;
  margin-bottom: calc(var(--u) * 6);
}

.options-columns > .options-card:last-child {
  margin-bottom: 0;
}

.options-card {
  --edge: var(--ink-line);
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
  min-width: 0;
  padding: calc(var(--u) * 4);
  background: rgba(23, 24, 31, 0.86);
}

.options-card:focus-within {
  --edge: var(--bone-dim);
}

/* The card's name on a strip along its top, like the town strip on a Level Select card. */
.options-card-head {
  margin: calc(var(--u) * -4) calc(var(--u) * -4) 0;
  padding: calc(var(--u) * 2) calc(var(--u) * 4);
  border-bottom: var(--u) solid var(--amber);
  background: var(--ink);
  color: var(--amber);
  font-size: calc(var(--u) * 7);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.options-analytics {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2);
}

.options-note {
  margin: 0;
  color: var(--bone-dim);
}

.options-privacy {
  align-self: flex-start;
  padding-inline: 0;
}
</style>
