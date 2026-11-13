// The camp on the Tab map: its tents at the camp's own scale, the fence ring round them, and any gap the horde has made in it.

import { BUILDING_DEFS, PROP_DEFS } from '@shared/protocol.ts';
import type { WorldMap } from '@shared/protocol.ts';
import { isLifted } from '@shared/world-query.ts';
import { paintBuilding } from './map-buildings.ts';
import type { MapBox } from './map-buildings.ts';

const FENCE_COLOR = '#8a8f9c';
const GATE_COLOR = '#d8a24a';
const GAP_COLOR = '#ff5a4a';

/** A footprint in map pixels at this scale. */
function boxAt(x: number, y: number, w: number, h: number, worldPerPx: number): MapBox {
  const x0 = Math.round(x / worldPerPx);
  const y0 = Math.round(y / worldPerPx);
  return { x0, y0, x1: Math.max(x0 + 1, Math.round((x + w) / worldPerPx)), y1: Math.max(y0 + 1, Math.round((y + h) / worldPerPx)) };
}

/** The tents and the fence, onto the map's base. */
export function paintCamp(ctx: CanvasRenderingContext2D, map: WorldMap, worldPerPx: number): void {
  for (const tent of map.buildings) {
    const { w, h, doorX } = BUILDING_DEFS[tent.kind];
    paintBuilding(ctx, boxAt(tent.x, tent.y, w, h, worldPerPx), tent.kind, Math.round(doorX / worldPerPx), Math.round(tent.x) ^ Math.round(tent.y));
  }
  for (const section of map.camp?.sections ?? []) {
    const { w, h } = PROP_DEFS[section.kind];
    const box = boxAt(section.x - w / 2, section.y - h, w, h, worldPerPx);
    ctx.fillStyle = section.kind === 'camp_gate' ? GATE_COLOR : FENCE_COLOR;
    ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  }
}

/** Every section the horde has brought down, marked over the base as the room's copy of the map has it. */
export function paintCampGaps(ctx: CanvasRenderingContext2D, map: WorldMap, worldPerPx: number): void {
  for (const section of map.camp?.sections ?? []) {
    if (!isLifted(map, section.index)) continue;
    const { w, h } = PROP_DEFS[section.kind];
    const box = boxAt(section.x - w / 2, section.y - h, w, h, worldPerPx);
    ctx.fillStyle = GAP_COLOR;
    ctx.fillRect(box.x0 - 1, box.y0 - 1, box.x1 - box.x0 + 2, box.y1 - box.y0 + 2);
  }
}
