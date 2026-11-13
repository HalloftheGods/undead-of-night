import type { PlayerEntity } from '../../shared/protocol.ts';
import { TICK_DT } from '../../shared/constants.ts';
import type { MerchantEntity, MerchantId } from '../../shared/home-protocol.ts';
import { aimAngle } from '../engine/camera.ts';
import { CHEST_HEIGHT, EMPTY_SCENE } from '../engine/scene.ts';
import type { QuestMark, SceneView } from '../engine/scene.ts';
import type { WorldRenderer } from '../engine/world-renderer.ts';
import type { ClientWorld } from './client-world.ts';
import { questMarks } from './home/quest-marks.ts';
import { closedStalls } from './home/shop.ts';
import { Heartbeat } from './heartbeat.ts';
import { PlayerAnchor } from './player-anchor.ts';
import type { Anchor } from './player-anchor.ts';
import { tickRunAudio } from './run-audio.ts';
import { heldInfo } from './held-cursor.ts';
import { deathFade, healthFraction } from './run-hud.ts';
import type { RunHost } from './run-session.ts';
import { touchMarks } from './touch-marks.ts';

const GAME_OVER_BEAT_MS = 1800;
const STAIRS_TRANSITION_MS = 700;
const STAIRS_FADE_HALF_MS = 350;

/** What a run's frame reads from the controller beyond the run's own parts. */
export interface RunFrameHost {
  readonly parts: RunHost;
  readonly menuUp: () => boolean;
  readonly playing: () => boolean;
  /** Read once, as the solo session reads it: the blast door is drawn only with the overrun on. */
  readonly overrunOn: boolean;
}

/** One frame of a run: aim, predict, send input, draw, and the HUD after. Keeps the last picture for a held or frozen frame. */
export class RunFrame {
  private aim = 0;
  private lastScene: SceneView = EMPTY_SCENE;
  /** A hit-stop holds the picture until this frame time. */
  private heldUntilMs = 0;
  /** The low-health heart, one clock for its sound and the screen's red pulse. */
  private readonly heart = new Heartbeat();
  private lastHealth = 1;
  /** Where the survivor stands, for the overlay to ring (player-anchor.ts). */
  private readonly anchor = new PlayerAnchor();

  constructor(private readonly host: RunFrameHost) {}

  /** Holds the picture still for `ms` from now, or longer if a hold is already running. */
  holdFor(ms: number): void {
    this.heldUntilMs = Math.max(this.heldUntilMs, performance.now() + ms);
  }

  draw(renderer: WorldRenderer, world: ClientWorld, ms: number, dt: number): void {
    const { state, ui, input, runHud } = this.host.parts;
    const transport = state.transport;
    const { screen } = ui.value;
    const menuUp = this.host.menuUp();
    const frozen = menuUp && transport?.kind === 'solo';
    if (frozen) {
      renderer.render({ ...this.lastScene, showCrosshair: false, held: this.heldView(renderer) }, 0);
      runHud.repaintMap(ms);
      runHud.repaintHeld(world);
      return;
    }
    const isStillHeld = ms < this.heldUntilMs;
    if (isStillHeld) {
      renderer.render(this.lastScene, 0);
      return;
    }
    const transition = state.stairsTransition;
    const isTransitioning = transition !== null && ms - transition.startedAtMs < STAIRS_TRANSITION_MS;
    const elapsed = transition ? ms - transition.startedAtMs : 0;
    const dirX = isTransitioning ? 0 : input.dirX;
    const dirY = isTransitioning ? 0 : input.dirY;
    const pointerX = renderer.toBufferX(input.pointerClientX);
    const pointerY = renderer.toBufferY(input.pointerClientY);
    const isMoving = dirX !== 0 || dirY !== 0;
    if (ui.value.mapOpen) {
      const padLook = input.gamepad.look(this.aim);
      if (padLook !== null) this.aim = padLook;
      else if (isMoving) this.aim = Math.atan2(dirY, dirX);
    } else if (!menuUp) {
      this.aimAt(renderer, world, pointerX, pointerY);
    }
    const aim = this.aim;
    const delay = transport?.interpolationDelayMs ?? 0;
    world.setStance(menuUp ? 'walk' : input.stance);
    const entities = world.advance(ms, delay, dirX, dirY, aim, dt);
    if (!entities) return;

    let fadeAlpha = 0;
    if (isTransitioning) {
      const isFadingOut = elapsed < STAIRS_FADE_HALF_MS;
      fadeAlpha = isFadingOut ? elapsed / STAIRS_FADE_HALF_MS : (STAIRS_TRANSITION_MS - elapsed) / STAIRS_FADE_HALF_MS;
      const targetX = isFadingOut ? transition.fromX : transition.toX;
      const targetY = isFadingOut ? transition.fromY : transition.toY;
      (entities as { focusX: number; focusY: number }).focusX = targetX;
      (entities as { focusX: number; focusY: number }).focusY = targetY;
      const local = entities.players.find((player) => player.id === world.localId);
      if (local) {
        local.x = targetX;
        local.y = targetY;
      }
    }

    const result = state.runResult;
    const over = result !== null;
    const touch = touchMarks(input.touch, renderer, ms);
    // A stick aims by angle alone, so the mouse's last resting spot is no crosshair.
    const padAims = input.lastDevice === 'gamepad';
    // A finger picks a spot on the picture, so the picture must not lean toward it and move the spot.
    const scene: SceneView = {
      ...entities,
      ghost: over ? null : this.ghost(world, ms),
      closedStalls: this.closedStalls(),
      questMarks: this.questMarks(entities.merchants ?? []),
      overrunOn: this.host.overrunOn,
      pointerX: over || touch || padAims ? null : pointerX,
      pointerY: over || touch || padAims ? null : pointerY,
      showCrosshair: this.host.playing() && !menuUp && !ui.value.mapOpen && !this.host.parts.bench.open && !isTransitioning,
      touch,
      held: this.heldView(renderer),
    };
    this.lastScene = scene;
    const sending = transport !== null && !over;
    if (sending) this.host.parts.inputs.send(transport, world, aim, dirX, dirY, dt);
    const localPlayer = world.localPlayer;
    const isBleeding = localPlayer?.needs?.bleeding === true;
    const currentHealth = healthFraction(localPlayer);
    const tookDamage = currentHealth < this.lastHealth && this.lastHealth > 0;
    this.lastHealth = currentHealth;
    if (tookDamage) {
      this.heart.kick();
    }
    renderer.effects.setBleeding(isBleeding);
    renderer.effects.setHeartPulse(tickRunAudio(this.host.parts.audio, world, scene, dt, this.heart, isBleeding));
    renderer.effects.setHealth(currentHealth);
    renderer.effects.setDesaturation(deathFade(localPlayer?.status, over));
    renderer.effects.setStairsFade(fadeAlpha);
    const hasTransitionExpired = !isTransitioning && state.stairsTransition !== null;
    if (hasTransitionExpired) state.stairsTransition = null;
    renderer.render(scene, dt);
    this.anchor.write(this.playerSpot(renderer, world));

    const beatOver = over && screen === 'game' && ms - state.gameOverAtMs > GAME_OVER_BEAT_MS;
    if (beatOver) this.host.parts.publish({ screen: 'gameover', result });
    runHud.tick({
      world,
      scene,
      renderer,
      ms,
      networked: transport?.kind === 'coop',
      lastSnapshotMs: state.lastSnapshotMs,
    });
  }

