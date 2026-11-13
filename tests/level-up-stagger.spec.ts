import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readMs, RunNotices } from '../src/game/run-notices.ts';
import type { UiState } from '../src/game/hud-state.ts';

const source = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('level up popups come one at a time, with time to read', () => {
  it('gives a line a beat to notice and then about eighteen letters a second', () => {
    expect(readMs('OK')).toBeGreaterThan(1800);
    expect(readMs('A'.repeat(18))).toBeGreaterThan(readMs('A'.repeat(9)));
    expect(readMs('LEVEL UP BOON!', 'Sugar Rush: sprint faster for a while')).toBeGreaterThan(3500);
  });

  it('keeps a banner up for as long as it asks, and the usual beat when it asks nothing', () => {
    const notices = new RunNotices();
    const long = notices.banner({ title: 'T', subtitle: 'S', tone: 'hope', holdMs: 5000 }, 1000);
    const ui = { banner: long, callout: null, place: null, levelCard: null } as unknown as UiState;
    expect(notices.expired(ui, 5900)).toEqual({});
    expect(notices.expired(ui, 6100)).toEqual({ banner: null });
    const usual = notices.banner({ title: 'T', subtitle: 'S', tone: 'hope' }, 1000);
    expect(notices.expired({ ...ui, banner: usual } as UiState, 3700)).toEqual({ banner: null });
  });

  it('spaces the level up beats out instead of firing them at once', () => {
    const handler = source('../src/game/snapshot-handler.ts');
    const level = handler.slice(handler.indexOf('A level up is a run of beats'), handler.indexOf('saveProgression(gain.state)'));
    expect(level).toContain('runHud.later(pointsAt');
    expect(level).toContain('runHud.later(boonAt');
    expect(level).toContain('runHud.later(boonDoneAt');
    expect(level).not.toContain('now + 800');
  });
});
