import { afterEach, describe, expect, it } from 'vitest';
import { canvasHudAllowed, canvasHud, loadCanvasHud, saveCanvasHud } from '../src/game/canvas-hud-prefs.ts';
import { canvasHudView, hotkeyFor } from '../src/game/canvas-hud-view.ts';
import type { UiState } from '../src/game/hud-state.ts';
import { aHud } from './backpack-fixture.ts';

const UI = {
  place: null,
  mode: 'solo',
  signalWeak: false,
  log: [],
  hint: null,
  bite: null,
  home: null,
  speedUnit: 'mph',
  touch: false,
} as unknown as UiState;

function viewOf(hud: ReturnType<typeof aHud>, glyph: (code: string) => string | null = () => null, device: 'keys' | 'pad' = 'keys') {
  return canvasHudView({ ui: UI, hud, device, glyph, padId: null });
}

const saved = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => void saved.set(key, String(value)),
    removeItem: (key: string) => void saved.delete(key),
    clear: () => saved.clear(),
  },
});

afterEach(() => {
  saved.clear();
  saveCanvasHud(true);
});

describe('in-game HUD switch', () => {
  it('is on until the player saves it off', () => {
    saved.clear();
    expect(loadCanvasHud()).toBe(true);
    saveCanvasHud(false);
    expect(canvasHud.value).toBe(false);
    expect(loadCanvasHud()).toBe(false);
  });

  it('never draws on a phone, where the weapon slots are tap targets', () => {
    expect(canvasHudAllowed(true, false)).toBe(true);
    expect(canvasHudAllowed(true, true)).toBe(false);
    expect(canvasHudAllowed(false, false)).toBe(false);
  });
});

describe('hotkeys', () => {
  it('prints a D-pad direction as D with its arrow, and any other label as it is', () => {
    expect(hotkeyFor('D-pad Down')).toEqual({ text: 'D', arrow: 'down' });
    expect(hotkeyFor('D-pad Left')).toEqual({ text: 'D', arrow: 'left' });
    expect(hotkeyFor('Y')).toEqual({ text: 'Y', arrow: null });
    expect(hotkeyFor(null)).toBeNull();
  });
});

describe('canvas HUD view', () => {
  it('reads the same ammo and horde state as the page HUD', () => {
    const view = viewOf(aHud({ ammo: 6, reserve: 24 }));
    expect(view.ammo).toBe('ok');
    expect(view.slots.length).toBeGreaterThan(0);
    expect(view.empty).toBe(false);
  });

  it('gives the D-pad hotkey on a pad, and the key letter on a keyboard, for the items on those keys', () => {
    const glyphs: Record<string, string> = { KeyH: 'D-pad Down', KeyG: 'Y' };
    const pad = viewOf(aHud({ medkits: 1, bottles: 1 }), (code) => glyphs[code] ?? null, 'pad');
    const medkit = pad.items.find((item) => item.icon === 'medkit');
    const bottle = pad.items.find((item) => item.icon === 'bottle');
    expect(medkit?.hotkey).toEqual({ text: 'D', arrow: 'down' });
    expect(bottle?.hotkey).toEqual({ text: 'Y', arrow: null });
  });

  it('always lists the medkit row, and lists the others only while the player carries them', () => {
    const none = viewOf(aHud({ medkits: 0, bottles: 0, fireworks: 0, fountains: 0, candyCount: 0 }));
    expect(none.items.map((item) => item.icon)).toEqual(['medkit']);
    const bottled = viewOf(aHud({ medkits: 2, bottles: 3 }));
    expect(bottled.items.map((item) => item.icon)).toEqual(['medkit', 'bottle']);
  });

  it('shows the shove prompt and no reload key once the magazine and the bag are both empty', () => {
    const none = { pistol: 0, carbine: 0, shotgun: 0 };
    const view = viewOf(aHud({ ammo: 0, reserve: 0, ammoBag: none, mags: none }));
    expect(view.empty).toBe(true);
    expect(view.reloadNeeded).toBe(false);
    expect(view.reloadPromptKey).toBeNull();
    expect(view.shoveLabel).toBe('Shove');
  });

  it('asks for a reload when the magazine is empty and the bag has rounds', () => {
    const view = viewOf(aHud({ ammo: 0, ammoBag: { pistol: 9, carbine: 0, shotgun: 0 } }), (code) => (code === 'KeyR' ? 'R' : null));
    expect(view.reloadNeeded).toBe(true);
    expect(view.reloadPromptKey).toEqual({ text: 'R', arrow: null });
  });

  it('names the knife in the shove prompt when it is carried', () => {
    const view = viewOf(aHud({ ammo: 0, knife: true }));
    expect(view.shoveLabel).toBe('Shove & Stab');
  });
});
