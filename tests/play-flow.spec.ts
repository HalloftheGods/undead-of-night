import { describe, expect, it } from 'vitest';
import {
  advance,
  chooseMode,
  claimedStyle,
  continuesAfterDeath,
  HOME_UNREADABLE,
  PLAY_JOIN,
  PLAY_LEVEL,
  PLAY_START,
  playHeading,
  playStepper,
  returnTo,
  playSteps,
  retreat,
  setupFailure,
  setupStyle,
  showsServer,
  showsStyleLabel,
  startFlow,
  startsRun,
} from '../src/game/play-flow.ts';

describe('play flow', () => {
  it('opens on the mode step as solo, with no server field and no Style step: the title buttons chose the style', () => {
    expect(PLAY_START).toEqual({ step: 'mode', mode: 'solo' });
    expect(playSteps()).not.toContain('style');
    expect(showsServer(PLAY_START)).toBe(false);
  });

  it('shows the server address once Multiplayer is chosen, on the mode step only', () => {
    const multi = chooseMode(PLAY_START, 'multi');
    expect(showsServer(multi)).toBe(true);
    expect(showsServer(advance(multi))).toBe(false);
    expect(showsServer(advance(advance(multi)))).toBe(false);
  });

  it('lands an invite link on the co-op setup step', () => {
    expect(PLAY_JOIN).toEqual({ step: 'mode', mode: 'multi' });
    expect(showsServer(PLAY_JOIN)).toBe(true);
    expect(playSteps()).toEqual(['mode', 'difficulty', 'who']);
  });

  it('lands a level picked on the Levels page on the mode step, solo', () => {
    expect(PLAY_LEVEL).toEqual({ step: 'mode', mode: 'solo' });
    expect(retreat(PLAY_LEVEL)).toBeNull();
  });

  it('picks the first step from how the page was reached', () => {
    expect(startFlow(false, null)).toBe(PLAY_START);
    expect(startFlow(true, null)).toBe(PLAY_JOIN);
    expect(startFlow(false, 4)).toBe(PLAY_LEVEL);
    expect(startFlow(true, 4)).toBe(PLAY_JOIN);
  });

  it('walks mode, difficulty, survivor and stays on the last, keeping the mode', () => {
    const second = chooseMode(PLAY_START, 'multi');
    const third = advance(second);
    expect(third).toEqual({ step: 'difficulty', mode: 'multi' });
    const fourth = advance(third);
    expect(fourth).toEqual({ step: 'who', mode: 'multi' });
    expect(advance(fourth)).toBe(fourth);
  });

  it('goes back one step at a time, then leaves', () => {
    const third = advance(advance(PLAY_START));
    expect(retreat(third)).toEqual({ step: 'difficulty', mode: 'solo' });
    expect(retreat(advance(PLAY_START))).toEqual(PLAY_START);
    expect(retreat(PLAY_START)).toBeNull();
  });

  it('puts Start on the survivor step only', () => {
    expect(startsRun(PLAY_START)).toBe(false);
    expect(startsRun(advance(PLAY_START))).toBe(false);
    expect(startsRun(advance(advance(PLAY_START)))).toBe(true);
    expect(startsRun(advance(advance(PLAY_LEVEL)))).toBe(true);
  });

  it('titles each step', () => {
    expect(playHeading(PLAY_START)).toBe('Choose Mode');
    expect(playHeading(advance(PLAY_START))).toBe('Choose Difficulty');
    expect(playHeading(advance(advance(PLAY_START)))).toBe('Choose Survivor');
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

  it('lays out the stepper: done steps behind, the current one lit, the rest ahead', () => {
    const second = advance(PLAY_START);
    expect(playStepper(second)).toEqual([
      { step: 'mode', label: 'Mode', number: 1, state: 'done' },
      { step: 'difficulty', label: 'Difficulty', number: 2, state: 'current' },
      { step: 'who', label: 'Survivor', number: 3, state: 'next' },
    ]);
  });

  it('numbers the stepper from the first step this walk has', () => {
    expect(playStepper(PLAY_LEVEL).map((each) => [each.number, each.step, each.state])).toEqual([
      [1, 'mode', 'current'],
      [2, 'difficulty', 'next'],
      [3, 'who', 'next'],
    ]);
  });

  it('jumps back to a done step from the stepper, but never forward', () => {
    const third = chooseMode(advance(advance(PLAY_START)), 'multi');
    expect(returnTo(third, 'mode')).toEqual({ step: 'mode', mode: 'multi' });
    expect(returnTo(third, 'who')).toBe(third);
    const first = PLAY_START;
    expect(returnTo(first, 'difficulty')).toBe(first);
  });
});
