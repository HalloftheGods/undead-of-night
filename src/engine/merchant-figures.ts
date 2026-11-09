// The bunker's merchants on screen: walking, shooting and falling on the survivor rig, each with their own gun.
// Split from entity-renderer.ts, which sorts them in among everyone else.

import { MERCHANT_WALK_SPEED } from '../../shared/bunker-merchants.ts';
import { PLAYER_RADIUS } from '../../shared/constants.ts';
import type { MerchantEntity } from '../../shared/home-protocol.ts';
import { merchantBody } from '../art/environment/merchants.ts';
import { drawSilhouette, drawSprite } from './sprite-cache.ts';
import type { SurvivorFrames } from './survivor-frames.ts';
import { trackWalking } from './visuals.ts';
import type { VisualStore } from './visuals.ts';

/** As wide as a survivor's: they are the same build. */
export const MERCHANT_SHADOW_WIDTH = PLAYER_RADIUS * 2 + 2;

/** Draws one merchant at their spot, flashing white for a beat after a blow, as a survivor does. */
export function drawMerchant(
  ctx: CanvasRenderingContext2D,
  visuals: VisualStore,
  frames: SurvivorFrames,
  merchant: MerchantEntity,
  screen: { readonly x: number; readonly y: number },
  time: number,
): void {
  const visual = visuals.touch(merchant.id);
  trackWalking(visual, merchant.x, merchant.y);
  frames.track(visual, merchant.status, time);
  const body = merchantBody(merchant.id, merchant.weapon);
  const sprite = frames.figureFrame(body, body.set, merchant, MERCHANT_WALK_SPEED, visual, time);
  visual.sprite = sprite;
  visual.gunDrop = body.gunDrop;
  const flashing = time < visual.flashUntil;
  if (flashing) drawSilhouette(ctx, sprite, screen.x, screen.y);
  else drawSprite(ctx, sprite, screen.x, screen.y);
}
