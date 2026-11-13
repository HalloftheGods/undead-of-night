// Cycles the title logo's blood frames slowly, forever. Reduced motion holds the still logo.
import { onScopeDispose, ref, watchEffect } from 'vue';
import { motion } from '../game/motion.ts';

/** Frames per second: slow enough to read as a drip creeping, not a flicker. */
export const LOGO_FPS = 2;

export function useLogoLoop(count: number) {
  const frame = ref(0);
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = (): void => {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
  };

  watchEffect(() => {
    stop();
    if (motion.reduced.value) {
      frame.value = 0;
      return;
    }
    timer = setInterval(() => {
      frame.value = (frame.value + 1) % count;
    }, 1000 / LOGO_FPS);
  });
  onScopeDispose(stop);

  return { frame };
}
