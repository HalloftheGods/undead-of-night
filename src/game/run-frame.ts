import type { EntityId, PlayerEntity } from '../../shared/protocol.ts';
import { TICK_DT, WEAPONS } from '../../shared/constants.ts';
import { headSpot } from '../../shared/headshots.ts';
import { isBunkerMap } from '../../shared/home-protocol.ts';
import type { MerchantEntity, MerchantId } from '../../shared/home-protocol.ts';
import { aimAngle } from '../engine/camera.ts';
import { CHEST_HEIGHT, EMPTY_SCENE } from '../engine/scene.ts';
import type { PadRing, QuestMark, SceneView } from '../engine/scene.ts';
import type { NavDirection } from './input/gamepad-input.ts';
import { buildingAt } from '../../shared/world-query.ts';
import type { LockCandidate } from './input/pad-lock.ts';
import { crowdSpeed, currentStreak, headshotCount, pickLock, ringAt } from './input/pad-lock.ts';
import type { WorldRenderer } from '../engine/world-renderer.ts';
import type { ClientWorld } from './client-world.ts';
import { questMarks } from './home/quest-marks.ts';
import { closedStalls } from './home/shop.ts';
import { keyGlyph } from './hud-keys.ts';

/** The label of a key on the device in charge, for prompts drawn on the canvas: the bound key, or the pad's button. */
function labelFor(code: string, onPad: boolean): string {
  return keyGlyph(code, onPad ? 'pad' : 'keys') ?? code.slice(3);
}
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
/** How the ring's clock and the crosshair's circling change with the survivor's feet. */
const WALK_RING_SPEED = 1.25;
const RUN_RING_SPEED = 0.7;
const RUN_ORBIT_SPEED = 2;
/** Turns the crosshair makes round the head per second of ring clock, and how flat the circle is on the ground plane. */
const ORBIT_TURNS_PER_SEC = 1.6;
const ORBIT_SQUASH = 0.75;

/** How far past the gun's range a zombie can still be locked. */
const LOCK_SLACK = 40;

/** A right-stick push past half, as the direction it leans: the lock steps that way. */
function stickPush(stick: { x: number; y: number } | null): NavDirection | null {
  if (!stick || Math.hypot(stick.x, stick.y) < 0.5) return null;
  if (Math.abs(stick.x) > Math.abs(stick.y)) return stick.x > 0 ? 'right' : 'left';
  return stick.y > 0 ? 'down' : 'up';
}

