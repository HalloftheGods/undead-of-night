import { BOSSES } from '../../shared/bosses.ts';
import { PLAYER_RADIUS, ZOMBIES } from '../../shared/constants.ts';
import { townContainers } from '../../shared/containers.ts';
import { CHEST_SPOT } from '../../shared/bunker-map.ts';
import { PROP_DEFS } from '../../shared/protocol.ts';
import type {
  EntityId,
  ExitEntity,
  PickupEntity,
  PlayerEntity,
  PropInstance,
  WorldMap,
  ZombieEntity,
  ZombieType,
} from '../../shared/protocol.ts';
import { containerLook } from '../art/containers.ts';
import type { ContainerArt } from '../art/containers.ts';
import { dirFromAngle } from '../art/types.ts';
import type { ArtBook, PixelSprite } from '../art/types.ts';
import type { BuildingLayer, PlacedBuilding } from './building-layer.ts';
import { chestPending, doorState, hiddenProp } from './overrun-look.ts';
import { CHEST_HEIGHT } from './scene.ts';
import type { SceneView } from './scene.ts';
import { bodyHeight, clipFrame, drawSilhouette, drawSprite, drawSpriteScaled, spriteCanvas, strideFrame } from './sprite-cache.ts';
import { beginStatusFrame, paintBurn, paintEffectTrail, paintTint } from './status-fx.ts';
import { SurvivorFrames } from './survivor-frames.ts';
import { trackWalking } from './visuals.ts';
import type { EntityVisual, VisualStore } from './visuals.ts';

const CULL_MARGIN = 40;
const DEFAULT_BODY_HEIGHT = 24;
const CORPSE_BAKE_SEC = 24;
const MAX_CORPSES = 28;
const KILLED_MEMORY_SEC = 2;
const FADED_ALPHA = 0.42;
const FADE_RATE = 7;
const SILHOUETTE_ALPHA = 0.34;
/** Firm enough to read as a contact puddle on near-black asphalt; a darker core would blot snow. */
const SHADOW_ALPHA = 0.6;
/** A shove lurches the body this far along its aim and straight back. */
const LUNGE_PX = 4;
const LUNGE_SEC = 0.2;
/** Below this the beam has not reached a pickup, so it stays dark. */
const GLINT_LIGHT = 70;
const GLINT_CYCLE_SEC = 1.3;
const GLINT_SHARE = 0.22;
const GLINT_HEIGHT = 5;
const GLINT_CORE = '#fff6d8';
const GLINT_RAY = '#e8c878';

interface PlacedProp {
  readonly prop: PropInstance;
  readonly sprite: PixelSprite;
  /** Set on a searchable prop, which swaps its sprite for one of these two once searched. */
  readonly container: { readonly id: number; readonly art: ContainerArt } | null;
  /** Both of a container's sprites fit in these bounds. */
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  /** Art rises over the ground behind the footprint, so it can hide someone. */
  readonly tall: boolean;
  /** The room this prop furnishes, drawn only while that room is open. */
  readonly room: PlacedBuilding | null;
  alpha: number;
}

interface Corpse {
  readonly type: ZombieType;
  readonly x: number;
  readonly y: number;
  readonly bornAt: number;
}

type DrawItem =
  | { readonly y: number; readonly kind: 'prop'; readonly prop: PlacedProp }
  | { readonly y: number; readonly kind: 'building'; readonly building: PlacedBuilding }
  | { readonly y: number; readonly kind: 'player'; readonly player: PlayerEntity }
  | { readonly y: number; readonly kind: 'zombie'; readonly zombie: ZombieEntity }
  | { readonly y: number; readonly kind: 'pickup'; readonly pickup: PickupEntity }
  | { readonly y: number; readonly kind: 'exit'; readonly exit: ExitEntity }
  | { readonly y: number; readonly kind: 'chest' };

const shadows = new Map<number, HTMLCanvasElement>();

