import type { Recipe } from './voice-kit.ts';
import * as W from './sfx-weapons.ts';
import * as Z from './sfx-zombies.ts';
import * as P from './sfx-player.ts';
import * as U from './sfx-ui.ts';
import * as FX from './sfx-effects.ts';
import * as ST from './sfx-steps.ts';

export interface SfxDef {
  readonly play: Recipe;
  /** Seconds until the last voice is silent. */
  readonly length: number;
  /** Trim so every recipe peaks near the same level. */
  readonly gain: number;
  /** Minimum seconds between non-local plays. */
  readonly cooldown: number;
  /** Most simultaneous voices of this sound. */
  readonly voices: number;
  /** Random pitch spread, +/- fraction. */
  readonly vary: number;
}

type Spec = Partial<Omit<SfxDef, 'play' | 'length'>>;
const def = (play: Recipe, length: number, s: Spec = {}): SfxDef =>
  ({ play, length, gain: 1, cooldown: 0.03, voices: 6, vary: 0.05, ...s });

export const SFX = {
  pistol: def(W.pistol, 0.45, { gain: 0.8, voices: 6, cooldown: 0.04 }),
  carbine: def(W.carbine, 0.5, { gain: 0.8, voices: 8, cooldown: 0.03 }),
  shotgun: def(W.shotgun, 0.9, { gain: 0.6, voices: 4, cooldown: 0.08 }),
  dry_click: def(W.dryClick, 0.12, { gain: 1.5, voices: 2, cooldown: 0.1, vary: 0.03 }),
  mag_out: def(W.magOut, 0.25, { gain: 3, voices: 3, cooldown: 0.1 }),
  mag_in: def(W.magIn, 0.3, { gain: 0.6, voices: 3, cooldown: 0.1 }),
  pump: def(W.pump, 0.4, { gain: 1.2, voices: 3, cooldown: 0.1 }),
  slide_drop: def(W.slideDrop, 0.12, { gain: 1.6, voices: 3, cooldown: 0.08 }),
  bolt_rack: def(W.boltRack, 0.25, { gain: 1.6, voices: 3, cooldown: 0.1 }),
  shell_load: def(W.shellLoad, 0.15, { gain: 1.5, voices: 3, cooldown: 0.08 }),
  weapon_switch: def(W.weaponSwitch, 0.25, { gain: 2.2, voices: 3, cooldown: 0.1 }),
  impact: def(W.impact, 0.3, { gain: 1.5, voices: 8, cooldown: 0.025, vary: 0.12 }),
  flesh_hit: def(Z.fleshHit, 0.3, { gain: 1.2, voices: 8, cooldown: 0.03, vary: 0.12 }),
  headshot: def(Z.headshot, 0.3, { gain: 1.3, voices: 4, cooldown: 0.05, vary: 0.08 }),
  claw: def(Z.claw, 0.3, { gain: 0.8, voices: 5, cooldown: 0.08, vary: 0.1 }),
  die_walker: def(Z.dieWalker, 1.0, { gain: 1.6, voices: 4, cooldown: 0.08, vary: 0.1 }),
  die_runner: def(Z.dieRunner, 0.7, { gain: 1.8, voices: 4, cooldown: 0.08, vary: 0.1 }),
  die_bloater: def(Z.dieBloater, 1.4, { gain: 1.4, voices: 3, cooldown: 0.15, vary: 0.08 }),
  die_brute: def(Z.dieBrute, 1.6, { gain: 1, voices: 2, cooldown: 0.3, vary: 0.06 }),
  groan_walker: def(Z.groanWalker, 1.0, { gain: 2, voices: 3, cooldown: 0.6, vary: 0.2 }),
  shriek_runner: def(Z.shriekRunner, 0.7, { gain: 3, voices: 2, cooldown: 1.5, vary: 0.12 }),
  gurgle_bloater: def(Z.gurgleBloater, 1.3, { gain: 0.9, voices: 2, cooldown: 1.5, vary: 0.15 }),
  boss_fall: def(Z.bossFall, 1.6, { gain: 1.3, voices: 1, cooldown: 1, vary: 0.03 }),
  roar_brute: def(Z.roarBrute, 1.4, { gain: 1, voices: 1, cooldown: 3, vary: 0.08 }),
  bloater_burst: def(Z.bloaterBurst, 0.9, { gain: 0.75, voices: 3, cooldown: 0.15 }),
  distant_groan: def(Z.distantGroan, 1.9, { gain: 4, voices: 1, cooldown: 5, vary: 0.2 }),
  distant_crash: def(Z.distantCrash, 0.8, { gain: 0.8, voices: 1, cooldown: 5, vary: 0.2 }),
  player_hurt: def(P.playerHurt, 0.3, { gain: 2.5, voices: 3, cooldown: 0.15, vary: 0.06 }),
  player_downed: def(P.playerDowned, 1.1, { gain: 1.4, voices: 2, cooldown: 0.3 }),
  revive: def(P.revive, 0.8, { gain: 1.5, voices: 2, cooldown: 0.3, vary: 0.02 }),
  heartbeat: def(P.heartbeat, 0.4, { gain: 0.85, voices: 2, cooldown: 0.2, vary: 0.03 }),
  pickup_medkit: def(P.pickupMedkit, 0.8, { gain: 1.4, voices: 2, cooldown: 0.1, vary: 0.02 }),
  pickup_ammo: def(P.pickupAmmo, 0.3, { gain: 2, voices: 2, cooldown: 0.1, vary: 0.04 }),
  pickup_bandage: def(P.pickupBandage, 0.4, { gain: 2, voices: 2, cooldown: 0.1, vary: 0.04 }),
  pickup_pistol_ammo: def(P.pickupPistolAmmo, 0.4, { gain: 1.8, voices: 2, cooldown: 0.1, vary: 0.04 }),
  pickup_carbine_ammo: def(P.pickupCarbineAmmo, 0.5, { gain: 1.8, voices: 2, cooldown: 0.1, vary: 0.04 }),
  pickup_shells: def(P.pickupShells, 0.5, { gain: 1.8, voices: 2, cooldown: 0.1, vary: 0.04 }),
  melee_swing: def(P.meleeSwing, 0.2, { gain: 2, voices: 3, cooldown: 0.2, vary: 0.1 }),
  melee_thud: def(P.meleeThud, 0.35, { gain: 1.6, voices: 3, cooldown: 0.2, vary: 0.1 }),
  heal: def(P.heal, 0.8, { gain: 1.6, voices: 2, cooldown: 0.3, vary: 0.02 }),
  alert_walker: def(Z.alertWalker, 0.7, { gain: 2, voices: 3, cooldown: 0.4, vary: 0.2 }),
  alert_runner: def(Z.alertRunner, 0.6, { gain: 2.5, voices: 2, cooldown: 0.6, vary: 0.12 }),
  alert_bloater: def(Z.alertBloater, 0.8, { gain: 1, voices: 2, cooldown: 0.8, vary: 0.15 }),
  alert_brute: def(Z.alertBrute, 1.0, { gain: 1, voices: 1, cooldown: 1.5, vary: 0.08 }),
  scream: def(Z.scream, 1.3, { gain: 2.2, voices: 2, cooldown: 1, vary: 0.06 }),
  sniff: def(Z.sniff, 0.8, { gain: 2, voices: 2, cooldown: 0.6, vary: 0.12 }),
  pickup_weapon: def(P.pickupWeapon, 0.6, { gain: 1.5, voices: 2, cooldown: 0.1, vary: 0.02 }),
  container_open: def(P.containerOpen, 0.25, { gain: 1.8, voices: 2, cooldown: 0.1, vary: 0.08 }),
  pickup_radio: def(P.pickupRadio, 0.7, { gain: 1.6, voices: 1, cooldown: 1, vary: 0 }),
  pickup_jewel: def(P.pickupJewel, 0.6, { gain: 2, voices: 2, cooldown: 0.1, vary: 0.03 }),
  pickup_jewel_large: def(P.pickupJewelLarge, 0.95, { gain: 2, voices: 2, cooldown: 0.15, vary: 0.02 }),
  ignite: def(FX.ignite, 0.6, { gain: 1.2, voices: 4, cooldown: 0.08, vary: 0.08 }),
  corrode: def(FX.corrode, 0.4, { gain: 1.2, voices: 4, cooldown: 0.08, vary: 0.08 }),
  pierce: def(FX.pierce, 0.3, { gain: 1.2, voices: 4, cooldown: 0.05, vary: 0.08 }),
  tranq_dart: def(FX.tranq, 0.5, { gain: 1.2, voices: 3, cooldown: 0.1, vary: 0.06 }),
  glass_smash: def(FX.glassSmash, 0.45, { gain: 1.6, voices: 3, cooldown: 0.1, vary: 0.1 }),
  car_alarm: def(FX.carAlarm, 2.1, { gain: 1.2, voices: 1, cooldown: 2, vary: 0 }),
  clatter: def(P.clatter, 0.55, { gain: 1.6, voices: 2, cooldown: 0.2, vary: 0.08 }),
  wave_start: def(P.waveStart, 5.0, { gain: 1.1, voices: 1, cooldown: 2, vary: 0 }),
  wave_clear: def(P.waveClear, 2.0, { gain: 2, voices: 1, cooldown: 2, vary: 0 }),
  game_over: def(P.gameOver, 4.1, { gain: 0.95, voices: 1, cooldown: 4, vary: 0 }),
  // Footsteps: short, dry and quiet. No cooldown to speak of, since several players step at once.
  step_hard: def(ST.stepHard, 0.12, { gain: 0.5, voices: 4, cooldown: 0.015, vary: 0.15 }),
  step_soft: def(ST.stepSoft, 0.14, { gain: 0.5, voices: 4, cooldown: 0.015, vary: 0.15 }),
  step_water: def(ST.stepWater, 0.14, { gain: 0.45, voices: 4, cooldown: 0.015, vary: 0.15 }),
  step_snow: def(ST.stepSnow, 0.14, { gain: 0.5, voices: 4, cooldown: 0.015, vary: 0.15 }),
  step_sludge: def(ST.stepSludge, 0.14, { gain: 0.45, voices: 4, cooldown: 0.015, vary: 0.15 }),
  step_ash: def(ST.stepAsh, 0.13, { gain: 0.5, voices: 4, cooldown: 0.015, vary: 0.15 }),
  // Heavy enough to hear a brute coming round a corner, still under its roar.
  step_stomp: def(ST.stomp, 0.22, { gain: 1.1, voices: 4, cooldown: 0.05, vary: 0.1 }),
  ui_click: def(U.uiClick, 0.08, { gain: 1.2, voices: 3, cooldown: 0.02, vary: 0.02 }),
  ui_hover: def(U.uiHover, 0.06, { gain: 2, voices: 2, cooldown: 0.04, vary: 0.02 }),
  ui_start: def(U.uiStart, 0.6, { gain: 1.4, voices: 1, cooldown: 0.3, vary: 0 }),
  ui_pause: def(U.uiPause, 0.3, { gain: 1.2, voices: 1, cooldown: 0.1, vary: 0 }),
  ui_resume: def(U.uiResume, 0.3, { gain: 1.2, voices: 1, cooldown: 0.1, vary: 0 }),
  van_depart: def(U.vanDepart, 2.0, { gain: 1.2, voices: 1, cooldown: 0.5, vary: 0.02 }),
  van_arrive: def(U.vanArrive, 1.7, { gain: 1.2, voices: 1, cooldown: 0.5, vary: 0.02 }),
  van_door: def(U.vanDoor, 0.45, { gain: 1.4, voices: 1, cooldown: 0.3, vary: 0.04 }),
} as const satisfies Record<string, SfxDef>;

export type SfxName = keyof typeof SFX;
export const SFX_NAMES = Object.keys(SFX) as SfxName[];
