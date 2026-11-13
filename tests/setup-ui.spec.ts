import { describe, expect, it } from 'vitest';
import {
  CARD_H,
  CARD_W,
  focusTargets,
  layoutSetupUi,
  neighbour,
  setupHitAt,
  tabFrom,
  type SetupModel,
} from '../src/engine/setup-ui.ts';
import { fitTitle, wrapWords } from '../src/engine/setup-text.ts';
import { setupPicks } from '../src/game/setup-picks.ts';
import type { LevelLinkCard } from '../src/game/setup-picks.ts';

const levelLink: LevelLinkCard = { number: 3, label: 'Level', name: 'Harbor Row', sprite: null, before: 'who' };

function model(patch: Partial<SetupModel> = {}): SetupModel {
  return {
    heading: 'Arcade',
    picks: setupPicks({ mode: 'solo', difficulty: 'lights_out', survivor: 0 }),
    levelLink,
    callsign: '',
    startLine: null,
    failure: null,
    start: { label: 'Start', enabled: true },
    resume: null,
    open: null,
    ...patch,
  };
}

const W = 427;
const H = 240;

describe('canvas setup layout', () => {
  const layout = layoutSetupUi(model(), W, H);

  it('lays the picks in one row in page order, the Level link before Survivor', () => {
    expect(layout.cards.map((card) => card.key)).toEqual(['mode', 'difficulty', 'level', 'who']);
    expect(layout.cards.map((card) => card.number)).toEqual([1, 2, 3, 4]);
    const ys = new Set(layout.cards.map((card) => card.y));
    expect(ys.size).toBe(1);
    for (let i = 1; i < layout.cards.length; i += 1) expect(layout.cards[i].x).toBeGreaterThan(layout.cards[i - 1].x + CARD_W - 1);
  });

  it('leaves out the Level link for a style with none', () => {
    const plain = layoutSetupUi(model({ levelLink: null }), W, H);
    expect(plain.cards.map((card) => card.key)).toEqual(['mode', 'difficulty', 'who']);
  });

  it('keeps everything inside the view and centred', () => {
    const boxes = [...layout.cards, layout.callsign.field, ...layout.buttons];
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w).toBeLessThanOrEqual(W);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.h).toBeLessThanOrEqual(H);
    }
    const left = layout.cards[0].x;
    const right = W - (layout.cards[3].x + CARD_W);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
  });

  it('shows Back and Start, and Continue only when asked', () => {
    expect(layout.buttons.map((button) => button.id)).toEqual(['back', 'start']);
    const resumed = layoutSetupUi(model({ resume: { label: 'Continue from Harbor Row', enabled: true } }), W, H);
    expect(resumed.buttons.map((button) => button.id)).toEqual(['back', 'resume', 'start']);
  });

  it('adds a line for the start level and for a failure', () => {
    const noted = layoutSetupUi(model({ startLine: 'Starts at Harbor Row', failure: 'Could not open' }), W, H);
    expect(noted.lines.map((line) => line.tone)).toEqual(['dim', 'error']);
    expect(noted.lines[0].y).toBeLessThan(noted.buttons[0].y);
  });
});

describe('canvas setup hit testing', () => {
  const layout = layoutSetupUi(model(), W, H);
  const closed = layout;
  const opened = layoutSetupUi(model({ open: 'who' }), W, H);

  it('finds a card, the callsign, a button and bare ground', () => {
    const card = closed.cards[1];
    expect(setupHitAt(closed, card.x + 3, card.y + CARD_H - 3)).toEqual({ kind: 'card', key: 'difficulty' });
    const field = closed.callsign.field;
    expect(setupHitAt(closed, field.x + 4, field.y + 4)).toEqual({ kind: 'callsign' });
    const start = closed.buttons.find((button) => button.id === 'start')!;
    expect(setupHitAt(closed, start.x + 2, start.y + 2)).toEqual({ kind: 'button', id: 'start' });
    expect(setupHitAt(closed, 1, 1)).toBeNull();
  });

  it('lets an open list answer alone: its options, and a backdrop everywhere else', () => {
    expect(opened.list).not.toBeNull();
    const option = opened.list!.options[3];
    expect(setupHitAt(opened, option.x + 2, option.y + 2)).toEqual({ kind: 'option', index: 3 });
    const card = opened.cards[0];
    expect(setupHitAt(opened, card.x + 3, card.y + 3)).toEqual({ kind: 'backdrop' });
  });

  it('shows every option of the open pick inside the view, none overlapping', () => {
    const options = opened.list!.options;
    expect(options).toHaveLength(opened.list!.pick.options.length);
    for (const box of options) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w).toBeLessThanOrEqual(W);
      expect(box.y + box.h).toBeLessThanOrEqual(H);
    }
    for (let a = 0; a < options.length; a += 1) {
      for (let b = a + 1; b < options.length; b += 1) {
        const apart = options[a].x + options[a].w <= options[b].x || options[b].x + options[b].w <= options[a].x || options[a].y + options[a].h <= options[b].y || options[b].y + options[b].h <= options[a].y;
        expect(apart).toBe(true);
      }
    }
  });
});

