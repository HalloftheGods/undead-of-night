import type { MerchantId } from '../../shared/home-protocol.ts';
import { aimAngle } from '../engine/camera.ts';
import { CHEST_HEIGHT, EMPTY_SCENE } from '../engine/scene.ts';
import type { QuestMark, SceneView } from '../engine/scene.ts';
import type { WorldRenderer } from '../engine/world-renderer.ts';
import type { ClientWorld } from './client-world.ts';
import { questMarks } from './home/quest-marks.ts';
import { closedStalls } from './home/shop.ts';
import { Heartbeat } from './heartbeat.ts';
import { tickRunAudio } from './run-audio.ts';
import { deathFade, healthFraction } from './run-hud.ts';
import type { RunHost } from './run-session.ts';
import { touchMarks } from './touch-marks.ts';

const GAME_OVER_BEAT_MS = 1800;

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
      renderer.render({ ...this.lastScene, showCrosshair: false }, 0);
      runHud.repaintMap(ms);
      return;
    }
    const isStillHeld = ms < this.heldUntilMs;
    if (isStillHeld) {
      renderer.render(this.lastScene, 0);
      return;
    }
    const dirX = input.dirX;
    const dirY = input.dirY;
    const pointerX = renderer.toBufferX(input.pointerClientX);
    const pointerY = renderer.toBufferY(input.pointerClientY);
    // Behind a co-op menu the mouse belongs to the menu, not the flashlight.
    if (!menuUp) this.aimAt(renderer, world, pointerX, pointerY);
    const aim = this.aim;
    const delay = transport?.interpolationDelayMs ?? 0;
    world.setStance(menuUp ? 'walk' : input.stance);
    const entities = world.advance(ms, delay, dirX, dirY, aim, dt);
    if (!entities) return;

    const result = state.runResult;
    const over = result !== null;
    const touch = touchMarks(input.touch, renderer, ms);
    // A finger picks a spot on the picture, so the picture must not lean toward it and move the spot.
    const scene: SceneView = {
      ...entities,
      closedStalls: this.closedStalls(),
      questMarks: this.questMarks(world),
      overrunOn: this.host.overrunOn,
      pointerX: over || touch ? null : pointerX,
      pointerY: over || touch ? null : pointerY,
      showCrosshair: this.host.playing() && !menuUp && !this.host.parts.bench.open,
      touch,
    };
    this.lastScene = scene;
    const sending = transport !== null && !over;
    if (sending) this.host.parts.inputs.send(transport, world, aim, dirX, dirY, dt);
    renderer.effects.setHeartPulse(tickRunAudio(this.host.parts.audio, world, scene, dt, this.heart));
    renderer.effects.setHealth(healthFraction(world.localPlayer));
    renderer.effects.setDesaturation(deathFade(world.localPlayer?.status, over));
    renderer.render(scene, dt);

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

  /** The flashlight follows a touch look or the pointer, measured from the survivor's chest. */
  private aimAt(renderer: WorldRenderer, world: ClientWorld, pointerX: number, pointerY: number): void {
    const { input, inputs } = this.host.parts;
    const camera = renderer.camera;
    this.aim = input.touch.look(this.aim) ?? aimAngle(
      pointerX,
      pointerY,
      camera.screenX(world.predictor.x),
      camera.screenY(world.predictor.y) - CHEST_HEIGHT,
    );
    inputs.aimPoint = renderer.toWorld(pointerX, pointerY);
  }

  /** The stalls this player's own save has closed. */
  private closedStalls(): MerchantId[] {
    const { save } = this.host.parts.home.facts();
    return save ? closedStalls(save.shop) : [];
  }

  /** The bunker's stalls with a quest to take or to be paid for, by this player's own save. Nowhere else has stalls. */
  private questMarks(world: ClientWorld): QuestMark[] {
    const { save, highest } = this.host.parts.home.facts();
    return questMarks(save, highest, world.bunkerProps());
  }
}
