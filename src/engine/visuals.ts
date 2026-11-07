import type { EntityId, PlayerStatus } from '../../shared/protocol.ts';
import type { PixelSprite } from '../art/types.ts';

/** Purely cosmetic per-entity state that the sim has no reason to carry. */
export interface EntityVisual {
  /** Pixels walked, so legs keep pace with the ground instead of the clock. */
  walked: number;
  lastX: number;
  lastY: number;
  placed: boolean;
  flashUntil: number;
  fireAt: number;
  meleeAt: number;
  attacking: boolean;
  attackAt: number;
  status: PlayerStatus | null;
  statusAt: number;
  /** The frame last drawn, for bars and silhouettes that need its size. */
  sprite: PixelSprite | null;
  /** How far below the standard build this survivor holds a gun. */
  gunDrop: number;
  seenFrame: number;
}

function blankVisual(): EntityVisual {
  return {
    walked: 0,
    lastX: 0,
    lastY: 0,
    placed: false,
    flashUntil: 0,
    fireAt: Number.NEGATIVE_INFINITY,
    meleeAt: Number.NEGATIVE_INFINITY,
    attacking: false,
    attackAt: 0,
    status: null,
    statusAt: 0,
    sprite: null,
    gunDrop: 0,
    seenFrame: 0,
  };
}

export class VisualStore {
  private readonly visuals = new Map<EntityId, EntityVisual>();
  private frame = 0;

  get(id: EntityId): EntityVisual {
    let visual = this.visuals.get(id);
    if (!visual) {
      visual = blankVisual();
      visual.seenFrame = this.frame;
      this.visuals.set(id, visual);
    }
    return visual;
  }

  /** Marks an entity as still on the board this frame. */
  touch(id: EntityId): EntityVisual {
    const visual = this.get(id);
    visual.seenFrame = this.frame;
    return visual;
  }

  /** Drops anything not touched lately. */
  endFrame(): void {
    this.frame += 1;
    const isNotSweepFrame = this.frame % 120 !== 0;
    if (isNotSweepFrame) return;
    for (const [id, visual] of this.visuals) {
      const isStale = this.frame - visual.seenFrame > 120;
      if (isStale) this.visuals.delete(id);
    }
  }

  clear(): void {
    this.visuals.clear();
  }
}

/** Advances the walk counter from how far the entity actually moved. */
export function trackWalking(visual: EntityVisual, x: number, y: number): void {
  if (visual.placed) {
    const step = Math.hypot(x - visual.lastX, y - visual.lastY);
    const isWalkStep = step < 32;
    if (isWalkStep) visual.walked += step;
  }
  visual.placed = true;
  visual.lastX = x;
  visual.lastY = y;
}
