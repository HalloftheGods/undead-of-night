import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cycleWeapon, InputManager } from '../src/game/input-manager.ts';
import { installFakeBrowser } from './client-fake-dom.ts';
import type { FakeBrowser } from './client-fake-dom.ts';

const noop = { onGesture() {}, onPause() {}, onMute() {}, onConfirm() {}, onMap: () => false, mapUsable: () => false };

function key(code: string, extra: object = {}) {
  return { code, repeat: false, target: null, preventDefault: vi.fn(), ...extra };
}

describe('cycleWeapon', () => {
  const loadout = { owned: ['pistol', 'shotgun'] as const, weapon: 'pistol' as const };

  it('steps through owned weapons only', () => {
    expect(cycleWeapon(loadout, 1)).toBe('shotgun');
  });

  it('wraps in both directions', () => {
    expect(cycleWeapon({ ...loadout, weapon: 'shotgun' }, 1)).toBe('pistol');
    expect(cycleWeapon(loadout, -1)).toBe('shotgun');
  });

  it('does nothing with one gun or no step', () => {
    expect(cycleWeapon({ owned: ['pistol'], weapon: 'pistol' }, 1)).toBeNull();
    expect(cycleWeapon(loadout, 0)).toBeNull();
  });
});

describe('InputManager', () => {
  let browser: FakeBrowser;
  let input: InputManager;

  beforeEach(() => {
    browser = installFakeBrowser();
    input = new InputManager(noop);
    input.setEnabled(true);
  });

  afterEach(() => {
    input.dispose();
    vi.unstubAllGlobals();
  });

  it('sends the horn while the horn key is held, and not otherwise', () => {
    expect(input.sample(1, 0, null).horn).toBeUndefined();
    browser.dispatch('keydown', key('Space'));
    expect(input.sample(2, 0, null).horn).toBe(true);
    browser.dispatch('keyup', key('Space'));
    expect(input.sample(3, 0, null).horn).toBeUndefined();
  });

  it('reads held keys as a direction, with opposites cancelling', () => {
    browser.dispatch('keydown', key('KeyD'));
    browser.dispatch('keydown', key('ArrowUp'));
    expect([input.dirX, input.dirY]).toEqual([1, -1]);
    browser.dispatch('keydown', key('KeyA'));
    expect(input.dirX).toBe(0);
    browser.dispatch('keyup', key('KeyD'));
    expect(input.dirX).toBe(-1);
  });

  it('asks for the pause on Escape and on P, once per press, and not for a P typed into a field', () => {
    const onPause = vi.fn();
    input.dispose();
    input = new InputManager({ ...noop, onPause });
    input.setEnabled(true);
    browser.dispatch('keydown', key('Escape'));
    browser.dispatch('keydown', key('KeyP'));
    browser.dispatch('keydown', key('KeyP', { repeat: true }));
    expect(onPause).toHaveBeenCalledTimes(2);
    const field = new (globalThis as { HTMLInputElement: new () => object }).HTMLInputElement();
    browser.dispatch('keydown', key('KeyP', { target: field }));
    expect(onPause).toHaveBeenCalledTimes(2);
  });

  it('moves right while D is held, also with input back on after a pause', () => {
    browser.dispatch('keydown', key('KeyD'));
    expect(input.dirX).toBe(1);
    input.setEnabled(false);
    expect(input.dirX).toBe(0);
    input.setEnabled(true);
    expect(input.dirX).toBe(1);
    browser.dispatch('keyup', key('KeyD'));
    expect(input.dirX).toBe(0);
  });

  it('latches a reload until sampled, then only once', () => {
    browser.dispatch('keydown', key('KeyR'));
    browser.dispatch('keyup', key('KeyR'));
    expect(input.sample(1, 0, null).reload).toBe(true);
    expect(input.sample(2, 0, null).reload).toBe(false);
  });

  it('latches a weapon request until sampled', () => {
    browser.dispatch('keydown', key('Digit3'));
    browser.dispatch('keyup', key('Digit3'));
    expect(input.sample(1, 0, null).weapon).toBe('shotgun');
    expect(input.sample(2, 0, null).weapon).toBeNull();
  });

  it('resolves Q against the player loadout', () => {
    browser.dispatch('keydown', key('KeyQ'));
    const packet = input.sample(1, 0, { owned: ['pistol', 'carbine'], weapon: 'pistol' });
    expect(packet.weapon).toBe('carbine');
  });

  it('does not fire a latch twice for key repeat', () => {
    browser.dispatch('keydown', key('KeyQ'));
    browser.dispatch('keydown', key('KeyQ', { repeat: true }));
    const packet = input.sample(1, 0, { owned: ['pistol', 'carbine', 'shotgun'], weapon: 'pistol' });
    expect(packet.weapon).toBe('carbine');
  });

  it('fires while the left button is held', () => {
    browser.dispatch('mousedown', { button: 0, clientX: 5, clientY: 6 });
    expect(input.sample(1, 0, null).shoot).toBe(true);
    browser.dispatch('mouseup', { button: 0 });
    expect(input.sample(2, 0, null).shoot).toBe(false);
  });

  it('does not lose a click that ends between ticks', () => {
    browser.dispatch('mousedown', { button: 0, clientX: 0, clientY: 0 });
    browser.dispatch('mouseup', { button: 0 });
    expect(input.sample(1, 0, null).shoot).toBe(true);
    expect(input.sample(2, 0, null).shoot).toBe(false);
  });

  it('does not save up a click made behind a menu', () => {
    input.setEnabled(false);
    browser.dispatch('mousedown', { button: 0, clientX: 0, clientY: 0 });
    browser.dispatch('mouseup', { button: 0 });
    input.setEnabled(true);
    expect(input.sample(1, 0, null).shoot).toBe(false);
  });

  it('shoves on F, and keeps shoving while it is held', () => {
    browser.dispatch('keydown', key('KeyF'));
    expect(input.sample(1, 0, null).melee).toBe(true);
    expect(input.sample(2, 0, null).melee).toBe(true);
    browser.dispatch('keyup', key('KeyF'));
    expect(input.sample(3, 0, null).melee).toBe(false);
  });

  it('does not lose a tap of F that ends between ticks', () => {
    browser.dispatch('keydown', key('KeyF'));
    browser.dispatch('keyup', key('KeyF'));
    expect(input.sample(1, 0, null).melee).toBe(true);
    expect(input.sample(2, 0, null).melee).toBe(false);
  });

  it('shoves on the right button without firing', () => {
    browser.dispatch('mousedown', { button: 2, clientX: 0, clientY: 0 });
    const packet = input.sample(1, 0, null);
    expect(packet.melee).toBe(true);
    expect(packet.shoot).toBe(false);
    browser.dispatch('mouseup', { button: 2 });
    expect(input.sample(2, 0, null).melee).toBe(false);
  });

  it('asks for one medkit per press of H, however long it is held', () => {
    browser.dispatch('keydown', key('KeyH'));
    browser.dispatch('keydown', key('KeyH', { repeat: true }));
    expect(input.sample(1, 0, null).heal).toBe(true);
    expect(input.sample(2, 0, null).heal).toBe(false);
  });

  it.each(['Tab', 'KeyN'])('offers %s to the map, and keeps Tab from moving focus only if it was taken', (code) => {
    const onMap = vi.fn(() => true);
    const mapped = new InputManager({ ...noop, onMap });
    const taken = key(code);
    browser.dispatch('keydown', taken);
    expect(onMap).toHaveBeenCalledTimes(1);
    expect(taken.preventDefault).toHaveBeenCalled();
    mapped.dispose();

    const ignored = key(code);
    browser.dispatch('keydown', ignored);
    expect(ignored.preventDefault).not.toHaveBeenCalled();
  });

  it('offers X to the candy bag, with the game keys on or off, and sends the candy picked there', () => {
    const onBag = vi.fn(() => true);
    const bagged = new InputManager({ ...noop, onBag });
    bagged.setEnabled(true);
    const opened = key('KeyX');
    browser.dispatch('keydown', opened);
    expect(onBag).toHaveBeenCalledTimes(1);
    expect(opened.preventDefault).toHaveBeenCalled();
    expect(bagged.sample(1, 0, null).eat).toBeUndefined();
    bagged.setEnabled(false);
    browser.dispatch('keydown', key('KeyX'));
    expect(onBag).toHaveBeenCalledTimes(2);
    browser.dispatch('keydown', key('KeyX', { repeat: true }));
    expect(onBag).toHaveBeenCalledTimes(2);
    bagged.pickCandy('ghost_gum');
    expect(bagged.sample(2, 0, null).eat).toBe('ghost_gum');
    expect(bagged.sample(3, 0, null).eat).toBeUndefined();
    bagged.dispose();
  });

  it('still closes the map with the game keys turned off', () => {
    const onMap = vi.fn(() => true);
    const mapped = new InputManager({ ...noop, onMap });
    mapped.setEnabled(false);
    browser.dispatch('keydown', key('Tab'));
    expect(onMap).toHaveBeenCalled();
    mapped.dispose();
  });

  it('does not toggle the map again on key repeat', () => {
    const onMap = vi.fn(() => true);
    const mapped = new InputManager({ ...noop, onMap });
    browser.dispatch('keydown', key('KeyN', { repeat: true }));
    expect(onMap).not.toHaveBeenCalled();
    mapped.dispose();
  });

  it('keeps a repeating Tab from the browser while the map is open or could be', () => {
    const onMap = vi.fn(() => true);
    const mapped = new InputManager({ ...noop, onMap, mapUsable: () => true });
    mapped.setEnabled(false);
    const repeat = key('Tab', { repeat: true });
    browser.dispatch('keydown', repeat);
    expect(repeat.preventDefault).toHaveBeenCalled();
    expect(onMap).not.toHaveBeenCalled();
    mapped.dispose();
  });

  it('leaves a repeating Tab alone once the map is out of reach', () => {
    const repeat = key('Tab', { repeat: true });
    browser.dispatch('keydown', repeat);
    expect(repeat.preventDefault).not.toHaveBeenCalled();
  });

  it('picks a held key back up when a menu closes', () => {
    browser.dispatch('keydown', key('KeyW'));
    input.setEnabled(false);
    expect(input.dirY).toBe(0);
    expect(input.sample(1, 0, null).up).toBe(false);
    input.setEnabled(true);
    expect(input.dirY).toBe(-1);
    expect(input.sample(2, 0, null).up).toBe(true);
  });

  it('picks the held buttons and F back up when a menu closes', () => {
    browser.dispatch('mousedown', { button: 0, clientX: 0, clientY: 0 });
    browser.dispatch('keydown', key('KeyF'));
    input.setEnabled(false);
    expect(input.sample(1, 0, null)).toMatchObject({ shoot: false, melee: false });
    input.setEnabled(true);
    expect(input.sample(2, 0, null)).toMatchObject({ shoot: true, melee: true });
  });

  it('takes no button press from a menu, whose release may never come', () => {
    input.setEnabled(false);
    browser.dispatch('mousedown', { button: 0, clientX: 0, clientY: 0 });
    browser.dispatch('mousedown', { button: 2, clientX: 0, clientY: 0 });
    input.setEnabled(true);
    expect(input.sample(1, 0, null)).toMatchObject({ shoot: false, melee: false });
  });

  it('lets go of a button the next mouse move shows is up, when a drag took the release', () => {
    browser.dispatch('mousedown', { button: 0, clientX: 0, clientY: 0 });
    browser.dispatch('mousedown', { button: 2, clientX: 0, clientY: 0 });
    input.sample(1, 0, null);
    browser.dispatch('mousemove', { buttons: 2, clientX: 1, clientY: 1 });
    expect(input.sample(2, 0, null)).toMatchObject({ shoot: false, melee: true });
    browser.dispatch('mousemove', { buttons: 0, clientX: 2, clientY: 2 });
    expect(input.sample(3, 0, null).melee).toBe(false);
  });

  it('lets go of keys when a text field opens its native menu, which takes their release', () => {
    input.setEnabled(false);
    browser.dispatch('keydown', key('KeyF'));
    const field = new (globalThis as unknown as { HTMLInputElement: new () => object }).HTMLInputElement();
    browser.dispatch('contextmenu', { target: field, preventDefault: vi.fn() });
    input.setEnabled(true);
    expect(input.sample(1, 0, null).melee).toBe(false);
  });

  it('counts a key pressed behind a menu and still held after it', () => {
    input.setEnabled(false);
    browser.dispatch('keydown', key('KeyD'));
    input.setEnabled(true);
    expect(input.dirX).toBe(1);
  });

  it('forgets a key released behind a menu', () => {
    browser.dispatch('keydown', key('KeyD'));
    input.setEnabled(false);
    browser.dispatch('keyup', key('KeyD'));
    input.setEnabled(true);
    expect(input.dirX).toBe(0);
  });

  it('spends no one-shot request through a menu', () => {
    browser.dispatch('keydown', key('KeyH'));
    browser.dispatch('keyup', key('KeyH'));
    input.setEnabled(false);
    input.setEnabled(true);
    expect(input.sample(1, 0, null).heal).toBe(false);
  });

  it('does not keep a key that was held when the window lost focus behind a menu', () => {
    browser.dispatch('keydown', key('KeyW'));
    input.setEnabled(false);
    browser.dispatch('blur', {});
    input.setEnabled(true);
    expect(input.dirY).toBe(0);
  });

  it('lets go of everything on window blur', () => {
    browser.dispatch('keydown', key('KeyW'));
    browser.dispatch('mousedown', { button: 0, clientX: 0, clientY: 0 });
    browser.dispatch('mousedown', { button: 2, clientX: 0, clientY: 0 });
    browser.dispatch('keydown', key('KeyH'));
    browser.dispatch('blur', {});
    expect(input.dirY).toBe(0);
    expect(input.sample(1, 0, null)).toMatchObject({ shoot: false, melee: false, heal: false });
  });

  it('lets go of everything when a menu opens, and stops listening to game keys', () => {
    browser.dispatch('keydown', key('KeyD'));
    input.setEnabled(false);
    expect(input.dirX).toBe(0);
    const event = key('KeyD');
    browser.dispatch('keydown', event);
    expect(input.dirX).toBe(0);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('prevents the default action of game keys only', () => {
    const game = key('Space');
    const other = key('F5');
    browser.dispatch('keydown', game);
    browser.dispatch('keydown', other);
    expect(game.preventDefault).toHaveBeenCalled();
    expect(other.preventDefault).not.toHaveBeenCalled();
  });

  it('leaves letters alone while typing in a field', () => {
    const onMute = vi.fn();
    const typing = new InputManager({ ...noop, onMute });
    const field = new (globalThis as unknown as { HTMLInputElement: new () => object }).HTMLInputElement();
    browser.dispatch('keydown', key('KeyM', { target: field }));
    expect(onMute).not.toHaveBeenCalled();
    typing.dispose();
  });

  it('still takes M with a volume slider focused', () => {
    const onMute = vi.fn();
    const muting = new InputManager({ ...noop, onMute });
    const slider = Object.assign(new (globalThis as unknown as { HTMLInputElement: new () => object }).HTMLInputElement(), { type: 'range' });
    browser.dispatch('keydown', key('KeyM', { target: slider }));
    expect(onMute).toHaveBeenCalledTimes(1);
    muting.dispose();
  });

  it('confirms on Enter in a field, and counts it as a gesture', () => {
    const onConfirm = vi.fn();
    const onGesture = vi.fn();
    const confirming = new InputManager({ ...noop, onConfirm, onGesture });
    const field = new (globalThis as unknown as { HTMLInputElement: new () => object }).HTMLInputElement();
    browser.dispatch('keydown', key('Enter', { target: field }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onGesture).toHaveBeenCalled();
    confirming.dispose();
  });

  it.each(['ctrlKey', 'metaKey', 'altKey'])('leaves a key with %s to the browser', (modifier) => {
    const shortcut = key('KeyR', { [modifier]: true });
    browser.dispatch('keydown', shortcut);
    expect(shortcut.preventDefault).not.toHaveBeenCalled();
    expect(input.sample(1, 0, null).reload).toBe(false);
    browser.dispatch('keydown', key('KeyA', { [modifier]: true }));
    expect(input.dirX).toBe(0);
  });

  it('does not open the map on Ctrl+Tab', () => {
    const onMap = vi.fn(() => true);
    const mapped = new InputManager({ ...noop, onMap });
    browser.dispatch('keydown', key('Tab', { ctrlKey: true }));
    expect(onMap).not.toHaveBeenCalled();
    mapped.dispose();
  });

  it('keeps the shift key out of it', () => {
    browser.dispatch('keydown', key('KeyD', { shiftKey: true }));
    expect(input.dirX).toBe(1);
  });

  it('holds back the browser menu in play and behind menus', () => {
    const inPlay = { target: null, preventDefault: vi.fn() };
    browser.dispatch('contextmenu', inPlay);
    expect(inPlay.preventDefault).toHaveBeenCalled();
    input.setEnabled(false);
    const behindMenu = { target: null, preventDefault: vi.fn() };
    browser.dispatch('contextmenu', behindMenu);
    expect(behindMenu.preventDefault).toHaveBeenCalled();
  });

  it('leaves the browser menu on a text field, for paste', () => {
    const field = new (globalThis as unknown as { HTMLInputElement: new () => object }).HTMLInputElement();
    const event = { target: field, preventDefault: vi.fn() };
    browser.dispatch('contextmenu', event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('removes every listener on dispose', () => {
    input.dispose();
    const left = [...browser.listeners.values()].reduce((sum, set) => sum + set.size, 0);
    expect(left).toBe(0);
  });
});
