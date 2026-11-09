import { describe, expect, it } from 'vitest';
import { nextCandy, slotAngle, stepSlot, wheelSlots } from '../src/game/backpack-wheel.ts';
import type { HudState } from '../src/game/hud-state.ts';
import { aHud as hud, fullBackpack } from './backpack-fixture.ts';

const codes = (state: HudState): string[] => wheelSlots(state).map((slot) => slot.code);

describe('wheelSlots', () => {
  it('offers only the medkit and the map with an empty backpack and one gun', () => {
    expect(codes(hud())).toEqual(['KeyH', 'KeyN']);
  });

  it('never invents a throwable that is not carried', () => {
    const empty = wheelSlots(hud());
    expect(empty.some((slot) => slot.art === 'bottle' || slot.art === 'fireworks' || slot.art === 'fountain')).toBe(false);
  });

  it('adds each throwable and the candy as it is picked up, in reach order', () => {
    const full = hud({ bottles: 2, fireworks: 1, fountains: 3, candy: ['Sour Skulls'], owned: ['pistol', 'shotgun'] });
    expect(codes(full)).toEqual(['KeyH', 'KeyQ', 'KeyG', 'KeyT', 'KeyV', 'KeyX', 'KeyN']);
  });

  it('counts what is carried, and leaves the map uncounted', () => {
    const slots = wheelSlots(hud({ medkits: 3, bottles: 2, candy: ['Sour Skulls', 'Fang Taffy'] }));
    const count = (code: string) => slots.find((slot) => slot.code === code)?.count;
    expect(count('KeyH')).toBe(3);
    expect(count('KeyG')).toBe(2);
    expect(count('KeyX')).toBe(2);
    expect(count('KeyN')).toBe(null);
  });

  it('greys the medkit out at full health, where the sim refuses the heal', () => {
    const ready = (state: HudState) => wheelSlots(state).find((slot) => slot.code === 'KeyH')?.ready;
    expect(ready(hud({ health: 100, maxHealth: 100, medkits: 2 }))).toBe(false);
    expect(ready(hud({ health: 99, maxHealth: 100, medkits: 2 }))).toBe(true);
    expect(ready(hud({ medkits: 0 }))).toBe(false);
  });

  it('shows no gun slot with one gun, and the gun Q hands over to with two', () => {
    expect(codes(hud({ owned: ['pistol'] }))).not.toContain('KeyQ');
    const two = wheelSlots(hud({ owned: ['pistol', 'shotgun'], weapon: 'pistol' }));
    const gun = two.find((slot) => slot.code === 'KeyQ');
    expect(gun).toMatchObject({ art: 'gun', weapon: 'shotgun', name: 'Shotgun' });
  });

  it('wraps the gun slot round to the first gun owned', () => {
    const gun = wheelSlots(hud({ owned: ['pistol', 'carbine'], weapon: 'carbine' })).find((slot) => slot.code === 'KeyQ');
    expect(gun?.weapon).toBe('pistol');
  });

  it('counts the rounds the gun it hands over to can still fire', () => {
    const state = hud({
      owned: ['pistol', 'carbine'],
      weapon: 'pistol',
      mags: { pistol: 6, carbine: 10, shotgun: 0 },
      ammoBag: { pistol: 24, carbine: 15, shotgun: 0 },
    });
    // A total no other gun can reach, so the count cannot be the gun in hand's by accident.
    expect(wheelSlots(state).find((slot) => slot.code === 'KeyQ')?.count).toBe(25);
  });

  it('names the candy that would be eaten next', () => {
    const slot = wheelSlots(hud({ candy: ['Sour Skulls', 'Fang Taffy'] })).find((each) => each.code === 'KeyX');
    expect(slot).toMatchObject({ name: 'Sour Skulls', label: 'Eat Sour Skulls', ready: true });
  });

  it('greys the candy out while every one carried is already working', () => {
    const working = hud({ candy: ['Sour Skulls'], sugar: [{ name: 'Sour Skulls', left: 12 }] });
    expect(wheelSlots(working).find((slot) => slot.code === 'KeyX')).toMatchObject({ ready: false, name: 'Candy' });
  });

  it('keeps a candy name it does not know off the slot', () => {
    const slot = wheelSlots(hud({ candy: ['Mystery Lump'] })).find((each) => each.code === 'KeyX');
    expect(slot).toMatchObject({ name: 'Candy', label: 'Eat a candy', ready: true });
  });

  it('gives every slot a phrase for a screen reader', () => {
    const full = wheelSlots(hud({ bottles: 1, fireworks: 1, fountains: 1, candy: ['Jawbreaker'], owned: ['pistol', 'carbine'] }));
    for (const slot of full) expect(slot.label.length).toBeGreaterThan(3);
  });
});

describe('nextCandy', () => {
  it('skips what is already working and keeps the oldest of the rest', () => {
    const state = { candy: ['Sour Skulls', 'Fang Taffy'], sugar: [{ name: 'Sour Skulls', left: 8 }] } as const;
    expect(nextCandy(state)).toBe('Fang Taffy');
  });

  it('is null with nothing carried, and null with everything working', () => {
    expect(nextCandy({ candy: [], sugar: [] })).toBe(null);
    expect(nextCandy({ candy: ['Jawbreaker'], sugar: [{ name: 'Jawbreaker', left: 3 }] })).toBe(null);
  });
});

describe('stepSlot', () => {
  const slots = wheelSlots(fullBackpack());
  const codes = slots.map((slot) => slot.code);

  it('lights the first slot going down the ring from nothing, and the last going up', () => {
    expect(stepSlot(slots, null, 1)).toBe(codes[0]);
    expect(stepSlot(slots, null, -1)).toBe(codes[codes.length - 1]);
  });

  it('walks the ring one slot at a time, either way', () => {
    expect(stepSlot(slots, codes[0], 1)).toBe(codes[1]);
    expect(stepSlot(slots, codes[2], -1)).toBe(codes[1]);
  });

  it('wraps round both ends rather than stopping', () => {
    expect(stepSlot(slots, codes[codes.length - 1], 1)).toBe(codes[0]);
    expect(stepSlot(slots, codes[0], -1)).toBe(codes[codes.length - 1]);
  });

  it('steps past a slot that is no longer there, instead of sticking on it', () => {
    expect(stepSlot(slots, 'KeyZ', 1)).toBe(codes[0]);
  });

  it('holds still for no step and for an empty ring', () => {
    expect(stepSlot(slots, codes[1], 0)).toBe(codes[1]);
    expect(stepSlot([], null, 1)).toBe(null);
  });

  it('goes right round a full ring and comes home', () => {
    const home = codes.reduce((at) => stepSlot(slots, at, 1), codes[0] as string | null);
    expect(home).toBe(codes[0]);
  });
});

describe('slotAngle', () => {
  it('puts the first slot at the top and spreads the rest clockwise', () => {
    expect(slotAngle(0, 4)).toBe(-90);
    expect(slotAngle(1, 4)).toBe(0);
    expect(slotAngle(2, 4)).toBe(90);
    expect(slotAngle(3, 4)).toBe(180);
  });

  it('spreads any count evenly and never divides by nothing', () => {
    expect(slotAngle(0, 0)).toBe(-90);
    const seven = Array.from({ length: 7 }, (_, index) => slotAngle(index, 7));
    const gaps = seven.slice(1).map((angle, index) => angle - seven[index]);
    for (const gap of gaps) expect(gap).toBeCloseTo(360 / 7);
  });
});
