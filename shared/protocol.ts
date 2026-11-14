// Single source of truth for everything that crosses the sim/client boundary.
// Pure data and types only, so it loads in the browser, Node and vitest alike.

import { CHARACTERS } from './characters.ts';
import type { DifficultyId } from './difficulty.ts';
import type { EmoteId } from './emotes.ts';
import { GAME_EVENT_TYPES, GAME_PHASES, PICKUP_TYPES } from './events.ts';
import type { GameStyle } from './game-style.ts';
import type { PlayerGear } from './gun-upgrades.ts';
import type { HomeAction, HomeView, JoinHome, MerchantEntity, MerchantId, OverrunEnd, RoomHomeView } from './home-protocol.ts';
import type { LeftoverView } from './leftovers.ts';
import type { GunEffect } from './round-effect-data.ts';
import type { BackpackTier } from './backpack.ts';
import type { SurvivalNeeds } from './survival-needs.ts';
import type { FortificationInventory, FortificationItemType } from './fortifications.ts';
import type { BagCommit } from './bag.ts';
import type { Supplies } from './supply-types.ts';
import type { BenchAction, BenchView } from './workbench.ts';
import type { GridItem } from './grid-inventory.ts';
import type { ContainerKind } from './containers.ts';
import type { VehicleBody, VehicleFacing } from './vehicle-bodies.ts';

export { GAME_EVENT_TYPES, GAME_PHASES, PICKUP_TYPES };
export type { BackpackTier, FortificationInventory, FortificationItemType, GridItem, SurvivalNeeds };
export type ArmorTier = 'light' | 'medium' | 'heavy';
// The world map types live in map-protocol.ts; everything still imports them from here.
export { BUILDING_DEFS, BUILDING_KINDS, DOOR_WIDTH, PROP_DEFS, PROP_KINDS, TILE_KINDS, TILE_SIZE, WALL_THICKNESS } from './map-protocol.ts';
export type { BuildingInstance, BuildingKind, District, MapLight, PropInstance, PropKind, TileKind, WorldMap } from './map-protocol.ts';

export type EntityId = string;

export type WeaponId = 'pistol' | 'carbine' | 'shotgun';
export type ZombieType = 'walker' | 'runner' | 'bloater' | 'brute' | 'screamer';
/** A boss is a zombie of an existing type grown huge (`shared/bosses.ts`). */
export type BossId = 'howler' | 'mother' | 'butcher';
export type PickupType = (typeof PICKUP_TYPES)[number];
export type PlayerStatus = 'alive' | 'downed' | 'dead';
/** Halloween candy: a short boost each (shared/candy.ts). */
export type CandyId =
  | 'sour_skulls' | 'fang_taffy' | 'ghost_gum' | 'pumpkin_fizz' | 'witchs_brittle' | 'bat_bites'
  | 'corn_rush' | 'jawbreaker' | 'licorice_lash' | 'caramel_apple' | 'popping_eyeballs' | 'fireballs' | 'full_size_bar'
  | 'skull_pops' | 'frost_bites' | 'cherry_bombs' | 'shock_tarts' | 'glow_worms' | 'sticky_fingers'
  | 'deadeye_drops' | 'monster_mash' | 'everlasting_chews' | 'spiky_suckers' | 'boom_drops' | 'grave_gels'
  | 'scatter_skittles' | 'cadaver_chews' | 'reaper_ribbons' | 'toffee_timber';

/** Permanent for the run, one of three chosen after every second town (shared/keepsakes.ts). */
export type KeepsakeId = 'rabbit_foot' | 'sneakers' | 'bandolier' | 'rosary' | 'lighter' | 'old_watch' | 'treat_bag' | 'dog_tags';

export interface SugarView {
  readonly id: CandyId;
  /** Seconds left. */
  readonly left: number;
  /** Seconds it had when last eaten, stacked time and all, so the timer's bar drains over the whole of it. */
  readonly total?: number;
}

/** How many of each candy a survivor carries. A kind not carried is left off. */
export type CandyBag = Partial<Record<CandyId, number>>;
export type GamePhase = (typeof GAME_PHASES)[number];
/** How a survivor is moving: sneaking is slow and hard to spot, sprinting is fast and loud. */
export type Stance = 'walk' | 'sneak' | 'sprint';

