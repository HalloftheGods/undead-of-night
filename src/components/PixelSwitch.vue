<template>
  <div class="px-switch-row">
    <span :id="labelId" class="px-label px-switch-label">{{ label }}</span>
    <button
      class="px-switch"
      :class="{ 'is-on': on }"
      type="button"
      role="switch"
      :aria-checked="on"
      :aria-labelledby="labelId"
      :disabled
      @mouseenter="onHover"
      @click="onClick"
    >
      <span class="px-switch-state" aria-hidden="true">{{ stateWord }}</span>
      <span class="px-switch-track px-frame" aria-hidden="true">
        <span class="px-switch-knob" />
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue';
import { useGame } from './use-game.ts';

/** An on/off setting: a notched track with a square knob that snaps across. */
const { label, on, disabled = false } = defineProps<{ label: string; on: boolean; disabled?: boolean }>();
const emit = defineEmits<{ change: [on: boolean] }>();
const game = useGame();
const labelId = useId();

const stateWord = computed(() => (on ? 'On' : 'Off'));

function onHover(): void {
  if (!disabled) game.playUi('hover');
}

function onClick(): void {
  game.playUi('click');
  emit('change', !on);
}
</script>

<style scoped>
.px-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--u) * 6);
}

.px-switch-label {
  flex: 1;
}

.px-switch {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 4);
  min-height: 44px;
  border: 0;
  padding: 0 var(--u);
  background: none;
  color: var(--bone-dim);
  font: inherit;
  font-weight: 700;
  text-transform: uppercase;
  cursor: pointer;
  outline: none;
  touch-action: manipulation;
}

.px-switch:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.px-switch-track {
  --edge: var(--bone-dim);
  position: relative;
  display: block;
  width: calc(var(--u) * 24);
  height: calc(var(--u) * 10);
  background: var(--ink-raised);
}

.px-switch-knob {
  position: absolute;
  top: calc(var(--u) * 2);
  left: calc(var(--u) * 2);
  width: calc(var(--u) * 6);
  height: calc(var(--u) * 6);
  background: var(--bone-dim);
  transition: transform 90ms steps(3);
}

.px-switch:hover:not(:disabled) .px-switch-track,
.px-switch:focus-visible .px-switch-track {
  --edge: var(--amber);
}

.px-switch:hover:not(:disabled),
.px-switch:focus-visible {
  color: var(--bone);
}

.px-switch.is-on {
  color: var(--bone);
}

.px-switch.is-on .px-switch-track {
  background: var(--blood);
}

.px-switch.is-on .px-switch-knob {
  background: var(--bone);
  transform: translateX(calc(var(--u) * 14));
}

:root[data-motion='reduced'] .px-switch-knob {
  transition: none;
}
</style>
