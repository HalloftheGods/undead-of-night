<template>
  <ol class="stepper" aria-label="Setup steps">
    <li v-for="stop in stops" :key="stop.step" class="stepper-stop" :class="`is-${stop.state}`">
      <button
        v-if="stop.state === 'done'"
        class="stepper-mark"
        type="button"
        :aria-label="`Step ${stop.number}: ${stop.label}, done. Go back to it`"
        @mouseenter="game.playUi('hover')"
        @click="pick(stop.step)"
      >
        <img v-if="thumbUrl(stop.step)" class="stepper-thumb" :src="thumbUrl(stop.step)" alt="" draggable="false" />
        <span v-else class="stepper-number" aria-hidden="true">{{ stop.number }}</span>
        <span class="stepper-label">{{ stop.label }}</span>
      </button>
      <span v-else class="stepper-mark" :aria-current="stop.state === 'current' ? 'step' : undefined">
        <span class="stepper-number" aria-hidden="true">{{ stop.number }}</span>
        <span class="stepper-label">{{ stop.label }}</span>
      </span>
    </li>
  </ol>
</template>

<script setup lang="ts">
/**
 * The setup's progress: every step of this walk in a row, numbered, the one the player is on lit.
 * Steps already done are buttons back to them, showing a thumbnail of what was picked in place of the number;
 * steps ahead are only shown, since Next is how a walk moves on.
 */
import type { PixelSprite } from '../art/types.ts';
import { spriteDataUrl } from '../engine/sprite-cache.ts';
import type { PlayStep, StepperStop } from '../game/play-flow.ts';
import { useGame } from './use-game.ts';

const { stops, thumbs = {} } = defineProps<{ stops: readonly StepperStop[]; thumbs?: Partial<Record<PlayStep, PixelSprite>> }>();
const emit = defineEmits<{ pick: [step: PlayStep] }>();
const game = useGame();

function thumbUrl(step: PlayStep): string | undefined {
  const sprite = thumbs[step];
  return sprite ? spriteDataUrl(sprite) : undefined;
}

function pick(step: PlayStep): void {
  game.playUi('click');
  emit('pick', step);
}
</script>

<style scoped>
.stepper {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: calc(var(--u) * 6);
  text-transform: uppercase;
}

/* A rule between stops, lit once the player has passed it. */
.stepper-stop + .stepper-stop::before {
  content: '';
  display: block;
  flex: none;
  width: calc(var(--u) * 14);
  height: var(--u);
  margin: 0 calc(var(--u) * 3);
  background: var(--ink-line);
}

.stepper-stop.is-done + .stepper-stop::before {
  background: var(--amber);
}

.stepper-stop {
  display: flex;
  align-items: center;
}

.stepper-mark {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 3);
  border: 0;
  padding: var(--u);
  background: none;
  color: var(--bone-dim);
  font: inherit;
  text-transform: inherit;
}

button.stepper-mark {
  cursor: pointer;
  outline: none;
}

.stepper-number {
  --edge: var(--ink-line);
  display: grid;
  place-items: center;
  width: calc(var(--u) * 10);
  height: calc(var(--u) * 10);
  background: var(--ink-raised);
  box-shadow: 0 0 0 var(--u) var(--edge);
  color: var(--bone-dim);
  font-weight: 700;
}

.is-done .stepper-number {
  background: var(--amber);
  box-shadow: 0 0 0 var(--u) var(--amber);
  color: var(--ink);
}

/* The pick itself, framed in amber like a done number, cropped to the middle of its scene. */
.stepper-thumb {
  display: block;
  width: calc(var(--u) * 20);
  height: calc(var(--u) * 14);
  object-fit: cover;
  image-rendering: pixelated;
  box-shadow: 0 0 0 var(--u) var(--amber);
}

button.stepper-mark:focus-visible .stepper-thumb {
  box-shadow: 0 0 0 var(--u) var(--bone);
}

.is-done .stepper-label {
  color: var(--bone);
}

.is-current .stepper-number {
  background: var(--blood);
  box-shadow: 0 0 0 var(--u) var(--blood-bright);
  color: var(--bone);
}

.is-current .stepper-label {
  color: var(--amber);
}

button.stepper-mark:hover .stepper-label,
button.stepper-mark:focus-visible .stepper-label {
  color: var(--amber);
}

button.stepper-mark:focus-visible .stepper-number {
  box-shadow: 0 0 0 var(--u) var(--bone);
}

/* A phone keeps the numbers and drops the words but the current one. */
@media (max-width: 600px) {
  .stepper-stop + .stepper-stop::before {
    width: calc(var(--u) * 6);
  }

  .stepper-stop:not(.is-current) .stepper-label {
    display: none;
  }
}
</style>
