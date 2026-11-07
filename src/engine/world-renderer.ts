import type { LevelTheme } from '../../shared/levels.ts';
import type { NightEventId } from '../../shared/night-events.ts';
import type { EntityId, GameEvent, WorldMap, ZombieType } from '../../shared/protocol.ts';
import type { ArtBook, PixelSprite } from '../art/types.ts';
import { Atmosphere } from './atmosphere.ts';
import { BuildingLayer, roomRect } from './building-layer.ts';
import { Camera } from './camera.ts';
import { EmoteOverlay } from './emote-overlay.ts';
import { EntityRenderer } from './entity-renderer.ts';
import { FrameBudget } from './frame-budget.ts';
import { FxDirector } from './fx-director.ts';
import { GroundMotion } from './ground-motion.ts';
import type { FxContext } from './fx-director.ts';
import type { ScreenRect } from './light-field.ts';
import { lampWorks } from './level-look.ts';
import { flicker, Lighting } from './lighting.ts';
import { OcclusionGrid } from './occlusion.ts';
import { OverlayRenderer } from './overlay-renderer.ts';
import type { SceneView } from './scene.ts';
import { ScreenEffects } from './screen-effects.ts';
import { paintPrints, paintTrackingMarks } from './snow-prints.ts';
import { GroundLayer } from './tile-layer.ts';
import { computeViewport } from './viewport.ts';
import type { Viewport } from './viewport.ts';
import { VisualStore } from './visuals.ts';

const FLASHLIGHT_REACH = 215;
const TEAM_FLASHLIGHT_REACH = 170;
const AURA_COLOR = '#b8a488';
/** The player's own glow: enough to read the body by, too little to see anything else. */
const AURA_RADIUS = 38;
const TEAM_AURA_RADIUS = 28;
const DOWNED_AURA_RADIUS = 44;
const AURA_STRENGTH = 0.62;
const TEAM_AURA_STRENGTH = 0.45;
/** Street lamps are weak and failing: they mark corners, they do not light the road. */
const LAMP_REACH = 0.62;
const LAMP_STRENGTH = 0.8;
/** The van leaves its lights on, so the dark around it gives it away. */
const VAN_GLOW_COLOR = '#ffc878';
const VAN_GLOW_RADIUS = 84;
const VAN_GLOW_STRENGTH = 0.7;
const VAN_GLOW_HEIGHT = 12;
/** Flashes of light (shots, burns, blasts) one frame lights at full detail; a slow machine gets a share of it. */
const MAX_PULSES = 24;
/** From this load-shedding level on, the light is worked out every other frame and moved with the camera between. */
const HALF_RATE_LIGHT_LEVEL = 2;

/** Draws the whole game into a low-res buffer that CSS scales up by a whole number. */
export class WorldRenderer {
  readonly camera = new Camera();
  readonly effects: ScreenEffects;
  /** Rolling average of render() in ms, for the dev handle. */
  frameMs = 0;
  /** Sheds particles and small lights while frames run long. */
  readonly budget = new FrameBudget();
  /** Flips each frame, for the light that is only worked out every other frame under load. */
  private oddFrame = false;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly visuals = new VisualStore();
  private readonly entities: EntityRenderer;
  private readonly overlay: OverlayRenderer;
  private readonly emotes: EmoteOverlay;
  private readonly buildings: BuildingLayer;
  private readonly lighting = new Lighting();
  private readonly atmosphere: Atmosphere;
  private readonly groundMotion: GroundMotion;
  private readonly fx: FxDirector;
  private readonly art: ArtBook;
  private viewport: Viewport = computeViewport(480, 270, 1);
  private canvasLeft = 0;
  private canvasTop = 0;
  private map: WorldMap | null = null;
  private ground: GroundLayer | null = null;
  private occlusion: OcclusionGrid | null = null;
  private time = 0;
  private reducedMotion: boolean;

