import { DOG_TAG_REVIVE, hasKeepsake, ROSARY_BLEEDOUT } from './keepsakes.ts';
import { caramelCatch, JAWBREAKER_GUARD, sugarOf } from './candy.ts';
import {
  BLEEDOUT_ALONE_RATE,
  BLEEDOUT_SEC,
  MEDKIT_HEAL,
  PLAYER_RADIUS,
  REVIVE_RANGE,
  REVIVE_SEC,
  START_SPARE_ROUNDS,
  TICK_DT,
  WEAPONS,
} from './constants.ts';
import { noParts } from './gun-upgrades.ts';
import { noKits } from './round-effects.ts';
import { START_BOTTLES } from './bottles.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { alivePlayers, emit, openGroundNear } from './sim-state.ts';
import { dropCarried } from './treasure.ts';

/** Everything carried goes; what is left is a loaded pistol and these spare rounds. */
function resetKit(p: PlayerState, spareRounds: number): void {
  const pistol = WEAPONS.pistol;
  p.guns = { pistol: { ammo: pistol.magSize } };
  p.ammoBag = { pistol: spareRounds, carbine: 0, shotgun: 0 };
  p.medkits = 0;
  p.knife = false;
  p.bottles = START_BOTTLES;
  p.fuel = 0;
  p.flares = 0;
  p.candy = [];
  p.sugar = [];
  p.parts = noParts();
  p.kits = noKits();
  p.owned = ['pistol'];
  p.weapon = 'pistol';
  p.ammo = pistol.magSize;
  p.magSize = pistol.magSize;
  p.reserve = spareRounds;
  p.reload = 0;
  p.reloadLeft = 0;
  p.fireCooldown = 0;
  p.meleeCooldown = 0;
}

export function giveStartingLoadout(p: PlayerState): void {
  resetKit(p, START_SPARE_ROUNDS);
}

/** What anyone arriving partway through a run gets: half health and one magazine. */
export function giveReturnKit(p: PlayerState): void {
  p.health = Math.ceil(p.maxHealth / 2);
  resetKit(p, 0);
}

/** Uses a carried medkit on request. A wasted press keeps the kit. */
export function useMedkit(sim: SimState, p: PlayerState): void {
  const wanted = p.healQueued;
  p.healQueued = false;
  const usable = wanted && p.medkits > 0 && p.health < p.maxHealth;
  if (!usable) return;
  const amount = Math.min(MEDKIT_HEAL, p.maxHealth - p.health);
  p.medkits -= 1;
  p.health += amount;
  emit(sim, { type: 'heal', playerId: p.id, x: p.x, y: p.y, amount });
}

function kill(sim: SimState, p: PlayerState): void {
  p.status = 'dead';
  p.health = 0;
  p.moving = false;
  p.bleedout = 0;
  p.revive = 0;
  p.reload = 0;
  p.reloadLeft = 0;
  dropCarried(sim, p);
  emit(sim, { type: 'player_dead', playerId: p.id, x: p.x, y: p.y });
}

function down(sim: SimState, p: PlayerState): void {
  p.status = 'downed';
  p.health = 0;
  p.moving = false;
  p.bleedout = BLEEDOUT_SEC * (hasKeepsake(p, 'rosary') ? ROSARY_BLEEDOUT : 1);
  p.revive = 0;
  p.reload = 0;
  p.reloadLeft = 0;
  // Down is down: nothing sweet carries on working.
  p.sugar = [];
  emit(sim, { type: 'player_downed', playerId: p.id, x: p.x, y: p.y });
}

export function hurtPlayer(sim: SimState, p: PlayerState, damage: number): void {
  const isNotAlive = p.status !== 'alive';
  if (isNotAlive) return;
  const guarded = damage * (1 - JAWBREAKER_GUARD * sugarOf(p, 'jawbreaker'));
  p.health = Math.max(0, p.health - guarded);
  emit(sim, { type: 'player_hurt', playerId: p.id, x: p.x, y: p.y, damage: guarded });
  const isStanding = p.health > 0;
  if (isStanding) return;
  const caughtByCaramel = caramelCatch(sim, p);
  if (caughtByCaramel) return;
  const teammateCanRevive = sim.players.some((other) => other !== p && other.status === 'alive');
  if (teammateCanRevive) down(sim, p);
  else kill(sim, p);
}

/** Bleedout pauses while a teammate works on the player. */
export function updateDownedPlayers(sim: SimState): void {
  const rescuers = alivePlayers(sim);
  for (const p of sim.players) {
    const isNotDowned = p.status !== 'downed';
    if (isNotDowned) continue;
    const near = rescuers.filter((r) => Math.hypot(r.x - p.x, r.y - p.y) <= REVIVE_RANGE);
    const beingRevived = near.length > 0;
    const tagged = near.some((r) => hasKeepsake(r, 'dog_tags'));
    if (beingRevived) {
      p.revive = Math.min(1, p.revive + (TICK_DT * (tagged ? DOG_TAG_REVIVE : 1)) / REVIVE_SEC);
      const isRevived = p.revive >= 1;
      if (isRevived) {
        p.status = 'alive';
        p.health = Math.ceil(p.maxHealth / 2);
        p.bleedout = 0;
        p.revive = 0;
        emit(sim, { type: 'player_revived', playerId: p.id, x: p.x, y: p.y });
      }
      continue;
    }
    p.revive = 0;
    p.bleedout -= rescuers.length > 0 ? TICK_DT : TICK_DT * BLEEDOUT_ALONE_RATE;
    const hasBledOut = p.bleedout <= 0;
    if (hasBledOut) kill(sim, p);
  }
}

/** Dead teammates rejoin at the start of each horde with half health and one magazine. */
export function returnDeadPlayers(sim: SimState): void {
  const home = alivePlayers(sim)[0] ?? sim.map.spawn;
  const putBack = (p: PlayerState): void => {
    const spot = openGroundNear(sim, home.x, home.y, 16, 40, PLAYER_RADIUS + 1);
    p.x = spot.x;
    p.y = spot.y;
    p.status = 'alive';
    giveReturnKit(p);
  };
  for (const p of sim.players) {
    const isNotDead = p.status !== 'dead';
    if (isNotDead) continue;
    putBack(p);
    emit(sim, { type: 'player_revived', playerId: p.id, x: p.x, y: p.y });
  }
  // Refreshing across the horde's start costs nobody their return.
  const deadAndAway = [...sim.departed.values()].filter((p) => p.status === 'dead');
  deadAndAway.forEach(putBack);
}
