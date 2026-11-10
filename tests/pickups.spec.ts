import { describe, expect, it } from 'vitest';
import {
  AMMO_PICKUPS,
  AMMO_POPULATION_SHARE,
  BANDAGE_HEAL,
  KILL_DROP_CHANCE,
  KILL_DROP_ROUNDS,
  KILL_DROP_TTL_SEC,
  MEDKIT_HEAL,
  MEDKIT_MAX,
  PICKUP_RADIUS,
  RESTOCK_MIN_DISTANCE,
  TICK_RATE,
  WEAPONS,
} from '../shared/constants.ts';
import { damageZombie } from '../shared/combat.ts';
import { containerLoot } from '../shared/container-loot.ts';
import { isPartPickup } from '../shared/gun-upgrades.ts';
import { isKitPickup } from '../shared/round-effects.ts';
import { LOOT_RULES, ammoKillShare, lootSpots, restockLoot } from '../shared/loot.ts';
import { BUILDING_DEFS, BUILDING_KINDS } from '../shared/protocol.ts';
import type { BuildingInstance, BuildingKind, PickupType } from '../shared/protocol.ts';
import type { PickupState, SimState } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { buildingAt, circleHitsSolid, isBlockedAt } from '../shared/world-map.ts';
import { addZombie, eventsOf, input, quietSim, stateOf, steps } from './helpers/sim-harness.ts';

function drop(state: SimState, type: PickupType, x: number, y: number, rounds = 0) {
  state.pickups.push({ id: `test-${type}`, type, x, y, ttl: null, rounds });
}

const boxOf = (type: keyof typeof AMMO_PICKUPS): number => AMMO_PICKUPS[type].rounds;
const SEEDS = [1, 2, 3, 4, 5, 6];

describe('a second copy of a gun', () => {
  function owner() {
    const quiet = quietSim();
    const [p] = quiet.state.players;
    p.guns.shotgun = { ammo: 2 };
    p.owned = ['pistol', 'shotgun'];
    return { ...quiet, p };
  }

  it('leaves what will not fit lying there, for a later visit or a teammate', () => {
    const { sim, state, p } = owner();
    const { foundAmmo, reserveCap } = WEAPONS.shotgun;
    p.ammoBag.shotgun = reserveCap - 1;
    drop(state, 'shotgun', p.x, p.y);
    sim.step();
    expect(p.ammoBag.shotgun).toBe(reserveCap);
    expect(state.pickups.map((item) => item.rounds)).toEqual([foundAmmo - 1]);

    p.ammoBag.shotgun = 0;
    sim.step();
    expect(p.ammoBag.shotgun).toBe(foundAmmo - 1);
    expect(state.pickups.length).toBe(0);
  });

  it('is not touched when the bag is full', () => {
    const { sim, state, p } = owner();
    p.ammoBag.shotgun = WEAPONS.shotgun.reserveCap;
    drop(state, 'shotgun', p.x, p.y);
    sim.step();
    expect(state.pickups.map((item) => item.rounds)).toEqual([0]);
    expect(eventsOf(sim.snapshot(), 'pickup').length).toBe(0);
  });

  it('gives a newcomer to the gun only the rounds left in it', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    drop(state, 'shotgun', p.x, p.y, 1);
    sim.step();
    expect(p.guns.shotgun?.ammo).toBe(1);
    expect(state.pickups.length).toBe(0);
  });
});

describe('magazines in snapshots', () => {
  it('reports every gun, loaded or not, and 0 for one not owned', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    drop(state, 'carbine', p.x, p.y);
    sim.step();
    sim.setInput('a', input({ seq: 1, weapon: 'pistol' }));
    sim.step();
    const [me] = sim.snapshot().players;
    expect(me.weapon).toBe('pistol');
    expect(me.mags).toEqual({ pistol: WEAPONS.pistol.magSize, carbine: WEAPONS.carbine.foundAmmo, shotgun: 0 });
  });
});

