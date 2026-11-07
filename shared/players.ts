import { characterOf } from './characters.ts';
import {
  PLAYER_RADIUS,
  PLAYER_SPEED,
  SNEAK_SPEED_SCALE,
  SPRINT_NOISE_INTERVAL_SEC,
  SPRINT_NOISE_RADIUS,
  SPRINT_SPEED_SCALE,
  TICK_DT,
} from './constants.ts';
import { stopSearch, updateSearch } from './container-search.ts';
import { effectiveStance, updateStamina } from './stamina.ts';
import { updateMelee } from './melee.ts';
import { stepMovement } from './movement.ts';
import { useMedkit } from './player-health.ts';
import { updateThrow } from './bottles.ts';
import { updateThrowables } from './throwables.ts';
import { candySpeed, sugarOf, updateCandy } from './candy.ts';
import { takeKeepsake } from './keepsakes.ts';
import { isBunkerMap } from './home-protocol.ts';
import { gunsFree } from './overrun.ts';
import type { ClientInputPacket, Stance } from './protocol.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { updateStations } from './stations.ts';
import { updateWeapons } from './weapons.ts';
import { buildingAt } from './world-query.ts';
import { leaveFootprint } from './snow-tracks.ts';
import { groundEffect } from './ground.ts';
import { groundSpeedScale } from './town-rules.ts';
import { makeNoise } from './zombie-senses.ts';

const FULL_TURN = Math.PI * 2;

const STANCE_SPEED: Record<Stance, number> = { walk: 1, sneak: SNEAK_SPEED_SCALE, sprint: SPRINT_SPEED_SCALE };

/** Shared with the client, whose prediction has to walk at the speed the sim does. */
export function playerSpeed(skin: number, stance: Stance = 'walk'): number {
  return PLAYER_SPEED * characterOf(skin).moveSpeed * STANCE_SPEED[stance];
}

/** Sneak wins over sprint, so holding both is the quiet choice. */
export function stanceOf(input: Pick<ClientInputPacket, 'sneak' | 'sprint'>): Stance {
  const sneaking = input.sneak === true;
  const sprinting = input.sprint === true;
  if (sneaking) return 'sneak';
  return sprinting ? 'sprint' : 'walk';
}

/** A sprinter's feet are heard every so often; anyone else moves silently. */
function footsteps(sim: SimState, p: PlayerState): void {
  const loud = p.moving && p.stance === 'sprint';
  if (!loud) {
    p.stepNoiseLeft = 0;
    return;
  }
  p.stepNoiseLeft -= TICK_DT;
  const stepDue = p.stepNoiseLeft <= 0;
  if (!stepDue) return;
  p.stepNoiseLeft = SPRINT_NOISE_INTERVAL_SEC;
  const hush = 1 - sugarOf(p, 'ghost_gum');
  makeNoise(sim, p.x, p.y, SPRINT_NOISE_RADIUS * characterOf(p.skin).noise * groundEffect(sim.map, p.x, p.y).noise * hush);
}

/** Stores the newest input. One-shot requests latch until a tick consumes them. */
export function receiveInput(p: PlayerState, input: ClientInputPacket): void {
  const validSeq = Number.isFinite(input.seq);
  const isStaleInput = validSeq && input.seq < p.queuedSeq;
  if (isStaleInput) return;
  if (validSeq) p.queuedSeq = input.seq;

  p.up = input.up === true;
  p.down = input.down === true;
  p.left = input.left === true;
  p.right = input.right === true;
  p.shoot = input.shoot === true;
  if (p.shoot) p.shootQueued = true;
  // Wrapped so a finite but absurd value cannot overflow when snapshots round it.
  if (Number.isFinite(input.angle)) p.angle = input.angle % FULL_TURN;
  const { aimX, aimY } = input;
  const aimed = Number.isFinite(aimX) && Number.isFinite(aimY);
  if (aimed) p.aim = { x: aimX as number, y: aimY as number };
  p.touchAim = input.touch === true;
  const wantsReload = input.reload === true;
  if (wantsReload) p.reloadQueued = true;
  const wantsMelee = input.melee === true;
  if (wantsMelee) p.meleeQueued = true;
  const wantsHeal = input.heal === true;
  if (wantsHeal) p.healQueued = true;
  p.throwQueued ||= input.throw === true;
  p.molotovQueued ||= input.molotov === true;
  p.flareQueued ||= input.flare === true;
  p.eatQueued ||= input.eat === true;
  if (input.keepsake) p.keepsakeQueued = input.keepsake;
  p.searchHeld = input.search === true;
  p.stanceWanted = stanceOf(input);
  if (input.weapon) p.weaponQueued = input.weapon;
}

/** A key down or a station open is someone still at the keyboard. Looking around is not. */
function noteActivity(sim: SimState, p: PlayerState): void {
  const { home } = p;
  if (!home) return;
  const keyDown = p.up || p.down || p.left || p.right || p.shoot || p.searchHeld;
  const active = keyDown || home.station !== null;
  if (active) home.lastActiveTick = sim.tick;
}

/** Nothing is thrown, swung or fired at home but against an overrun, so a press spends nothing and makes no sound. */
function holdFire(p: PlayerState): void {
  p.shoot = false;
  p.shootQueued = false;
  p.meleeQueued = false;
  p.throwQueued = false;
  p.molotovQueued = false;
  p.flareQueued = false;
}

/** Applies the stored input exactly once, so speed never depends on packet rate. */
export function updatePlayer(sim: SimState, p: PlayerState): void {
  p.lastInputSeq = p.queuedSeq;
  noteActivity(sim, p);
  const isNotAlive = p.status !== 'alive';
  if (isNotAlive) {
    p.moving = false;
    p.reloadQueued = false;
    p.weaponQueued = null;
    p.meleeQueued = false;
    p.healQueued = false;
    p.shootQueued = false;
    p.throwQueued = false;
    p.molotovQueued = false;
    p.flareQueued = false;
    stopSearch(p);
    return;
  }
  const dirX = Number(p.right) - Number(p.left);
  const dirY = Number(p.down) - Number(p.up);
  p.moving = dirX !== 0 || dirY !== 0;
  p.stance = effectiveStance(p.stanceWanted, p.winded);
  if (p.moving) {
    const speed = playerSpeed(p.skin, p.stance) * candySpeed(p) * groundSpeedScale(sim.level, sim.map, p.x, p.y);
    const moved = stepMovement(sim.map, p.x, p.y, dirX, dirY, speed, TICK_DT, PLAYER_RADIUS);
    p.x = moved.x;
    p.y = moved.y;
  }
  updateStamina(p);
  footsteps(sim, p);
  p.indoors = buildingAt(sim.map, p.x, p.y)?.id ?? null;
  leaveFootprint(sim, p);
  const holdingFire = isBunkerMap(sim.map) && !gunsFree(sim);
  if (holdingFire) holdFire(p);
  updateWeapons(sim, p);
  updateMelee(sim, p);
  useMedkit(sim, p);
  updateThrow(sim, p);
  updateThrowables(sim, p);
  updateCandy(sim, p);
  const pick = p.keepsakeQueued;
  p.keepsakeQueued = null;
  if (pick) takeKeepsake(sim, p, pick);
  updateSearch(sim, p);
  updateStations(sim, p);
}
