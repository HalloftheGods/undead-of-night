import { CANDIES } from '../../shared/candy.ts';
import { MUZZLE_OFFSET } from '../../shared/constants.ts';
import { chainMultiplier } from '../../shared/kill-chain.ts';
import { FLARE_SEC } from '../../shared/throwables.ts';
import type { EntityId, GameEvent, PickupType, WeaponId, ZombieType } from '../../shared/protocol.ts';
import { dirFromAngle } from '../art/types.ts';
import type { ArtBook, PixelSprite } from '../art/types.ts';
import { barrelOffset } from './barrel.ts';
import { ParticleSystem } from './particles.ts';
import { burstFor } from './status-bursts.ts';
import { CHEST_HEIGHT } from './scene.ts';
import type { ScreenEffects } from './screen-effects.ts';
import type { VisualStore } from './visuals.ts';
import { hitPalette } from './hit-palette.ts';

const HIT_FLASH_SEC = 0.09;
const BLOOD = ['#8c1a14', '#a8231a', '#5e100c'];
const ACID = ['#a9d94a', '#6d9c22', '#d4f07a'];
const SPARK = ['#fff0b8', '#ffc04a', '#ff8e2e'];
const BOTTLE_GLASS = ['#8c8c56', '#c4f048', '#e4f0c0'];
const FLAMES = ['#ffd27a', '#ff9a2e', '#ff5a1c', '#c4300f'];
const DUST = ['#8a7a5c', '#b3a27a', '#5e523e'];
const FLARE_SPARKS = ['#ffd0d0', '#ff4a3c', '#ff7a5c'];
/** What a searcher is told they found besides the loot. */
function stashLabel(event: Extract<GameEvent, { type: 'container_opened' }>): string {
  if (event.candy) return CANDIES[event.candy].name.toUpperCase();
  return event.stash === 'fuel' ? 'FUEL' : 'FLARE';
}

/** Flames and sparks a second for a pool of fire and for a flare. */
const FIRE_DOTS_PER_SEC = 70;
const FLARE_DOTS_PER_SEC = 24;
const SKULL_CHIPS = ['#e4dcc3', '#c9bd9c', '#a8231a'];
/** The word goes over the head it names. */
const HEADSHOT_NOTE_GAP = 10;
const HEADSHOT_KICK = 0.22;
const SCORE_COLOR = '#e8a33d';
const REFUSED_COLOR = '#d9b98a';
/** Notices sit over the head, not on the ground at the feet. */
const NOTE_HEIGHT = 26;
const SHOVE_HIT_KICK = 0.4;

const MUZZLE_LIGHT: Record<WeaponId, { radius: number; life: number }> = {
  pistol: { radius: 64, life: 0.06 },
  carbine: { radius: 72, life: 0.05 },
  shotgun: { radius: 110, life: 0.1 },
};

const STATUS_LIGHT_RADIUS = 46;
const STATUS_LIGHT_LIFE = 0.25;
/** The blast door bursting: the screen-effects scale takes it down for reduced motion. */
const OVERRUN_BURST_SHAKE = 0.6;
/** A boss hitting the ground shakes the screen hardest of anything (reduced motion scales it down). */
const BOSS_DOWN_SHAKE = 0.95;
const SHOT_KICK: Record<WeaponId, number> = { pistol: 0.16, carbine: 0.12, shotgun: 0.42 };

const PICKUP_LABEL: Record<PickupType, string> = {
  bandage: 'BANDAGE',
  medkit: 'MEDKIT',
  pistol_ammo: 'PISTOL AMMO',
  carbine_ammo: 'CARBINE AMMO',
  shells: 'SHELLS',
  carbine: 'CARBINE',
  shotgun: 'SHOTGUN',
  knife: 'KNIFE',
  radio: 'RADIO',
  barrel: 'BARREL',
  grip: 'GRIP',
  magazine: 'MAGAZINE',
  suppressor: 'SUPPRESSOR',
  toolkit: 'TOOLKIT',
  incendiary_kit: 'FLAME KIT',
  acid_kit: 'ACID KIT',
  piercing_kit: 'PIERCING KIT',
  tranq_kit: 'TRANQ KIT',
  jewel_small: 'JEWEL',
  jewel_large: 'LARGE JEWEL',
};

