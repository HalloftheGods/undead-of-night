import type { WeaponId, ZombieType } from './protocol.ts';

export const TICK_RATE = 30;
export const TICK_DT = 1 / TICK_RATE;
/** One seat per survivor: co-op never shares one, so the room fills when every survivor is out. */
export const MAX_PLAYERS = 5;
/** Injected by vite.config.js from ZOMBIE_PORT for the browser build; undefined under plain node. */
declare const __ZOMBIE_SERVER_PORT__: number | undefined;
/** Server port. Browser: ZOMBIE_PORT at dev start (default 8097). Node server: reads ZOMBIE_PORT itself, same fallback. */
export const DEFAULT_SERVER_PORT = typeof __ZOMBIE_SERVER_PORT__ === 'number' ? __ZOMBIE_SERVER_PORT__ : 8097;

export const PLAYER_RADIUS = 6;
export const PLAYER_SPEED = 84;
/** Walking speed scaled by stance. */
export const SNEAK_SPEED_SCALE = 0.55;
export const SPRINT_SPEED_SCALE = 1.4;
/** A sneaking survivor is spotted from this share of the usual sight range. */
export const SNEAK_SIGHT_SCALE = 0.6;
/** Sprinting footsteps carry this far, once every interval while moving. */
export const SPRINT_NOISE_RADIUS = 110;
export const SPRINT_NOISE_INTERVAL_SEC = 0.5;
/** Seconds a baseline survivor can sprint from a full bar; a faster survivor lasts proportionally longer. */
export const SPRINT_DRAIN_SEC = 5;
/** Seconds to refill an empty bar, once the rest below has passed. */
export const STAMINA_REGEN_SEC = 4;
/** Seconds after the last sprinting step before the bar starts to refill. */
export const STAMINA_REGEN_DELAY_SEC = 0.5;
/** Having run dry, a survivor cannot sprint again until the bar is back to this share. */
export const SPRINT_REARM_SHARE = 0.25;
export const PLAYER_MAX_HEALTH = 100;
/** Distance from the player's centre to the barrel tip, reported on shot events. */
export const MUZZLE_OFFSET = 11;
/**
 * Bodies collide on the ground, but people aim at chests. Aim, muzzle flashes
 * and tracers all sit this far above the ground point, so a shot passes through
 * the crosshair rather than just under it.
 */
export const CHEST_HEIGHT = 13;

export interface WeaponStats {
  readonly label: string;
  readonly magSize: number;
  readonly fireIntervalMs: number;
  readonly reloadMs: number;
  readonly damage: number;
  readonly pellets: number;
  /** Half-angle of the random cone, radians. */
  readonly spreadRad: number;
  readonly bulletSpeed: number;
  readonly range: number;
  /** Most spare rounds a player can carry for this gun. */
  readonly reserveCap: number;
  /** Rounds still in the magazine when the gun is found. */
  readonly foundAmmo: number;
  /** Zombies this close hear a shot, walls or not. */
  readonly noiseRadius: number;
}

export const WEAPONS: Record<WeaponId, WeaponStats> = {
  pistol: { label: 'Pistol', magSize: 12, fireIntervalMs: 270, reloadMs: 1100, damage: 34, pellets: 1, spreadRad: 0.025, bulletSpeed: 520, range: 300, reserveCap: 60, foundAmmo: 12, noiseRadius: 260 },
  carbine: { label: 'Carbine', magSize: 30, fireIntervalMs: 115, reloadMs: 1700, damage: 24, pellets: 1, spreadRad: 0.05, bulletSpeed: 620, range: 340, reserveCap: 120, foundAmmo: 18, noiseRadius: 320 },
  shotgun: { label: 'Shotgun', magSize: 6, fireIntervalMs: 760, reloadMs: 2100, damage: 18, pellets: 8, spreadRad: 0.24, bulletSpeed: 470, range: 180, reserveCap: 30, foundAmmo: 4, noiseRadius: 420 },
};

/** The run's only guaranteed supply: one magazine and one reload. */
export const START_SPARE_ROUNDS = 12;

export type AmmoPickup = 'pistol_ammo' | 'carbine_ammo' | 'shells';

