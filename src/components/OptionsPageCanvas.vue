<template></template>

<script setup lang="ts">
/**
 * The Gameplay, Display and Audio pages drawn on the game canvas with the page kit instead of the Vue pages (the "In-game menus"
 * switch). It has no markup: the panels come from options-page-model, the kit draws them and answers the input.
 */
import { computed } from 'vue';
import { privacyOpen } from '../game/analytics/index.ts';
import type { PageModel } from '../engine/page-ui.ts';
import type { UiState } from '../game/hud-state.ts';
import { useOptionsPanels } from './options-page-model.ts';
import type { OptionsKind } from './options-page-model.ts';
import { useCanvasPage } from './use-canvas-page.ts';

const { ui, kind } = defineProps<{ ui: UiState; kind: OptionsKind }>();
const emit = defineEmits<{ close: [] }>();
const options = useOptionsPanels(ui, kind);

const model = computed<PageModel>(() => ({
  heading: options.heading,
  panels: options.panels.value,
  buttons: [{ id: 'back', label: 'Back', enabled: true, primary: false }],
}));

function press(id: string): void {
  if (id === 'back') emit('close');
  else options.link(id);
}

useCanvasPage(model, { press, toggle: options.toggle, choose: options.choose, slide: options.slide, inert: () => privacyOpen.value }, () => emit('close'));
</script>