/** A pool of fire or a lit flare, drawn from its event alone until it burns out. */
interface Burning {
  readonly kind: 'fire' | 'flare';
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  left: number;
  owed: number;
}

export interface PulseLight {
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
  readonly maxLife: number;
}

/** Where the viewer's own body is right now, ahead of what the server has reported. */
export interface FxContext {
  readonly localId: EntityId | null;
  readonly localX: number;
  readonly localY: number;
  readonly time: number;
  /** What the local player just took, worded with the amount, for a pickup event. */
  readonly pickupNote?: string;
}

export interface FxHooks {
  stamp(sprite: PixelSprite, x: number, y: number, alpha?: number): void;
  addCorpse(id: EntityId, type: ZombieType, x: number, y: number): void;
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function spread(amount: number): number {
  return (Math.random() - 0.5) * 2 * amount;
}

/** Turns sim events into everything visual that follows from them. */
/** The event of one type; an intersection, so a member shared by several types (the boss events) still narrows. */
type FxHandler<K extends GameEvent['type']> = (event: GameEvent & { readonly type: K }, ctx: FxContext) => void;
type FxHandlers = { readonly [K in GameEvent['type']]?: FxHandler<K> };

export class FxDirector {
  readonly particles: ParticleSystem;
  readonly pulses: PulseLight[] = [];
  private readonly burning: Burning[] = [];
  private readonly art: ArtBook;
  private readonly visuals: VisualStore;
  private readonly effects: ScreenEffects;
  private readonly hooks: FxHooks;

  constructor(art: ArtBook, visuals: VisualStore, effects: ScreenEffects, hooks: FxHooks) {
    this.art = art;
    this.visuals = visuals;
    this.effects = effects;
    this.hooks = hooks;
    this.particles = new ParticleSystem((sprite, x, y) => hooks.stamp(sprite, x, y));
  }

  clear(): void {
    this.particles.clear();
    this.pulses.length = 0;
    this.burning.length = 0;
  }

  update(dt: number): void {
    this.particles.update(dt);
    for (let i = this.pulses.length - 1; i >= 0; i -= 1) {
      this.pulses[i].life -= dt;
      const isPulseSpent = this.pulses[i].life <= 0;
      if (isPulseSpent) this.pulses.splice(i, 1);
    }
    // After the pulses age, so this frame's glow is drawn at full strength and gone by the next.
    this.burnOn(dt);
  }

  /** What each event draws; an event with no entry draws nothing. */
  private readonly handlers: FxHandlers = {
    shot: (event, ctx) => this.onShot(event, ctx),
    melee: (event, ctx) => this.onMelee(event, ctx),
    heal: (event, ctx) => this.onHeal(event, ctx),
    bullet_impact: (event) => this.onImpact(event.x, event.y, event.angle),
    zombie_hit: (event, ctx) => this.onZombieHit(event.zombieId, event.x, event.y, event.angle, ctx.time),
    headshot: (event, ctx) => this.onHeadshot(event, ctx),
    zombie_die: (event, ctx) => this.onZombieDie(event, ctx),
    bloater_burst: (event) => this.onBurst(event.x, event.y, event.radius),
    player_hurt: (event, ctx) => this.onPlayerHurt(event.playerId, event.x, event.y, event.damage, ctx),
    player_downed: (event) => this.stampBlood(event.x, event.y),
    player_revived: (event) => this.particles.addText('REVIVED', event.x, event.y - 14, hitPalette().safe),
    candy_eaten: (event) => this.particles.addText(event.saved ? 'SAVED BY CARAMEL' : CANDIES[event.candy].name.toUpperCase(), event.x, event.y - 14, hitPalette().safe),
    pickup: (event, ctx) => this.onPickup(event, ctx),
    container_opened: (event, ctx) => this.onContainerOpened(event, ctx),
    bottle_smash: (event) => this.onBottleSmash(event.x, event.y),
    molotov_burst: (event) => this.onMolotov(event.x, event.y, event.radius, event.sec),
    flare_lit: (event) => this.onFlare(event.x, event.y, event.sec),
    drop_called: (event) => this.onFlare(event.x, event.y, FLARE_SEC),
    drop_landed: (event) => this.onDropLanded(event.x, event.y),
    car_alarm: (event) => this.particles.addText('CAR ALARM', event.x, event.y - NOTE_HEIGHT, SCORE_COLOR),
    zombie_status: (event) => this.onZombieStatus(event),
    overrun_breach: () => this.effects.addShake(OVERRUN_BURST_SHAKE),
    boss_down: (event) => this.onBossDown(event.x, event.y),
  };

