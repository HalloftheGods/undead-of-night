import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS } from '../shared/constants.ts';
import { MODE_CARDS, modeFacts, modeIndex, PLAYER_SLOTS } from '../src/game/mode-select-view.ts';

describe('mode select view', () => {
  it('lists Solo then Multiplayer', () => {
    expect(MODE_CARDS.map((each) => each.mode)).toEqual(['solo', 'multi']);
    expect(modeIndex('solo')).toBe(0);
    expect(modeIndex('multi')).toBe(1);
  });

  it('fills one player cell for solo and the room cap for co-op', () => {
    expect(PLAYER_SLOTS).toBe(MAX_PLAYERS);
    expect(modeFacts('solo')[0].filled).toBe(1);
    expect(modeFacts('multi')[0].filled).toBe(MAX_PLAYERS);
  });

  it('lists the same rows in the same order for both modes, so the column never shifts', () => {
    const keys = (mode: 'solo' | 'multi') => modeFacts(mode).map((fact) => fact.key);
    expect(keys('solo')).toEqual(keys('multi'));
    expect(modeFacts('solo').find((fact) => fact.key === 'continue')?.value).toBe('Yes');
    expect(modeFacts('multi', 'arcade', false).find((fact) => fact.key === 'server')?.value).toBe('Needed');
    expect(modeFacts('multi', 'arcade', true).find((fact) => fact.key === 'server')?.value).toBe('None');
  });

  it('makes no claim about a style the room has yet to pick: Continue says only that it is Arcade\'s', () => {
    const resume = (style: 'campaign' | 'arcade' | null) => modeFacts('solo', style).find((fact) => fact.key === 'continue')?.value;
    expect(resume('arcade')).toBe('Yes');
    expect(resume('campaign')).toBe('Arcade only');
    expect(resume(null)).toBe('Arcade only');
  });
});
