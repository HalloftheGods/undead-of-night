import { candySpeed } from '../../shared/candy.ts';
import { PLAYER_RADIUS, PLAYER_SPEED, TICK_DT } from '../../shared/constants.ts';
import type { Container } from '../../shared/containers.ts';
import { isBunkerMap } from '../../shared/home-protocol.ts';
import type { OverrunPhase, StationId } from '../../shared/home-protocol.ts';
import { viewsBlockCircle } from '../../shared/doors.ts';
import { doorChoiceAt, placedDoors } from '../../shared/door-view.ts';
import type { PlacedDoor } from '../../shared/door-view.ts';
import { stepMovement } from '../../shared/movement.ts';
import { playerSpeed } from '../../shared/players.ts';
import { effectiveStance } from '../../shared/stamina.ts';
import { manholeFlightNear } from '../../shared/take-manhole.ts';
import { radioTowerNear } from '../../shared/radio-tower.ts';
import { openableStation } from '../../shared/stations.ts';
import { groundSpeedScale } from '../../shared/town-rules.ts';
import type { DoorView, EntityId, PlayerEntity, SnapshotPacket, Stance, WorldMap } from '../../shared/protocol.ts';
import { containerInReachOf, vehicleChoiceAt } from '../../shared/vehicle-choice.ts';
import type { VehicleMotion } from '../../shared/vehicle-physics.ts';
import type { VehicleView } from '../../shared/protocol.ts';
import { restoreSolids } from '../../shared/world-query.ts';
import { buildingAt, circleHitsSolid } from '../../shared/world-query.ts';
import type { SceneView } from '../engine/scene.ts';
import { ClientVehicles } from './client-vehicles.ts';
import { LocalPredictor } from './prediction.ts';
import { extrapolateBullets, interpolateMerchants, interpolatePlayers, interpolateZombies, SnapshotBuffer } from './snapshot-buffer.ts';
import type { SnapshotSample } from './snapshot-buffer.ts';

const MAX_BULLET_LEAD_SEC = 0.1;

export type WorldEntities = Pick<
  SceneView,
  'players' | 'zombies' | 'merchants' | 'bullets' | 'pickups' | 'exit' | 'drop' | 'openedContainers' | 'leftovers' | 'tracks' | 'vehicles' | 'vehicle' | 'searchable' | 'station' | 'climb' | 'doors' | 'door' | 'radioTower' | 'overrun' | 'localId' | 'viewerId' | 'focusX' | 'focusY' | 'phase' | 'hostiles'
>;

/** The bunker's merchants where they are drawn; left off anywhere without them. */
function merchantsField(sample: SnapshotSample): Pick<WorldEntities, 'merchants'> {
  const merchants = interpolateMerchants(sample);
  return merchants.length > 0 ? { merchants } : {};
}

/** What this client currently believes: buffered snapshots plus the predicted local player. */
export class ClientWorld {
  readonly localId: EntityId;
  readonly predictor: LocalPredictor;
  private map: WorldMap;
  private readonly buffer = new SnapshotBuffer(TICK_DT * 1000);
  private latestArrival = 0;
  private predicting = false;
  /** The local survivor's walking speed, which prediction has to match. */
  private speed = PLAYER_SPEED;
  private skin: number | null = null;
  /** The run's level, whose town may slow the walk. */
  private level = 1;
  /** From the keys held right now, ahead of the sim hearing about them. */
  private stance: Stance = 'walk';
  /** The sim says the local player is out of breath, so a held sprint key moves them at a walk. */
  private winded = false;
  /** What candy does to the local player's pace, read off the latest snapshot. */
  private sugarSpeed = 1;

  constructor(map: WorldMap, localId: EntityId) {
    this.localId = localId;
    this.map = map;
    this.predictor = new LocalPredictor(
      (x, y, dirX, dirY, dt) => stepMovement(this.map, x, y, dirX, dirY, this.speed * groundSpeedScale(this.level, this.map, x, y), dt, PLAYER_RADIUS, this.doorBlocks),
      TICK_DT,
      (x, y) => circleHitsSolid(this.map, x, y, PLAYER_RADIUS) || this.doorBlocks(x, y, PLAYER_RADIUS),
    );
  }

