// What each game event sounds like: a table from event type to the sounds it plays.
import type { BossId, GameEvent, PickupType, WeaponId, ZombieType } from '../../shared/protocol.ts';
import type { GunEffect } from '../../shared/round-effect-data.ts';
import type { Mixer } from './mixer.ts';
import type { SfxName } from './sfx-registry.ts';

const SHOT: Record<WeaponId, SfxName> = { pistol: 'pistol', carbine: 'carbine', shotgun: 'shotgun' };
const DEATH: Record<ZombieType, SfxName> = {
  walker: 'die_walker', runner: 'die_runner', bloater: 'die_bloater', brute: 'die_brute', screamer: 'die_screamer',
};
const ALERT: Record<ZombieType, SfxName> = {
  walker: 'alert_walker', runner: 'alert_runner', bloater: 'alert_bloater', brute: 'alert_brute', screamer: 'scream',
};
export const PICKUP_SFX: Record<PickupType, SfxName> = {
  bandage: 'pickup_bandage', medkit: 'pickup_medkit', pistol_ammo: 'pickup_pistol_ammo',
  carbine_ammo: 'pickup_carbine_ammo', shells: 'pickup_shells', carbine: 'pickup_weapon', shotgun: 'pickup_weapon',
  knife: 'pickup_weapon', radio: 'pickup_radio',
  // Parts and kits go in the bag; only a whole gun gets the gun pickup's flourish.
  barrel: 'pickup_part', grip: 'pickup_part', magazine: 'pickup_part', suppressor: 'pickup_part', toolkit: 'pickup_part',
  incendiary_kit: 'pickup_part', acid_kit: 'pickup_part', piercing_kit: 'pickup_part', tranq_kit: 'pickup_part',
  jewel_small: 'pickup_jewel', jewel_large: 'pickup_jewel_large',
  canned_food: 'pickup_medkit', water_bottle: 'pickup_bandage', disinfectant: 'pickup_medkit', antibiotics: 'pickup_bandage',
  // Stand-ins until salvage gets its own sounds (#7242).
  fuel_can: 'pickup_part', car_battery: 'pickup_part', scrap_steel: 'pickup_part', sedatives: 'pickup_part',
};
/** Each boss's trick has its own call, so a player hears which one is coming. */
const BOSS_TRICK: Record<BossId, SfxName> = { howler: 'boss_howl', mother: 'boss_brood', butcher: 'boss_charge' };
const STATUS: Record<GunEffect, SfxName> = { incendiary: 'ignite', acid: 'corrode', piercing: 'pierce', tranq: 'tranq_dart' };
/** A can on the end of a gun: still a shot, but a dull one. */
const SUPPRESSED_GAIN = 0.35;

/** Where a sound plays: a spot in the world, or the local player's own unattenuated sound. */
export interface SoundSpot { readonly x: number; readonly y: number; readonly local: boolean }

/** What an event's sound may reach: the mixer, where a player stands, and the engine's shared timers. */
export interface SoundCue {
  readonly mixer: Mixer;
  /** Where a sound plays; the local player's own sounds play unattenuated. */
  readonly at: (x: number, y: number, playerId?: string) => SoundSpot;
  /** A far, faint sound somewhere around the listener. */
  readonly playAmbient: (name: 'distant_groan' | 'distant_crash') => void;
  /** True once per alert window, so a pack waking at once snarls only once. */
  readonly claimAlert: () => boolean;
  /** A reload's opening and closing sounds, which the engine shapes per gun (a shotgun loads shell by shell). */
  readonly reloadStart: (weapon: WeaponId, playerId: string, where: SoundSpot) => void;
  readonly reloadEnd: (weapon: WeaponId, playerId: string, where: SoundSpot) => void;
  /** Stops a shotgun's shell-by-shell loading, as when its owner switches guns. */
  readonly dropShells: (playerId: string) => void;
}

type EventOf<K extends GameEvent['type']> = GameEvent & { readonly type: K };
type EventSound<K extends GameEvent['type']> = (e: EventOf<K>, cue: SoundCue) => void;
type EventSounds = { readonly [K in GameEvent['type']]?: EventSound<K> };

