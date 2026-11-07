import { describe, expect, it } from 'vitest';
import { REDUCED_MOTION_SHAKE, shakeScaleFor } from '../src/engine/screen-effects.ts';
import {
  clampShakeLevel,
  DEFAULT_MOTION_PREF,
  DEFAULT_SHAKE_LEVEL,
  loadMotionPref,
  loadShakeLevel,
  resolveMotion,
  saveMotionPref,
  saveShakeLevel,
} from '../src/game/motion-pref.ts';

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
}

const brokenStore = {
  getItem: (): string | null => {
    throw new Error('blocked');
  },
  setItem: (): void => {
    throw new Error('blocked');
  },
};

describe('motion preference', () => {
  it('follows the system by default', () => {
    expect(DEFAULT_MOTION_PREF).toBe('system');
    expect(loadMotionPref(memoryStore())).toBe('system');
    expect(resolveMotion('system', true)).toBe('reduced');
    expect(resolveMotion('system', false)).toBe('full');
  });

  it('lets Full and Reduced override the system either way', () => {
    expect(resolveMotion('full', true)).toBe('full');
    expect(resolveMotion('full', false)).toBe('full');
    expect(resolveMotion('reduced', false)).toBe('reduced');
    expect(resolveMotion('reduced', true)).toBe('reduced');
  });

  it('remembers a choice', () => {
    const store = memoryStore();
    saveMotionPref('full', store);
    expect(loadMotionPref(store)).toBe('full');
    saveMotionPref('reduced', store);
    expect(loadMotionPref(store)).toBe('reduced');
  });

  it('ignores a saved value it does not know, a missing store and one that throws', () => {
    expect(loadMotionPref(memoryStore({ 'outbreak.motion': 'wobbly' }))).toBe('system');
    expect(loadMotionPref(null)).toBe('system');
    expect(loadMotionPref(brokenStore)).toBe('system');
    expect(() => saveMotionPref('full', brokenStore)).not.toThrow();
  });
});

describe('screen shake level', () => {
  it('starts at full strength', () => {
    expect(DEFAULT_SHAKE_LEVEL).toBe(1);
    expect(loadShakeLevel(memoryStore())).toBe(1);
  });

  it('remembers the slider, kept within 0..1', () => {
    const store = memoryStore();
    saveShakeLevel(0.35, store);
    expect(loadShakeLevel(store)).toBe(0.35);
    saveShakeLevel(0, store);
    expect(loadShakeLevel(store)).toBe(0);
    saveShakeLevel(4, store);
    expect(loadShakeLevel(store)).toBe(1);
  });

  it('falls back to full on junk, and survives a store that throws', () => {
    expect(loadShakeLevel(memoryStore({ 'outbreak.shake': 'lots' }))).toBe(1);
    expect(loadShakeLevel(memoryStore({ 'outbreak.shake': '' }))).toBe(1);
    expect(loadShakeLevel(memoryStore({ 'outbreak.shake': '-3' }))).toBe(0);
    expect(loadShakeLevel(brokenStore)).toBe(1);
    expect(() => saveShakeLevel(0.5, brokenStore)).not.toThrow();
    expect(clampShakeLevel(Number.NaN)).toBe(1);
  });

  it("scales the shake by the slider, and Reduced caps it at today's nudge", () => {
    expect(shakeScaleFor(false, 1)).toBe(1);
    expect(shakeScaleFor(false, 0.5)).toBe(0.5);
    expect(shakeScaleFor(false, 0)).toBe(0);
    expect(shakeScaleFor(true, 1)).toBe(REDUCED_MOTION_SHAKE);
    expect(shakeScaleFor(true, 0.1)).toBe(0.1);
    expect(shakeScaleFor(true, 0)).toBe(0);
  });
});
