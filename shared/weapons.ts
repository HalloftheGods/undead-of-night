import { hasKeepsake, WATCH_RELOAD } from './keepsakes.ts';
import { EVERLASTING_SAVE_CHANCE, SHOCK_TARTS_RATE, sugarOf } from './candy.ts';
import { characterOf } from './characters.ts';
import { DRY_FIRE_INTERVAL_SEC, MUZZLE_OFFSET, TICK_DT, WEAPON_SWITCH_DELAY_SEC } from './constants.ts';
import { effectOf, heldStats, rankOf } from './gun-upgrades.ts';
import { headUnderAim } from './headshots.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { emit, entityId } from './sim-state.ts';
import { makeNoise } from './zombie-senses.ts';

/** Mirrors the held gun into the fields snapshots expose. */
export function syncGun(p: PlayerState): void {
  const gun = p.guns[p.weapon];
  if (!gun) return;
  p.ammo = gun.ammo;
  p.reserve = p.ammoBag[p.weapon];
  p.magSize = heldStats(p).magSize;
}

function cancelReload(p: PlayerState): void {
  p.reloadLeft = 0;
  p.reload = 0;
}

function switchWeapon(sim: SimState, p: PlayerState): void {
  const wanted = p.weaponQueued;
  p.weaponQueued = null;
  const hasNoSwitchToMake = !wanted || wanted === p.weapon || !p.owned.includes(wanted);
  if (hasNoSwitchToMake) return;
  cancelReload(p);
  p.weapon = wanted;
  p.fireCooldown = Math.max(p.fireCooldown, WEAPON_SWITCH_DELAY_SEC);
  syncGun(p);
  emit(sim, { type: 'weapon_switch', playerId: p.id, weapon: wanted, x: p.x, y: p.y });
}

function reloadSeconds(p: PlayerState): number {
  const fizz = sugarOf(p, 'pumpkin_fizz');
  const skulls = sugarOf(p, 'sour_skulls');
  const reloadSugar = Math.max(fizz, skulls);
  return ((heldStats(p).reloadMs / 1000) * characterOf(p.skin).reloadTime) / (1 + reloadSugar) / (hasKeepsake(p, 'old_watch') ? WATCH_RELOAD : 1);
}

function startReload(sim: SimState, p: PlayerState): void {
  const gun = p.guns[p.weapon];
  const magFull = !gun || gun.ammo >= heldStats(p).magSize;
  const cannotReload = magFull || p.ammoBag[p.weapon] === 0 || p.reloadLeft > 0;
  if (cannotReload) return;
  p.reloadLeft = reloadSeconds(p);
  emit(sim, { type: 'reload_start', playerId: p.id, weapon: p.weapon, x: p.x, y: p.y });
}

function advanceReload(sim: SimState, p: PlayerState): void {
  const isNotReloading = p.reloadLeft <= 0;
  if (isNotReloading) return;
  const total = reloadSeconds(p);
  p.reloadLeft -= TICK_DT;
  // A floor above zero keeps "reloading" distinct from "not reloading" on the first tick.
  p.reload = Math.max(0.01, 1 - p.reloadLeft / total);
  const isStillReloading = p.reloadLeft > 1e-9;
  if (isStillReloading) return;

  const gun = p.guns[p.weapon];
  if (gun) {
    const missing = heldStats(p).magSize - gun.ammo;
    const loaded = Math.min(missing, p.ammoBag[p.weapon]);
    gun.ammo += loaded;
    p.ammoBag[p.weapon] -= loaded;
  }
  cancelReload(p);
  syncGun(p);
  emit(sim, { type: 'reload_end', playerId: p.id, weapon: p.weapon, x: p.x, y: p.y });
}