/** A flat pixel ellipse. Rows are stepped by hand so the edge stays hard. */
function shadowSprite(width: number): HTMLCanvasElement {
  let canvas = shadows.get(width);
  if (!canvas) {
    const height = Math.max(3, Math.round(width * 0.42));
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = `rgba(4, 5, 10, ${SHADOW_ALPHA})`;
    for (let y = 0; y < height; y += 1) {
      const ny = ((y + 0.5) / height) * 2 - 1;
      const half = Math.round((width / 2) * Math.sqrt(1 - ny * ny));
      ctx.fillRect(Math.round(width / 2) - half, y, half * 2, 1);
    }
    shadows.set(width, canvas);
  }
  return canvas;
}

function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, width: number): void {
  const sprite = shadowSprite(width);
  ctx.drawImage(sprite, x - Math.round(width / 2), y - Math.round(sprite.height / 2));
}

/** A stable offset per item, so the glints around a room do not blink in time. */
function glintPhase(id: EntityId): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 997;
  return hash / 997;
}

/** Everything standing on the ground: y-sorted props, people, zombies, pickups and building shells. */
export class EntityRenderer {
  private readonly art: ArtBook;
  private readonly visuals: VisualStore;
  private readonly buildings: BuildingLayer;
  private reducedMotion: boolean;
  private props: PlacedProp[] = [];
  private fires: PlacedProp[] = [];
  private corpses: Corpse[] = [];
  /** Zombies whose death has been shown, though the delayed view has not caught up. */
  private readonly killed = new Map<EntityId, number>();
  private readonly survivorFrames: SurvivorFrames;
  private stamp: (sprite: PixelSprite, x: number, y: number, alpha?: number) => void = () => {};

  constructor(art: ArtBook, visuals: VisualStore, buildings: BuildingLayer, reducedMotion = false) {
    this.art = art;
    this.survivorFrames = new SurvivorFrames(art);
    this.visuals = visuals;
    this.buildings = buildings;
    this.reducedMotion = reducedMotion;
  }

