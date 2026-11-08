import { describe, expect, it } from 'vitest';
import { touchItems } from '../src/game/touch-items.ts';

const EMPTY = { bottles: 0, fuel: 0, flares: 0, candy: [], sugar: [] };

describe('the item buttons', () => {
  it('are not there with nothing to throw or eat', () => {
    expect(touchItems(EMPTY)).toEqual([]);
  });

  it('come in bottle, molotov, flare, candy order, with counts', () => {
    const items = touchItems({ bottles: 3, fuel: 1, flares: 2, candy: ['Sour Skulls', 'Ghost Gum'], sugar: [] });
    expect(items.map((each) => [each.code, each.count])).toEqual([['KeyG', 3], ['KeyT', 1], ['KeyV', 2], ['KeyX', 2]]);
  });

  it('show a molotov with no bottle to pour into as not ready', () => {
    const [molotov] = touchItems({ ...EMPTY, fuel: 1 });
    expect(molotov).toMatchObject({ code: 'KeyT', ready: false });
  });

  it('offer a molotov with no fuel while Popping Eyeballs are working', () => {
    const items = touchItems({ ...EMPTY, bottles: 1, sugar: [{ name: 'Popping Eyeballs', left: 30 }] });
    expect(items.find((each) => each.code === 'KeyT')).toMatchObject({ ready: true, count: 0 });
  });
});
