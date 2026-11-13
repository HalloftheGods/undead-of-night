import { TILE_SIZE } from '@shared/protocol.ts';
import type { PlayerEntity, ZombieEntity } from '@shared/protocol.ts';
import { DROP_COLOR } from './map-markers.ts';
import { drawRowsCentred, MAP_INK } from './map-sprite.ts';
import type { SpriteLegend } from './map-sprite.ts';

const FOV_WORLD_RANGE = 380;
const FOV_CLOSE_RANGE = 70;
const FOV_HALF_ANGLE = Math.PI / 3;

const FOV_WORLD_RANGE_SQ = FOV_WORLD_RANGE * FOV_WORLD_RANGE;
const FOV_CLOSE_RANGE_SQ = FOV_CLOSE_RANGE * FOV_CLOSE_RANGE;

const FOG_COLOR = 'rgba(8, 9, 12, 0.90)';
const DEFAULT_CLEAR_RADIUS_PX = 14;

const ZOMBIE_BLIP: readonly string[] = [
  '.K.',
  'KRK',
  '.K.',
];

const BOSS_BLIP: readonly string[] = [
  '.KKK.',
  'KRRRK',
  'KRRRK',
  'KRRRK',
  '.KKK.',
];

const BLIP_LEGEND: SpriteLegend = {
  K: MAP_INK,
  R: DROP_COLOR,
};

export function isEntityBelow(y: number, sewerTopTile: number | undefined): boolean {
  const hasSewers = sewerTopTile !== undefined;
  if (!hasSewers) return false;
  const sewerBoundaryY = sewerTopTile * TILE_SIZE;
  return y >= sewerBoundaryY;
}

export function isZombieInFov(zombie: ZombieEntity, observer: PlayerEntity): boolean {
  const isAlive = zombie.health > 0;
  if (!isAlive) return false;

  const dx = zombie.x - observer.x;
  const dy = zombie.y - observer.y;
  const distSq = dx * dx + dy * dy;

  const isClose = distSq <= FOV_CLOSE_RANGE_SQ;
  if (isClose) return true;

  const isOutOfRange = distSq > FOV_WORLD_RANGE_SQ;
  if (isOutOfRange) return false;

  const angleToTarget = Math.atan2(dy, dx);
  const rawDiff = angleToTarget - observer.angle;
  const angleDiff = Math.atan2(Math.sin(rawDiff), Math.cos(rawDiff));
  const isInCone = Math.abs(angleDiff) <= FOV_HALF_ANGLE;

  return isInCone;
}

export function drawZombieBlips(
  ctx: CanvasRenderingContext2D,
  zombies: readonly ZombieEntity[],
  observers: readonly PlayerEntity[],
  worldPerPx: number,
  sewerTopTile: number | undefined,
  viewerBelow: boolean,
): void {
  const aliveObservers = observers.filter((observer) => observer.status !== 'dead');
  const hasObservers = aliveObservers.length > 0;
  if (!hasObservers) return;

  const sewerShift = sewerTopTile !== undefined ? sewerTopTile * TILE_SIZE : 0;

  const isVisible = (zombie: ZombieEntity): boolean => {
    const isZombieBelow = isEntityBelow(zombie.y, sewerTopTile);
    const isCorrectLayer = isZombieBelow === viewerBelow;
    if (!isCorrectLayer) return false;

    const visibleToObserver = (observer: PlayerEntity): boolean => {
      const isObserverBelow = isEntityBelow(observer.y, sewerTopTile);
      const isSameLayer = isZombieBelow === isObserverBelow;
      return isSameLayer && isZombieInFov(zombie, observer);
    };
    return aliveObservers.some(visibleToObserver);
  };

  const visibleZombies = zombies.filter(isVisible);

  for (const zombie of visibleZombies) {
    const isBoss = zombie.boss !== undefined;
    const px = Math.round(zombie.x / worldPerPx);
    const py = Math.round((zombie.y - (viewerBelow ? sewerShift : 0)) / worldPerPx);
    const sprite = isBoss ? BOSS_BLIP : ZOMBIE_BLIP;
    drawRowsCentred(ctx, px, py, sprite, BLIP_LEGEND);
  }
}

export class MapFog {
  private readonly surfaceFog: HTMLCanvasElement;
  private sewerFog: HTMLCanvasElement | null = null;
  private readonly clearRadiusPx: number;

  constructor(
    private readonly width: number,
    private readonly height: number,
    clearRadiusPx: number = DEFAULT_CLEAR_RADIUS_PX,
  ) {
    this.clearRadiusPx = clearRadiusPx;
    this.surfaceFog = document.createElement('canvas');
    this.surfaceFog.width = width;
    this.surfaceFog.height = height;
    this.fillFog(this.surfaceFog);
  }

  private fillFog(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = FOG_COLOR;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  private getSewerFog(): HTMLCanvasElement {
    if (this.sewerFog) return this.sewerFog;
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    this.fillFog(canvas);
    this.sewerFog = canvas;
    return canvas;
  }

  reveal(px: number, py: number, isBelow: boolean): void {
    const targetCanvas = isBelow ? this.getSewerFog() : this.surfaceFog;
    const ctx = targetCanvas.getContext('2d')!;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(px, py, this.clearRadiusPx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawFog(ctx: CanvasRenderingContext2D, isBelow: boolean): void {
    const targetCanvas = isBelow ? this.sewerFog : this.surfaceFog;
    if (targetCanvas) ctx.drawImage(targetCanvas, 0, 0);
  }

  reset(): void {
    this.fillFog(this.surfaceFog);
    if (this.sewerFog) this.fillFog(this.sewerFog);
  }
}
