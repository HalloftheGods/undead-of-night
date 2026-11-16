import { describe, expect, it } from 'vitest';
import { careHint, careTargetAt, setCareOffer } from '../src/game/inventory/care-hover.ts';
import { createDefaultSurvivalNeeds } from '../shared/survival-needs.ts';

const me = { id: 'me', x: 100, y: 100 };

const mate = (over: Record<string, unknown> = {}) => ({
  id: 'ally',
  name: 'Sam',
  x: 120,
  y: 100,
  health: 100,
  maxHealth: 100,
  status: 'alive' as const,
  needs: { ...createDefaultSurvivalNeeds(), bleeding: true },
  ...over,
});

describe('careHint', () => {
  it('names a bleeding teammate in reach for a bandage', () => {
    expect(careHint({ type: 'bandage' }, [mate()], me)).toEqual({ id: 'ally', label: 'Bandage Sam', inReach: true });
  });

  it('marks a teammate out of reach', () => {
    expect(careHint({ type: 'bandage' }, [mate({ x: 300 })], me)).toEqual({ id: 'ally', label: 'Bandage Sam', inReach: false });
  });

  it('is null when the item would do nothing for them', () => {
    expect(careHint({ type: 'canned_food' }, [mate({ needs: createDefaultSurvivalNeeds() })], me)).toBeNull();
    expect(careHint({ type: 'pistol' }, [mate()], me)).toBeNull();
  });
});

describe('careTargetAt', () => {
  it('hands to the offered teammate only when the click is on them and in reach', () => {
    setCareOffer({ id: 'ally', label: 'Heal Sam', inReach: true }, [{ id: 'ally', x: 10, y: 10, w: 20, h: 30 }]);
    expect(careTargetAt(15, 20)).toEqual({ kind: 'player', id: 'ally' });
    expect(careTargetAt(100, 100)).toBeNull();
    setCareOffer({ id: 'ally', label: 'Heal Sam', inReach: false }, [{ id: 'ally', x: 10, y: 10, w: 20, h: 30 }]);
    expect(careTargetAt(15, 20)).toBeNull();
    setCareOffer(null, []);
  });
});
