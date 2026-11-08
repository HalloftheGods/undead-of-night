<template>
  <TitlePage heading="Options" @close="emit('close')">
    <SoundOptions :ui />
    <DisplayOptions :ui />

    <MotionOptions />

    <TouchOptions />

    <div class="options-analytics">
      <PixelSwitch label="Analytics" :on="analyticsOn" :disabled="consent.optedOut" @change="setAnalytics" />
      <p class="options-note">{{ analyticsNote }}</p>
      <MenuLink class="options-privacy" @press="openPrivacy()">Privacy</MenuLink>
    </div>

    <div>
      <p class="px-label">Controls</p>
      <dl class="options-keys">
        <template v-for="[keys, action] in CONTROLS" :key="action">
          <dt>{{ keys }}</dt>
          <dd>{{ action }}</dd>
        </template>
      </dl>
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
  grid-template-columns: auto 1fr;
  gap: var(--u) calc(var(--u) * 6);
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
