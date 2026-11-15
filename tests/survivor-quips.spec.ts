import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHARACTERS } from '../shared/characters.ts';
import { createDefaultSurvivalNeeds, type SurvivalNeeds } from '../shared/survival-needs.ts';
import { glyphRows } from '../src/engine/bitmap-font.ts';
import { textWidth } from '../src/engine/bitmap-font.ts';
import { buttonLabel } from '../src/engine/held-ui.ts';
import { outlineRgba } from '../src/engine/sprite-cache.ts';
import { GamepadInput, PAD } from '../src/game/gamepad-input.ts';
import type { GamepadHost } from '../src/game/gamepad-input.ts';
import { judgeItem, survivorReaction, type QuipSurvivor } from '../src/game/inventory/survivor-quips.ts';
import { VOICES } from '../src/game/inventory/survivor-voices.ts';
import { installFakeBrowser } from './client-fake-dom.ts';

function survivor(needs: Partial<SurvivalNeeds> = {}, health = 100, skin = 0): QuipSurvivor {
  return { skin, health, maxHealth: 100, needs: { ...createDefaultSurvivalNeeds(), ...needs } };
}

describe('how a survivor takes the item in hand', () => {
  it('wants food when hungry, shrugs when peckish, refuses when full', () => {
    expect(judgeItem('canned_food', true, survivor({ hunger: 60 }))).toEqual({ mood: 'need', reason: 'hunger' });
    expect(judgeItem('canned_food', true, survivor({ hunger: 10 })).mood).toBe('fine');
    expect(judgeItem('canned_food', true, survivor()).mood).toBe('full');
    // Food still mends a little health, so a hurt but fed survivor will take it.
    expect(judgeItem('canned_food', true, survivor({}, 70)).mood).toBe('fine');
  });

  it('wants water when thirsty and refuses it when not', () => {
    expect(judgeItem('water_bottle', true, survivor({ thirst: 40 }))).toEqual({ mood: 'need', reason: 'thirst' });
    expect(judgeItem('water_bottle', true, survivor()).mood).toBe('full');
  });

  it('matches each remedy to its own trouble', () => {
    expect(judgeItem('bandage', true, survivor({ bleeding: true })).reason).toBe('bleed');
    expect(judgeItem('bandage', true, survivor()).mood).toBe('full');
    expect(judgeItem('disinfectant', true, survivor({ wound: 'scratch' })).reason).toBe('wound');
    expect(judgeItem('disinfectant', true, survivor()).mood).toBe('full');
    expect(judgeItem('antibiotics', true, survivor({ isInfected: true })).reason).toBe('sick');
    expect(judgeItem('antibiotics', true, survivor()).mood).toBe('full');
  });

  it('needs a medkit when badly hurt, takes it when scratched, refuses at full health', () => {
    expect(judgeItem('medkit', true, survivor({}, 40)).reason).toBe('hurt');
    expect(judgeItem('medkit', true, survivor({}, 90)).mood).toBe('fine');
    expect(judgeItem('medkit', true, survivor()).mood).toBe('full');
  });

  it('cannot use an item that has no use', () => {
    expect(judgeItem('canned_food', false, survivor({ hunger: 90 })).mood).toBe('cant');
  });

  it('keeps the same line for the same item, in the survivor own voice', () => {
    const a = survivorReaction('canned_food', 'item-7', true, survivor({ hunger: 60 }, 100, 1));
    const b = survivorReaction('canned_food', 'item-7', true, survivor({ hunger: 60 }, 100, 1));
    expect(a.line).toBe(b.line);
    expect(VOICES[1].hunger).toContain(a.line);
  });
});

describe('the voices', () => {
  it('gives every survivor a voice', () => {
    expect(VOICES).toHaveLength(CHARACTERS.length);
  });

  it('only uses letters the canvas font has, and stays short enough to fit', () => {
    const fallback = glyphRows('?');
    for (const voice of VOICES) {
      for (const lines of Object.values(voice)) {
        expect(lines.length).toBeGreaterThan(0);
        for (const line of lines) {
          for (const char of line) if (char !== '?') expect(glyphRows(char), `${char} in ${line}`).not.toBe(fallback);
          expect(textWidth(line), line).toBeLessThanOrEqual(110);
        }
      }
    }
  });
});

describe('the survivor highlight rim', () => {
  it('rings the opaque pixels, one pixel out, and leaves the inside clear', () => {
    // A single opaque pixel: the rim is the four pixels around it in a 3x3.
    const sprite = { w: 1, h: 1, ax: 0, ay: 0, rgba: new Uint8ClampedArray([1, 2, 3, 255]) };
    const rim = outlineRgba(sprite as never, [10, 20, 30]);
    const alpha = (x: number, y: number) => rim[(y * 3 + x) * 4 + 3];
    expect([alpha(1, 0), alpha(0, 1), alpha(2, 1), alpha(1, 2)]).toEqual([255, 255, 255, 255]);
    expect([alpha(1, 1), alpha(0, 0), alpha(2, 2)]).toEqual([0, 0, 0]);
  });
});

describe('the held buttons on a pad', () => {
  it('names the trigger that presses each button', () => {
    const keys = { use: 'RT', drop: 'LT' };
    expect(buttonLabel({ kind: 'use', label: 'EAT' }, keys)).toBe('[RT] EAT');
    expect(buttonLabel({ kind: 'drop', label: 'DROP' }, keys)).toBe('[LT] DROP');
    expect(buttonLabel({ kind: 'use', label: 'EAT' }, null)).toBe('EAT');
  });
});

describe('the triggers behind a loot screen', () => {
  let input: GamepadInput | null = null;
  afterEach(() => {
    input?.dispose();
    vi.unstubAllGlobals();
  });

  it('offer RT and LT to the screen, which uses and drops the item in hand', () => {
    installFakeBrowser();
    const taken: string[] = [];
    let pads: Gamepad[] = [];
    const host: GamepadHost = {
      live: () => false,
      inCharge: () => true,
      press() {},
      confirm() {},
      back() {},
      navigate() {},
      take: (button) => {
        taken.push(button);
        return true;
      },
      onActive() {},
    };
    vi.stubGlobal('navigator', { getGamepads: () => pads });
    input = new GamepadInput(host, { now: () => 1000 });
    const press = (index: number) => {
      const buttons = Array.from({ length: 17 }, (_, i) => ({ pressed: i === index, touched: i === index, value: i === index ? 1 : 0 }));
      pads = [{ id: 'Xbox (STANDARD GAMEPAD Vendor: 045e)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons, timestamp: 0 } as unknown as Gamepad];
      input!.poll();
      pads = [];
      input!.poll();
    };
    press(PAD.rt);
    press(PAD.lt);
    expect(taken).toEqual(['rt', 'lt']);
  });
});
