// The little marks on a building the team walked out of with supplies still inside: one per kind of thing
// left, in a row along the building's foot, so a player can see where to go back to.

import { SUPPLY_KINDS } from '../../shared/leftovers.ts';
import type { SupplyKind } from '../../shared/leftovers.ts';

const INK = '#0b0c10';
/** Each mark is a 5 by 5 glyph on a dark square one pixel bigger all round. */
const GLYPH = 5;
const STEP = GLYPH + 2;
const INSET = 2;

export const LEFTOVER_COLOR: Record<SupplyKind, string> = {
  med: '#ff5d73',
  ammo: '#ffe27a',
  weapon: '#d0d4dc',
  gear: '#c58cff',
};

const LEFTOVER_LABEL: Record<SupplyKind, string> = {
  med: 'Left behind: medical',
  ammo: 'Left behind: ammo',
  weapon: 'Left behind: a weapon',
  gear: 'Left behind: parts and finds',
};

/** What the marks mean, for the key beside the map. */
export const LEFTOVER_LEGEND: readonly (readonly [string, string])[] = SUPPLY_KINDS.map((kind) => [LEFTOVER_COLOR[kind], LEFTOVER_LABEL[kind]]);

/** Pixels lit in each glyph, as [x, y] from its top left. */
const GLYPH_PIXELS: Record<SupplyKind, readonly (readonly [number, number])[]> = {
  // A first-aid cross.
  med: [[2, 0], [2, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [2, 3], [2, 4]],
  // Three rounds standing up.
  ammo: [[0, 1], [0, 2], [0, 3], [0, 4], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [4, 1], [4, 2], [4, 3], [4, 4]],
  // A pistol side on.
  weapon: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [3, 3], [4, 3], [3, 4], [4, 4]],
  // A diamond, for parts, kits and anything else worth having.
  gear: [[2, 0], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [1, 3], [2, 3], [3, 3], [2, 4]],
};

/** The kinds a building still holds, in the key's order. */
export function leftoverKinds(supplies: Partial<Record<SupplyKind, number>>): SupplyKind[] {
  return SUPPLY_KINDS.filter((kind) => (supplies[kind] ?? 0) > 0);
}

/** Draws the row of marks inside a building's footprint, from its bottom left corner. */
export function drawLeftovers(
  ctx: CanvasRenderingContext2D,
  box: { readonly x0: number; readonly y1: number },
  supplies: Partial<Record<SupplyKind, number>>,
): void {
  const top = box.y1 - INSET - GLYPH;
  leftoverKinds(supplies).forEach((kind, index) => {
    const left = box.x0 + INSET + index * STEP;
    ctx.fillStyle = INK;
    ctx.fillRect(left - 1, top - 1, GLYPH + 2, GLYPH + 2);
    ctx.fillStyle = LEFTOVER_COLOR[kind];
    for (const [dx, dy] of GLYPH_PIXELS[kind]) ctx.fillRect(left + dx, top + dy, 1, 1);
  });
}
