import { describe, expect, it } from 'vitest';
import { BUNKER_SEED } from '../shared/home-protocol.ts';
import { LEVELS } from '../shared/levels.ts';
import { EVENT_CHANCE, nightEventFor } from '../shared/night-events.ts';
import { waveRoster } from '../shared/waves.ts';
import { levelTitle } from '../src/game/level-hud.ts';
import { withEvent } from '../src/engine/level-look.ts';
import { LEVEL_LOOKS } from '../src/engine/level-look.ts';

const SEEDS = Array.from({ length: 2000 }, (_, i) => (Math.imul(i + 1, 0x9e3779b1) >>> 0));

describe('night events', () => {
  it('come to about the set share of towns, all three kinds, and never to the first town or the bunker', () => {
    const drawn = SEEDS.map((seed) => nightEventFor(seed, 3));
    const share = drawn.filter(Boolean).length / SEEDS.length;
    expect(share).toBeGreaterThan(EVENT_CHANCE - 0.05);
    expect(share).toBeLessThan(EVENT_CHANCE + 0.05);
    expect(new Set(drawn.filter(Boolean).map((event) => event?.id))).toEqual(new Set(['fog', 'blood_moon', 'power_cut']));
    expect(SEEDS.every((seed) => nightEventFor(seed, 1) === null)).toBe(true);
    expect(nightEventFor(BUNKER_SEED, 3)).toBeNull();
  });

  it('are the same for the same town every time', () => {
    expect(SEEDS.slice(0, 50).map((seed) => nightEventFor(seed, 5))).toEqual(SEEDS.slice(0, 50).map((seed) => nightEventFor(seed, 5)));
  });

  it('never cut the power in a town already blacked out', () => {
    const blackout = LEVELS.find((level) => level.theme === 'blackout')?.number ?? 6;
    expect(SEEDS.some((seed) => nightEventFor(seed, blackout)?.id === 'power_cut')).toBe(false);
  });

  it('make a blood moon horde twice the size', () => {
    const plain = waveRoster(4, () => 0.5, LEVELS[2]);
    const bloody = waveRoster(4, () => 0.5, LEVELS[2], undefined, 2);
    expect(bloody.length).toBeGreaterThanOrEqual(Math.round(plain.length * 1.9));
  });

  it('are named on the level card and change the look', () => {
    const seed = SEEDS.find((s) => nightEventFor(s, 3)?.id === 'fog') ?? 0;
    expect(levelTitle(3, seed).event).toContain('Fog');
    expect(levelTitle(3).event).toBeUndefined();
    expect(withEvent(LEVEL_LOOKS.night, 'fog').wash).not.toBeNull();
    expect(withEvent(LEVEL_LOOKS.night, null)).toBe(LEVEL_LOOKS.night);
  });
});

describe('a blood moon in the sim', () => {
  it('pays double for a kill', async () => {
    const { damageZombie } = await import('../shared/combat.ts');
    const { addZombie, quietSim } = await import('./helpers/sim-harness.ts');
    const { state } = quietSim(['a']);
    const seed = SEEDS.find((s) => nightEventFor(s, 3)?.id === 'blood_moon') ?? 0;
    state.level = 3;
    state.map = { ...state.map, seed };
    const [a] = state.players;
    const zombie = addZombie(state, 'walker', a.x + 200, a.y);
    const before = a.score;
    damageZombie(state, zombie, 1e6, 0, 'a');
    expect(a.score - before).toBe(6);
  });
});
