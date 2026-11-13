<template>
  <OptionsShell heading="Gameplay & Comfort" @close="emit('close')">
    <OptionsCard heading="Comfort">
      <MotionOptions />
      <TouchOptions />
    </OptionsCard>

    <OptionsCard heading="Gameplay">
      <div class="gameplay-switch">
        <PixelSwitch label="Auto-close empty loot" :on="autoCloseLoot" @change="setAutoCloseLoot" />
        <p class="gameplay-note">Automatically closes the loot screen when the last item is taken from a container.</p>
        <PixelSwitch label="In-game loot window" :on="canvasLoot" @change="saveCanvasLoot" />
        <p class="gameplay-note">Draws the loot grids on the game itself, over a dimmed world. Mouse only for now: phones and gamepads keep the page version.</p>
        <PixelSwitch label="In-game menus" :on="canvasMenus" @change="saveCanvasMenus" />
        <p class="gameplay-note">Draws the Campaign and Arcade setup screen on the game itself instead of a page. Mouse and keyboard only for now: multiplayer, phones and gamepads keep the page version.</p>
      </div>
    </OptionsCard>

    <OptionsCard heading="Privacy">
      <div class="gameplay-switch">
        <PixelSwitch label="Analytics" :on="analyticsOn" :disabled="consent.optedOut" @change="setAnalytics" />
        <p class="gameplay-note">{{ analyticsNote }}</p>
        <MenuLink class="gameplay-privacy" @press="openPrivacy()">Privacy</MenuLink>
      </div>
    </OptionsCard>
  </OptionsShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { consent, openPrivacy } from '../game/analytics/index.ts';
import { canvasMenus, saveCanvasMenus } from '../game/canvas-menu-prefs.ts';
import { canvasLoot, loadAutoCloseEmptyLoot, saveAutoCloseEmptyLoot, saveCanvasLoot } from '../game/loot-prefs.ts';
import MenuLink from './MenuLink.vue';
import MotionOptions from './MotionOptions.vue';
import OptionsCard from './OptionsCard.vue';
import OptionsShell from './OptionsShell.vue';
import PixelSwitch from './PixelSwitch.vue';
import TouchOptions from './TouchOptions.vue';

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
.gameplay-switch {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2);
}

.gameplay-note {
  margin: 0;
  color: var(--bone-dim);
}

.gameplay-privacy {
  align-self: flex-start;
  padding-inline: 0;
}
</style>
