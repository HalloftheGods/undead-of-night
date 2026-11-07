import { candySpeed } from '../../shared/candy.ts';
import { PLAYER_RADIUS, PLAYER_SPEED, TICK_DT } from '../../shared/constants.ts';
import { containerInReach } from '../../shared/containers.ts';
import type { Container } from '../../shared/containers.ts';
import { isBunkerMap } from '../../shared/home-protocol.ts';
import type { OverrunPhase, StationId } from '../../shared/home-protocol.ts';
import { stepMovement } from '../../shared/movement.ts';
import { playerSpeed } from '../../shared/players.ts';
import { effectiveStance } from '../../shared/stamina.ts';
import { openableStation } from '../../shared/stations.ts';
import { flightAt } from '../../shared/storeys.ts';
import { groundSpeedScale } from '../../shared/town-rules.ts';
import type { EntityId, PlayerEntity, PropInstance, SnapshotPacket, Stance, WorldMap } from '../../shared/protocol.ts';
import { buildingAt, circleHitsSolid } from '../../shared/world-query.ts';
import type { SceneView } from '../engine/scene.ts';
import { LocalPredictor } from './prediction.ts';
import { extrapolateBullets, interpolatePlayers, interpolateZombies, SnapshotBuffer } from './snapshot-buffer.ts';

const MAX_BULLET_LEAD_SEC = 0.1;

/** Where the stairs the local player stands on lead, by the sim's own rule: anyone on their feet takes them with the search key. */
function stairsFor(map: WorldMap, player: PlayerEntity | null): { stairs?: string } {
  const standing = player !== null && player.status === 'alive';
  const flight = standing ? flightAt(map, player.x, player.y) : null;
  return flight ? { stairs: flight.label } : {};
}

export type WorldEntities = Pick<
  SceneView,
  'players' | 'zombies' | 'bullets' | 'pickups' | 'exit' | 'drop' | 'openedContainers' | 'tracks' | 'searchable' | 'stairs' | 'station' | 'overrun' | 'localId' | 'viewerId' | 'focusX' | 'focusY' | 'phase' | 'hostiles'
>;

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
      (x, y, dirX, dirY, dt) => stepMovement(this.map, x, y, dirX, dirY, this.speed * groundSpeedScale(this.level, this.map, x, y), dt, PLAYER_RADIUS),
      TICK_DT,
      (x, y) => circleHitsSolid(this.map, x, y, PLAYER_RADIUS),
    );
  }

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
    this.buffer.clear();
    this.predicting = false;
  }

  /** The run moved on. Nothing from the last town can be blended with, or predicted against, this one. */
  enterTown(map: WorldMap): void {
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
    this.sugarSpeed = candySpeed({ sugar: (local?.sugar ?? []).map((sugar) => ({ ...sugar })) });
    this.refreshSpeed();
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
  private searchableBy(player: PlayerEntity | null, opened: readonly number[]): Container | null {
    const free = player !== null && player.status === 'alive' && player.search === 0;
    return free ? containerInReach(this.map, player.x, player.y, (id) => opened.includes(id)) : null;
  }

  /** The bunker station the local player could open from where they stand, by the sim's own rule: none once one is open, or anywhere but the bunker. */
  private stationBy(player: PlayerEntity | null, phase: OverrunPhase | undefined): StationId | undefined {
    const free = player !== null && player.status === 'alive' && !player.home?.station && isBunkerMap(this.map);
    return free ? openableStation(this.map, player.x, player.y, player.home?.chest === true, phase)?.id : undefined;
  }

  /** The props standing in the bunker, which hold its stalls; none anywhere else. */
  bunkerProps(): readonly PropInstance[] {
    return isBunkerMap(this.map) ? this.map.props : [];
  }

  /** Advances prediction by dt and returns this frame's entities, or null before any snapshot. */
  advance(nowMs: number, delayMs: number, dirX: number, dirY: number, aim: number, dt: number): WorldEntities | null {
    const newest = this.buffer.latest;
    const sample = this.buffer.sample(nowMs, delayMs);
    const hasNoSample = !newest || !sample;
    if (hasNoSample) return null;

    const players = interpolatePlayers(sample);
    const local = newest.players.get(this.localId) ?? null;
    if (local) this.placeLocal(players, local, dirX, dirY, aim, dt, newest.snapshot.phase !== 'gameover');

    const shownLocal = players.find((player) => player.id === this.localId) ?? null;
    const viewer = shownLocal ? this.viewer(players, shownLocal) : players[0] ?? null;
    const lead = Math.min(MAX_BULLET_LEAD_SEC, Math.max(0, (nowMs - this.latestArrival) / 1000));
    const overrun = newest.snapshot.home?.overrun;
    const station = this.stationBy(shownLocal, overrun?.phase);
    return {
      players,
      zombies: interpolateZombies(sample),
      bullets: extrapolateBullets(newest.snapshot.bullets, lead),
      pickups: newest.snapshot.pickups,
      exit: newest.snapshot.exit,
      drop: newest.snapshot.drop ?? null,
      openedContainers: newest.snapshot.openedContainers,
      tracks: newest.snapshot.tracks ?? [],
      searchable: this.searchableBy(shownLocal, newest.snapshot.openedContainers),
      ...stairsFor(this.map, shownLocal),
      ...(station ? { station } : {}),
      ...(overrun ? { overrun } : {}),
      localId: this.localId,
      viewerId: viewer?.id ?? null,
      focusX: viewer?.x ?? 0,
      focusY: viewer?.y ?? 0,
      phase: newest.snapshot.phase,
      hostiles: newest.snapshot.hostiles,
    };
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
  ): void {
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
