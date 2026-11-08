import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InputManager } from '../src/game/input-manager.ts';
import type { InputCallbacks } from '../src/game/input-manager.ts';
import { touchItems } from '../src/game/touch-items.ts';
import { glyphPath, TOUCH_BUTTONS } from '../src/game/touch-pad.ts';
import { dragStick, inStickZone, startStick, stickAngle, stickDirection, STICK_TRAVEL } from '../src/game/touch-stick.ts';
import { installFakeBrowser } from './client-fake-dom.ts';
import type { FakeBrowser } from './client-fake-dom.ts';

const WIDE = { w: 800, h: 400 };
const TALL = { w: 400, h: 800 };
const PLAY_AREA = { closest: () => null };
const PAD = { closest: (selector: string) => (selector === '[data-touch-pad]' ? {} : null) };
/** A button laid over play, like the room card's Share invite link. */
const UI = { closest: (selector: string) => (selector === '[data-touch-ui]' ? {} : null) };

interface FakeTouch {
  identifier: number;
  clientX: number;
  clientY: number;
  target: object;
}

function finger(identifier: number, clientX: number, clientY: number, target: object = PLAY_AREA): FakeTouch {
  return { identifier, clientX, clientY, target };
}

/** One touch event as a window listener sees it: `touches` is every finger still down. */
function touchEvent(changed: FakeTouch[], down: FakeTouch[]) {
  return { changedTouches: changed, touches: down, cancelable: true, preventDefault: vi.fn() };
}

describe('the floating stick', () => {
  it('takes the left of a wide screen and the lower left of a tall one', () => {
    expect(inStickZone(100, 20, WIDE.w, WIDE.h)).toBe(true);
    expect(inStickZone(500, 300, WIDE.w, WIDE.h)).toBe(false);
    expect(inStickZone(100, 700, TALL.w, TALL.h)).toBe(true);
    expect(inStickZone(100, 100, TALL.w, TALL.h)).toBe(false);
    expect(inStickZone(300, 700, TALL.w, TALL.h)).toBe(false);
  });

  it('stands still inside the dead zone', () => {
    const stick = dragStick(startStick(1, 100, 100), 104, 103);
    expect(stickDirection(stick)).toEqual({ x: 0, y: 0 });
    expect(stickAngle(stick)).toBeNull();
  });

  it('snaps to the eight directions the movement packet has', () => {
    const towards = (dx: number, dy: number) => stickDirection(dragStick(startStick(1, 100, 100), 100 + dx, 100 + dy));
    expect(towards(30, 2)).toEqual({ x: 1, y: 0 });
    expect(towards(-2, -30)).toEqual({ x: 0, y: -1 });
    expect(towards(30, 30)).toEqual({ x: 1, y: 1 });
    expect(towards(-30, 22)).toEqual({ x: -1, y: 1 });
  });

  it('drags its base along past the end of the knob, so turning back answers at once', () => {
    const far = dragStick(startStick(1, 100, 100), 100 + STICK_TRAVEL + 60, 100);
    expect(far.x - far.baseX).toBeCloseTo(STICK_TRAVEL);
    const back = dragStick(far, far.baseX - 20, 100);
    expect(stickDirection(back)).toEqual({ x: -1, y: 0 });
  });
});

