import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GamepadInput, NAV_REPEAT_DELAY_MS, NAV_REPEAT_MS, PAD } from '../src/game/gamepad-input.ts';
import type { GamepadHost, NavDirection } from '../src/game/gamepad-input.ts';
import type { PadMenu } from '../src/game/pad-focus.ts';
import { installFakeBrowser } from './client-fake-dom.ts';

interface PadState {
  readonly buttons?: Readonly<Record<number, number>>;
  readonly axes?: readonly number[];
}

function pad(state: PadState = {}): Gamepad {
  const buttons = Array.from({ length: 17 }, (_, index) => {
    const value = state.buttons?.[index] ?? 0;
    return { pressed: value > 0.5, touched: value > 0, value };
  });
  return { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', index: 0, connected: true, mapping: 'standard', axes: state.axes ?? [0, 0, 0, 0], buttons, timestamp: 0 } as unknown as Gamepad;
}

describe('a gamepad behind a menu', () => {
  let pads: (Gamepad | null)[];
  let clock: number;
  let live: boolean;
  let log: string[];
  let hostMoves: boolean;
  let menuHas: { activate: boolean; back: boolean; start: boolean };
  let input: GamepadInput;

  const host: GamepadHost = {
    live: () => live,
    inCharge: () => true,
    press: (code) => { log.push(`press:${code}`); },
    confirm: () => { log.push('host.confirm'); },
    back: () => { log.push('host.back'); },
    navigate: (direction: NavDirection) => {
      log.push(`host.nav:${direction}`);
      return hostMoves;
    },
    onActive() {},
  };

  const menu: PadMenu = {
    navigate: (direction) => { log.push(`menu.nav:${direction}`); return true; },
    activate: () => { log.push('menu.activate'); return menuHas.activate; },
    back: () => { log.push('menu.back'); return menuHas.back; },
    start: () => { if (menuHas.start) log.push('menu.start'); return menuHas.start; },
  };

  /** Runs one frame at the current clock. */
  const frame = (state: PadState = {}) => {
    pads = [pad(state)];
    input.poll();
  };
  const moves = () => log.filter((line) => line.includes('nav:'));

  beforeEach(() => {
    installFakeBrowser();
    pads = [];
    clock = 1000;
    live = false;
    log = [];
    hostMoves = false;
    menuHas = { activate: false, back: false, start: false };
    vi.stubGlobal('navigator', { getGamepads: () => pads });
    input = new GamepadInput(host, { now: () => clock, menu });
  });

  afterEach(() => {
    input.dispose();
    vi.unstubAllGlobals();
  });

  describe('D-pad and stick focus moves', () => {
    it('asks the host first, and the page when the host does not say it moved focus', () => {
      frame({ buttons: { [PAD.down]: 1 } });
      expect(moves()).toEqual(['host.nav:down', 'menu.nav:down']);
    });

    it('leaves the page alone when the host moved focus itself', () => {
      hostMoves = true;
      frame({ buttons: { [PAD.right]: 1 } });
      expect(moves()).toEqual(['host.nav:right']);
    });

    it('moves once on a press, repeats after the delay, then at the repeat rate', () => {
      frame({ buttons: { [PAD.down]: 1 } });
      clock += NAV_REPEAT_DELAY_MS - 1;
      frame({ buttons: { [PAD.down]: 1 } });
      expect(moves().filter((line) => line.startsWith('menu'))).toHaveLength(1);
      clock += 1;
      frame({ buttons: { [PAD.down]: 1 } });
      expect(moves().filter((line) => line.startsWith('menu'))).toHaveLength(2);
      clock += NAV_REPEAT_MS - 1;
      frame({ buttons: { [PAD.down]: 1 } });
      expect(moves().filter((line) => line.startsWith('menu'))).toHaveLength(2);
      clock += 1;
      frame({ buttons: { [PAD.down]: 1 } });
      expect(moves().filter((line) => line.startsWith('menu'))).toHaveLength(3);
    });

    it('repeats the left stick the same way', () => {
      frame({ axes: [0, 0.9, 0, 0] });
      clock += NAV_REPEAT_DELAY_MS;
      frame({ axes: [0, 0.9, 0, 0] });
      expect(moves().filter((line) => line.startsWith('menu'))).toEqual(['menu.nav:down', 'menu.nav:down']);
    });

    it('starts the delay over after a release, so a quick second tap moves again at once', () => {
      frame({ buttons: { [PAD.up]: 1 } });
      clock += 50;
      frame();
      clock += 50;
      frame({ buttons: { [PAD.up]: 1 } });
      expect(moves().filter((line) => line.startsWith('menu'))).toHaveLength(2);
    });

    it('moves at once on a change of direction, and starts that direction\'s delay', () => {
      frame({ buttons: { [PAD.down]: 1 } });
      clock += 100;
      frame({ buttons: { [PAD.right]: 1 } });
      expect(moves().filter((line) => line.startsWith('menu'))).toEqual(['menu.nav:down', 'menu.nav:right']);
      clock += NAV_REPEAT_DELAY_MS - 1;
      frame({ buttons: { [PAD.right]: 1 } });
      expect(moves().filter((line) => line.startsWith('menu'))).toHaveLength(2);
    });

    it('ignores a stick resting or nudged inside the push threshold', () => {
      frame({ axes: [0.3, 0.3, 0, 0] });
      expect(moves()).toEqual([]);
    });

    it('lets the D-pad win over a stick pushed another way', () => {
      frame({ buttons: { [PAD.left]: 1 }, axes: [0, 0.9, 0, 0] });
      expect(moves().filter((line) => line.startsWith('menu'))).toEqual(['menu.nav:left']);
    });

    it('does not move focus in play', () => {
      live = true;
      frame({ buttons: { [PAD.down]: 1 }, axes: [0.9, 0, 0, 0] });
      expect(moves()).toEqual([]);
    });

    it('waits for a direction held through a menu opening to be let go before it moves anything', () => {
      live = true;
      frame({ buttons: { [PAD.down]: 1 } });
      live = false;
      clock += 5000;
      frame({ buttons: { [PAD.down]: 1 } });
      expect(moves()).toEqual([]);
      frame();
      frame({ buttons: { [PAD.down]: 1 } });
      expect(moves().filter((line) => line.startsWith('menu'))).toEqual(['menu.nav:down']);
    });

    it('treats a pad that went away and came back as a fresh push', () => {
      frame({ buttons: { [PAD.down]: 1 } });
      pads = [];
      input.poll();
      clock += 2000;
      frame({ buttons: { [PAD.down]: 1 } });
      expect(moves().filter((line) => line.startsWith('menu'))).toHaveLength(2);
    });
  });

  describe('confirm and back', () => {
    it('A clicks the focused control and does not also ask the host to confirm', () => {
      menuHas.activate = true;
      frame({ buttons: { [PAD.a]: 1 } });
      expect(log).toEqual(['menu.activate']);
    });

    it('A with nothing focused falls back to the host confirm (play again, resume)', () => {
      frame({ buttons: { [PAD.a]: 1 } });
      expect(log).toEqual(['menu.activate', 'host.confirm']);
    });

    it('B clicks the screen Back or Close and does not also pause', () => {
      menuHas.back = true;
      frame({ buttons: { [PAD.b]: 1 } });
      expect(log).toEqual(['menu.back']);
    });

    it('B with no Back on screen falls back to the host back (the pause path)', () => {
      frame({ buttons: { [PAD.b]: 1 } });
      expect(log).toEqual(['menu.back', 'host.back']);
    });

    it('answers once per press, not once per frame held', () => {
      menuHas.activate = true;
      frame({ buttons: { [PAD.a]: 1 } });
      frame({ buttons: { [PAD.a]: 1 } });
      frame({ buttons: { [PAD.a]: 1 } });
      expect(log.filter((line) => line === 'menu.activate')).toHaveLength(1);
    });

    it('does not answer A or B in play, where they are search and the candy bag', () => {
      live = true;
      frame({ buttons: { [PAD.a]: 1, [PAD.b]: 1 } });
      expect(log).toEqual(['press:KeyE', 'press:KeyX']);
    });

    it('does not let a menu press count as an action once play resumes while it is still held', () => {
      frame({ buttons: { [PAD.a]: 1, [PAD.down]: 1 } });
      live = true;
      frame({ buttons: { [PAD.a]: 1, [PAD.down]: 1 } });
      expect(input.holds('KeyE')).toBe(false);
      expect(input.holds('KeyV')).toBe(false);
      frame();
      frame({ buttons: { [PAD.a]: 1 } });
      expect(input.holds('KeyE')).toBe(true);
    });
  });

  it('Start and View still pause and open the inventory behind a menu', () => {
    frame({ buttons: { [PAD.start]: 1, [PAD.view]: 1 } });
    expect(log).toEqual(['press:KeyI', 'press:Escape']);
  });

  it('Start presses the screen\'s main button when it has one, and only pauses when it has none', () => {
    menuHas.start = true;
    frame({ buttons: { [PAD.start]: 1 } });
    expect(log).toEqual(['menu.start']);
  });
});