  handle(event: GameEvent, ctx: FxContext): void {
    const handler = this.handlers[event.type] as FxHandler<GameEvent['type']> | undefined;
    handler?.(event, ctx);
  }

  private onShot(event: Extract<GameEvent, { type: 'shot' }>, ctx: FxContext): void {
    const isLocal = event.playerId === ctx.localId;
    const dirX = Math.cos(event.angle);
    const dirY = Math.sin(event.angle);
    // Shot events report the barrel on the ground plane; the body is what the art hangs from.
    const bodyX = isLocal ? ctx.localX : event.x - dirX * MUZZLE_OFFSET;
    const bodyY = isLocal ? ctx.localY : event.y - dirY * MUZZLE_OFFSET;
    const dir = dirFromAngle(event.angle);
    const barrel = barrelOffset(event.weapon, dir);
    const tipX = bodyX + barrel.x;
    const shooter = this.visuals.get(event.playerId);
    const tipY = bodyY + barrel.y + shooter.gunDrop;
    shooter.fireAt = ctx.time;

    this.particles.addClip(this.art.fx.muzzle[event.weapon][dir], tipX, tipY, true);
    const light = MUZZLE_LIGHT[event.weapon];
    this.pulses.push({ x: tipX, y: bodyY, radius: light.radius, color: '#ffd28a', life: light.life, maxLife: light.life });
    this.ejectCasing(event.weapon, bodyX + dirX * 4, bodyY + dirY * 4, dirX, dirY);
    const isShotgun = event.weapon === 'shotgun';
    if (isShotgun) this.particles.addClip(this.art.fx.smokePuff, tipX, tipY, false);
    if (isLocal) this.effects.addShake(SHOT_KICK[event.weapon]);
  }

  private onMelee(event: Extract<GameEvent, { type: 'melee' }>, ctx: FxContext): void {
    this.visuals.get(event.playerId).meleeAt = ctx.time;
    const landedHere = event.hit && event.playerId === ctx.localId;
    if (landedHere) this.effects.addShake(SHOVE_HIT_KICK);
  }

  private onHeal(event: Extract<GameEvent, { type: 'heal' }>, ctx: FxContext): void {
    const isLocal = event.playerId === ctx.localId;
    const x = isLocal ? ctx.localX : event.x;
    const y = isLocal ? ctx.localY : event.y;
    this.particles.addText(`+${Math.round(event.amount)} HEALTH`, x, y - NOTE_HEIGHT, hitPalette().safe);
  }

  private ejectCasing(weapon: WeaponId, x: number, y: number, dirX: number, dirY: number): void {
    const sprite = weapon === 'shotgun' ? this.art.fx.shotgunShell : this.art.fx.shellCasing;
    const side = 34 + Math.random() * 24;
    this.particles.addCasing({
      x,
      y,
      z: CHEST_HEIGHT,
      vx: -dirY * side - dirX * 10 + spread(8),
      vy: dirX * side - dirY * 10 + spread(8),
      vz: 46 + Math.random() * 24,
      sprite,
      bounces: 0,
    });
  }

