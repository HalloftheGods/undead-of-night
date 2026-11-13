import type { PlayerBag } from './bag.ts';
import type { CampSize } from './camp/camp-ring.ts';
import type { SugarState } from './candy.ts';
import type { BackpackTier } from './backpack.ts';
import type { SurvivalNeeds } from './survival-needs.ts';
import type { BarricadeOpening, FortificationInventory } from './fortifications.ts';
import type { SupplyDrop } from './supply-drop.ts';
import type { BossState } from './bosses.ts';
import type { KillChain } from './kill-chain.ts';
import type { SpinnerState, LureState } from './throwables.ts';
import type { DifficultyId } from './difficulty.ts';
import type {
  BulletEntity,
  CandyId,
  KeepsakeId,
  EntityId,
  GameEvent,
  GameOverStats,
  GamePhase,
  PickupEntity,
  PlayerEntity,
  Stance,
  VehicleSeat,
  WeaponId,
  WorldMap,
  ZombieEntity,
  ZombieType,
} from './protocol.ts';
import type { ContainerState } from './containers.ts';
import type { Supplies } from './supply-types.ts';
import type { FlowField, Point } from './flow-field.ts';
import type { HomeView, Jewels, MerchantId, OverrunPhase, OverrunReceipt, SalvageCounts, TripReceipt } from './home-protocol.ts';
import { randRange } from './rng.ts';
import type { Rng } from './rng.ts';
import type { SpatialHashGrid } from './spatial-grid.ts';
import type { MerchantState } from './bunker-merchants.ts';
import type { RescueeState } from './camp/rescuee.ts';
import { buildingAt, circleHitsSolid, isBlockedAt } from './world-query.ts';
import type { GunQuirk, PartCounts } from './gun-upgrade-data.ts';
import type { GunFit } from './gun-upgrades.ts';
import type { KitCounts } from './round-effect-data.ts';
import type { BenchState, WorkbenchMode } from './workbench.ts';
import type { ZombieStatus } from './zombie-status.ts';
import type { VehicleBody, VehicleFacing } from './vehicle-bodies.ts';
import type { Footprint, ZombieTrail } from './town-rules.ts';

/** Rounds in the gun itself. Spare rounds live in PlayerEntity.ammoBag, gun or no gun. */
export interface GunState {
  ammo: number;
  /** Quirk and upgrades, absent on a stock gun. Goes when the gun does. */
  fit?: GunFit;
}

/** What the sim holds for one player in a home room: what they see, and what stays on this side of the wire. */
export interface PlayerHome extends Omit<HomeView, 'overrun' | 'chest' | 'salvage' | 'radio'> {
  /** Carried on this trip, uncapped, as treasure is. */
  salvage: SalvageCounts;
  /** The last overrun's receipt, until the next arrival in the bunker. The sim always has a word here; only an older wire leaves it off. */
  overrun: OverrunReceipt | null;
  /** The furthest level they have reached, as they said when they joined, and raised by the van. */
  highest: number;
  /** Has cleared the last level, as they said when they joined or since, so the ending is behind them. */
  finished: boolean;
  /** Has a radio, as they said when they joined, so The Radio opens for them. */
  radio: boolean;
  /** Who they have rescued, as they said when they joined and since; the camp and their shops open from it. */
  rescued: MerchantId[];
  /** The level of each radio found while they were in the room, for their receipt. */
  radioLevels: number[];
  /** What `dropCarried` took off them on this trip, for a died receipt, since their carried treasure is gone by then. */
  lost: { silver: number; jewels: Jewels; salvage: SalvageCounts };
  /** A held overrun's reward chest is waiting unopened. Only its owner's view of the snapshot carries it, so the chest is drawn for them alone. */
  chest: boolean;
  /** When they last pressed a key or had a station open. */
  lastActiveTick: number;
  /** When a body out on a trip lost its player, while its carried treasure waits out the grace period. Null otherwise. */
  leftTick: number | null;
}

