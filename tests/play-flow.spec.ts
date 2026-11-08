import { describe, expect, it } from 'vitest';
import {
  chooseMode,
  claimedStyle,
  continuesAfterDeath,
  HOME_UNREADABLE,
  PLAY_JOIN,
  PLAY_LEVEL,
  PLAY_START,
  setupFailure,
  setupHeading,
  setupStyle,
  showsServer,
  showsStyleLabel,
  startFlow,
} from '../src/game/play-flow.ts';

describe('play flow', () => {
  it('opens solo, with no co-op fields and no Style pick: the title buttons chose the style', () => {
    expect(PLAY_START).toEqual({ mode: 'solo' });
    expect(showsServer(PLAY_START)).toBe(false);
  });

  it('shows the co-op fields once Multiplayer is chosen, and hides them again on Solo', () => {
    const multi = chooseMode(PLAY_START, 'multi');
    expect(multi).toEqual({ mode: 'multi' });
    expect(showsServer(multi)).toBe(true);
    expect(showsServer(chooseMode(multi, 'solo'))).toBe(false);
  });

  it('lands an invite link on Multiplayer', () => {
    expect(PLAY_JOIN).toEqual({ mode: 'multi' });
    expect(showsServer(PLAY_JOIN)).toBe(true);
  });

  it('lands a level picked on the Levels page on Solo', () => {
    expect(PLAY_LEVEL).toEqual({ mode: 'solo' });
  });

  it('opens from how the page was reached: an invite wins over a level', () => {
    expect(startFlow(false, null)).toBe(PLAY_START);
    expect(startFlow(true, null)).toBe(PLAY_JOIN);
    expect(startFlow(false, 4)).toBe(PLAY_LEVEL);
    expect(startFlow(true, 4)).toBe(PLAY_JOIN);
  });

  it('names the page for the run: its style, or Join a Game on an invite still set to Multiplayer', () => {
    expect(setupHeading(false, 'solo', 'arcade')).toBe('Arcade');
    expect(setupHeading(false, 'multi', 'campaign')).toBe('Campaign');
    expect(setupHeading(true, 'multi', 'campaign')).toBe('Join a Game');
    expect(setupHeading(true, 'solo', 'campaign')).toBe('Campaign');
  });

  it('plays Arcade when a level was picked and the remembered style otherwise', () => {
    expect(setupStyle(3, 'campaign')).toBe('arcade');
    expect(setupStyle(null, 'campaign')).toBe('campaign');
    expect(setupStyle(null, 'arcade')).toBe('arcade');
  });

  it('names no style on an invite link, where the room decides, and the remembered one otherwise', () => {
    expect(claimedStyle(true, 'campaign')).toBeNull();
    expect(claimedStyle(true, 'arcade')).toBeNull();
    expect(claimedStyle(false, 'campaign')).toBe('campaign');
    expect(claimedStyle(false, 'arcade')).toBe('arcade');
  });

  it('keeps a co-op failure off a solo setup, where only an unread save is worth saying', () => {
    const couldNotReach = 'Could not reach ws://nowhere:8097';
    expect(setupFailure('multi', 'arcade', couldNotReach)).toBe(couldNotReach);
    expect(setupFailure('multi', 'campaign', HOME_UNREADABLE)).toBe(HOME_UNREADABLE);
    expect(setupFailure('solo', 'campaign', couldNotReach)).toBeNull();
    expect(setupFailure('solo', 'campaign', HOME_UNREADABLE)).toBe(HOME_UNREADABLE);
    expect(setupFailure('solo', 'arcade', HOME_UNREADABLE)).toBeNull();
    expect(setupFailure('solo', 'campaign', null)).toBeNull();
  });

  it('names the style on Solo even on an invite link, since no room decides a solo run', () => {
    expect(showsStyleLabel(false, 'solo')).toBe(true);
    expect(showsStyleLabel(false, 'multi')).toBe(true);
    expect(showsStyleLabel(true, 'multi')).toBe(false);
    expect(showsStyleLabel(true, 'solo')).toBe(true);
  });

  it('offers Continue after a death only to a solo Arcade run', () => {
    expect(continuesAfterDeath('solo', 'arcade')).toBe(true);
    expect(continuesAfterDeath('solo', 'campaign')).toBe(false);
    expect(continuesAfterDeath('solo', null)).toBe(false);
    expect(continuesAfterDeath('coop', 'arcade')).toBe(false);
  });
});