describe('healing', () => {
  it('a bandage heals a little on pickup, capped at max health', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.health = 30;
    drop(state, 'bandage', p.x, p.y);
    sim.step();
    expect(p.health).toBe(30 + BANDAGE_HEAL);
    expect(BANDAGE_HEAL).toBeLessThan(MEDKIT_HEAL);
    expect(state.pickups.length).toBe(0);
    const [event] = eventsOf(sim.snapshot(), 'pickup');
    expect(event).toMatchObject({ playerId: 'a', pickup: 'bandage' });

    p.health = p.maxHealth - 5;
    drop(state, 'bandage', p.x, p.y);
    sim.step();
    expect(p.health).toBe(p.maxHealth);
  });

  it('a bandage stays on the ground at full health', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    drop(state, 'bandage', p.x, p.y);
    steps(sim, 5);
    expect(state.pickups.length).toBe(1);
    expect(eventsOf(sim.snapshot(), 'pickup').length).toBe(0);
    p.health = 50;
    sim.step();
    expect(state.pickups.length).toBe(0);
  });

  it('a medkit is carried, not used, and stops at the limit', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.health = 40;
    for (let i = 0; i < MEDKIT_MAX; i++) {
      drop(state, 'medkit', p.x, p.y);
      sim.step();
    }
    expect(p.medkits).toBe(MEDKIT_MAX);
    expect(p.health).toBe(40);
    drop(state, 'medkit', p.x, p.y);
    steps(sim, 3);
    expect(p.medkits).toBe(MEDKIT_MAX);
    expect(state.pickups.length).toBe(1);
  });

  it('the heal input spends one medkit', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.medkits = 2;
    p.health = 30;
    sim.setInput('a', input({ seq: 1, heal: true }));
    sim.step();
    expect(p.health).toBe(30 + MEDKIT_HEAL);
    expect(p.medkits).toBe(1);
    const [heal] = eventsOf(sim.snapshot(), 'heal');
    expect(heal).toMatchObject({ playerId: 'a', amount: MEDKIT_HEAL });
    sim.setInput('a', input({ seq: 2 }));
    steps(sim, 5);
    expect(p.medkits).toBe(1);
  });

  it('a medkit only heals what is missing and is not wasted at full health', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.medkits = 2;
    sim.setInput('a', input({ seq: 1, heal: true }));
    sim.step();
    expect(p.medkits).toBe(2);
    expect(eventsOf(sim.snapshot(), 'heal').length).toBe(0);

    p.health = p.maxHealth - 10;
    sim.setInput('a', input({ seq: 2, heal: true }));
    sim.step();
    expect(p.health).toBe(p.maxHealth);
    expect(eventsOf(sim.snapshot(), 'heal')[0].amount).toBe(10);
  });

  it('nothing happens without a medkit, and a downed player cannot use one', () => {
    const { sim, state } = quietSim(['a', 'b']);
    const [p] = state.players;
    p.health = 20;
    sim.setInput('a', input({ seq: 1, heal: true }));
    sim.step();
    expect(p.health).toBe(20);
    p.medkits = 1;
    p.status = 'downed';
    p.bleedout = 20;
    sim.setInput('a', input({ seq: 2, heal: true }));
    sim.step();
    expect(p.medkits).toBe(1);
    expect(p.healQueued).toBe(false);
  });
});