function fire(sim: SimState, p: PlayerState): void {
  const stats = heldStats(p);
  // Fireballs turn every round to flame while they work, whatever the gun was fitted with. A Full-Size Bar's half does not.
  const fiery = sugarOf(p, 'fireballs') >= 1;
  const effect = fiery ? 'incendiary' : effectOf(p.guns[p.weapon]?.fit);
  const carried = effect ? { effect } : {};
  const deadeye = sugarOf(p, 'deadeye_drops') > 0;
  const spreadRad = deadeye ? 0 : stats.spreadRad;
  const extraPellets = sugarOf(p, 'scatter_skittles') > 0 ? 1 : 0;
  const totalPellets = stats.pellets + extraPellets;
  // Pellets scatter past the crosshair, so a spread gun never claims a head.
  const headTarget = totalPellets === 1 ? headUnderAim(sim, p, stats.range) : null;
  const volley = entityId(sim, 'v');
  for (let i = 0; i < totalPellets; i++) {
    const angle = p.angle + (sim.rng() * 2 - 1) * spreadRad;
    // Bullets leave from the body centre so the first sweep covers what is touching the player.
    sim.bullets.push({
      id: entityId(sim, 'b'),
      shooterId: p.id,
      x: p.x,
      y: p.y,
      vx: Math.cos(angle) * stats.bulletSpeed,
      vy: Math.sin(angle) * stats.bulletSpeed,
      damage: stats.damage,
      rangeLeft: stats.range,
      headTarget,
      volley,
      ...carried,
    });
  }
  emit(sim, {
    type: 'shot',
    playerId: p.id,
    weapon: p.weapon,
    x: p.x + Math.cos(p.angle) * MUZZLE_OFFSET,
    y: p.y + Math.sin(p.angle) * MUZZLE_OFFSET,
    angle: p.angle,
    suppressed: rankOf(p.guns[p.weapon]?.fit, 'suppressor') > 0,
    ...carried,
  });
  makeNoise(sim, p.x, p.y, stats.noiseRadius * characterOf(p.skin).noise);
}

function tryFire(sim: SimState, p: PlayerState): void {
  const gun = p.guns[p.weapon];
  const canAct = gun !== undefined && p.reloadLeft <= 0 && p.fireCooldown <= 0;
  if (!canAct) return;

  if (gun.ammo > 0) {
    const savesAmmo = sim.rng() < EVERLASTING_SAVE_CHANCE * sugarOf(p, 'everlasting_chews');
    if (!savesAmmo) gun.ammo -= 1;
    const rateBoost = 1 + SHOCK_TARTS_RATE * sugarOf(p, 'shock_tarts');
    // Carrying the remainder keeps fire rates honest when they do not divide the tick.
    p.fireCooldown += (heldStats(p).fireIntervalMs / 1000) / rateBoost;
    fire(sim, p);
    syncGun(p);
  } else if (p.ammoBag[p.weapon] > 0) {
    startReload(sim, p);
  } else if (p.dryFireCooldown <= 0) {
    p.dryFireCooldown = DRY_FIRE_INTERVAL_SEC;
    emit(sim, { type: 'dry_fire', playerId: p.id, x: p.x, y: p.y });
  }
}

/** One tick of a living player's gun handling. Request latches are consumed here. */
export function updateWeapons(sim: SimState, p: PlayerState): void {
  // The floor carries a shot's remainder and no more, so time spent not firing buys no faster fire.
  p.fireCooldown = Math.max(p.fireCooldown - TICK_DT, -TICK_DT);
  p.dryFireCooldown = Math.max(0, p.dryFireCooldown - TICK_DT);
  const triggerPulled = p.shoot || p.shootQueued;
  p.shootQueued = false;
  const idleTrigger = !triggerPulled && p.fireCooldown < 0;
  if (idleTrigger) p.fireCooldown = 0;

  switchWeapon(sim, p);
  if (p.reloadQueued) startReload(sim, p);
  p.reloadQueued = false;
  advanceReload(sim, p);
  if (triggerPulled) tryFire(sim, p);
}
