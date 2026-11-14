import { describe, expect, it } from 'vitest';
import { ORIGINAL_RELEASE_DATE } from '../src/game/release.ts';
import { CAMP_RESET_KEY, SETTINGS_KEYS, SETTINGS_RESET_KEY, resetOlderSettings } from '../src/game/settings-reset.ts';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe('the original release reset', () => {
  it('is Friday the 13th', () => {
    expect(ORIGINAL_RELEASE_DATE).toBe('2026-11-13');
    expect(new Date(`${ORIGINAL_RELEASE_DATE}T12:00:00Z`).getUTCDay()).toBe(5);
  });

  it('clears an older browser\'s settings and controls once, and keeps progress and consent', () => {
    const store = memory({
      'outbreak.controls.keys': '{"map":"KeyM"}',
      'outbreak.display': '{}',
      'outbreak.analytics-consent': 'yes',
      'outbreak.best.v2': '9',
    });
    expect(resetOlderSettings(store)).toBe(true);
    for (const key of SETTINGS_KEYS) expect(store.data.has(key)).toBe(false);
    expect(store.data.get('outbreak.analytics-consent')).toBe('yes');
    expect(store.data.get('outbreak.best.v2')).toBe('9');
    expect(store.data.get(SETTINGS_RESET_KEY)).toBe(ORIGINAL_RELEASE_DATE);
    store.setItem('outbreak.display', '{"later":1}');
    expect(resetOlderSettings(store)).toBe(false);
    expect(store.data.get('outbreak.display')).toBe('{"later":1}');
  });

  it('names a separate marker for the camp', () => {
    expect(CAMP_RESET_KEY).not.toBe(SETTINGS_RESET_KEY);
  });
});
