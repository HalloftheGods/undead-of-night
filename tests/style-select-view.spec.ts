import { describe, expect, it } from 'vitest';
import { GAME_STYLES } from '../shared/game-style.ts';
import { modeFacts } from '../src/game/mode-select-view.ts';
import { STYLE_CARDS, styleFacts, styleIndex } from '../src/game/style-select-view.ts';

describe('style select view', () => {
  it('lists Arcade then Campaign, one card for each style', () => {
    expect(STYLE_CARDS.map((each) => each.style)).toEqual(['arcade', 'campaign']);
    expect([...STYLE_CARDS.map((each) => each.style)].sort()).toEqual([...GAME_STYLES].sort());
    expect(STYLE_CARDS.map((each) => each.label)).toEqual(['Arcade', 'Campaign']);
    expect(styleIndex('arcade')).toBe(0);
    expect(styleIndex('campaign')).toBe(1);
  });

  it('gives each card a line that names how it plays', () => {
    const [arcade, campaign] = STYLE_CARDS;
    expect(campaign.line).toMatch(/bunker/i);
    expect(arcade.line).toMatch(/ten levels/i);
  });

  it('lists the same rows in the same order for both styles, so the column never shifts', () => {
    const keys = (style: 'campaign' | 'arcade') => styleFacts(style).map((fact) => fact.key);
    expect(keys('campaign')).toEqual(keys('arcade'));
    expect(styleFacts('campaign').every((fact) => fact.value.length > 0)).toBe(true);
    const dying = (style: 'campaign' | 'arcade') => styleFacts(style).find((fact) => fact.key === 'dying')?.value;
    expect(dying('campaign')).not.toBe(dying('arcade'));
  });
});

describe('mode facts by style', () => {
  it('offers Continue from a level on solo Arcade only', () => {
    const resume = (mode: 'solo' | 'multi', style: 'campaign' | 'arcade') => modeFacts(mode, style).find((fact) => fact.key === 'continue')?.value;
    expect(resume('solo', 'arcade')).toBe('Yes');
    expect(resume('solo', 'campaign')).toBe('Arcade only');
    expect(resume('multi', 'arcade')).toBe('No');
    expect(resume('multi', 'campaign')).toBe('No');
  });

  it('keeps the old answer when no style is given', () => {
    expect(modeFacts('solo').find((fact) => fact.key === 'continue')?.value).toBe('Yes');
  });
});
