import { describe, expect, it } from 'vitest';
import { LOOT_RULES } from '../shared/loot.ts';
import { BUILDING_KINDS } from '../shared/protocol.ts';
import type { BuildingKind } from '../shared/protocol.ts';
import { guideLeaves, guidePlaces, placePage, TIER_ORDER, whereToLook } from '../src/game/town-guide.ts';
import type { GuidePlace } from '../src/game/town-guide.ts';

const placeOf = (id: GuidePlace['id']): GuidePlace => {
  const place = guidePlaces().find((each) => each.id === id);
  if (!place) throw new Error(`no page for ${id}`);
  return place;
};
const tierOf = (id: GuidePlace['id'], find: string) => placeOf(id).finds.find((each) => each.id === find)?.tier;

describe('the Town Guide', () => {
  it('has a page for every kind of building, upstairs read as one, one for the street and one for the fireworks bus', () => {
    const ids = guidePlaces().map((place) => place.id);
    const covered = BUILDING_KINDS.filter((kind) => kind !== 'apartment_upstairs');
    expect([...ids].sort()).toEqual([...covered, 'cars', 'fireworks_bus'].sort());
  });

  it('lists every find a building\'s floors can hold', () => {
    for (const kind of Object.keys(LOOT_RULES) as BuildingKind[]) {
      const page = kind === 'apartment_upstairs' ? placeOf('upstairs') : placeOf(kind);
      const ids = page.finds.map((find) => find.id);
      for (const type of Object.keys(LOOT_RULES[kind].table)) expect(ids).toContain(type);
    }
  });

  it('says the station always has a carbine and the gun shop a shotgun', () => {
    expect(tierOf('police', 'carbine')).toBe('always');
    expect(tierOf('gun_shop', 'shotgun')).toBe('always');
  });

  it('sends players for medkits to the pharmacy and clinic, and flares to the station, garage and cars', () => {
    expect(tierOf('pharmacy', 'medkit')).toBe('often');
    expect(tierOf('clinic', 'medkit')).toBe('often');
    expect(tierOf('police', 'flare')).toBe('often');
    expect(tierOf('garage', 'flare')).toBeDefined();
    expect(tierOf('cars', 'flare')).toBeDefined();
    expect(tierOf('house', 'flare')).toBeUndefined();
  });

  it('sends players to the diner for a knife first', () => {
    expect(tierOf('diner', 'knife')).toBe('often');
    expect(whereToLook().find((line) => line.id === 'knife')?.places[0].id).toBe('diner');
  });

  it('puts candy where the tables hide it and never in cars', () => {
    expect(tierOf('upstairs', 'candy')).toBe('often');
    expect(tierOf('cars', 'candy')).toBeUndefined();
  });

  it('lists each page\'s finds best tier first', () => {
    for (const place of guidePlaces()) {
      const ranks = place.finds.map((find) => TIER_ORDER.indexOf(find.tier));
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
      expect(place.searchIn.length).toBeGreaterThan(0);
    }
  });

  it('indexes each find to at most three places that hold it, best first', () => {
    for (const line of whereToLook()) {
      expect(line.places.length).toBeGreaterThan(0);
      expect(line.places.length).toBeLessThanOrEqual(3);
      for (const { id } of line.places) expect(placeOf(id).finds.some((find) => find.id === line.id)).toBe(true);
    }
    const medkits = whereToLook().find((line) => line.id === 'medkit');
    expect(medkits?.places.map((place) => place.id).slice(0, 2).sort()).toEqual(['clinic', 'pharmacy']);
    const parts = whereToLook().find((line) => line.id === 'parts');
    expect(parts?.places[0].id).toBe('gun_shop');
  });

  it('opens on the contents, then the index, then a page per place', () => {
    const leaves = guideLeaves();
    expect(leaves.map((leaf) => leaf.kind).slice(0, 2)).toEqual(['front', 'index']);
    expect(leaves).toHaveLength(2 + guidePlaces().length);
    expect(placePage('pharmacy')).toBe(3);
  });
});
