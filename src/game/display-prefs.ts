import { readonly, ref } from 'vue';
import { setHitPalette, type PaletteId } from '../engine/hit-palette.ts';
import { RESOLUTION_FACTOR, type Resolution } from '../engine/viewport.ts';
import { browserStore, readJson, writeJson, type Store } from './storage.ts';

export type { PaletteId } from '../engine/hit-palette.ts';

const DISPLAY_KEY = 'outbreak.display';

export type { Resolution } from '../engine/viewport.ts';
export type UiScale = 'normal' | 'large' | 'larger';
export type SpeedUnit = 'mph' | 'kmh' | 'pxs';

/** How much bigger each UI scale draws the HUD and menus. */
export const UI_SCALES: Readonly<Record<UiScale, number>> = { normal: 1, large: 1.25, larger: 1.5 };

export interface DisplayPrefs {
  readonly palette: PaletteId;
  readonly uiScale: UiScale;
  readonly autoFadeXp: boolean;
  readonly speedUnit: SpeedUnit;
  readonly resolution: Resolution;
}

export const DEFAULT_DISPLAY: DisplayPrefs = { palette: 'classic', uiScale: 'normal', autoFadeXp: true, speedUnit: 'mph', resolution: 'auto' };

const PALETTES: readonly PaletteId[] = ['classic', 'clear'];
const SPEED_UNITS: readonly SpeedUnit[] = ['mph', 'kmh', 'pxs'];

function isPalette(v: unknown): v is PaletteId {
  return PALETTES.includes(v as PaletteId);
}

function isUiScale(v: unknown): v is UiScale {
  return typeof v === 'string' && Object.hasOwn(UI_SCALES, v);
}

function isResolution(v: unknown): v is Resolution {
  return typeof v === 'string' && Object.hasOwn(RESOLUTION_FACTOR, v);
}

function isSpeedUnit(v: unknown): v is SpeedUnit {
  return SPEED_UNITS.includes(v as SpeedUnit);
}

/** Saved display settings, with anything unreadable falling back to its default. */
export function loadDisplayPrefs(store: Store | null): DisplayPrefs {
  const raw = readJson(store, DISPLAY_KEY) as Partial<Record<keyof DisplayPrefs, unknown>> | null;
  return {
    palette: isPalette(raw?.palette) ? raw.palette : DEFAULT_DISPLAY.palette,
    uiScale: isUiScale(raw?.uiScale) ? raw.uiScale : DEFAULT_DISPLAY.uiScale,
    autoFadeXp: typeof raw?.autoFadeXp === 'boolean' ? raw.autoFadeXp : DEFAULT_DISPLAY.autoFadeXp,
    speedUnit: isSpeedUnit(raw?.speedUnit) ? raw.speedUnit : DEFAULT_DISPLAY.speedUnit,
    resolution: isResolution(raw?.resolution) ? raw.resolution : DEFAULT_DISPLAY.resolution,
  };
}

export function saveDisplayPrefs(store: Store | null, prefs: Partial<DisplayPrefs>): void {
  writeJson(store, DISPLAY_KEY, { ...savedDisplay(store), ...prefs });
}

/** Everything already in `outbreak.display`, so saving one setting never drops another. */
function savedDisplay(store: Store | null): Record<string, unknown> {
  const raw = readJson(store, DISPLAY_KEY);
  const isObject = typeof raw === 'object' && raw !== null && !Array.isArray(raw);
  return isObject ? (raw as Record<string, unknown>) : {};
}

/** Points the canvas and the CSS tokens at one palette. */
export function applyPalette(palette: PaletteId): void {
  setHitPalette(palette);
  const root = typeof document === 'undefined' ? null : document.documentElement;
  root?.setAttribute?.('data-palette', palette);
}

// --- Brightness ------------------------------------------------------------

/** The slider's own scale: 0 is today's look, 1 the most it lifts. */
export const DEFAULT_BRIGHTNESS = 0;
/** How far the top of the slider lifts the lighting layer: about +40%, as the Nov 7 backlog (item 5) asks. */
export const MAX_BRIGHTNESS_LIFT = 0.4;

/** Any number to the slider's 0..1, and anything that is not a number to today's look. */
export function clampBrightness(value: unknown): number {
  const isNumber = typeof value === 'number' && Number.isFinite(value);
  return isNumber ? Math.min(1, Math.max(0, value)) : DEFAULT_BRIGHTNESS;
}

/** The saved slider position, kept in `outbreak.display` beside the palette and UI size. */
export function loadBrightness(store: Store | null): number {
  return clampBrightness(savedDisplay(store).brightness);
}

export function saveBrightness(store: Store | null, value: number): void {
  writeJson(store, DISPLAY_KEY, { ...savedDisplay(store), brightness: clampBrightness(value) });
}

const brightnessLevel = ref(loadBrightness(browserStore()));

/** The slider position, live, for the Options page. */
export const brightness = readonly(brightnessLevel);

/** Moves the slider: takes effect on the next frame and is saved at once. */
export function setBrightness(value: number, store: Store | null = browserStore()): void {
  brightnessLevel.value = clampBrightness(value);
  saveBrightness(store, brightnessLevel.value);
}

/**
 * What the renderer reads, once a frame: how much to lift the lighting layer, from 0 (today's look) up to
 * MAX_BRIGHTNESS_LIFT. A lit pixel at brightness b would draw at about b + (1 - b) * lift, so the darkest
 * corners gain most and the lamps stay as they are.
 */
export function brightnessLift(): number {
  return brightnessLevel.value * MAX_BRIGHTNESS_LIFT;
}
