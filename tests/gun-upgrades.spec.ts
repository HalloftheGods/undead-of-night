import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../shared/constants.ts';
import { GUN_POWER_CAP, GUN_QUIRKS, GUN_SLOTS, PARTS_PER_TOWN, PART_CARRY_CAP, PART_ORDER, QUIRK_ORDER, UPGRADES } from '../shared/gun-upgrade-data.ts';
import type { GunQuirk, PartId } from '../shared/gun-upgrade-data.ts';
import { fitUpgrade, gunStats, moveUpgrade, slotsUsed } from '../shared/gun-upgrades.ts';
import type { GunFit } from '../shared/gun-upgrades.ts';
import { lootSpots } from '../shared/loot.ts';
import { placeTownParts } from '../shared/part-loot.ts';
import { hurtPlayer } from '../shared/player-health.ts';
import { WEAPON_ORDER } from '../shared/protocol.ts';
import type { PickupType, WeaponId } from '../shared/protocol.ts';
import type { PlayerState, SimState } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { syncGun } from '../shared/weapons.ts';
import { buildingAt } from '../shared/world-query.ts';
import { addRoamer, input, quietSim, SEED, stateOf, steps } from './helpers/sim-harness.ts';

const SOURCE_KINDS = ['gun_shop', 'police', 'garage', 'warehouse'];

function give(p: PlayerState, parts: Partial<Record<PartId, number>>): void {
  Object.assign(p.parts, parts);
}

function arm(p: PlayerState, weapon: WeaponId, ammo: number): void {
  p.guns[weapon] = { ammo };
  p.owned = WEAPON_ORDER.filter((id) => id === weapon || p.owned.includes(id));
}

function drop(state: SimState, type: PickupType, p: PlayerState): void {
  state.pickups.push({ id: `test-${type}`, type, x: p.x, y: p.y, ttl: null, rounds: 0 });
}

/** Every split of a gun's slots over damage and fire rate, the two that add up to its power. */
function powerBuilds(weapon: WeaponId): GunFit[] {
  const builds: GunFit[] = [];
  const quirks: (GunQuirk | null)[] = [null, ...QUIRK_ORDER];
  for (let damage = 0; damage <= UPGRADES.damage.maxRank; damage++) {
    for (let fireRate = 0; fireRate <= UPGRADES.fireRate.maxRank; fireRate++) {
      const fits = damage + fireRate <= GUN_SLOTS[weapon];
      if (fits) builds.push(...quirks.map((quirk) => ({ ranks: { damage, fireRate }, quirk })));
    }
  }
  return builds;
}

describe('the stats a gun fires with', () => {
  it('are stock with nothing done to it', () => {
    expect(gunStats('carbine', undefined)).toBe(WEAPONS.carbine);
  });

  it('take each upgrade from its table row', () => {
    const fit: GunFit = { ranks: { damage: 2, fireRate: 1, magazine: 2, reload: 1 }, quirk: null };
    const stats = gunStats('pistol', fit);
    const stock = WEAPONS.pistol;
    expect(stats.damage).toBeCloseTo(stock.damage * (1 + 2 * UPGRADES.damage.gain));
    expect(stats.fireIntervalMs).toBeCloseTo(stock.fireIntervalMs / (1 + UPGRADES.fireRate.gain));
    expect(stats.magSize).toBe(Math.round(stock.magSize * (1 + 2 * UPGRADES.magazine.gain)));
    expect(stats.reloadMs).toBeCloseTo(stock.reloadMs * (1 - UPGRADES.reload.gain));
  });

  it('are sharply quieter with a suppressor', () => {
    const stats = gunStats('shotgun', { ranks: { suppressor: 1 }, quirk: null });
    expect(stats.noiseRadius).toBeLessThan(WEAPONS.shotgun.noiseRadius * 0.4);
  });

  it('never pass the power cap, whatever the build and quirk', () => {
    for (const weapon of WEAPON_ORDER) {
      const stock = WEAPONS[weapon];
      for (const fit of powerBuilds(weapon)) {
        const stats = gunStats(weapon, fit);
        const power = (stats.damage / stock.damage) * (stock.fireIntervalMs / stats.fireIntervalMs);
        expect(power).toBeLessThanOrEqual(GUN_POWER_CAP + 1e-9);
      }
    }
  });

  it('give every quirk an upside and a downside', () => {
    for (const quirk of QUIRK_ORDER) {
      const stats = gunStats('carbine', { ranks: {}, quirk });
      const stock = WEAPONS.carbine;
      const gains = [stats.damage > stock.damage, stats.fireIntervalMs < stock.fireIntervalMs, stats.magSize > stock.magSize, stats.reloadMs < stock.reloadMs, stats.noiseRadius < stock.noiseRadius];
      const costs = [stats.damage < stock.damage, stats.spreadRad > stock.spreadRad, stats.magSize < stock.magSize, stats.reloadMs > stock.reloadMs, stats.noiseRadius > stock.noiseRadius];
      expect(gains.filter(Boolean), GUN_QUIRKS[quirk].label).toHaveLength(1);
      expect(costs.filter(Boolean), GUN_QUIRKS[quirk].label).toHaveLength(1);
    }
  });
});