  /**
   * The survivor's chest in window pixels, for the overlay to hang a ring off, or null off a run.
   * The camera's own spot, not the shaken one: a blast must not throw the backpack across the screen.
   */
  private playerSpot(renderer: WorldRenderer, world: ClientWorld): Anchor | null {
    const onRun = world.localPlayer !== null;
    if (!onRun) return null;
    const camera = renderer.camera;
    return {
      x: renderer.toClientX(camera.screenX(world.predictor.x)),
      y: renderer.toClientY(camera.screenY(world.predictor.y) - CHEST_HEIGHT),
    };
  }

  /** Nothing of the last run is left on screen for the next one to inherit. */
  clear(): void {
    this.anchor.clear();
  }

  /** The flashlight follows a stick, a touch look or the pointer, measured from the survivor's chest. */
  /** The item in hand, with the pointer, while the inventory is open. Null when nothing is held. */
  private heldView(renderer: WorldRenderer): SceneView['held'] {
    const info = heldInfo();
    if (info === null) return null;
    const { input } = this.host.parts;
    return { ...info, x: Math.round(renderer.toBufferX(input.pointerClientX)), y: Math.round(renderer.toBufferY(input.pointerClientY)) };
  }

  private aimAt(renderer: WorldRenderer, world: ClientWorld, pointerX: number, pointerY: number): void {
    const { input, inputs } = this.host.parts;
    const padLook = input.gamepad.look(this.aim);
    if (padLook !== null) {
      // No spot on the picture: the packet leaves aimX/aimY off, as it does with no crosshair.
      // TODO(pad-reticle): a virtual crosshair along the stick would give headshots and throws a spot.
      this.aim = padLook;
      inputs.aimPoint = null;
      return;
    }
    const camera = renderer.camera;
    this.aim = input.touch.look(this.aim) ?? aimAngle(
      pointerX,
      pointerY,
      camera.screenX(world.predictor.x),
      camera.screenY(world.predictor.y) - CHEST_HEIGHT,
    );
    inputs.aimPoint = renderer.toWorld(pointerX, pointerY);
  }

  /** The day's counted run where it was at this moment, timed off the sim's tick and the time since it last spoke. */
  private ghost(world: ClientWorld, ms: number): PlayerEntity | null {
    const { state } = this.host.parts;
    const { ghost } = state;
    const latest = world.latest;
    const noGhost = ghost === null || latest === null;
    if (noGhost) return null;
    const sinceTick = Math.min(1, Math.max(0, (ms - state.lastSnapshotMs) / (TICK_DT * 1000)));
    return ghost.figure(latest.level, latest.tick + sinceTick, world.localPlayer);
  }

  /** The stalls this player's own save has closed. */
  private closedStalls(): MerchantId[] {
    const { save } = this.host.parts.home.facts();
    return save ? closedStalls(save.shop) : [];
  }

  /** The bunker's stalls with a quest to take or to be paid for, by this player's own save. Nowhere else has stalls. */
  private questMarks(merchants: readonly MerchantEntity[]): QuestMark[] {
    const { save, highest } = this.host.parts.home.facts();
    return questMarks(save, highest, merchants);
  }
}
