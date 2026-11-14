import { computed, ref } from 'vue';
import type { ComputedRef } from 'vue';
import type { ChoiceOption, PagePanel } from '../engine/page-ui.ts';
import { consent, openPrivacy } from '../game/analytics/index.ts';
import { canvasMenus, saveCanvasMenus } from '../game/canvas-menu-prefs.ts';
import { brightness, brightnessLift, setBrightness } from '../game/display-prefs.ts';
import type { PaletteId, Resolution, SpeedUnit, UiScale } from '../game/display-prefs.ts';
import type { UiState } from '../game/hud-state.ts';
import { canvasLoot, loadAutoCloseEmptyLoot, saveAutoCloseEmptyLoot, saveCanvasLoot } from '../game/loot-prefs.ts';
import { loadMenuInfo, saveMenuInfo } from '../game/menu-info-pref.ts';
import { motion, setMotionPref, setShakeLevel } from '../game/motion.ts';
import { MOTION_PREFS } from '../game/motion-pref.ts';
import type { MotionPref } from '../game/motion-pref.ts';
import { useGame } from './use-game.ts';

/** Which Options screen. */
export type OptionsKind = 'gameplay' | 'display' | 'audio';

const HEADINGS: Readonly<Record<OptionsKind, string>> = { gameplay: 'Gameplay', display: 'Video', audio: 'Audio' };
const PALETTES: readonly ChoiceOption[] = [{ id: 'classic', label: 'Classic' }, { id: 'clear', label: 'Colorblind' }];
const PALETTE_NOTES: Readonly<Record<PaletteId, string>> = {
  classic: 'Red for danger, green for health.',
  clear: 'Magenta for danger, blue for health. Easier to tell apart with red-green colorblindness.',
};
const SCALES: readonly ChoiceOption[] = [{ id: 'normal', label: 'Normal' }, { id: 'large', label: 'Large' }, { id: 'larger', label: 'Larger' }];
const RESOLUTIONS: readonly ChoiceOption[] = [{ id: 'low', label: 'Low' }, { id: 'auto', label: 'Auto' }, { id: 'high', label: 'High' }, { id: 'ultra', label: 'Ultra' }];
const RESOLUTION_NOTES: Readonly<Record<Resolution, string>> = {
  low: 'Chunkier pixels and a closer view. Easiest on a weak device.',
  auto: 'Fits the window.',
  high: 'Finer pixels and more of the world in view. In co-op the view stops at the shared reach.',
  ultra: 'The finest pixels. In co-op the view stops at the shared reach.',
};
const SPEEDS: readonly ChoiceOption[] = [{ id: 'mph', label: 'MPH' }, { id: 'kmh', label: 'KM/H' }, { id: 'pxs', label: 'PX/S' }];
const MOTION_LABELS: Readonly<Record<MotionPref, string>> = { system: 'System', full: 'Full', reduced: 'Reduced' };
const MOTIONS: readonly ChoiceOption[] = MOTION_PREFS.map((id) => ({ id, label: MOTION_LABELS[id] }));

const percent = (value: number): string => `${Math.round(value * 100)}%`;