export const WEAPON_ORDER: readonly WeaponId[] = ['pistol', 'carbine', 'shotgun'];
export const SURVIVOR_SKIN_COUNT = CHARACTERS.length;

export interface PlayerEntity {
  readonly id: EntityId;
  name: string;
  /** Index into CHARACTERS and the survivor art. No two players in a room share one. */
  skin: number;
  x: number;
  y: number;
  angle: number;
  moving: boolean;
  status: PlayerStatus;
  health: number;
  maxHealth: number;
  weapon: WeaponId;
  /** Rounds in the current magazine. */
  ammo: number;
  magSize: number;
  /** Spare rounds for the current weapon. Every gun is finite, and reloading only moves rounds out of this. */
  reserve: number;
  /** Weapons this player owns, in WEAPON_ORDER. */
  owned: WeaponId[];
  /** Spare rounds per weapon, for the HUD slots. */
  ammoBag: Record<WeaponId, number>;
  /** Rounds loaded in each gun, so the HUD can show a loaded gun that is not in hand. 0 for guns not owned. */
  mags: Record<WeaponId, number>;
  /** Medkits carried, used with the heal input. */
  medkits: number;
  /** Carrying a knife, which makes the shove a stab. */
  knife: boolean;
  /** Empty bottles to throw. Left off at none. */
  bottles?: number;
  /** Spinner and fountain fireworks found in this town. Left off at none. */
  fireworks?: number;
  fountains?: number;
  /** Candy carried, counted by kind (shared/candy.ts). Left off at none. */
  bag?: CandyBag;
  candy?: readonly CandyId[];
  /** Candy working on this survivor now, with the seconds each has left. Left off at none. */
  sugar?: SugarView[];
  /** Keepsakes kept this run. Left off at none. */
  keepsakes?: KeepsakeId[];
  /** Three keepsakes to choose one from, while the choice is open. Left off otherwise. */
  keepsakeOffer?: KeepsakeId[];
  /** Sprint stamina, 1 full to 0 empty. Left off while full. */
  stamina?: number;
  /** Ran dry: sprint is off until the bar refills past the re-arm mark. Left off when not. */
  winded?: boolean;
  /** 0 when not searching, otherwise 0..1 through the search. */
  search: number;
  /** Id of the building this player stands in, or null outdoors. */
  indoors: string | null;
  /** 0 when not reloading, otherwise 0..1 through the reload. */
  reload: number;
  /** Seconds until a downed player dies. 0 unless downed. */
  bleedout: number;
  /** 0..1 progress of a teammate reviving this downed player. */
  revive: number;
  score: number;
  kills: number;
  /** Highest input seq applied; the client reconciles prediction against it. */
  lastInputSeq: number;
  /** Parts carried and work done on guns, left off for someone with neither. */
  gear?: PlayerGear;
  /** Treasure carried, station and trip result. Left off outside home mode. */
  home?: HomeView;
  needs?: SurvivalNeeds;
  backpackTier?: BackpackTier;
  armorTier?: ArmorTier;
  materials?: FortificationInventory;
  /** Bandages and survival items carried (`shared/supply-types.ts`). Left off at none. */
  supplies?: Supplies;
  /** Hash of where this survivor's things sit in the bag (`shared/bag.ts`). The layout itself is never sent. */
  bagHash?: number;
  /** Hold progress (0..1) on the radio tower alarm. Left off when 0. */
  towerHold?: number;
  /** The car and seat this survivor sits in. Left off on foot. */
  vehicle?: VehicleSeat;
}

/** A seat in a car: `id` is the car's (its map prop index), seat 0 drives. */
export interface VehicleSeat {
  readonly id: number;
  readonly seat: number;
}

/** A car someone has got into, as every client draws it and runs the E-key rules on it (`shared/vehicle-choice.ts`). */
export interface VehicleView {
  /** The map prop it was parked as, which also names it. */
  readonly id: number;
  readonly body: VehicleBody;
  /** Centre of the footprint. */
  readonly x: number;
  readonly y: number;
  /** Radians on screen axes: east 0, south a quarter turn clockwise. */
  readonly heading: number;
  /** Signed px/s along the heading; 0 at rest, when the car is a solid. */
  readonly speed: number;
  readonly facing: VehicleFacing;
  /** Who sits in each seat, seat 0 driving; null for an empty one. */
  readonly seats: readonly (EntityId | null)[];
  /** 0..1 of its health. Left off at full. */
  readonly health?: number;
}

