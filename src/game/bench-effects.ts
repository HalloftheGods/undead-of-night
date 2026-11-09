import { effectOf } from '../../shared/gun-upgrades.ts';
import type { GunFit, PlayerGear } from '../../shared/gun-upgrades.ts';
import type { WeaponId } from '../../shared/protocol.ts';
import { EFFECT_ORDER, GUN_EFFECTS } from '../../shared/round-effect-data.ts';
import type { GunEffect, KitCounts } from '../../shared/round-effect-data.ts';
import { canFitEffect, canMoveEffect, noKits } from '../../shared/round-effects.ts';

/** One kit the player could fit to a gun. */
export interface EffectOption {
  readonly effect: GunEffect;
  readonly label: string;
  readonly note: string;
  readonly count: number;
  readonly fittable: boolean;
  /** The label of what fitting this would throw away, or null when the gun has nothing on it. */
  readonly replaces: string | null;
}

/** A gun's effect as the bench shows it: what is on it, what could go on, and where it could be carried. */
export interface EffectView {
  readonly current: { readonly effect: GunEffect; readonly label: string; readonly note: string } | null;
  readonly options: readonly EffectOption[];
  /** Guns a toolkit could carry the effect to. */
  readonly moves: readonly WeaponId[];
}

export const kitsOf = (gear: PlayerGear): Readonly<KitCounts> => gear.kits ?? noKits();

/** The effect on a fit, named for the HUD and the bench. Null when the gun fires plain rounds. */
export function effectLabel(fit: GunFit | undefined): string | null {
  const effect = effectOf(fit);
  return effect === null ? null : GUN_EFFECTS[effect].label;
}

export function effectView(weapon: WeaponId, owned: readonly WeaponId[], gear: PlayerGear): EffectView {
  const fit = gear.fits[weapon];
  const held = effectOf(fit);
  const kits = kitsOf(gear);
  const here = { weapon, fit };
  const options = EFFECT_ORDER.map((effect) => ({
    effect,
    label: GUN_EFFECTS[effect].label,
    note: GUN_EFFECTS[effect].note,
    count: kits[effect],
    fittable: canFitEffect(kits, fit, effect),
    replaces: held === null ? null : GUN_EFFECTS[held].label,
  }));
  const moves = owned.filter((target) => canMoveEffect(gear.parts, here, { weapon: target, fit: gear.fits[target] }));
  const current = held === null ? null : { effect: held, label: GUN_EFFECTS[held].label, note: GUN_EFFECTS[held].note };
  return { current, options, moves };
}

/** What the confirm step says before a kit goes over an effect already on the gun. */
export function replaceQuestion(option: EffectOption): string {
  return `Replace ${option.replaces ?? 'nothing'} with ${option.label}? The old rounds are lost.`;
}

/** True when pressing a kit should ask first. */
export const needsConfirm = (option: EffectOption): boolean => option.replaces !== null;

/** The line under the bench while a round kit is pointed at. */
export function effectHint(option: EffectOption): string {
  const carried = option.count > 0 ? '' : ' None carried.';
  const swap = option.fittable && option.replaces !== null ? ` Replaces ${option.replaces}.` : '';
  return `${option.label}: ${option.note}.${carried}${swap}`;
}
