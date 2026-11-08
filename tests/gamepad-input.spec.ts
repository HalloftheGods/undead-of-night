import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eightWay, PAD, radialDeadzone } from '../src/game/gamepad-input.ts';
import { InputManager } from '../src/game/input-manager.ts';
import type { InputCallbacks } from '../src/game/input-manager.ts';
import { padFamily, padLabel } from '../src/game/pad-glyphs.ts';
import { installFakeBrowser } from './client-fake-dom.ts';
import type { FakeBrowser } from './client-fake-dom.ts';

const XBOX_ID = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)';

interface PadState {
  /** Button index to value, 0..1. */
  readonly buttons?: Readonly<Record<number, number>>;
  readonly axes?: readonly number[];
  readonly mapping?: string;
  readonly id?: string;
  readonly index?: number;
}

/** A pad as getGamepads hands it over. `pressed` follows a digital button; a trigger can be down by value alone. */
function pad(state: PadState = {}): Gamepad {
  const buttons = Array.from({ length: 17 }, (_, index) => {
    const value = state.buttons?.[index] ?? 0;
    return { pressed: value > 0.5, touched: value > 0, value };
  });
  return {
    id: state.id ?? XBOX_ID,
    index: state.index ?? 0,
    connected: true,
    mapping: state.mapping ?? 'standard',
    axes: state.axes ?? [0, 0, 0, 0],
    buttons,
    timestamp: 0,
  } as unknown as Gamepad;
}

describe('the stick dead zone', () => {
  it('rests inside a round zone of 0.2', () => {
    expect(radialDeadzone(0.15, 0.1)).toBeNull();
    expect(radialDeadzone(0.2, 0)).toBeNull();
    expect(radialDeadzone(0, -0.19)).toBeNull();
  });

  it('measures on the circle, so a slow diagonal is not cut off axis by axis', () => {
    const diagonal = radialDeadzone(0.18, 0.18);
    expect(diagonal).not.toBeNull();
    expect(eightWay(diagonal)).toEqual({ x: 1, y: 1 });
  });

  it('rescales from the edge of the zone to full tilt', () => {
    expect(radialDeadzone(1, 0)).toEqual({ x: 1, y: 0 });
    expect(radialDeadzone(0.6, 0)!.x).toBeCloseTo(0.5);
    expect(radialDeadzone(0, 1.4)).toEqual({ x: 0, y: 1 });
  });

  it('snaps to the eight directions the packet has', () => {
    expect(eightWay(radialDeadzone(0.9, 0.1))).toEqual({ x: 1, y: 0 });
    expect(eightWay(radialDeadzone(-0.6, 0.6))).toEqual({ x: -1, y: 1 });
    expect(eightWay(null)).toEqual({ x: 0, y: 0 });
  });
});