describe('fitting an upgrade', () => {
  it('spends the parts it costs', () => {
    const { state } = quietSim();
    const [p] = state.players;
    give(p, { grip: 2, magazine: 1 });
    expect(fitUpgrade(p, 'pistol', 'reload')).toBe(true);
    expect(p.parts).toMatchObject({ grip: 1, magazine: 0 });
    expect(p.guns.pistol?.fit?.ranks.reload).toBe(1);
  });

  it('refuses without the parts, and takes nothing', () => {
    const { state } = quietSim();
    const [p] = state.players;
    give(p, { grip: 1 });
    expect(fitUpgrade(p, 'pistol', 'reload')).toBe(false);
    expect(p.parts.grip).toBe(1);
    expect(p.guns.pistol?.fit).toBeUndefined();
  });

  it('refuses a gun the player does not have', () => {
    const { state } = quietSim();
    const [p] = state.players;
    give(p, { barrel: 1 });
    expect(fitUpgrade(p, 'carbine', 'damage')).toBe(false);
  });

  it('stops at the gun\'s slots', () => {
    const { state } = quietSim();
    const [p] = state.players;
    give(p, { barrel: 3, grip: 3, magazine: 3, suppressor: 1 });
    expect(fitUpgrade(p, 'pistol', 'damage')).toBe(true);
    expect(fitUpgrade(p, 'pistol', 'fireRate')).toBe(true);
    expect(fitUpgrade(p, 'pistol', 'suppressor')).toBe(true);
    expect(slotsUsed(p.guns.pistol?.fit)).toBe(GUN_SLOTS.pistol);
    expect(fitUpgrade(p, 'pistol', 'magazine')).toBe(false);
  });

  it('stops at an upgrade\'s top rank: one suppressor is all a gun takes', () => {
    const { state } = quietSim();
    const [p] = state.players;
    give(p, { suppressor: 2 });
    expect(fitUpgrade(p, 'pistol', 'suppressor')).toBe(true);
    expect(fitUpgrade(p, 'pistol', 'suppressor')).toBe(false);
    expect(p.parts.suppressor).toBe(1);
  });
});

