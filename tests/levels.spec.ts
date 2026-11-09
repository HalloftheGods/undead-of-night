import { vanBoxAt } from '../shared/exit-van.ts';
import { TILE_SIZE } from '../shared/protocol.ts';
import { describe, expect, it } from 'vitest';
import { PLAYER_RADIUS, ROAMER_MIX, STANDING_POPULATION, ZOMBIE_CAP } from '../shared/constants.ts';
import { FlowField } from '../shared/flow-field.ts';
import { chooseExitSpot } from '../shared/level-exit.ts';
import { FINAL_LEVEL, LEVELS, levelDef, levelPopulation, levelSeed } from '../shared/levels.ts';
import { ammoKillShare, placeTownLoot } from '../shared/loot.ts';
import type { ZombieType } from '../shared/protocol.ts';
import { createRng } from '../shared/rng.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { waveRoster } from '../shared/waves.ts';
import { buildingAt, circleHitsSolid, generateWorldMap } from '../shared/world-map.ts';
import { stateOf } from './helpers/sim-harness.ts';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 4242, 0x7ffffffe];
const TITLES = [
  'Silent Ruins', 'Escalation', 'Into the Breach', 'Abyssal Depths', 'Contamination Zone',
  'Blackout', 'Quarantine Breach', 'Frozen Wasteland', 'The Hive', 'Final Stand',
];
const FAR_FROM_ENTRY = 1000;

const count = (roster: readonly ZombieType[], type: ZombieType): number => roster.filter((each) => each === type).length;
const rosterAt = (level: number, wave: number): ZombieType[] => waveRoster(wave, createRng(level * 100 + wave), levelDef(level));

/** The endless game's horde, frozen here so level 1 cannot drift from it. */
function endlessCounts(wave: number): Record<ZombieType, number> {
  const total = 5 + wave * 3;
  const brute = wave % 5 === 0 ? wave / 5 : 0;
  const bloater = wave >= 3 ? Math.min(8, 1 + Math.floor((wave - 3) / 2)) : 0;
  const runner = wave >= 2 ? Math.floor(total * Math.min(0.4, 0.14 + (wave - 2) * 0.04)) : 0;
  return { walker: total - runner - bloater - brute, runner, bloater, brute, screamer: 0 };
}

