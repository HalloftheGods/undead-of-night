<template>
  <TitlePage heading="Options" @close="emit('close')">
    <SoundOptions :ui />
    <DisplayOptions :ui />

    <MotionOptions />

    <div class="options-analytics">
      <div class="options-analytics-head">
        <p class="px-label">Analytics</p>
        <PixelButton class="options-mute" :disabled="consent.optedOut" :aria-pressed="analyticsOn" @press="toggleAnalytics">
          {{ analyticsLabel }}
        </PixelButton>
      </div>
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
import PixelButton from './PixelButton.vue';
import SoundOptions from './SoundOptions.vue';
import TitlePage from './TitlePage.vue';

defineProps<{ ui: UiState }>();
const emit = defineEmits<{ close: [] }>();

const analyticsOn = computed(() => consent.allowed());
const analyticsLabel = computed(() => (analyticsOn.value ? 'On' : 'Off'));
const analyticsNote = computed(() =>
  consent.optedOut
    ? 'Your browser sends Global Privacy Control, so analytics stays off.'
    : 'Play stats go to Google Analytics, which also receives your IP address and cookies. Turn it off any time.'
);

function toggleAnalytics(): void {
  if (analyticsOn.value) consent.deny();
  else consent.grant();
}
</script>

<style scoped>
.options-mute {
  width: calc(var(--u) * 56);
}

.options-analytics {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2);
}

.options-analytics-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--u) * 6);
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