  constructor(canvas: HTMLCanvasElement, art: ArtBook, reducedMotion: boolean, shakeLevel = 1) {
    this.canvas = canvas;
    this.art = art;
    this.reducedMotion = reducedMotion;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.effects = new ScreenEffects(reducedMotion, shakeLevel);
    this.atmosphere = new Atmosphere(reducedMotion);
    this.groundMotion = new GroundMotion(reducedMotion);
    this.buildings = new BuildingLayer(art.environment);
    this.entities = new EntityRenderer(art, this.visuals, this.buildings, reducedMotion);
    this.overlay = new OverlayRenderer(art, this.visuals);
    this.emotes = new EmoteOverlay(art, this.visuals);
    this.fx = new FxDirector(art, this.visuals, this.effects, {
      stamp: (sprite, x, y, alpha) => this.stamp(sprite, x, y, alpha),
      addCorpse: (id, type, x, y) => this.addCorpse(id, type, x, y),
    });
    this.resize();
  }

  /** Applies the Motion setting to every layer that moves, without rebuilding anything. */
  setMotion(reducedMotion: boolean, shakeLevel: number): void {
    this.reducedMotion = reducedMotion;
    this.effects.setMotion(reducedMotion, shakeLevel);
    this.atmosphere.setReducedMotion(reducedMotion);
    this.groundMotion.setReducedMotion(reducedMotion);
    this.entities.setReducedMotion(reducedMotion);
  }

  private stamp(sprite: PixelSprite, x: number, y: number, alpha?: number): void {
    this.ground?.stamp(sprite, x, y, alpha);
  }

  private addCorpse(id: EntityId, type: ZombieType, x: number, y: number): void {
    this.entities.addCorpse(id, type, x, y, this.time);
  }

  /** `reach` holds the view to that far from its middle, when the mode calls for it. */
  resize(reach: number | null = null): void {
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const viewport = computeViewport(cssW, cssH, window.devicePixelRatio || 1, reach);
    this.viewport = viewport;
    this.canvas.width = viewport.bufferW;
    this.canvas.height = viewport.bufferH;
    this.canvas.style.width = `${viewport.cssW}px`;
    this.canvas.style.height = `${viewport.cssH}px`;
    this.canvas.style.left = `${viewport.left}px`;
    this.canvas.style.top = `${viewport.top}px`;
    this.ctx.imageSmoothingEnabled = false;
    this.camera.setView(viewport.bufferW, viewport.bufferH);
    this.lighting.resize(viewport.bufferW, viewport.bufferH);
    this.effects.resize(viewport.bufferW, viewport.bufferH);
    const rect = this.canvas.getBoundingClientRect();
    this.canvasLeft = rect.left;
    this.canvasTop = rect.top;
  }

  /** Client pixels to buffer pixels. */
  toBufferX(clientX: number): number {
    return ((clientX - this.canvasLeft) * this.viewport.dpr) / this.viewport.scale;
  }

  toBufferY(clientY: number): number {
    return ((clientY - this.canvasTop) * this.viewport.dpr) / this.viewport.scale;
  }

  /** Buffer pixels to the spot in the drawn world under them, shake included. */
  toWorld(bufferX: number, bufferY: number): { x: number; y: number } {
    return { x: bufferX + this.camera.left + this.effects.shakeX, y: bufferY + this.camera.top + this.effects.shakeY };
  }

  /** The title and a town before its first frame are the plain night. */
  setMap(map: WorldMap, theme: LevelTheme = 'night'): void {
    this.map = map;
    this.ground = new GroundLayer(map, this.art.environment.tiles);
    this.setTheme(theme);
    this.occlusion = new OcclusionGrid(map);
    this.buildings.setMap(map);
    this.groundMotion.setMap(map);
    this.camera.setWorld(map.width, map.height);
    this.entities.setMap(map, (sprite, x, y, alpha) => this.stamp(sprite, x, y, alpha));
    this.reset();
  }

  /** A night event darkens, reddens or fogs the town's own look. */
  setTheme(theme: LevelTheme, event: NightEventId | null = null): void {
    this.atmosphere.setTheme(theme, event);
    this.groundMotion.setTheme(theme);
    const { ambient, ground } = this.atmosphere.look;
    this.lighting.setAmbient(ambient);
    this.ground?.setTint(ground);
  }

