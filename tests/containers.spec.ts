import { describe, expect, it } from 'vitest';
import { CHARACTERS, characterOf } from '../shared/characters.ts';
import { CLATTER_CHANCE, CLATTER_RADIUS, LANDMARK_BUILDINGS } from '../shared/container-search.ts';
import { CONTAINER_LOOT, containerLoot } from '../shared/container-loot.ts';
import { containerInReach, SEARCH_SEC, townContainers } from '../shared/containers.ts';
import type { Container } from '../shared/containers.ts';
import { AMMO_FLOOR_SHARE, AMMO_PICKUPS, AMMO_POPULATION_SHARE, PLAYER_RADIUS, TICK_RATE } from '../shared/constants.ts';
import { difficultyDef } from '../shared/difficulty.ts';
import type { DifficultyId } from '../shared/difficulty.ts';
import { FINAL_LEVEL, levelDef } from '../shared/levels.ts';
import { ammoKillShare, placeTownLoot } from '../shared/loot.ts';
import { TILE_SIZE } from '../shared/protocol.ts';
import type { BuildingInstance, BuildingKind } from '../shared/protocol.ts';
import type { PlayerState, SimState } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { generateWorldMap } from '../shared/world-map.ts';
import { buildingAt, circleHitsSolid } from '../shared/world-query.ts';
import { createDefaultSurvivalNeeds } from '../shared/survival-needs.ts';
import { addRoamer, addZombie, eventsOf, input, quietSim, SEED, stateOf, steps } from './helpers/sim-harness.ts';

const SEEDS = [1, 2, 3, 4, 5, 6];
const HOMES: readonly string[] = ['house', 'apartment'] satisfies BuildingKind[];

const ticksFor = (container: Container): number => Math.ceil(SEARCH_SEC[container.kind] * TICK_RATE) + 1;

/** Open floor inside the container's room from which it is within reach. */
function standingSpot(state: SimState, container: Container): { x: number; y: number } | null {
  const { map } = state;
  const { x0, y0, x1, y1 } = container.box;
  const room = 24;
  for (let y = y0 - room; y <= y1 + room; y += 2) {
    for (let x = x0 - room; x <= x1 + room; x += 2) {
      const open = !circleHitsSolid(map, x, y, PLAYER_RADIUS);
      const sameRoom = buildingAt(map, x, y)?.id === container.building;
      const usable = open && sameRoom && containerInReach(map, x, y, () => false)?.id === container.id;
      if (usable) return { x, y };
    }
  }
  return null;
}

/** A player parked at the first container found to match, holding nothing yet. */
function beside(state: SimState, p: PlayerState, wanted: (c: Container) => boolean): Container {
  const container = townContainers(state.map).find((each) => wanted(each) && standingSpot(state, each));
  if (!container) throw new Error('no such container in this town');
  const spot = standingSpot(state, container) as { x: number; y: number };
  p.x = spot.x;
  p.y = spot.y;
  return container;
}

function setup(wanted: (c: Container) => boolean = () => true) {
  const quiet = quietSim();
  const [p] = quiet.state.players;
  const container = beside(quiet.state, p, wanted);
  return { ...quiet, p, container };
}

const hold = (sim: GameSimulation, seq = 1, search = true) => sim.setInput('a', input({ seq, search }));