/** Which gun each kind of ammo feeds, and how many rounds a box on a shelf holds. */
export const AMMO_PICKUPS: Record<AmmoPickup, { readonly weapon: WeaponId; readonly rounds: number }> = {
  pistol_ammo: { weapon: 'pistol', rounds: 8 },
  carbine_ammo: { weapon: 'carbine', rounds: 15 },
  shells: { weapon: 'shotgun', rounds: 4 },
};

export interface ZombieStats {
  readonly radius: number;
  readonly speed: number;
  readonly health: number;
  readonly damage: number;
  readonly points: number;
  /** Gap between the two bodies at which a swing starts and still lands. */
  readonly reach: number;
  readonly windupSec: number;
  readonly cooldownSec: number;
}

export const ZOMBIES: Record<ZombieType, ZombieStats> = {
  walker: { radius: 6, speed: 30, health: 60, damage: 10, points: 10, reach: 6, windupSec: 0.4, cooldownSec: 0.8 },
  runner: { radius: 5, speed: 68, health: 32, damage: 7, points: 15, reach: 5, windupSec: 0.28, cooldownSec: 0.6 },
  bloater: { radius: 9, speed: 22, health: 150, damage: 12, points: 25, reach: 6, windupSec: 0.5, cooldownSec: 1 },
  brute: { radius: 11, speed: 36, health: 520, damage: 26, points: 120, reach: 9, windupSec: 0.6, cooldownSec: 1.1 },
  screamer: { radius: 6, speed: 32, health: 45, damage: 6, points: 30, reach: 6, windupSec: 0.4, cooldownSec: 0.8 },
};

/** A screamer that spots someone calls every zombie this close, then needs this long before it can again. */
export const SCREAM_RADIUS = 300;
export const SCREAM_COOLDOWN_SEC = 10;
/** Share of roamers that are screamers from this level on, growing a little each level after. */
export const SCREAMER_FROM_LEVEL = 3;
export const SCREAMER_SHARE = 0.03;
export const SCREAMER_SHARE_PER_LEVEL = 0.005;

/** The attack stays in its swing pose this long after the wind-up resolves. */
export const ZOMBIE_RECOVERY_SEC = 0.22;
/** Standing population plus any horde, with room for the last level's. */
export const ZOMBIE_CAP = 260;
export const KNOCKBACK_SPEED = 90;
export const KNOCKBACK_DECAY_PER_SEC = 10;

export const BLOATER_BURST_RADIUS = 46;
export const BLOATER_BURST_PLAYER_DAMAGE = 24;
export const BLOATER_BURST_ZOMBIE_DAMAGE = 70;

// Awareness. A zombie that has noticed nothing wanders; see zombie-senses.ts.
export const ZOMBIE_SIGHT_RANGE = 170;
/** A hunter with no sight of anyone gives up after this long. */
export const ZOMBIE_LOSE_INTEREST_SEC = 9;
/** A zombie walking to a noise gives up after this long. */
export const ZOMBIE_INVESTIGATE_SEC = 12;
/** Farther than this from every player, a roaming zombie is not simulated at all. */
export const ZOMBIE_SLEEP_RANGE = 900;
export const ZOMBIE_WANDER_SPEED_SCALE = 0.45;

/** Roaming zombies at the start of a run, and the level top-ups hold it at. */
export const STANDING_POPULATION = 130;
/** Share of roamers that are not plain walkers. */
export const ROAMER_MIX = { bloater: 0.08, runner: 0.14 } as const;
export const POPULATION_TOPUP_SEC = 5;
/** No roaming zombie starts this close to the spawn, so nobody knows the player is there. */
export const SPAWN_SAFE_RADIUS = 520;
/** Top-ups appear at least this far from every player. */
export const TOPUP_MIN_DISTANCE = 700;

/** Players start this close to a town's entry. */
export const SPAWN_SCATTER = 28;

/** Standing this close to the van counts as being at it. */
export const EXIT_RADIUS = 48;
/** How long everyone must stay at the van before it leaves. */
export const EXIT_HOLD_SEC = 2;
/** Open ground the van needs around it, which clears its footprint. */
export const EXIT_CLEARANCE = 32;
/** Health each survivor gets back on reaching the next town. */
export const LEVEL_CLEAR_HEAL = 25;

