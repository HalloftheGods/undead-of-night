import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import {
  ACTION_METADATA,
  DEFAULT_KEY_BINDINGS,
  DEFAULT_PAD_BINDINGS,
  formatKeyCode,
  loadKeyBindings,
  loadPadBindings,
  resetKeyBindings,
  resetPadBindings,
  saveKeyBindings,
  savePadBindings,
} from '../src/game/controls-prefs.ts';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe('controls preferences', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads default key and pad bindings initially', () => {
    expect(loadKeyBindings()).toEqual(DEFAULT_KEY_BINDINGS);
    expect(loadPadBindings()).toEqual(DEFAULT_PAD_BINDINGS);
  });

  it('saves and reloads custom key bindings', () => {
    const updated = { ...DEFAULT_KEY_BINDINGS, reload: ['KeyT'], melee: ['KeyE'] };
    saveKeyBindings(updated);
    expect(loadKeyBindings().reload).toEqual(['KeyT']);
    expect(loadKeyBindings().melee).toEqual(['KeyE']);
  });

  it('saves and reloads custom pad bindings', () => {
    const updated = { ...DEFAULT_PAD_BINDINGS, reload: 2, melee: 0 };
    savePadBindings(updated);
    expect(loadPadBindings().reload).toBe(2);
    expect(loadPadBindings().melee).toBe(0);
  });

  it('resets key and pad bindings to defaults', () => {
    saveKeyBindings({ ...DEFAULT_KEY_BINDINGS, reload: ['KeyZ'] });
    savePadBindings({ ...DEFAULT_PAD_BINDINGS, reload: 9 });
    expect(loadKeyBindings().reload).toEqual(['KeyZ']);

    resetKeyBindings();
    resetPadBindings();
    expect(loadKeyBindings().reload).toEqual(DEFAULT_KEY_BINDINGS.reload);
    expect(loadPadBindings().reload).toBe(DEFAULT_PAD_BINDINGS.reload);
  });

  it('formats key codes cleanly', () => {
    expect(formatKeyCode('KeyW')).toBe('W');
    expect(formatKeyCode('Digit1')).toBe('1');
    expect(formatKeyCode('ShiftLeft')).toBe('Shift');
    expect(formatKeyCode('MouseLeft')).toBe('Left Click');
  });

  it('lists the horn as a rebindable action, on Z by default, and round-trips a rebind', () => {
    expect(ACTION_METADATA.some((a) => a.id === 'horn' && a.rebindableKeys && a.rebindablePad)).toBe(true);
    expect(loadKeyBindings().horn).toEqual(['KeyZ']);
    saveKeyBindings({ ...DEFAULT_KEY_BINDINGS, horn: ['KeyB'] });
    savePadBindings({ ...DEFAULT_PAD_BINDINGS, horn: 4 });
    expect(loadKeyBindings().horn).toEqual(['KeyB']);
    expect(loadPadBindings().horn).toBe(4);
  });

  it('gives the horn a pad button nothing else uses', () => {
    const buttons = Object.entries(DEFAULT_PAD_BINDINGS).filter(([, button]) => button === DEFAULT_PAD_BINDINGS.horn);
    expect(buttons).toHaveLength(1);
  });
});
