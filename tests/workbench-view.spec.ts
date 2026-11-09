import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../shared/constants.ts';
import { GUN_SLOTS, UPGRADES } from '../shared/gun-upgrade-data.ts';
import { BAR_SLOTS, benchRows, gunBars, gunSlots, hasWorkLeft, previewBars, slotsFree, upgradeBlock, upgradeCost, upgradeEffect, upgradeParts } from '../src/game/bench-view.ts';

const bar = (bars: ReturnType<typeof gunBars>, label: string) => bars.find((each) => each.label === label);

describe('the bench column bars', () => {
  it('scales a stock gun against the best stock gun at each stat, with nothing gained', () => {
    const bars = gunBars('pistol', undefined);
    expect(bars.map((each) => each.label)).toEqual(['Damage', 'Fire rate', 'Magazine', 'Reload', 'Quiet']);
    expect(bar(bars, 'Damage')).toMatchObject({ value: `${WEAPONS.pistol.damage}`, filled: 1, gained: 0, changed: false });
    expect(bar(bars, 'Reload')).toMatchObject({ value: '1.1s', filled: BAR_SLOTS });
    expect(bar(bars, 'Quiet')).toMatchObject({ value: '100% noise', filled: BAR_SLOTS });
    expect(bars.every((each) => each.filled >= 1 && each.filled <= BAR_SLOTS)).toBe(true);
  });

  it('lights the cells the work adds, and marks the number it moved', () => {
    const full = UPGRADES.magazine.maxRank;
    const mag = bar(gunBars('pistol', { ranks: { magazine: full }, quirk: null }), 'Magazine');
    const size = Math.round(WEAPONS.pistol.magSize * (1 + full * UPGRADES.magazine.gain));
    expect(mag).toMatchObject({ value: `${size}`, filled: 4, gained: 2, changed: true });
  });

  it('reads a suppressor as a quieter gun, and a shotgun by its pellets', () => {
    const bars = gunBars('shotgun', { ranks: { suppressor: 1 }, quirk: null });
    expect(bar(bars, 'Quiet')).toMatchObject({ value: '35% noise', filled: BAR_SLOTS, gained: 2 });
    expect(bar(bars, 'Damage')?.value).toBe(`${WEAPONS.shotgun.damage}x${WEAPONS.shotgun.pellets}`);
  });

  it('never lights fewer than one cell or more than the bar holds', () => {
    const bars = gunBars('carbine', { ranks: { damage: 3 }, quirk: 'hot_loads' });
    expect(bars.every((each) => each.filled >= 1 && each.filled <= BAR_SLOTS && each.gained <= each.filled)).toBe(true);
  });
});

describe('the bench column slots', () => {
  it('lists a slot per rank in upgrade order, then the empty ones', () => {
    expect(gunSlots('pistol', { ranks: { reload: 1, damage: 1 }, quirk: null })).toEqual(['damage', 'reload', null]);
    expect(gunSlots('carbine', undefined)).toEqual(Array.from({ length: GUN_SLOTS.carbine }, () => null));
  });

  it('names the parts a rank takes', () => {
    expect(upgradeParts('reload')).toEqual(['grip', 'magazine']);
    expect(upgradeParts('suppressor')).toEqual(['suppressor']);
  });
});

describe('the bench tile hints', () => {
  const none = { barrel: 0, grip: 0, magazine: 0, suppressor: 0, toolkit: 0 };

  it('says what a rank gives and what it costs, in plain words', () => {
    expect(upgradeEffect('damage')).toBe('+12% damage');
    expect(upgradeEffect('reload')).toBe('-15% reload time');
    expect(upgradeEffect('suppressor')).toBe('-65% noise');
    expect(upgradeCost('reload')).toBe('1 Grip + 1 Magazine');
  });

  it('names the reason a rank cannot go on, matching what the server will allow', () => {
    expect(upgradeBlock('pistol', undefined, none, 'damage')).toBe('Need Barrel');
    expect(upgradeBlock('pistol', undefined, { ...none, grip: 1 }, 'reload')).toBe('Need Magazine');
    expect(upgradeBlock('pistol', undefined, { ...none, barrel: 1 }, 'damage')).toBeNull();
    expect(upgradeBlock('pistol', { ranks: { suppressor: 1 }, quirk: null }, { ...none, suppressor: 1 }, 'suppressor')).toBe('Maxed out');
    expect(upgradeBlock('pistol', { ranks: { damage: 2, fireRate: 1 }, quirk: null }, { ...none, magazine: 1 }, 'magazine')).toBe('No slots left');
  });

  it('is blocked on exactly the rows the bench cannot fit', () => {
    const gear = { parts: { ...none, barrel: 1, grip: 1 }, fits: {} };
    for (const row of benchRows('pistol', ['pistol'], gear)) expect(row.blocked === null, row.upgrade).toBe(row.fittable);
  });

  it('previews one more rank without touching the gun', () => {
    const fit = { ranks: { damage: 1 }, quirk: null };
    const before = gunBars('pistol', fit);
    const after = previewBars('pistol', fit, 'damage');
    expect(after.find((each) => each.label === 'Damage')!.value).not.toBe(before.find((each) => each.label === 'Damage')!.value);
    expect(fit.ranks.damage).toBe(1);
  });

  it('counts free slots and notices when no work is left', () => {
    expect(slotsFree('pistol', { ranks: { damage: 1 }, quirk: null })).toBe(2);
    expect(hasWorkLeft(['pistol'], { parts: none, fits: {} })).toBe(false);
    expect(hasWorkLeft(['pistol'], { parts: { ...none, barrel: 1 }, fits: {} })).toBe(true);
  });
});
