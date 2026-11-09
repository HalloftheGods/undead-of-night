import { describe, expect, it } from 'vitest';
import { townPrint } from '../shared/town-print.ts';
import { generateWorldMap } from '../shared/world-map.ts';
import { isWelcomePacket } from '../src/network/packet-guards.ts';

describe('town print', () => {
  it('is the same for the same town built twice, and differs between towns', () => {
    expect(townPrint(generateWorldMap(7, 2))).toBe(townPrint(generateWorldMap(7, 2)));
    expect(townPrint(generateWorldMap(7, 2))).not.toBe(townPrint(generateWorldMap(8, 2)));
    expect(townPrint(generateWorldMap(7, 1))).not.toBe(townPrint(generateWorldMap(7, 2)));
  });

  it('changes when one car stands somewhere else', () => {
    const map = generateWorldMap(7, 1);
    const moved = { ...map, props: map.props.map((prop, i) => (i === 3 ? { ...prop, x: prop.x + 16 } : prop)) };
    expect(townPrint(moved)).not.toBe(townPrint(map));
  });

  it('rides the welcome, and a welcome without one still reads', () => {
    const welcome = { type: 'welcome', yourId: 'p1', tickRate: 20, mapSeed: 7 };
    expect(isWelcomePacket(welcome)).toBe(true);
    expect(isWelcomePacket({ ...welcome, town: 12345 })).toBe(true);
    expect(isWelcomePacket({ ...welcome, town: 'abc' })).toBe(false);
  });
});
