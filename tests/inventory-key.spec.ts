import { describe, expect, it } from 'vitest';
import { isInventoryKey } from '../src/game/inventory-modal.ts';

/** The inventory's own keys are I and B; the second argument is the codes the player has rebound elsewhere. */
const INVENTORY = ['KeyI', 'KeyB'];

describe('isInventoryKey', () => {
  const press = (over: Partial<Parameters<typeof isInventoryKey>[0]> = {}) => ({ code: 'KeyI', repeat: false, ctrlKey: false, metaKey: false, altKey: false, target: null, ...over });

  it('takes a bare I', () => {
    expect(isInventoryKey(press(), INVENTORY, [])).toBe(true);
  });

  it('takes a bare B too', () => {
    expect(isInventoryKey(press({ code: 'KeyB' }), INVENTORY, [])).toBe(true);
  });

  it('leaves I or B alone when the player has rebound that one', () => {
    expect(isInventoryKey(press({ code: 'KeyB' }), INVENTORY, ['KeyB'])).toBe(false);
    expect(isInventoryKey(press({ code: 'KeyB' }), INVENTORY, ['KeyI'])).toBe(true);
    expect(isInventoryKey(press(), INVENTORY, ['KeyB'])).toBe(true);
  });

  it('ignores other keys, repeats, shortcuts and a key the player has rebound', () => {
    expect(isInventoryKey(press({ code: 'KeyO' }), INVENTORY, [])).toBe(false);
    expect(isInventoryKey(press({ repeat: true }), INVENTORY, [])).toBe(false);
    expect(isInventoryKey(press({ ctrlKey: true }), INVENTORY, [])).toBe(false);
    expect(isInventoryKey(press(), INVENTORY, ['KeyI'])).toBe(false);
  });
});