describe('the town\'s containers', () => {
  it('work out the same on every machine, from the map alone', () => {
    expect(townContainers(generateWorldMap(99)).map((c) => [c.id, c.kind, c.x, c.y]))
      .toEqual(townContainers(generateWorldMap(99)).map((c) => [c.id, c.kind, c.x, c.y]));
  });

  it.each(SEEDS)('seed %i: every one can be stood beside, inside its own room', (seed) => {
    const state = stateOf(new GameSimulation({ seed }));
    for (const container of townContainers(state.map)) expect(standingSpot(state, container)).not.toBeNull();
  });

  it.each(SEEDS)('seed %i: every home has something to go through', (seed) => {
    const { map } = stateOf(new GameSimulation({ seed }));
    const searchable = new Set(townContainers(map).map((c) => c.building));
    for (const home of map.buildings.filter((each) => HOMES.includes(each.kind))) expect(searchable.has(home.id)).toBe(true);
  });

  it('cannot be reached from the far side of a wall', () => {
    const { state } = quietSim();
    // A house whose bedside locker stands against the north wall: the locker is not in every one.
    const nearNorthWall = (c: ReturnType<typeof townContainers>[number], house: BuildingInstance): boolean => c.box.y0 - house.y < TILE_SIZE;
    const houses = state.map.buildings.filter((each) => each.kind === 'house');
    const room = houses.find((house) => townContainers(state.map).some((c) => c.building === house.id && nearNorthWall(c, house))) as BuildingInstance;
    const against = townContainers(state.map).find((c) => c.building === room.id && nearNorthWall(c, room))!;
    const behindNorthWall = { x: against.x, y: room.y - 2 };
    expect(against.box.y0 - behindNorthWall.y).toBeLessThan(TILE_SIZE * 2);
    expect(containerInReach(state.map, behindNorthWall.x, behindNorthWall.y, () => false)?.building).not.toBe(room.id);
  });
});

