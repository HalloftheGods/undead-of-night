import { describe, expect, it } from 'vitest';
import { DEATH_TIPS, nextDeathTip } from '../src/game/death-tips.ts';
import { retryPlan } from '../src/game/game-over-view.ts';
import type { Store } from '../src/game/storage.ts';

function memoryStore(): Store {
  const items = new Map<string, string>();
  return { getItem: (k) => items.get(k) ?? null, setItem: (k, v) => void items.set(k, v) };
}

describe('Game Over retry button', () => {
  it('solo Arcade tries the town you died in again, with Start over beside it past the first town', () => {
    expect(retryPlan({ mode: 'solo', runStyle: 'arcade', level: 3, daily: false })).toEqual({ label: 'Try again from Threetropolis', fromLevel: 3, startOver: true });
    expect(retryPlan({ mode: 'solo', runStyle: 'arcade', level: 1, daily: false })).toEqual({ label: 'Try again from Once Home', fromLevel: 1, startOver: false });
  });

  it('a Daily Night replays its own town', () => {
    expect(retryPlan({ mode: 'solo', runStyle: 'arcade', level: 4, daily: true })).toEqual({ label: 'Try again in Four Corners', fromLevel: undefined, startOver: false });
  });

  it('co-op and Campaign say only Play again, since they cannot pick the town', () => {
    expect(retryPlan({ mode: 'coop', runStyle: 'arcade', level: 5, daily: false })).toEqual({ label: 'Play again', fromLevel: undefined, startOver: false });
    expect(retryPlan({ mode: 'solo', runStyle: 'campaign', level: 2, daily: false })).toEqual({ label: 'Play again', fromLevel: undefined, startOver: false });
  });
});

describe('Game Over tip', () => {
  it('shows a different tip each death and wraps round the list', () => {
    const store = memoryStore();
    const shown = DEATH_TIPS.map(() => nextDeathTip(store));
    expect(new Set(shown).size).toBe(DEATH_TIPS.length);
    expect(nextDeathTip(store)).toBe(shown[0]);
  });

  it('starts at the first tip with no storage or a bad saved value', () => {
    const store = memoryStore();
    store.setItem('outbreak.deathTip', JSON.stringify('junk'));
    expect(nextDeathTip(store)).toBe(DEATH_TIPS[0]);
    expect(nextDeathTip(null)).toBe(DEATH_TIPS[0]);
  });
});
