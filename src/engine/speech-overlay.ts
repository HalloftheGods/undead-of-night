import type { EntityId, GameEvent } from '../../shared/protocol.ts';
import { drawOutlinedText, FONT_HEIGHT, textWidth } from './bitmap-font.ts';
import { edgePointer } from './overlay-renderer.ts';
import type { SceneView } from './scene.ts';
import { bodyHeight } from './sprite-cache.ts';
import type { VisualStore } from './visuals.ts';

/** How long a line stays up, in seconds. */
export const SPEECH_SEC = 2;
const BONE = '#faf2d4';
const DEFAULT_BODY_HEIGHT = 20;
const ABOVE_HEAD = 36;
const EDGE_INSET = 18;
const MARGIN = 6;

interface Line {
  readonly text: string;
  readonly until: number;
}

/** What a survivor says in the world, 2 s over their head in the bitmap font, pinned to the screen's edge when they are off it. */
export class SpeechOverlay {
  private readonly lines = new Map<EntityId, Line>();
  private readonly visuals: VisualStore;

  constructor(visuals: VisualStore) {
    this.visuals = visuals;
  }

  /** Care events carry the words: the giver's offer, the receiver's answer and thanks. */
  handle(event: GameEvent, time: number): void {
    switch (event.type) {
      case 'care_start': this.say(event.giver, event.line, time); break;
      case 'care_reply': this.say(event.receiver, event.line, time); break;
      case 'care_done': this.say(event.receiver, event.line, time); break;
      default: break;
    }
  }

  say(id: EntityId, text: string, time: number): void {
    this.lines.set(id, { text: text.toUpperCase(), until: time + SPEECH_SEC });
  }

  clear(): void {
    this.lines.clear();
  }

  draw(ctx: CanvasRenderingContext2D, scene: SceneView, left: number, top: number, viewW: number, viewH: number, time: number): void {
    for (const [id, line] of this.lines) {
      const player = scene.players.find((each) => each.id === id);
      if (time >= line.until || player === undefined) {
        this.lines.delete(id);
        continue;
      }
      const x = Math.round(player.x) - left;
      const y = Math.round(player.y) - top;
      const sprite = this.visuals.get(id).sprite;
      const height = sprite ? bodyHeight(sprite) : DEFAULT_BODY_HEIGHT;
      const pinned = edgePointer(x, y, viewW, viewH, EDGE_INSET);
      const at = pinned ?? { x, y: y - height - ABOVE_HEAD };
      const half = Math.ceil(textWidth(line.text) / 2);
      const clampedX = Math.min(viewW - MARGIN - half, Math.max(MARGIN + half, at.x));
      drawOutlinedText(ctx, line.text, clampedX, Math.max(MARGIN, at.y - FONT_HEIGHT), BONE);
    }
  }
}