/** First lull: enough to reach a building or two before the first horde. */
export const LEAD_IN_SEC = 140;
export const INTERMISSION_SEC = 100;
/** Level 1 only: the first lull is short, so a new player is not left walking an empty town. */
export const LEVEL_ONE_LEAD_IN_SEC = 60;
/** Level 1 only: slow shamblers placed near the spawn so the first fight comes within about 20 s. */
export const OPENING_SHAMBLERS = 3;
/** The first walker is in sight at once; the others start beyond sight range and join as the fight makes noise. */
export const OPENING_SHAMBLER_RINGS: readonly number[] = [110, 150, 195];
export const OPENING_SHAMBLER_SPEED_SCALE = 0.85;
/** Level 1 only: Horde 1 brings this share of its usual size, one body every few seconds. */
export const LEVEL_ONE_HORDE_ONE_SHARE = 0.6;
export const LEVEL_ONE_HORDE_ONE_GAP_SEC = 2.5;
/** A horde stops hunting after this long, whatever is left of it. */
export const HORDE_MAX_SEC = 60;
/** A horde is frenzied while it hunts: its runners can outpace a player, so they must be dealt with. */
export const HORDE_SPEED_SCALE = 1.35;
/** Horde bodies appear in this ring around a player: just past the corner of the view. */
export const SPAWN_MIN_DISTANCE = 320;
export const SPAWN_MAX_DISTANCE = 520;

export const BLEEDOUT_SEC = 25;
/** Bleedout speed once nobody is left to revive, so the last screen is not a long wait. */
export const BLEEDOUT_ALONE_RATE = 5;
export const REVIVE_RANGE = 28;
export const REVIVE_SEC = 3;
export const DRY_FIRE_INTERVAL_SEC = 0.35;
export const WEAPON_SWITCH_DELAY_SEC = 0.15;

// The gun shove: weak, silent and always there.
export const MELEE_COOLDOWN_SEC = 0.7;
/** With a knife in hand, attacks swing much faster and re-engage promptly. */
export const KNIFE_COOLDOWN_SEC = 0.25;
export const MELEE_RANGE = 24;
/** Half-angle of the shove's arc in front of the player, radians. */
export const MELEE_ARC_RAD = 1.2;
export const MELEE_DAMAGE = 4;
export const MELEE_KNOCKBACK_SPEED = 300;
/** A shoved zombie cannot start a swing for this long. */
export const MELEE_STAGGER_SEC = 0.6;
/** A shoved zombie shrugs off the next shove for this long: time for a walker to come back and land one swing. */
export const MELEE_STAGGER_IMMUNE_SEC = 2;
/** A stabbed zombie can be struck again quickly so follow-up hits register. */
export const KNIFE_STAGGER_IMMUNE_SEC = 0.25;
/** Bodies one shove can move, nearest first. */
export const MELEE_MAX_TARGETS = 2;

export const PICKUP_RADIUS = 12;
/** Kill drops rot away; loot in buildings stays until someone takes it. */
export const KILL_DROP_TTL_SEC = 30;
export const KILL_DROP_CHANCE = 0.04;
/** Rounds in a kill drop's ammo, far short of a box from a shelf. */
export const KILL_DROP_ROUNDS = 3;
export const BANDAGE_HEAL = 18;
export const MEDKIT_HEAL = 50;
export const MEDKIT_MAX = 3;

/**
 * How the world's ammo adds up: all of it should kill about this share of the standing population.
 * About half of it is shut away in containers, and nobody gets through every drawer in a town.
 */
export const AMMO_POPULATION_SHARE = 1.15;
/** Share of a town's ammo lying on its floors. Containers hold the rest. */
export const AMMO_FLOOR_SHARE = 0.5;
/** Items placed in far-off buildings after each horde. */
export const RESTOCK_ITEMS = 5;
/** Restock lands at least this far from every player. */
export const RESTOCK_MIN_DISTANCE = 900;

/** Flow field refresh: 30 / 8 is a little under four times a second. */
export const FLOW_REFRESH_TICKS = 8;
/** Tiles the chase field reaches from the players, walked distance. */
export const FLOW_REACH_TILES = 90;
/** Tiles the noise field reaches, which covers the loudest gun plus corners. */
export const NOISE_REACH_TILES = 50;

/** Snapshots carry zombies and pickups this close to a player, and nothing farther off. */
export const SNAPSHOT_RANGE = 900;
/** What each co-op client is sent: past the corner of the widest view, with room for what walks in between frames. */
export const VIEWER_RANGE = 600;

/** Longest reconnect token a client may hold. */
export const JOIN_TOKEN_MAX_LENGTH = 64;