  /** The closed, boarded or damaged doors near the local player, as the latest snapshot lists them. For the renderer and HUD. */
  get doors(): readonly DoorView[] {
    return this.latest?.doors ?? [];
  }

  private readonly cars = new ClientVehicles({ map: () => this.map, doors: () => this.doors, level: () => this.level });
  /** The cars as drawn this frame, for what the search key can reach. */
  private shownCars: readonly VehicleView[] = [];

  /** The car the local player sits in, if any: for what a crash should shake. */
  get localVehicleId(): number | null {
    return this.localPlayer?.vehicle?.id ?? null;
  }

  /** The sim has been sent this input: walking and driving prediction both replay it until it is acknowledged. */
  recordInput(seq: number, dirX: number, dirY: number): void {
    this.predictor.record(seq, dirX, dirY);
    this.cars.record(seq, dirX, dirY);
  }

  private readonly doorBlocks = (x: number, y: number, r: number): boolean => viewsBlockCircle(this.map, this.doors, x, y, r);
  private doorViewsSeen: readonly DoorView[] | null = null;
  private doorsPlaced: readonly PlacedDoor[] = [];

  get latest(): SnapshotPacket | null {
    return this.buffer.latest?.snapshot ?? null;
  }

  /** The local player's entity as last reported by the sim. */
  get localPlayer(): PlayerEntity | null {
    return this.buffer.latest?.players.get(this.localId) ?? null;
  }

  /** The town being walked, for what is underfoot. */
  get worldMap(): WorldMap {
    return this.map;
  }

  /** A new run on the same connection. */
  restart(): void {
    this.cars.reset();
    this.buffer.clear();
    this.predicting = false;
  }

  /** The run moved on. Nothing from the last town can be blended with, or predicted against, this one. */
  enterTown(map: WorldMap): void {
    restoreSolids(this.map);
    this.map = map;
    this.restart();
  }

  push(snapshot: SnapshotPacket, nowMs: number): void {
    this.buffer.push(snapshot, nowMs);
    this.level = snapshot.level;
    this.latestArrival = nowMs;
    const local = this.localPlayer;
    if (local) this.skin = local.skin;
    this.winded = local?.winded === true;
    this.sugarSpeed = candySpeed({ sugar: (local?.sugar ?? []).map((sugar) => ({ ...sugar, total: sugar.total ?? sugar.left })) });
    this.refreshSpeed();
    this.cars.sync(snapshot, local);
    const isPredictingLocal = local?.status === 'alive' && this.predicting;
    if (isPredictingLocal) {
      this.predictor.reconcile(local.x, local.y, local.lastInputSeq);
    }
  }

  /** The stance the local player is holding, so prediction moves at the sim's pace. */
  setStance(stance: Stance): void {
    const unchanged = stance === this.stance;
    if (unchanged) return;
    this.stance = stance;
    this.refreshSpeed();
  }

  private refreshSpeed(): void {
    const known = this.skin !== null;
    if (known) this.speed = playerSpeed(this.skin as number, effectiveStance(this.stance, this.winded)) * this.sugarSpeed;
  }

  /** The player the camera should sit on: yourself, or a teammate once you are dead. */
  private viewer(players: readonly PlayerEntity[], local: PlayerEntity): PlayerEntity {
    const isLocalUp = local.status !== 'dead';
    if (isLocalUp) return local;
    return players.find((player) => player.status === 'alive')
      ?? players.find((player) => player.status === 'downed')
      ?? local;
  }

  /** What the local player could start searching: nothing while down, or already at it. */
  private searchableBy(player: PlayerEntity | null, _opened: readonly number[]): Container | null {
    const free = player !== null && player.status === 'alive' && player.search === 0 && player.vehicle === undefined;
    return free ? containerInReachOf(this.map, this.shownCars, player.x, player.y) : null;
  }

