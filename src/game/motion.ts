// The one place the game asks how much motion to show. Everything that used to read prefers-reduced-motion
// itself reads `motion` instead, so the Options page can override the system either way, live.
import { computed, readonly, ref, watchEffect } from 'vue';
import type { WatchStopHandle } from 'vue';
import { clampShakeLevel, loadMotionPref, loadShakeLevel, resolveMotion, saveMotionPref, saveShakeLevel } from './motion-pref.ts';
import type { MotionLevel, MotionPref } from './motion-pref.ts';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

function systemQuery(): MediaQueryList | null {
  const hasMatchMedia = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  return hasMatchMedia ? window.matchMedia(REDUCED_QUERY) : null;
}

const query = systemQuery();
const pref = ref<MotionPref>(loadMotionPref());
const shake = ref(loadShakeLevel());
const systemReduced = ref(query?.matches ?? false);

// The game lives as long as the page, so this listener does too.
query?.addEventListener('change', (event) => {
  systemReduced.value = event.matches;
});

const level = computed((): MotionLevel => resolveMotion(pref.value, systemReduced.value));

export const motion = {
  /** What the player picked. */
  pref: readonly(pref),
  /** Screen shake strength the player picked, 0..1, before Reduced caps it. */
  shake: readonly(shake),
  /** What the system asks for, for the System option's hint. */
  systemReduced: readonly(systemReduced),
  /** What the game does now. */
  level,
  reduced: computed(() => level.value === 'reduced'),
};

export function setMotionPref(next: MotionPref): void {
  pref.value = next;
  saveMotionPref(next);
}

export function setShakeLevel(next: number): void {
  shake.value = clampShakeLevel(next);
  saveShakeLevel(shake.value);
}

/** Mirrors the level onto <html data-motion>, which the stylesheets key their animation rules on. */
export function mirrorMotionToRoot(root: HTMLElement = document.documentElement): WatchStopHandle {
  return watchEffect(() => {
    root.dataset.motion = level.value;
  });
}
