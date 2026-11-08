import { TICK_DT } from './constants.ts';
import { UPGRADE_ORDER } from './gun-upgrade-data.ts';
import type { GunUpgrade } from './gun-upgrade-data.ts';
import { fitUpgrade, moveUpgrade } from './gun-upgrades.ts';
import { WEAPON_ORDER } from './protocol.ts';
import type { EntityId, WeaponId } from './protocol.ts';
import { EFFECT_ORDER } from './round-effect-data.ts';
import type { GunEffect } from './round-effect-data.ts';
import { fitEffect, moveEffect } from './round-effects.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { alivePlayers } from './sim-state.ts';
import { syncGun } from './weapons.ts';

/** How a run stops at the bench: not at all, until everyone is ready, or until a timer too. */
export type WorkbenchMode = 'off' | 'hold' | 'timed';

/** Time a co-op room gets, so one person gone quiet cannot hold everybody. */
export const BENCH_TIMER_SEC = 45;

export interface BenchState {
  /** Seconds to go, Infinity when only being ready ends it. */
  left: number;
}

export type BenchAction =
  | { readonly kind: 'fit'; readonly weapon: WeaponId; readonly upgrade: GunUpgrade }
  | { readonly kind: 'move'; readonly upgrade: GunUpgrade; readonly from: WeaponId; readonly to: WeaponId }
  /** Uses a kit, and replaces whatever effect the gun had. */
  | { readonly kind: 'fit_effect'; readonly weapon: WeaponId; readonly effect: GunEffect }
  | { readonly kind: 'move_effect'; readonly from: WeaponId; readonly to: WeaponId }
  | { readonly kind: 'ready'; readonly ready: boolean };

/** The bench as clients see it. Absent from a snapshot means the run is out in a town. */
export interface BenchView {
  /** The town just left. */
  readonly level: number;
  readonly secondsLeft: number | null;
  /** Everyone on their feet, the only people the bench waits for. */
  readonly riders: readonly EntityId[];
  readonly ready: readonly EntityId[];
}

const isWeapon = (value: unknown): value is WeaponId => WEAPON_ORDER.includes(value as WeaponId);
const isUpgrade = (value: unknown): value is GunUpgrade => UPGRADE_ORDER.includes(value as GunUpgrade);
const isEffect = (value: unknown): value is GunEffect => EFFECT_ORDER.includes(value as GunEffect);

/** True only for exactly a bench action, whatever came off the wire. */
export function isBenchAction(value: unknown): value is BenchAction {
  const action = value as Partial<Record<keyof BenchAction | 'weapon' | 'upgrade' | 'effect' | 'from' | 'to' | 'ready', unknown>> | null;
  const isFit = action?.kind === 'fit' && isWeapon(action.weapon) && isUpgrade(action.upgrade);
  const isMove = action?.kind === 'move' && isUpgrade(action.upgrade) && isWeapon(action.from) && isWeapon(action.to);
  const isFitEffect = action?.kind === 'fit_effect' && isWeapon(action.weapon) && isEffect(action.effect);
  const isMoveEffect = action?.kind === 'move_effect' && isWeapon(action.from) && isWeapon(action.to);
  const isReady = action?.kind === 'ready' && typeof action.ready === 'boolean';
  return isFit || isMove || isFitEffect || isMoveEffect || isReady;
}

/** Stops the run at the bench. False when this run has none, so the van drives straight on. */
export function openBench(sim: SimState): boolean {
  const hasBench = sim.workbench !== 'off';
  if (!hasBench) return false;
  sim.bench = { left: sim.workbench === 'timed' ? BENCH_TIMER_SEC : Infinity };
  sim.bullets = [];
  for (const p of [...sim.players, ...sim.departed.values()]) {
    p.benchReady = false;
    p.reload = 0;
    p.reloadLeft = 0;
  }
  return true;
}

/** Nobody moves or fires here, but input is still acknowledged so prediction has nothing left to replay. */
function holdPlayer(p: PlayerState): void {
  p.lastInputSeq = p.queuedSeq;
  p.moving = false;
  p.reloadQueued = false;
  p.weaponQueued = null;
  p.meleeQueued = false;
  p.healQueued = false;
  p.throwQueued = false;
  p.spinnerQueued = false;
  p.flareQueued = false;
  p.shootQueued = false;
}

/** One held tick. True once the van should go: everyone standing is ready, or the time is up. */
export function updateBench(sim: SimState): boolean {
  const bench = sim.bench;
  if (!bench) return false;
  sim.players.forEach(holdPlayer);
  bench.left -= TICK_DT;
  const timeUp = bench.left <= 1e-9;
  return timeUp || alivePlayers(sim).every((p) => p.benchReady);
}

/** The left behind cannot use it: they lose their kit in the next town either way. In a home room the bench is a station, for whoever has it open. */
export function benchCommand(sim: SimState, p: PlayerState, action: BenchAction): void {
  const atBench = sim.bench !== null || p.home?.station === 'bench';
  const usable = atBench && p.status === 'alive';
  if (!usable) return;
  if (action.kind === 'ready') p.benchReady = action.ready;
  else if (action.kind === 'fit') fitUpgrade(p, action.weapon, action.upgrade);
  else if (action.kind === 'fit_effect') fitEffect(p, action.weapon, action.effect);
  else if (action.kind === 'move_effect') moveEffect(p, action.from, action.to);
  else moveUpgrade(p, action.upgrade, action.from, action.to);
  syncGun(p);
}

/** The field for a snapshot. Game over ends the bench, whatever state it was left in. */
export function benchField(sim: SimState): { bench?: BenchView } {
  const bench = sim.bench;
  const showing = bench !== null && sim.phase !== 'gameover';
  if (!showing) return {};
  const riders = alivePlayers(sim);
  return {
    bench: {
      level: sim.level,
      secondsLeft: Number.isFinite(bench.left) ? Math.max(0, Math.ceil(bench.left)) : null,
      riders: riders.map((p) => p.id),
      ready: riders.filter((p) => p.benchReady).map((p) => p.id),
    },
  };
}
