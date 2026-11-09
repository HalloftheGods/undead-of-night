// Which frame a survivor shows: standing, walking, firing or reloading on the spot or on the
// move, and the fall into the crawl or the death. Split from entity-renderer.ts, which draws it.

import { playerSpeed } from '../../shared/players.ts';
import type { PlayerEntity, PlayerStatus } from '../../shared/protocol.ts';
import { deathWith, movingFrame } from '../art/survivors/clips.ts';
import { FIRST_LYING_FRAME } from '../art/survivors/fallen.ts';
import { dirFromAngle } from '../art/types.ts';
import type { ArtBook, Clip, PixelSprite, SurvivorArt, SurvivorWeaponArt } from '../art/types.ts';
import { clipDuration, clipFrame, clipIndex, clipIndexAt, strideIndex } from './sprite-cache.ts';
import type { EntityVisual } from './visuals.ts';

/** What a survivor was before their status last changed, and the last frame they were drawn with. */
interface Fall {
  readonly from: PlayerStatus | null;
  readonly held: PixelSprite | null;
}

const NO_FALL: Fall = { from: null, held: null };

/** How someone on the rig stands this frame. */
export type Figure = Pick<PlayerEntity, 'angle' | 'moving' | 'status' | 'reload'>;
/** The clips someone on the rig falls through. */
type FallingArt = Pick<SurvivorArt, 'downed' | 'dead'>;

/** Seconds of the death clip already behind a survivor when their death is first shown. */
function deathLead(from: PlayerStatus | null, dead: Clip): number {
  const leads: Record<PlayerStatus, number> = { alive: 0, downed: FIRST_LYING_FRAME / dead.fps, dead: clipDuration(dead) };
  return from === null ? clipDuration(dead) : leads[from];
}

export class SurvivorFrames {
  private readonly art: ArtBook;
  /** Keyed on the visual, so a fall is forgotten when the visual store drops the survivor. */
  private readonly falls = new WeakMap<EntityVisual, Fall>();

  constructor(art: ArtBook) {
    this.art = art;
  }

  /** Notes a change of status on the visual. Call it on every draw, before frame(). */
  track(visual: EntityVisual, status: PlayerStatus, time: number): void {
    const changed = visual.status !== status;
    if (!changed) return;
    this.falls.set(visual, { from: visual.status, held: visual.sprite });
    visual.status = status;
    visual.statusAt = time;
  }

  /**
   * A survivor who fires, shoves or reloads while moving keeps the walk's legs: the frame
   * comes from the weapon's moving variants, at the walk's stride step.
   */
  frame(player: PlayerEntity, visual: EntityVisual, time: number): PixelSprite {
    const art = this.art.survivors[player.skin % this.art.survivors.length];
    return this.figureFrame(art, art.weapons[player.weapon], player, playerSpeed(player.skin), visual, time);
  }

  /** The same choice for anyone drawn on the survivor rig, such as a merchant: their clips, how they stand, and their walking pace. */
  figureFrame(art: FallingArt, set: SurvivorWeaponArt, player: Figure, speed: number, visual: EntityVisual, time: number): PixelSprite {
    const standing = player.status === 'alive';
    if (!standing) return this.fallen(art, set, player.status, visual, time);
    const dir = dirFromAngle(player.angle);
    const fire = set.fire[dir];
    const reload = set.reload[dir];
    const walk = set.walk[dir];
    const step = player.moving ? strideIndex(walk, visual.walked, speed / walk.fps) : null;
    const frameOf = (kind: 'fire' | 'reload', clip: Clip, frame: number): PixelSprite =>
      step === null ? clip.frames[frame] : movingFrame(set, kind, dir, frame, step);
    const sinceShove = time - visual.meleeAt;
    const sinceShot = time - visual.fireAt;
    const shoving = sinceShove < clipDuration(fire);
    const reloading = player.reload > 0;
    const recoiling = sinceShot < clipDuration(fire);
    const walking = step !== null;
    if (shoving) return frameOf('fire', fire, clipIndex(fire, sinceShove));
    if (reloading) return frameOf('reload', reload, clipIndexAt(reload, player.reload));
    if (recoiling) return frameOf('fire', fire, clipIndex(fire, sinceShot));
    if (walking) return walk.frames[step];
    return clipFrame(set.idle[dir], time);
  }

  /**
   * Downed or dead. Dropping from standing holds the last standing frame for one beat, so the
   * facing and the gun do not vanish at once, then buckles through the death clip's kneeling
   * frames. Bleeding out from the crawl starts the death where the body already lies. A
   * survivor first seen already fallen shows the crawl, or the corpse, with nothing replayed.
   */
  private fallen(art: FallingArt, set: SurvivorWeaponArt, status: PlayerStatus, visual: EntityVisual, time: number): PixelSprite {
    const since = time - visual.statusAt;
    const fall = this.falls.get(visual) ?? NO_FALL;
    const dead = deathWith(set, art.dead);
    const beat = 1 / dead.fps;
    const kneelTime = FIRST_LYING_FRAME * beat;
    const fromStanding = fall.from === 'alive';
    const held = fromStanding ? fall.held : null;
    const holding = held !== null && since < beat;
    const kneeling = fromStanding && since < kneelTime;
    const dying = status === 'dead';
    if (holding) return held;
    if (dying) return clipFrame(dead, since + deathLead(fall.from, dead));
    if (kneeling) return clipFrame(dead, since);
    return clipFrame(art.downed, fromStanding ? since - kneelTime : since);
  }
}