describe('canvas setup keyboard focus', () => {
  const layout = layoutSetupUi(model(), W, H);
  const targets = focusTargets(layout);

  it('tabs through the picks, the callsign, then the buttons, and wraps', () => {
    expect(targets.map((target) => target.id)).toEqual([
      'card:mode',
      'card:difficulty',
      'card:level',
      'card:who',
      'callsign',
      'button:back',
      'button:start',
    ]);
    expect(tabFrom(targets, null, 1)).toBe('card:mode');
    expect(tabFrom(targets, 'button:start', 1)).toBe('card:mode');
    expect(tabFrom(targets, 'card:mode', -1)).toBe('button:start');
  });

  it('steps by nearest centre: across the row, down to the callsign, back up', () => {
    expect(neighbour(targets, 'card:mode', 'right')).toBe('card:difficulty');
    expect(neighbour(targets, 'card:who', 'right')).toBeNull();
    expect(neighbour(targets, 'card:difficulty', 'down')).toBe('callsign');
    expect(neighbour(targets, 'callsign', 'up')).toMatch(/^card:/);
    expect(neighbour(targets, 'callsign', 'down')).toMatch(/^button:/);
  });

  it('leaves a disabled Start out of the focus order', () => {
    const waiting = layoutSetupUi(model({ start: { label: 'Loading', enabled: false } }), W, H);
    expect(focusTargets(waiting).some((target) => target.id === 'button:start')).toBe(false);
  });
});

describe('canvas setup titles', () => {
  const width = (text: string): number => text.length * 4 - 1;

  it('shrinks the size until the longest word fits', () => {
    expect(fitTitle('Ace', 50, 3, width).scale).toBe(3);
    expect(fitTitle('Multiplayer', 50, 3, width).scale).toBe(1);
  });

  it('wraps on spaces and keeps a long word whole', () => {
    expect(wrapWords('Hard Mode Now', 30, width)).toEqual(['Hard', 'Mode', 'Now']);
    expect(wrapWords('Big Zed', 100, width)).toEqual(['Big Zed']);
    expect(wrapWords('Extraordinarily', 10, width)).toEqual(['Extraordinarily']);
  });
});

describe('canvas setup as Nightly Run', () => {
  const fixed = [
    { key: 'town', number: 1, label: 'Tonight', name: 'Harbor Row', sprite: null },
    { key: 'difficulty', number: 2, label: 'Difficulty', name: 'Hard', sprite: null },
  ];
  const nightly = model({
    heading: 'Nightly Run',
    picks: setupPicks({ mode: 'solo', difficulty: 'lights_out', survivor: 0 }).filter((pick) => pick.key === 'who'),
    levelLink: null,
    fixed,
    callsign: null,
    facts: [{ text: 'Fri 13 Nov - Harbor Row - same town for everyone, first run counts and then some more words to wrap the line', tone: 'accent' }],
    actions: [
      { id: 'share', label: 'Copy result', enabled: true, primary: false },
      { id: 'mp', label: 'Nightly MP Lobby', enabled: true, primary: true },
    ],
  });
  const layout = layoutSetupUi(nightly, W, H);

  it('puts the fixed cards before the survivor and leaves the callsign off', () => {
    expect(layout.cards.map((card) => card.key)).toEqual(['fixed:town', 'fixed:difficulty', 'who']);
    expect(layout.hasCallsign).toBe(false);
    expect(layout.buttons.map((button) => button.id)).toEqual(['back', 'share', 'mp']);
  });

  it('wraps a long fact line to the view', () => {
    expect(layout.lines.length).toBeGreaterThan(1);
    for (const line of layout.lines) expect(line.x).toBeGreaterThanOrEqual(0);
  });

  it('answers only the survivor card and the buttons', () => {
    const [town, , who] = layout.cards;
    expect(setupHitAt(layout, town.x + 4, town.y + 20)).toBeNull();
    expect(setupHitAt(layout, who.x + 4, who.y + 20)).toEqual({ kind: 'card', key: 'who' });
    expect(focusTargets(layout).map((target) => target.id)).toEqual(['card:who', 'button:back', 'button:share', 'button:mp']);
  });

  it('keeps everything inside the view', () => {
    for (const box of [...layout.cards, ...layout.buttons]) {
      expect(box.y + box.h).toBeLessThanOrEqual(H);
      expect(box.x + box.w).toBeLessThanOrEqual(W);
    }
  });
});