describe('searching', () => {
  it('takes as long as the container says, then opens it for everyone', () => {
    const { sim, state, p, container } = setup();
    hold(sim);
    steps(sim, Math.floor(SEARCH_SEC[container.kind] * TICK_RATE) - 2);
    expect(state.containers[container.id].opened).toBe(false);
    expect(p.search).toBeGreaterThan(0.8);
    expect(sim.snapshot().openedContainers).toEqual([]);

    steps(sim, 4);
    expect(state.containers[container.id].opened).toBe(true);
    expect(p.search).toBe(0);
    expect(sim.snapshot().openedContainers).toEqual([container.id]);
  });

  it('every kind takes one to two seconds', () => {
    for (const seconds of Object.values(SEARCH_SEC)) {
      expect(seconds).toBeGreaterThanOrEqual(1);
      expect(seconds).toBeLessThanOrEqual(2);
    }
  });

  it('drops what was inside at the searcher\'s feet, and they take it', () => {
    const { sim, state, p, container } = setup();
    state.containers[container.id].loot = { type: 'pistol_ammo', rounds: 4 };
    const before = p.ammoBag.pistol;
    hold(sim);
    steps(sim, ticksFor(container));
    expect(p.ammoBag.pistol).toBe(before + 4);
    expect(state.containers[container.id].loot).toBeNull();
    expect(state.pickups).toEqual([]);
  });

  it('leaves what a full player cannot carry lying there', () => {
    const { sim, state, p, container } = setup();
    state.containers[container.id].loot = { type: 'medkit', rounds: 0 };
    p.medkits = 3;
    hold(sim);
    steps(sim, ticksFor(container));
    expect(state.pickups.map((item) => item.type)).toEqual(['medkit']);
  });

  it('says so when there was nothing in it', () => {
    const { sim, state, container } = setup();
    state.containers[container.id].loot = null;
    hold(sim);
    steps(sim, ticksFor(container));
    const [opened] = eventsOf(sim.snapshot(), 'container_opened');
    expect(opened.found).toBe(false);
    expect(opened.container).toBe(container.id);
  });

  it('stops the moment the key is let go, and starts over', () => {
    const { sim, state, p, container } = setup();
    hold(sim);
    steps(sim, 10);
    hold(sim, 2, false);
    sim.step();
    expect(p.search).toBe(0);
    hold(sim, 3);
    steps(sim, ticksFor(container) - 3);
    expect(state.containers[container.id].opened).toBe(false);
  });

  it('is undone by moving, and wants a fresh press after', () => {
    const { sim, state, p, container } = setup();
    hold(sim);
    steps(sim, 10);
    sim.setInput('a', input({ seq: 2, search: true, left: true }));
    sim.step();
    expect(p.search).toBe(0);
    sim.setInput('a', input({ seq: 3, search: true }));
    steps(sim, ticksFor(container));
    expect(p.search).toBe(0);
    expect(state.containers[container.id].opened).toBe(false);
  });

  it('is undone by a hit, and wants a fresh press after', () => {
    const { sim, state, p, container } = setup();
    hold(sim);
    steps(sim, 10);
    p.health -= 10;
    sim.step();
    expect(p.search).toBe(0);
    steps(sim, ticksFor(container));
    expect(state.containers[container.id].opened).toBe(false);

    hold(sim, 2, false);
    sim.step();
    hold(sim, 3);
    steps(sim, ticksFor(container));
    expect(state.containers[container.id].opened).toBe(true);
  });

  it('is not undone by damage when bleeding', () => {
    const { sim, state, p, container } = setup();
    p.needs = { ...createDefaultSurvivalNeeds(), bleeding: true };
    hold(sim);
    steps(sim, 10);
    p.health -= 10;
    sim.step();
    expect(p.search).toBeGreaterThan(0);
    steps(sim, ticksFor(container));
    expect(state.containers[container.id].opened).toBe(true);
  });

  it('a zombie\'s swing does it without anyone arranging the health', () => {
    const { sim, state, p, container } = setup();
    addZombie(state, 'walker', p.x + 4, p.y);
    hold(sim);
    steps(sim, ticksFor(container) * 2);
    expect(p.health).toBeLessThan(p.maxHealth);
    expect(state.containers[container.id].opened).toBe(false);
  });

  it('does not chain on to the next container on one press', () => {
    const { sim, state, p, container } = setup();
    hold(sim);
    steps(sim, ticksFor(container) + 5);
    expect(state.containers[container.id].opened).toBe(true);
    expect(p.search).toBe(0);
  });

  it('never runs on an opened container', () => {
    const { sim, state, p, container } = setup();
    const room = townContainers(state.map).filter((c) => c.building === container.building);
    for (const each of room) state.containers[each.id].opened = true;
    hold(sim);
    steps(sim, 5);
    expect(p.search).toBe(0);
  });

  it('is cut short when a teammate gets there first', () => {
    const { sim, state } = quietSim(['a', 'b']);
    const [a, b] = state.players;
    const container = beside(state, a, () => true);
    b.x = a.x;
    b.y = a.y;
    sim.setInput('a', input({ seq: 1, search: true }));
    steps(sim, 5);
    sim.setInput('b', input({ seq: 1, search: true }));
    steps(sim, ticksFor(container) - 4);
    expect(state.containers[container.id].opened).toBe(true);
    expect(a.search).toBe(0);
    expect(b.search).toBe(0);
    expect(eventsOf(sim.snapshot(), 'container_opened').length).toBe(1);
  });

  it('stops for anyone who goes down', () => {
    const { sim, state } = quietSim(['a', 'b']);
    const [a] = state.players;
    const container = beside(state, a, () => true);
    sim.setInput('a', input({ seq: 1, search: true }));
    steps(sim, 5);
    a.health = 1;
    addZombie(state, 'brute', a.x + 2, a.y);
    steps(sim, ticksFor(container) * 3);
    expect(a.search).toBe(0);
  });
});

/** Clears the town's rolls so the next search hits the given number. */
function fixRoll(state: SimState, roll: number): void {
  (state as { rng: () => number }).rng = () => roll;
}

