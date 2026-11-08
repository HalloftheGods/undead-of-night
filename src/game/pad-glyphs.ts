// What to call each pad button on screen. Gamepad.id is the only clue to the brand, and it is
// free text that differs by browser, so this guesses from vendor ids and names, falls back to
// Xbox (the layout most PC pads copy), and leaves room for a manual pick in Options.

import { PAD } from './gamepad-input.ts';

export type PadFamily = 'xbox' | 'playstation' | 'nintendo';

const XBOX = /xbox|xinput|045e/i;
const PLAYSTATION = /054c|playstation|dualshock|dualsense/i;
/** 8BitDo pads print Nintendo-style letters; in X-input mode they say Xbox and are caught above. */
const NINTENDO = /057e|nintendo|pro controller|joy-con|2dc8|8bitdo/i;

/** The family whose labels to show for a pad id. Chrome: "... (STANDARD GAMEPAD Vendor: 054c ...)"; Firefox: "054c-0ce6-...". */
export function padFamily(id: string | null): PadFamily {
  if (!id) return 'xbox';
  if (XBOX.test(id)) return 'xbox';
  if (PLAYSTATION.test(id)) return 'playstation';
  if (NINTENDO.test(id)) return 'nintendo';
  return 'xbox';
}

const SHARED: Readonly<Record<number, string>> = {
  [PAD.up]: 'D-pad Up',
  [PAD.down]: 'D-pad Down',
  [PAD.left]: 'D-pad Left',
  [PAD.right]: 'D-pad Right',
};

const LABELS: Readonly<Record<PadFamily, Readonly<Record<number, string>>>> = {
  xbox: {
    [PAD.a]: 'A', [PAD.b]: 'B', [PAD.x]: 'X', [PAD.y]: 'Y',
    [PAD.lb]: 'LB', [PAD.rb]: 'RB', [PAD.lt]: 'LT', [PAD.rt]: 'RT',
    [PAD.view]: 'View', [PAD.start]: 'Menu', [PAD.l3]: 'LS', [PAD.r3]: 'RS',
  },
  playstation: {
    [PAD.a]: 'Cross', [PAD.b]: 'Circle', [PAD.x]: 'Square', [PAD.y]: 'Triangle',
    [PAD.lb]: 'L1', [PAD.rb]: 'R1', [PAD.lt]: 'L2', [PAD.rt]: 'R2',
    [PAD.view]: 'Create', [PAD.start]: 'Options', [PAD.l3]: 'L3', [PAD.r3]: 'R3',
  },
  // Standard mapping is by position: the bottom button is index 0, which Nintendo labels B.
  nintendo: {
    [PAD.a]: 'B', [PAD.b]: 'A', [PAD.x]: 'Y', [PAD.y]: 'X',
    [PAD.lb]: 'L', [PAD.rb]: 'R', [PAD.lt]: 'ZL', [PAD.rt]: 'ZR',
    [PAD.view]: '-', [PAD.start]: '+', [PAD.l3]: 'LS', [PAD.r3]: 'RS',
  },
};

/** The word for a standard-mapping button on this family's pad. TODO(glyphs): swap for drawn button art. */
export function padLabel(family: PadFamily, button: number): string {
  return LABELS[family][button] ?? SHARED[button] ?? `Button ${button}`;
}
