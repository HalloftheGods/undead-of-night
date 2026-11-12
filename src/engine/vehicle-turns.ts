// The ring of headings a driven car is drawn at. Where the nose is square to the screen the hand-drawn
// facing serves; between facings the car is a turn model, drawn the first time that body, coat and step
// are needed and kept after, so only cars that are actually driven cost anything.

import { VEHICLE_BODIES } from '../../shared/vehicle-bodies.ts';
import type { VehicleBody, VehicleFacing } from '../../shared/vehicle-bodies.ts';
import { buildTurnModel, renderTurn } from '../art/environment/vehicle-turn-model.ts';
import type { TurnModel, TurnSource } from '../art/environment/vehicle-turn-model.ts';
import { PixelCanvas, spriteToCanvas } from '../art/kit.ts';
import type { ArtBook, Clip, PixelSprite } from '../art/types.ts';

/** Headings round the ring: eight to a quarter turn, seven of them between two facings. */
export const TURN_STEPS = 32;
const STEP_ANGLE = (2 * Math.PI) / TURN_STEPS;
const QUARTER = TURN_STEPS / 4;
/** Clockwise from east, as headings run. */
const SQUARE: readonly VehicleFacing[] = ['e', 's', 'w', 'n'];

/** The step nearest a heading: 0 is east, counting clockwise on screen. */
export function turnStepOf(heading: number): number {
  const step = Math.round(heading / STEP_ANGLE) % TURN_STEPS;
  return (step + TURN_STEPS) % TURN_STEPS;
}

export const turnHeading = (step: number): number => step * STEP_ANGLE;

/** The facing a step is drawn as by hand, or null for a step between two facings. */
export function squareFacing(step: number): VehicleFacing | null {
  return step % QUARTER === 0 ? SQUARE[step / QUARTER] : null;
}

interface TurnCache {
  readonly models: Map<string, TurnModel>;
  readonly sprites: Map<string, PixelSprite>;
  readonly beacons: Map<string, Clip>;
}

const caches = new WeakMap<ArtBook, TurnCache>();

function cacheOf(art: ArtBook): TurnCache {
  const have = caches.get(art);
  if (have) return have;
  const made: TurnCache = { models: new Map(), sprites: new Map(), beacons: new Map() };
  caches.set(art, made);
  return made;
}

function remember<T>(map: Map<string, T>, key: string, make: () => T): T {
  const have = map.get(key);
  if (have !== undefined) return have;
  const made = make();
  map.set(key, made);
  return made;
}

const sourceOf = (art: ArtBook, body: VehicleBody, coat: number): TurnSource => {
  const { w, n, s } = art.vehicles[body];
  return { west: w[coat], north: n[coat], south: s[coat] };
};

function modelOf(art: ArtBook, body: VehicleBody, coat: number): TurnModel {
  return remember(cacheOf(art).models, `${body}:${coat}`, () => buildTurnModel(sourceOf(art, body, coat), VEHICLE_BODIES[body]));
}

/** The body in this coat at a step of the ring. Steps square to the screen have hand-drawn sprites in art.vehicles; ask for those there. */
export function turnSprite(art: ArtBook, body: VehicleBody, coat: number, step: number): PixelSprite {
  return remember(cacheOf(art).sprites, `${body}:${coat}:${step}`, () => renderTurn(modelOf(art, body, coat), turnHeading(step)));
}

/**
 * Draws one more of a coat's turn models, the nearest to `step` not drawn yet, and says whether there
 * was one left. Called once a frame for a moving car, it spreads the ring's cost so no turn stutters.
 */
export function warmTurn(art: ArtBook, body: VehicleBody, coat: number, step: number): boolean {
  const { sprites } = cacheOf(art);
  for (let away = 0; away <= TURN_STEPS / 2; away += 1) {
    for (const side of [1, -1]) {
      const near = (step + side * away + TURN_STEPS) % TURN_STEPS;
      const isWanted = squareFacing(near) === null && !sprites.has(`${body}:${coat}:${near}`);
      if (!isWanted) continue;
      turnSprite(art, body, coat, near);
      return true;
    }
  }
  return false;
}

const over = (under: PixelSprite, lamps: PixelSprite): PixelSprite => {
  const canvas = spriteToCanvas(under).blit(spriteToCanvas(lamps), 0, 0);
  return canvas.toSprite(under.w, under.h, under.ax, under.ay);
};

/** Only the pixels the lit bar changes, sized and anchored like the body under them. */
function litPixels(unlit: PixelSprite, lit: PixelSprite): PixelSprite {
  const canvas = new PixelCanvas(unlit.w, unlit.h);
  const before = spriteToCanvas(unlit);
  const after = spriteToCanvas(lit);
  for (let y = 0; y < unlit.h; y += 1) {
    for (let x = 0; x < unlit.w; x += 1) {
      const color = after.get(x, y);
      const changed = color !== null && color !== before.get(x, y);
      if (changed) canvas.px(x, y, color);
    }
  }
  return canvas.toSprite(unlit.w, unlit.h, unlit.ax, unlit.ay);
}

/** A light bar's frames at a step between facings, or null for a body with no bar. The bar is lit on the drawings and turned with the car. */
export function turnBeacon(art: ArtBook, body: VehicleBody, step: number): Clip | null {
  const clips = art.vehicleBeacons[body];
  if (!clips) return null;
  return remember(cacheOf(art).beacons, `${body}:${step}`, () => {
    const unlit = turnSprite(art, body, 0, step);
    const source = sourceOf(art, body, 0);
    const frames = clips.w.frames.map((_, frame) => {
      const lit: TurnSource = {
        west: over(source.west, clips.w.frames[frame]),
        north: over(source.north, clips.n.frames[frame]),
        south: over(source.south, clips.s.frames[frame]),
      };
      return litPixels(unlit, renderTurn(buildTurnModel(lit, VEHICLE_BODIES[body]), turnHeading(step)));
    });
    return { ...clips.w, frames };
  });
}
