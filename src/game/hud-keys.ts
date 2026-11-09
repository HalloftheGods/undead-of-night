// What to print on a HUD key glyph: the keyboard letter, the pad button that presses it, or nothing on a phone.

import { PLAY_BINDINGS, PAD_FIRE } from './gamepad-input.ts';
import { padFamily, padLabel } from './pad-glyphs.ts';

/** Who is playing right now, as far as prompts are concerned. */
export type ControlDevice = 'keys' | 'touch' | 'pad';

/** The device a prompt should speak to: fingers win on a phone, then a pad in charge, else keys. */
export function controlDevice(touch: boolean, lastDevice: string): ControlDevice {
  if (touch) return 'touch';
  return lastDevice === 'gamepad' ? 'pad' : 'keys';
}

const PAD_BUTTON_OF: ReadonlyMap<string, number> = new Map([...PLAY_BINDINGS].map(([button, code]) => [code, button]));

/** 'KeyH' is "H", 'Digit1' is "1". */
function keyLabel(code: string): string {
  return code.replace(/^Key|^Digit/, '');
}

/** The glyph for a key code on this device, or null where no glyph is wanted (a phone has buttons, not keys). */
export function keyGlyph(code: string, device: ControlDevice, padId: string | null = null): string | null {
  if (device === 'touch') return null;
  if (device === 'keys') return keyLabel(code);
  const button = PAD_BUTTON_OF.get(code);
  return button === undefined ? null : padLabel(padFamily(padId), button);
}

/** The pad button that fires, for prompts. */
export function fireGlyph(padId: string | null): string {
  const button = PAD_BUTTON_OF.get(PAD_FIRE);
  return button === undefined ? 'RT' : padLabel(padFamily(padId), button);
}
