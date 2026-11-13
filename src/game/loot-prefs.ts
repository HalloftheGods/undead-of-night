import { ref } from 'vue';

const AUTO_CLOSE_EMPTY_KEY = 'outbreak_autoclose_empty_loot';

export function loadAutoCloseEmptyLoot(): boolean {
  if (typeof localStorage === 'undefined') return true;
  try {
    const raw = localStorage.getItem(AUTO_CLOSE_EMPTY_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export function saveAutoCloseEmptyLoot(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(AUTO_CLOSE_EMPTY_KEY, String(enabled));
  } catch {
    // Ignore storage quota or access errors.
  }
}

const CANVAS_LOOT_KEY = 'outbreak_canvas_loot';

export function loadCanvasLoot(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(CANVAS_LOOT_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Whether the loot window is drawn on the game canvas instead of the page. Live, so the next opening follows the switch. */
export const canvasLoot = ref(loadCanvasLoot());

export function saveCanvasLoot(enabled: boolean): void {
  canvasLoot.value = enabled;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CANVAS_LOOT_KEY, String(enabled));
  } catch {
    // Ignore storage quota or access errors.
  }
}
