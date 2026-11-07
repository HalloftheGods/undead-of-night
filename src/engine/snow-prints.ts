import type { TrackEntity, ZombieEntity } from '../../shared/protocol.ts';
import { TRACK_LIFE_SEC } from '../../shared/town-rules.ts';

// Snow prints and the mark over a zombie that is following them. Both are drawn from the snapshot alone,
// so a reconnect or a level change leaves nothing stale behind.

const PRINT_COLOR = '#4f5d73';
/** A fresh print's opacity; it fades toward nothing as the snow fills it. */
const PRINT_ALPHA = 0.6;
/** Left and right boots sit this far either side of the walking line. */
const STEP_SIDE = 2;
const MARGIN = 8;

const SNIFF_COLOR = '#cfe6ff';
const SNIFF_HEIGHT = 26;
const SNIFF_HZ = 2.2;

/** Same print, same foot, every frame: a cheap hash of where it lies. */
const leftFoot = (print: TrackEntity): boolean => ((print.x * 7 + print.y * 13) & 1) === 0;

/** Boot prints on the ground, fading as they fill in. Call before the lightmap so they sit in the dark like the snow. */
export function paintPrints(ctx: CanvasRenderingContext2D, tracks: readonly TrackEntity[], left: number, top: number, viewW: number, viewH: number): void {
  const hasNoTracks = tracks.length === 0;
  if (hasNoTracks) return;
  const previous = ctx.globalAlpha;
  ctx.fillStyle = PRINT_COLOR;
  for (const print of tracks) {
    const sx = print.x - left;
    const sy = print.y - top;
    const onScreen = sx > -MARGIN && sx < viewW + MARGIN && sy > -MARGIN && sy < viewH + MARGIN;
    if (!onScreen) continue;
    const fresh = Math.min(1, Math.max(0, print.left / TRACK_LIFE_SEC));
    ctx.globalAlpha = PRINT_ALPHA * fresh;
    const ahead = { x: Math.cos(print.angle), y: Math.sin(print.angle) };
    const side = leftFoot(print) ? -STEP_SIDE : STEP_SIDE;
    const footX = sx - ahead.y * side;
    const footY = sy + ahead.x * side;
    // Heel, then the wider sole a little ahead of it.
    ctx.fillRect(Math.round(footX - ahead.x * 2), Math.round(footY - ahead.y * 2), 1, 1);
    ctx.fillRect(Math.round(footX + ahead.x - 1), Math.round(footY + ahead.y), 2, 1);
    ctx.fillRect(Math.round(footX + ahead.x * 2 - 1), Math.round(footY + ahead.y * 2), 2, 1);
  }
  ctx.globalAlpha = previous;
}

/**
 * Scent rising over every zombie on someone's trail, so nobody is caught out by a nose they never saw.
 * Drawn after the lightmap: a tracker in the dark still shows its tell.
 */
export function paintTrackingMarks(ctx: CanvasRenderingContext2D, zombies: readonly ZombieEntity[], left: number, top: number, viewW: number, viewH: number, time: number, reducedMotion: boolean): void {
  const previous = ctx.globalAlpha;
  ctx.fillStyle = SNIFF_COLOR;
  for (const zombie of zombies) {
    if (!zombie.tracking) continue;
    const x = Math.round(zombie.x) - left;
    const y = Math.round(zombie.y) - SNIFF_HEIGHT - top;
    const onScreen = x > -MARGIN && x < viewW + MARGIN && y > -MARGIN && y < viewH + MARGIN;
    if (!onScreen) continue;
    const phase = reducedMotion ? 0.5 : (time * SNIFF_HZ) % 1;
    for (let i = 0; i < 3; i += 1) {
      const rise = (phase + i / 3) % 1;
      ctx.globalAlpha = 1 - rise * 0.7;
      ctx.fillRect(x - 3 + i * 3, Math.round(y - rise * 4), 1, 1);
    }
  }
  ctx.globalAlpha = previous;
}