describe('the level table', () => {
  it('holds the ten levels in order', () => {
    expect(LEVELS.map((level) => level.title)).toEqual(TITLES);
    expect(LEVELS.map((level) => level.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(FINAL_LEVEL).toBe(10);
  });

  it('asks for two hordes at first and five at the end, never fewer than the level before', () => {
    const hordes = LEVELS.map((level) => level.hordes);
    expect(hordes[0]).toBe(2);
    expect(hordes[hordes.length - 1]).toBe(5);
    hordes.slice(1).forEach((value, index) => {
      expect(value).toBeGreaterThanOrEqual(hordes[index]);
      expect(value - hordes[index]).toBeLessThanOrEqual(1);
    });
  });

  it('rises every level, in the crowd and in each kind of tough zombie', () => {
    for (let level = 2; level <= FINAL_LEVEL; level++) {
      const row = levelDef(level);
      const before = levelDef(level - 1);
      expect(row.difficulty).toBeGreaterThan(before.difficulty);
      expect(levelPopulation(level)).toBeGreaterThan(levelPopulation(level - 1));
      expect(row.mix.runner).toBeGreaterThan(before.mix.runner);
      expect(row.mix.bloater).toBeGreaterThanOrEqual(before.mix.bloater);
      expect(row.mix.brute).toBeGreaterThanOrEqual(before.mix.brute);
    }
  });

  it('gives levels 1 and 2 the look of the game today and a look of their own to the rest', () => {
    expect(levelDef(1).theme).toBe(levelDef(2).theme);
    const themes = LEVELS.slice(1).map((level) => level.theme);
    expect(new Set(themes).size).toBe(themes.length);
  });

  it('holds out-of-range level numbers to the ends of the run', () => {
    expect(levelDef(0).number).toBe(1);
    expect(levelDef(99).number).toBe(FINAL_LEVEL);
  });

  it('leaves room under the zombie cap for the biggest horde on top of the biggest town', () => {
    const lastHorde = rosterAt(FINAL_LEVEL, levelDef(FINAL_LEVEL).hordes).length;
    expect(levelPopulation(FINAL_LEVEL) + lastHorde).toBeLessThanOrEqual(ZOMBIE_CAP);
  });
});

describe('level 1 is the game as it was', () => {
  it('has the same town population and street mix', () => {
    expect(levelPopulation(1)).toBe(STANDING_POPULATION);
    expect(levelDef(1).mix).toEqual({ runner: 0, bloater: 0, brute: 0 });
    expect(ROAMER_MIX).toEqual({ bloater: 0.08, runner: 0.14 });
  });

  it.each([1, 2, 3, 4, 5, 6, 10])('sends the same horde %i as the endless game', (wave) => {
    const roster = waveRoster(wave, createRng(wave));
    // Horde 1 is the one deliberate change: level 1 softens it (see level-one-opening.spec.ts).
    if (wave === 1) {
      expect(roster).toHaveLength(5);
      expect(roster.every((type) => type === 'walker')).toBe(true);
      return;
    }
    const expected = endlessCounts(wave);
    for (const type of ['walker', 'runner', 'bloater', 'brute'] as const) expect(count(roster, type)).toBe(expected[type]);
    expect(rosterAt(1, wave).length).toBe(roster.length);
  });

  it('is the town the run seed has always made', () => {
    const map = new GameSimulation({ seed: 4242 }).map;
    expect(map.seed).toBe(4242);
    expect(map.tiles).toEqual(generateWorldMap(4242).tiles);
  });
});

describe('hordes by level', () => {
  it('grow with the level at the same horde number', () => {
    for (let level = 2; level <= FINAL_LEVEL; level++) {
      expect(rosterAt(level, 2).length).toBeGreaterThanOrEqual(rosterAt(level - 1, 2).length);
    }
    expect(rosterAt(FINAL_LEVEL, 2).length).toBeGreaterThan(rosterAt(1, 2).length);
  });

  it('bring more of the tough kinds late in the run', () => {
    const early = rosterAt(1, 2);
    const late = rosterAt(FINAL_LEVEL, 2);
    expect(count(late, 'runner') / late.length).toBeGreaterThan(count(early, 'runner') / early.length);
    expect(count(late, 'bloater')).toBeGreaterThan(count(early, 'bloater'));
    expect(count(rosterAt(FINAL_LEVEL, levelDef(FINAL_LEVEL).hordes), 'brute')).toBeGreaterThan(0);
  });

  it('never ask for a negative crowd of walkers at the end of the run', () => {
    expect(count(rosterAt(FINAL_LEVEL, 30), 'walker')).toBeGreaterThanOrEqual(0);
  });
});

describe('level seeds', () => {
  it('start from the run seed and differ from each other', () => {
    for (const seed of SEEDS) {
      expect(levelSeed(seed, 1)).toBe(seed);
      const all = LEVELS.map((level) => levelSeed(seed, level.number));
      expect(new Set(all).size).toBe(LEVELS.length);
      for (const value of all) expect(Number.isSafeInteger(value)).toBe(true);
    }
  });

  it('are the same every time', () => {
    expect(levelSeed(4242, 7)).toBe(levelSeed(4242, 7));
    expect(levelSeed(4242, 7)).not.toBe(levelSeed(4243, 7));
  });

  it('raise towns that differ', () => {
    const towns = [1, 2, 3].map((level) => generateWorldMap(levelSeed(4242, level)));
    expect(towns[0].spawn).not.toEqual(towns[1].spawn);
    expect(towns[1].buildings).not.toEqual(towns[2].buildings);
  });
});

describe('the van', () => {
  const towns = SEEDS.flatMap((seed) => [1, 5, 10].map((level) => levelSeed(seed, level)));

  it.each(towns)('parks outdoors, in the open and a long walk from the entry in town %i', (seed) => {
    const map = generateWorldMap(seed);
    const spot = chooseExitSpot(map);
    const walk = new FlowField(map);
    walk.recompute([map.spawn]);

    expect(buildingAt(map, spot.x, spot.y)).toBeNull();
    // The van's own body is solid now, so the open ground is judged just outside it.
    const body = vanBoxAt(spot);
    const outside = [[body.x0 - PLAYER_RADIUS - 1, spot.y], [body.x1 + PLAYER_RADIUS + 1, spot.y], [spot.x, spot.y + PLAYER_RADIUS + 1], [spot.x, body.y0 - PLAYER_RADIUS - 1]];
    for (const [x, y] of outside) expect(circleHitsSolid(map, x, y, PLAYER_RADIUS)).toBe(false);
    expect(Number.isFinite(walk.distanceAt(spot.x, spot.y + TILE_SIZE))).toBe(true);
    expect(Math.hypot(spot.x - map.spawn.x, spot.y - map.spawn.y)).toBeGreaterThan(FAR_FROM_ENTRY);
  });

  it('parks in the same spot on every machine', () => {
    expect(chooseExitSpot(generateWorldMap(99))).toEqual(chooseExitSpot(generateWorldMap(99)));
  });
});

describe('loot by level', () => {
  it('holds more ammo in a bigger town, in step with its population', () => {
    const sim = new GameSimulation({ seed: 4242 });
    const state = stateOf(sim);
    const firstTown = ammoKillShare(state.pickups);
    state.level = FINAL_LEVEL;
    state.pickups = [];
    placeTownLoot(state);
    expect(ammoKillShare(state.pickups)).toBeGreaterThan(firstTown);
  });
});
