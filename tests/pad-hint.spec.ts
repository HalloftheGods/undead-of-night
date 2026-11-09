import { describe, expect, it } from 'vitest';
import { PAD } from '../src/game/gamepad-input.ts';
import { fillPadPrompt, padLabel, promptFor } from '../src/game/pad-glyphs.ts';
import { PAD_READY_LINE, PAD_UNSUPPORTED_LINE, padHintLines, summarisePads } from '../src/game/pad-hint.ts';

const XBOX = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)';
const DUALSENSE = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)';
const SWITCH = 'Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)';

describe('pad words in a prompt', () => {
  it('writes each family its own button names', () => {
    expect(fillPadPrompt('Press {a} to search, {b} to heal', XBOX)).toBe('Press A to search, B to heal');
    expect(fillPadPrompt('Press {a} to search, {b} to heal', DUALSENSE)).toBe('Press Cross to search, Circle to heal');
    expect(fillPadPrompt('Press {a} to search, {b} to heal', SWITCH)).toBe('Press B to search, A to heal');
  });

  it('names the shoulder, trigger, menu and D-pad buttons', () => {
    expect(fillPadPrompt('{rt} {lb} {start} {up}', XBOX)).toBe('RT LB Menu D-pad Up');
    expect(fillPadPrompt('{rt} {lb} {start} {view}', DUALSENSE)).toBe('R2 L1 Options Create');
    expect(fillPadPrompt('{rt} {lb} {start} {view}', SWITCH)).toBe('ZR L + -');
  });

  it('agrees with padLabel button for button', () => {
    expect(fillPadPrompt('{y}', DUALSENSE)).toBe(padLabel('playstation', PAD.y));
  });

  it('falls back to Xbox words with no pad id', () => {
    expect(fillPadPrompt('{a}/{b}', null)).toBe('A/B');
  });

  it('leaves anything that is not a button name as written', () => {
    expect(fillPadPrompt('{nope} {A} {} {a}', XBOX)).toBe('{nope} {A} {} A');
    expect(fillPadPrompt('no tokens here', XBOX)).toBe('no tokens here');
    expect(fillPadPrompt('{toString} {constructor}', XBOX)).toBe('{toString} {constructor}');
  });

  it('picks the words for the hand in charge', () => {
    const words = { keys: 'Press E to search', pad: 'Press {a} to search' };
    expect(promptFor('keyboard', words, XBOX)).toBe('Press E to search');
    expect(promptFor('touch', words, XBOX)).toBe('Press E to search');
    expect(promptFor('gamepad', words, DUALSENSE)).toBe('Press Cross to search');
  });
});

describe('the title controller hint', () => {
  const pad = (id: string, mapping = 'standard') => ({ id, mapping });

  it('is empty for a player with no pad, so keyboard players see nothing extra', () => {
    expect(padHintLines(summarisePads([]))).toEqual([]);
  });

  it('says the pad is ready and names its confirm, back and pause buttons', () => {
    expect(padHintLines(summarisePads([pad(XBOX)]))).toEqual([PAD_READY_LINE, 'A: confirm   B: back   Menu: pause']);
    expect(padHintLines(summarisePads([pad(DUALSENSE)]))[1]).toBe('Cross: confirm   Circle: back   Options: pause');
    expect(padHintLines(summarisePads([pad(SWITCH)]))[1]).toBe('B: confirm   A: back   +: pause');
  });

  it('says a pad it cannot map is not recognised', () => {
    expect(padHintLines(summarisePads([pad('Generic USB Joystick', '')]))).toEqual([PAD_UNSUPPORTED_LINE]);
  });

  it('prefers a standard pad that sits beside an unmapped one', () => {
    const seen = summarisePads([pad('Generic USB Joystick', ''), pad(DUALSENSE)]);
    expect(seen).toEqual({ id: DUALSENSE, unsupportedId: 'Generic USB Joystick' });
    expect(padHintLines(seen)[0]).toBe(PAD_READY_LINE);
  });
});
