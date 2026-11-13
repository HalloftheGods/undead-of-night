import { ref } from 'vue';

const CANVAS_MENUS_KEY = 'outbreak_canvas_menus';

export function loadCanvasMenus(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(CANVAS_MENUS_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Whether the title's menu pages are drawn on the game canvas instead of the page. Live, so the next opening follows the switch. */
export const canvasMenus = ref(loadCanvasMenus());

export function saveCanvasMenus(enabled: boolean): void {
  canvasMenus.value = enabled;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CANVAS_MENUS_KEY, String(enabled));
  } catch {
    // Ignore storage quota or access errors.
  }
}

export interface CanvasSetupGate {
  readonly pref: boolean;
  readonly touch: boolean;
  /** An invite link lands on co-op setup, which the page keeps. */
  readonly invited: boolean;
  readonly artReady: boolean;
  readonly hasCanvas: boolean;
}

/**
 * Whether the Play setup opens drawn on the canvas. Decided once when it opens: the mouse and keyboard players who
 * switched it on, with the art in. A phone, an invite link and a missing canvas keep the page version.
 */
export function usesCanvasSetup(gate: CanvasSetupGate): boolean {
  return gate.pref && !gate.touch && !gate.invited && gate.artReady && gate.hasCanvas;
}
