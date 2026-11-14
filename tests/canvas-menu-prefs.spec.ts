import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canvasMenus, loadCanvasMenus, saveCanvasMenus, usesCanvasSetup } from '../src/game/canvas-menu-prefs.ts';

describe('canvas menus pref', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    canvasMenus.value = false;
  });

  it('is on until the player turns it off', () => {
    expect(loadCanvasMenus()).toBe(true);
  });

  it('remembers the switch and updates the live ref', () => {
    saveCanvasMenus(true);
    expect(canvasMenus.value).toBe(true);
    expect(loadCanvasMenus()).toBe(true);
    saveCanvasMenus(false);
    expect(canvasMenus.value).toBe(false);
    expect(loadCanvasMenus()).toBe(false);
  });
});

describe('usesCanvasSetup', () => {
  const ready = { pref: true, touch: false, invited: false, artReady: true, hasCanvas: true };

  it('draws on the canvas for a mouse player with the pref on', () => {
    expect(usesCanvasSetup(ready)).toBe(true);
  });

  it.each([
    ['the pref is off', { pref: false }],
    ['the player is on touch', { touch: true }],
    ['an invite landed here', { invited: true }],
    ['the art is not in yet', { artReady: false }],
    ['there is no canvas', { hasCanvas: false }],
  ])('keeps the page when %s', (_why, patch) => {
    expect(usesCanvasSetup({ ...ready, ...patch })).toBe(false);
  });
});
