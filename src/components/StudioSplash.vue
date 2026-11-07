<template>
  <section
    class="splash"
    :class="[`is-${phase}`, { 'is-static': reduced }]"
    :style="fades"
    role="img"
    aria-label="Presented by Hall of the Gods, Inc."
  >
    <div class="splash-mark">
      <img class="splash-logo" :src="BRAND_MARK" alt="" />
      <p class="splash-presents">Presented by</p>
      <p class="splash-name">Hall of the Gods, Inc.</p>
    </div>
    <div class="splash-scanlines" aria-hidden="true" />
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { motion } from '../game/motion.ts';
import { BRAND_MARK, splashTimings } from '../game/studio-splash.ts';
import { useGame } from './use-game.ts';

const emit = defineEmits<{ done: [] }>();
const game = useGame();

// Read once: the splash is over long before anyone could reach the Options page.
const reduced = motion.reduced.value;
const timings = splashTimings(reduced);
const fades = { '--fade-in': `${timings.fadeIn}ms`, '--fade-out': `${timings.fadeOut}ms` };
const phase = ref<'in' | 'hold' | 'out'>('in');
const timers = new Set<ReturnType<typeof setTimeout>>();

function after(ms: number, then: () => void): void {
  const timer = setTimeout(() => {
    timers.delete(timer);
    then();
  }, ms);
  timers.add(timer);
}

function clearTimers(): void {
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
}

function fadeOut(): void {
  clearTimers();
  phase.value = 'out';
  after(timings.fadeOut, () => emit('done'));
}

/** A skip is the first gesture the page gets, so it is also what wakes the sound. */
function skip(event: Event): void {
  // Ahead of the game's own listeners: Enter here must not start a run behind the splash.
  event.stopPropagation();
  const leaving = phase.value === 'out';
  if (leaving) return;
  game.greet();
  fadeOut();
}

onMounted(() => {
  window.addEventListener('keydown', skip, { capture: true });
  window.addEventListener('pointerdown', skip, { capture: true });
  after(timings.fadeIn, () => {
    phase.value = 'hold';
  });
  after(timings.fadeIn + timings.hold, fadeOut);
});

onBeforeUnmount(() => {
  clearTimers();
  window.removeEventListener('keydown', skip, { capture: true });
  window.removeEventListener('pointerdown', skip, { capture: true });
});
</script>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #000;
  cursor: pointer;
}

.splash-mark {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  font-family: 'Silkscreen', monospace;
  opacity: 0;
  transform: scale(0.96);
  transition: opacity var(--fade-in) ease-out, transform var(--fade-in) ease-out;
}

.is-hold .splash-mark {
  opacity: 1;
  transform: scale(1);
}

.is-out .splash-mark {
  opacity: 0;
  transform: scale(1.02);
  transition: opacity var(--fade-out) ease-in, transform var(--fade-out) ease-in;
}

.is-static .splash-mark {
  transition: none;
}

.is-static.is-in .splash-mark,
.is-static.is-hold .splash-mark {
  opacity: 1;
  transform: none;
}

.splash-logo {
  display: block;
  width: clamp(9rem, 38vmin, 16rem);
  height: auto;
  filter: drop-shadow(0 0 10px rgba(255, 215, 94, 0.6)) drop-shadow(0 0 28px rgba(224, 160, 32, 0.3));
}

.splash-presents {
  margin: 1.4rem 0 0.2rem;
  font-size: 0.85rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #d9c27a;
  opacity: 0.85;
}

.splash-name {
  font-size: clamp(1.1rem, 4.6vmin, 1.6rem);
  color: #ffd75e;
  text-shadow: 0 0 8px rgba(255, 215, 94, 0.5), 2px 2px 0 #4a3300;
}

.splash-scanlines {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background:
    repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(0, 0, 0, 0.28) 3px, rgba(0, 0, 0, 0.28) 4px),
    radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, 0.65) 100%);
  mix-blend-mode: multiply;
}
</style>
