import { EMOTE_SHOW_SEC } from '../../shared/emotes.ts';
import type { EmoteId } from '../../shared/emotes.ts';
import type { EntityId, GameEvent } from '../../shared/protocol.ts';
import type { ArtBook } from '../art/types.ts';
import { drawArrow, edgePointer } from './overlay-renderer.ts';
import type { SceneView } from './scene.ts';
import { bodyHeight, drawSprite } from './sprite-cache.ts';
import type { VisualStore } from './visuals.ts';

const BONE = '#faf2d4';
const DEFAULT_BODY_HEIGHT = 20;
/** Above the name tag and health bar. */
const ABOVE_HEAD = 30;
/** Keeps the icon clear of the screen's edge, with the arrow beyond it. */
const ICON_INSET = 18;
const ARROW_INSET = 6;

interface Shown {
  readonly emote: EmoteId;
  readonly until: number;
}

/** The icon a survivor just sent, over their head for two seconds, or pinned to the edge with an arrow when they are off screen. */
export class EmoteOverlay {
  private readonly shown = new Map<EntityId, Shown>();
  private readonly art: ArtBook;
  private readonly visuals: VisualStore;

  constructor(art: ArtBook, visuals: VisualStore) {
    this.art = art;
    this.visuals = visuals;
  }

  /** Takes every game event and keeps the emotes. */
  handle(event: GameEvent, time: number): void {
    switch (event.type) {
      case 'emote': this.show(event.playerId, event.emote, time); break;
      default: break;
    }
  }

  show(playerId: EntityId, emote: EmoteId, time: number): void {
    this.shown.set(playerId, { emote, until: time + EMOTE_SHOW_SEC });
  }

  clear(): void {
    this.shown.clear();
  }

  private heightOf(id: EntityId): number {
    const sprite = this.visuals.get(id).sprite;
    return sprite ? bodyHeight(sprite) : DEFAULT_BODY_HEIGHT;
  }

  /** headroomOf: how much higher than usual a survivor's head tags reach this frame (a candy timer), so the icon sits over them. */
  draw(ctx: CanvasRenderingContext2D, scene: SceneView, left: number, top: number, viewW: number, viewH: number, time: number, headroomOf: (id: EntityId) => number = () => 0): void {
    for (const [id, { emote, until }] of this.shown) {
      const player = scene.players.find((each) => each.id === id);
      const gone = time >= until || player === undefined;
      if (gone) {
        this.shown.delete(id);
        continue;
      }
      const sprite = this.art.ui.emotes[emote];
      const x = Math.round(player.x) - left;
      const y = Math.round(player.y) - top;
      const pinned = edgePointer(x, y, viewW, viewH, ICON_INSET);
      if (!pinned) {
        drawSprite(ctx, sprite, x, y - this.heightOf(id) - ABOVE_HEAD - headroomOf(id));
        continue;
      }
      drawSprite(ctx, sprite, pinned.x, pinned.y);
      const arrow = edgePointer(x, y, viewW, viewH, ARROW_INSET);
      if (arrow) drawArrow(ctx, arrow, BONE);
    }
  }
}
