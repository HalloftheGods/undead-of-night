import { afterEach, describe, expect, it } from 'vitest';
import {
  brightness,
  brightnessLift,
  clampBrightness,
  DEFAULT_BRIGHTNESS,
  loadBrightness,
  loadDisplayPrefs,
  MAX_BRIGHTNESS_LIFT,
  saveBrightness,
  saveDisplayPrefs,
  setBrightness,
} from '../src/game/display-prefs.ts';
import type { Store } from '../src/game/storage.ts';

function memoryStore(): Store {
  const items = new Map<string, string>();
  return { getItem: (k) => items.get(k) ?? null, setItem: (k, v) => void items.set(k, v) };
}

describe('brightness pref', () => {
  afterEach(() => setBrightness(DEFAULT_BRIGHTNESS, null));

  it('defaults to the night as drawn', () => {
    expect(DEFAULT_BRIGHTNESS).toBe(0);
    expect(loadBrightness(memoryStore())).toBe(0);
    expect(loadBrightness(null)).toBe(0);
  });

  it('persists in outbreak.display beside the palette and UI size, and neither save drops the other', () => {
    const store = memoryStore();
    saveDisplayPrefs(store, { palette: 'clear', uiScale: 'large' });
    saveBrightness(store, 0.6);
    saveDisplayPrefs(store, { palette: 'classic', uiScale: 'larger' });
    expect(loadBrightness(store)).toBe(0.6);
    expect(loadDisplayPrefs(store)).toEqual({ palette: 'classic', uiScale: 'larger' });
    expect(JSON.parse(store.getItem('outbreak.display') ?? '{}')).toEqual({ palette: 'classic', uiScale: 'larger', brightness: 0.6 });
  });

  it('clamps anything odd back into range', () => {
    expect(clampBrightness(2)).toBe(1);
    expect(clampBrightness(-1)).toBe(0);
    expect(clampBrightness('bright')).toBe(0);
    expect(clampBrightness(Number.NaN)).toBe(0);
    const store = memoryStore();
    store.setItem('outbreak.display', JSON.stringify({ brightness: 9 }));
    expect(loadBrightness(store)).toBe(1);
  });

  it('gives the renderer a lift from 0 up to about +40%, live as the slider moves', () => {
    const store = memoryStore();
    expect(brightnessLift()).toBe(0);
    setBrightness(1, store);
    expect(brightness.value).toBe(1);
    expect(brightnessLift()).toBeCloseTo(MAX_BRIGHTNESS_LIFT);
    expect(MAX_BRIGHTNESS_LIFT).toBeCloseTo(0.4);
    setBrightness(0.5, store);
    expect(brightnessLift()).toBeCloseTo(0.2);
    expect(loadBrightness(store)).toBe(0.5);
  });
});