export interface ZombieEntity {
  readonly id: EntityId;
  readonly type: ZombieType;
  x: number;
  y: number;
  angle: number;
  health: number;
  maxHealth: number;
  /** True during the attack wind-up and swing, drives the attack clip. */
  attacking: boolean;
  /** On fire, which glows. Left off unless true. */
  burning?: boolean;
  /** Stacks of acid on it, 1 up to CORROSION_MAX_STACKS. Left off at none. */
  corrosion?: number;
  /** Slowed by a tranq round. Left off unless true. */
  slowed?: boolean;
  /** Following someone's prints in the snow. Left off unless true. */
  tracking?: boolean;
  /** Which boss this is, drawn big. Left off for everything else. */
  boss?: BossId;
  /** Wedged in a narrow opening like a sewer manhole, unable to move. */
  stuck?: boolean;
}

/** A footprint in the snow, for drawing: where, which way it points, and seconds before it fills in. */
export interface TrackEntity {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly left: number;
}

export interface BulletEntity {
  readonly id: EntityId;
  readonly shooterId: EntityId;
  x: number;
  y: number;
  /** World pixels per second. */
  vx: number;
  vy: number;
  /** What the gun it came from fires. Left off for a plain round. */
  effect?: GunEffect;
}

export interface PickupEntity {
  readonly id: EntityId;
  readonly type: PickupType;
  x: number;
  y: number;
  /** Specific candy identifier when type is 'candy'. */
  readonly candyId?: CandyId;
}

export interface PlayerRunStats {
  readonly id: EntityId;
  readonly name: string;
  readonly skin: number;
  readonly kills: number;
  readonly score: number;
}

/** How a run ended: everyone fell, or the van left the last town. */
export type RunOutcome = 'defeat' | 'victory';

export interface GameOverStats {
  readonly outcome: RunOutcome;
  /** What the run was played on. */
  readonly difficulty: DifficultyId;
  /** Level reached, 1 up to the last. */
  readonly level: number;
  /** Hordes survived over the whole run, every town added up. */
  readonly wave: number;
  readonly durationSec: number;
  readonly players: readonly PlayerRunStats[];
}

/** The van out of town, there once the level's last horde is survived. Draw it as a `van_h` prop at x,y. */
export interface ExitEntity {
  readonly x: number;
  readonly y: number;
  /** 0..1 through the wait with everyone at the van, 0 until they all are. */
  readonly progress: number;
}