describe('ammo', () => {
  it('feeds only the gun it fits', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.guns.carbine = { ammo: 10 };
    p.ammoBag.carbine = 3;
    p.owned = ['pistol', 'carbine'];
    drop(state, 'carbine_ammo', p.x, p.y, boxOf('carbine_ammo'));
    sim.step();
    expect(p.ammoBag).toEqual({ pistol: 12, carbine: 3 + boxOf('carbine_ammo'), shotgun: 0 });
    expect(state.pickups.length).toBe(0);
  });

  it('updates the held gun reserve at once', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    drop(state, 'pistol_ammo', p.x, p.y, 8);
    sim.step();
    expect(p.reserve).toBe(20);
  });

  it('banks ammo for a gun not yet found, ready when it turns up', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    drop(state, 'shells', p.x, p.y, 4);
    sim.step();
    expect(p.ammoBag.shotgun).toBe(4);
    expect(p.owned).toEqual(['pistol']);
    expect(p.reserve).toBe(12);
    drop(state, 'shotgun', p.x, p.y);
    sim.step();
    expect(p.weapon).toBe('shotgun');
    expect(p.reserve).toBe(4);
  });

  it('stays on the ground at a full reserve', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.ammoBag.pistol = WEAPONS.pistol.reserveCap;
    drop(state, 'pistol_ammo', p.x, p.y, 8);
    steps(sim, 3);
    expect(state.pickups.length).toBe(1);
    expect(eventsOf(sim.snapshot(), 'pickup').length).toBe(0);
  });

  it('tops up to the cap and leaves the rest in the box', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.ammoBag.pistol = WEAPONS.pistol.reserveCap - 3;
    drop(state, 'pistol_ammo', p.x, p.y, 8);
    steps(sim, 3);
    expect(p.ammoBag.pistol).toBe(WEAPONS.pistol.reserveCap);
    expect(state.pickups[0].rounds).toBe(5);
    expect(eventsOf(sim.snapshot(), 'pickup').length).toBe(1);
  });
});

describe('guns', () => {
  it('a found gun comes part loaded and is drawn at once', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.reloadLeft = 0.5;
    p.reload = 0.5;
    drop(state, 'shotgun', p.x, p.y);
    sim.step();
    expect(p.owned).toEqual(['pistol', 'shotgun']);
    expect(p.weapon).toBe('shotgun');
    expect(p.ammo).toBe(WEAPONS.shotgun.foundAmmo);
    expect(p.ammo).toBeLessThan(WEAPONS.shotgun.magSize);
    expect(p.reserve).toBe(0);
    expect(p.magSize).toBe(WEAPONS.shotgun.magSize);
    expect(p.reload).toBe(0);
    drop(state, 'carbine', p.x, p.y);
    sim.step();
    expect(p.owned).toEqual(['pistol', 'carbine', 'shotgun']);
  });

  it('a second copy is stripped for rounds, or stays down when the bag is full', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.guns.carbine = { ammo: 30 };
    p.ammoBag.carbine = WEAPONS.carbine.reserveCap;
    p.owned = ['pistol', 'carbine'];
    drop(state, 'carbine', p.x, p.y);
    steps(sim, 2);
    expect(state.pickups.length).toBe(1);
    p.ammoBag.carbine = 5;
    sim.step();
    expect(p.ammoBag.carbine).toBe(5 + WEAPONS.carbine.foundAmmo);
    expect(state.pickups.length).toBe(0);
  });
});

describe('collection', () => {
  it('needs the player within reach and alive', () => {
    const { sim, state } = quietSim(['a', 'b']);
    const [p, other] = state.players;
    p.health = 20;
    other.x = p.x + 200;
    drop(state, 'bandage', p.x + PICKUP_RADIUS + 2, p.y);
    sim.step();
    expect(state.pickups.length).toBe(1);
    p.x += 4;
    p.status = 'downed';
    p.bleedout = 20;
    sim.step();
    expect(state.pickups.length).toBe(1);
  });

  it('world loot never despawns', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    drop(state, 'bandage', p.x + 100, p.y);
    steps(sim, 120 * TICK_RATE);
    expect(state.pickups.length).toBe(1);
  });

  it('a kill drop despawns', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    state.pickups.push({ id: 'k', type: 'bandage', x: p.x + 100, y: p.y, ttl: KILL_DROP_TTL_SEC, rounds: 0 });
    steps(sim, KILL_DROP_TTL_SEC * TICK_RATE - 2);
    expect(state.pickups.length).toBe(1);
    steps(sim, 3);
    expect(state.pickups.length).toBe(0);
  });
});

