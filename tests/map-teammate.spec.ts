import { describe, expect, it, vi } from 'vitest';
import { CHARACTERS } from '../shared/characters.ts';
import { drawOutlinedText, FONT_HEIGHT } from '../src/engine/bitmap-font.ts';

vi.mock('../src/engine/bitmap-font.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/engine/bitmap-font.ts')>();
  return { ...real, drawOutlinedText: vi.fn(real.drawOutlinedText) };
});
import { CURSOR_COLOR } from '../src/game/map-cursor.ts';
import { DOWN_COLOR, drawTeammateLocator, pingRadius, teammateLabel, teammateLabelSpot } from '../src/game/map-teammate.ts';
import type { LabelBox } from '../src/game/map-teammate.ts';
import { TEAM_COLORS, TEAM_DIM_COLORS, teamColor, teamDimColor } from '../src/game/team-colors.ts';
import { EXIT_COLOR } from '../src/game/town-map.ts';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';

describe('team colours', () => {
  it('gives every survivor a colour of their own, so no two players in a room match', () => {
    expect(TEAM_COLORS).toHaveLength(CHARACTERS.length);
    expect(new Set(TEAM_COLORS).size).toBe(CHARACTERS.length);
    CHARACTERS.forEach((_, skin) => expect(teamColor(skin)).toBe(TEAM_COLORS[skin]));
  });

  it('never borrows the cursor or the van colour', () => {
    expect(TEAM_COLORS).not.toContain(CURSOR_COLOR);
    expect(TEAM_COLORS).not.toContain(EXIT_COLOR);
  });

  it('dims each colour for the off beat, and falls back to the first survivor for an unknown skin', () => {
    expect(teamDimColor(0)).toBe(TEAM_DIM_COLORS[0]);
    expect(TEAM_DIM_COLORS[0]).not.toBe(TEAM_COLORS[0]);
    expect(TEAM_DIM_COLORS.every((color) => /^#[0-9a-f]{6}$/.test(color))).toBe(true);
    expect(teamColor(99)).toBe(TEAM_COLORS[0]);
    expect(teamColor(-1)).toBe(TEAM_COLORS[0]);
  });
});

describe('a teammate on the map', () => {
  it('is named by callsign in a private room and by survivor in a public one', () => {
    expect(teammateLabel({ name: 'Ann', skin: 1 })).toBe('ANN');
    // Public rooms send no callsign at all.
    expect(teammateLabel({ name: '', skin: 2 })).toBe(CHARACTERS[2].name.toUpperCase());
  });

  it('pings outward and starts again, but holds still for reduced motion', () => {
    const radii = Array.from({ length: 20 }, (_, i) => pingRadius(i * 33, false));
    expect(Math.min(...radii)).toBeLessThan(Math.max(...radii));
    expect(new Set(Array.from({ length: 20 }, (_, i) => pingRadius(i * 33, true))).size).toBe(1);
  });

  it('keeps the name on the map: above the marker, or below it at the top edge', () => {
    const size = { width: 400, height: 400 };
    expect(teammateLabelSpot(100, 100, 20, size, []).top).toBeLessThan(100);
    expect(teammateLabelSpot(100, 3, 20, size, []).top).toBeGreaterThan(3);
    expect(teammateLabelSpot(100, 399, 20, size, []).top).toBeLessThanOrEqual(400 - FONT_HEIGHT);
    expect(teammateLabelSpot(0, 100, 20, size, []).left).toBeGreaterThanOrEqual(0);
    expect(teammateLabelSpot(400, 100, 20, size, []).left + 20).toBeLessThanOrEqual(400);
    expect(teammateLabelSpot(200, 100, 20, size, []).left).toBe(190);
  });

  it('keeps teammates standing together from writing over each other', () => {
    const size = { width: 400, height: 400 };
    const taken: LabelBox[] = [];
    const tops = [0, 1, 2].map((i) => teammateLabelSpot(200 + i, 200 + i, 30, size, taken).top);
    expect(new Set(tops).size).toBe(3);
    expect(taken).toHaveLength(3);
    const [a, b, c] = taken;
    const meet = (p: LabelBox, q: LabelBox) => p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1;
    expect([meet(a, b), meet(a, c), meet(b, c)]).toEqual([false, false, false]);
  });

  function recordingContext(styles: string[]): CanvasRenderingContext2D {
    const base = fakeCanvas().getContext() as unknown as Record<string, unknown>;
    return new Proxy(base, {
      set: (object, key, value) => {
        const isFill = key === 'fillStyle';
        if (isFill) styles.push(value as string);
        object[key as string] = value;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
  }

  function drawnColours(status: 'alive' | 'downed', nowMs: number, reducedMotion: boolean): string[] {
    installFakeBrowser();
    const styles: string[] = [];
    const clock = { nowMs, openedMs: 0, reducedMotion };
    drawTeammateLocator(recordingContext(styles), 50, 50, { name: '', skin: 3, status }, clock, { width: 400, height: 400 });
    vi.unstubAllGlobals();
    return styles;
  }

  it('is drawn in their own colour, bright on the beat and dim off it', () => {
    expect(drawnColours('alive', 0, true)).toContain(TEAM_COLORS[3]);
    // Past the bright share of the beat, the ping and dot dim; the name stays in full colour.
    const offBeat = drawnColours('alive', 500, false);
    expect(offBeat).toContain(TEAM_DIM_COLORS[3]);
  });

  it('writes DOWN in red beside a downed teammate, and not beside a standing one', () => {
    const words = () => vi.mocked(drawOutlinedText).mock.calls.map(([, text, , , color]) => [text, color]);
    vi.mocked(drawOutlinedText).mockClear();
    drawnColours('downed', 0, true);
    expect(words()).toEqual([[CHARACTERS[3].name.toUpperCase(), TEAM_COLORS[3]], ['DOWN', DOWN_COLOR]]);
    vi.mocked(drawOutlinedText).mockClear();
    drawnColours('alive', 0, true);
    expect(words()).toEqual([[CHARACTERS[3].name.toUpperCase(), TEAM_COLORS[3]]]);
  });
});