/** One-shot facts for audio, particles and banners. Every field is in world space. */
export type GameEvent =
  | { readonly type: 'shot'; readonly playerId: EntityId; readonly weapon: WeaponId; readonly x: number; readonly y: number; readonly angle: number; readonly suppressed?: boolean; readonly effect?: GunEffect }
  | { readonly type: 'dry_fire'; readonly playerId: EntityId; readonly x: number; readonly y: number }
  | { readonly type: 'melee'; readonly playerId: EntityId; readonly x: number; readonly y: number; readonly angle: number; readonly hit: boolean }
  | { readonly type: 'heal'; readonly playerId: EntityId; readonly x: number; readonly y: number; readonly amount: number }
  | { readonly type: 'zombie_alert'; readonly zombieId: EntityId; readonly zombieType: ZombieType; readonly x: number; readonly y: number }
  /** A roamer put its nose on someone's snow trail and started following it. */
  | { readonly type: 'zombie_track'; readonly zombieId: EntityId; readonly zombieType: ZombieType; readonly x: number; readonly y: number }
  | { readonly type: 'reload_start'; readonly playerId: EntityId; readonly weapon: WeaponId; readonly x: number; readonly y: number }
  | { readonly type: 'reload_end'; readonly playerId: EntityId; readonly weapon: WeaponId; readonly x: number; readonly y: number }
  | { readonly type: 'weapon_switch'; readonly playerId: EntityId; readonly weapon: WeaponId; readonly x: number; readonly y: number }
  | { readonly type: 'bullet_impact'; readonly x: number; readonly y: number; readonly angle: number }
  | { readonly type: 'zombie_hit'; readonly zombieId: EntityId; readonly zombieType: ZombieType; readonly x: number; readonly y: number; readonly angle: number }
  /** A round's effect took hold: a body lit (`caught` if off another body), acid went a stack deeper, a tranq landed, or a bullet went through. */
  | { readonly type: 'zombie_status'; readonly effect: GunEffect; readonly zombieId: EntityId; readonly zombieType: ZombieType; readonly x: number; readonly y: number; readonly caught?: boolean; readonly stacks?: number }
  | { readonly type: 'headshot'; readonly playerId: EntityId; readonly zombieId: EntityId; readonly zombieType: ZombieType; readonly x: number; readonly y: number; readonly angle: number; readonly points: number; readonly chain?: number }
  | { readonly type: 'zombie_die'; readonly zombieId: EntityId; readonly zombieType: ZombieType; readonly x: number; readonly y: number; readonly angle: number; readonly killerId: EntityId | null; readonly points: number; readonly chain?: number; /** True when the kill chain changed what the kill paid. */ readonly chainPaid?: boolean }
  | { readonly type: 'zombie_attack'; readonly zombieId: EntityId; readonly zombieType: ZombieType; readonly x: number; readonly y: number }
  | { readonly type: 'bloater_burst'; readonly x: number; readonly y: number; readonly radius: number }
  | { readonly type: 'player_hurt'; readonly playerId: EntityId; readonly x: number; readonly y: number; readonly damage: number }
  | { readonly type: 'player_downed'; readonly playerId: EntityId; readonly x: number; readonly y: number }
  | { readonly type: 'player_revived'; readonly playerId: EntityId; readonly x: number; readonly y: number }
  /** A survivor chose a keepsake. */
  | { readonly type: 'keepsake_taken'; readonly playerId: EntityId; readonly keepsake: KeepsakeId }
  /** A survivor ate a candy. `stacked` marks one already working, its time added on. `saved` marks a Caramel Apple spent picking them back up. */
  | { readonly type: 'candy_eaten'; readonly playerId: EntityId; readonly candy: CandyId; readonly x: number; readonly y: number; readonly stacked?: boolean; readonly saved?: boolean }
  | { readonly type: 'player_dead'; readonly playerId: EntityId; readonly x: number; readonly y: number }
  | { readonly type: 'pickup'; readonly playerId: EntityId; readonly pickup: PickupType; readonly x: number; readonly y: number }
  /** Someone took the stairs: x, y is where they came out, `to` what the stairs led to. */
  | { readonly type: 'stairs_taken'; readonly playerId: EntityId; readonly x: number; readonly y: number; readonly to: string }
  | { readonly type: 'container_opened'; readonly playerId: EntityId; readonly container: number; readonly x: number; readonly y: number; readonly found: boolean; readonly noisy: boolean; readonly bottle?: boolean; readonly stash?: 'firework' | 'fountain' | 'candy'; readonly candy?: CandyId; readonly full?: true; readonly fireworks?: number; readonly clue?: true; readonly clueItem?: string; readonly items?: readonly GridItem[]; readonly reopen?: boolean; readonly title?: string; readonly kind?: ContainerKind }
  /** A thrown bottle broke at x,y, thrown from fromX,fromY. */
  | { readonly type: 'bottle_smash'; readonly playerId: EntityId; readonly x: number; readonly y: number; readonly fromX: number; readonly fromY: number }
  /** A firework landed at x,y as a ground spinner, throwing sparks `radius` round it for `sec`. */
  | { readonly type: 'spinner_lit'; readonly playerId: EntityId; readonly x: number; readonly y: number; readonly fromX: number; readonly fromY: number; readonly radius: number; readonly sec: number }
  /** A fountain firework landed at x,y and sprays for `sec`. */
  | { readonly type: 'fountain_lit'; readonly playerId: EntityId; readonly x: number; readonly y: number; readonly fromX: number; readonly fromY: number; readonly sec: number }
  | { readonly type: 'car_alarm'; readonly x: number; readonly y: number }
  /** Emergency siren at the radio tower sounded to summon the horde early. */
  | { readonly type: 'radio_tower_alarm'; readonly x: number; readonly y: number; readonly playerId: EntityId }
  /** A flare went up at x,y: a supply crate comes down on it in `sec`. */
  | { readonly type: 'drop_called'; readonly x: number; readonly y: number; readonly sec: number }
  | { readonly type: 'drop_landed'; readonly x: number; readonly y: number }
  | { readonly type: 'boss_arrive' | 'boss_trick' | 'boss_down'; readonly boss: BossId; readonly x: number; readonly y: number }
  | { readonly type: 'wave_intermission'; readonly wave: number; readonly seconds: number }
  | { readonly type: 'wave_start'; readonly wave: number; readonly hostiles: number }
  | { readonly type: 'wave_clear'; readonly wave: number }
  | { readonly type: 'exit_open'; readonly level: number; readonly x: number; readonly y: number }
  | { readonly type: 'level_complete'; readonly level: number }
  | { readonly type: 'level_start'; readonly level: number }
  /** The van left the bunker for a town. `attempt` is the room's trip serial. */
  | { readonly type: 'trip_start'; readonly level: number; readonly attempt: number }
  /** The horde nears the camp: `step` counts the warnings from 0, `left` is the clock's seconds then, `gaps` how many sections will give once picked. */
  | { readonly type: 'overrun_warning'; readonly step: number; readonly left: number; readonly gaps?: number }
  /** A camp fence section about to give rocks on its posts, or gives, at x,y: the middle of the ground it stands on. */
  | { readonly type: 'fence_rattle' | 'fence_fall'; readonly x: number; readonly y: number }
  /** A door at x,y was closed, opened, boarded, pried, hit by zombies or broken. */
  | { readonly type: 'door_closed' | 'door_opened' | 'plank_added' | 'plank_removed' | 'door_hit' | 'door_broken'; readonly x: number; readonly y: number }
  | { readonly type: 'overrun_breach'; readonly hostiles: number; readonly gaps?: number }
  | { readonly type: 'merchant_hurt'; readonly merchant: MerchantId; readonly x: number; readonly y: number }
  | { readonly type: 'merchant_downed'; readonly merchant: MerchantId; readonly x: number; readonly y: number }
  | { readonly type: 'overrun_end'; readonly outcome: OverrunEnd }
  /** Someone got into or out of a car: x, y is where they stand after (the car's centre on getting in). */
  | { readonly type: 'vehicle_enter' | 'vehicle_exit'; readonly vehicle: number; readonly playerId: EntityId; readonly seat: number; readonly x: number; readonly y: number }
  | { readonly type: 'vehicle_horn'; readonly vehicle: number; readonly x: number; readonly y: number }
  /** A car hit something solid: `strength` is the speed lost over the car's top speed, 0..1. */
  | { readonly type: 'vehicle_crash'; readonly vehicle: number; readonly x: number; readonly y: number; readonly strength: number }
  /** A car ran into a zombie: `strength` as for a crash, `kill` when it went down. */
  | { readonly type: 'vehicle_hit'; readonly vehicle: number; readonly x: number; readonly y: number; readonly strength: number; readonly kill: boolean }
  /** A survivor sent an icon. Only the id travels; the client finds the body by playerId. */
  | { readonly type: 'emote'; readonly playerId: EntityId; readonly emote: EmoteId }
  | { readonly type: 'game_over'; readonly stats: GameOverStats };

