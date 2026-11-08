import { describe, expect, it } from 'vitest';
import { titleUnit } from '../src/engine/viewport.ts';
import {
  isConfirmKey,
  menuLabel,
  menuLine,
  menuColumns,
  menuMove,
  menuOwnsKey,
  movedIndex,
  recordRows,
  recordSections,
  recordStats,
  setupActionLabel,
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
  it('runs section by section: Books with How to Play on top, then Play, then Extras', () => {
    expect(TITLE_MENU.map((item) => item.label)).toEqual(['How to Play', 'Town Guide', 'Records', 'Daily Night', 'Arcade', 'Campaign', 'Levels', 'Sound Test', 'Options']);
  });

  it('lays the sections out as three headed columns, Books, Play and Extras', () => {
    const columns = menuColumns();
    expect(columns.map((column) => column.heading)).toEqual(['Books', 'Play', 'Extras']);
    expect(columns.map((column) => column.indices.map((index) => TITLE_MENU[index].label))).toEqual([
      ['How to Play', 'Town Guide', 'Records'],
      ['Daily Night', 'Arcade', 'Campaign', 'Levels'],
      ['Sound Test', 'Options'],
    ]);
    expect(menuColumns([{ group: 'extras', page: 'options', label: 'Options', line: 'x' }]).map((column) => column.group)).toEqual(['extras']);
  });

  it('opens pointed at Daily Night, the one primary item, even though How to Play is on top', () => {
    expect(TITLE_MENU.filter((item) => item.primary === true).map((item) => item.label)).toEqual(['Daily Night']);
    expect(TITLE_MENU[primaryIndex()].page).toBe('daily');
    expect(primaryIndex([{ group: 'extras', page: 'options', label: 'Options', line: 'x' }])).toBe(0);
  });

  it('names the Sound Test from the start, with or without a Radio found', () => {
    const labels = (radio: boolean) => TITLE_MENU.map((item) => menuLabel(item, { radio, tracks: [] }));
    expect(labels(false)).toEqual(['How to Play', 'Town Guide', 'Records', 'Daily Night', 'Arcade', 'Campaign', 'Levels', 'Sound Test', 'Options']);
    expect(labels(true)).toEqual(TITLE_MENU.map((item) => item.label));
  });

  it('opens the one Play setup from both Campaign and Arcade, each carrying its own style', () => {
    const arcade = TITLE_MENU.find((item) => item.label === 'Arcade')!;
    const campaign = TITLE_MENU.find((item) => item.label === 'Campaign')!;
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
    ['ArrowUp', 0, -1],
    ['KeyW', 0, -1],
    ['ArrowDown', 0, 1],
    ['KeyS', 0, 1],
    ['ArrowLeft', -1, 0],
    ['KeyA', -1, 0],
    ['ArrowRight', 1, 0],
    ['KeyD', 1, 0],
  ])('reads %s as a move of %i across and %i down', (code, across, down) => {
    expect(menuMove(code)).toEqual({ across, down });
  });

  it('reads Enter and other keys as no move', () => {
    expect(menuMove('Enter')).toBeNull();
    expect(menuMove('KeyQ')).toBeNull();
  });

  it('leaves a key alone when focus sits on a control outside the menu, such as the Install cartridge', () => {
    expect(menuOwnsKey({ focusInMenu: false, focusOnControl: true })).toBe(false);
    expect(menuOwnsKey({ focusInMenu: true, focusOnControl: true })).toBe(true);
    expect(menuOwnsKey({ focusInMenu: false, focusOnControl: false })).toBe(true);
  });

  it('moves up and down inside a column, wrapping at its ends', () => {
    const at = (label: string) => TITLE_MENU.findIndex((item) => item.label === label);
    const label = (index: number) => TITLE_MENU[index].label;
    expect(label(movedIndex(at('Daily Night'), { across: 0, down: 1 }))).toBe('Arcade');
    expect(label(movedIndex(at('Daily Night'), { across: 0, down: -1 }))).toBe('Levels');
    expect(label(movedIndex(at('Records'), { across: 0, down: 1 }))).toBe('How to Play');
  });

  it('moves across the columns on the same row, wrapping at the sides, and drops to the end of a shorter column', () => {
    const at = (label: string) => TITLE_MENU.findIndex((item) => item.label === label);
    const label = (index: number) => TITLE_MENU[index].label;
    expect(label(movedIndex(at('Daily Night'), { across: -1, down: 0 }))).toBe('How to Play');
    expect(label(movedIndex(at('Arcade'), { across: 1, down: 0 }))).toBe('Options');
    expect(label(movedIndex(at('Campaign'), { across: 1, down: 0 }))).toBe('Options');
    expect(label(movedIndex(at('Levels'), { across: -1, down: 0 }))).toBe('Records');
    expect(label(movedIndex(at('Options'), { across: 1, down: 0 }))).toBe('Town Guide');
    expect(label(movedIndex(at('How to Play'), { across: -1, down: 0 }))).toBe('Sound Test');
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
