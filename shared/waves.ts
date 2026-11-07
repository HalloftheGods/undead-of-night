import {
  HORDE_MAX_SEC,
  HORDE_SPEED_SCALE,
  INTERMISSION_SEC,
  SPAWN_MAX_DISTANCE,
  SPAWN_MIN_DISTANCE,
  TICK_DT,
  ZOMBIES,
  ZOMBIE_CAP,
} from './constants.ts';
import { BASELINE_DIFFICULTY, difficultyDef, lullSeconds, scaleHordeSize } from './difficulty.ts';
import type { DifficultyId } from './difficulty.ts';
import { openExit } from './level-exit.ts';
import { LEVELS, levelDef } from './levels.ts';
import type { LevelDef } from './levels.ts';
import { restockLoot } from './loot.ts';
import { returnDeadPlayers } from './player-health.ts';
import type { ZombieType } from './protocol.ts';
import { pick, randRange, shuffle } from './rng.ts';
import type { PlayerState, SimState, ZombieState } from './sim-state.ts';
import { emit, entityId, hiddenFromEveryone, standingPlayers } from './sim-state.ts';
import { buildingAt, circleHitsSolid, groundOf, isBlockedAt } from './world-query.ts';
import { townHeight } from './storeys.ts';
import { SIGHT_CHECK_TICKS, backToRoaming } from './zombie-senses.ts';
import { eventOf } from './night-events.ts';
import { liveBoss, maybeSummonBoss } from './bosses.ts';

const SPAWN_TRIES_PER_TICK = 12;

/** The whole horde in spawn order. Exported so balance is testable without running one. */
export function waveRoster(
  wave: number,
  rng: () => number,
  level: LevelDef = LEVELS[0],
  difficultyId: DifficultyId = BASELINE_DIFFICULTY,
  /** A night event's horde scale (`shared/night-events.ts`). */
  eventScale = 1,
): ZombieType[] {
  const { difficulty, mix } = level;
  const total = scaleHordeSize(Math.round((5 + wave * 3) * difficulty * eventScale), difficultyId);
  const brutes = (wave % 5 === 0 ? wave / 5 : 0) + Math.round(total * mix.brute);
  const bloaters = (wave >= 3 ? Math.min(8, 1 + Math.floor((wave - 3) / 2)) : 0) + Math.round(total * mix.bloater);
  const runnerShare = (wave >= 2 ? Math.min(0.4, 0.14 + (wave - 2) * 0.04) : 0) + mix.runner;
  const runners = Math.floor(total * runnerShare);
  const walkers = Math.max(0, total - runners - bloaters - brutes);
  const roster: ZombieType[] = [
    ...Array<ZombieType>(walkers).fill('walker'),
    ...Array<ZombieType>(runners).fill('runner'),
    ...Array<ZombieType>(bloaters).fill('bloater'),
  ];
  shuffle(rng, roster);
  // Brutes arrive after the horde has started to bite, not first.
  roster.splice(Math.floor(roster.length / 2), 0, ...Array<ZombieType>(brutes).fill('brute'));
  return roster;
}

const healthScale = (wave: number): number => 1 + 0.07 * Math.max(0, wave - 1);
const speedScale = (wave: number): number => 1 + Math.min(0.3, 0.02 * Math.max(0, wave - 1));
const spawnInterval = (wave: number): number => Math.max(0.28, 1.15 - 0.07 * wave);

/** A new zombie knows nothing: it starts roaming wherever it stands. */
export function spawnZombie(sim: SimState, type: ZombieType, x: number, y: number): void {
  const stats = ZOMBIES[type];
  const health = Math.round(stats.health * healthScale(sim.wave));
  sim.zombies.push({
    id: entityId(sim, 'z'),
    type,
    x,
    y,
    angle: 0,
    health,
    maxHealth: health,
    attacking: false,
    radius: stats.radius,
    // Slight per-body variation stops a crowd marching in lockstep.
    speed: stats.speed * speedScale(sim.wave) * randRange(sim.rng, 0.92, 1.08) * difficultyDef(sim.difficulty).zombieSpeed,
    damage: stats.damage * difficultyDef(sim.difficulty).zombieDamage,
    points: stats.points,
    reach: stats.reach,
    windupSec: stats.windupSec,
    cooldownSec: stats.cooldownSec,
    windupLeft: 0,
    recoveryLeft: 0,
    cooldownLeft: 0,
    knockX: 0,
    knockY: 0,
    staggerImmuneLeft: 0,
    sidestepLeft: 0,
    sidestepSide: 1,
    mode: 'wander',
    horde: false,
    interestLeft: 0,
    wanderLeft: 0,
    wanderX: 0,
    wanderY: 0,
    home: buildingAt(sim.map, x, y)?.id ?? null,
    senseOffset: sim.nextEntity % SIGHT_CHECK_TICKS,
  });
}

const xy = (p: { readonly x: number; readonly y: number }): [number, number] => [p.x, p.y];