/** Magazines live in `guns` and are read out for snapshots, so there is one copy of the count. */
export interface PlayerState extends Omit<PlayerEntity, 'mags' | 'gear' | 'bottles' | 'fireworks' | 'fountains' | 'home' | 'candy' | 'sugar' | 'keepsakes' | 'keepsakeOffer' | 'vehicle'> {
  bottles: number;
  /** Spinners and fountains to light, found in town and left there (`shared/throwables.ts`). */
  fireworks: number;
  fountains: number;
  /** Null outside home mode. */
  home: PlayerHome | null;
  /** A throw asked for and not yet made. */
  throwQueued: boolean;
  spinnerQueued: boolean;
  fountainQueued: boolean;
  throwCooldown: number;
  /** Candy carried, oldest first, and candy working now (`shared/candy.ts`). The bag has no bottom. */
  candy: CandyId[];
  sugar: SugarState[];
  /** Candy picked out of the bag and not yet eaten, in the order picked. `true` is the first in the bag. */
  eatQueued: (true | CandyId)[];
  /** Kept for the run, and the three on offer while the choice is open (`shared/keepsakes.ts`). */
  keepsakes: KeepsakeId[];
  keepsakeOffer: KeepsakeId[] | null;
  keepsakeQueued: KeepsakeId | null;
  /** Where the carried things sit in the pack and pockets. The counters above say what is carried; this says where it is and what still fits. */
  inventory: PlayerBag;
  parts: PartCounts;
  kits: KitCounts;
  /** Said so at the current workbench. */
  benchReady: boolean;
  /** The pace of this player's emotes (shared/emotes.ts). */
  emoteTokens: number;
  emoteAt: number;
  /** Reconnect token, or null when nobody can come back as this player. Never sent to clients. */
  readonly token: string | null;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shoot: boolean;
  /** Where the crosshair last was in the drawn world, or null from a client that never said. */
  aim: Point | null;
  /** The crosshair is under a finger, which earns a little slack on heads. */
  touchAim: boolean;
  /** Latest seq seen by setInput, applied on the next tick. */
  queuedSeq: number;
  /** Latched by setInput until a tick consumes them, so a later packet cannot erase them. */
  reloadQueued: boolean;
  weaponQueued: WeaponId | null;
  meleeQueued: boolean;
  healQueued: boolean;
  /** A press seen since the last tick, so a tap between ticks still fires. */
  shootQueued: boolean;
  guns: Partial<Record<WeaponId, GunState>>;
  fireCooldown: number;
  dryFireCooldown: number;
  meleeCooldown: number;
  /** Seconds left on the current reload, 0 when not reloading. */
  reloadLeft: number;
  /** The search key is down. */
  searchHeld: boolean;
  /** This press of the key has done its work, or been cut off: nothing more until it is let go. */
  searchSpent: boolean;
  /** The stairs tile the player came out on, left alone until they step off it; -1 off the stairs. */
  stairsLanding: number;
  /** Container being searched, or null. */
  searchingId: number | null;
  searchLeft: number;
  /** Health at the last tick, so a hit shows up as a drop. */
  searchHealth: number;
  /** Sneaking, walking or sprinting, once a winded survivor's sprint is taken out. */
  stance: Stance;
  /** What the held keys ask for, before stamina has its say. */
  stanceWanted: Stance;
  /** Sprint stamina, 1 full to 0 empty. */
  stamina: number;
  /** Ran dry and cannot sprint until the bar is back past the re-arm mark. */
  winded: boolean;
  /** Seconds until the bar starts to refill. */
  staminaRest: number;
  /** Seconds until the next loud footstep while sprinting. */
  stepNoiseLeft: number;
  needs?: SurvivalNeeds;
  backpackTier?: BackpackTier;
  materials: FortificationInventory;
  /** Bandages and survival items carried to use later (`shared/supplies.ts`). Absent means none. */
  supplies?: Supplies;
  towerHold?: number;
  /** Seconds the search key has been held on a closed door this press (`shared/doors.ts`). */
  doorHold: number;
  /** Seconds the search key has been held this press with a car to get into in reach: a tap gets in, a hold searches. */
  vehicleHold: number;
  /** The car and seat this survivor sits in, or null on foot (`shared/vehicles.ts`). */
  vehicle: VehicleSeat | null;
  /** The horn key is held. */
  horn: boolean;
}

