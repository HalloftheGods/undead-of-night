import { describe, expect, it } from 'vitest';
import { CAST, CREDITS, LEAD_SECONDS, SECONDS_PER_LINE, creditsSeconds } from '../src/game/credits.ts';

const texts = CREDITS.map((line) => line.text);

describe('the end credits', () => {
  it('name the game, the studio, the composer and the whole cast', () => {
    expect(texts).toContain('Undead of Night: Take One');
    expect(texts).toContain('Hall of the Gods, Inc.');
    expect(texts).not.toContain('ExoticService');
    expect(texts).toContain('Majora D.');
    expect(CAST).toEqual(['Night', 'Bear', 'Kat', 'Rex', 'Rich']);
    for (const name of CAST) expect(texts).toContain(name);
  });

  it('open on the title and run longer the more lines there are', () => {
    expect(CREDITS[0].kind).toBe('title');
    expect(creditsSeconds()).toBe(LEAD_SECONDS + CREDITS.length * SECONDS_PER_LINE);
    expect(creditsSeconds(CREDITS.slice(0, 2))).toBeLessThan(creditsSeconds());
  });
});