import { describe, expect, it } from 'vitest';
import { isInventoryKey } from '../src/game/inventory-modal.ts';

describe('isInventoryKey', () => {
  const press = (over: Partial<Parameters<typeof isInventoryKey>[0]> = {}) => ({ code: 'KeyI', repeat: false, ctrlKey: false, metaKey: false, altKey: false, target: null, ...over });

  it('takes a bare I', () => {
    expect(isInventoryKey(press(), [])).toBe(true);
  });

  it('takes a bare B too', () => {
    expect(isInventoryKey(press({ code: 'KeyB' }), [])).toBe(true);
  });

  it('leaves I or B alone when the player has rebound that one', () => {
    expect(isInventoryKey(press({ code: 'KeyB' }), ['KeyB'])).toBe(false);
    expect(isInventoryKey(press({ code: 'KeyB' }), ['KeyI'])).toBe(true);
    expect(isInventoryKey(press(), ['KeyB'])).toBe(true);
  });

  it('ignores other keys, repeats, shortcuts and a key the player has rebound', () => {
    expect(isInventoryKey(press({ code: 'KeyO' }), [])).toBe(false);
    expect(isInventoryKey(press({ repeat: true }), [])).toBe(false);
    expect(isInventoryKey(press({ ctrlKey: true }), [])).toBe(false);
    expect(isInventoryKey(press(), ['KeyI'])).toBe(false);
  });
});