describe('a toolkit', () => {
  function twoGuns() {
    const quiet = quietSim();
    const [p] = quiet.state.players;
    arm(p, 'carbine', 10);
    give(p, { magazine: 1, toolkit: 1 });
    fitUpgrade(p, 'pistol', 'magazine');
    return { ...quiet, p };
  }

  it('moves one rank between guns and is used up', () => {
    const { p } = twoGuns();
    expect(moveUpgrade(p, 'magazine', 'pistol', 'carbine')).toBe(true);
    expect(p.guns.pistol?.fit?.ranks.magazine).toBe(0);
    expect(p.guns.carbine?.fit?.ranks.magazine).toBe(1);
    expect(p.parts.toolkit).toBe(0);
  });

  it('hands back rounds the smaller magazine no longer holds', () => {
    const { p } = twoGuns();
    p.guns.pistol!.ammo = gunStats('pistol', p.guns.pistol?.fit).magSize;
    const bagBefore = p.ammoBag.pistol;
    moveUpgrade(p, 'magazine', 'pistol', 'carbine');
    expect(p.guns.pistol?.ammo).toBe(WEAPONS.pistol.magSize);
    expect(p.ammoBag.pistol - bagBefore).toBe(Math.round(WEAPONS.pistol.magSize * UPGRADES.magazine.gain));
  });

  it('cannot move what is not there, or onto a gun with no room, or without a toolkit', () => {
    const { p } = twoGuns();
    expect(moveUpgrade(p, 'damage', 'pistol', 'carbine')).toBe(false);
    p.guns.carbine!.fit = { ranks: { damage: 3, fireRate: 1 }, quirk: null };
    expect(moveUpgrade(p, 'magazine', 'pistol', 'carbine')).toBe(false);
    expect(moveUpgrade(p, 'magazine', 'pistol', 'pistol')).toBe(false);
    expect(p.parts.toolkit).toBe(1);
    p.guns.carbine!.fit = undefined;
    p.parts.toolkit = 0;
    expect(moveUpgrade(p, 'magazine', 'pistol', 'carbine')).toBe(false);
  });

  it('leaves a quirk where it is', () => {
    const { p } = twoGuns();
    p.guns.pistol!.fit = { ranks: { magazine: 1 }, quirk: 'hot_loads' };
    moveUpgrade(p, 'magazine', 'pistol', 'carbine');
    expect(p.guns.pistol?.fit?.quirk).toBe('hot_loads');
    expect(p.guns.carbine?.fit?.quirk).toBeNull();
  });
});

describe('an upgraded gun in the sim', () => {
  it('hits for its upgraded damage', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.guns.pistol!.fit = { ranks: { damage: 2 }, quirk: null };
    sim.setInput(p.id, input({ seq: 1, shoot: true }));
    steps(sim, 1);
    expect(state.bullets[0].damage).toBeCloseTo(WEAPONS.pistol.damage * (1 + 2 * UPGRADES.damage.gain));
  });

  it('reloads to its larger magazine and reports it', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.guns.pistol!.fit = { ranks: { magazine: 1 }, quirk: null };
    p.ammoBag.pistol = 40;
    syncGun(p);
    const bigger = Math.round(WEAPONS.pistol.magSize * (1 + UPGRADES.magazine.gain));
    expect(p.magSize).toBe(bigger);
    sim.setInput(p.id, input({ seq: 1, reload: true }));
    steps(sim, Math.ceil((WEAPONS.pistol.reloadMs / 1000) * 30) + 2);
    expect(p.guns.pistol?.ammo).toBe(bigger);
  });

  it('with a suppressor is not heard by a zombie a stock shot would wake', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.skin = 1; // Bear: a normal noise radius, unlike the default survivor, Night
    const roamer = addRoamer(state, 'walker', p.x, p.y + WEAPONS.pistol.noiseRadius - 10);
    roamer.senseOffset = 1;
    p.guns.pistol!.fit = { ranks: { suppressor: 1 }, quirk: null };
    sim.setInput(p.id, input({ seq: 1, shoot: true, angle: Math.PI }));
    steps(sim, 1);
    expect(roamer.mode).toBe('wander');
    p.guns.pistol!.fit = undefined;
    p.fireCooldown = 0;
    sim.setInput(p.id, input({ seq: 2, shoot: true, angle: Math.PI }));
    steps(sim, 1);
    expect(roamer.mode).toBe('alert');
  });

  it('is lost with the gun, and so are the parts, when its owner dies and comes back', () => {
    const { sim, state } = quietSim(['a']);
    const [p] = state.players;
    p.guns.pistol!.fit = { ranks: { damage: 1 }, quirk: null };
    give(p, { barrel: 2 });
    sim.addPlayer('b', 'b');
    const [, mate] = state.players;
    p.status = 'dead';
    p.health = 0;
    state.intermissionLeft = 0;
    steps(sim, 2);
    expect(mate.status).toBe('alive');
    expect(p.status).toBe('alive');
    expect(p.guns.pistol?.fit).toBeUndefined();
    expect(p.parts.barrel).toBe(0);
  });
});