function spawnPoint(sim: SimState, anchors: readonly PlayerState[], radius: number): { x: number; y: number } | null {
  const { map } = sim;
  for (let attempt = 0; attempt < SPAWN_TRIES_PER_TICK; attempt++) {
    // Someone upstairs or in a cellar draws the horde to their house, in town.
    const anchor = groundOf(map, ...xy(pick(sim.rng, anchors)));
    const angle = sim.rng() * Math.PI * 2;
    const distance = randRange(sim.rng, SPAWN_MIN_DISTANCE, SPAWN_MAX_DISTANCE);
    const x = anchor.x + Math.cos(angle) * distance;
    const y = anchor.y + Math.sin(angle) * distance;
    const onMap = x > radius && y > radius && x < map.width - radius && y < townHeight(map) - radius;
    const isBadSpawnSpot = !onMap || isBlockedAt(map, x, y) || circleHitsSolid(map, x, y, radius + 1);
    if (isBadSpawnSpot) continue;
    const outdoors = buildingAt(map, x, y) === null;
    const outOfSight = anchors.every((p) => {
      const ground = groundOf(map, p.x, p.y);
      return Math.hypot(ground.x - x, ground.y - y) >= SPAWN_MIN_DISTANCE;
    });
    const isHiddenOutdoors = outdoors && outOfSight;
    if (isHiddenOutdoors) return { x, y };
  }
  return null;
}

function trickleSpawns(sim: SimState): void {
  sim.spawnTimer -= TICK_DT;
  const anchors = standingPlayers(sim);
  while (sim.spawnTimer <= 0 && sim.spawnQueue.length > 0 && sim.zombies.length < ZOMBIE_CAP && anchors.length > 0) {
    const type = sim.spawnQueue[sim.spawnQueue.length - 1];
    const point = spawnPoint(sim, anchors, ZOMBIES[type].radius);
    if (!point) break;
    sim.spawnQueue.pop();
    spawnZombie(sim, type, point.x, point.y);
    const zombie = sim.zombies[sim.zombies.length - 1];
    zombie.horde = true;
    zombie.mode = 'hunt';
    zombie.speed *= HORDE_SPEED_SCALE;
    sim.spawnTimer += spawnInterval(sim.wave);
  }
  const isTimerNegative = sim.spawnTimer < 0;
  if (isTimerNegative) sim.spawnTimer = 0;
}

function startHorde(sim: SimState): void {
  sim.wave += 1;
  sim.phase = 'wave';
  sim.intermissionLeft = 0;
  sim.hordeLeft = HORDE_MAX_SEC;
  // Only what the cap has room for is called: anything more would be counted and never come.
  const room = Math.max(0, ZOMBIE_CAP - sim.zombies.length);
  sim.spawnQueue = waveRoster(sim.wave, sim.rng, levelDef(sim.level), sim.difficulty, eventOf(sim)?.horde ?? 1).slice(0, room).reverse();
  sim.spawnTimer = 0;
  returnDeadPlayers(sim);
  const boss = maybeSummonBoss(sim);
  emit(sim, { type: 'wave_start', wave: sim.wave, hostiles: hordeHostiles(sim) });
  // After the horde's own banner, so the boss's is the one left up.
  if (boss?.boss) emit(sim, { type: 'boss_arrive', boss: boss.boss, x: boss.x, y: boss.y });
}

/**
 * Bodies past the town's level drift off where nobody can see, newest first, so survivors of
 * uncleared hordes never fill the cap and the guards placed in the buildings stay put.
 */
function thinRoamers(sim: SimState): void {
  let excess = sim.zombies.filter((z) => !z.horde).length - sim.populationTarget;
  const leaving = new Set<ZombieState>();
  for (let i = sim.zombies.length - 1; i >= 0 && excess > 0; i--) {
    const z = sim.zombies[i];
    // Past the corner of the view is enough: a crowd trailing an evasive player must count too.
    const staysPut = z.horde || !hiddenFromEveryone(sim, z, SPAWN_MIN_DISTANCE);
    if (staysPut) continue;
    leaving.add(z);
    excess -= 1;
  }
  sim.zombies = sim.zombies.filter((z) => !leaving.has(z));
}

/** The hunt is off: whatever is left of the horde goes back to roaming the town. */
function endHorde(sim: SimState): void {
  sim.spawnQueue = [];
  for (const z of sim.zombies) {
    if (!z.horde) continue;
    z.horde = false;
    z.speed /= HORDE_SPEED_SCALE;
    backToRoaming(sim, z);
  }
  thinRoamers(sim);
  emit(sim, { type: 'wave_clear', wave: sim.wave });
  const levelSurvived = sim.wave >= levelDef(sim.level).hordes;
  if (levelSurvived) openExit(sim);
  restockLoot(sim);
  sim.phase = 'intermission';
  const lull = lullSeconds(INTERMISSION_SEC, sim.difficulty);
  sim.intermissionLeft = lull;
  emit(sim, { type: 'wave_intermission', wave: sim.wave + 1, seconds: lull });
}

/** Hordes seen off in this town. One still hunting does not count. */
export const hordesSurvivedHere = (sim: SimState): number => (sim.phase === 'wave' ? sim.wave - 1 : sim.wave);

/** Horde zombies alive or still to come. */
export function hordeHostiles(sim: SimState): number {
  const isNotWave = sim.phase !== 'wave';
  if (isNotWave) return 0;
  return sim.spawnQueue.length + sim.zombies.filter((z) => z.horde && z.health > 0).length;
}

export function updateWaves(sim: SimState): void {
  const isIntermission = sim.phase === 'intermission';
  if (isIntermission) {
    sim.intermissionLeft -= TICK_DT;
    const isIntermissionOver = sim.intermissionLeft <= 1e-9;
    if (isIntermissionOver) startHorde(sim);
    return;
  }
  const isNotWave = sim.phase !== 'wave';
  if (isNotWave) return;
  sim.hordeLeft -= TICK_DT;
  trickleSpawns(sim);
  // A boss keeps its horde going until it falls: the clock alone does not send it home.
  const timedOut = sim.hordeLeft <= 0 && liveBoss(sim) === null;
  const hordeOver = hordeHostiles(sim) === 0 || timedOut;
  if (hordeOver) endHorde(sim);
}