  /** A new run on the same map: scrub the streets. */
  reset(): void {
    this.ground?.clear();
    this.buildings.reset();
    this.entities.reset();
    this.visuals.clear();
    this.fx.clear();
    this.emotes.clear();
    this.effects.reset();
  }

  handleEvent(event: GameEvent, ctx: Omit<FxContext, 'time'>): void {
    this.emotes.handle(event, this.time);
    this.fx.handle(event, { ...ctx, time: this.time });
  }

  private composeLight(scene: SceneView, left: number, top: number): void {
    const lighting = this.lighting;
    this.oddFrame = !this.oddFrame;
    const halfRate = this.budget.level >= HALF_RATE_LIGHT_LEVEL && this.oddFrame;
    const keptLastLight = halfRate && lighting.reuse(left, top);
    if (keptLastLight) return;
    lighting.begin(left, top);
    const look = this.atmosphere.look;
    const lights = this.map?.lights ?? [];
    for (let i = 0; i < lights.length; i += 1) {
      const isLampOut = !lampWorks(look, i);
      if (isLampOut) continue;
      const light = lights[i];
      const strength = (light.flicker ? flicker(this.time, i) : 1) * LAMP_STRENGTH * look.lampStrength;
      lighting.addPool(light.x - left, light.y - top, light.radius * LAMP_REACH, look.lampColor ?? light.color, strength);
    }
    if (scene.exit) {
      lighting.addPool(scene.exit.x - left, scene.exit.y - VAN_GLOW_HEIGHT - top, VAN_GLOW_RADIUS, VAN_GLOW_COLOR, VAN_GLOW_STRENGTH);
    }
    const open = this.buildings.openRoom();
    const room = open ? roomRect(open, left, top) : null;
    const inRoom = open !== null && room !== null;
    if (inRoom) lighting.enclose(room, open.reveal);
    const pulses = this.fx.pulses;
    // The newest flashes are the ones being looked at; older ones are nearly out anyway.
    const firstPulse = Math.max(0, pulses.length - Math.round(MAX_PULSES * this.budget.share));
    for (let i = firstPulse; i < pulses.length; i += 1) {
      const pulse = pulses[i];
      const x = pulse.x - left;
      const y = pulse.y - top;
      const underRoof = this.buildings.isHidden(pulse.x, pulse.y);
      if (!underRoof) lighting.addPool(x, y, pulse.radius, pulse.color, pulse.life / pulse.maxLife, this.keepInRoom(room, x, y));
    }
    for (const player of scene.players) {
      this.addPlayerLight(player, scene.viewerId, room, left, top);
    }
    const isGameOver = scene.phase === 'gameover';
    if (isGameOver) {
      lighting.addPool(scene.focusX - left, scene.focusY - top, 120, AURA_COLOR, 0.6);
    }
    lighting.finish();
  }

  /** Light that starts in the open room stays there; it must not spill through the walls. */
  private keepInRoom(room: ScreenRect | null, x: number, y: number): ScreenRect | undefined {
    const inside = room !== null && x >= room.x0 && x < room.x1 && y >= room.y0 && y < room.y1;
    return inside ? room : undefined;
  }

  private addPlayerLight(player: SceneView['players'][number], viewerId: EntityId | null, room: ScreenRect | null, left: number, top: number): void {
    const isViewer = player.id === viewerId;
    const x = player.x - left;
    const y = player.y - top;
    const clip = this.keepInRoom(room, x, y);
    // A teammate's light in another building stays in there; it would only paint the roof.
    const unlit = player.status === 'dead' || this.buildings.isHidden(player.x, player.y);
    if (unlit) return;
    const isDowned = player.status === 'downed';
    if (isDowned) {
      this.lighting.addPool(x, y, isViewer ? DOWNED_AURA_RADIUS : TEAM_AURA_RADIUS, AURA_COLOR, TEAM_AURA_STRENGTH, clip);
      return;
    }
    this.lighting.addPool(x, y, isViewer ? AURA_RADIUS : TEAM_AURA_RADIUS, AURA_COLOR, isViewer ? AURA_STRENGTH : TEAM_AURA_STRENGTH, clip);
    const reach = isViewer ? FLASHLIGHT_REACH : TEAM_FLASHLIGHT_REACH;
    this.lighting.addFlashlight(this.occlusion, player.x, player.y, player.angle, reach, isViewer ? 1 : 0.7, left, top);
  }

