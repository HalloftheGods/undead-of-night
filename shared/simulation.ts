import { updateMerchants } from "./merchant-fight.ts";
import { freeCharacter } from "./characters.ts";
import { updateBullets } from "./combat.ts";
import { PLAYER_RADIUS, SPAWN_SCATTER, TICK_DT } from "./constants.ts";
import { isEmoteId, takeEmote } from "./emotes.ts";
import type { DifficultyId } from "./difficulty.ts";
import { moveToNextTown } from "./level-change.ts";
import { isBunkerMap } from "./home-protocol.ts";
import type { HomeAction, JoinHome } from "./home-protocol.ts";
import { exitBoarded } from "./level-exit.ts";
import { FIRST_LEVEL } from "./levels.ts";
import { eatCandyDirect, type CandyId } from "./candy.ts";
import { giveReturnKit, updateDownedPlayers } from "./player-health.ts";
import { reclaimDeparted, reclaimLive, rememberDeparted, createPlayer } from "./player-roster.ts";
import type { Arrival } from "./player-roster.ts";
import { updateOverrun } from "./overrun.ts";
import { updatePickups } from "./pickups.ts";
import { receiveInput, updatePlayer } from "./players.ts";
import type {
  ClientInputPacket,
  GamePhase,
  PlayerEntity,
  SnapshotPacket,
  WorldMap
} from "./protocol.ts";
import { checkGameOver, leaveTown, restartRun } from "./run-end.ts";
import { createSimState } from "./sim-factory.ts";
import type { SimulationOptions } from "./sim-factory.ts";
import type { PlayerState, SimState } from "./sim-state.ts";
import { emit, openGroundNear } from "./sim-state.ts";
import { buildSnapshot, playerSnapshot } from "./snapshot-build.ts";
import { updatePopulation } from "./town-population.ts";
import { enterHome, homeCommand } from "./trip.ts";
import { diedOnLeaving } from "./overrun-fight.ts";
import { arriveInRoom, keepsBodyOnLeaving, leaveRoom, updateLeftBodies } from "./trip-roster.ts";
import { updateWaves } from "./waves.ts";
import { updateZombieStatuses } from "./zombie-burn.ts";
import { updateSpinners } from "./throwables.ts";
import { updateSupplyDrop } from "./supply-drop.ts";
import { updateBosses } from "./bosses.ts";
import { applyBagCommit, reconcileBag } from "./bag-sim.ts";
import { usePocketSupplies } from "./supplies.ts";
import type { BagCommit } from "./bag.ts";
import { benchCommand, updateBench } from "./workbench.ts";
import type { BenchAction, WorkbenchMode } from "./workbench.ts";
import { ageFootprints } from "./snow-tracks.ts";
import { noteEntered } from "./leftovers.ts";
import { giveStreakKit } from "./streak-kit.ts";
import { updateDoors } from "./doors.ts";
import { updateVehicles } from "./vehicle-driving.ts";
import { ejectOccupant } from "./vehicles.ts";
import { rebuildZombieGrid, removeDeadZombies, updateZombies } from "./zombies.ts";

export type { SimulationOptions } from "./sim-factory.ts";

/**
 * The authoritative game. The Node server and solo mode both drive this; time
 * comes only from step() and randomness only from the seeded RNG, so a run is
 * reproducible from its seed and its inputs.
 */
export class GameSimulation {
  private sim: SimState;

  /** Kept apart from the sim, which an Arcade room built without home cannot carry it in. */
  private readonly overrun: boolean;

  constructor(options: SimulationOptions) {
    this.sim = createSimState(options);
    this.overrun = options.overrun === true;
  }

  /** The town being played, which changes with the level. */
  get map(): WorldMap {
    return this.sim.map;
  }

  get playerCount(): number {
    return this.sim.players.length;
  }

  get phase(): GamePhase {
    return this.sim.phase;
  }

  get level(): number {
    return this.sim.level;
  }

  /** A Test Drive run, which a room tells everyone who joins it. */
  get testDrive(): boolean {
    return this.sim.testDrive;
  }

  get difficulty(): DifficultyId {
    return this.sim.difficulty;
  }