describe('parts as loot', () => {
  it('fill the bag up to its cap and then stay on the floor', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.parts.grip = PART_CARRY_CAP - 1;
    drop(state, 'grip', p);
    steps(sim, 1);
    expect(p.parts.grip).toBe(PART_CARRY_CAP);
    expect(state.pickups).toHaveLength(0);
    drop(state, 'grip', p);
    steps(sim, 1);
    expect(p.parts.grip).toBe(PART_CARRY_CAP);
    expect(state.pickups).toHaveLength(1);
  });

  it('are placed in the buildings that keep them, no more than a town holds', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const state = stateOf(new GameSimulation({ seed }));
      const parts = state.pickups.filter((item) => PART_ORDER.includes(item.type as PartId));
      expect(parts.length).toBeGreaterThan(0);
      expect(parts.length).toBeLessThanOrEqual(PARTS_PER_TOWN);
      for (const item of parts) expect(SOURCE_KINDS).toContain(buildingAt(state.map, item.x, item.y)?.kind);
    }
  });

  it('are the same for the same seed', () => {
    const where = (seed: number): string[] =>
      stateOf(new GameSimulation({ seed })).pickups.filter((item) => PART_ORDER.includes(item.type as PartId)).map((item) => `${item.type}@${item.x},${item.y}`);
    expect(where(SEED)).toEqual(where(SEED));
  });

  it('stay out of the way of the run\'s own random numbers', () => {
    const once = stateOf(new GameSimulation({ seed: SEED }));
    const twice = stateOf(new GameSimulation({ seed: SEED }));
    placeTownParts(twice, (building) => lootSpots(twice.map, building));
    expect(twice.rng()).toBe(once.rng());
  });
});

describe('a found gun', () => {
  it('keeps the quirk it was found with', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    state.pickups.push({ id: 'g', type: 'carbine', x: p.x, y: p.y, ttl: null, rounds: 0, quirk: 'deep_well' });
    steps(sim, 1);
    expect(p.guns.carbine?.fit).toEqual({ ranks: {}, quirk: 'deep_well' });
    expect(p.magSize).toBe(Math.round(WEAPONS.carbine.magSize * (GUN_QUIRKS.deep_well.magSize as number)));
  });

  it('is sometimes quirky across a run of towns, and never for the pistol you start with', () => {
    const seeds = Array.from({ length: 20 }, (_, index) => index + 1);
    const guns = seeds.flatMap((seed) => stateOf(new GameSimulation({ seed })).pickups.filter((item) => item.type === 'carbine' || item.type === 'shotgun'));
    const quirky = guns.filter((item) => item.quirk);
    expect(quirky.length).toBeGreaterThan(0);
    expect(quirky.length).toBeLessThan(guns.length);
    const { state } = quietSim();
    expect(state.players[0].guns.pistol?.fit).toBeUndefined();
  });
});

describe('a hit player', () => {
  it('keeps upgrades through being downed and revived', () => {
    const { state, sim } = quietSim(['a', 'b']);
    const [p, mate] = state.players;
    p.guns.pistol!.fit = { ranks: { damage: 1 }, quirk: null };
    mate.x = p.x + 4;
    mate.y = p.y;
    hurtPlayer(state, p, 500);
    expect(p.status).toBe('downed');
    steps(sim, 30 * 6);
    expect(p.status).toBe('alive');
    expect(p.guns.pistol?.fit?.ranks.damage).toBe(1);
  });
});