describe('a gamepad on the game', () => {
  let browser: FakeBrowser;
  let pads: (Gamepad | null)[];
  let calls: { onConfirm: number; onPause: number; onMap: number; navigate: string[]; devices: string[] };
  let input: InputManager;

  /** Puts these pads in the browser's hands and runs one frame's poll. */
  const frame = (...next: (Gamepad | null)[]) => {
    pads = next;
    input.pollGamepad();
  };

  beforeEach(() => {
    browser = installFakeBrowser();
    pads = [];
    vi.stubGlobal('navigator', { getGamepads: () => pads });
    calls = { onConfirm: 0, onPause: 0, onMap: 0, navigate: [], devices: [] };
    const callbacks: InputCallbacks = {
      onGesture() {},
      onPause: () => { calls.onPause += 1; },
      onMute() {},
      onConfirm: () => { calls.onConfirm += 1; },
      onMap: () => { calls.onMap += 1; return true; },
      mapUsable: () => true,
      onNavigate: (direction) => { calls.navigate.push(direction); },
      onDeviceChange: (device) => { calls.devices.push(device); },
    };
    input = new InputManager(callbacks);
    input.setEnabled(true);
  });

  afterEach(() => {
    input.dispose();
    vi.unstubAllGlobals();
  });

  describe('the sticks', () => {
    it('walks with the left stick, and not inside the dead zone', () => {
      frame(pad({ axes: [0.15, -0.1, 0, 0] }));
      expect([input.dirX, input.dirY]).toEqual([0, 0]);
      expect(input.sample(1, 0, null)).toMatchObject({ up: false, down: false, left: false, right: false });
      frame(pad({ axes: [0, -0.9, 0, 0] }));
      expect(input.dirY).toBe(-1);
      expect(input.sample(2, 0, null)).toMatchObject({ up: true, down: false });
    });

    it('walks on a diagonal', () => {
      frame(pad({ axes: [0.7, 0.7, 0, 0] }));
      expect(input.sample(1, 0, null)).toMatchObject({ right: true, down: true, up: false, left: false });
    });

    it('aims with the right stick, y down as the world is', () => {
      frame(pad({ axes: [0, 0, 1, 0] }));
      expect(input.gamepad.look(2)).toBeCloseTo(0);
      frame(pad({ axes: [0, 0, 0, 1] }));
      expect(input.gamepad.look(2)).toBeCloseTo(Math.PI / 2);
    });

    it('faces the way it walks with the right stick resting, and holds there on stopping', () => {
      frame(pad({ axes: [-1, 0, 0, 0] }));
      expect(input.gamepad.look(0)).toBeCloseTo(Math.PI);
      frame(pad());
      expect(input.gamepad.look(1.25)).toBe(1.25);
    });

    it('stands still behind a menu', () => {
      input.setEnabled(false);
      frame(pad({ axes: [1, 0, 0, 0] }));
      expect(input.dirX).toBe(0);
      expect(input.sample(1, 0, null).right).toBe(false);
    });
  });

  describe('button edges', () => {
    it('asks for one reload per press of X, however long it is held', () => {
      frame(pad({ buttons: { [PAD.x]: 1 } }));
      frame(pad({ buttons: { [PAD.x]: 1 } }));
      expect(input.sample(1, 0, null).reload).toBe(true);
      frame(pad({ buttons: { [PAD.x]: 1 } }));
      expect(input.sample(2, 0, null).reload).toBe(false);
    });

    it('fires again on a second press after a release', () => {
      frame(pad({ buttons: { [PAD.b]: 1 } }));
      expect(input.sample(1, 0, null).heal).toBe(true);
      frame(pad());
      frame(pad({ buttons: { [PAD.b]: 1 } }));
      expect(input.sample(2, 0, null).heal).toBe(true);
    });

    it('fires while the right trigger is held, counting a half-pulled analog trigger', () => {
      frame(pad({ buttons: { [PAD.rt]: 0.4 } }));
      expect(input.sample(1, 0, null).shoot).toBe(true);
      expect(input.sample(2, 0, null).shoot).toBe(true);
      frame(pad());
      expect(input.sample(3, 0, null).shoot).toBe(false);
    });

    it('does not lose a trigger tap that ends between ticks', () => {
      frame(pad({ buttons: { [PAD.rt]: 1 } }));
      frame(pad());
      expect(input.sample(1, 0, null).shoot).toBe(true);
      expect(input.sample(2, 0, null).shoot).toBe(false);
    });

    it('shoves on the left trigger, through the hold', () => {
      frame(pad({ buttons: { [PAD.lt]: 1 } }));
      expect(input.sample(1, 0, null).melee).toBe(true);
      expect(input.sample(2, 0, null).melee).toBe(true);
      frame(pad());
      expect(input.sample(3, 0, null).melee).toBe(false);
    });

    it('holds Search on A for as long as it is down', () => {
      frame(pad({ buttons: { [PAD.a]: 1 } }));
      expect(input.sample(1, 0, null).search).toBe(true);
      frame(pad());
      expect(input.sample(2, 0, null).search).toBe(false);
    });

    it('steps through the guns both ways on the D-pad', () => {
      const loadout = { owned: ['pistol', 'carbine', 'shotgun'] as const, weapon: 'pistol' as const };
      frame(pad({ buttons: { [PAD.right]: 1 } }));
      expect(input.sample(1, 0, loadout).weapon).toBe('carbine');
      frame(pad({ buttons: { [PAD.left]: 1 } }));
      expect(input.sample(2, 0, loadout).weapon).toBe('shotgun');
    });

    it('throws, lights a molotov or a flare, and eats a candy', () => {
      frame(pad({ buttons: { [PAD.rb]: 1, [PAD.up]: 1, [PAD.down]: 1, [PAD.y]: 1 } }));
      expect(input.sample(1, 0, null)).toMatchObject({ throw: true, molotov: true, flare: true, eat: true });
    });

    it('sprints on LB held, toggles sneak on L3, and a sprint ends the sneak', () => {
      frame(pad({ buttons: { [PAD.lb]: 1 } }));
      expect(input.stance).toBe('sprint');
      frame(pad({ buttons: { [PAD.l3]: 1 } }));
      frame(pad());
      expect(input.stance).toBe('sneak');
      frame(pad({ buttons: { [PAD.lb]: 1 } }));
      expect(input.stance).toBe('sprint');
      frame(pad());
      expect(input.stance).toBe('walk');
    });

    it('pauses on Start and opens the map on View, once per press', () => {
      frame(pad({ buttons: { [PAD.start]: 1, [PAD.view]: 1 } }));
      frame(pad({ buttons: { [PAD.start]: 1, [PAD.view]: 1 } }));
      expect(calls).toMatchObject({ onPause: 1, onMap: 1 });
    });
  });

  describe('behind a menu', () => {
    beforeEach(() => input.setEnabled(false));

    it('confirms on A, goes back on B and pauses on Start, spending no play action', () => {
      frame(pad({ buttons: { [PAD.a]: 1, [PAD.b]: 1 } }));
      frame(pad());
      frame(pad({ buttons: { [PAD.start]: 1 } }));
      expect(calls).toMatchObject({ onConfirm: 1, onPause: 2 });
      input.setEnabled(true);
      expect(input.sample(1, 0, null)).toMatchObject({ heal: false, search: false });
    });

    it('moves focus one step per D-pad press or stick push', () => {
      frame(pad({ buttons: { [PAD.down]: 1 } }));
      frame(pad({ buttons: { [PAD.down]: 1 } }));
      frame(pad({ axes: [0.9, 0, 0, 0] }));
      frame(pad({ axes: [0.95, 0, 0, 0] }));
      frame(pad());
      frame(pad({ axes: [0, -0.9, 0, 0] }));
      expect(calls.navigate).toEqual(['down', 'right', 'up']);
    });

    it('does not carry an A pressed on a menu into a search once play resumes', () => {
      frame(pad({ buttons: { [PAD.a]: 1 } }));
      input.setEnabled(true);
      frame(pad({ buttons: { [PAD.a]: 1 } }));
      expect(input.sample(1, 0, null).search).toBe(false);
      frame(pad());
      frame(pad({ buttons: { [PAD.a]: 1 } }));
      expect(input.sample(2, 0, null).search).toBe(true);
    });

    it('picks a trigger held from before the menu back up when it closes', () => {
      input.setEnabled(true);
      frame(pad({ buttons: { [PAD.rt]: 1 } }));
      input.setEnabled(false);
      frame(pad({ buttons: { [PAD.rt]: 1 } }));
      expect(input.sample(1, 0, null).shoot).toBe(false);
      input.setEnabled(true);
      frame(pad({ buttons: { [PAD.rt]: 1 } }));
      expect(input.sample(2, 0, null).shoot).toBe(true);
    });
  });

  describe('disconnects', () => {
    it('lets go of everything when the pad vanishes mid-press', () => {
      frame(pad({ buttons: { [PAD.lt]: 1, [PAD.rt]: 1 }, axes: [0, -1, 0, 0] }));
      input.sample(1, 0, null);
      frame();
      expect(input.dirY).toBe(0);
      expect(input.sample(2, 0, null)).toMatchObject({ up: false, shoot: false, melee: false });
    });

    it('lets go at once on gamepaddisconnected, before the next poll', () => {
      const held = pad({ buttons: { [PAD.rt]: 1, [PAD.l3]: 1 } });
      frame(held);
      input.sample(1, 0, null);
      browser.dispatch('gamepaddisconnected', { gamepad: held });
      expect(input.sample(2, 0, null).shoot).toBe(false);
      expect(input.stance).toBe('walk');
    });

    it('treats a null slot as gone', () => {
      frame(pad({ buttons: { [PAD.a]: 1 } }));
      frame(null);
      expect(input.sample(1, 0, null).search).toBe(false);
    });
  });

  describe('pads off the standard layout', () => {
    it('are ignored, and noted for the UI', () => {
      const odd = pad({ mapping: '', id: 'Generic USB Joystick', buttons: { [PAD.rt]: 1, [PAD.x]: 1 }, axes: [1, 0, 1, 0] });
      frame(odd);
      expect(input.dirX).toBe(0);
      expect(input.sample(1, 0, null)).toMatchObject({ shoot: false, reload: false, right: false });
      expect(input.gamepad.unsupportedId).toBe('Generic USB Joystick');
      expect(input.lastDevice).toBe('keyboard');
    });

    it('do not get in the way of a standard pad beside them', () => {
      frame(pad({ mapping: '', index: 0, axes: [1, 0, 0, 0] }), pad({ index: 1, buttons: { [PAD.x]: 1 } }));
      expect(input.sample(1, 0, null)).toMatchObject({ reload: true, right: false });
    });

    it('leave the game alone where getGamepads throws, as a blocking permissions policy makes it', () => {
      vi.stubGlobal('navigator', { getGamepads: () => { throw new Error('SecurityError'); } });
      expect(() => input.pollGamepad()).not.toThrow();
    });
  });

  describe('the last hand on the game', () => {
    it('becomes the pad on a press or a push, and the keys again on a key', () => {
      frame(pad({ buttons: { [PAD.x]: 1 } }));
      expect(input.lastDevice).toBe('gamepad');
      browser.dispatch('keydown', { code: 'KeyW', repeat: false, target: null, preventDefault: vi.fn() });
      expect(input.lastDevice).toBe('keyboard');
      expect(calls.devices).toEqual(['gamepad', 'keyboard']);
    });

    it('leaves the flashlight to the mouse unless the pad was last', () => {
      frame(pad({ axes: [0, 0, 1, 0] }));
      browser.dispatch('mousemove', { clientX: 5, clientY: 5, buttons: 0 });
      expect(input.gamepad.look(0.5)).toBeNull();
    });

    it('does not count a resting pad as a hand', () => {
      frame(pad({ axes: [0.1, 0.05, 0, 0] }));
      expect(input.lastDevice).toBe('keyboard');
    });

    it('takes the pad most recently used when two are plugged in', () => {
      frame(pad({ index: 0, buttons: { [PAD.x]: 1 } }), pad({ index: 1, id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)' }));
      frame(pad({ index: 0 }), pad({ index: 1, id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', buttons: { [PAD.b]: 1 } }));
      expect(input.gamepad.id).toContain('054c');
      expect(input.sample(1, 0, null)).toMatchObject({ reload: true, heal: true });
    });
  });

  it('leaves keyboard and touch packets as they were with no pad', () => {
    frame();
    browser.dispatch('keydown', { code: 'KeyD', repeat: false, target: null, preventDefault: vi.fn() });
    expect(input.sample(1, 0, null)).toEqual({
      seq: 1, up: false, down: false, left: false, right: true, angle: 0,
      shoot: false, reload: false, weapon: null, melee: false, heal: false, search: false,
    });
  });

  it('removes its listeners on dispose', () => {
    input.dispose();
    expect(browser.listeners.get('gamepadconnected')?.size ?? 0).toBe(0);
    expect(browser.listeners.get('gamepaddisconnected')?.size ?? 0).toBe(0);
  });
});

describe('button prompts', () => {
  it('reads the family from Chrome and Firefox pad ids', () => {
    expect(padFamily(XBOX_ID)).toBe('xbox');
    expect(padFamily('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toBe('xbox');
    expect(padFamily('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')).toBe('playstation');
    expect(padFamily('054c-09cc-Wireless Controller')).toBe('playstation');
    expect(padFamily('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)')).toBe('nintendo');
    expect(padFamily('8BitDo Pro 2 (Vendor: 2dc8 Product: 6003)')).toBe('nintendo');
  });

  it('falls back to Xbox for an unknown or missing id', () => {
    expect(padFamily('Unknown Gamepad (STANDARD GAMEPAD)')).toBe('xbox');
    expect(padFamily(null)).toBe('xbox');
  });

  it('names the bottom face button by each family', () => {
    expect(padLabel('xbox', PAD.a)).toBe('A');
    expect(padLabel('playstation', PAD.a)).toBe('Cross');
    expect(padLabel('nintendo', PAD.a)).toBe('B');
    expect(padLabel('xbox', PAD.up)).toBe('D-pad Up');
  });
});