/** The Options screens as page-kit panels, and what a switch, a choice, a slider or a link in them does. */
export function useOptionsPanels(getUi: () => UiState, kind: OptionsKind) {
  const game = useGame();
  /** Read afresh each time: the game publishes a new state object on every change, so one held from the start goes stale. */
  const ui = (): UiState => getUi();
  const autoCloseLoot = ref(loadAutoCloseEmptyLoot());
  const menuInfo = ref(loadMenuInfo());
  const analyticsOn = computed(() => consent.allowed());
  const analyticsNote = computed(() =>
    consent.optedOut
      ? 'Your browser sends Global Privacy Control, so analytics stays off.'
      : 'Play stats go to Google Analytics, which also receives your IP address and cookies. Turn it off any time.'
  );

  const display = computed<PagePanel>(() => ({
    heading: 'Video',
    items: [
      { kind: 'slider', id: 'brightness', label: 'Brightness', value: brightness.value, readout: brightnessLift() === 0 ? 'Normal' : `+${Math.round(brightnessLift() * 100)}%` },
      { kind: 'choice', id: 'resolution', label: 'Resolution', options: RESOLUTIONS, value: ui().resolution },
      { kind: 'text', text: RESOLUTION_NOTES[ui().resolution], tone: 'dim' },
      { kind: 'choice', id: 'palette', label: 'Hit colors', options: PALETTES, value: ui().palette },
      { kind: 'text', text: PALETTE_NOTES[ui().palette], tone: 'dim' },
      { kind: 'choice', id: 'scale', label: 'UI size', options: SCALES, value: ui().uiScale },
      { kind: 'choice', id: 'speed', label: 'Speed unit', options: SPEEDS, value: ui().speedUnit },
      { kind: 'text', text: 'Unit for vehicle speedometer readouts.', tone: 'dim' },
    ],
  }));

  const comfort = computed<PagePanel>(() => ({
    heading: 'Comfort',
    items: [
      { kind: 'choice', id: 'motion', label: 'Motion', options: MOTIONS, value: motion.pref.value },
      { kind: 'slider', id: 'shake', label: 'Screen shake', value: motion.shake.value, readout: percent(motion.shake.value) },
      { kind: 'switch', id: 'menuinfo', label: 'Menu details', on: menuInfo.value, enabled: true },
      { kind: 'text', text: 'A line under each main menu item saying what it opens.', tone: 'dim' },
    ],
  }));

  const gameplay = computed<PagePanel>(() => ({
    heading: 'Gameplay',
    items: [
      { kind: 'switch', id: 'xp', label: 'Auto-fade XP bar', on: ui().autoFadeXp, enabled: true },
      { kind: 'text', text: 'Fades the survivor XP bar when inactive, or keeps it always visible.', tone: 'dim' },
      { kind: 'switch', id: 'autoclose', label: 'Auto-close empty loot', on: autoCloseLoot.value, enabled: true },
      { kind: 'text', text: 'Automatically closes the loot screen when the last item is taken from a container.', tone: 'dim' },
      { kind: 'switch', id: 'canvasloot', label: 'In-game loot window', on: canvasLoot.value, enabled: true },
      { kind: 'text', text: 'Draws the loot grids on the game itself, over a dimmed world. Mouse only for now: phones and gamepads keep the page version.', tone: 'dim' },
      { kind: 'switch', id: 'canvasmenus', label: 'In-game menus', on: canvasMenus.value, enabled: true },
      { kind: 'text', text: 'Draws the title menus on the game itself instead of a page. Mouse and keyboard only for now: phones and gamepads keep the page version.', tone: 'dim' },
    ],
  }));

  const privacy = computed<PagePanel>(() => ({
    heading: 'Privacy',
    items: [
      { kind: 'switch', id: 'analytics', label: 'Analytics', on: analyticsOn.value, enabled: !consent.optedOut },
      { kind: 'text', text: analyticsNote.value, tone: 'dim' },
      { kind: 'link', id: 'privacy', label: 'Privacy' },
    ],
  }));

  const volume = computed<PagePanel>(() => ({
    heading: 'Volume',
    items: [
      { kind: 'slider', id: 'volume', label: 'Master volume', value: ui().volume, readout: ui().muted ? 'Muted' : percent(ui().volume) },
      { kind: 'link', id: 'mute', label: ui().muted ? 'Unmute' : 'Mute' },
      { kind: 'slider', id: 'music', label: 'Music volume', value: ui().musicVolume, readout: percent(ui().musicVolume) },
      { kind: 'slider', id: 'sfx', label: 'Effects volume', value: ui().sfxVolume, readout: percent(ui().sfxVolume) },
    ],
  }));

  const panels: ComputedRef<readonly PagePanel[]> = computed(() => {
    const byKind: Record<OptionsKind, readonly PagePanel[]> = {
      display: [display.value, comfort.value],
      audio: [volume.value],
      gameplay: [gameplay.value, privacy.value],
    };
    return byKind[kind];
  });

  const switches: Readonly<Record<string, (on: boolean) => void>> = {
    autoclose: (on) => {
      autoCloseLoot.value = on;
      saveAutoCloseEmptyLoot(on);
    },
    canvasloot: saveCanvasLoot,
    canvasmenus: saveCanvasMenus,
    analytics: (on) => (on ? consent.grant() : consent.deny()),
    xp: (on) => game.setAutoFadeXp(on),
    menuinfo: (on) => {
      menuInfo.value = on;
      saveMenuInfo(on);
    },
  };
  const current: Readonly<Record<string, () => boolean>> = {
    autoclose: () => autoCloseLoot.value,
    canvasloot: () => canvasLoot.value,
    canvasmenus: () => canvasMenus.value,
    analytics: () => analyticsOn.value,
    xp: () => ui().autoFadeXp,
    menuinfo: () => menuInfo.value,
  };
  const choices: Readonly<Record<string, (option: string) => void>> = {
    palette: (option) => game.setPalette(option as PaletteId),
    scale: (option) => game.setUiScale(option as UiScale),
    resolution: (option) => game.setResolution(option as Resolution),
    speed: (option) => game.setSpeedUnit(option as SpeedUnit),
    motion: (option) => setMotionPref(option as MotionPref),
  };
  const sliders: Readonly<Record<string, (value: number) => void>> = {
    brightness: (value) => setBrightness(value),
    shake: setShakeLevel,
    volume: (value) => game.setVolume(value),
    music: (value) => game.setMusicVolume(value),
    sfx: (value) => game.setSfxVolume(value),
  };

  return {
    heading: HEADINGS[kind],
    panels,
    toggle: (id: string): void => switches[id]?.(!current[id]?.()),
    choose: (id: string, option: string): void => choices[id]?.(option),
    slide: (id: string, value: number): void => sliders[id]?.(value),
    link: (id: string): void => {
      if (id === 'privacy') openPrivacy();
      if (id === 'mute') game.toggleMute();
    },
  };
}