/** Compiles only while GAME_EVENT_TYPES lists exactly the names GameEvent declares. */
export const EVENT_TYPES_MATCH: [GameEvent['type']] extends [(typeof GAME_EVENT_TYPES)[number]]
  ? [(typeof GAME_EVENT_TYPES)[number]] extends [GameEvent['type']] ? true : never
  : never = true;

export interface ClientInputPacket {
  readonly seq: number;
  readonly up: boolean;
  readonly down: boolean;
  readonly left: boolean;
  readonly right: boolean;
  /** Radians, world space, y down: 0 = east, PI/2 = south. */
  readonly angle: number;
  /** The crosshair as a spot in the drawn world, where heads are judged. Left off when there is no crosshair. */
  readonly aimX?: number;
  readonly aimY?: number;
  /** Aimed with a finger. Left off for a mouse. */
  readonly touch?: boolean;
  readonly shoot: boolean;
  readonly reload: boolean;
  /** Requested weapon, or null. The sim ignores weapons the player does not own. */
  readonly weapon: WeaponId | null;
  /** Shove with the gun: weak, noiseless, always available. */
  readonly melee: boolean;
  /** Use a carried medkit. */
  readonly heal: boolean;
  /** The search key is held down. */
  readonly search: boolean;
  /** Throw a bottle at the crosshair. Left off when not. */
  readonly throw?: boolean;
  /** Light a firework and toss it down as a spinner. Left off when not. */
  readonly spinner?: boolean;
  /** Light a fountain and toss it. Left off when not. */
  readonly fountain?: boolean;
  /** Eat this candy out of the bag, or `true` for the first one in it. Left off when not. */
  readonly eat?: true | CandyId;
  /** Take this keepsake from the three on offer. Left off when not. */
  readonly keepsake?: KeepsakeId;
  /** The sneak key is held. Left off when not. Wins over sprint when both are held. */
  readonly sneak?: boolean;
  /** The sprint key is held. Left off when not. */
  readonly sprint?: boolean;
  /** The horn key is held: only a driver honks. Left off when not. */
  readonly horn?: boolean;
}