  /** Whoever is in a closed building stays out of the frame, bars and tracers included. */
  private withoutHidden(scene: SceneView): SceneView {
    const inOpen = ({ x, y }: { x: number; y: number }) => !this.buildings.isHidden(x, y);
    return {
      ...scene,
      zombies: scene.zombies.filter(inOpen),
      pickups: scene.pickups.filter(inOpen),
      bullets: scene.bullets.filter(inOpen),
    };
  }

  /** A word over someone's head that no sim event carries. */
  note(text: string, x: number, y: number): void {
    this.fx.note(text, x, y);
  }

  render(fullScene: SceneView, dt: number): void {
    const started = performance.now();
    const ctx = this.ctx;
    const ground = this.ground;
    if (!ground) return;

    this.time += dt;
    const time = this.time;
    this.budget.update(dt);
    this.fx.particles.setShare(this.budget.share);
    this.fx.update(dt);
    this.effects.update(dt);
    const viewer = fullScene.players.find((player) => player.id === fullScene.viewerId);
    this.buildings.update(viewer?.indoors ?? null, dt);
    const scene = this.withoutHidden(fullScene);
    this.camera.follow(scene.focusX, scene.focusY, scene.pointerX, scene.pointerY, dt);

    const viewW = this.viewport.bufferW;
    const viewH = this.viewport.bufferH;
    const left = this.camera.left + this.effects.shakeX;
    const top = this.camera.top + this.effects.shakeY;

    ctx.fillStyle = '#07080c';
    ctx.fillRect(0, 0, viewW, viewH);
    ground.draw(ctx, left, top, viewW, viewH);
    this.groundMotion.draw(ctx, left, top, viewW, viewH, time);
    paintPrints(ctx, scene.tracks ?? [], left, top, viewW, viewH);
    this.entities.drawWorld(ctx, scene, left, top, viewW, viewH, time, dt);
    this.fx.particles.drawLit(ctx, left, top);

    this.composeLight(scene, left, top);
    this.lighting.apply(ctx);
    const lightAt = (x: number, y: number) => this.lighting.brightness(x, y);
    const isKilled = (id: EntityId) => this.entities.isKilled(id);
    const outdoors = 1 - (this.buildings.openRoom()?.reveal ?? 0);
    this.atmosphere.drawWash(ctx, viewW, viewH, time, outdoors);
    const isOutdoors = outdoors > 0;
    if (isOutdoors) this.groundMotion.draw(ctx, left, top, viewW, viewH, time, 'lit');

    this.entities.drawEmissive(ctx, scene, left, top, viewW, viewH, time);
    paintTrackingMarks(ctx, scene.zombies, left, top, viewW, viewH, time, this.reducedMotion);
    this.entities.drawGlints(ctx, scene, left, top, viewW, viewH, time, lightAt);
    this.fx.particles.drawEmissive(ctx, left, top);
    this.entities.drawOccluded(ctx, scene, left, top, viewW, viewH);
    this.atmosphere.drawWeather(ctx, left, top, viewW, viewH, time, outdoors);
    this.effects.draw(ctx, viewW, viewH);
    this.overlay.draw(ctx, scene, left, top, viewW, viewH, time, lightAt, isKilled);
    this.emotes.draw(ctx, scene, left, top, viewW, viewH, time);
    this.fx.particles.drawTexts(ctx, left, top);
    if (scene.showCrosshair) this.overlay.drawCrosshair(ctx, scene, left, top, lightAt, isKilled);

    this.visuals.endFrame();
    this.frameMs += (performance.now() - started - this.frameMs) * 0.05;
  }
}
