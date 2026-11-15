import { ref } from 'vue';

const CANVAS_HUD_KEY = 'outbreak_canvas_hud';

/** On until the player switches it off: only a saved "false" turns the canvas HUD off. */
export function loadCanvasHud(): boolean {
  if (typeof localStorage === 'undefined') return true;
  try {
    return localStorage.getItem(CANVAS_HUD_KEY) !== 'false';
  } catch {
    return true;
  }
}

/** Whether the run's HUD is drawn on the game canvas instead of in the page. Live, so the next frame follows the switch. */
export const canvasHud = ref(loadCanvasHud());

/** The canvas HUD is for the mouse and keyboard, and gamepads: a phone keeps the page HUD, whose weapon slots are tap targets. */
export function canvasHudAllowed(enabled: boolean, touch: boolean): boolean {
  return enabled && !touch;
}

export function saveCanvasHud(enabled: boolean): void {
  canvasHud.value = enabled;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CANVAS_HUD_KEY, String(enabled));
  } catch {
    // Ignore storage quota or access errors.
  }
}

const GUN_ON_TOP_KEY = 'outbreak_hud_gun_top';

/** On until the player moves it: only a saved "false" puts the gun box at the bottom. */
export function loadGunOnTop(): boolean {
  if (typeof localStorage === 'undefined') return true;
  try {
    return localStorage.getItem(GUN_ON_TOP_KEY) !== 'false';
  } catch {
    return true;
  }
}

/** Whether the equipped gun's box sits at the top centre (true) or the bottom centre, with the run's info on top. */
export const gunOnTop = ref(loadGunOnTop());

export function saveGunOnTop(enabled: boolean): void {
  gunOnTop.value = enabled;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(GUN_ON_TOP_KEY, String(enabled));
  } catch {
    // Ignore storage quota or access errors.
  }
}
