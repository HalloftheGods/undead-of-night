// The title's Press Any Key gate: the logo and one blinking line, then the menu. It asks once a page load,
// and never when a link already says where the player is going.

import { parseInvite } from './invite-link.ts';

/** The splash's skip flag also skips this, so a dev link lands straight on the menu. */
const SKIP_QUERY = 'nosplash';

/** Keys that only change another key, plus Tab, which keeps walking focus to the footer links. */
const NOT_A_PRESS = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'CapsLock',
  'Tab',
]);

let answeredThisLoad = false;

/** Whether the title should wait for a press. False after the first one, and on invite and no-splash links. */
export function shouldAskForPress(search: string): boolean {
  if (answeredThisLoad) return false;
  const hasInvite = parseInvite(search) !== null;
  const skipsIntro = new URLSearchParams(search).has(SKIP_QUERY);
  return !hasInvite && !skipsIntro;
}

/** The player pressed: the rest of this page load goes straight to the menu. */
export function markPressAnswered(): void {
  answeredThisLoad = true;
}

/** For tests: forget the press, as a fresh page load would. */
export function resetPressAnswered(): void {
  answeredThisLoad = false;
}

export interface KeyPress {
  readonly code: string;
  readonly repeat: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
}

/** A fresh key on its own counts. A held key, a modifier, Tab or a browser shortcut does not. */
export function isWakingKey(event: KeyPress): boolean {
  const isShortcut = event.ctrlKey || event.metaKey || event.altKey;
  const isIgnored = event.repeat || isShortcut || NOT_A_PRESS.has(event.code);
  return !isIgnored;
}

/** What the line says: a phone has no keys. */
export function pressPrompt(touch: boolean): string {
  return touch ? 'Tap to start' : 'Press any key';
}

/**
 * Pad buttons that went down since the last read. A button already down the first time a pad is seen is held,
 * not pressed, so a press that skipped the splash cannot also answer the title.
 */
export class PadPressWatch {
  private readonly lastDown = new Map<number, readonly boolean[]>();

  /** True when any button on any pad went down since the last call. */
  pressed(pads: readonly { readonly index: number; readonly buttons: readonly { readonly pressed: boolean }[] }[]): boolean {
    let anyNew = false;
    for (const pad of pads) {
      const down = pad.buttons.map((button) => button.pressed);
      const before = this.lastDown.get(pad.index);
      const wentDown = before !== undefined && down.some((isDown, button) => isDown && !before[button]);
      if (wentDown) anyNew = true;
      this.lastDown.set(pad.index, down);
    }
    return anyNew;
  }
}
