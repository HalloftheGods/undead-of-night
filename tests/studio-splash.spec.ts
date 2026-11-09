import { describe, expect, it } from 'vitest';
import { SPLASH_CARDS, STUDIO_LINE, shouldShowSplash, splashTimings, studioLine } from '../src/game/studio-splash.ts';

describe('the studio splash', () => {
  it('fades in and out, and only holds for someone who wants less motion', () => {
    expect(splashTimings(false)).toEqual({ fadeIn: 400, hold: 1600, fadeOut: 500 });
    expect(splashTimings(true)).toEqual({ fadeIn: 0, hold: 1000, fadeOut: 0 });
  });

  it('sequences Hall of the Gods, For The XP, and Majora D. cards in order', () => {
    expect(SPLASH_CARDS.map(card => card.id)).toEqual(['hall-of-the-gods', 'for-the-xp', 'majora-d']);
  });

  it('sets matching purple background for Majora D', () => {
    const majora = SPLASH_CARDS.find(card => card.id === 'majora-d');
    expect(majora?.bg).toBe('#110a25');
  });

  it('configures short hold for Hall of the Gods transition', () => {
    const hog = SPLASH_CARDS.find(card => card.id === 'hall-of-the-gods');
    expect(hog?.hold).toBe(400);
  });

  it('carries one studio line, from 2006 to the build year', () => {
    expect(studioLine(2031)).toBe('© 2006–2031 Hall of the Gods, Inc.');
    // vitest.config.ts stamps __BUILD_YEAR__ as 2026; the line follows the build, not the clock.
    expect(STUDIO_LINE).toBe('© 2006–2026 Hall of the Gods, Inc.');
  });

  it('shows unless the address says not to', () => {
    expect(shouldShowSplash('')).toBe(true);
    expect(shouldShowSplash('?seed=4')).toBe(true);
    expect(shouldShowSplash('?nosplash')).toBe(false);
    expect(shouldShowSplash('?seed=4&nosplash=1')).toBe(false);
  });
});
