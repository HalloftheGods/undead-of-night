import { describe, expect, it } from 'vitest';
import { WEAPON_ORDER } from '../shared/protocol.ts';
import { weaponBar } from '../src/game/weapon-bar.ts';
import type { HudState } from '../src/game/hud-state.ts';

type BarHud = Pick<HudState, 'weapon' | 'owned' | 'ammoBag' | 'mags'>;

function hud(patch: Partial<BarHud> = {}): BarHud {
  return {
    weapon: 'pistol',
    owned: ['pistol'],
    ammoBag: { pistol: 24, carbine: 0, shotgun: 0 },
    mags: { pistol: 6, carbine: 0, shotgun: 0 },
    ...patch,
  };
}

describe('weaponBar', () => {
  it('keeps every gun in key order, carried or not, so the bar never shifts under a thumb', () => {
    const slots = weaponBar(hud());
    expect(slots.map((slot) => slot.weapon)).toEqual([...WEAPON_ORDER]);
    expect(slots.map((slot) => slot.code)).toEqual(['Digit1', 'Digit2', 'Digit3']);
    expect(slots.map((slot) => slot.key)).toEqual(['1', '2', '3']);
  });

  it('marks the gun in hand and only that one', () => {
    const slots = weaponBar(hud({ owned: ['pistol', 'shotgun'], weapon: 'shotgun' }));
    expect(slots.filter((slot) => slot.active).map((slot) => slot.weapon)).toEqual(['shotgun']);
  });

  it('counts loaded and spare rounds together, and leaves a gun not carried uncounted', () => {
    const slots = weaponBar(hud({
      owned: ['pistol', 'carbine'],
      mags: { pistol: 6, carbine: 10, shotgun: 0 },
      ammoBag: { pistol: 24, carbine: 20, shotgun: 0 },
    }));
    expect(slots.map((slot) => slot.rounds)).toEqual([30, 30, null]);
    expect(slots.map((slot) => slot.owned)).toEqual([true, true, false]);
  });

  it('says in words whether a gun is carried, for a screen reader', () => {
    const slots = weaponBar(hud());
    expect(slots[0].label).toBe('Hold the pistol');
    expect(slots[1].label).toBe('Carbine, not carried');
  });
});