  /** The manhole or ladder the local player could climb from where they stand, by the sim's own range. */
  private climbBy(player: PlayerEntity | null): WorldEntities['climb'] {
    const free = player !== null && player.status === 'alive' && player.search === 0;
    const flight = free ? manholeFlightNear({ map: this.map }, player.x, player.y) : null;
    return flight ? { down: flight.down } : undefined;
  }

  /** The snapshot's doors placed on the map. The same array until the snapshot's list changes, so the renderer can tell at a glance. */
  private placedDoorsFor(views: readonly DoorView[]): readonly PlacedDoor[] {
    const isNewList = views !== this.doorViewsSeen;
    if (isNewList) {
      this.doorViewsSeen = views;
      this.doorsPlaced = placedDoors(this.map, views);
    }
    return this.doorsPlaced;
  }

  /** What the search key would do at the door the local player stands at, by the sim's own rules: nothing while searching, or with a container in reach. */
  private doorBy(player: PlayerEntity | null): WorldEntities['door'] {
    const busy = player === null || player.status !== 'alive' || player.search !== 0;
    if (busy) return undefined;
    const elsewhere = isBunkerMap(this.map) || containerInReachOf(this.map, this.shownCars, player.x, player.y) !== null;
    if (elsewhere) return undefined;
    return doorChoiceAt(this.map, this.doors, player.x, player.y, this.stance === 'sneak', player.materials) ?? undefined;
  }

  /** What the search key would do at a car, by the sim's own rule, and whether a boot there could be searched too. */
  private vehicleBy(player: PlayerEntity | null): WorldEntities['vehicle'] {
    const idle = player === null || player.status !== 'alive' || player.search !== 0;
    if (idle) return undefined;
    const choice = vehicleChoiceAt(this.map, this.shownCars, player.x, player.y, player);
    if (!choice) return undefined;
    return { kind: choice.kind, boot: containerInReachOf(this.map, this.shownCars, player.x, player.y) !== null };
  }

  /** The bunker station the local player could open from where they stand, by the sim's own rule: none once one is open, or anywhere but the bunker. */
  private stationBy(player: PlayerEntity | null, phase: OverrunPhase | undefined): StationId | undefined {
    const free = player !== null && player.status === 'alive' && !player.home?.station && isBunkerMap(this.map);
    const merchants = this.latest?.merchants ?? [];
    return free ? openableStation(this.map, player.x, player.y, player.home?.chest === true, phase, merchants)?.id : undefined;
  }

  /** The radio tower the local player is standing near, if any. */
  private radioTowerBy(player: PlayerEntity | null, phase: string | undefined): WorldEntities['radioTower'] {
    const free = player !== null && player.status === 'alive' && !isBunkerMap(this.map);
    if (!free) return undefined;
    const tower = radioTowerNear({ map: this.map }, player.x, player.y);
    if (!tower) return undefined;
    const canTrigger = phase === 'intermission';
    const local = this.buffer.latest?.players.get(this.localId);
    return { canTrigger, hold: local?.towerHold ?? 0 };
  }