  /** Only an empty room can change it, and it takes a fresh start so the town is stocked and peopled for it. */
  setDifficulty(difficulty: DifficultyId): void {
    const sim = this.sim;
    const roomInUse = sim.players.length > 0;
    const unchanged = sim.difficulty === difficulty;
    const isLocked = roomInUse || unchanged;
    if (isLocked) return;
    sim.difficulty = difficulty;
    this.restart();
  }

  /** This room is played from the bunker, in trips, rather than as one run through the towns. */
  get playsHome(): boolean {
    return this.sim.homeRun !== null;
  }

  /** Only an empty room can change it, and it takes a new start: the bunker, or level 1's town. The rolls carry on. */
  setHome(home: boolean): void {
    const { players, homeRun, runSeed, difficulty, rng, workbench } = this.sim;
    const roomInUse = players.length > 0;
    const unchanged = (homeRun !== null) === home;
    const isLocked = roomInUse || unchanged;
    if (isLocked) return;
    this.sim = createSimState({
      seed: runSeed,
      random: rng,
      difficulty,
      workbench,
      home,
      overrun: this.overrun
    });
  }

  /** Prepares a solo run's local player for migration to a hosted co-op room. */
  bindLocalPlayerToken(token: string): boolean {
    const local = this.sim.players.find((p) => p.id === "local");
    if (!local) return false;
    (local as { token: string | null }).token = token;
    (this.sim as { workbench: WorkbenchMode }).workbench = "timed";
    return true;
  }

  /** Near a living teammate if there is one, otherwise at the map spawn. */
  private entryPoint(): { x: number; y: number } {
    const sim = this.sim;
    const friend = sim.players.find((p) => p.status === "alive");
    const home = friend ?? this.map.spawn;
    return openGroundNear(sim, home.x, home.y, 8, SPAWN_SCATTER, PLAYER_RADIUS + 1);
  }

  /** A newcomer, armed for how far the run has got. People gathering in the lead-in all start equal. */
  private newcomer(arrival: Arrival, home?: JoinHome): PlayerState {
    const player = createPlayer(arrival, this.entryPoint());
    const runUnderway = !this.sim.homeRun && (this.sim.wave > 0 || this.sim.level > FIRST_LEVEL);
    if (runUnderway) giveReturnKit(player);
    enterHome(this.sim, player, home);
    return player;
  }

  /** A token that left this run earlier picks up where it stopped; anyone else is a newcomer. */
  addPlayer(
    id: string,
    name: string,
    token: string | null = null,
    character?: number,
    home?: JoinHome
  ): PlayerEntity {
    const existing = this.sim.players.find((p) => p.id === id);
    if (existing) return playerSnapshot(existing);

    const taken = new Set(this.sim.players.map((p) => p.skin));
    const skin = freeCharacter(taken, character);
    // A public room sends no callsign: the name stays '' and whoever draws the player labels it by skin (shared/callsign.ts).
    const arrival: Arrival = { id, name, token, skin };
    const live = reclaimLive(this.sim, arrival);
    if (live) {
      arriveInRoom(this.sim, live);
      return playerSnapshot(live);
    }
    const player = reclaimDeparted(this.sim, arrival) ?? this.newcomer(arrival, home);
    this.sim.players.push(player);
    arriveInRoom(this.sim, player);
    return playerSnapshot(player);
  }

  /** The id now playing under a token, if any. */
  playerWithToken(token: string): string | null {
    return this.sim.players.find((p) => p.token === token)?.id ?? null;
  }

  /** The room still holds a body for this token, in play or left behind, so a join under it would take that body back. */
  hasBodyFor(token: string): boolean {
    return this.playerWithToken(token) !== null || this.sim.departed.has(token);
  }

