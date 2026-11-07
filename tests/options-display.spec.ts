import { afterEach, describe, expect, it } from 'vitest';
import { Mixer } from '../src/audio/mixer.ts';
import { hitPalette, HIT_PALETTES, setHitPalette } from '../src/engine/hit-palette.ts';
import { DEFAULT_DISPLAY, loadDisplayPrefs, saveDisplayPrefs } from '../src/game/display-prefs.ts';
import type { Store } from '../src/game/storage.ts';
import { scaledUnit } from '../src/game/view-fit.ts';

function memoryStore(): Store {
  const items = new Map<string, string>();
  return { getItem: (k) => items.get(k) ?? null, setItem: (k, v) => void items.set(k, v) };
}

describe('display prefs', () => {
  it('round-trips the palette and UI size', () => {
    const store = memoryStore();
    saveDisplayPrefs(store, { palette: 'clear', uiScale: 'larger' });
    expect(loadDisplayPrefs(store)).toEqual({ palette: 'clear', uiScale: 'larger' });
  });

  it('falls back to defaults for missing or unknown values', () => {
    const store = memoryStore();
    expect(loadDisplayPrefs(store)).toEqual(DEFAULT_DISPLAY);
    store.setItem('outbreak.display', JSON.stringify({ palette: 'neon', uiScale: 'huge' }));
    expect(loadDisplayPrefs(store)).toEqual(DEFAULT_DISPLAY);
    expect(loadDisplayPrefs(null)).toEqual(DEFAULT_DISPLAY);
  });
});

describe('hit palette', () => {
  afterEach(() => setHitPalette('classic'));

  it('switches the canvas colors', () => {
    setHitPalette('clear');
    expect(hitPalette()).toBe(HIT_PALETTES.clear);
  });

  it('the colorblind pair does not use red or green for danger and health', () => {
    const { danger, safe } = HIT_PALETTES.clear;
    expect(danger).not.toBe(HIT_PALETTES.classic.danger);
    expect(safe).not.toBe(HIT_PALETTES.classic.safe);
  });
});

describe('UI scale', () => {
  it('grows the unit in half pixels', () => {
    expect(scaledUnit(2, 1)).toBe(2);
    expect(scaledUnit(2, 1.25)).toBe(2.5);
    expect(scaledUnit(1.5, 1.5)).toBe(2.5);
  });
});

describe('Mixer buses', () => {
  function gains(buses: { music: number; sfx: number }): number[] {
    const made: { gain: { value: number } }[] = [];
    const node = () => ({ connect() {} });
    const ctx = {
      destination: {},
      createGain: () => {
        const g = { gain: { value: 1 }, connect() {} };
        made.push(g);
        return g;
      },
      createDynamicsCompressor: () => ({ ...node(), threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} }),
      createWaveShaper: node,
      createBiquadFilter: () => ({ ...node(), frequency: {} }),
    };
    new Mixer(ctx as unknown as AudioContext, 1, buses);
    return made.slice(0, 3).map((g) => g.gain.value);
  }

  it('starts each bus at its saved share', () => {
    const [sfx, bed, tracks] = gains({ music: 0.5, sfx: 0.25 });
    const [, fullBed, fullTracks] = gains({ music: 1, sfx: 1 });
    expect(sfx).toBe(0.25);
    expect(bed).toBeCloseTo(fullBed * 0.5);
    expect(tracks).toBeCloseTo(fullTracks * 0.5);
  });

  it('silences music alone at zero', () => {
    const [sfx, bed, tracks] = gains({ music: 0, sfx: 1 });
    expect([sfx, bed, tracks]).toEqual([1, 0, 0]);
  });
});
