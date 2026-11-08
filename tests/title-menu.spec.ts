import { describe, expect, it } from 'vitest';
import { titleUnit } from '../src/engine/viewport.ts';
import {
  isConfirmKey,
  menuLabel,
  menuLine,
  menuOwnsKey,
  menuStep,
  recordRows,
  recordSections,
  recordStats,
  setupActionLabel,
  steppedIndex,
  primaryIndex,
  TITLE_MENU,
} from '../src/game/title-menu.ts';

describe('title scale', () => {
  it.each([
    [800, 600, 1.5],
    [1280, 720, 2],
    [1920, 1080, 3],
    [3840, 2160, 6],
    [320, 240, 1.5],
  ])('at %ix%i runs on %f', (width, height, unit) => {
    expect(titleUnit(width, height)).toBe(unit);
  });
});

describe('title menu', () => {
  it('runs in the agreed order: How to Play on top, then Daily Night, Arcade and Campaign', () => {
    expect(TITLE_MENU.map((item) => item.label)).toEqual(['How to Play', 'Daily Night', 'Arcade', 'Campaign', 'Levels', 'Records', 'Sound Test', 'Options']);
  });

  it('opens pointed at Daily Night, the one primary item, even though How to Play is on top', () => {
    expect(TITLE_MENU.filter((item) => item.primary === true).map((item) => item.label)).toEqual(['Daily Night']);
    expect(TITLE_MENU[primaryIndex()].page).toBe('daily');
    expect(primaryIndex([{ page: 'options', label: 'Options', line: 'x' }])).toBe(0);
  });

  it('names the Sound Test from the start, with or without a Radio found', () => {
    const labels = (radio: boolean) => TITLE_MENU.map((item) => menuLabel(item, { radio, tracks: [] }));
    expect(labels(false)).toEqual(['How to Play', 'Daily Night', 'Arcade', 'Campaign', 'Levels', 'Records', 'Sound Test', 'Options']);
    expect(labels(true)).toEqual(TITLE_MENU.map((item) => item.label));
  });

  it('opens the one Play setup from both Campaign and Arcade, each carrying its own style', () => {
    const [, , arcade, campaign] = TITLE_MENU;
    expect([campaign.page, campaign.style]).toEqual(['play', 'campaign']);
    expect([arcade.page, arcade.style]).toEqual(['play', 'arcade']);
    expect(TITLE_MENU.filter((item) => item.style !== undefined)).toHaveLength(2);
  });

  it('puts a one-line subtitle under every button, and hides none of them behind a missing Radio', () => {
    for (const item of TITLE_MENU) {
      expect(item.line.length).toBeGreaterThan(0);
      expect(item.line).not.toContain('\n');
      expect(menuLine(item, { radio: false, tracks: [] })).toBe(item.line);
    }
  });

  it('has no Co-op item, since Multiplayer is chosen inside Play', () => {
    expect(TITLE_MENU.map((item) => item.page)).not.toContain('coop');
  });

  it('gives every item its own label, which keys the buttons', () => {
    expect(new Set(TITLE_MENU.map((item) => item.label)).size).toBe(TITLE_MENU.length);
  });

  it.each([
    ['ArrowUp', -1],
    ['KeyW', -1],
    ['ArrowDown', 1],
    ['KeyS', 1],
    ['KeyD', 0],
    ['Enter', 0],
  ])('reads %s as a step of %i', (code, step) => {
    expect(menuStep(code)).toBe(step);
  });

  it('leaves a key alone when focus sits on a control outside the menu, such as the Install cartridge', () => {
    expect(menuOwnsKey({ focusInMenu: false, focusOnControl: true })).toBe(false);
    expect(menuOwnsKey({ focusInMenu: true, focusOnControl: true })).toBe(true);
    expect(menuOwnsKey({ focusInMenu: false, focusOnControl: false })).toBe(true);
  });

  it('wraps at both ends', () => {
    const last = TITLE_MENU.length - 1;
    expect(steppedIndex(0, -1)).toBe(last);
    expect(steppedIndex(last, 1)).toBe(0);
    expect(steppedIndex(2, 1)).toBe(3);
  });

  it('takes either Enter key as confirm, and nothing else', () => {
    expect(isConfirmKey('Enter')).toBe(true);
    expect(isConfirmKey('NumpadEnter')).toBe(true);
    expect(isConfirmKey('Space')).toBe(false);
  });
});

describe('setup page button', () => {
  it('says Start for solo and Join for co-op', () => {
    expect(setupActionLabel(false, true, false)).toBe('Start');
    expect(setupActionLabel(true, true, false)).toBe('Join');
    expect(setupActionLabel(true, true, false, 'host')).toBe('Host room');
    expect(setupActionLabel(true, true, false, 'find')).toBe('Find a team');
  });

  it('says why it cannot be pressed yet', () => {
    expect(setupActionLabel(false, false, false)).toBe('Loading...');
    expect(setupActionLabel(true, true, true)).toBe('Connecting...');
  });
});

describe('records page', () => {
  it('shows empty stats before the first run', () => {
    expect(recordStats(null).map((stat) => stat.value)).toEqual(['0', '0', '0', '--:--']);
  });

  it('shows the best run', () => {
    const best = { score: 1200, wave: 4, kills: 57, durationSec: 125 };
    expect(recordStats(best).map((stat) => stat.value)).toEqual(['1200', '4', '57', '2:05']);
  });

  it('keeps the top five, ranked, and names a run with no callsign', () => {
    const runs = Array.from({ length: 7 }, (_, index) => ({ callsign: '', score: 100 - index, timestamp: index }));
    const rows = recordRows(runs as never);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({ rank: '#1', name: 'SURVIVOR', score: 100 });
  });

  it('shows a section for each style, Campaign first, with its own best', () => {
    const arcade = { score: 1200, wave: 4, kills: 57, durationSec: 125 };
    const trip = { score: 300, wave: 1, kills: 9, durationSec: 61 };
    const sections = recordSections(arcade, trip);
    expect(sections.map((section) => [section.style, section.heading])).toEqual([
      ['campaign', 'Campaign'],
      ['arcade', 'Arcade'],
    ]);
    expect(sections[0].stats.map((stat) => stat.value)).toEqual(['300', '1', '9', '1:01']);
    expect(sections[1].stats.map((stat) => stat.value)).toEqual(['1200', '4', '57', '2:05']);
  });

  it('labels each run by the style it came from, a marked trip as a Campaign trip', () => {
    const trip = { callsign: 'A', score: 5, timestamp: 1, trip: true };
    const run = { callsign: 'B', score: 4, timestamp: 2 };
    expect(recordRows([trip, run] as never).map((row) => row.label)).toEqual(['Campaign trip', 'Arcade run']);
  });
});
