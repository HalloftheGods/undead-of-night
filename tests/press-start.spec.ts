import { afterEach, describe, expect, it } from 'vitest';
import type { KeyPress } from '../src/game/press-start.ts';
import { isWakingKey, markPressAnswered, PadPressWatch, pressPrompt, resetPressAnswered, shouldAskForPress } from '../src/game/press-start.ts';

const key = (code: string, extra: Partial<KeyPress> = {}): KeyPress => ({
  code,
  repeat: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...extra,
});

const pad = (index: number, down: boolean[]) => ({ index, buttons: down.map((pressed) => ({ pressed })) });

describe('press any key', () => {
  afterEach(() => resetPressAnswered());

  it('asks on a plain visit, once a page load', () => {
    expect(shouldAskForPress('')).toBe(true);
    expect(shouldAskForPress('?seed=4')).toBe(true);
    markPressAnswered();
    expect(shouldAskForPress('')).toBe(false);
  });

  it('lets invite links and no-splash links straight through', () => {
    expect(shouldAskForPress('?room=BCDFG')).toBe(false);
    expect(shouldAskForPress('?join=10.0.0.5:9000')).toBe(false);
    expect(shouldAskForPress('?nosplash')).toBe(false);
  });

  it('counts a fresh key, not a held one, a modifier, Tab or a shortcut', () => {
    expect(isWakingKey(key('Enter'))).toBe(true);
    expect(isWakingKey(key('KeyW'))).toBe(true);
    expect(isWakingKey(key('Space'))).toBe(true);
    expect(isWakingKey(key('Enter', { repeat: true }))).toBe(false);
    expect(isWakingKey(key('ShiftLeft'))).toBe(false);
    expect(isWakingKey(key('Tab'))).toBe(false);
    expect(isWakingKey(key('KeyR', { ctrlKey: true }))).toBe(false);
    expect(isWakingKey(key('KeyR', { metaKey: true }))).toBe(false);
  });

  it('says tap on a phone', () => {
    expect(pressPrompt(false)).toBe('Press any key');
    expect(pressPrompt(true)).toBe('Tap to start');
  });

  it('counts a pad button going down, not one already held', () => {
    const watch = new PadPressWatch();
    expect(watch.pressed([pad(0, [true, false])])).toBe(false);
    expect(watch.pressed([pad(0, [true, false])])).toBe(false);
    expect(watch.pressed([pad(0, [false, false])])).toBe(false);
    expect(watch.pressed([pad(0, [false, true])])).toBe(true);
    expect(watch.pressed([pad(0, [false, true])])).toBe(false);
  });
});