describe('kill drops', () => {
  function killMany(count: number): PickupState[] {
    const { state } = quietSim();
    const [p] = state.players;
    p.x = state.map.spawn.x;
    for (let i = 0; i < count; i++) {
      const zombie = addZombie(state, 'walker', p.x + 150, p.y);
      damageZombie(state, zombie, 1e6, 0, 'a');
      state.zombies.pop();
    }
    return state.pickups;
  }

  it('are rare, and always small', () => {
    const drops = killMany(2000);
    const share = drops.length / 2000;
    expect(share).toBeGreaterThan(KILL_DROP_CHANCE / 2);
    expect(share).toBeLessThan(KILL_DROP_CHANCE * 2);
    for (const item of drops) {
      expect(['bandage', 'pistol_ammo']).toContain(item.type);
      expect(item.rounds).toBeLessThanOrEqual(KILL_DROP_ROUNDS);
      expect(item.ttl).toBe(KILL_DROP_TTL_SEC);
    }
  });
});

describe('town loot', () => {
  function stocked(seed: number): { state: SimState; inBuilding: Map<BuildingInstance, PickupState[]> } {
    const sim = new GameSimulation({ seed });
    const state = stateOf(sim);
    const inBuilding = new Map<BuildingInstance, PickupState[]>();
    for (const item of state.pickups) {
      const owner = buildingAt(sim.map, item.x, item.y);
      if (!owner) throw new Error(`loot outdoors at ${item.x},${item.y}`);
      inBuilding.set(owner, [...(inBuilding.get(owner) ?? []), item]);
    }
    return { state, inBuilding };
  }

  const itemsIn = (inBuilding: Map<BuildingInstance, PickupState[]>, kind: BuildingKind): PickupState[] =>
    [...inBuilding].filter(([building]) => building.kind === kind).flatMap(([, items]) => items);

  it.each(SEEDS)('seed %i: sits on open floor, never in a solid or a doorway', (seed) => {
    const { state } = stocked(seed);
    expect(state.pickups.length).toBeGreaterThan(30);
    for (const item of state.pickups) {
      expect(isBlockedAt(state.map, item.x, item.y)).toBe(false);
      expect(circleHitsSolid(state.map, item.x, item.y, 6)).toBe(false);
      expect(item.ttl).toBeNull();
    }
    const spots = new Set(state.pickups.map((item) => `${item.x},${item.y}`));
    expect(spots.size).toBe(state.pickups.length);
  });

  it('offers spots beside the furniture in every kind of building', () => {
    const { state } = stocked(1);
    // The sewers hold no loot, so they are left out.
    for (const kind of BUILDING_KINDS.filter((each) => !each.startsWith('sewer_'))) {
      const building = state.map.buildings.find((each) => each.kind === kind) as BuildingInstance;
      expect(lootSpots(state.map, building).length).toBeGreaterThan(3);
    }
  });

  it.each(SEEDS)('seed %i: every item came from its building kind\'s table', (seed) => {
    const { inBuilding } = stocked(seed);
    for (const [building, items] of inBuilding) {
      const rule = LOOT_RULES[building.kind];
      const allowed = [...Object.keys(rule.table), ...(rule.fixed ?? [])];
      const ownLoot = items.filter((item) => !isPartPickup(item.type) && !isKitPickup(item.type));
      for (const item of ownLoot) expect(allowed).toContain(item.type);
      // A town short of ammo tops up with one more box per building at most.
      const topUp = 1;
      expect(ownLoot.length).toBeLessThanOrEqual(rule.items[1] + (rule.fixed?.length ?? 0) + topUp);
    }
  });

  it.each(SEEDS)('seed %i: the police station has the carbine and the gun shop the shotgun', (seed) => {
    const { state, inBuilding } = stocked(seed);
    expect(itemsIn(inBuilding, 'police').filter((item) => item.type === 'carbine').length).toBe(1);
    expect(itemsIn(inBuilding, 'gun_shop').filter((item) => item.type === 'shotgun').length).toBe(1);
    expect(state.pickups.filter((item) => item.type === 'carbine').length).toBe(1);
    expect(state.pickups.filter((item) => item.type === 'shotgun').length).toBe(1);
  });

  it('weighs each place the way the table says, over many towns', () => {
    const tally = new Map<BuildingKind, { heal: number; ammo: number }>();
    for (let seed = 10; seed < 30; seed++) {
      const { inBuilding } = stocked(seed);
      for (const [building, items] of inBuilding) {
        const count = tally.get(building.kind) ?? { heal: 0, ammo: 0 };
        for (const item of items.filter((each) => !isKitPickup(each.type))) {
          const heals = item.type === 'bandage' || item.type === 'medkit';
          if (heals) count.heal += 1;
          else count.ammo += 1;
        }
        tally.set(building.kind, count);
      }
    }
    const of = (kind: BuildingKind) => tally.get(kind) ?? { heal: 0, ammo: 0 };
    expect(of('pharmacy').heal).toBeGreaterThan(of('pharmacy').ammo * 3);
    expect(of('clinic').ammo).toBe(0);
    expect(of('police').heal).toBe(0);
    expect(of('gun_shop').heal).toBe(0);
    expect(of('warehouse').ammo).toBeGreaterThan(of('warehouse').heal);
    expect(of('house').heal).toBeGreaterThan(of('house').ammo);
  });

  it('homes and shops hold only half-empty boxes', () => {
    const { inBuilding } = stocked(11);
    for (const kind of ['house', 'apartment', 'diner', 'grocery'] as const) {
      for (const item of itemsIn(inBuilding, kind)) {
        if (item.type === 'pistol_ammo') expect(item.rounds).toBeLessThan(boxOf('pistol_ammo'));
      }
    }
  });

  it.each(SEEDS)('seed %i: all the ammo on the map adds up to about the planned share of the population', (seed) => {
    const { state } = stocked(seed);
    const share = ammoKillShare([...state.pickups, ...containerLoot(state)]);
    expect(share).toBeGreaterThan(AMMO_POPULATION_SHARE * 0.7);
    expect(share).toBeLessThanOrEqual(AMMO_POPULATION_SHARE * 1.02);
  });

  it('a restart restocks the town', () => {
    const sim = new GameSimulation({ seed: 2 });
    sim.addPlayer('a', 'a');
    const state = stateOf(sim);
    const count = state.pickups.length;
    state.pickups = [];
    sim.restart();
    expect(state.pickups.length).toBeGreaterThan(count / 2);
  });
});

describe('restock', () => {
  it('adds a few items in far-off buildings', () => {
    const { state } = quietSim();
    const [p] = state.players;
    restockLoot(state);
    const items = state.pickups.filter((item) => item.type !== 'carbine' && item.type !== 'shotgun');
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.length).toBeLessThanOrEqual(6);
    for (const item of state.pickups) {
      const owner = buildingAt(state.map, item.x, item.y) as BuildingInstance;
      const { w, h } = BUILDING_DEFS[owner.kind];
      expect(Math.hypot(owner.x + w / 2 - p.x, owner.y + h / 2 - p.y)).toBeGreaterThanOrEqual(RESTOCK_MIN_DISTANCE);
    }
  });

  it('brings back a gun that left with a dead teammate, and does not duplicate one', () => {
    const { state } = quietSim();
    const [p] = state.players;
    p.owned = ['pistol', 'carbine'];
    p.guns.carbine = { ammo: 5 };
    restockLoot(state);
    expect(state.pickups.filter((item) => item.type === 'carbine').length).toBe(0);
    expect(state.pickups.filter((item) => item.type === 'shotgun').length).toBeLessThanOrEqual(1);
  });
});
