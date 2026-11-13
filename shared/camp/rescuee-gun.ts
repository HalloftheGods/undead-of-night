// A gun lent to a person you are escorting: it leaves your hands when you give it and is back in them when you bank.
// They shoot with the merchants' penalties, hold fire until you shoot or something is hunting, and never run dry.

import { MUZZLE_OFFSET, PLAYER_RADIUS, TICK_DT, WEAPONS } from '../constants.ts';
import { DAMAGE_SCALE, EXTRA_SPREAD_RAD, FIRE_INTERVAL_SCALE, SIGHT_RANGE } from '../merchant-fight.ts';
import { loadoutOf, applyLoadout } from '../loadout.ts';
import type { Loadout } from '../home-protocol.ts';
import type { WeaponId } from '../protocol.ts';
import type { PlayerState, SimState, ZombieState } from '../sim-state.ts';
import { emit, entityId } from '../sim-state.ts';
import { makeNoise } from '../zombie-senses.ts';
import { segmentHitsCover } from '../world-query.ts';
import type { GunState } from '../sim-state.ts';
import type { RescueeState } from './rescuee.ts';

/** A zombie this near anyone, hunting, is reason enough to open fire. */
const HUNT_ALARM_PX = 260;

/** A lent gun and whose it is. */
export interface LentGun {
  readonly from: string;
  readonly weapon: WeaponId;
  readonly fit: GunState['fit'];
  ammo: number;
  fireCooldown: number;
  reloadLeft: number;
}

/** Whether this player could spare the gun in their hands: they keep at least one other. */
export const canSpareGun = (p: PlayerState): boolean => p.owned.length > 1 && Boolean(p.guns[p.weapon]);

/** Takes the held gun out of the player's hands and puts it in the person's. Its loaded rounds stay in the player's bag. */
export function lendGun(r: RescueeState, p: PlayerState): void {
  const weapon = p.weapon;
  const gear = loadoutOf(p);
  const fit = gear.guns[weapon]?.fit;
  const { [weapon]: _gone, ...kept } = gear.guns;
  applyLoadout(p, { ...gear, guns: kept });
  r.lent = { from: p.id, weapon, fit, ammo: WEAPONS[weapon].magSize, fireCooldown: 0, reloadLeft: 0 };
}

/** What a player gets back at the van: each gun lent to someone still with the party goes into their gear. */
export function withLentBack(gear: Loadout, rescuees: readonly RescueeState[], playerId: string): Loadout {
  const back = rescuees.flatMap((r) => (r.lent && r.lent.from === playerId ? [r.lent] : []));
  const guns = { ...gear.guns };
  for (const lent of back) guns[lent.weapon] = lent.fit ? { fit: lent.fit } : {};
  return { ...gear, guns };
}

const anyoneFiring = (sim: SimState): boolean => sim.players.some((p) => p.status === 'alive' && p.shoot);

const huntedNear = (sim: SimState): boolean =>
  sim.zombies.some((z) => z.health > 0 && z.mode === 'hunt' && sim.players.some((p) => p.status === 'alive' && Math.hypot(z.x - p.x, z.y - p.y) <= HUNT_ALARM_PX));

function targetOf(sim: SimState, r: RescueeState): ZombieState | null {
  let best: ZombieState | null = null;
  let bestGap = SIGHT_RANGE * SIGHT_RANGE;
  for (const z of sim.zombies) {
    const gap = (z.x - r.x) ** 2 + (z.y - r.y) ** 2;
    if (z.health > 0 && gap < bestGap) {
      best = z;
      bestGap = gap;
    }
  }
  return best && segmentHitsCover(sim.map, r.x, r.y, best.x, best.y) === null ? best : null;
}

function fire(sim: SimState, r: RescueeState, gun: LentGun): void {
  const stats = WEAPONS[gun.weapon];
  const volley = entityId(sim, 'v');
  for (let i = 0; i < stats.pellets; i++) {
    const angle = r.angle + (r.rng() * 2 - 1) * (stats.spreadRad + EXTRA_SPREAD_RAD);
    sim.bullets.push({ id: entityId(sim, 'b'), shooterId: r.id, x: r.x, y: r.y, vx: Math.cos(angle) * stats.bulletSpeed, vy: Math.sin(angle) * stats.bulletSpeed, damage: stats.damage * DAMAGE_SCALE, rangeLeft: stats.range, headTarget: null, volley });
  }
  emit(sim, { type: 'shot', playerId: r.id, weapon: gun.weapon, x: r.x + Math.cos(r.angle) * MUZZLE_OFFSET, y: r.y + Math.sin(r.angle) * MUZZLE_OFFSET, angle: r.angle });
  makeNoise(sim, r.x, r.y, stats.noiseRadius);
  gun.ammo -= 1;
  gun.fireCooldown = (stats.fireIntervalMs / 1000) * FIRE_INTERVAL_SCALE;
  if (gun.ammo <= 0) gun.reloadLeft = stats.reloadMs / 1000;
}

/** One tick of their shooting: nothing without a gun, nothing while their leader is sneaking, else the nearest zombie in sight. */
export function shootIfArmed(sim: SimState, r: RescueeState): void {
  const gun = r.lent;
  if (!gun) return;
  gun.fireCooldown = Math.max(0, gun.fireCooldown - TICK_DT);
  if (gun.reloadLeft > 0) {
    gun.reloadLeft = Math.max(0, gun.reloadLeft - TICK_DT);
    if (gun.reloadLeft === 0) gun.ammo = WEAPONS[gun.weapon].magSize;
    return;
  }
  const mayShoot = anyoneFiring(sim) || huntedNear(sim);
  const target = mayShoot ? targetOf(sim, r) : null;
  if (!target) return;
  r.angle = Math.atan2(target.y - r.y, target.x - r.x);
  const inRange = Math.hypot(target.x - r.x, target.y - r.y) - target.radius - PLAYER_RADIUS <= WEAPONS[gun.weapon].range;
  if (gun.fireCooldown === 0 && inRange) fire(sim, r, gun);
}
