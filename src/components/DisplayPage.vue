<template>
  <OptionsShell heading="Video" @close="emit('close')">
    <OptionsCard heading="Video">
      <DisplayOptions :ui />
    </OptionsCard>
    <OptionsCard heading="Comfort">
      <MotionOptions />
      <PixelSwitch label="Menu details" :on="menuInfo" @change="setMenuInfo" />
      <p class="display-page-note">A line under each main menu item saying what it opens.</p>
    </OptionsCard>
  </OptionsShell>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { UiState } from '../game/hud-state.ts';
import { loadMenuInfo, saveMenuInfo } from '../game/menu-info-pref.ts';
import DisplayOptions from './DisplayOptions.vue';
import MotionOptions from './MotionOptions.vue';
import OptionsCard from './OptionsCard.vue';
import OptionsShell from './OptionsShell.vue';
import PixelSwitch from './PixelSwitch.vue';

defineProps<{ ui: UiState }>();
const emit = defineEmits<{ close: [] }>();
const menuInfo = ref(loadMenuInfo());

function setMenuInfo(on: boolean): void {
  menuInfo.value = on;
  saveMenuInfo(on);
}
</script>

<style scoped>
.display-page-note {
  margin: 0;
  color: var(--bone-dim);
}
</style>
