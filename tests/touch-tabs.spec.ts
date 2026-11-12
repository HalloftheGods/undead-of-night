import { describe, expect, it } from 'vitest';
import { ARROW_UP, swipeArrow, turnClockwise } from '../src/game/swipe-arrows.ts';
import { glyphPath, PAUSE } from '../src/game/touch-pad.ts';
import { HORN_CODE, SPRINT_CODE, TOUCH_TABS, tabLabel, touchTabsFor } from '../src/game/touch-tabs.ts';

describe('phone tab bar', () => {
  it('runs Pause to Sprint, left to right', () => {
    expect(TOUCH_TABS.map((tab) => tab.label)).toEqual(['Pause', 'Pack', 'Search', 'Shove', 'Sprint']);
  });

  it('holds the keyboard keys for Search, Shove and Sprint', () => {
    const codes = TOUCH_TABS.flatMap((tab) => (tab.kind === 'hold' ? [tab.code] : []));
    expect(codes).toEqual(['KeyE', 'KeyF', SPRINT_CODE]);
  });

  it('says Stab on the Shove tab once a knife is carried', () => {
    const shove = TOUCH_TABS.find((tab) => tab.id === 'shove');
    if (!shove) throw new Error('no shove tab');
    expect(tabLabel(shove, false)).toBe('Shove');
    expect(tabLabel(shove, true)).toBe('Stab');
  });

  it('draws the pause bars as a square glyph', () => {
    expect(PAUSE.every((row) => row.length === PAUSE.length)).toBe(true);
    expect(glyphPath(PAUSE)).not.toBe('');
  });
});

describe('hand-drawn swipe arrows', () => {
  it('turns the up arrow a quarter at a time', () => {
    expect(swipeArrow('up')).toBe(ARROW_UP);
    const right = swipeArrow('right');
    expect(right).toHaveLength(ARROW_UP[0].length);
    expect(right[0]).toHaveLength(ARROW_UP.length);
    expect(turnClockwise(turnClockwise(swipeArrow('down')))).toEqual(ARROW_UP);
  });

  it('points right with the tip on the right edge', () => {
    const right = swipeArrow('right');
    const tipColumn = right[0].length - 1;
    expect(right.some((row) => row[tipColumn] === '#')).toBe(true);
  });
});

describe('horn tab', () => {
  it('shows only while seated, ahead of Sprint, holding the horn key', () => {
    expect(touchTabsFor(false).some((tab) => tab.id === 'horn')).toBe(false);
    const seated = touchTabsFor(true);
    expect(seated.map((tab) => tab.id)).toEqual(['pause', 'backpack', 'search', 'shove', 'horn', 'sprint']);
    const horn = seated.find((tab) => tab.id === 'horn');
    expect(horn?.kind === 'hold' && horn.code).toBe(HORN_CODE);
  });
});
