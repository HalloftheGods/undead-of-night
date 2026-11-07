// Boss nights: on a few towns the last horde brings something worse with it. A boss is a zombie of an
// existing kind grown huge, with far more health and a trick of its own, and the horde does not end
// while it stands. It is placed on a generator of its own, so the sim's rolls before it arrives never move.

import { TICK_DT, ZOMBIE_CAP } from './constants.ts';
import { isBunkerMap } from './home-protocol.ts';
import { levelDef } from './levels.ts';
import { PART_ORDER } from './gun-upgrade-data.ts';
import { spawnPickup } from './pickups.ts';
import type { BossId, ZombieType } from './protocol.ts';
import { createRng, pick } from './rng.ts';
import type { Rng } from './rng.ts';
import type { SimState, ZombieState } from './sim-state.ts';
import { alivePlayers, emit } from './sim-state.ts';
import { LARGE_JEWEL_SILVER } from './treasure.ts';
import { spawnZombie } from './waves.ts';
import { buildingAt, circleHitsSolid, groundOf } from './world-query.ts';
import { townHeight } from './storeys.ts';
import { makeNoise } from './zombie-senses.ts';

export type { BossId } from './protocol.ts';

export interface BossDef {
  readonly id: BossId;
  readonly name: string;
  /** What the level card and the arrival banner say about it. */
  readonly blurb: string;
  readonly base: ZombieType;
  /** How much bigger it is drawn and how much wider it hits, against its base. */
  readonly scale: number;
  readonly health: number;
  readonly damage: number;
  /** Against its base's speed. */
  readonly speed: number;
  readonly points: number;
  /** Seconds between uses of its trick. */
  readonly everySec: number;
}

export const BOSSES: Readonly<Record<BossId, BossDef>> = {
  howler: {
    id: 'howler', name: 'The Howler', blurb: 'Its scream calls the whole town, and runners answer.',
    base: 'screamer', scale: 2, health: 1400, damage: 18, speed: 0.95, points: 1500, everySec: 7,
  },
  mother: {
    id: 'mother', name: 'Mother', blurb: 'Swollen and slow, and every few seconds she gives birth.',
    base: 'bloater', scale: 2.2, health: 2400, damage: 24, speed: 0.8, points: 2500, everySec: 9,
  },
  butcher: {
    id: 'butcher', name: 'The Butcher', blurb: 'A brute twice over. When it sees you, it charges.',
    base: 'brute', scale: 1.8, health: 4200, damage: 45, speed: 0.9, points: 4000, everySec: 6,
  },
};

/** The towns with a boss, by level. */
export const BOSS_LEVELS: Readonly<Partial<Record<number, BossId>>> = { 3: 'howler', 6: 'mother', 9: 'butcher' };

/** The Howler's scream reaches this far, and brings this many runners. */
export const HOWL_RADIUS = 700;
export const HOWL_RUNNERS = 2;
/** Mother births this many walkers at a time. */
export const BROOD_SIZE = 3;
/** The Butcher charges at anyone this close, this much faster, for this long. */
export const CHARGE_RANGE = 260;
export const CHARGE_SPEED = 2.6;
export const CHARGE_SEC = 1.2;
/** It comes out of the dark a fair way off. */
const BOSS_SPAWN_MIN = 420;
const BOSS_SPAWN_MAX = 700;
const BOSS_SALT = 0x424f5353;

export interface BossState {
  readonly id: BossId;
  /** Seconds to its next trick. */
  trickLeft: number;
  /** Seconds of charge left, the Butcher only. */
  chargeLeft: number;
  /** Its walking speed when not charging. */
  readonly baseSpeed: number;
}

export function bossFor(sim: Pick<SimState, 'map' | 'level'>): BossDef | null {
  const id = isBunkerMap(sim.map) ? undefined : BOSS_LEVELS[sim.level];
  return id ? BOSSES[id] : null;
}

/** The boss in the town, alive, or null. */
export function liveBoss(sim: SimState): ZombieState | null {
  return sim.zombies.find((z) => z.boss !== undefined && z.health > 0) ?? null;
}

function bossRng(sim: SimState): Rng {
  return createRng((sim.map.seed ^ BOSS_SALT ^ Math.imul(sim.wave + 1, 0x85ebca6b)) >>> 0);
}

function bossSpot(sim: SimState, rng: Rng, radius: number): { x: number; y: number } | null {
  const anchors = alivePlayers(sim);
  const hasNoAnchors = anchors.length === 0;
  if (hasNoAnchors) return null;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const picked = pick(rng, anchors);
    const anchor = groundOf(sim.map, picked.x, picked.y);
    const angle = rng() * Math.PI * 2;
    const distance = BOSS_SPAWN_MIN + rng() * (BOSS_SPAWN_MAX - BOSS_SPAWN_MIN);
    const x = anchor.x + Math.cos(angle) * distance;
    const y = anchor.y + Math.sin(angle) * distance;
    const onMap = x > radius && y > radius && x < sim.map.width - radius && y < townHeight(sim.map) - radius;
    const open = onMap && buildingAt(sim.map, x, y) === null && !circleHitsSolid(sim.map, x, y, radius + 1);
    if (open) return { x, y };
  }
  return null;
}

