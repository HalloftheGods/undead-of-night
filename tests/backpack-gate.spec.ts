import { describe, expect, it } from 'vitest';
import { standingInTown } from '../src/game/hud-state.ts';
import type { HudState, UiState } from '../src/game/hud-state.ts';
import { aHud } from './backpack-fixture.ts';
import { aimsCursor } from '../src/game/home-screens.ts';

type Gate = Pick<UiState, 'screen' | 'paused' | 'mapOpen' | 'hud' | 'home'>;

function ui(patch: Partial<Gate> = {}, hud: Partial<HudState> = {}): Gate {
  return { screen: 'game', paused: false, mapOpen: false, home: null, hud: aHud(hud), ...patch };
}

/** Only the three fields the gate reads; the rest of HomeUi is nothing to do with it. */
function home(patch: Partial<{ station: unknown; death: unknown; chest: unknown }>): Gate['home'] {
  return { station: null, death: null, chest: null, ...patch } as unknown as Gate['home'];
}

describe('standingInTown', () => {
  it('is true on a run, on their feet, with nothing up over the game', () => {
    expect(standingInTown(ui())).toBe(true);
  });

  it('is false off a run, or before the first snapshot', () => {
    expect(standingInTown(ui({ screen: 'title' }))).toBe(false);
    expect(standingInTown(ui({ screen: 'gameover' }))).toBe(false);
    expect(standingInTown(ui({ hud: null }))).toBe(false);
  });

  it('is false behind the pause menu and behind the map', () => {
    expect(standingInTown(ui({ paused: true }))).toBe(false);
    expect(standingInTown(ui({ mapOpen: true }))).toBe(false);
  });

  it('is false under a station, the death summary or an opened chest, which hold the keys', () => {
    expect(standingInTown(ui({ home: home({ station: 'locker' }) }))).toBe(false);
    expect(standingInTown(ui({ home: home({ death: { outcome: 'died' } }) }))).toBe(false);
    expect(standingInTown(ui({ home: home({ chest: { silver: 3 } }) }))).toBe(false);
  });

  it('is true in the bunker with no station open: a backpack is a backpack there too', () => {
    expect(standingInTown(ui({ home: home({}) }))).toBe(true);
  });

  it('is false down, dead, at the workbench, or once the run is over', () => {
    expect(standingInTown(ui({}, { status: 'downed' }))).toBe(false);
    expect(standingInTown(ui({}, { status: 'dead' }))).toBe(false);
    expect(standingInTown(ui({}, { phase: 'gameover' }))).toBe(false);
    const bench = { open: true } as unknown as HudState['bench'];
    expect(standingInTown(ui({}, { bench }))).toBe(false);
  });
});

describe('aimsCursor', () => {
  const aim = { screen: 'game', paused: false, mapOpen: false, bench: false, home: null, backpackOpen: false };

  it('keeps the crosshair in play', () => {
    expect(aimsCursor(aim)).toBe(true);
  });

  it('hands the real pointer back while the backpack ring is open, since its slots are clicked', () => {
    expect(aimsCursor({ ...aim, backpackOpen: true })).toBe(false);
  });
});
