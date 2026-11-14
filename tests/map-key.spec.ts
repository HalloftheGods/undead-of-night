import { beforeAll, describe, expect, it, vi } from 'vitest';
import { mapKey, YOU_ARE_HERE } from '../src/game/map-key.ts';
import { CURSOR_ICON } from '../src/game/map-markers.ts';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';

const titles = (inBunker: boolean) => mapKey(inBunker).groups.map((group) => group.title);
const labels = (inBunker: boolean) => mapKey(inBunker).groups.flatMap((group) => group.entries.map((entry) => entry.label));

describe('the map key', () => {
  beforeAll(() => installFakeBrowser());

  it('calls the town a town map and groups its key into marks, places, things on the way and supplies left behind', () => {
    const key = mapKey(false);
    expect(key.title).toBe('Town map');
    expect(titles(false)).toEqual(['Your marks', 'Places', 'On the way', 'Left behind']);
    expect(labels(false)).toEqual([
      'You are here', 'Been inside', 'Cleared and searched',
      'Medical', 'Police', 'Guns', 'Food', 'Garages and yards', 'School', 'Homes', 'S.O.S. Fireworks bus',
      'The van, once it comes', 'A supply drop',
      'Medical', 'Ammo', 'A weapon', 'Planks and tools', 'Food and water', 'Parts and finds',
    ]);
  });

  it('calls the camp a camp map, with no town places and no town marks', () => {
    const key = mapKey(true);
    expect(key.title).toBe('Camp map');
    expect(labels(true)).toEqual(['You are here', 'Stations']);
    expect(labels(true).join(' ')).not.toMatch(/town|van|medical|police|inside/i);
  });

  it('lists the blinking cursor first on both maps', () => {
    for (const inBunker of [false, true]) {
      expect(mapKey(inBunker).groups[0].entries[0]).toBe(YOU_ARE_HERE);
      expect(YOU_ARE_HERE.icon).toBe(CURSOR_ICON);
    }
  });

  it('colours the words of the check and cross the way the map does', () => {
    const tones = mapKey(false).groups[0].entries.map((entry) => entry.tone);
    expect(tones).toEqual([undefined, 'tick', 'cross']);
  });

  it('paints every icon inside its own size', () => {
    for (const inBunker of [false, true]) {
      for (const { icon } of mapKey(inBunker).groups.flatMap((group) => group.entries)) {
        const ctx = fakeCanvas().getContext() as unknown as CanvasRenderingContext2D;
        const fills = vi.spyOn(ctx, 'fillRect');
        icon.paint(ctx);
        expect(fills).toHaveBeenCalled();
        for (const [x, y, w, h] of fills.mock.calls) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x + w).toBeLessThanOrEqual(icon.w);
          expect(y + h).toBeLessThanOrEqual(icon.h);
        }
      }
    }
  });

  it('says the run goes on for both solo and co-op', () => {
    expect(mapKey(false).waitNote('solo')).toBe('The town does not wait.');
    expect(mapKey(false).waitNote('coop')).toBe('The town does not wait.');
    expect(mapKey(true).waitNote('solo')).toBe('The camp does not wait.');
    expect(mapKey(true).waitNote('coop')).toBe('The camp does not wait.');
  });
});
