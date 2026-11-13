// What to print on a HUD key glyph: the keyboard letter, the pad button that presses it, or nothing on a phone.

import { PAD_FIRE, getActivePadBindings } from './gamepad-input.ts';
import { padFamily, padLabel } from './pad-glyphs.ts';
import { formatKeyCode, loadKeyBindings } from './controls-prefs.ts';
import type { GameAction } from './controls-prefs.ts';

/** Who is playing right now, as far as prompts are concerned. */
export type ControlDevice = 'keys' | 'touch' | 'pad';

/** The device a prompt should speak to: fingers win on a phone, then a pad in charge, else keys. */
export function controlDevice(touch: boolean, lastDevice: string): ControlDevice {
  if (touch) return 'touch';
  return lastDevice === 'gamepad' ? 'pad' : 'keys';
}

function padButtonOf(code: string): number | undefined {
  const bindings = getActivePadBindings();
  for (const [button, boundCode] of bindings) {
    if (boundCode === code) return button;
  }
  return undefined;
}

const ACTION_OF_DEFAULT_KEY: Readonly<Record<string, GameAction>> = {
  KeyE: 'search',
  KeyH: 'heal',
  KeyR: 'reload',
  KeyF: 'melee',
  KeyX: 'bag',
  KeyG: 'throw',
  KeyT: 'spinner',
  KeyV: 'fountain',
  KeyN: 'map',
  KeyL: 'log',
  KeyQ: 'cycleWeapon',
};

/** The glyph for a key code on this device, or null where no glyph is wanted (a phone has buttons, not keys). */
export function keyGlyph(code: string, device: ControlDevice, padId: string | null = null): string | null {
  if (device === 'touch') return null;
  if (device === 'keys') {
    const action = ACTION_OF_DEFAULT_KEY[code];
    if (action) {
      const keys = loadKeyBindings()[action];
      if (keys && keys.length > 0) return formatKeyCode(keys[0]);
    }
    return formatKeyCode(code);
  }
  const button = padButtonOf(code);
  return button === undefined ? null : padLabel(padFamily(padId), button);
}

/** The label of a weapon's slot key ("1" to "3") from the controls page; null on a pad, where the slots are not bound. */
export function weaponSlotLabel(slot: string, device: ControlDevice): string | null {
  if (device !== 'keys') return null;
  const codes = loadKeyBindings()[`weapon${slot}` as 'weapon1'];
  return codes[0] ? formatKeyCode(codes[0]) : null;
}

/** The pad button that fires, for prompts. */
export function fireGlyph(padId: string | null): string {
  const button = padButtonOf(PAD_FIRE);
  return button === undefined ? 'RT' : padLabel(padFamily(padId), button);
}