  removePlayer(id: string): void {
    const sim = this.sim;
    const leaving = sim.players.find((p) => p.id === id);
    const keptForTheTrip = leaving !== undefined && keepsBodyOnLeaving(sim, leaving);
    if (leaving) ejectOccupant(sim, leaving);
    const leavesBodyBehind = leaving && keptForTheTrip;
    if (leavesBodyBehind) {
      diedOnLeaving(sim, leaving);
      rememberDeparted(sim, leaving);
    }
    sim.players = sim.players.filter((p) => p.id !== id);
    if (leaving) leaveRoom(sim, leaving);

    const wasRunning = sim.phase !== "gameover";
    checkGameOver(sim);
    // step() is frozen from here, so this frame takes a tick of its own or clients would read it as the last one.
    const endedJustNow = wasRunning && sim.phase === "gameover";
    if (endedJustNow) sim.tick += 1;
  }

  setInput(id: string, input: ClientInputPacket): void {
    const player = this.sim.players.find((p) => p.id === id);
    if (player) receiveInput(player, input);
  }

  /** The bag closed on this player's end: see `applyBagCommit`. */
  bagCommand(id: string, commit: BagCommit): void {
    const player = this.sim.players.find((p) => p.id === id);
    if (player) applyBagCommit(this.sim, player, commit);
  }

  benchCommand(id: string, action: BenchAction): void {
    const player = this.sim.players.find((p) => p.id === id);
    if (player) benchCommand(this.sim, player, action);
  }

  /** An icon from a player, passed on to every client as an event. Over the pace, or not an emote, it is dropped. */
  /** Solo only: the streak kit for this night of the player's Nightly Run streak, on top of what the run gave. */
  giveStreakKit(id: string, night: number): void {
    const player = this.sim.players.find((p) => p.id === id);
    if (player) giveStreakKit(player, night);
  }

  /** Directly awards a level-up boon buff to the player. */
  giveBoon(id: string, candy: CandyId): void {
    const player = this.sim.players.find((p) => p.id === id);
    const canReceive = player !== undefined && player.status === "alive";
    if (canReceive) eatCandyDirect(this.sim, player, candy);
  }

  emote(id: string, emote: unknown): void {
    const player = this.sim.players.find((p) => p.id === id);
    const allowed =
      player !== undefined && isEmoteId(emote) && takeEmote(player, this.sim.tick * TICK_DT);
    if (allowed) emit(this.sim, { type: "emote", playerId: id, emote });
  }

  homeCommand(id: string, action: HomeAction): void {
    const player = this.sim.players.find((p) => p.id === id);
    if (player) homeCommand(this.sim, player, action);
  }

  /** Advances one tick of TICK_DT. Does nothing with an empty room or after game over. */
  step(): void {
    const sim = this.sim;
    const frozen = sim.phase === "gameover" || sim.players.length === 0;
    if (frozen) return;

    sim.tick += 1;
    if (sim.bench) {
      const vanLeaves = updateBench(sim);
      if (vanLeaves) moveToNextTown(sim);
      return;
    }
    rebuildZombieGrid(sim);
    for (const p of sim.players) updatePlayer(sim, p);
    updateDoors(sim, TICK_DT);
    noteEntered(sim);
    ageFootprints(sim);
    updateSpinners(sim);
    updateMerchants(sim);
    updateBullets(sim);
    updateZombieStatuses(sim);
    updateZombies(sim);
    removeDeadZombies(sim);
    updatePickups(sim);
    for (const p of sim.players) usePocketSupplies(p);
    for (const p of sim.players) reconcileBag(sim, p);
    updateDownedPlayers(sim);
    updateVehicles(sim);
    updateLeftBodies(sim);
    // Before the waves: a horde starting on this tick must not hand the fallen their return.
    checkGameOver(sim);
    const isGameOver = sim.phase === "gameover";
    if (isGameOver) return;
    const leaving = exitBoarded(sim);
    if (leaving) {
      leaveTown(sim);
      return;
    }
    const inTown = !isBunkerMap(sim.map);
    if (inTown) {
      updateWaves(sim);
      updatePopulation(sim);
      updateSupplyDrop(sim);
      updateBosses(sim);
    } else {
      updateOverrun(sim);
    }
  }

  /** Starts a new run with everyone still connected, from level 1 unless told otherwise. */
  restart(fromLevel?: number): void {
    restartRun(this.sim, fromLevel);
  }

  /** A detached, JSON-safe view of the world. Drains the event queue. */
  snapshot(): SnapshotPacket {
    return buildSnapshot(this.sim);
  }
}