  /** Advances prediction by dt and returns this frame's entities, or null before any snapshot. */
  advance(nowMs: number, delayMs: number, dirX: number, dirY: number, aim: number, dt: number): WorldEntities | null {
    const newest = this.buffer.latest;
    const sample = this.buffer.sample(nowMs, delayMs);
    const hasNoSample = !newest || !sample;
    if (hasNoSample) return null;

    const players = interpolatePlayers(sample);
    const local = newest.players.get(this.localId) ?? null;
    const running = newest.snapshot.phase !== 'gameover';
    const drivenPose = this.cars.drive(local, dirX, dirY, dt, running);
    const vehicles = this.cars.shown(sample);
    this.shownCars = vehicles;
    if (local) this.placeLocal(players, local, dirX, dirY, aim, dt, running, drivenPose);

    const shownLocal = players.find((player) => player.id === this.localId) ?? null;
    const viewer = shownLocal ? this.viewer(players, shownLocal) : players[0] ?? null;
    const lead = Math.min(MAX_BULLET_LEAD_SEC, Math.max(0, (nowMs - this.latestArrival) / 1000));
    const overrun = newest.snapshot.home?.overrun;
    const station = this.stationBy(shownLocal, overrun?.phase);
    const climb = this.climbBy(shownLocal);
    const door = this.doorBy(shownLocal);
    const doors = this.placedDoorsFor(this.doors);
    const radioTower = this.radioTowerBy(shownLocal, newest.snapshot.phase);
    const vehicle = this.vehicleBy(shownLocal);
    return {
      players,
      ...(vehicles.length > 0 ? { vehicles } : {}),
      ...(vehicle ? { vehicle } : {}),
      zombies: interpolateZombies(sample),
      ...merchantsField(sample),
      bullets: extrapolateBullets(newest.snapshot.bullets, lead),
      pickups: newest.snapshot.pickups,
      exit: newest.snapshot.exit,
      drop: newest.snapshot.drop ?? null,
      openedContainers: newest.snapshot.openedContainers,
      leftovers: newest.snapshot.leftovers ?? [],
      tracks: newest.snapshot.tracks ?? [],
      searchable: this.searchableBy(shownLocal, newest.snapshot.openedContainers),
      ...(station ? { station } : {}),
      ...(climb ? { climb } : {}),
      ...(door ? { door } : {}),
      ...(doors.length > 0 ? { doors } : {}),
      ...(radioTower ? { radioTower } : {}),
      ...(overrun ? { overrun } : {}),
      localId: this.localId,
      viewerId: viewer?.id ?? null,
      focusX: viewer?.x ?? 0,
      focusY: viewer?.y ?? 0,
      phase: newest.snapshot.phase,
      hostiles: newest.snapshot.hostiles,
    };
  }

  /** A seated survivor rides the car: the driver where prediction has it, a passenger where the delayed snapshot has them. Nobody walks. */
  private seat(players: PlayerEntity[], local: PlayerEntity, drivenPose: VehicleMotion | null): void {
    this.predicting = false;
    this.predictor.reset(local.x, local.y);
    const index = players.findIndex((player) => player.id === this.localId);
    const base = index >= 0 ? players[index] : local;
    const shown = drivenPose ? { ...base, ...local, x: drivenPose.x, y: drivenPose.y, indoors: null, moving: false } : { ...local, x: base.x, y: base.y };
    if (index >= 0) players[index] = shown;
    else players.push(shown);
  }

  /** Swaps the delayed local entity for the predicted one, with the freshest stats. */
  private placeLocal(
    players: PlayerEntity[],
    local: PlayerEntity,
    dirX: number,
    dirY: number,
    aim: number,
    dt: number,
    running: boolean,
    drivenPose: VehicleMotion | null,
  ): void {
    const isSeated = local.vehicle !== undefined;
    if (isSeated) {
      this.seat(players, local, drivenPose);
      return;
    }
    const canMove = local.status === 'alive' && running;
    if (canMove) {
      if (!this.predicting) this.predictor.reset(local.x, local.y);
      this.predicting = true;
      this.predictor.advance(dirX, dirY, dt);
    } else {
      this.predicting = false;
      this.predictor.reset(local.x, local.y);
    }
    const index = players.findIndex((player) => player.id === this.localId);
    const moving = canMove && (dirX !== 0 || dirY !== 0);
    const { x, y } = this.predictor;
    // The room opens for where the player is shown; the sim will not say so for a few ticks yet.
    const indoors = buildingAt(this.map, x, y)?.id ?? null;
    const shown = { ...local, x, y, indoors, angle: canMove ? aim : local.angle, moving };
    const isListed = index >= 0;
    if (isListed) players[index] = shown;
    else players.push(shown);
  }
}
