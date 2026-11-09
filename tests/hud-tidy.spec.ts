import { describe, expect, it } from 'vitest';
import { ammoState, ammoWarning } from '../src/game/hud-state.ts';
import { BiteTracker, angleGap, isUnseen } from '../src/game/bite-marker.ts';

const dry = { owned: ['pistol'], ammoBag: { pistol: 0 }, mags: { pistol: 0 } } as unknown as Parameters<typeof ammoState>[0];

describe('ammoWarning', () => {
  it('warns of an empty gun in town and stays quiet in the bunker', () => {
    expect(ammoWarning({ ...dry, level: 1 })).toBe('empty');
    expect(ammoWarning({ ...dry, level: 0 })).toBe('ok');
    expect(ammoWarning(dry)).toBe('empty');
  });
});

describe('bite marker', () => {
  it('measures the turn between two angles the short way round', () => {
    expect(angleGap(0.1, -0.1)).toBeCloseTo(0.2);
    expect(angleGap(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
  });

  it('calls only what is behind or beside the player unseen', () => {
    expect(isUnseen(0, 0, 0, 50, 0)).toBe(false);
    expect(isUnseen(0, 0, 0, -50, 0)).toBe(true);
    expect(isUnseen(0, 0, 0, 0, 50)).toBe(true);
  });

  it('marks a bite from behind, whichever order the snapshot lists it', () => {
    const a = new BiteTracker();
    expect(a.attacked(-30, 0, 100, 0)).toBeNull();
    expect(a.hurtLocal(0, 0, 100, 0)).toMatchObject({ angle: Math.PI });
    const b = new BiteTracker();
    expect(b.hurtLocal(0, 0, 100, 0)).toBeNull();
    expect(b.attacked(0, 30, 120, 0)).toMatchObject({ angle: Math.PI / 2 });
  });

  it('stays quiet for a bite from the front, a far zombie or a stale attack', () => {
    expect(new BiteTracker().attacked(30, 0, 0, 0) ?? new BiteTracker().hurtLocal(0, 0, 0, 0)).toBeNull();
    const front = new BiteTracker();
    front.attacked(30, 0, 100, 0);
    expect(front.hurtLocal(0, 0, 100, 0)).toBeNull();
    const far = new BiteTracker();
    far.attacked(-500, 0, 100, 0);
    expect(far.hurtLocal(0, 0, 100, 0)).toBeNull();
    const stale = new BiteTracker();
    stale.attacked(-30, 0, 0, 0);
    expect(stale.hurtLocal(0, 0, 1000, 0)).toBeNull();
  });
});