export class RunFrame {
  private aim = 0;
  /** The zombie the right stick has locked, the stick's last push, and when the ring last started over. */
  private lockId: EntityId | null = null;
  private lastPush: NavDirection | null = null;
  private ringClock = 0;
  private orbit = -Math.PI / 2;
  private lastPadMs = 0;
  private seenHeadshots = 0;
  private padRing: PadRing | null = null;
  /** The same spot in buffer pixels, for the scene to draw. */
  private padSpot: { x: number; y: number } | null = null;
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
    input.gamepad.driving = world.localVehicleId !== null;
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
      this.aimAt(renderer, world, pointerX, pointerY, ms);
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
    const padSpot = padAims ? this.padSpot : null;
    // A finger picks a spot on the picture, so the picture must not lean toward it and move the spot.
    const scene: SceneView = {
      ...entities,
      ghost: over ? null : this.ghost(world, ms),
      atHome: isBunkerMap(world.worldMap),
      closedStalls: this.closedStalls(),
      questMarks: this.questMarks(entities.merchants ?? []),
      overrunOn: this.host.overrunOn,
      padRing: padAims && !over ? this.padRing : null,
      holdKey: labelFor('KeyE', padAims),
      reloadKey: labelFor('KeyR', padAims),
      meleeKey: labelFor('KeyF', padAims),
      switchKey: padAims ? labelFor('KeyQ', true) : null,
      pointerX: over || touch ? null : padAims ? padSpot?.x ?? null : pointerX,
      pointerY: over || touch ? null : padAims ? padSpot?.y ?? null : pointerY,
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

  /**
   * The right stick locks a zombie (a push cycles to the next one that way) and a ring closes on its head. A shot fired
   * in the last moment of the close goes to the head; any other goes to the chest. See pad-lock.ts.
   */
  private aimPad(renderer: WorldRenderer, world: ClientWorld, padLook: number, ms: number): void {
    const { input, inputs } = this.host.parts;
    const player = world.localPlayer;
    // Nothing in the gun and nothing to load into it: no lock, no ring and no crosshair until there is.
    const hasRounds = player !== null && (player.ammo > 0 || player.reserve > 0);
    const weapon = player && hasRounds ? WEAPONS[player.weapon] : null;
    const push = stickPush(input.gamepad.reticle());
    const edge = push !== null && push !== this.lastPush;
    this.lastPush = push;
    const zombies = this.lastScene.zombies;
    const me = { x: world.predictor.x, y: world.predictor.y };
    // Walls stop shots, so a zombie in a different building (or indoors against outdoors) cannot be locked.
    const mine = buildingAt(world.worldMap, me.x, me.y)?.id ?? null;
    const sameSpace = (zombie: LockCandidate) => (buildingAt(world.worldMap, zombie.x, zombie.y)?.id ?? null) === mine;
    const next = weapon ? pickLock(me, zombies, this.lockId, edge ? push : null, weapon.range + LOCK_SLACK, sameSpace) : null;
    const kills = headshotCount();
    // The ring's clock runs faster the more zombies are in reach, so a horde can be picked off quickly.
    const crowd = weapon ? zombies.filter((zombie) => zombie.health > 0 && Math.hypot(zombie.x - me.x, zombie.y - me.y) <= weapon.range + LOCK_SLACK && sameSpace(zombie)).length : 0;
    const step = Math.min(0.1, Math.max(0, (ms - this.lastPadMs) / 1000));
    this.lastPadMs = ms;
    // Moving changes the fight: walking quickens the ring, and running slows it and sends the crosshair round wildly.
    const moving = input.dirX !== 0 || input.dirY !== 0;
    const running = moving && input.stance === 'sprint';
    const pace = running ? RUN_RING_SPEED : moving ? WALK_RING_SPEED : 1;
    const swing = running ? RUN_ORBIT_SPEED : 1;
    this.ringClock += step * crowdSpeed(crowd) * pace;
    this.orbit += step * crowdSpeed(crowd) * pace * swing * ORBIT_TURNS_PER_SEC * Math.PI * 2;
    if (next !== this.lockId || kills !== this.seenHeadshots) {
      this.ringClock = 0;
      this.orbit = -Math.PI / 2;
    }
    this.lockId = next;
    this.seenHeadshots = kills;
    const target = zombies.find((zombie) => zombie.id === next);
    if (!target || !weapon) {
      this.aim = padLook;
      this.padSpot = null;
      this.padRing = null;
      inputs.aimPoint = null;
      return;
    }
    const camera = renderer.camera;
    const headable = weapon.pellets === 1 && target.boss === undefined;
    const ring = ringAt(this.ringClock, currentStreak(ms));
    const perfect = headable && ring.perfect;
    const head = headSpot(target);
    const at = (x: number, y: number) => ({ x: camera.screenX(target.x) + (x - target.x), y: camera.screenY(target.y) + (y - target.y) });
    // The crosshair circles the head on the ring's own radius and spirals in as it closes, so it is dead on at the end.
    // The shot still flies at the chest; the circling point only decides whether the bullet counts as aimed at the head.
    const turn = perfect ? 0 : ring.radius;
    const aimed = at(head.x + Math.cos(this.orbit) * turn, head.y + Math.sin(this.orbit) * turn * ORBIT_SQUASH);
    const chestSpot = at(target.x, target.y - CHEST_HEIGHT);
    const headBuffer = at(head.x, head.y);
    const chest = { x: camera.screenX(me.x), y: camera.screenY(me.y) - CHEST_HEIGHT };
    this.aim = Math.atan2(chestSpot.y - chest.y, chestSpot.x - chest.x);
    this.padSpot = aimed;
    this.padRing = { x: headBuffer.x, y: headBuffer.y, radius: ring.radius, perfect, ring: headable };
    inputs.aimPoint = renderer.toWorld(this.padSpot.x, this.padSpot.y);
  }

  private aimAt(renderer: WorldRenderer, world: ClientWorld, pointerX: number, pointerY: number, ms: number): void {
    const { input, inputs } = this.host.parts;
    const padLook = input.gamepad.look(this.aim);
    if (padLook !== null) {
      this.aimPad(renderer, world, padLook, ms);
      return;
    }
    this.padSpot = null;
    this.padRing = null;
    this.lockId = null;
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
