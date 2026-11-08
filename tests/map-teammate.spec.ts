import { describe, expect, it, vi } from 'vitest';
import { CHARACTERS } from '../shared/characters.ts';
import { FONT_HEIGHT } from '../src/engine/bitmap-font.ts';
import { CURSOR_COLOR } from '../src/game/map-cursor.ts';
import { drawTeammateLocator, pingRadius, teammateDownTop, teammateLabel, teammateLabelCenter, teammateLabelTop } from '../src/game/map-teammate.ts';
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
    expect(teammateLabelTop(100, 400)).toBeLessThan(100);
    expect(teammateLabelTop(3, 400)).toBeGreaterThan(3);
    expect(teammateLabelTop(399, 400)).toBeLessThanOrEqual(400 - FONT_HEIGHT);
    expect(teammateLabelCenter(0, 20, 400)).toBeGreaterThanOrEqual(10);
    expect(teammateLabelCenter(400, 20, 400)).toBeLessThanOrEqual(390);
    expect(teammateLabelCenter(200, 20, 400)).toBe(200);
  });

  it('puts DOWN on the free side of the marker, and over the name at the foot of the map', () => {
    const nameTop = teammateLabelTop(100, 400);
    expect(teammateDownTop(100, nameTop, 400)).toBeGreaterThan(100);
    const footTop = teammateLabelTop(398, 400);
    expect(teammateDownTop(398, footTop, 400)).toBeLessThan(footTop);
  });

  it('is drawn on the town map in their own colour, with DOWN when downed', () => {
    installFakeBrowser();
    const styles: string[] = [];
    const base = fakeCanvas().getContext() as unknown as Record<string, unknown>;
    const ctx = new Proxy(base, {
      set: (object, key, value) => {
        const isFill = key === 'fillStyle';
        if (isFill) styles.push(value as string);
        object[key as string] = value;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    const clock = { nowMs: 0, openedMs: 0, reducedMotion: true };
    expect(() => drawTeammateLocator(ctx, 50, 2, { name: '', skin: 3, status: 'downed' }, clock, { width: 400, height: 400 })).not.toThrow();
    vi.unstubAllGlobals();
    expect(styles).toContain(TEAM_COLORS[3]);
  });
});
