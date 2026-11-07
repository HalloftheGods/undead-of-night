import type { SugarState } from './candy.ts';
import type { SupplyDrop } from './supply-drop.ts';
import type { BossState } from './bosses.ts';
import type { KillChain } from './kill-chain.ts';
import type { FireState, FlareState } from './throwables.ts';
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
  WeaponId,
  WorldMap,
  ZombieEntity,
  ZombieType,
} from './protocol.ts';
import type { ContainerState } from './containers.ts';
import type { FlowField, Point } from './flow-field.ts';
import type { HomeView, Jewels, OverrunPhase, OverrunReceipt, TripReceipt } from './home-protocol.ts';
import { randRange } from './rng.ts';
import type { Rng } from './rng.ts';
import type { SpatialHashGrid } from './spatial-grid.ts';
import { buildingAt, circleHitsSolid, isBlockedAt } from './world-query.ts';
import type { GunQuirk, PartCounts } from './gun-upgrade-data.ts';
import type { GunFit } from './gun-upgrades.ts';
import type { KitCounts } from './round-effect-data.ts';
import type { BenchState, WorkbenchMode } from './workbench.ts';
import type { ZombieStatus } from './zombie-status.ts';
import type { Footprint, ZombieTrail } from './town-rules.ts';

/** Rounds in the gun itself. Spare rounds live in PlayerEntity.ammoBag, gun or no gun. */
export interface GunState {
  ammo: number;
  /** Quirk and upgrades, absent on a stock gun. Goes when the gun does. */
  fit?: GunFit;
}

/** What the sim holds for one player in a home room: what they see, and what stays on this side of the wire. */
export interface PlayerHome extends Omit<HomeView, 'overrun' | 'chest'> {
  /** The last overrun's receipt, until the next arrival in the bunker. The sim always has a word here; only an older wire leaves it off. */
  overrun: OverrunReceipt | null;
  /** The furthest level they have reached, as they said when they joined, and raised by the van. */
  highest: number;
  /** Has cleared the last level, as they said when they joined or since, so the ending is behind them. */
  finished: boolean;
  /** What `dropCarried` took off them on this trip, for a died receipt, since their carried treasure is gone by then. */
  lost: { silver: number; jewels: Jewels };
  /** A held overrun's reward chest is waiting unopened. Only its owner's view of the snapshot carries it, so the chest is drawn for them alone. */
  chest: boolean;
  /** When they last pressed a key or had a station open. */
  lastActiveTick: number;
  /** When a body out on a trip lost its player, while its carried treasure waits out the grace period. Null otherwise. */
  leftTick: number | null;
}

/** Magazines live in `guns` and are read out for snapshots, so there is one copy of the count. */
export interface PlayerState extends Omit<PlayerEntity, 'mags' | 'gear' | 'bottles' | 'fuel' | 'flares' | 'home' | 'candy' | 'sugar' | 'keepsakes' | 'keepsakeOffer'> {
  bottles: number;
  /** Fuel for molotovs and flares to throw, found in town and left there (`shared/throwables.ts`). */
  fuel: number;
  flares: number;
  /** Null outside home mode. */
  home: PlayerHome | null;
  /** A throw asked for and not yet made. */
  throwQueued: boolean;
  molotovQueued: boolean;
  flareQueued: boolean;
  throwCooldown: number;
  /** Candy carried, oldest first, and candy working now (`shared/candy.ts`). */
  candy: CandyId[];
  sugar: SugarState[];
  eatQueued: boolean;
  /** Kept for the run, and the three on offer while the choice is open (`shared/keepsakes.ts`). */
  keepsakes: KeepsakeId[];
  keepsakeOffer: KeepsakeId[] | null;
  keepsakeQueued: KeepsakeId | null;
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
  /** Treasure's own id counter, kept off `entityId()`. */
  nextTreasure: number;
  /** The serial the next receipt takes, from 1, for the whole room. No reset or restart puts it back, so `${simId}:${serial}` never repeats. */
  nextReceipt: number;
  /** Banked receipts the trip's start would have wiped before their player applied them, by reconnect token. They go back on the body that returns. */
  unclaimed: Map<string, TripReceipt>;
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
  /** The horde still to come through the door, kept apart from a town's `spawnQueue`. */
  queue: ZombieType[];
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
  /** Pools of molotov fire and lit flares, burning down. */
  fires: FireState[];
  flares: FlareState[];
  /** This town's supply drop, from arming to the end of its marked time. */
  drop: SupplyDrop | null;
  /** The town has had its drop, or tried to and found no ground for it. */
  dropDone: boolean;
  players: PlayerState[];
  /** Who left this run, by reconnect token, as they stood when they went. */
  departed: Map<string, PlayerState>;
  zombies: ZombieState[];
  bullets: BulletState[];
  pickups: PickupState[];
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
  /** The bunker runs a horde clock. Off unless asked for. */
  readonly overrunOn: boolean;
  /** Null with the overrun off, on a first visit, out on a trip, and from its end to the next arrival. */
  overrun: OverrunState | null;
}

export function entityId(sim: SimState, prefix: string): EntityId {
  sim.nextEntity += 1;
  return `${prefix}${sim.nextEntity}`;
}

export function emit(sim: SimState, event: GameEvent): void {
  sim.events.push(event);
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