const EVENT_SOUNDS: EventSounds = {
  shot: (e, { mixer, at }) => {
    const p = at(e.x, e.y, e.playerId);
    mixer.play(SHOT[e.weapon], e.suppressed ? { ...p, gain: SUPPRESSED_GAIN } : p);
    const isShotgun = e.weapon === 'shotgun';
    if (isShotgun) mixer.play('pump', { ...p, delay: 0.45, gain: 0.8 });
  },
  dry_fire: (e, { mixer, at }) => mixer.play('dry_click', at(e.x, e.y, e.playerId)),
  reload_start: (e, { at, reloadStart }) => reloadStart(e.weapon, e.playerId, at(e.x, e.y, e.playerId)),
  reload_end: (e, { at, reloadEnd }) => reloadEnd(e.weapon, e.playerId, at(e.x, e.y, e.playerId)),
  melee: (e, { mixer, at }) => mixer.play(e.hit ? 'melee_thud' : 'melee_swing', at(e.x, e.y, e.playerId)),
  heal: (e, { mixer, at }) => mixer.play('heal', at(e.x, e.y, e.playerId)),
  zombie_alert: (e, { mixer, claimAlert }) => {
    const isFirstAlert = claimAlert();
    if (isFirstAlert) mixer.play(ALERT[e.zombieType], { x: e.x, y: e.y });
  },
  zombie_track: (e, { mixer }) => mixer.play('sniff', { x: e.x, y: e.y }),
  weapon_switch: (e, { mixer, at, dropShells }) => {
    dropShells(e.playerId);
    mixer.play('weapon_switch', at(e.x, e.y, e.playerId));
  },
  bullet_impact: (e, { mixer }) => mixer.play('impact', { x: e.x, y: e.y }),
  zombie_hit: (e, { mixer }) => mixer.play('flesh_hit', { x: e.x, y: e.y }),
  headshot: (e, { mixer, at }) => mixer.play('headshot', at(e.x, e.y, e.playerId)),
  zombie_die: (e, { mixer }) => mixer.play(DEATH[e.zombieType], { x: e.x, y: e.y }),
  // Everyone hears a boss arrive and go down, wherever they are in town; its trick is heard where it stands.
  boss_arrive: (_e, { mixer }) => mixer.play('boss_arrive', { local: true }),
  boss_trick: (e, { mixer }) => mixer.play(BOSS_TRICK[e.boss], { x: e.x, y: e.y }),
  boss_down: (_e, { mixer }) => mixer.play('boss_fall', { local: true }),
  zombie_status: (e, { mixer }) => mixer.play(STATUS[e.effect], { x: e.x, y: e.y }),
  zombie_attack: (e, { mixer }) => mixer.play('claw', { x: e.x, y: e.y }),
  bloater_burst: (e, { mixer }) => mixer.play('bloater_burst', { x: e.x, y: e.y }),
  player_hurt: (e, { mixer, at }) => mixer.play('player_hurt', at(e.x, e.y, e.playerId)),
  player_downed: (e, { mixer, at }) => mixer.play('player_downed', at(e.x, e.y, e.playerId)),
  merchant_hurt: (e, { mixer }) => mixer.play('player_hurt', { x: e.x, y: e.y }),
  merchant_downed: (e, { mixer }) => mixer.play('player_downed', { x: e.x, y: e.y }),
  player_dead: (e, { mixer, at }) => mixer.play('player_downed', { ...at(e.x, e.y, e.playerId), pitch: 0.75 }),
  player_revived: (e, { mixer, at }) => mixer.play('revive', at(e.x, e.y, e.playerId)),
  candy_eaten: (e, { mixer, at }) => {
    const p = at(e.x, e.y, e.playerId);
    mixer.play('candy_crunch', p);
    mixer.play(e.saved ? 'revive' : 'heal', { ...p, delay: 0.3 });
  },
  pickup: (e, { mixer, at }) => mixer.play(PICKUP_SFX[e.pickup], at(e.x, e.y, e.playerId)),
  // A keepsake carries no position: only the player who chose it hears it.
  keepsake_taken: (e, { mixer, at }) => {
    const p = at(0, 0, e.playerId);
    if (p.local) mixer.play('keepsake', p);
  },
  stairs_taken: (e, { mixer, at }) => {
    // 4 rhythmic footsteps across the stair traversal, pitched by direction (LTTP cadence).
    const p = at(e.x, e.y, e.playerId);
    const isGoingUp = e.to === 'UPSTAIRS';
    const pitches = isGoingUp ? [0.92, 0.98, 1.05, 1.12] : [1.12, 1.05, 0.98, 0.92];
    const delays = [0, 0.09, 0.18, 0.27];
    for (let i = 0; i < delays.length; i++) {
      mixer.play('step_hard', { ...p, delay: delays[i], pitch: pitches[i] });
    }
  },
  container_opened: (e, { mixer, at }) => mixer.play(e.noisy ? 'clatter' : 'container_open', at(e.x, e.y, e.playerId)),
  bottle_smash: (e, { mixer }) => mixer.play('glass_smash', { x: e.x, y: e.y }),
  // The fuse catches, then the spinner screams into life a little higher.
  spinner_lit: (e, { mixer }) => {
    mixer.play('ignite', { x: e.x, y: e.y, pitch: 1.2 });
    mixer.play('ignite', { x: e.x, y: e.y, pitch: 1.9 });
  },
  fountain_lit: (e, { mixer }) => mixer.play('ignite', { x: e.x, y: e.y, pitch: 1.4 }),
  drop_called: (e, { mixer }) => mixer.play('ignite', { x: e.x, y: e.y, pitch: 1.4 }),
  drop_landed: (e, { mixer }) => mixer.play('crate_land', { x: e.x, y: e.y }),
  car_alarm: (e, { mixer }) => mixer.play('car_alarm', { x: e.x, y: e.y }),
  // The van is waiting: everyone hears it, since everyone has to get to it.
  exit_open: (_e, { mixer }) => mixer.play('van_horn', { local: true }),
  wave_start: (_e, { mixer }) => mixer.play('wave_start'),
  overrun_warning: (e, { playAmbient }) => playAmbient(e.step === 0 ? 'distant_groan' : 'distant_crash'),
  overrun_breach: (_e, { mixer }) => mixer.play('wave_start'),
  wave_clear: (_e, { mixer }) => mixer.play('wave_clear'),
  game_over: (e, { mixer }) => mixer.play(e.stats.outcome === 'victory' ? 'run_victory' : 'game_over', { local: true }),
};

/** Plays an event's sounds; an event with no entry is silent. */
export function playEventSound(e: GameEvent, cue: SoundCue): void {
  const sound = EVENT_SOUNDS[e.type] as EventSound<GameEvent['type']> | undefined;
  sound?.(e, cue);
}