export interface SnapshotPacket {
  readonly type: 'snapshot';
  readonly tick: number;
  readonly phase: GamePhase;
  /** Level of the run, 1 up to the last. */
  readonly level: number;
  /** The town being played: generateWorldMap(mapSeed, level, campSize). A change means the map changed, whatever the events said. */
  readonly mapSeed: number;
  /** Home only: the camp's size past the smallest. Left off in a town and in the smallest camp. A change rebuilds the camp. */
  readonly campSize?: number;
  /** Horde number in this town. Phase 'intermission' is the scavenging lull, phase 'wave' is a horde hunting the players. */
  readonly wave: number;
  /** Seconds to the next horde during intermission, otherwise 0. */
  readonly intermission: number;
  /** Zombies of the current horde alive or still to spawn; 0 during the lull. Roaming town zombies don't count. */
  readonly hostiles: number;
  readonly players: readonly PlayerEntity[];
  readonly zombies: readonly ZombieEntity[];
  readonly bullets: readonly BulletEntity[];
  readonly pickups: readonly PickupEntity[];
  /** The way out of this town, sent to everyone wherever they stand, or null until it opens. */
  readonly exit: ExitEntity | null;
  /** Ids of the town's containers that have been opened, so everyone sees them open. */
  readonly openedContainers: readonly number[];
  /** Buildings the team has been inside that still hold supplies, sent to everyone. Left off when there are none. */
  readonly leftovers?: readonly LeftoverView[];
  /** The town's supply drop, from its flare to the end of its marked time, sent to everyone. Left off otherwise. */
  readonly drop?: DropView;
  /** The town's boss while it stands, sent to everyone wherever they are. Left off otherwise. */
  readonly boss?: BossView;
  /** Footprints in a snowy town near this viewer. Left off when there are none. */
  readonly tracks?: readonly TrackEntity[];
  /** Doors near a player that are closed, boarded or damaged. Left off when every door is as it started. */
  readonly doors?: readonly DoorView[];
  /** Every car anyone has got into this town, sent to everyone wherever they are. Left off while there are none. */
  readonly vehicles?: readonly VehicleView[];
  /** The bunker's merchants, walking it, sent to everyone. Left off anywhere else. */
  readonly merchants?: readonly MerchantEntity[];
  /** Events since the previous snapshot, in order. */
  readonly events: readonly GameEvent[];
  readonly gameOver: GameOverStats | null;
  /** Present while the run is held at the workbench between towns. */
  readonly bench?: BenchView;
  /** The room's level pick and reach. Left off outside home mode. */
  readonly home?: RoomHomeView;
}

/** A door that is not as it started: `i` is its index in the map's door list (`freshDoors`). */
export interface DoorView {
  readonly i: number;
  readonly open: boolean;
  readonly planks: number;
  readonly health: number;
}