  /** The Motion setting changed while the game was running. */
  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
  }

  setMap(map: WorldMap, stamp: (sprite: PixelSprite, x: number, y: number, alpha?: number) => void): void {
    this.stamp = stamp;
    const containers = new Map(townContainers(map).map((container) => [container.propIndex, container]));
    this.props = map.props.map((prop, index) => {
      const found = containers.get(index);
      const art = found ? this.art.containers[containerLook(found)] : null;
      const sprite = art ? art.closed : this.art.environment.props[prop.kind];
      const states = art ? [art.closed, art.opened] : [sprite];
      const x = Math.round(prop.x);
      const y = Math.round(prop.y);
      return {
        prop,
        sprite,
        container: found && art ? { id: found.id, art } : null,
        x0: Math.min(...states.map((state) => x - state.ax)),
        y0: Math.min(...states.map((state) => y - state.ay)),
        x1: Math.max(...states.map((state) => x - state.ax + state.w)),
        y1: Math.max(...states.map((state) => y - state.ay + state.h)),
        tall: sprite.ay > PROP_DEFS[prop.kind].h + 8,
        room: this.buildings.placedAt(prop.x, prop.y - PROP_DEFS[prop.kind].h / 2),
        alpha: 1,
      };
    });
    this.fires = this.props.filter((placed) => placed.prop.kind === 'fire_barrel');
    this.reset();
  }

  reset(): void {
    this.corpses = [];
    this.killed.clear();
  }

  addCorpse(id: EntityId, type: ZombieType, x: number, y: number, time: number): void {
    this.killed.set(id, time + KILLED_MEMORY_SEC);
    this.corpses.push({ type, x, y, bornAt: time });
    const crowded = this.corpses.length > MAX_CORPSES;
    if (crowded) this.bake(this.corpses.shift()!);
  }

  private bake(corpse: Corpse): void {
    const frames = this.art.zombies[corpse.type].death.frames;
    this.stamp(frames[frames.length - 1], corpse.x, corpse.y, 0.85);
  }

  private settleCorpses(time: number): void {
    while (this.corpses.length > 0 && time - this.corpses[0].bornAt > CORPSE_BAKE_SEC) {
      this.bake(this.corpses.shift()!);
    }
    for (const [id, expires] of this.killed) {
      const forgotten = time > expires;
      if (forgotten) this.killed.delete(id);
    }
  }

  private drawCorpses(ctx: CanvasRenderingContext2D, left: number, top: number, time: number): void {
    for (const corpse of this.corpses) {
      const clip = this.art.zombies[corpse.type].death;
      drawSprite(ctx, clipFrame(clip, time - corpse.bornAt), Math.round(corpse.x) - left, Math.round(corpse.y) - top);
    }
  }

  /** Its corpse is already down, even while the delayed scene still lists the zombie. */
  isKilled(id: EntityId): boolean {
    return this.killed.has(id);
  }

  private collect(scene: SceneView, left: number, top: number, viewW: number, viewH: number): DrawItem[] {
    const items: DrawItem[] = [];
    const right = left + viewW;
    const bottom = top + viewH;
    const visible = (x: number, y: number) =>
      x > left - CULL_MARGIN && x < right + CULL_MARGIN && y > top - CULL_MARGIN && y < bottom + CULL_MARGIN;

    for (const placed of this.props) {
      const onScreen = placed.x1 > left && placed.x0 < right && placed.y1 > top && placed.y0 < bottom;
      const roomClosed = placed.room !== null && placed.room.reveal === 0;
      const shown = onScreen && !roomClosed && !this.standsDown(placed, scene) && !hiddenProp(placed.prop.kind, scene.overrunOn === true);
      if (shown) items.push({ y: placed.prop.y, kind: 'prop', prop: placed });
    }
    const local = scene.players.find((player) => player.id === scene.localId) ?? null;
    if (chestPending(scene.overrun, local)) items.push({ y: CHEST_SPOT.y, kind: 'chest' });
    for (const placed of this.buildings.placed) {
      const onScreen = placed.x1 > left && placed.x0 < right && placed.y1 > top && placed.y0 < bottom;
      if (onScreen) items.push({ y: placed.depthY, kind: 'building', building: placed });
    }
    for (const player of scene.players) {
      if (visible(player.x, player.y)) items.push({ y: player.y, kind: 'player', player });
    }
    for (const zombie of scene.zombies) {
      const shown = !this.killed.has(zombie.id) && visible(zombie.x, zombie.y);
      if (shown) items.push({ y: zombie.y, kind: 'zombie', zombie });
    }
    for (const pickup of scene.pickups) {
      if (visible(pickup.x, pickup.y)) items.push({ y: pickup.y, kind: 'pickup', pickup });
    }
    const { exit } = scene;
    const exitShown = exit !== null && visible(exit.x, exit.y);
    if (exitShown) items.push({ y: exit.y, kind: 'exit', exit });
    return items.sort((a, b) => a.y - b.y);
  }

  /** A merchant whose stall the overrun emptied is not at it: this player's save says so, and a teammate's may differ. */
  private standsDown(placed: PlacedProp, scene: SceneView): boolean {
    const stalls = scene.closedStalls ?? [];
    return stalls.some((merchant) => merchant === placed.prop.kind);
  }

  /** The blast door's frame for how far the overrun has come; every other prop keeps its own sprite. */
  private spriteOf(placed: PlacedProp, scene: SceneView): PixelSprite {
    const isDoor = placed.prop.kind === 'blast_door';
    if (!isDoor) return placed.sprite;
    const { doorBuckling, doorBurst } = this.art.environment.overrun;
    const frames = { shut: placed.sprite, buckling: doorBuckling, burst: doorBurst };
    return frames[doorState(scene.overrun)];
  }

  /** The part of the scene that the lightmap darkens. */
  drawWorld(
    ctx: CanvasRenderingContext2D,
    scene: SceneView,
    left: number,
    top: number,
    viewW: number,
    viewH: number,
    time: number,
    dt: number,
  ): void {
    this.settleCorpses(time);
    this.buildings.drawInteriors(ctx, left, top);
    this.drawCorpses(ctx, left, top, time);
    const viewer = scene.players.find((player) => player.id === scene.viewerId) ?? null;
    const blend = 1 - Math.exp(-FADE_RATE * dt);
    const items = this.collect(scene, left, top, viewW, viewH);
    // Every shadow goes down before any figure, so a firm shadow never darkens a neighbour's boots.
    for (const item of items) this.drawShadowOf(ctx, item, left, top, time);
    for (const item of items) {
      if (item.kind === 'prop') this.drawProp(ctx, item.prop, scene, viewer, left, top, blend);
      else if (item.kind === 'building') this.buildings.drawShell(ctx, item.building, left, top);
      else if (item.kind === 'player') this.drawPlayer(ctx, item.player, left, top, time);
      else if (item.kind === 'zombie') this.drawZombie(ctx, item.zombie, left, top, time);
      else if (item.kind === 'exit') drawSprite(ctx, this.art.environment.escapeVan, Math.round(item.exit.x) - left, Math.round(item.exit.y) - top);
      else if (item.kind === 'chest') drawSprite(ctx, this.art.environment.props.chest, CHEST_SPOT.x - left, CHEST_SPOT.y - top);
      else this.drawPickup(ctx, item.pickup, left, top, time);
    }
  }

  private drawProp(
    ctx: CanvasRenderingContext2D,
    placed: PlacedProp,
    scene: SceneView,
    viewer: PlayerEntity | null,
    left: number,
    top: number,
    blend: number,
  ): void {
    const hidesViewer = viewer !== null && placed.tall && this.covers(placed, placed.prop.y, viewer);
    placed.alpha += ((hidesViewer ? FADED_ALPHA : 1) - placed.alpha) * blend;
    const { container } = placed;
    const searched = container !== null && scene.openedContainers.includes(container.id);
    const sprite = searched ? container.art.opened : this.spriteOf(placed, scene);
    ctx.globalAlpha = placed.alpha;
    ctx.drawImage(spriteCanvas(sprite), Math.round(placed.prop.x) - sprite.ax - left, Math.round(placed.prop.y) - sprite.ay - top);
    ctx.globalAlpha = 1;
  }

  private covers(art: Pick<PlacedProp, 'x0' | 'y0' | 'x1' | 'y1'>, depthY: number, player: PlayerEntity): boolean {
    const chestY = player.y - CHEST_HEIGHT;
    return player.y < depthY
      && player.x > art.x0 && player.x < art.x1
      && chestY > art.y0 && chestY < art.y1;
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, player: PlayerEntity, left: number, top: number, time: number): void {
    const visual = this.visuals.touch(player.id);
    trackWalking(visual, player.x, player.y);
    this.survivorFrames.track(visual, player.status, time);
    const sprite = this.survivorFrames.frame(player, visual, time);
    visual.sprite = sprite;
    visual.gunDrop = this.art.survivors[player.skin % this.art.survivors.length].gunDrop;
    const [x, y] = this.playerSpot(player, visual, left, top, time);
    const flashing = time < visual.flashUntil;
    if (flashing) drawSilhouette(ctx, sprite, x, y);
    else drawSprite(ctx, sprite, x, y);
  }

  /** Where a survivor stands on screen, lurched along the aim during a shove. */
  private playerSpot(player: PlayerEntity, visual: EntityVisual, left: number, top: number, time: number): [number, number] {
    const lunge = this.lunge(time - visual.meleeAt);
    return [Math.round(player.x + Math.cos(player.angle) * lunge) - left, Math.round(player.y + Math.sin(player.angle) * lunge) - top];
  }

  private drawShadowOf(ctx: CanvasRenderingContext2D, item: DrawItem, left: number, top: number, time: number): void {
    switch (item.kind) {
      case 'player':
        this.drawPlayerShadow(ctx, item.player, left, top, time);
        break;
      case 'zombie':
        this.drawZombieShadow(ctx, item.zombie, left, top);
        break;
      default:
        break;
    }
  }

  private drawPlayerShadow(ctx: CanvasRenderingContext2D, player: PlayerEntity, left: number, top: number, time: number): void {
    const standing = player.status === 'alive';
    if (!standing) return;
    const [x, y] = this.playerSpot(player, this.visuals.get(player.id), left, top, time);
    drawShadow(ctx, x, y, PLAYER_RADIUS * 2 + 2);
  }

  /** Centred on the planted soles, which hang a few rows below a zombie's anchor. */
  private drawZombieShadow(ctx: CanvasRenderingContext2D, zombie: ZombieEntity, left: number, top: number): void {
    const footDrop = this.art.zombies[zombie.type].footDrop ?? 0;
    const scale = zombie.boss ? BOSSES[zombie.boss].scale : 1;
    drawShadow(ctx, Math.round(zombie.x) - left, Math.round(zombie.y) - top + footDrop * scale, ZOMBIES[zombie.type].radius * 2 * scale + 2);
  }

  private lunge(sinceShove: number): number {
    return sinceShove < LUNGE_SEC ? Math.sin((sinceShove / LUNGE_SEC) * Math.PI) * LUNGE_PX : 0;
  }

  private drawZombie(ctx: CanvasRenderingContext2D, zombie: ZombieEntity, left: number, top: number, time: number): void {
    const visual = this.visuals.touch(zombie.id);
    trackWalking(visual, zombie.x, zombie.y);
    const lunging = zombie.attacking && !visual.attacking;
    if (lunging) visual.attackAt = time;
    visual.attacking = zombie.attacking;

    const art = this.art.zombies[zombie.type];
    const dir = dirFromAngle(zombie.angle);
    const walk = art.walk[dir];
    const sprite = zombie.attacking
      ? clipFrame(art.attack[dir], time - visual.attackAt)
      : strideFrame(walk, visual.walked, ZOMBIES[zombie.type].speed / walk.fps);
    visual.sprite = sprite;
    const x = Math.round(zombie.x) - left;
    const y = Math.round(zombie.y) - top;
    const flashing = time < visual.flashUntil;
    const boss = zombie.boss ? BOSSES[zombie.boss] : null;
    if (boss) drawSpriteScaled(ctx, sprite, x, y, boss.scale, flashing);
    else if (flashing) drawSilhouette(ctx, sprite, x, y);
    else {
      drawSprite(ctx, sprite, x, y);
      paintTint(ctx, zombie, sprite, x, y, time, this.reducedMotion);
    }
  }

  private drawPickup(ctx: CanvasRenderingContext2D, pickup: PickupEntity, left: number, top: number, time: number): void {
    const x = Math.round(pickup.x) - left;
    const y = Math.round(pickup.y) - top;
    drawShadow(ctx, x, y, 10);
    drawSprite(ctx, clipFrame(this.art.pickups[pickup.type], time), x, y);
  }

  /** Flames and tracers light themselves, so they go on after the lightmap. */
  /** How tall the zombie was last drawn, for putting flames at its chest. */
  private bodyHeightOf(id: EntityId): number {
    const sprite = this.visuals.get(id)?.sprite;
    return sprite ? bodyHeight(sprite) : DEFAULT_BODY_HEIGHT;
  }

  drawEmissive(ctx: CanvasRenderingContext2D, scene: SceneView, left: number, top: number, viewW: number, viewH: number, time: number): void {
    const flames = this.art.environment.barrelFire;
    for (const fire of this.fires) {
      const onScreen = fire.x1 > left && fire.x0 < left + viewW && fire.y1 > top - 24 && fire.y0 < top + viewH;
      if (onScreen) drawSprite(ctx, clipFrame(flames, time + fire.prop.x), Math.round(fire.prop.x) - left, Math.round(fire.prop.y) - top);
    }
    if (scene.exit) {
      const lamps = clipFrame(this.art.environment.escapeVanLights, this.reducedMotion ? 0 : time);
      drawSprite(ctx, lamps, Math.round(scene.exit.x) - left, Math.round(scene.exit.y) - top);
    }
    beginStatusFrame();
    for (const zombie of scene.zombies) {
      const onScreen = zombie.burning && zombie.x > left - CULL_MARGIN && zombie.x < left + viewW + CULL_MARGIN && zombie.y > top && zombie.y < top + viewH + CULL_MARGIN;
      if (onScreen) paintBurn(ctx, zombie, Math.round(zombie.x) - left, Math.round(zombie.y) - top, this.bodyHeightOf(zombie.id), time, this.reducedMotion);
    }
    for (const bullet of scene.bullets) {
      const clip = this.art.fx.tracer[dirFromAngle(Math.atan2(bullet.vy, bullet.vx))];
      const bx = Math.round(bullet.x) - left;
      const by = Math.round(bullet.y) - CHEST_HEIGHT - top;
      drawSprite(ctx, clipFrame(clip, time), bx, by);
      paintEffectTrail(ctx, bullet, bx, by);
    }
  }

  /** A small star where the light lands on loot: enough to catch the eye, no pool to give the room away. */
  drawGlints(ctx: CanvasRenderingContext2D, scene: SceneView, left: number, top: number, viewW: number, viewH: number, time: number, lightAt: (x: number, y: number) => number): void {
    for (const pickup of scene.pickups) {
      const x = Math.round(pickup.x) - left;
      const y = Math.round(pickup.y) - top - GLINT_HEIGHT;
      const onScreen = x >= 0 && y >= 0 && x < viewW && y < viewH;
      const cycle = (time / GLINT_CYCLE_SEC + glintPhase(pickup.id)) % 1;
      const showing = onScreen && cycle < GLINT_SHARE && lightAt(x, y + GLINT_HEIGHT) >= GLINT_LIGHT;
      if (!showing) continue;
      const reach = cycle < GLINT_SHARE / 2 ? 1 : 2;
      ctx.fillStyle = GLINT_RAY;
      ctx.fillRect(x - reach, y, reach * 2 + 1, 1);
      ctx.fillRect(x, y - reach, 1, reach * 2 + 1);
      ctx.fillStyle = GLINT_CORE;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  private hiddenByShell(player: PlayerEntity, left: number, top: number, viewW: number, viewH: number): boolean {
    return this.buildings.placed.some((placed) => {
      const onScreen = placed.x1 > left && placed.x0 < left + viewW && placed.y1 > top && placed.y0 < top + viewH;
      return onScreen && placed.reveal < 0.5 && this.covers(placed, placed.depthY, player);
    });
  }

  /** Teammates stay findable behind and inside buildings as a pale outline. */
  drawOccluded(ctx: CanvasRenderingContext2D, scene: SceneView, left: number, top: number, viewW: number, viewH: number): void {
    ctx.globalAlpha = SILHOUETTE_ALPHA;
    for (const player of scene.players) {
      const sprite = this.visuals.get(player.id).sprite;
      const showsOutline = sprite !== null && player.status !== 'dead' && this.hiddenByShell(player, left, top, viewW, viewH);
      if (showsOutline) drawSilhouette(ctx, sprite, Math.round(player.x) - left, Math.round(player.y) - top);
    }
    ctx.globalAlpha = 1;
  }
}
