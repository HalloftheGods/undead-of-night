import { describe, expect, it } from 'vitest';
import { touchItems } from '../src/game/touch-items.ts';

const EMPTY = { bottles: 0, fireworks: 0, flares: 0, candy: [] };

describe('the item buttons', () => {
  it('are not there with nothing to throw or eat', () => {
    expect(touchItems(EMPTY)).toEqual([]);
  });

  it('come in bottle, firework, flare, candy order, with counts', () => {
    const items = touchItems({ bottles: 3, fireworks: 1, flares: 2, candy: ['Sour Skulls', 'Ghost Gum'] });
    expect(items.map((each) => [each.code, each.count])).toEqual([['KeyG', 3], ['KeyT', 1], ['KeyV', 2], ['KeyX', 2]]);
  });

  it('light a firework with no bottle carried', () => {
    const [firework] = touchItems({ ...EMPTY, fireworks: 1 });
    expect(firework).toMatchObject({ code: 'KeyT', label: 'Light a firework', art: 'fireworks' });
  });
});