export interface BossView {
  readonly id: BossId;
  readonly health: number;
  readonly maxHealth: number;
}

export interface DropView {
  readonly x: number;
  readonly y: number;
  readonly landed: boolean;
}

export interface WelcomePacket {
  readonly type: 'welcome';
  readonly yourId: EntityId;
  readonly tickRate: number;
  /** generateWorldMap(mapSeed, level) rebuilds the town being played when this client joined. */
  readonly mapSeed: number;
  /** The level of that town, which picks its biome. Left off, level 1. */
  readonly level?: number;
  /** Home only: the camp's size past the smallest, so a guest builds the camp the room plays. Left off, the smallest. */
  readonly campSize?: number;
  /** What the room is played on: a guest plays the first player's choice, not their own. */
  readonly difficulty?: DifficultyId;
  /** This join took back a body the room was still holding. Left off for a new one. */
  readonly resumed?: boolean;
  /** Test Drive: every car prop on this map can be driven. Left off for a normal run. */
  readonly testDrive?: boolean;
  /** townPrint of the host's town. A guest whose own build lays that town out differently leaves. */
  readonly town?: number;
}

/**
 * What the room plays, or null for an empty one that the next join decides. Sent on connection, so a client
 * knows what to bring before it joins, and again to a join that named another style, which the room did not take.
 */
export interface RoomPacket {
  readonly type: 'room';
  readonly style: GameStyle | null;
}

/**
 * Bumped by any change to a packet. A host closes a join from another version with 4014.
 * 3: the welcome carries the town's print, and towns laid out on 2026-11-08 no longer match version 2's.
 * 4: the fireworks bus parks in the downtown car park, and container_opened can say how many fireworks were taken.
 * 5: the bunker's merchants walk it (snapshot `merchants`, events `merchant_hurt` and `merchant_downed`), and its stalls have no counters.
 * 6: home is an outdoor camp in a fence, with tents, of five sizes (welcome and snapshot `campSize`); version 5 would build the indoor bunker.
 * 7: the people to rescue (snapshot `merchants` entries carry `rescue` in a town, join `rescued`, `radio`, receipt `rescued` and `radioLevels`).
 */
export const PROTOCOL_VERSION = 7;

/**
 * Sent just before a link is closed on purpose, because a data channel has no close code.
 * Over a socket the same pair also rides the close frame.
 */
export interface ByePacket {
  readonly type: 'bye';
  readonly code: number;
  readonly reason: string;
}

export interface LobbySeat {
  readonly skin: number;
  readonly name: string;
  readonly ready: boolean;
  readonly isHost: boolean;
}

export interface LobbyStatePacket {
  readonly type: 'lobby_state';
  readonly seats: readonly LobbySeat[];
  readonly countdown: number | null;
  readonly autoStartTimer: boolean;
  readonly launched: boolean;
}

export type ServerPacket =
  | RoomPacket
  | WelcomePacket
  | SnapshotPacket
  | ByePacket
  | LobbyStatePacket
  | { readonly type: 'player_disconnected'; readonly playerId: EntityId };

export type ClientPacket =
  /** The difficulty is read from the first player into an empty room and ignored from everyone after. The style must be the room's; an empty room takes it, and left off it is Arcade. The protocol is the sender's PROTOCOL_VERSION; only a LAN server takes a join without one. */
  | { readonly type: 'join'; readonly name: string; readonly token: string; readonly difficulty?: DifficultyId; readonly character?: number; readonly home?: JoinHome; readonly style?: GameStyle; readonly protocol?: number }
  | { readonly type: 'input'; readonly input: ClientInputPacket }
  | { readonly type: 'bench'; readonly action: BenchAction }
  /** The bag closed: where everything now sits and what was dropped. One per close. */
  | { readonly type: 'bag'; readonly commit: BagCommit }
  | { readonly type: 'home'; readonly action: HomeAction }
  | { readonly type: 'emote'; readonly emote: EmoteId }
  | { readonly type: 'restart' }
  | { readonly type: 'boon'; readonly count: number }
  | { readonly type: 'lobby_ready'; readonly ready?: boolean }
  | { readonly type: 'lobby_start' }
  | { readonly type: 'lobby_toggle_timer'; readonly enabled?: boolean };