describe('Kai\'s luck', () => {
  const skin = CHARACTERS.findIndex((character) => character.id === 'sol');
  const { searchLuck } = CHARACTERS[skin];

  /** Whether a search of an empty container by this survivor came up with anything. */
  function foundBy(survivor: number, roll: number): boolean {
    const { sim, state, p, container } = setup();
    p.skin = survivor;
    state.containers[container.id].loot = null;
    fixRoll(state, roll);
    hold(sim);
    steps(sim, ticksFor(container));
    return eventsOf(sim.snapshot(), 'container_opened')[0].found;
  }

  it('is a modest edge, and Kai\'s alone', () => {
    expect(searchLuck).toBeGreaterThan(0.1);
    expect(searchLuck).toBeLessThanOrEqual(0.2);
    expect(CHARACTERS.filter((character) => character.searchLuck > 0).map((character) => character.id)).toEqual(['sol']);
  });

  it('turns something up in an empty container on a good roll', () => {
    expect(foundBy(skin, searchLuck / 2)).toBe(true);
  });

  it('comes to nothing on a bad roll', () => {
    expect(foundBy(skin, searchLuck + 0.01)).toBe(false);
  });

  it('is no help to anyone else', () => {
    expect(foundBy(0, 0)).toBe(false);
  });

  it('finds what the place holds, in the sim, so the same run finds the same thing', () => {
    const search = (): readonly (string | undefined)[] => {
      const { sim, state, p, container } = setup((c) => c.buildingKind === 'pharmacy');
      p.skin = skin;
      p.medkits = 3;
      state.containers[container.id].loot = null;
      fixRoll(state, searchLuck / 2);
      hold(sim);
      steps(sim, ticksFor(container));
      return state.pickups.map((item) => item.type);
    };
    const found = search();
    expect(['bandage', 'medkit', 'disinfectant', 'antibiotics']).toContain(found[0]);
    expect(found).toEqual(search());
  });

  it('adds nothing to a container that had something in it', () => {
    const { sim, state, p, container } = setup();
    p.skin = skin;
    p.medkits = 3;
    state.containers[container.id].loot = { type: 'medkit', rounds: 0 };
    fixRoll(state, 0);
    hold(sim);
    steps(sim, ticksFor(container));
    expect(state.pickups.map((item) => item.type)).toEqual(['medkit']);
  });
});

describe('a clatter', () => {
  it('wakes what is near through the noise system, and stays rare', () => {
    expect(CLATTER_CHANCE).toBeLessThanOrEqual(0.15);
    const { sim, state, p, container } = setup();
    const { noise, clatterChance } = characterOf(p.skin);
    const near = addRoamer(state, 'walker', p.x + CLATTER_RADIUS * noise - 20, p.y);
    const far = addRoamer(state, 'walker', p.x + CLATTER_RADIUS * noise + 60, p.y);
    fixRoll(state, (CLATTER_CHANCE * clatterChance) / 2);
    hold(sim);
    steps(sim, ticksFor(container));
    expect(eventsOf(sim.snapshot(), 'container_opened')[0].noisy).toBe(true);
    expect(near.mode).not.toBe('wander');
    expect(far.mode).toBe('wander');
  });

  it('carries three quarters as far from Night, and clatters half as often', () => {
    const skin = CHARACTERS.findIndex((character) => character.id === 'night');
    const searched = (night: boolean, roll: number) => {
      const { sim, state, p, container } = setup();
      p.skin = night ? skin : 1;
      const between = addRoamer(state, 'walker', p.x + CLATTER_RADIUS * 0.875, p.y);
      const near = addRoamer(state, 'walker', p.x + CLATTER_RADIUS * 0.6, p.y);
      fixRoll(state, roll);
      hold(sim);
      steps(sim, ticksFor(container));
      const woken = (zombie: { mode: string }): boolean => zombie.mode !== 'wander';
      return { between: woken(between), near: woken(near), noisy: eventsOf(sim.snapshot(), 'container_opened')[0].noisy };
    };
    const lucky = CLATTER_CHANCE * 0.4;
    const between = CLATTER_CHANCE * 0.75;
    expect(searched(false, lucky)).toEqual({ noisy: true, between: true, near: true });
    expect(searched(true, lucky)).toEqual({ noisy: true, between: false, near: true });
    expect(searched(false, between).noisy).toBe(true);
    expect(searched(true, between).noisy).toBe(false);
  });

  it('is silent otherwise', () => {
    const { sim, state, p, container } = setup();
    const near = addRoamer(state, 'walker', p.x + 60, p.y);
    fixRoll(state, CLATTER_CHANCE + 0.01);
    hold(sim);
    steps(sim, ticksFor(container));
    expect(near.mode).not.toBe('alert');
    expect(eventsOf(sim.snapshot(), 'container_opened')[0].noisy).toBe(false);
  });
});

