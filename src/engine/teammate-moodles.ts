import type { EntityId, PlayerEntity } from '../../shared/protocol.ts';
import type { SurvivalNeeds } from '../../shared/survival-needs.ts';
import type { ArtBook } from '../art/types.ts';
import { buildMoodles } from '../game/hud-state.ts';
import type { MoodleView } from '../game/hud-state.ts';
import type { SceneView } from './scene.ts';
import { drawSprite } from './sprite-cache.ts';

export type MoodleId = MoodleView['id'];

/** Worst first: the earliest ailment in this list is the one icon over a teammate's head. */
export const MOODLE_ORDER: readonly MoodleId[] = ['bleeding', 'infection', 'thirst', 'hunger', 'fatigue'];

/** Icon bottom sits this far above the feet, the same stack the emotes use (above the name tag and health bar). */
const ABOVE_HEAD = 30;
/** The moodle icons are drawn on a 16 by 16 grid (`src/art/fx/moodles.ts`). */
const ICON_SIZE = 16;

/** The one moodle a survivor shows: the HUD's own thresholds, the worst ailment first. Null when none is active. */
export function worstMoodle(needs?: SurvivalNeeds): MoodleId | null {
  const active = new Set<MoodleId>(buildMoodles(needs).map((moodle) => moodle.id));
  return MOODLE_ORDER.find((id) => active.has(id)) ?? null;
}

export interface MoodlePlacement {
  readonly id: MoodleId;
  /** Centre of the icon, in view pixels. */
  readonly x: number;
  /** Bottom of the icon, in view pixels. */
  readonly y: number;
}

export interface MoodleSpot {
  readonly left: number;
  readonly top: number;
  readonly viewW: number;
  readonly viewH: number;
  /** Height of the body (feet to head) for a survivor. */
  readonly heightOf: (id: EntityId) => number;
  /** Extra lift from candy tags over the head this frame. */
  readonly headroomOf: (id: EntityId) => number;
}

/** Where each non-local survivor's moodle goes this frame. Off-screen survivors and the local player get nothing. */
export function teammateMoodlePlacements(
  scene: Pick<SceneView, 'players' | 'localId'>,
  spot: MoodleSpot,
  iconWidth: number,
  iconHeight: number
): readonly MoodlePlacement[] {
  const placements: MoodlePlacement[] = [];
  for (const player of scene.players as readonly Pick<PlayerEntity, 'id' | 'x' | 'y' | 'needs'>[]) {
    if (player.id === scene.localId) continue;
    const id = worstMoodle(player.needs);
    if (id === null) continue;
    const x = Math.round(player.x) - spot.left;
    const y = Math.round(player.y) - spot.top - spot.heightOf(player.id) - ABOVE_HEAD - spot.headroomOf(player.id);
    const top = y - iconHeight;
    const onScreen = x + iconWidth / 2 >= 0 && x - iconWidth / 2 <= spot.viewW && top >= 0 && y <= spot.viewH;
    if (!onScreen) continue;
    placements.push({ id, x, y });
  }
  return placements;
}

/** Draws one moodle above each teammate who has an ailment. Drawn under the speech bubble, over the world. */
export function drawTeammateMoodles(
  ctx: CanvasRenderingContext2D,
  art: ArtBook,
  scene: SceneView,
  spot: MoodleSpot
): void {
  const icons = art.ui.moodles;
  if (!icons) return;
  for (const placement of teammateMoodlePlacements(scene, spot, ICON_SIZE, ICON_SIZE)) {
    const sprite = icons[placement.id];
    drawSprite(ctx, sprite, Math.round(placement.x - sprite.w / 2), Math.round(placement.y - sprite.h));
  }
}
