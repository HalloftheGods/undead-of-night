import { onBeforeUnmount, onMounted, watchEffect } from 'vue';
import type { ComputedRef } from 'vue';
import type { PageModel } from '../engine/page-ui.ts';
import { createCanvasPage } from '../game/canvas-page.ts';
import type { CanvasPage, CanvasPageHost } from '../game/canvas-page.ts';
import { useGame } from './use-game.ts';

type PageActions = Omit<CanvasPageHost, 'playUi' | 'toggle' | 'choose' | 'slide' | 'inert' | 'hidden'> &
  Partial<Pick<CanvasPageHost, 'toggle' | 'choose' | 'slide' | 'inert' | 'hidden'>>;

const NOTHING = (): void => undefined;

/**
 * Draws a title page on the game canvas with the page kit while the calling page is mounted: the model is followed live,
 * and what the page asks for goes to `actions`. `unavailable` runs when there is no canvas to draw on.
 */
export function useCanvasPage(model: ComputedRef<PageModel>, actions: PageActions, unavailable: () => void): void {
  const game = useGame();
  let page: CanvasPage | null = null;

  onMounted(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.game-canvas');
    if (!canvas) {
      unavailable();
      return;
    }
    page = createCanvasPage(canvas, { playUi: (sound) => game.playUi(sound), toggle: NOTHING, choose: NOTHING, slide: NOTHING, ...actions }, model.value);
  });

  // The model is read first, so the effect tracks it even before the page exists.
  watchEffect(() => {
    const next = model.value;
    page?.update(next);
  });
  onBeforeUnmount(() => page?.dispose());
}