/** A car someone has got into: from then on it is its own body, and its map prop is out of collision. */
export interface VehicleState {
  /** The map prop it was parked as. */
  readonly id: number;
  readonly body: VehicleBody;
  /** Centre of the footprint. */
  x: number;
  y: number;
  heading: number;
  /** Signed px/s along the heading. 0 is at rest, when it is a solid. */
  speed: number;
  facing: VehicleFacing;
  /** Who sits where, seat 0 driving. As long as the body has seats. */
  seats: (EntityId | null)[];
  health: number;
  maxHealth: number;
  /** Seconds left on the horn's current blast. */
  hornLeft: number;
}

/** Unaware, walking to a noise, or after a player. */
export type ZombieMode = 'wander' | 'alert' | 'hunt';

export interface ZombieState extends ZombieEntity {
  radius: number;
  speed: number;
  damage: number;
  points: number;
  reach: number;
  windupSec: number;
  cooldownSec: number;
  windupLeft: number;
  recoveryLeft: number;
  cooldownLeft: number;
  knockX: number;
  knockY: number;
  /** Seconds until another shove can stagger it. */
  staggerImmuneLeft: number;
  /** Seconds left steering sideways off an obstacle, and to which side. */
  sidestepLeft: number;
  sidestepSide: number;
  mode: ZombieMode;
  /** Part of the current horde: hunts without needing to see anyone, and never sleeps. */
  horde: boolean;
  /** Seconds of alert or hunt left without fresh contact. */
  interestLeft: number;
  /** Seconds until the next wander decision, and the heading; a zero heading is standing still. */
  wanderLeft: number;
  wanderX: number;
  wanderY: number;
  /** Building an unaware zombie stays inside, or null outdoors. */
  home: string | null;
  /** Spreads sight checks over the ticks. */
  senseOffset: number;
  /** What rounds have left on it. Absent until one does. */
  status?: ZombieStatus;
  /** A screamer's seconds until it can call again. Absent until it first has. */
  screamLeft?: number;
  /** A boss's own clock and charge (`shared/bosses.ts`). Absent on everything else. */
  bossState?: BossState;
  /** The snow trail it is following. Absent unless it is tracking someone. */
  trail?: ZombieTrail;
  /** Seconds until it will take up a trail again after losing one. Absent until it has. */
  sniffRestLeft?: number;
}

export interface BulletState extends BulletEntity {
  damage: number;
  rangeLeft: number;
  /** Which pull of the trigger fired it: pellets of one blast share it. */
  volley?: string;
  /** The zombie whose head was under the crosshair when this was fired. */
  headTarget?: ZombieState | null;
  /** The body a piercing round has gone through. It only does that once. */
  passed?: ZombieState;
}

export interface PickupState extends PickupEntity {
  /** Seconds until it rots away; null for loot that stays until taken. */
  ttl: number | null;
  /** Rounds left in an ammo pickup, 0 for anything else. */
  rounds: number;
  /** What a found gun's last owner did to it. */
  quirk?: GunQuirk;
  /** Dropped by this player on purpose: they do not pick it back up until they have stepped off it. */
  leftBy?: string;
}

/** The van, once it has come. */
export interface ExitState {
  readonly x: number;
  readonly y: number;
  /** Seconds everyone on their feet has been at the van without a break. */
  hold: number;
}