/** Called as a horde starts: the town's last horde on a boss night brings the boss. Returns it, for the caller to announce. */
export function maybeSummonBoss(sim: SimState): ZombieState | null {
  const boss = bossFor(sim);
  const lastHorde = sim.wave === levelDef(sim.level).hordes;
  if (!boss) return null;
  const due = lastHorde && liveBoss(sim) === null;
  if (!due) return null;
  const spot = bossSpot(sim, bossRng(sim), 12 * boss.scale);
  if (!spot) return null;
  spawnZombie(sim, boss.base, spot.x, spot.y);
  const z = sim.zombies[sim.zombies.length - 1];
  z.boss = boss.id;
  z.radius *= boss.scale;
  z.reach *= boss.scale;
  z.health = boss.health;
  z.maxHealth = boss.health;
  z.damage = boss.damage;
  z.speed *= boss.speed;
  z.points = boss.points;
  z.horde = true;
  z.mode = 'hunt';
  z.bossState = { id: boss.id, trickLeft: boss.everySec, chargeLeft: 0, baseSpeed: z.speed };
  return z;
}

/** Spawns horde zombies of a kind around a spot, as far as the cap allows. */
function brood(sim: SimState, type: ZombieType, x: number, y: number, count: number, spread: number): void {
  for (let i = 0; i < count && sim.zombies.length < ZOMBIE_CAP; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const bx = x + Math.cos(angle) * spread;
    const by = y + Math.sin(angle) * spread;
    const isSpotBlocked = circleHitsSolid(sim.map, bx, by, 8);
    if (isSpotBlocked) continue;
    spawnZombie(sim, type, bx, by);
    const child = sim.zombies[sim.zombies.length - 1];
    child.horde = true;
    child.mode = 'hunt';
  }
}

function nearestSurvivor(sim: SimState, z: ZombieState): number {
  const players = alivePlayers(sim);
  return players.length === 0 ? Infinity : Math.min(...players.map((p) => Math.hypot(p.x - z.x, p.y - z.y)));
}

function useTrick(sim: SimState, z: ZombieState, boss: BossDef): boolean {
  const isHowler = boss.id === 'howler';
  if (isHowler) {
    makeNoise(sim, z.x, z.y, HOWL_RADIUS);
    brood(sim, 'runner', z.x, z.y, HOWL_RUNNERS, z.radius + 14);
    return true;
  }
  const isMother = boss.id === 'mother';
  if (isMother) {
    brood(sim, 'walker', z.x, z.y, BROOD_SIZE, z.radius + 12);
    return true;
  }
  const close = nearestSurvivor(sim, z) <= CHARGE_RANGE;
  const state = z.bossState;
  if (!state) return false;
  if (close) {
    state.chargeLeft = CHARGE_SEC;
    z.speed = state.baseSpeed * CHARGE_SPEED;
  }
  return close;
}

/** Once a tick: every boss counts down to its trick, and a charge runs out. */
export function updateBosses(sim: SimState): void {
  for (const z of sim.zombies) {
    const state = z.bossState;
    if (!state) continue;
    const fallen = z.health <= 0;
    if (fallen) continue;
    const boss = BOSSES[state.id];
    const isCharging = state.chargeLeft > 0;
    if (isCharging) {
      state.chargeLeft -= TICK_DT;
      const isChargeSpent = state.chargeLeft <= 1e-9;
      if (isChargeSpent) z.speed = state.baseSpeed;
    }
    state.trickLeft -= TICK_DT;
    const isTrickCoolingDown = state.trickLeft > 1e-9;
    if (isTrickCoolingDown) continue;
    const used = useTrick(sim, z, boss);
    // A Butcher with nobody close tries again shortly rather than waiting out a whole turn.
    state.trickLeft = used ? boss.everySec : 0.5;
    if (used) emit(sim, { type: 'boss_trick', boss: boss.id, x: z.x, y: z.y });
  }
}

/** A boss down leaves a medkit and a prize: a large jewel on a Campaign trip, a gun part otherwise. */
export function bossDown(sim: SimState, z: ZombieState): void {
  const id = z.boss;
  if (!id) return;
  const rng = createRng((sim.map.seed ^ BOSS_SALT ^ 0x7f4a7c15) >>> 0);
  spawnPickup(sim, 'medkit', z.x - 10, z.y);
  if (sim.homeRun) spawnPickup(sim, 'jewel_large', z.x + 10, z.y, LARGE_JEWEL_SILVER);
  else spawnPickup(sim, pick(rng, PART_ORDER.filter((part) => part !== 'toolkit')), z.x + 10, z.y);
  emit(sim, { type: 'boss_down', boss: id, x: z.x, y: z.y });
}