describe('what is in them', () => {
  const towns = SEEDS.map((seed) => stateOf(new GameSimulation({ seed })));

  it('is the same for the same run', () => {
    const a = stateOf(new GameSimulation({ seed: SEED }));
    const b = stateOf(new GameSimulation({ seed: SEED }));
    expect(a.containers).toEqual(b.containers);
  });

  it('leaves every home with something shut away in it', () => {
    for (const state of towns) {
      const stocked = new Set(townContainers(state.map).filter((c, id) => state.containers[id].loot !== null).map((c) => c.building));
      for (const home of state.map.buildings.filter((each) => HOMES.includes(each.kind))) expect(stocked.has(home.id)).toBe(true);
    }
  });

  it('leaves most containers empty, so searching stays a choice', () => {
    for (const state of towns) expect(containerLoot(state).length / state.containers.length).toBeLessThan(0.4);
  });

  it('puts more ammo in homes than the floors of homes hold', () => {
    for (const state of towns) {
      const ammoInHomes = townContainers(state.map).filter((c, id) => {
        const type = state.containers[id].loot?.type;
        return HOMES.includes(c.buildingKind) && type !== undefined && type in AMMO_PICKUPS;
      }).length;
      const onHomeFloors = state.pickups.filter((item) => {
        const kind = buildingAt(state.map, item.x, item.y)?.kind;
        return kind !== undefined && HOMES.includes(kind) && item.type in AMMO_PICKUPS;
      }).length;
      expect(ammoInHomes).toBeGreaterThan(onHomeFloors);
    }
  });

  it('holds half-used boxes only', () => {
    for (const state of towns) {
      for (const { type, rounds } of containerLoot(state)) {
        if (type in AMMO_PICKUPS) expect(rounds).toBeLessThan(AMMO_PICKUPS[type as keyof typeof AMMO_PICKUPS].rounds);
        else expect(rounds).toBe(0);
      }
    }
  });

  it('counts against the town\'s ammo budget, floor and containers together', () => {
    for (const state of towns) {
      const share = ammoKillShare([...state.pickups, ...containerLoot(state)]);
      expect(share).toBeLessThanOrEqual(AMMO_POPULATION_SHARE * 1.02);
      expect(share).toBeGreaterThan(AMMO_POPULATION_SHARE * 0.7);
      expect(ammoKillShare(containerLoot(state))).toBeGreaterThan(0.1);
    }
  });

  const difficulties: readonly DifficultyId[] = ['stay_close', 'lights_out', 'undead_tired'];
  it.each(difficulties)('%s: spends the whole budget in every town, split the same way on every level', (difficulty) => {
    for (const seed of SEEDS) {
      const state = stateOf(new GameSimulation({ seed, difficulty }));
      for (const level of [1, 5, FINAL_LEVEL]) {
        state.level = level;
        state.pickups = [];
        placeTownLoot(state);
        const floors = ammoKillShare(state.pickups);
        const total = floors + ammoKillShare(containerLoot(state));
        const budget = AMMO_POPULATION_SHARE * levelDef(level).difficulty * difficultyDef(difficulty).ammo;
        expect(total / budget).toBeGreaterThan(0.97);
        expect(total / budget).toBeLessThanOrEqual(1);
        expect(Math.abs(floors / total - AMMO_FLOOR_SHARE)).toBeLessThan(0.03);
      }
    }
  });

  it('has a rule for every kind of room', () => {
    for (const { odds } of Object.values(CONTAINER_LOOT)) {
      expect(odds).toBeGreaterThan(0);
      expect(odds).toBeLessThan(1);
    }
  });

  it('includes searchable cars, boxes, and shelves in every town', () => {
    const containers = townContainers(towns[0].map);
    expect(containers.some((c) => c.kind === 'car')).toBe(true);
    expect(containers.some((c) => c.kind === 'box')).toBe(true);
    expect(containers.some((c) => c.kind === 'shelf')).toBe(true);
  });

  it.each(['car', 'box', 'shelf'] as const)('searches a %s', (kind) => {
    const { sim, state, container } = setup((c) => c.kind === kind);
    hold(sim);
    steps(sim, ticksFor(container));
    expect(state.containers[container.id].opened).toBe(true);
    expect(sim.snapshot().openedContainers).toContain(container.id);
  });

  it('starts over in the next town', () => {
    const { sim, state, container } = setup();
    hold(sim);
    steps(sim, ticksFor(container));
    expect(sim.snapshot().openedContainers.length).toBe(1);
    sim.restart();
    expect(sim.snapshot().openedContainers).toEqual([]);
    expect(state.containers.length).toBe(townContainers(state.map).length);
  });

  it('searching a police car can yield carbines or shotguns', () => {
    const { sim, state, p, container } = setup((c) => c.prop === 'police_h' || c.prop === 'police_v');
    state.containers[container.id].loot = null;
    fixRoll(state, 0.1);
    hold(sim);
    steps(sim, ticksFor(container));
    const guns = state.pickups.map((item) => item.type).filter((t) => t === 'carbine' || t === 'shotgun');
    const playerHasGun = p.owned.includes('carbine') || p.owned.includes('shotgun');
    expect(guns.length > 0 || playerHasGun).toBe(true);
  });

  it('searching an ambulance yields medical supplies', () => {
    const { sim, state, p, container } = setup((c) => c.prop === 'ambulance_h');
    state.containers[container.id].loot = null;
    p.medkits = 3;
    p.health = p.maxHealth;
    fixRoll(state, 0.1);
    hold(sim);
    steps(sim, ticksFor(container));
    const meds = state.pickups.map((item) => item.type).filter((t) => ['medkit', 'bandage', 'antibiotics', 'disinfectant'].includes(t));
    expect(meds.length).toBeGreaterThan(0);
  });

  it('searching a dumpster can yield any random item in the game', () => {
    const { sim, state, container } = setup((c) => c.kind === 'dumpster');
    expect(state.containers[container.id].loot).toBeNull();
    fixRoll(state, 0.1);
    hold(sim);
    steps(sim, ticksFor(container));
    expect(state.containers[container.id].opened).toBe(true);
    const hasDrop = state.pickups.length > 0 || eventsOf(sim.snapshot(), 'pickup').length > 0;
    expect(hasDrop).toBe(true);
  });

  it('an empty search can turn up a map clue revealing an unvisited cache building', () => {
    const { sim, state, container } = setup((c) => c.kind === 'drawer');
    state.containers[container.id].loot = null;
    const [p] = state.players;
    p.bottles = 4;
    const targetBuilding = state.map.buildings.find((b) => b.id !== container.building && b.of === undefined && !LANDMARK_BUILDINGS.has(b.kind))!;
    state.pickups = [{ id: 'p1', type: 'medkit', x: targetBuilding.x + 20, y: targetBuilding.y + 20, ttl: null, rounds: 0 }];
    expect(state.entered.has(targetBuilding.id)).toBe(false);

    fixRoll(state, 0.05);
    hold(sim);
    steps(sim, ticksFor(container));

    expect(state.containers[container.id].opened).toBe(true);
    expect(state.entered.has(targetBuilding.id)).toBe(true);
    expect(state.clues.get(targetBuilding.id)).toBe('medkit');
    const leftovers = sim.snapshot().leftovers;
    expect(leftovers).toBeDefined();
    expect(leftovers?.some((l) => l.building === targetBuilding.id && l.clue === true && l.clueItem === 'medkit' && (l.supplies.med ?? 0) > 0)).toBe(true);
  });

  it('map clues only reveal non-landmark buildings', () => {
    const { sim, state, container } = setup((c) => c.kind === 'drawer');
    state.containers[container.id].loot = null;
    const [p] = state.players;
    p.bottles = 4;
    const landmarkBuilding = state.map.buildings.find((b) => b.id !== container.building && b.of === undefined && LANDMARK_BUILDINGS.has(b.kind))!;
    state.pickups = [{ id: 'p1', type: 'shotgun', x: landmarkBuilding.x + 20, y: landmarkBuilding.y + 20, ttl: null, rounds: 0 }];

    fixRoll(state, 0.05);
    hold(sim);
    steps(sim, ticksFor(container));

    expect(state.clues.has(landmarkBuilding.id)).toBe(false);
  });
});
