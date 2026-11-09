import { STAT_SLOTS } from '../../shared/character-stats.ts';
import { WEAPONS } from '../../shared/constants.ts';
import type { WeaponStats } from '../../shared/constants.ts';
import { GUN_SLOTS, UPGRADE_ORDER, UPGRADES } from '../../shared/gun-upgrade-data.ts';
import type { GunUpgrade, PartId } from '../../shared/gun-upgrade-data.ts';
import { canFit, canMove, gunStats, noParts, rankOf } from '../../shared/gun-upgrades.ts';
import type { GunFit, PlayerGear } from '../../shared/gun-upgrades.ts';
import { levelDef, townName } from '../../shared/levels.ts';
import { WEAPON_ORDER } from '../../shared/protocol.ts';
import type { PlayerEntity, SnapshotPacket, WeaponId } from '../../shared/protocol.ts';

export const NO_GEAR: PlayerGear = { parts: noParts(), fits: {} };

/** The bench as this player sees it. */
export interface BenchHud {
  /** The town just left, and the one the van is headed for. */
  readonly level: number;
  readonly nextTitle: string;
  readonly secondsLeft: number | null;
  readonly youReady: boolean;
  /** People on their feet not ready yet, you included. */
  readonly waitingFor: number;
  /** The bunker's bench, which is closed rather than readied. */
  readonly walkUp: boolean;
}

/** The walk-up bench in the bunker: nobody is waiting on anyone and no van is leaving. */
function walkUpBench(local: PlayerEntity): BenchHud | null {
  const atBench = local.home?.station === 'bench';
  if (!atBench) return null;
  return { level: 0, nextTitle: '', secondsLeft: null, youReady: false, waitingFor: 0, walkUp: true };
}

export function benchHud(snapshot: SnapshotPacket, local: PlayerEntity): BenchHud | null {
  const bench = snapshot.bench;
  if (!bench) return walkUpBench(local);
  return {
    level: bench.level,
    nextTitle: levelDef(bench.level + 1).town,
    secondsLeft: bench.secondsLeft,
    youReady: bench.ready.includes(local.id),
    waitingFor: bench.riders.length - bench.ready.length,
    walkUp: false,
  };
}

export function benchNote(bench: BenchHud): string {
  if (bench.walkUp) return 'Work on the gear in your hands.';
  return `${townName(bench.level)} is behind you. Next: ${bench.nextTitle}`;
}

/** The parts one rank of an upgrade takes, in the table's order. */
export const upgradeParts = (upgrade: GunUpgrade): PartId[] => Object.keys(UPGRADES[upgrade].cost) as PartId[];

export interface BenchRow {
  readonly upgrade: GunUpgrade;
  readonly label: string;
  readonly rank: number;
  readonly maxRank: number;
  readonly cost: readonly PartId[];
  readonly fittable: boolean;
  /** Guns a toolkit could carry a rank of this to. */
  readonly moves: readonly WeaponId[];
}

/** One row per upgrade for a gun, with what can be done about it right now. */
export function benchRows(weapon: WeaponId, owned: readonly WeaponId[], gear: PlayerGear): BenchRow[] {
  const here = { weapon, fit: gear.fits[weapon] };
  return UPGRADE_ORDER.map((upgrade) => {
    const { label, maxRank } = UPGRADES[upgrade];
    const accepts = (target: WeaponId): boolean => canMove(gear.parts, upgrade, here, { weapon: target, fit: gear.fits[target] });
    return {
      upgrade,
      label,
      maxRank,
      rank: rankOf(here.fit, upgrade),
      cost: upgradeParts(upgrade),
      fittable: canFit(gear.parts, weapon, here.fit, upgrade),
      moves: owned.filter(accepts),
    };
  });
}

/** What the gun fires like with this work on it. */
export function statLines(weapon: WeaponId, fit: GunFit | undefined): readonly string[] {
  const stats = gunStats(weapon, fit);
  const pellets = stats.pellets > 1 ? ` x${stats.pellets}` : '';
  return [
    `Damage ${Math.round(stats.damage)}${pellets}`,
    `${(1000 / stats.fireIntervalMs).toFixed(1)} shots/s`,
    `Magazine ${stats.magSize}`,
    `Reload ${(stats.reloadMs / 1000).toFixed(1)}s`,
    `Noise ${Math.round((stats.noiseRadius / WEAPONS[weapon].noiseRadius) * 100)}%`,
  ];
}

// The bench's big column: a gun's stats as slotted bars, like a survivor's, and the slots its work fills.

/** Cells in a gun's bars, as many as a survivor's. */
export const BAR_SLOTS = STAT_SLOTS;

export interface GunBar {
  readonly label: string;
  readonly value: string;
  /** Lit cells out of BAR_SLOTS, against the best stock gun at it. */
  readonly filled: number;
  /** Of those, the cells the work and quirk on this gun added to its stock bar. */
  readonly gained: number;
  /** True when the number is off the stock gun's. */
  readonly changed: boolean;
}

interface BarDef {
  readonly label: string;
  readonly of: (gun: WeaponStats) => number;
  readonly text: (gun: WeaponStats, stock: WeaponStats) => string;
}

const perShot = (gun: WeaponStats): number => gun.damage * gun.pellets;
const perSecond = (gun: WeaponStats): number => 1000 / gun.fireIntervalMs;

/** More is better on every bar, so reload is read as its speed and noise as how quiet the gun is. */
const BARS: readonly BarDef[] = [
  { label: 'Damage', of: perShot, text: (gun) => (gun.pellets > 1 ? `${Math.round(gun.damage)}x${gun.pellets}` : `${Math.round(gun.damage)}`) },
  { label: 'Fire rate', of: perSecond, text: (gun) => `${perSecond(gun).toFixed(1)}/s` },
  { label: 'Magazine', of: (gun) => gun.magSize, text: (gun) => `${gun.magSize}` },
  { label: 'Reload', of: (gun) => 1000 / gun.reloadMs, text: (gun) => `${(gun.reloadMs / 1000).toFixed(1)}s` },
  { label: 'Quiet', of: (gun) => 1 / gun.noiseRadius, text: (gun, stock) => `${Math.round((gun.noiseRadius / stock.noiseRadius) * 100)}% noise` },
];

const cellsOf = (share: number): number => Math.min(BAR_SLOTS, Math.max(1, Math.round(share * BAR_SLOTS)));

/** One bar per stat for a gun as it fires with this fit, each scaled against the best stock gun at it. */
export function gunBars(weapon: WeaponId, fit: GunFit | undefined): readonly GunBar[] {
  const stock = WEAPONS[weapon];
  const now = gunStats(weapon, fit);
  return BARS.map(({ label, of, text }) => {
    const best = Math.max(...WEAPON_ORDER.map((each) => of(WEAPONS[each])));
    const filled = cellsOf(of(now) / best);
    const value = text(now, stock);
    return { label, value, filled, gained: Math.max(0, filled - cellsOf(of(stock) / best)), changed: value !== text(stock, stock) };
  });
}

/** A gun's slots in order: the upgrade each fitted rank took, then null for each one still empty. */
export function gunSlots(weapon: WeaponId, fit: GunFit | undefined): readonly (GunUpgrade | null)[] {
  const taken = UPGRADE_ORDER.flatMap((upgrade) => Array.from({ length: rankOf(fit, upgrade) }, () => upgrade));
  return Array.from({ length: GUN_SLOTS[weapon] }, (_, at) => taken[at] ?? null);
}
