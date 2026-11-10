import { describe, expect, it } from 'vitest';
import { CHALLENGES, challengeDef, isChallengeId } from '../shared/challenges.ts';

describe('Challenge Scenarios System', () => {
  it('defines the core challenge presets', () => {
    expect(CHALLENGES.length).toBeGreaterThanOrEqual(4);
    expect(isChallengeId('winter_lockdown')).toBe(true);
    expect(isChallengeId('endless_stand')).toBe(true);
    expect(isChallengeId('one_shot')).toBe(true);
    expect(isChallengeId('fog_bound')).toBe(true);
    expect(isChallengeId('invalid_mode')).toBe(false);
  });

  it('correctly returns challenge definitions with overrides', () => {
    const winter = challengeDef('winter_lockdown');
    expect(winter.forcedBiome).toBe('tundra');
    expect(winter.forcedWeather).toBe('snow');
    expect(winter.startLevel).toBe(8);

    const oneShot = challengeDef('one_shot');
    expect(oneShot.playerHealthScale).toBe(0.1);
    expect(oneShot.zombieDamageScale).toBe(10.0);
  });
});