  private onImpact(x: number, y: number, angle: number): void {
    this.particles.addClip(this.art.fx.bulletImpact, x, y - CHEST_HEIGHT, true);
    this.burstDots(x, y, angle + Math.PI, SPARK, 5, 70, true);
  }

  /** A status newly took hold: a puff of its colour, and for fire a warm pulse of light. */
  private onZombieStatus(event: Extract<GameEvent, { type: 'zombie_status' }>): void {
    const burst = burstFor(event);
    this.burstDots(event.x, event.y, -Math.PI / 2, burst.colors, burst.count, burst.speed, burst.emissive, Math.PI);
    const isIncendiary = event.effect === 'incendiary';
    if (isIncendiary) this.pulses.push({ x: event.x, y: event.y, radius: STATUS_LIGHT_RADIUS, color: '#ff8a1c', life: STATUS_LIGHT_LIFE, maxLife: STATUS_LIGHT_LIFE });
  }

  private onZombieHit(id: EntityId, x: number, y: number, angle: number, time: number): void {
    this.visuals.get(id).flashUntil = time + HIT_FLASH_SEC;
    this.particles.addClip(this.art.fx.bloodBurst, x, y - CHEST_HEIGHT, false);
    this.burstDots(x, y, angle, BLOOD, 6, 60, false);
    const shouldSplatter = Math.random() < 0.35;
    if (shouldSplatter) this.stampBlood(x + spread(6), y + spread(6));
  }

  /** The event is at the head as drawn, and dots start CHEST_HEIGHT over the spot they are given. */
  private onHeadshot(event: Extract<GameEvent, { type: 'headshot' }>, ctx: FxContext): void {
    const { x, y, angle } = event;
    const groundY = y + CHEST_HEIGHT;
    this.particles.addClip(this.art.fx.bloodBurst, x, y, false);
    this.burstDots(x, groundY, angle, BLOOD, 12, 110, false, 1.1);
    this.burstDots(x, groundY, angle, SKULL_CHIPS, 6, 140, false, 1.1);
    const shotHere = event.playerId === ctx.localId;
    if (!shotHere) return;
    this.particles.addText(`HEADSHOT +${event.points}`, x, y - HEADSHOT_NOTE_GAP, hitPalette().strike);
    this.effects.addShake(HEADSHOT_KICK);
  }

  private onZombieDie(event: Extract<GameEvent, { type: 'zombie_die' }>, ctx: FxContext): void {
    const { x, y, angle } = event;
    this.hooks.addCorpse(event.zombieId, event.zombieType, x, y);
    this.burstDots(x, y, angle, BLOOD, 14, 80, false);
    this.stampBlood(x, y);
    this.stampBlood(x + Math.cos(angle) * 9, y + Math.sin(angle) * 9);
    const isLocalScore = event.killerId === ctx.localId && event.points > 0;
    if (isLocalScore) {
      // A chained kill shows what the chain paid it, so the callout's words come with a number.
      const chained = (event.chain ?? 1) > 1;
      const bonus = chained ? ` x${chainMultiplier(event.chain ?? 1)}` : '';
      this.particles.addText(`+${event.points}${bonus}`, x, y - 16, SCORE_COLOR);
    }
  }

  private onBurst(x: number, y: number, radius: number): void {
    const fx = this.art.fx;
    this.particles.addClip(fx.acidBurst, x, y, true);
    this.particles.addClip(fx.smokePuff, x + spread(10), y - 6 + spread(6), false);
    this.particles.addClip(fx.smokePuff, x + spread(14), y - 4 + spread(8), false);
    this.burstDots(x, y, 0, ACID, 34, 150, true, Math.PI);
    for (let i = 0; i < 6; i += 1) {
      const spot = Math.random() * Math.PI * 2;
      const reach = Math.random() * radius * 0.7;
      this.hooks.stamp(pick(fx.acidDecals), x + Math.cos(spot) * reach, y + Math.sin(spot) * reach);
    }
    this.pulses.push({ x, y, radius: radius * 3.2, color: '#b6f060', life: 0.34, maxLife: 0.34 });
    this.effects.addShake(0.75);
  }

