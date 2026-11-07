<template>
  <div class="motion">
    <p id="motion-label" class="px-label">Motion</p>
    <div class="motion-choices" role="radiogroup" aria-labelledby="motion-label" aria-describedby="motion-note" @keydown="onKey">
      <button
        v-for="(each, index) in MOTION_PREFS"
        :key="each"
        :ref="(el) => setChoice(index, el)"
        class="motion-choice px-frame"
        :class="{ 'is-chosen': each === motion.pref.value }"
        type="button"
        role="radio"
        :aria-checked="each === motion.pref.value"
        :tabindex="tabStop(each)"
        @mouseenter="game.playUi('hover')"
        @click="choose(each)"
      >
        {{ CHOICE_LABELS[each] }}
      </button>
    </div>
    <p id="motion-note" class="motion-note">{{ note }}</p>

    <div class="motion-shake">
      <label class="px-label motion-shake-label" for="motion-shake">
        <span>Screen shake</span>
        <span class="motion-shake-value" aria-hidden="true">{{ shakeShown }}</span>
      </label>
      <input
        id="motion-shake"
        class="px-slider"
        type="range"
        min="0"
        max="100"
        step="5"
        :value="percent"
        :aria-valuetext="shakeShown"
        @input="onShake"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The Motion option: follow the system's reduced-motion switch, or override it either way, plus how hard
 * the screen shakes. Its own component so the Options page can grow around it.
 */
import { computed } from 'vue';
import { rosterStep } from '../game/character-select-view.ts';
import { motion, setMotionPref, setShakeLevel } from '../game/motion.ts';
import { MOTION_PREFS } from '../game/motion-pref.ts';
import type { MotionPref } from '../game/motion-pref.ts';
import { REDUCED_MOTION_SHAKE } from '../engine/screen-effects.ts';
import { useGame } from './use-game.ts';

const CHOICE_LABELS: Readonly<Record<MotionPref, string>> = { system: 'System', full: 'Full', reduced: 'Reduced' };
const REDUCED_CAP_PERCENT = Math.round(REDUCED_MOTION_SHAKE * 100);

const game = useGame();
const choices = new Map<number, HTMLElement>();

const percent = computed(() => Math.round(motion.shake.value * 100));
/** Reduced holds shake to a nudge whatever the slider says, and the label owns up to it. */
const isCapped = computed(() => motion.reduced.value && percent.value > REDUCED_CAP_PERCENT);
const shakeShown = computed(() => {
  const own = `${percent.value}%`;
  return isCapped.value ? `${own}, held to ${REDUCED_CAP_PERCENT}% by reduced motion` : own;
});

const note = computed(() => {
  const pref = motion.pref.value;
  const followsSystem = pref === 'system';
  if (followsSystem) {
    const systemWord = motion.systemReduced.value ? 'reduced' : 'full';
    return `Following your device, which asks for ${systemWord} motion.`;
  }
  const isFull = pref === 'full';
  if (isFull) return 'Everything moves, whatever your device asks for.';
  return 'Calmer screens: fewer flashes, still transitions and only a nudge of shake.';
});

function tabStop(pref: MotionPref): number {
  const isChosen = pref === motion.pref.value;
  return isChosen ? 0 : -1;
}

function setChoice(index: number, el: unknown): void {
  const isElement = el instanceof HTMLElement;
  if (isElement) choices.set(index, el);
}

function choose(pref: MotionPref): void {
  game.playUi('click');
  setMotionPref(pref);
}

/** Arrows move the choice and the focus together, as in any radio group. */
function onKey(event: KeyboardEvent): void {
  const at = MOTION_PREFS.indexOf(motion.pref.value);
  const next = rosterStep(at, event.key, MOTION_PREFS.length);
  const moves = next !== null;
  if (!moves) return;
  event.preventDefault();
  event.stopPropagation();
  choose(MOTION_PREFS[next]);
  choices.get(next)?.focus();
}

function onShake(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);
  setShakeLevel(value / 100);
}
</script>

<style scoped>
.motion {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2);
}

.motion-choices {
  display: flex;
  gap: calc(var(--u) * 3);
}

.motion-choice {
  --edge: var(--ink-line);
  flex: 1;
  min-height: calc(var(--u) * 16);
  border: 0;
  padding: calc(var(--u) * 2) calc(var(--u) * 4);
  background: var(--ink-raised);
  color: var(--bone-dim);
  font: inherit;
  text-transform: uppercase;
  cursor: pointer;
  outline: none;
  touch-action: manipulation;
}

.motion-choice:hover,
.motion-choice:focus-visible {
  --edge: var(--bone-dim);
  color: var(--bone);
}

.motion-choice.is-chosen {
  --edge: var(--amber);
  color: var(--amber);
}

.motion-choice.is-chosen:focus-visible {
  --edge: var(--bone);
}

.motion-note {
  margin: 0;
  color: var(--bone-dim);
}

.motion-shake {
  padding-top: calc(var(--u) * 2);
}

.motion-shake-label {
  display: flex;
  justify-content: space-between;
  gap: calc(var(--u) * 4);
}

.motion-shake-value {
  color: var(--bone);
  text-align: right;
}
</style>
