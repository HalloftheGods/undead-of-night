<template>
  <TitlePage heading="Options" size="wide" @close="emit('close')">
    <div class="options-cards">
      <div class="options-columns">
        <section class="options-card px-frame" aria-labelledby="options-sound">
          <h3 id="options-sound" class="options-card-head">Sound</h3>
          <SoundOptions :ui />
        </section>

        <section class="options-card px-frame" aria-labelledby="options-display">
          <h3 id="options-display" class="options-card-head">Display</h3>
          <DisplayOptions :ui />
        </section>

        <section class="options-card px-frame" aria-labelledby="options-motion">
          <h3 id="options-motion" class="options-card-head">Comfort</h3>
          <MotionOptions />
          <TouchOptions />
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

      <section class="options-card px-frame" aria-labelledby="options-controls">
        <h3 id="options-controls" class="options-card-head">Controls</h3>
        <dl class="options-keys">
          <div v-for="[keys, action] in CONTROLS" :key="action" class="options-key">
            <dt>{{ keys }}</dt>
            <dd>{{ action }}</dd>
          </div>
        </dl>
      </section>
    </div>
  </TitlePage>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { consent, openPrivacy } from '../game/analytics/index.ts';
import type { UiState } from '../game/hud-state.ts';
import { CONTROLS } from '../game/title-menu.ts';
import DisplayOptions from './DisplayOptions.vue';
import MenuLink from './MenuLink.vue';
import MotionOptions from './MotionOptions.vue';
import PixelSwitch from './PixelSwitch.vue';
import SoundOptions from './SoundOptions.vue';
import TitlePage from './TitlePage.vue';
import TouchOptions from './TouchOptions.vue';

defineProps<{ ui: UiState }>();
const emit = defineEmits<{ close: [] }>();

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

.options-keys {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, calc(var(--u) * 180)), 1fr));
  gap: var(--u) calc(var(--u) * 10);
  margin: 0;
}

.options-key {
  display: grid;
  grid-template-columns: calc(var(--u) * 40) 1fr;
  gap: calc(var(--u) * 4);
}

.options-key dt {
  margin: 0;
}

.options-keys dt {
  color: var(--amber);
}

.options-keys dd {
  margin: 0;
  color: var(--bone-dim);
}
</style>
