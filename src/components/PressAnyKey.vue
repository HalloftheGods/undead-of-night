<template>
  <p class="press px-blink" role="status">{{ pressPrompt(touch) }}</p>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { isWakingKey, PadPressWatch, pressPrompt } from '../game/press-start.ts';
import { useGame } from './use-game.ts';

const { touch, splashing } = defineProps<{ touch: boolean; splashing: boolean }>();
const emit = defineEmits<{ wake: [] }>();
const game = useGame();
const pads = new PadPressWatch();
const CONTROLS = 'button, a[href], input, select, textarea, summary, [role="button"]';
let frame = 0;
let woken = false;

function wake(): void {
  if (woken) return;
  woken = true;
  game.greet();
  emit('wake');
}

function onControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(CONTROLS) !== null;
}

/**
 * Listens as the page bubbles: the studio splash stops its skip key on the way down, so the key
 * that skips the splash does not also answer this.
 */
function onKey(event: KeyboardEvent): void {
  const answers = isWakingKey(event) && !onControl(event.target);
  if (!answers) return;
  event.preventDefault();
  wake();
}

/** The click that ends this press would land on the menu item that just appeared under it: it is spent here. */
function swallowNextClick(): void {
  const swallow = (event: MouseEvent): void => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
  // A drag or a long press never clicks: the next press lets its own click through.
  const release = (): void => window.removeEventListener('click', swallow, { capture: true });
  window.addEventListener('pointerdown', release, { capture: true, once: true });
}

/** Privacy and the version number still work: a press on them opens them as usual. */
function onPointer(event: PointerEvent): void {
  const pressedLink = onControl(event.target);
  if (pressedLink) return;
  swallowNextClick();
  wake();
}

function readPads(): Gamepad[] {
  try {
    const list = globalThis.navigator?.getGamepads?.() ?? [];
    return Array.from(list).filter((pad): pad is Gamepad => pad !== null && pad.connected);
  } catch {
    return [];
  }
}

/** Pads are read every frame, splash or not, so a button held through the splash stays spent. */
function pollPads(): void {
  const padPressed = pads.pressed(readPads());
  const answers = padPressed && !splashing;
  if (answers) wake();
  frame = requestAnimationFrame(pollPads);
}

onMounted(() => {
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', onPointer);
  frame = requestAnimationFrame(pollPads);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('pointerdown', onPointer);
});
</script>

<style scoped>
.press {
  margin: 0;
  min-height: calc(var(--u) * 24);
  display: flex;
  align-items: center;
  font-size: calc(var(--u) * 11);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--bone);
  text-shadow: 0 calc(var(--u) * 0.75) 0 var(--ink);
  animation: px-blink 1.2s steps(2) infinite;
}
</style>