describe('fingers on the game', () => {
  let browser: FakeBrowser;
  let calls: { onGesture: number; onMap: number; onPause: number; onTouchSeen: number };
  let input: InputManager;

  const start = (...touches: FakeTouch[]) => {
    const event = touchEvent(touches, touches);
    browser.dispatch('touchstart', event);
    return event;
  };
  const move = (...touches: FakeTouch[]) => {
    const event = touchEvent(touches, touches);
    browser.dispatch('touchmove', event);
    return event;
  };
  const end = (...touches: FakeTouch[]) => browser.dispatch('touchend', touchEvent(touches, []));

  beforeEach(() => {
    browser = installFakeBrowser();
    calls = { onGesture: 0, onMap: 0, onPause: 0, onTouchSeen: 0 };
    const callbacks: InputCallbacks = {
      onGesture: () => { calls.onGesture += 1; },
      onPause: () => { calls.onPause += 1; },
      onMute() {},
      onConfirm() {},
      onMap: () => { calls.onMap += 1; return true; },
      mapUsable: () => true,
      onTouchSeen: () => { calls.onTouchSeen += 1; },
    };
    input = new InputManager(callbacks);
    input.setEnabled(true);
    vi.stubGlobal('performance', { now: () => 5000 });
  });

  afterEach(() => {
    input.dispose();
    vi.unstubAllGlobals();
  });

  it('walks with a thumb dropped on the left, without firing', () => {
    start(finger(1, 200, 800));
    move(finger(1, 200, 760));
    expect(input.dirY).toBe(-1);
    const packet = input.sample(1, 0, null);
    expect(packet).toMatchObject({ up: true, down: false, left: false, right: false, shoot: false, touch: true });
    end(finger(1, 200, 760));
    expect(input.dirY).toBe(0);
  });

  it('fires at the very spot of a tap, even one over before the next sample', () => {
    start(finger(1, 1500, 300));
    end(finger(1, 1500, 300));
    expect([input.pointerClientX, input.pointerClientY]).toEqual([1500, 300]);
    expect(input.sample(1, 0, null).shoot).toBe(true);
    expect(input.sample(2, 0, null).shoot).toBe(false);
  });

  it('keeps firing and tracking while a finger is held and dragged', () => {
    start(finger(1, 1500, 300));
    input.sample(1, 0, null);
    move(finger(1, 1400, 500));
    expect([input.pointerClientX, input.pointerClientY]).toEqual([1400, 500]);
    expect(input.sample(2, 0, null).shoot).toBe(true);
    end(finger(1, 1400, 500));
    expect(input.sample(3, 0, null).shoot).toBe(false);
  });

  it('moves and shoots at once, and a thumb on the stick steers nothing else', () => {
    const thumb = finger(1, 200, 800);
    const trigger = finger(2, 1500, 300);
    start(thumb);
    browser.dispatch('touchstart', touchEvent([trigger], [thumb, trigger]));
    browser.dispatch('touchmove', touchEvent([finger(1, 240, 800)], [thumb, trigger]));
    expect(input.sample(1, 0, null)).toMatchObject({ right: true, shoot: true });
    expect([input.pointerClientX, input.pointerClientY]).toEqual([1500, 300]);
  });

  it('lets a second finger on the left aim, since the stick is taken', () => {
    const thumb = finger(1, 200, 800);
    const trigger = finger(2, 300, 200);
    start(thumb);
    browser.dispatch('touchstart', touchEvent([trigger], [thumb, trigger]));
    expect(input.pointerClientX).toBe(300);
    expect(input.sample(1, 0, null).shoot).toBe(true);
  });

  it('hands the crosshair back to the finger still down', () => {
    const first = finger(1, 1500, 300);
    const second = finger(2, 1600, 500);
    start(first);
    browser.dispatch('touchstart', touchEvent([second], [first, second]));
    browser.dispatch('touchend', touchEvent([second], [first]));
    expect([input.pointerClientX, input.pointerClientY]).toEqual([1500, 300]);
    expect(input.sample(1, 0, null).shoot).toBe(true);
  });

  it('never fires for a thumb on the buttons, gaps included', () => {
    const event = start(finger(1, 1900, 500, PAD));
    expect(input.sample(1, 0, null).shoot).toBe(false);
    expect(input.pointerClientX).not.toBe(1900);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('leaves a tap on a button over play to the button: no shot, and the click still comes', () => {
    const down = start(finger(1, 1500, 300, UI));
    const dragged = move(finger(1, 1500, 290, UI));
    expect(input.sample(1, 0, null).shoot).toBe(false);
    expect(down.preventDefault).not.toHaveBeenCalled();
    expect(dragged.preventDefault).not.toHaveBeenCalled();
  });

  it('keeps the page still through play: no scroll, no zoom, no mouse made up from a tap', () => {
    const down = start(finger(1, 1500, 300));
    const dragged = move(finger(1, 1400, 300));
    const pinch = { preventDefault: vi.fn() };
    browser.dispatch('gesturestart', pinch);
    expect(down.preventDefault).toHaveBeenCalled();
    expect(dragged.preventDefault).toHaveBeenCalled();
    expect(pinch.preventDefault).toHaveBeenCalled();
  });

  it('leaves menus their taps, and does not fire through them', () => {
    input.setEnabled(false);
    const down = start(finger(1, 1500, 300));
    const dragged = move(finger(1, 1500, 280));
    const pinch = { preventDefault: vi.fn() };
    browser.dispatch('gesturestart', pinch);
    expect(down.preventDefault).not.toHaveBeenCalled();
    expect(dragged.preventDefault).not.toHaveBeenCalled();
    expect(pinch.preventDefault).not.toHaveBeenCalled();
    expect(input.sample(1, 0, null).shoot).toBe(false);
  });

  it('wakes the sound on touch down and on the lift, in menus too', () => {
    input.setEnabled(false);
    start(finger(1, 1500, 300));
    expect(calls.onGesture).toBe(1);
    end(finger(1, 1500, 300));
    expect(calls.onGesture).toBe(2);
    expect(calls.onTouchSeen).toBe(1);
  });

  it('forgets fingers when a menu comes up, until they lift and come back', () => {
    start(finger(1, 200, 800));
    move(finger(1, 200, 760));
    input.setEnabled(false);
    expect(input.dirY).toBe(0);
    input.setEnabled(true);
    move(finger(1, 200, 700));
    expect(input.dirY).toBe(0);
    expect(input.touch.stick).toBeNull();
  });

  it('lets go of a finger the browser never said was lifted', () => {
    start(finger(1, 200, 800));
    move(finger(1, 200, 760));
    const next = finger(2, 1500, 300);
    browser.dispatch('touchstart', touchEvent([next], [next]));
    expect(input.dirY).toBe(0);
  });

  it('turns the flashlight the way the stick pushes, and leaves it there on stopping', () => {
    start(finger(1, 200, 800));
    move(finger(1, 200, 760));
    expect(input.touch.look(1)).toBeCloseTo(-Math.PI / 2);
    end(finger(1, 200, 760));
    expect(input.touch.look(1)).toBe(1);
  });

  it('aims by the pointer while a finger is firing, tap included', () => {
    start(finger(1, 1500, 300));
    expect(input.touch.look(1)).toBeNull();
    end(finger(1, 1500, 300));
    expect(input.touch.look(1)).toBeNull();
    input.sample(1, 0, null);
    expect(input.touch.look(1)).toBe(1);
  });

  it('keeps a crosshair mark just after a tap, then clears it', () => {
    start(finger(1, 1500, 300));
    expect(input.touch.aimSpot(5000)).toEqual({ x: 1500, y: 300 });
    end(finger(1, 1500, 300));
    expect(input.touch.aimSpot(5100)).toEqual({ x: 1500, y: 300 });
    expect(input.touch.aimSpot(6000)).toBeNull();
  });

  describe('the buttons', () => {
    const code = (label: string): string => TOUCH_BUTTONS.find((each) => each.label === label)!.code;

    it('are the six the player needs and a way to pause', () => {
      expect(TOUCH_BUTTONS.map((each) => each.label).sort()).toEqual(['Heal', 'Map', 'Next weapon', 'Pause', 'Reload', 'Search', 'Shove']);
    });

    it('latch a press as its key does', () => {
      input.padDown(code('Reload'));
      input.padUp(code('Reload'));
      input.padDown(code('Heal'));
      input.padUp(code('Heal'));
      expect(input.sample(1, 0, null)).toMatchObject({ reload: true, heal: true });
      expect(input.sample(2, 0, null)).toMatchObject({ reload: false, heal: false });
    });

    it('hold Search for as long as the thumb stays', () => {
      input.padDown(code('Search'));
      expect(input.sample(1, 0, null).search).toBe(true);
      expect(input.sample(2, 0, null).search).toBe(true);
      input.padUp(code('Search'));
      expect(input.sample(3, 0, null).search).toBe(false);
    });

    it('shove on the press and through the hold', () => {
      input.padDown(code('Shove'));
      expect(input.sample(1, 0, null).melee).toBe(true);
      expect(input.sample(2, 0, null).melee).toBe(true);
      input.padUp(code('Shove'));
      expect(input.sample(3, 0, null).melee).toBe(false);
    });

    it('step to the next gun', () => {
      input.padDown(code('Next weapon'));
      input.padUp(code('Next weapon'));
      expect(input.sample(1, 0, { owned: ['pistol', 'shotgun'], weapon: 'pistol' }).weapon).toBe('shotgun');
    });

    it('each wear a square picture with some ink in it', () => {
      TOUCH_BUTTONS.forEach((each) => {
        expect(each.glyph.every((row) => row.length === each.glyph.length)).toBe(true);
        expect(glyphPath(each.glyph)).toMatch(/^M/);
      });
    });

    it('throw a bottle, a molotov and a flare, and eat a candy, from the item buttons', () => {
      const items = touchItems({ bottles: 1, fuel: 1, flares: 1, candy: ['Ghost Gum'], sugar: [] });
      items.forEach((each) => {
        input.padDown(each.code);
        input.padUp(each.code);
      });
      expect(input.sample(1, 0, null)).toMatchObject({ throw: true, molotov: true, flare: true, eat: true });
    });

    it('open the map and the pause menu', () => {
      input.padDown(code('Map'));
      input.padDown(code('Pause'));
      expect(calls).toMatchObject({ onMap: 1, onPause: 1 });
    });
  });

  describe('the mouse', () => {
    it('sends what it always did when no finger has played', () => {
      expect(input.sample(1, 0, null)).not.toHaveProperty('touch');
    });

    it('takes back over from fingers, but not with the mouse events a tap makes up', () => {
      start(finger(1, 1500, 300));
      end(finger(1, 1500, 300));
      browser.dispatch('mousemove', { clientX: 10, clientY: 10, buttons: 0 });
      expect(input.touch.used).toBe(true);
      vi.stubGlobal('performance', { now: () => 9000 });
      browser.dispatch('mousemove', { clientX: 10, clientY: 10, buttons: 0 });
      expect(input.touch.used).toBe(false);
      expect(input.touch.look(1)).toBeNull();
    });
  });
});