  private onPlayerHurt(id: EntityId, x: number, y: number, damage: number, ctx: FxContext): void {
    this.visuals.get(id).flashUntil = ctx.time + HIT_FLASH_SEC;
    this.burstDots(x, y, -Math.PI / 2, BLOOD, 7, 50, false, Math.PI);
    const isLocalPlayer = id === ctx.localId;
    if (isLocalPlayer) {
      this.effects.addHurt(0.35 + damage / 40);
      this.effects.addShake(0.32);
    }
  }

  private onPickup(event: Extract<GameEvent, { type: 'pickup' }>, ctx: FxContext): void {
    const isLocal = event.playerId === ctx.localId;
    const x = isLocal ? ctx.localX : event.x;
    const y = isLocal ? ctx.localY : event.y;
    const label = isLocal && ctx.pickupNote ? ctx.pickupNote : PICKUP_LABEL[event.pickup];
    this.particles.addText(label, x, y - NOTE_HEIGHT, hitPalette().safe);
    this.pulses.push({ x: event.x, y: event.y, radius: 30, color: '#d8c89a', life: 0.18, maxLife: 0.18 });
  }

  /** Whoever hears a clatter sees where it came from; only the searcher is told they found nothing. */
  private onContainerOpened(event: Extract<GameEvent, { type: 'container_opened' }>, ctx: FxContext): void {
    const emptyHanded = !event.found && event.playerId === ctx.localId;
    const gotBottle = event.bottle === true && event.playerId === ctx.localId;
    if (event.noisy) this.particles.addText('CLATTER', event.x, event.y - NOTE_HEIGHT, SCORE_COLOR);
    else if (gotBottle) this.note('BOTTLE', event.x, event.y);
    else if (event.stash && event.playerId === ctx.localId) this.particles.addText(stashLabel(event), event.x, event.y - NOTE_HEIGHT, hitPalette().safe);
    else if (emptyHanded) this.note('NOTHING', event.x, event.y);
  }

  /** Green glass across the ground where a thrown bottle broke. */
  private onBottleSmash(x: number, y: number): void {
    this.burstDots(x, y, 0, BOTTLE_GLASS, 14, 70, false, Math.PI);
    this.particles.addText('SMASH', x, y - NOTE_HEIGHT, SCORE_COLOR);
  }

  private onMolotov(x: number, y: number, radius: number, sec: number): void {
    this.burstDots(x, y, 0, BOTTLE_GLASS, 10, 70, false, Math.PI);
    this.burstDots(x, y, -Math.PI / 2, FLAMES, 30, 120, true, Math.PI);
    this.pulses.push({ x, y, radius: radius * 4, color: '#ff8a1c', life: 0.3, maxLife: 0.3 });
    this.burning.push({ kind: 'fire', x, y, radius, left: sec, owed: 0 });
    this.effects.addShake(0.3);
  }

  /** The boss lands for good: a ring of dust, a flash of light where it fell and the hardest shake in the game. */
  private onBossDown(x: number, y: number): void {
    this.burstDots(x, y, -Math.PI / 2, DUST, 48, 160, false, Math.PI);
    this.burstDots(x, y, 0, BLOOD, 24, 120, false, Math.PI);
    for (let i = 0; i < 4; i += 1) this.particles.addClip(this.art.fx.smokePuff, x + spread(22), y - 4 + spread(10), false);
    this.pulses.push({ x, y, radius: 140, color: '#ffd28a', life: 0.4, maxLife: 0.4 });
    this.effects.addShake(BOSS_DOWN_SHAKE);
  }

