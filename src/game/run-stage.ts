import { difficultyDef } from '../../shared/difficulty.ts';
import type { DifficultyId } from '../../shared/difficulty.ts';
import { isBunkerSeed } from '../../shared/home-protocol.ts';
import { levelDef } from '../../shared/levels.ts';
import { nightEventFor } from '../../shared/night-events.ts';
import type { SnapshotPacket, WorldMap } from '../../shared/protocol.ts';
import { readCampSize } from '../../shared/camp/camp-ring.ts';
import { fallenOf, settleFence } from '../../shared/camp/fence-fall.ts';
import type { CampSize } from '../../shared/camp/camp-ring.ts';
import { generateWorldMap } from '../../shared/world-map.ts';
import type { WorldRenderer } from '../engine/world-renderer.ts';
import type { ClientWorld } from './client-world.ts';
import { liftFor } from './display-prefs.ts';
import type { RunHud } from './run-hud.ts';
import { noteStageCut } from './stage-cut.ts';

/** The town and level this client has built, kept in step with what the sim says it is playing. */
export class RunStage {
  private readonly hud: RunHud;
  private readonly renderer: () => WorldRenderer | null;
  private mapSeed: number | null = null;
  private campSize: CampSize = 1;
  private level: number | null = null;
  private drained = false;
  private powered = false;
  /** What the run is played on, which sets how lit the town is. Null outside a run. */
  private difficulty: DifficultyId | null = null;

  constructor(hud: RunHud, renderer: () => WorldRenderer | null) {
    this.hud = hud;
    this.renderer = renderer;
  }

  /** The run's difficulty from the welcome: its light and its Horde Mode blackout, applied to the town now showing. */
  setDifficulty(difficulty: DifficultyId | null): void {
    this.difficulty = difficulty;
    this.applyLook();
  }

  /** Lights the town for the run's difficulty, or the Brightness setting outside a run. */
  applyLook(): void {
    const renderer = this.renderer();
    renderer?.setBrightness(liftFor(this.difficulty));
    renderer?.setEerie(this.difficulty !== null && difficultyDef(this.difficulty).eerie);
  }

  /** Builds a town, or the camp at its size, for all that draws it. Its level comes with the next snapshot. */
  open(mapSeed: number, level = 1, campSize: CampSize = 1): WorldMap {
    const map = generateWorldMap(mapSeed, level, campSize);
    this.mapSeed = mapSeed;
    this.campSize = campSize;
    this.level = null;
    this.drained = false;
    this.powered = false;
    this.hud.setMap(map);
    this.renderer()?.setMap(map);
    noteStageCut(isBunkerSeed(mapSeed));
    return map;
  }

  /** A new run can start in the very town the last one ended in, and it still gets its title card. */
  rewind(): void {
    this.level = null;
    this.drained = false;
    this.powered = false;
  }

  /** Runs ahead of the snapshot's events, which already belong to the town it describes. */
  follow(world: ClientWorld, snapshot: SnapshotPacket, nowMs: number): void {
    const campSize = readCampSize(snapshot.campSize);
    // A camp that grew on this arrival is a new map too, raised behind the van like a town.
    const newTown = snapshot.mapSeed !== this.mapSeed || campSize !== this.campSize;
    if (newTown) world.enterTown(this.open(snapshot.mapSeed, snapshot.level, campSize));
    // The fence's fallen sections, lifted out of this copy's collision as the room's sim lifts them out of its own.
    settleFence(world.worldMap, fallenOf(snapshot.home?.overrun));
    const hasDrained = snapshot.drained === true || snapshot.events?.some((e) => e.type === 'city_drained') === true;
    if (hasDrained && !this.drained) {
      this.drained = true;
      this.renderer()?.setTheme(levelDef(snapshot.level).theme, nightEventFor(snapshot.mapSeed, snapshot.level)?.id ?? null, this.drained, this.powered);
    }
    const hasPowered = snapshot.powered === true || snapshot.events?.some((e) => e.type === 'power_restored') === true;
    if (hasPowered && !this.powered) {
      this.powered = true;
      this.renderer()?.setTheme(levelDef(snapshot.level).theme, nightEventFor(snapshot.mapSeed, snapshot.level)?.id ?? null, this.drained, this.powered);
    }
    const sameLevel = snapshot.level === this.level;
    if (sameLevel) return;
    this.level = snapshot.level;
    const home = isBunkerSeed(snapshot.mapSeed);
    if (home) {
      this.renderer()?.setTheme('bunker');
      this.applyLook();
      this.hud.clearNotices();
      return;
    }
    this.renderer()?.setTheme(levelDef(snapshot.level).theme, nightEventFor(snapshot.mapSeed, snapshot.level)?.id ?? null, this.drained, this.powered);
    this.applyLook();
    this.hud.showLevel(snapshot.level, nowMs, snapshot.mapSeed);
  }
}
