import { describe, expect, it } from 'vitest';
import type { PlayerEntity } from '../shared/protocol.ts';
import type { SurvivalNeeds } from '../shared/survival-needs.ts';
import { teammateMoodlePlacements, worstMoodle } from '../src/engine/teammate-moodles.ts';

function needs(overrides: Partial<SurvivalNeeds> = {}): SurvivalNeeds {
  return {
    hunger: 0,
    thirst: 0,
    fatigue: 0,
    wound: 'none',
    bleeding: false,
    bleedTimer: 0,
    infection: 0,
    isInfected: false,
    ...overrides
  } as SurvivalNeeds;
}

describe('the worst moodle over a teammate', () => {
  it('shows nothing when no ailment is active', () => {
    expect(worstMoodle(needs())).toBeNull();
    expect(worstMoodle(undefined)).toBeNull();
  });

  it('lets bleeding beat hunger', () => {
    expect(worstMoodle(needs({ hunger: 90, bleeding: true, wound: 'laceration' }))).toBe('bleeding');
  });

  it('ranks infection over thirst and hunger, and thirst over hunger', () => {
    expect(worstMoodle(needs({ hunger: 90, thirst: 90, isInfected: true, infection: 50 }))).toBe('infection');
    expect(worstMoodle(needs({ hunger: 90, thirst: 90 }))).toBe('thirst');
  });

  it('falls back to fatigue when it is the only ailment', () => {
    expect(worstMoodle(needs({ fatigue: 90 }))).toBe('fatigue');
  });
});

describe('which teammates get a moodle', () => {
  const spot = {
    left: 0,
    top: 0,
    viewW: 800,
    viewH: 600,
    heightOf: () => 20,
    headroomOf: () => 0
  };

  function player(id: string, x: number, y: number, playerNeeds?: SurvivalNeeds): PlayerEntity {
    return { id, x, y, needs: playerNeeds } as unknown as PlayerEntity;
  }

  it('never draws the local player', () => {
    const scene = {
      localId: 'me',
      players: [player('me', 100, 100, needs({ bleeding: true })), player('mate', 200, 200, needs({ bleeding: true }))]
    };
    const placed = teammateMoodlePlacements(scene, spot, 16, 16);
    expect(placed.map((each) => each.x)).toEqual([200]);
  });

  it('skips teammates with no ailment', () => {
    const scene = { localId: 'me', players: [player('mate', 200, 200, needs())] };
    expect(teammateMoodlePlacements(scene, spot, 16, 16)).toEqual([]);
  });

  it('places the icon above the head, under where the speech bubble sits', () => {
    const scene = { localId: 'me', players: [player('mate', 200, 200, needs({ thirst: 90 }))] };
    const [placed] = teammateMoodlePlacements(scene, spot, 16, 16);
    expect(placed).toEqual({ id: 'thirst', x: 200, y: 200 - 20 - 30 });
  });

  it('leaves out a teammate who is off screen', () => {
    const scene = { localId: 'me', players: [player('mate', -500, 200, needs({ thirst: 90 }))] };
    expect(teammateMoodlePlacements(scene, spot, 16, 16)).toEqual([]);
  });
});