/** The room's side of a home run. */
export interface HomeRun {
  /** Unique to this sim, not just its seed, so a save can tell its receipts from any other sim's. */
  simId: string;
  /** The level the room is out on, or null in the bunker. */
  tripLevel: number | null;
  /** The trip set out for a level below the room's highest. */
  tripReplay: boolean;
  pickedLevel: number | null;
  /** The room's trip serial, which makes each trip's town a fresh one. */
  attempt: number;
  roomHighest: number;
  /** `roomHighest` as it stood when the room last came home: what the camp's size and the breach go by until the next arrival. */
  campLevel: number;
  /** The camp's size for this visit, from `campLevel`. */
  campSize: CampSize;
  /** Who stands in this visit's camp, latched with its size. */
  campRescued: MerchantId[];
  /** Treasure's own id counter, kept off `entityId()`. */
  nextTreasure: number;
  /** The serial the next receipt takes, from 1, for the whole room. No reset or restart puts it back, so `${simId}:${serial}` never repeats. */
  nextReceipt: number;
  /** Banked receipts the trip's start would have wiped before their player applied them, by reconnect token. They go back on the body that returns. */
  unclaimed: Map<string, TripReceipt>;
  /** Track selected at the bunker's jukebox, or null for default bunker theme. */
  jukeboxTrack?: string | null;
}

/** The room's horde clock, from an arrival in the bunker to the horde killed or the room fallen. */
export interface OverrunState {
  phase: OverrunPhase;
  /** The clock's length in seconds at the start, from the run's difficulty. */
  spanSec: number;
  /** Seconds on the clock to the breach. */
  left: number;
  /** The clock ran at the menu rate on the last tick. */
  slowed: boolean;
  /** Warnings given so far, an index into `OVERRUN_WARNINGS`. */
  warned: number;
  /** The horde still to come through the fence, kept apart from a town's `spawnQueue`. */
  queue: ZombieType[];
  /** The fence sections that give, by their place in the ring: picked as the clock arms, empty before. */
  gaps: number[];
  /** Which gap the next zombie comes through, round-robin. */
  gapTurn: number;
  /** `sim.tick` when the clock armed, which times the sections' rattling. */
  armTick: number;
  spawnTimer: number;
  /** The breach's roster size, 0 before it. */
  total: number;
  /** Horde zombies killed since the breach. */
  kills: number;
  /** `sim.tick` at the arrival, for a receipt's seconds. */
  startTick: number;
}

export interface SimState {
  /** Every level's town follows from this. */
  readonly runSeed: number;
  /** Ammo, zombie speed and bite, horde size and lull length follow from this. */
  difficulty: DifficultyId;
  /** The current level's town. */
  map: WorldMap;
  readonly rng: Rng;
  /** Leads hunters to the players. */
  flow: FlowField;
  /** Leads alerted zombies to the latest gunfire. */
  noiseFlow: FlowField;
  readonly grid: SpatialHashGrid<ZombieState>;
  tick: number;
  runStartTick: number;
  phase: GamePhase;
  /** Level of the run, from 1. */
  level: number;
  /** Null until the level's last horde is survived. */
  exit: ExitState | null;
  /** Hordes survived in towns already left. */
  hordesBehind: number;
  /** Most recently started wave in this town, 0 before the first. */
  wave: number;
  intermissionLeft: number;
  /** Seconds until the current horde gives up. */
  hordeLeft: number;
  spawnQueue: ZombieType[];
  spawnTimer: number;
  /** Roaming zombies the town keeps topped up to. */
  populationTarget: number;
  topUpTimer: number;
  /** Noises since the noise field last refreshed. */
  noises: Point[];
  /** Footprints in a snowy town, oldest first. */
  tracks: Footprint[];
  /** Each survivor's kill chain, for the points it multiplies (`shared/kill-chain.ts`). */
  killChains: Map<EntityId, KillChain>;
  /** Each survivor's headshot streak (`shared/kill-chain.ts`). */
  headshotChains: Map<EntityId, KillChain>;
  /** Lit ground spinners, and the lures that hiss: fountains and the drop's flare. */
  spinners: SpinnerState[];
  lures: LureState[];
  /** This town's supply drop, from arming to the end of its marked time. */
  drop: SupplyDrop | null;
  /** The town has had its drop, or tried to and found no ground for it. */
  dropDone: boolean;
  players: PlayerState[];
  /** Who left this run, by reconnect token, as they stood when they went. */
  departed: Map<string, PlayerState>;
  zombies: ZombieState[];
  /** The bunker's merchants, walking it; none anywhere else (`shared/bunker-merchants.ts`). */
  merchants: MerchantState[];
  /** The people waiting in, or following through, this town. Empty anywhere but a home trip. */
  rescuees: RescueeState[];
  bullets: BulletState[];
  pickups: PickupState[];
  /** Town buildings, by ground floor, that any player has been inside: where the map marks supplies left behind. */
  entered: Set<string>;
  /** Buildings revealed by a map cache clue, mapped to the item type found. */
  clues: Map<string, string>;
  /** At the same index as the town's container list. */
  containers: ContainerState[];
  events: GameEvent[];
  gameOver: GameOverStats | null;
  nextEntity: number;
  readonly workbench: WorkbenchMode;
  /** Set while the run is held at the workbench. */
  bench: BenchState | null;
  /** Null outside home mode. */
  homeRun: HomeRun | null;
  /** Test Drive: every car prop drives and the exit van never comes. */
  readonly testDrive: boolean;
  /** The bunker runs a horde clock. Off unless asked for. */
  readonly overrunOn: boolean;
  /** Null with the overrun off, on a first visit, out on a trip, and from its end to the next arrival. */
  overrun: OverrunState | null;
  /** The map's doors, built the first time `updateDoors` runs for a map (`shared/doors.ts`). */
  doors?: BarricadeOpening[];
  /** Cars someone has got into this town, by map prop index (`shared/vehicles.ts`). */
  vehicles: Map<number, VehicleState>;
}

