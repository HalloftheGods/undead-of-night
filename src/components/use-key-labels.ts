import { useGame } from './use-game.ts';
import { controlDevice, keyGlyph } from '../game/hud-keys.ts';
import { padFamily, padLabel } from '../game/input/pad-glyphs.ts';

export interface KeyLabels {
  /** The label of a key code on the device in charge, or null where it has none (touch, or a pad with nothing bound). */
  readKeyLabel(code: string): string | null;
  /** The name of a pad button (an index from PAD), for menus that take the pad's own buttons. */
  readButtonName(button: number): string;
  /** True while a pad is the device in charge. */
  readPadInCharge(): boolean;
}

/**
 * Key and button names read from the bindings, for labels drawn in components. Every label comes from
 * the controls page, never from a literal key.
 */
export function useKeyLabels(): KeyLabels {
  const game = useGame();
  const device = (): ReturnType<typeof controlDevice> => controlDevice(game.ui.value.touch, game.input.lastDevice);
  return {
    readKeyLabel: (code: string): string | null => keyGlyph(code, device(), game.input.gamepad.id),
    readButtonName: (button: number): string => padLabel(padFamily(game.input.gamepad.id), button),
    readPadInCharge: (): boolean => device() === 'pad',
  };
}
