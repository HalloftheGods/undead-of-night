import { isBunkerSeed } from '../../shared/home-protocol.ts';
import { levelDef } from '../../shared/levels.ts';
import { nightEventFor } from '../../shared/night-events.ts';
import type { SnapshotPacket, WorldMap } from '../../shared/protocol.ts';
import { readCampSize } from '../../shared/camp/camp-ring.ts';
import type { CampSize } from '../../shared/camp/camp-ring.ts';
import { generateWorldMap } from '../../shared/world-map.ts';
import type { WorldRenderer } from '../engine/world-renderer.ts';
import type { ClientWorld } from './client-world.ts';
import { brightnessLift } from './display-prefs.ts';
import type { RunHud } from './run-hud.ts';
import { noteStageCut } from './stage-cut.ts';

/** The town and level this client has built, kept in step with what the sim says it is playing. */
export class RunStage {
  private readonly hud: RunHud;
  private readonly renderer: () => WorldRenderer | null;
  private mapSeed: number | null = null;
  private campSize: CampSize = 1;
  private level: number | null = null;

  constructor(hud: RunHud, renderer: () => WorldRenderer | null) {
    this.hud = hud;
    this.renderer = renderer;
  }

  /** Builds a town, or the camp at its size, for all that draws it. Its level comes with the next snapshot. */
  open(mapSeed: number, level = 1, campSize: CampSize = 1): WorldMap {
    const map = generateWorldMap(mapSeed, level, campSize);
    this.mapSeed = mapSeed;
    this.campSize = campSize;
    this.level = null;
    this.hud.setMap(map);
    this.renderer()?.setMap(map);
    noteStageCut(isBunkerSeed(mapSeed));
    return map;
  }

  /** A new run can start in the very town the last one ended in, and it still gets its title card. */
  rewind(): void {
    this.level = null;
  }

  /** Runs ahead of the snapshot's events, which already belong to the town it describes. */
  follow(world: ClientWorld, snapshot: SnapshotPacket, nowMs: number): void {
    const campSize = readCampSize(snapshot.campSize);
    // A camp that grew on this arrival is a new map too, raised behind the van like a town.
    const newTown = snapshot.mapSeed !== this.mapSeed || campSize !== this.campSize;
    if (newTown) world.enterTown(this.open(snapshot.mapSeed, snapshot.level, campSize));
    const sameLevel = snapshot.level === this.level;
    if (sameLevel) return;
    this.level = snapshot.level;
    const home = isBunkerSeed(snapshot.mapSeed);
    if (home) {
      this.renderer()?.setTheme('bunker');
      this.renderer()?.setBrightness(brightnessLift());
      this.hud.clearNotices();
      return;
    }
    this.renderer()?.setTheme(levelDef(snapshot.level).theme, nightEventFor(snapshot.mapSeed, snapshot.level)?.id ?? null);
    this.renderer()?.setBrightness(brightnessLift());
    this.hud.showLevel(snapshot.level, nowMs, snapshot.mapSeed);
  }
}