export function entityId(sim: SimState, prefix: string): EntityId {
  sim.nextEntity += 1;
  return `${prefix}${sim.nextEntity}`;
}

export function emit(sim: SimState, event: GameEvent): void {
  sim.events.push(event);
  if (event.type === 'pickup' && event.pickup === 'radio') noteRadioFound(sim);
}

/** A radio picked up is found by everyone in the room, and counts on their receipt even if they never reach the van. */
function noteRadioFound(sim: SimState): void {
  for (const p of sim.players) p.home?.radioLevels.push(sim.level);
}

export const alivePlayers = (sim: SimState): PlayerState[] => sim.players.filter((p) => p.status === 'alive');

/** Alive or downed, which is who keeps a run going. */
export const standingPlayers = (sim: SimState): PlayerState[] => sim.players.filter((p) => p.status !== 'dead');

/** This far from everyone and not in any building someone is standing in, a body can come or go unnoticed. */
export function hiddenFromEveryone(sim: SimState, spot: { x: number; y: number }, minDistance: number): boolean {
  const here = buildingAt(sim.map, spot.x, spot.y);
  return standingPlayers(sim).every((p) => {
    const farEnough = Math.hypot(p.x - spot.x, p.y - spot.y) >= minDistance;
    return farEnough && (here === null || p.indoors !== here.id);
  });
}

/** A random open spot in a ring around a point, or the point itself if the ring is all wall. */
export function openGroundNear(
  sim: SimState,
  x: number,
  y: number,
  minRadius: number,
  maxRadius: number,
  clearance: number,
): { x: number; y: number } {
  for (let attempt = 0; attempt < 24; attempt++) {
    const angle = sim.rng() * Math.PI * 2;
    const distance = randRange(sim.rng, minRadius, maxRadius);
    const px = x + Math.cos(angle) * distance;
    const py = y + Math.sin(angle) * distance;
    const onMap = px > clearance && py > clearance && px < sim.map.width - clearance && py < sim.map.height - clearance;
    const isOpenSpot = onMap && !isBlockedAt(sim.map, px, py) && !circleHitsSolid(sim.map, px, py, clearance);
    if (isOpenSpot) return { x: px, y: py };
  }
  return { x, y };
}
