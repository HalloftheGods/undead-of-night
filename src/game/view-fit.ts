import { titleUnit, uiUnit, viewReachCap } from '../engine/viewport.ts';
import type { WorldRenderer } from '../engine/world-renderer.ts';

/** A UI unit grown by the player's scale, kept on half pixels so the pixel font stays crisp. */
export function scaledUnit(unit: number, scale: number): number {
  return Math.round(unit * scale * 2) / 2;
}

/** Sizes the overlay and the canvas to the window, as it stands and for the mode being played. */
export function fitWindow(renderer: WorldRenderer | null, coop: boolean, touch: boolean, uiScale = 1): void {
  const { innerWidth: width, innerHeight: height } = window;
  document.documentElement.style.setProperty('--u', `${scaledUnit(uiUnit(width, height), uiScale)}px`);
  document.documentElement.style.setProperty('--title-u', `${scaledUnit(titleUnit(width, height), uiScale)}px`);
  document.documentElement.style.setProperty('--dpx', `${1 / (window.devicePixelRatio || 1)}px`);
  renderer?.resize(viewReachCap(coop, touch, width, height));
}

/**
 * Calls onChange when devicePixelRatio changes without the window resizing (a drag between monitors).
 * Returns a disposer. Relies on matchMedia resolution queries; where they are missing it does nothing.
 */
export function watchDpr(onChange: () => void): () => void {
  let query: MediaQueryList | null = null;
  let stopped = false;
  const arm = (): void => {
    const canWatch = !stopped && typeof window.matchMedia === 'function';
    if (!canWatch) return;
    query = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    query.addEventListener('change', fire, { once: true });
  };
  const fire = (): void => {
    onChange();
    arm();
  };
  arm();
  return () => {
    stopped = true;
    query?.removeEventListener('change', fire);
  };
}
