import { setHitPalette, type PaletteId } from '../engine/hit-palette.ts';
import { readJson, writeJson, type Store } from './storage.ts';

export type { PaletteId } from '../engine/hit-palette.ts';

const DISPLAY_KEY = 'outbreak.display';

export type UiScale = 'normal' | 'large' | 'larger';

/** How much bigger each UI scale draws the HUD and menus. */
export const UI_SCALES: Readonly<Record<UiScale, number>> = { normal: 1, large: 1.25, larger: 1.5 };

export interface DisplayPrefs {
  readonly palette: PaletteId;
  readonly uiScale: UiScale;
}

export const DEFAULT_DISPLAY: DisplayPrefs = { palette: 'classic', uiScale: 'normal' };

const PALETTES: readonly PaletteId[] = ['classic', 'clear'];

function isPalette(v: unknown): v is PaletteId {
  return PALETTES.includes(v as PaletteId);
}

function isUiScale(v: unknown): v is UiScale {
  return typeof v === 'string' && Object.hasOwn(UI_SCALES, v);
}

/** Saved display settings, with anything unreadable falling back to its default. */
export function loadDisplayPrefs(store: Store | null): DisplayPrefs {
  const raw = readJson(store, DISPLAY_KEY) as Partial<Record<keyof DisplayPrefs, unknown>> | null;
  return {
    palette: isPalette(raw?.palette) ? raw.palette : DEFAULT_DISPLAY.palette,
    uiScale: isUiScale(raw?.uiScale) ? raw.uiScale : DEFAULT_DISPLAY.uiScale,
  };
}

export function saveDisplayPrefs(store: Store | null, prefs: DisplayPrefs): void {
  writeJson(store, DISPLAY_KEY, prefs);
}

/** Points the canvas and the CSS tokens at one palette. */
export function applyPalette(palette: PaletteId): void {
  setHitPalette(palette);
  const root = typeof document === 'undefined' ? null : document.documentElement;
  root?.setAttribute?.('data-palette', palette);
}
