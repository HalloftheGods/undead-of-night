import { describe, expect, it } from 'vitest';
import { startFlow } from '../src/game/play-flow.ts';
import { closeLevelSetter, closePage, closePlay, INVITE_LANDING, openLevelSetter, openPage, pickLevel, TITLE_HOME } from '../src/game/title-nav.ts';
import type { TitleNav } from '../src/game/title-nav.ts';

/** What the Play page is told to start from, as the title screen passes it. */
const walkOf = (nav: TitleNav) => startFlow(nav.invited, nav.startLevel);

describe('title navigation', () => {
  it('an invite link lands on Play with the room deciding the style', () => {
    expect(INVITE_LANDING).toEqual({ page: 'play', invited: true, startLevel: null, fromBooks: false });
    expect(walkOf(INVITE_LANDING)).toMatchObject({ mode: 'multi' });
  });

  it('backing out of an invited Play page settles the invite: Play from a title button is a plain visit that starts on the mode, with no Style step', () => {
    const backAtTitle = closePlay(INVITE_LANDING);
    expect(backAtTitle).toEqual(TITLE_HOME);
    const playAgain = openPage(backAtTitle, 'play');
    expect(playAgain.invited).toBe(false);
    expect(walkOf(playAgain)).toMatchObject({ mode: 'solo' });
  });

  it('a level picked after an invite was backed out of starts Arcade at that level, not the invite\'s walk', () => {
    const afterBack = closePlay(INVITE_LANDING);
    const levels = openPage(afterBack, 'levels');
    const picked = pickLevel(levels, 4);
    expect(picked).toEqual({ page: 'play', invited: false, startLevel: 4, fromBooks: false });
    expect(walkOf(picked)).toMatchObject({ mode: 'solo' });
  });

  it('any other page closing also settles an invite that was left standing', () => {
    expect(closePage({ page: 'records', invited: true, startLevel: null, fromBooks: false })).toEqual(TITLE_HOME);
  });

  it('backing out of Play after picking a level returns to the Levels page and forgets the level', () => {
    const picked = pickLevel(openPage(TITLE_HOME, 'levels'), 3);
    expect(closePlay(picked)).toEqual({ page: 'levels', invited: false, startLevel: null, fromBooks: false });
  });

  it('the Level card opens the Levels page in setting mode for its style, and backing out returns to Play, not the title', () => {
    const setting = openLevelSetter(openPage(TITLE_HOME, 'play'), 'campaign');
    expect(setting).toMatchObject({ page: 'levels', settingLevel: 'campaign' });
    expect(closeLevelSetter(setting)).toMatchObject({ page: 'play', settingLevel: undefined, startLevel: null });
  });

  it('backing out of Play opened from the Level card goes to the title, since no level was picked to start from', () => {
    const back = closePlay(closeLevelSetter(openLevelSetter(openPage(TITLE_HOME, 'play'), 'arcade')));
    expect(back).toMatchObject({ page: null, startLevel: null });
  });
});