  /** The crate hits the street: dust, splinters and a thump felt by anyone near. */
  private onDropLanded(x: number, y: number): void {
    this.burstDots(x, y, -Math.PI / 2, DUST, 26, 110, false, Math.PI);
    this.particles.addClip(this.art.fx.smokePuff, x + spread(8), y - 4, false);
    this.particles.addClip(this.art.fx.smokePuff, x + spread(12), y - 2, false);
    this.particles.addText('SUPPLIES', x, y - NOTE_HEIGHT, hitPalette().safe);
    this.effects.addShake(0.35);
  }

  private onFlare(x: number, y: number, sec: number): void {
    this.burstDots(x, y, -Math.PI / 2, FLARE_SPARKS, 12, 90, true, Math.PI);
    this.burning.push({ kind: 'flare', x, y, radius: 4, left: sec, owed: 0 });
  }

  /** Keeps every pool of fire and every flare alight: flames, sparks and a flickering glow each frame. */
  private burnOn(dt: number): void {
    for (let i = this.burning.length - 1; i >= 0; i -= 1) {
      const burn = this.burning[i];
      burn.left -= dt;
      const isBurnOver = burn.left <= 0;
      if (isBurnOver) {
        this.burning.splice(i, 1);
        continue;
      }
      const fire = burn.kind === 'fire';
      const fade = fire ? Math.min(1, burn.left / 1.2) : Math.min(1, burn.left / 3);
      burn.owed += dt * (fire ? FIRE_DOTS_PER_SEC : FLARE_DOTS_PER_SEC) * fade;
      for (; burn.owed >= 1; burn.owed -= 1) this.flameDot(burn, fire);
      const flicker = 0.85 + Math.random() * 0.15;
      const radius = (fire ? burn.radius * 3.4 : 130) * flicker * (0.5 + fade * 0.5);
      this.pulses.push({ x: burn.x, y: burn.y, radius, color: fire ? '#ff8a1c' : '#ff3a2a', life: dt * 1.01, maxLife: dt * 1.01 });
    }
  }

  private flameDot(burn: Burning, fire: boolean): void {
    const spot = Math.random() * Math.PI * 2;
    const reach = fire ? Math.sqrt(Math.random()) * burn.radius : 1;
    this.particles.addDot({
      x: burn.x + Math.cos(spot) * reach,
      y: burn.y + Math.sin(spot) * reach * 0.7,
      z: 1,
      vx: spread(fire ? 8 : 30),
      vy: spread(fire ? 4 : 30),
      vz: fire ? 30 + Math.random() * 40 : 40 + Math.random() * 60,
      life: 0.25 + Math.random() * 0.35,
      color: pick(fire ? FLAMES : FLARE_SPARKS),
      size: Math.random() < 0.3 ? 2 : 1,
      emissive: true,
    });
  }

  /** Over the local player's head, for what the sim says nothing about: an item left where it lay. */
  note(text: string, x: number, y: number): void {
    this.particles.addText(text, x, y - NOTE_HEIGHT, REFUSED_COLOR);
  }

  private stampBlood(x: number, y: number): void {
    this.hooks.stamp(pick(this.art.fx.bloodDecals), x, y);
  }

  private burstDots(
    x: number,
    y: number,
    angle: number,
    colors: readonly string[],
    count: number,
    speed: number,
    emissive: boolean,
    arc = 0.7,
  ): void {
    for (let i = 0; i < count; i += 1) {
      const heading = angle + spread(arc);
      const pace = speed * (0.35 + Math.random() * 0.65);
      this.particles.addDot({
        x,
        y,
        z: CHEST_HEIGHT,
        vx: Math.cos(heading) * pace,
        vy: Math.sin(heading) * pace,
        vz: 30 + Math.random() * 50,
        life: 0.3 + Math.random() * 0.35,
        color: pick(colors),
        size: Math.random() < 0.25 ? 2 : 1,
        emissive,
      });
    }
  }
}
