import { describe, expect, it } from 'vitest';
import { HINT_MS, HintTracker, hintText, loadSeenHints, pickHint, resetFirstRunHints, seenHintCount } from '../src/game/first-run-hints.ts';
import type { HintFacts, HintId } from '../src/game/first-run-hints.ts';
import { controlDevice, keyGlyph } from '../src/game/hud-keys.ts';

function memory(): Pick<Storage, 'getItem' | 'setItem'> {
  const data = new Map<string, string>();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
}

const BASE: HintFacts = { level: 1, phase: 'intermission', wave: 0, intermission: 120, hordes: 2, exitOpen: false, free: true, near: null };
const none = new Set<HintId>();

describe('pickHint', () => {
  it('teaches the controls first, at spawn', () => {
    expect(pickHint(BASE, none)).toBe('controls');
  });

  it('says nothing while the player is not free (a card, a menu, down)', () => {
    expect(pickHint({ ...BASE, free: false }, none)).toBeNull();
  });

  it('says Hold E at a shut container and the bowl line at a candy bowl', () => {
    expect(pickHint({ ...BASE, near: 'container' }, none)).toBe('search');
    expect(pickHint({ ...BASE, near: 'bowl' }, none)).toBe('bowl');
  });

  it('warns ten seconds before a horde, ahead of everything else', () => {
    expect(pickHint({ ...BASE, intermission: 10 }, none)).toBe('horde');
    expect(pickHint({ ...BASE, intermission: 11 }, none)).toBe('controls');
    expect(pickHint({ ...BASE, intermission: 0 }, none)).toBe('controls');
    expect(pickHint({ ...BASE, phase: 'wave', intermission: 5 }, none)).toBe('controls');
  });

  it('mentions the van once a horde is down and the van is not yet here', () => {
    const afterOne: HintFacts = { ...BASE, wave: 1 };
    expect(pickHint(afterOne, new Set<HintId>(['controls']))).toBe('van');
    expect(pickHint({ ...afterOne, exitOpen: true }, new Set<HintId>(['controls']))).toBeNull();
  });

  it('never repeats a hint that has been seen', () => {
    const all = new Set<HintId>(['controls', 'search', 'bowl', 'van', 'horde']);
    expect(pickHint({ ...BASE, near: 'bowl', intermission: 5, wave: 1 }, all)).toBeNull();
  });

  it('keeps the bunker to the controls', () => {
    expect(pickHint({ ...BASE, level: 0, near: 'container', intermission: 5 }, none)).toBe('controls');
    expect(pickHint({ ...BASE, level: 0 }, new Set<HintId>(['controls']))).toBeNull();
  });
});

describe('hintText', () => {
  it('speaks keys, touch and pad differently', () => {
    expect(hintText('controls', { hordes: 2 }, { device: 'keys' })).toContain('WASD');
    expect(hintText('controls', { hordes: 2 }, { device: 'touch' })).toContain('thumb');
    expect(hintText('controls', { hordes: 2 }, { device: 'touch' })).not.toContain('WASD');
    expect(hintText('controls', { hordes: 2 }, { device: 'pad' })).toContain('Left stick');
  });

  it('names the search key on keys, the pad button on a pad, and the button on a phone', () => {
    expect(hintText('search', { hordes: 2 }, { device: 'keys' })).toBe('Hold E to search.');
    expect(hintText('search', { hordes: 2 }, { device: 'pad', padId: '054c-0ce6 DualSense' })).toBe('Hold Cross to search.');
    expect(hintText('search', { hordes: 2 }, { device: 'touch' })).toContain('Search button');
  });

  it('says how many hordes the town sends before the van', () => {
    expect(hintText('van', { hordes: 3 }, { device: 'keys' })).toBe('The van comes after 3 hordes.');
  });

  it('puts the ten seconds in the horde line', () => {
    expect(hintText('horde', { hordes: 2 }, { device: 'keys' })).toContain('10 seconds');
  });
});

describe('HintTracker', () => {
  it('shows a hint once, clears it after its time, and does not bring it back', () => {
    const store = memory();
    const tracker = new HintTracker(store);
    const first = tracker.step(BASE, 1000, false);
    expect(first).toMatchObject({ id: 'controls' });
    expect(tracker.step(BASE, 1000 + HINT_MS - 1, true)).toBeNull();
    expect(tracker.step(BASE, 1000 + HINT_MS + 1, true)).toBe('clear');
    expect(tracker.step(BASE, 8000, false)).toBeNull();
  });

  it('remembers across runs and visits through storage', () => {
    const store = memory();
    new HintTracker(store).step(BASE, 0, false);
    expect(loadSeenHints(store).has('controls')).toBe(true);
    expect(new HintTracker(store).step(BASE, 0, false)).toBeNull();
  });

  it('says them all again after Reset hints', () => {
    const store = memory();
    const tracker = new HintTracker(store);
    tracker.step(BASE, 0, false);
    expect(seenHintCount(store)).toBe(1);
    resetFirstRunHints(store);
    expect(seenHintCount(store)).toBe(0);
    expect(tracker.step(BASE, 10_000, false)).toMatchObject({ id: 'controls' });
  });
});

describe('hud-keys', () => {
  it('prints the keyboard letter, the pad button, or nothing on a phone', () => {
    expect(keyGlyph('KeyH', 'keys')).toBe('H');
    expect(keyGlyph('KeyH', 'pad')).toBe('B');
    expect(keyGlyph('KeyG', 'pad')).toBe('RB');
    expect(keyGlyph('KeyH', 'touch')).toBeNull();
  });

  it('reads the device: fingers beat a pad beats keys', () => {
    expect(controlDevice(true, 'gamepad')).toBe('touch');
    expect(controlDevice(false, 'gamepad')).toBe('pad');
    expect(controlDevice(false, 'keyboard')).toBe('keys');
  });
});
